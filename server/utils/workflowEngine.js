// M2 - Phase 2 - utils/workflowEngine.js
// Core state machine. Walks workflow nodes one at a time, pauses on approval
// nodes (M3's approve/reject API resumes via advanceWorkflow), and writes a
// per-node executionLog. Public surface: triggerWorkflow, advanceWorkflow,
// processNode.

const WorkflowExecution = require('../models/WorkflowExecution')
const Task = require('../models/Task')
const User = require('../models/User')
const Role = require('../models/Role')

const { createNotification } = require('./createNotification')
const { writeAuditLog } = require('./writeAuditLog')
const { sendTaskAssignedEmail } = require('./emailService')

// ---------- helpers ----------

const findRoleIdByName = async (name) => {
  if (!name) return null
  const role = await Role.findOne({ name }).lean()
  return role?._id || null
}

// Departments mirrored from User.department enum.
const KNOWN_DEPARTMENTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal']

const normaliseToken = (s) =>
  String(s || '').trim().toLowerCase().replace(/\s+/g, '_')

// Resolve a `<department>_manager` semantic token (e.g. "hr_manager",
// "finance_manager") to the first active Manager in that department.
const resolveDepartmentManager = async (token) => {
  const m = token.match(/^([a-z]+)_manager$/)
  if (!m) return null
  const dept = KNOWN_DEPARTMENTS.find((d) => d.toLowerCase() === m[1])
  if (!dept) return null
  const managerRoleId = await findRoleIdByName('Manager')
  if (!managerRoleId) return null
  const user = await User.findOne({
    role: managerRoleId,
    department: dept,
    isActive: true
  }).lean()
  return user?._id || null
}

const findFirstUserByRoleName = async (roleName) => {
  const roleId = await findRoleIdByName(roleName)
  if (!roleId) return null
  const u = await User.findOne({ role: roleId, isActive: true }).lean()
  return u?._id || null
}

// True when a user is currently on Out-of-Office (within the optional window).
const isUserOOO = (user, at = new Date()) => {
  const o = user && user.outOfOffice
  if (!o || !o.enabled) return false
  if (o.from && at < new Date(o.from)) return false
  if (o.until && at > new Date(o.until)) return false
  return true
}

// If the resolved approver is out of office, route to their chosen delegate.
// Returns { assignedTo, reason }; `reason` is null when no redirect happened 
// (so the original assignee stays).
const redirectIfOutOfOffice = async (assignedTo) => {
  if (!assignedTo) return { assignedTo, reason: null }
  const original = await User.findById(assignedTo)
    .select('name isActive outOfOffice managerId')
    .lean()
  if (!original || !isUserOOO(original)) return { assignedTo, reason: null }

  // Route to the chosen delegate if they are active and not also away
  if (original.outOfOffice?.delegateId) {
    const delegate = await User.findById(original.outOfOffice.delegateId)
      .select('name isActive outOfOffice')
      .lean()
    if (delegate && delegate.isActive !== false && !isUserOOO(delegate)) {
      return {
        assignedTo: delegate._id,
        reason: `${original.name} is out of office; routed to their chosen delegate ${delegate.name}.`
      }
    }
  }

  // No auto-routing fallback to manager. Task stays with original assignee if delegate is invalid/absent.
  return { assignedTo, reason: null }
}

// Resolve a semantic approver token using submitter context. Returns a User _id
// or null if the token is not recognised / no matching user exists. Tokens are
// case- and whitespace-insensitive ("Direct manager", "direct_manager", and
// "DIRECT MANAGER" all resolve identically).
const resolveSemanticApprover = async (rawToken, submitter) => {
  const token = normaliseToken(rawToken)
  if (!token) return null

  if (token === 'direct_manager') {
    return submitter?.managerId || null
  }
  if (token === 'hr_partner') {
    return submitter?.hrId || null
  }
  if (token === 'ceo') {
    return (await findFirstUserByRoleName('CEO')) || (await findFirstUserByRoleName('Admin'))
  }
  // Legacy alias: 'super_admin' now maps to the single Admin role.
  if (token === 'super_admin' || token === 'hr_admin') {
    return findFirstUserByRoleName('Admin')
  }

  // <department>_manager — e.g. "hr_manager", "finance_manager"
  const deptManager = await resolveDepartmentManager(token)
  if (deptManager) return deptManager

  return null
}

// Auto-detect the submitter and resolve THEIR OWN direct manager from the org
// chart. Verifies the manager is active; if the manager is missing or inactive,
// escalates UP the submitter's own chain (skip-level manager -> assigned HR
// partner -> an administrator) so a request is never silently handed to an
// unrelated manager. Returns { userId, reason }.
const resolveDirectManager = async (submitter) => {
  if (!submitter) return { userId: null, reason: null }
  const who = submitter.name || 'the submitter'

  // 1) The submitter's own direct manager — must still be active.
  if (submitter.managerId) {
    const mgr = await User.findOne({ _id: submitter.managerId, isActive: true }).select('name').lean()
    if (mgr) {
      return { userId: mgr._id, reason: `Auto-routed to ${mgr.name} — ${who}'s direct manager.` }
    }
    // 1a) Direct manager deactivated/removed -> climb to the skip-level manager
    //     (the manager's own manager), staying on the submitter's reporting line.
    const formerMgr = await User.findById(submitter.managerId).select('managerId').lean()
    if (formerMgr?.managerId) {
      const skip = await User.findOne({ _id: formerMgr.managerId, isActive: true }).select('name').lean()
      if (skip) {
        return { userId: skip._id, reason: `${who}'s direct manager is inactive; escalated to skip-level manager ${skip.name}.` }
      }
    }
  }

  // 2) No usable manager -> the submitter's assigned HR partner.
  if (submitter.hrId) {
    const hr = await User.findOne({ _id: submitter.hrId, isActive: true }).select('name').lean()
    if (hr) {
      return { userId: hr._id, reason: `${who} has no active manager; routed to their HR partner ${hr.name}.` }
    }
  }

  // 3) Last resort -> an administrator (never an unrelated peer manager).
  const adminId = await findFirstUserByRoleName('Admin')
  if (adminId) {
    const admin = await User.findById(adminId).select('name').lean()
    return { userId: adminId, reason: `${who} has no manager or HR on their chain; escalated to ${admin?.name || 'an administrator'}.` }
  }

  return { userId: null, reason: null }
}

// Auto-detect the submitter's ASSIGNED HR partner (User.hrId) and route to
// them. Verifies the partner is active; if missing or inactive, escalates to an
// active Manager in the HR department, then to an administrator — never to an
// unrelated person. Mirrors resolveDirectManager. Returns { userId, reason }.
const resolveHrPartner = async (submitter) => {
  if (!submitter) return { userId: null, reason: null }
  const who = submitter.name || 'the submitter'

  // 1) The submitter's own assigned HR partner — must still be active.
  if (submitter.hrId) {
    const hr = await User.findOne({ _id: submitter.hrId, isActive: true }).select('name').lean()
    if (hr) {
      return { userId: hr._id, reason: `Auto-routed to ${hr.name} — ${who}'s assigned HR partner.` }
    }
  }

  // 2) No usable HR partner -> an active Manager in the HR department.
  const hrManagerId = await resolveDepartmentManager('hr_manager')
  if (hrManagerId) {
    const mgr = await User.findById(hrManagerId).select('name').lean()
    return { userId: hrManagerId, reason: `${who} has no active HR partner; routed to HR manager ${mgr?.name || ''}.`.replace(/\s+\.$/, '.') }
  }

  // 3) Last resort -> an administrator.
  const adminId = await findFirstUserByRoleName('Admin')
  if (adminId) {
    const admin = await User.findById(adminId).select('name').lean()
    return { userId: adminId, reason: `${who} has no HR partner on record; escalated to ${admin?.name || 'an administrator'}.` }
  }

  return { userId: null, reason: null }
}

// Condition node field accessor. Lookup order:
//   1. "submitter.<key>"        -> execution.variables.submitter[key]
//   2. plain top-level variable -> execution.variables[field]
//      (used for runtime values like `lastApprovalOutcome`)
//   3. fallback                 -> execution.variables.formData[field]
const readConditionField = (field, variables) => {
  if (!field) return undefined
  if (field.startsWith('submitter.')) {
    const key = field.slice('submitter.'.length)
    return variables?.submitter?.[key]
  }
  if (variables && Object.prototype.hasOwnProperty.call(variables, field)) {
    return variables[field]
  }
  return (variables?.formData || {})[field]
}

const updateNodeLog = async (execution, nodeId, status, output = {}) => {
  const logEntry = execution.executionLog.find(l => l.nodeId === nodeId && !l.exitedAt)
  if (logEntry) {
    logEntry.status = status
    logEntry.exitedAt = new Date()
    logEntry.output = output
  }
  await execution.save()
}

const completeExecution = async (execution) => {
  execution.status = 'completed'
  execution.completedAt = new Date()
  if (execution.currentNodeId) {
    await updateNodeLog(execution, execution.currentNodeId, 'completed')
  } else {
    await execution.save()
  }

  writeAuditLog({
    action: 'workflow_completed',
    performedBy: execution.triggeredBy,
    targetEntity: `Workflow Execution #${execution._id}`,
    detail: 'Workflow completed successfully'
  })

  return { completed: true, executionId: execution._id }
}

// End-node option: when config.generatePdf is on, produce a signed PDF of the
// approved request (form data + approval trail + captured e-signatures), file it
// under /uploads, and surface it on both the execution's documents and the
// submitter's FormResponse so everyone can download it. Best-effort: a PDF
// failure never blocks the workflow from completing.
const maybeGeneratePdf = async (execution, node, workflow) => {
  // Generate when the End node opts in, OR when the workflow-wide
  // "Auto-generate PDF on completion" advanced setting is enabled.
  if (!node?.config?.generatePdf && !workflow?.advanced?.autoPdf) return
  try {
    const { generateApprovalPdf } = require('./pdf')
    const doc = await generateApprovalPdf(execution, workflow)

    execution.variables = execution.variables || {}
    const prior = Array.isArray(execution.variables.documents) ? execution.variables.documents : []
    execution.variables.documents = [
      ...prior,
      {
        name: doc.name, url: doc.url, mime: doc.mime, size: doc.size,
        step: node.label || 'Approved request', nodeId: node.id, generated: true,
      },
    ]
    execution.markModified('variables')
    await execution.save()

    if (execution.formResponseId) {
      const FormResponse = require('../models/FormResponse')
      await FormResponse.findByIdAndUpdate(execution.formResponseId, {
        $push: { attachments: { filename: doc.name, path: doc.url, mimetype: doc.mime } },
      })
    }

    writeAuditLog({
      action: 'workflow_completed',
      performedBy: execution.triggeredBy,
      targetEntity: `Workflow Execution #${execution._id}`,
      detail: `Signed PDF generated (${doc.name})`,
      metadata: { nodeId: node.id, url: doc.url }
    })
  } catch (err) {
    console.error(`PDF generation failed for execution ${execution._id}:`, err.message)
  }
}

const failExecution = async (execution, reason) => {
  execution.status = 'failed'
  execution.failedAt = new Date()
  execution.failureReason = reason
  if (execution.currentNodeId) {
    await updateNodeLog(execution, execution.currentNodeId, 'failed', { reason })
  } else {
    await execution.save()
  }

  writeAuditLog({
    action: 'workflow_failed',
    performedBy: execution.triggeredBy,
    targetEntity: `Workflow Execution #${execution._id}`,
    detail: reason
  })

  return { failed: true, reason }
}

// ---------- node handlers ----------

// Resolves who an approval / submit task should be assigned to. Order: a pinned
// user (config.approverId) -> dynamic DoA/LLM routing -> semantic tokens
// (direct_manager / hr_partner / ceo / <dept>_manager) -> plain role-name lookup
// scoped to the submitter's department. Shared by the approval + submit handlers.
// Returns { assignedTo, routingReason, routingSla }.
const resolveAssignee = async (execution, node, workflow) => {
  let assignedTo = node.config?.approverId || null
  const submitter = execution.variables?.submitter || null
  let routingReason = null
  let routingSla = null

  // Pass 0 (#01 Approval-Routing AI): when the node opts into dynamic routing
  // (config.approverStrategy = 'llm' | 'doa' | 'dynamic'), infer the approver
  // from the Delegation-of-Authority matrix + live org chart instead of a
  // hard-coded role. Falls through to the static passes below if it yields
  // nothing, so existing workflows are unaffected.
  const strategy = node.config?.approverStrategy
  if (!assignedTo && ['llm', 'doa', 'dynamic'].includes(strategy)) {
    try {
      const { resolveDynamicApprover } = require('./approverInference')
      const routed = await resolveDynamicApprover(execution, node, workflow)
      if (routed?.userId) {
        assignedTo = routed.userId
        routingReason = routed.reason
        routingSla = routed.slaHours
        writeAuditLog({
          action: 'approver_inferred',
          performedBy: execution.triggeredBy,
          targetEntity: `${workflow.title} — ${node.id}`,
          department: execution.variables?.department,
          detail: routed.reason,
          metadata: { source: routed.source, chain: routed.chainPreview }
        })
      }
    } catch (err) {
      console.error(`Dynamic approver routing failed on node "${node.id}":`, err.message)
    }
  }

  // Pass 1: semantic tokens (direct_manager, hr_partner, hr_manager, ceo, ...).
  // These need submitter context, which is why we resolve them first.
  // "direct_manager" auto-detects the submitter and routes to their OWN manager,
  // "hr_partner" to their OWN assigned HR partner — never an unrelated person —
  // each with an active-check + escalation up that submitter's chain.
  if (!assignedTo && node.config?.approverRole) {
    const token = normaliseToken(node.config.approverRole)
    if (token === 'direct_manager' || token === 'hr_partner') {
      const routed = token === 'direct_manager'
        ? await resolveDirectManager(submitter)
        : await resolveHrPartner(submitter)
      if (routed.userId) {
        assignedTo = routed.userId
        routingReason = routed.reason
        writeAuditLog({
          action: 'approver_inferred',
          performedBy: execution.triggeredBy,
          targetEntity: `${workflow.title} — ${node.id}`,
          department: execution.variables?.department,
          detail: routed.reason
        })
      }
    } else {
      assignedTo = await resolveSemanticApprover(node.config.approverRole, submitter)
    }
  }

  // Pass 2: plain role-name lookup (existing behaviour). Scoped to the
  // submitter's department when one is known, with a relax-and-retry fallback.
  // Resolves custom roles like "Warehouse Manager" / "Accounts Officer".
  if (!assignedTo && node.config?.approverRole) {
    const roleId = await findRoleIdByName(node.config.approverRole)
    if (roleId) {
      const query = { role: roleId, isActive: true }
      if (execution.variables?.department) query.department = execution.variables.department
      const approver = await User.findOne(query).lean()
      assignedTo = approver?._id || null

      if (!assignedTo && query.department) {
        delete query.department
        const fallback = await User.findOne(query).lean()
        assignedTo = fallback?._id || null
      }
    }
  }

  // Out-of-Office redirect: if the resolved assignee is away, route to their
  // manager. Applies to approval / submit / review nodes alike since they all
  // resolve their assignee through this function.
  if (assignedTo) {
    const ooo = await redirectIfOutOfOffice(assignedTo)
    if (ooo.reason) {
      assignedTo = ooo.assignedTo
      routingReason = [routingReason, ooo.reason].filter(Boolean).join(' ')
      writeAuditLog({
        action: 'approver_inferred',
        performedBy: execution.triggeredBy,
        targetEntity: `Workflow: ${workflow.title}`,
        detail: ooo.reason,
        metadata: { nodeId: node.id, redirectedTo: String(assignedTo), reason: 'out_of_office' }
      })
    }
  }

  return { assignedTo, routingReason, routingSla }
}

const handleApprovalNode = async (execution, node, workflow) => {
  const { assignedTo, routingReason, routingSla } = await resolveAssignee(execution, node, workflow)

  if (!assignedTo) {
    return await failExecution(
      execution,
      `Approval node "${node.id}" has no resolvable approver (approverRole="${node.config?.approverRole || ''}")`
    )
  }

  const slaHours = routingSla || node.config?.slaHours || 48

  const task = await Task.create({
    workflowExecutionId: execution._id,
    workflowId: workflow._id,
    assignedTo,
    submittedBy: execution.triggeredBy,
    formResponseId: execution.formResponseId,
    title: `${workflow.title} — Approval Required`,
    type: workflow.department || 'General',
    status: 'pending',
    dueDate: new Date(Date.now() + slaHours * 3600000),
    currentNode: node.id,
    approvalType: node.config?.approvalType || 'sequential',
    requireSignature: node.config?.requireSignature === true
  })

  createNotification({
    userId: assignedTo,
    title: 'New approval task assigned',
    message: `You have a new task requiring your approval: ${task.title}`,
    type: 'assignment',
    taskId: task._id,
    triggeredBy: execution.triggeredBy
  })

  const approver = await User.findById(assignedTo).select('name email').lean()
  if (approver?.email) {
    sendTaskAssignedEmail({
      to: approver.email,
      assigneeName: approver.name,
      taskTitle: task.title,
      submittedBy: 'NetFlow workflow',
      dueDate: task.dueDate
    })
  }

  execution.variables = execution.variables || {}
  execution.variables.pendingTaskId = task._id.toString()
  execution.variables.pendingNodeId = node.id
  if (routingReason) execution.variables.routingReason = routingReason
  // Mongoose Mixed type — tell it the variables object changed so the patch is persisted
  execution.markModified('variables')
  await execution.save()

  return { paused: true, taskId: task._id }
}

// Submit node: like an approval, but the assignee uploads document(s) + a comment
// and clicks Submit (no approve/reject). Pauses until POST /api/tasks/:id/submit
// resumes the workflow via advanceWorkflow(taskId, 'submitted').
const handleSubmitNode = async (execution, node, workflow) => {
  const { assignedTo, routingReason, routingSla } = await resolveAssignee(execution, node, workflow)

  if (!assignedTo) {
    return await failExecution(
      execution,
      `Submit node "${node.id}" has no resolvable assignee (approverRole="${node.config?.approverRole || ''}")`
    )
  }

  const slaHours = routingSla || node.config?.slaHours || 48

  const task = await Task.create({
    workflowExecutionId: execution._id,
    workflowId: workflow._id,
    assignedTo,
    submittedBy: execution.triggeredBy,
    formResponseId: execution.formResponseId,
    title: `${workflow.title} — ${node.label || 'Submission Required'}`,
    type: workflow.department || 'General',
    actionType: 'submit',
    status: 'pending',
    dueDate: new Date(Date.now() + slaHours * 3600000),
    currentNode: node.id,
    instructions: node.config?.instructions || '',
    formFields: Array.isArray(node.config?.formFields) ? node.config.formFields : []
  })

  createNotification({
    userId: assignedTo,
    title: 'New submission task assigned',
    message: `You have a new task that needs a submission: ${task.title}`,
    type: 'assignment',
    taskId: task._id,
    triggeredBy: execution.triggeredBy
  })

  const assignee = await User.findById(assignedTo).select('name email').lean()
  if (assignee?.email) {
    sendTaskAssignedEmail({
      to: assignee.email,
      assigneeName: assignee.name,
      taskTitle: task.title,
      submittedBy: 'NetFlow workflow',
      dueDate: task.dueDate
    })
  }

  execution.variables = execution.variables || {}
  execution.variables.pendingTaskId = task._id.toString()
  execution.variables.pendingNodeId = node.id
  if (routingReason) execution.variables.routingReason = routingReason
  execution.markModified('variables')
  await execution.save()

  return { paused: true, taskId: task._id }
}

// Review (viewer) node: a reviewer (e.g. Brand Representative) views the
// submission + accumulated documents, then chooses to forward (no changes) or
// send it back for changes. Pauses until POST /api/tasks/:id/review resumes the
// engine with outcome 'forward' | 'changes', which advanceWorkflow routes via
// the node's config.forwardPath / config.changesPath.
const handleReviewNode = async (execution, node, workflow) => {
  const { assignedTo, routingReason, routingSla } = await resolveAssignee(execution, node, workflow)

  if (!assignedTo) {
    return await failExecution(
      execution,
      `Review node "${node.id}" has no resolvable reviewer (approverRole="${node.config?.approverRole || ''}")`
    )
  }

  const slaHours = routingSla || node.config?.slaHours || 48

  const task = await Task.create({
    workflowExecutionId: execution._id,
    workflowId: workflow._id,
    assignedTo,
    submittedBy: execution.triggeredBy,
    formResponseId: execution.formResponseId,
    title: `${workflow.title} — ${node.label || 'Review Required'}`,
    type: workflow.department || 'General',
    actionType: 'review',
    status: 'pending',
    dueDate: new Date(Date.now() + slaHours * 3600000),
    currentNode: node.id,
    instructions: node.config?.instructions || ''
  })

  createNotification({
    userId: assignedTo,
    title: 'New review task assigned',
    message: `You have a new task to review: ${task.title}`,
    type: 'assignment',
    taskId: task._id,
    triggeredBy: execution.triggeredBy
  })

  const reviewer = await User.findById(assignedTo).select('name email').lean()
  if (reviewer?.email) {
    sendTaskAssignedEmail({
      to: reviewer.email,
      assigneeName: reviewer.name,
      taskTitle: task.title,
      submittedBy: 'NetFlow workflow',
      dueDate: task.dueDate
    })
  }

  execution.variables = execution.variables || {}
  execution.variables.pendingTaskId = task._id.toString()
  execution.variables.pendingNodeId = node.id
  if (routingReason) execution.variables.routingReason = routingReason
  execution.markModified('variables')
  await execution.save()

  return { paused: true, taskId: task._id }
}

const handleConditionNode = async (execution, node, workflow) => {
  const {
    conditionField,
    conditionOperator,
    conditionValue,
    truePath,
    falsePath
  } = node.config || {}

  // Supports both "formField" (reads execution.variables.formData) and
  // "submitter.role" / "submitter.department" / etc. for routing by who
  // submitted the form.
  const fieldValue = readConditionField(conditionField, execution.variables)

  let conditionMet = false
  switch (conditionOperator) {
    case 'eq':  conditionMet = String(fieldValue) === String(conditionValue); break
    case 'gt':  conditionMet = Number(fieldValue) > Number(conditionValue); break
    case 'lt':  conditionMet = Number(fieldValue) < Number(conditionValue); break
    case 'gte': conditionMet = Number(fieldValue) >= Number(conditionValue); break
    case 'lte': conditionMet = Number(fieldValue) <= Number(conditionValue); break
    case 'contains': conditionMet = String(fieldValue ?? '').includes(conditionValue); break
    default:    conditionMet = false
  }

  const nextNodeId = conditionMet ? truePath : falsePath
  await updateNodeLog(execution, node.id, 'completed', { conditionMet, nextNodeId })

  if (!nextNodeId) {
    return await failExecution(execution, `Condition node "${node.id}" has no path for outcome ${conditionMet}`)
  }
  return await processNode(execution, nextNodeId, workflow)
}

const handleNotificationNode = async (execution, node, workflow) => {
  createNotification({
    userId: execution.triggeredBy,
    title: 'Workflow update',
    message: node.config?.notificationMessage || 'Your workflow has been updated',
    type: 'assignment',
    triggeredBy: execution.triggeredBy
  })
  await updateNodeLog(execution, node.id, 'completed')
  return await processNode(execution, node.nextNode, workflow)
}

const handleTimerNode = async (execution, node, workflow) => {
  // Phase 2: skip timer instantly. Phase 3: real delay via job queue.
  console.log(`Timer node "${node.id}" skipped in Phase 2 — would wait ${node.config?.slaHours || 0}hrs`)
  await updateNodeLog(execution, node.id, 'skipped', { note: 'Timer skipped in dev' })
  return await processNode(execution, node.nextNode, workflow)
}

const handleAssignmentNode = async (execution, node, workflow) => {
  execution.variables = execution.variables || {}
  execution.variables.assignedTo = node.config?.assignTo || null
  execution.markModified('variables')
  await execution.save()
  await updateNodeLog(execution, node.id, 'completed')
  return await processNode(execution, node.nextNode, workflow)
}

// ---------- public API ----------

const processNode = async (execution, nodeId, workflow) => {
  if (!nodeId) {
    return await failExecution(execution, 'No nextNode to process')
  }

  const node = workflow.nodes.find(n => n.id === nodeId)
  if (!node) {
    return await failExecution(execution, `Node ${nodeId} not found in workflow`)
  }

  execution.currentNodeId = nodeId
  execution.executionLog.push({
    nodeId: node.id,
    nodeType: node.type,
    enteredAt: new Date(),
    status: 'in_progress'
  })
  await execution.save()

  switch (node.type) {
    case 'start':
      await updateNodeLog(execution, node.id, 'completed')
      return await processNode(execution, node.nextNode, workflow)

    case 'approval':
      return await handleApprovalNode(execution, node, workflow)

    case 'submit':
      return await handleSubmitNode(execution, node, workflow)

    case 'review':
      return await handleReviewNode(execution, node, workflow)

    case 'condition':
      return await handleConditionNode(execution, node, workflow)

    case 'notification':
      return await handleNotificationNode(execution, node, workflow)

    case 'timer':
      return await handleTimerNode(execution, node, workflow)

    case 'assignment':
      return await handleAssignmentNode(execution, node, workflow)

    case 'end':
      await maybeGeneratePdf(execution, node, workflow)
      return await completeExecution(execution)

    case 'api':
    case 'document':
      // Stubbed in Phase 2 — log and skip
      console.log(`Node type "${node.type}" not implemented in Phase 2; skipping`)
      await updateNodeLog(execution, node.id, 'skipped', { note: `${node.type} not implemented` })
      return await processNode(execution, node.nextNode, workflow)

    default:
      return await failExecution(execution, `Unknown node type: ${node.type}`)
  }
}

// Called by routes/forms.js POST /:id/submit and routes/workflows.js POST /:id/execute.
const triggerWorkflow = async (workflowId, formResponseId, userId, extraVariables = {}) => {
  const Workflow = require('../models/Workflow')
  const FormResponse = require('../models/FormResponse')

  const workflow = await Workflow.findById(workflowId)
  if (!workflow) throw new Error('Workflow not found')
  if (workflow.status !== 'published') {
    throw new Error(`Workflow status is "${workflow.status}", cannot trigger`)
  }

  const startNode = workflow.nodes.find(n => n.type === 'start')
  if (!startNode) throw new Error('Workflow has no start node')

  const variables = { ...extraVariables }

  // Cache submitter context so approval / condition nodes can route on the
  // submitter's role + department without re-querying for every node.
  const submitter = await User.findById(userId).populate('role').lean()
  if (submitter) {
    variables.submitter = {
      id: submitter._id,
      name: submitter.name,
      email: submitter.email,
      role: submitter.role?.name || null,
      department: submitter.department || null,
      managerId: submitter.managerId || null,
      hrId: submitter.hrId || null
    }
    if (submitter.department) variables.department = submitter.department
  }

  if (formResponseId) {
    const formResponse = await FormResponse.findById(formResponseId).lean()
    if (formResponse) {
      variables.formData = formResponse.formData
    }
  }

  const execution = await WorkflowExecution.create({
    workflowId,
    formResponseId,
    triggeredBy: userId,
    status: 'running',
    variables
  })

  writeAuditLog({
    action: 'workflow_started',
    performedBy: userId,
    targetEntity: `Workflow: ${workflow.title}`,
    detail: `Execution #${execution._id} started`,
    metadata: { workflowId, formResponseId, executionId: execution._id }
  })

  // Walk the graph. Will resolve when the engine pauses (approval node)
  // or completes / fails. Await so the caller knows the kick-off succeeded.
  await processNode(execution, startNode.nextNode, workflow)

  return execution
}

// Called by routes/tasks.js after approve / reject.
const advanceWorkflow = async (taskId, outcome = 'approved') => {
  const Workflow = require('../models/Workflow')

  const task = await Task.findById(taskId)
  if (!task) throw new Error('Task not found')

  if (!task.workflowExecutionId) {
    // Standalone task (e.g. seeded without a workflow). Nothing to advance.
    return { skipped: true, reason: 'Task has no linked execution' }
  }

  const execution = await WorkflowExecution.findById(task.workflowExecutionId)
  if (!execution) throw new Error('Execution not found')

  const workflow = await Workflow.findById(execution.workflowId)
  if (!workflow) throw new Error('Workflow not found')

  const currentNode = workflow.nodes.find(n => n.id === task.currentNode)
  if (!currentNode) {
    return await failExecution(execution, `Current node "${task.currentNode}" missing from workflow`)
  }

  // Cache the outcome on the execution so any downstream Decision (condition)
  // node can route on `conditionField: "lastApprovalOutcome"`.
  execution.variables = execution.variables || {}
  execution.variables.lastApprovalOutcome = outcome
  if (execution.variables.pendingTaskId) {
    delete execution.variables.pendingTaskId
    delete execution.variables.pendingNodeId
  }
  if (Array.isArray(task.attachments) && task.attachments.length > 0) {
    const prior = Array.isArray(execution.variables.documents) ? execution.variables.documents : []
    execution.variables.documents = [
      ...prior,
      ...task.attachments.map((f) => ({
        name: f.name, url: f.url, mime: f.mime, size: f.size,
        step: task.title, nodeId: task.currentNode,
      })),
    ]
  }
  // Carry submitted Submit-node form values forward so later reviewers/approvers
  // can see the structured data (name, account no., e-signature, …), not just files.
  if (task.formData && typeof task.formData === 'object' && Object.keys(task.formData).length > 0) {
    const priorForms = Array.isArray(execution.variables.forms) ? execution.variables.forms : []
    execution.variables.forms = [
      ...priorForms,
      {
        step: task.title,
        nodeId: task.currentNode,
        fields: Array.isArray(task.formFields) ? task.formFields : [],
        data: task.formData,
      },
    ]
  }
  execution.markModified('variables')

  await updateNodeLog(execution, task.currentNode, 'completed', { outcome })

  // Review (viewer) node: the reviewer's choice routes directly to one of the
  // node's two branch targets — 'changes' goes back (e.g. to the submit step),
  // anything else ('forward') continues. No approve/reject semantics.
  if (currentNode.type === 'review') {
    const target = outcome === 'changes'
      ? currentNode.config?.changesPath
      : currentNode.config?.forwardPath
    if (!target) {
      return await failExecution(
        execution,
        `Review node "${task.currentNode}" has no ${outcome === 'changes' ? 'changes' : 'forward'} path configured`
      )
    }
    return await processNode(execution, target, workflow)
  }

  // A rejection only terminates the workflow if there's no Decision node
  // downstream to handle it. If the next node is a condition, we let it
  // branch (so the designer can build "approve goes here / reject goes there"
  // flows). Otherwise rejection ends the execution like before.
  const nextNode = currentNode.nextNode
    ? workflow.nodes.find(n => n.id === currentNode.nextNode)
    : null

  if (outcome === 'rejected' && (!nextNode || nextNode.type !== 'condition')) {
    return await failExecution(execution, `Rejected at node ${task.currentNode}`)
  }

  return await processNode(execution, currentNode.nextNode, workflow)
}

module.exports = { triggerWorkflow, advanceWorkflow, processNode }

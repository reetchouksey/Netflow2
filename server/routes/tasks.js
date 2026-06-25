// M3 - Phase 2 - routes/tasks.js
// Approval task inbox + approve / reject / request-changes actions.
// All routes require auth. Mutating actions also notify, audit, and email.
//
// NOTE: workflowEngine is lazy-required inside the handlers so this file
// can load before /utils/workflowEngine.js exists (Sprint 5).

const express = require('express')

const Task = require('../models/Task')
const User = require('../models/User')
const WorkflowExecution = require('../models/WorkflowExecution')
const Workflow = require('../models/Workflow')
const { protect } = require('../middleware/auth')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { createNotification } = require('../utils/createNotification')
const { writeAuditLog } = require('../utils/writeAuditLog')
const {
  sendApprovalEmail,
  sendRejectionEmail
} = require('../utils/emailService')

const router = express.Router()

const ELEVATED_ROLES = ['Admin', 'CEO', 'Manager']
const isElevated = (user) => ELEVATED_ROLES.includes(user?.role?.name)
const sameId = (a, b) => String(a) === String(b)

// Build the full multi-stage approval chain for a task's workflow execution:
// every approval node in graph order, who each stage is assigned to, and
// whether it is approved / rejected / pending / not-yet-reached. Powers the
// "who approved, who's pending, how many approvals required" view.
const decisionFromTask = (t) => {
  const entry = [...(t.approvalHistory || [])]
    .reverse()
    .find((h) => ['approved', 'rejected', 'escalated'].includes(h.action))
  return entry
    ? { by: entry.performedBy?.name || null, at: entry.performedAt || null }
    : null
}

const buildApprovalChain = async (task) => {
  // Standalone task (no workflow execution) — a single-stage chain.
  if (!task.workflowExecutionId) {
    const d = decisionFromTask(task)
    const status = task.status === 'completed' ? 'approved' : task.status
    return {
      approvalChain: [{
        nodeId: task.currentNode || 'stage-1',
        title: task.title,
        role: null,
        status,
        assignee: task.assignedTo ? { name: task.assignedTo.name, email: task.assignedTo.email } : null,
        decidedBy: d?.by || null,
        decidedAt: d?.at || null,
        isCurrent: task.status === 'pending'
      }],
      approvalSummary: { required: 1, approved: status === 'approved' ? 1 : 0 }
    }
  }

  const execution = await WorkflowExecution.findById(task.workflowExecutionId).lean()
  const workflow = execution ? await Workflow.findById(execution.workflowId).lean() : null
  if (!workflow) return { approvalChain: [], approvalSummary: null }

  const allTasks = await Task.find({ workflowExecutionId: task.workflowExecutionId })
    .populate('assignedTo', 'name email')
    .populate('approvalHistory.performedBy', 'name email')
    .lean()

  // Latest task per node id (a node could be re-instantiated on a re-run).
  const taskByNode = new Map()
  for (const t of allTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
    taskByNode.set(t.currentNode, t)
  }

  // Order approval nodes by walking the graph from the start node.
  const nodeById = new Map((workflow.nodes || []).map((n) => [n.id, n]))
  const start = (workflow.nodes || []).find((n) => n.type === 'start')
  const orderedApprovals = []
  const seen = new Set()
  const walk = (nodeId) => {
    if (!nodeId || seen.has(nodeId)) return
    seen.add(nodeId)
    const n = nodeById.get(nodeId)
    if (!n) return
    if (n.type === 'approval') orderedApprovals.push(n)
    walk(n.config?.truePath)
    walk(n.config?.falsePath)
    walk(n.nextNode)
  }
  walk(start ? start.id : null)
  if (orderedApprovals.length === 0) {
    for (const n of workflow.nodes || []) if (n.type === 'approval') orderedApprovals.push(n)
  }

  const pendingNodeId = execution?.variables?.pendingNodeId || null

  const chain = orderedApprovals.map((n) => {
    const t = taskByNode.get(n.id)
    const d = t ? decisionFromTask(t) : null
    const status = t ? (t.status === 'completed' ? 'approved' : t.status) : 'upcoming'
    const isCurrent = (pendingNodeId && n.id === pendingNodeId) || (t && t.status === 'pending')
    return {
      nodeId: n.id,
      title: n.label || 'Approval',
      role: n.config?.approverRole || null,
      status,
      assignee: t?.assignedTo ? { name: t.assignedTo.name, email: t.assignedTo.email } : null,
      decidedBy: d?.by || null,
      decidedAt: d?.at || null,
      isCurrent: !!isCurrent
    }
  })

  const approved = chain.filter((c) => c.status === 'approved').length
  return { approvalChain: chain, approvalSummary: { required: chain.length, approved } }
}

const tryAdvanceWorkflow = async (taskId, outcome) => {
  try {
    const { advanceWorkflow } = require('../utils/workflowEngine')
    await advanceWorkflow(taskId, outcome)
  } catch (err) {
    console.error('advanceWorkflow error:', err.message)
  }
}

// GET /api/tasks/my-tasks
// Returns tasks relevant to the current user. By default this includes BOTH
// tasks assigned to them (their approval queue) AND tasks they submitted
// (their own requests), so employees who only submit forms still see their
// requests here. Use ?scope=assigned or ?scope=submitted to narrow it.
router.get('/my-tasks', protect, async (req, res, next) => {
  try {
    const me = req.user._id
    const { status, type, scope } = req.query

    const query = {}
    if (status) query.status = status
    if (type) query.type = type

    if (scope === 'assigned') query.assignedTo = me
    else if (scope === 'submitted') query.submittedBy = me
    else query.$or = [{ assignedTo: me }, { submittedBy: me }]

    const tasks = await Task.find(query)
      .populate('submittedBy', 'name email department')
      .populate('assignedTo', 'name email department')
      .populate('workflowId', 'title')
      .populate({
        path: 'formResponseId',
        select: 'formData status formId',
        populate: { path: 'formId', select: 'title fields' }
      })
      .sort({ dueDate: 1, createdAt: -1 })
      .lean()

    // Attach each task's approval chain so dashboards / inbox rows can show
    // progress (who approved, who's pending, how many approvals required).
    // Built once per workflow execution — every stage task shares the chain.
    const chainByExec = new Map()
    for (const t of tasks) {
      const key = t.workflowExecutionId ? String(t.workflowExecutionId) : null
      if (key && chainByExec.has(key)) {
        const cached = chainByExec.get(key)
        t.approvalChain = cached.approvalChain
        t.approvalSummary = cached.approvalSummary
        continue
      }
      const built = await buildApprovalChain(t)
      if (key) chainByExec.set(key, built)
      t.approvalChain = built.approvalChain
      t.approvalSummary = built.approvalSummary
    }

    return sendSuccess(res, { count: tasks.length, tasks })
  } catch (err) {
    next(err)
  }
})

// GET /api/tasks/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('submittedBy', 'name email department')
      .populate('assignedTo', 'name email department')
      .populate('workflowId', 'title')
      .populate({
        path: 'formResponseId',
        select: 'formData status attachments formId',
        populate: { path: 'formId', select: 'title fields' }
      })
      .populate({
        path: 'approvalHistory.performedBy',
        select: 'name email',
        populate: { path: 'role', select: 'name' }
      })
      .populate('parallelApprovers', 'name email')
      .populate('parallelApprovals.userId', 'name email')
      .lean()

    if (!task) return sendError(res, 'Task not found', 'TASK_NOT_FOUND', 404)

    const allowed =
      sameId(task.assignedTo?._id, req.user._id) ||
      sameId(task.submittedBy?._id, req.user._id) ||
      isElevated(req.user)

    if (!allowed) {
      return sendError(res, 'Not authorised to view this task', 'FORBIDDEN', 403)
    }

    const { approvalChain, approvalSummary } = await buildApprovalChain(task)
    task.approvalChain = approvalChain
    task.approvalSummary = approvalSummary

    return sendSuccess(res, { task })
  } catch (err) {
    next(err)
  }
})

// Internal helper: ensure caller can act on this task.
const requireApprover = (task, user) => {
  const allowed = sameId(task.assignedTo, user._id) || isElevated(user)
  if (allowed) return null

  if (task.approvalType === 'parallel') {
    const inParallel = (task.parallelApprovers || []).some(p => sameId(p, user._id))
    if (inParallel) return null
  }
  return 'Not authorised to act on this task'
}

// POST /api/tasks/:id/approve
router.post('/:id/approve', protect, async (req, res, next) => {
  try {
    const { comment } = req.body || {}

    const task = await Task.findById(req.params.id)
    if (!task) return sendError(res, 'Task not found', 'TASK_NOT_FOUND', 404)
    if (task.status !== 'pending') {
      return sendError(res, `Task is already ${task.status}`, 'INVALID_STATE', 400)
    }

    const denial = requireApprover(task, req.user)
    if (denial) return sendError(res, denial, 'FORBIDDEN', 403)

    // Parallel approvals: record this vote, check if all approved
    if (task.approvalType === 'parallel' && task.parallelApprovers?.length > 0) {
      const idx = (task.parallelApprovals || []).findIndex(p => sameId(p.userId, req.user._id))
      if (idx >= 0) {
        task.parallelApprovals[idx].status = 'approved'
        task.parallelApprovals[idx].decidedAt = new Date()
      } else {
        task.parallelApprovals.push({
          userId: req.user._id,
          status: 'approved',
          decidedAt: new Date()
        })
      }
      task.approvalHistory.push({
        action: 'approved',
        performedBy: req.user._id,
        performedAt: new Date(),
        comment: comment || undefined
      })

      const allApproved = task.parallelApprovers.every(approverId =>
        task.parallelApprovals.some(pa =>
          sameId(pa.userId, approverId) && pa.status === 'approved'
        )
      )

      if (!allApproved) {
        await task.save()
        return sendSuccess(res, {
          message: 'Approval recorded, awaiting other approvers',
          task: task.toObject()
        })
      }
    } else {
      // Sequential: single approver
      task.approvalHistory.push({
        action: 'approved',
        performedBy: req.user._id,
        performedAt: new Date(),
        comment: comment || undefined
      })
    }

    task.status = 'approved'
    await task.save()

    tryAdvanceWorkflow(task._id, 'approved')

    writeAuditLog({
      action: 'task_approved',
      performedBy: req.user._id,
      targetEntity: `Task: ${task.title}`,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} approved "${task.title}"`,
      metadata: { taskId: task._id, comment: comment || null }
    })

    if (task.submittedBy) {
      createNotification({
        userId: task.submittedBy,
        title: 'Request approved',
        message: `Your request "${task.title}" has been approved.`,
        type: 'approval',
        taskId: task._id,
        triggeredBy: req.user._id
      })

      const submitter = await User.findById(task.submittedBy).select('name email').lean()
      if (submitter?.email) {
        sendApprovalEmail({
          to: submitter.email,
          submitterName: submitter.name,
          taskTitle: task.title,
          approverName: req.user.name,
          comment
        })
      }
    }

    return sendSuccess(res, { task: task.toObject() })
  } catch (err) {
    next(err)
  }
})

// POST /api/tasks/:id/submit
// For Submit-node tasks: the assignee uploads document(s) + an optional comment,
// which advances the workflow (no approve/reject). Mirrors /approve but stores
// attachments and resumes the engine with outcome 'submitted'.
router.post('/:id/submit', protect, async (req, res, next) => {
  try {
    const { comment, attachments } = req.body || {}

    const task = await Task.findById(req.params.id)
    if (!task) return sendError(res, 'Task not found', 'TASK_NOT_FOUND', 404)
    if (task.status !== 'pending') {
      return sendError(res, `Task is already ${task.status}`, 'INVALID_STATE', 400)
    }

    const denial = requireApprover(task, req.user)
    if (denial) return sendError(res, denial, 'FORBIDDEN', 403)

    const files = Array.isArray(attachments) ? attachments.filter((a) => a && a.url) : []
    if (task.requireAttachment && files.length === 0) {
      return sendError(res, 'This step requires at least one attachment', 'ATTACHMENT_REQUIRED', 400)
    }

    task.attachments = files.map((a) => ({
      name: a.name,
      url: a.url,
      mime: a.mime,
      size: a.size
    }))
    task.approvalHistory.push({
      action: 'submitted',
      performedBy: req.user._id,
      performedAt: new Date(),
      comment: comment || undefined
    })
    task.status = 'completed'
    await task.save()

    tryAdvanceWorkflow(task._id, 'submitted')

    writeAuditLog({
      action: 'task_submitted',
      performedBy: req.user._id,
      targetEntity: `Task: ${task.title}`,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} submitted "${task.title}"`,
      metadata: { taskId: task._id, attachments: files.length, comment: comment || null }
    })

    if (task.submittedBy && !sameId(task.submittedBy, req.user._id)) {
      createNotification({
        userId: task.submittedBy,
        title: 'Request updated',
        message: `"${task.title}" has been submitted and moved to the next step.`,
        type: 'assignment',
        taskId: task._id,
        triggeredBy: req.user._id
      })
    }

    return sendSuccess(res, { task: task.toObject() })
  } catch (err) {
    next(err)
  }
})

// POST /api/tasks/:id/reject
router.post('/:id/reject', protect, async (req, res, next) => {
  try {
    const { comment } = req.body || {}
    if (!comment || !String(comment).trim()) {
      return sendError(res, 'A rejection comment is required', 'COMMENT_REQUIRED', 400)
    }

    const task = await Task.findById(req.params.id)
    if (!task) return sendError(res, 'Task not found', 'TASK_NOT_FOUND', 404)
    if (task.status !== 'pending') {
      return sendError(res, `Task is already ${task.status}`, 'INVALID_STATE', 400)
    }

    const denial = requireApprover(task, req.user)
    if (denial) return sendError(res, denial, 'FORBIDDEN', 403)

    if (task.approvalType === 'parallel' && task.parallelApprovers?.length > 0) {
      const idx = (task.parallelApprovals || []).findIndex(p => sameId(p.userId, req.user._id))
      if (idx >= 0) {
        task.parallelApprovals[idx].status = 'rejected'
        task.parallelApprovals[idx].decidedAt = new Date()
      } else {
        task.parallelApprovals.push({
          userId: req.user._id,
          status: 'rejected',
          decidedAt: new Date()
        })
      }
    }

    task.approvalHistory.push({
      action: 'rejected',
      performedBy: req.user._id,
      performedAt: new Date(),
      comment
    })
    task.status = 'rejected'
    await task.save()

    tryAdvanceWorkflow(task._id, 'rejected')

    writeAuditLog({
      action: 'task_rejected',
      performedBy: req.user._id,
      targetEntity: `Task: ${task.title}`,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} rejected "${task.title}"`,
      metadata: { taskId: task._id, comment }
    })

    if (task.submittedBy) {
      createNotification({
        userId: task.submittedBy,
        title: 'Request rejected',
        message: `Your request "${task.title}" was rejected.`,
        type: 'rejection',
        taskId: task._id,
        triggeredBy: req.user._id
      })

      const submitter = await User.findById(task.submittedBy).select('name email').lean()
      if (submitter?.email) {
        sendRejectionEmail({
          to: submitter.email,
          submitterName: submitter.name,
          taskTitle: task.title,
          approverName: req.user.name,
          comment
        })
      }
    }

    return sendSuccess(res, { task: task.toObject() })
  } catch (err) {
    next(err)
  }
})

// POST /api/tasks/:id/request-changes
router.post('/:id/request-changes', protect, async (req, res, next) => {
  try {
    const { comment } = req.body || {}
    if (!comment || !String(comment).trim()) {
      return sendError(res, 'A comment is required when requesting changes', 'COMMENT_REQUIRED', 400)
    }

    const task = await Task.findById(req.params.id)
    if (!task) return sendError(res, 'Task not found', 'TASK_NOT_FOUND', 404)
    if (task.status !== 'pending') {
      return sendError(res, `Task is already ${task.status}`, 'INVALID_STATE', 400)
    }

    const denial = requireApprover(task, req.user)
    if (denial) return sendError(res, denial, 'FORBIDDEN', 403)

    task.approvalHistory.push({
      action: 'request_changes',
      performedBy: req.user._id,
      performedAt: new Date(),
      comment
    })
    // Status stays 'pending' — submitter has to act before approval can proceed.
    await task.save()

    writeAuditLog({
      action: 'request_changes',
      performedBy: req.user._id,
      targetEntity: `Task: ${task.title}`,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} requested changes on "${task.title}"`,
      metadata: { taskId: task._id, comment }
    })

    if (task.submittedBy) {
      createNotification({
        userId: task.submittedBy,
        title: 'Changes requested',
        message: `Changes requested on your request "${task.title}".`,
        type: 'reminder',
        taskId: task._id,
        triggeredBy: req.user._id
      })
    }

    return sendSuccess(res, { task: task.toObject() })
  } catch (err) {
    next(err)
  }
})

module.exports = router

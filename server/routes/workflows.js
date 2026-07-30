// M2 - Phase 2 - routes/workflows.js
// Workflow CRUD + lifecycle (publish, pause) + runtime (execute, executions).
// Reads are protected; mutations require Admin.

const express = require('express')

const Workflow = require('../models/Workflow')
const WorkflowExecution = require('../models/WorkflowExecution')
const Task = require('../models/Task')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { writeAuditLog } = require('../utils/writeAuditLog')
const { createNotification } = require('../utils/createNotification')
const { triggerWorkflow } = require('../utils/workflowEngine')
const { applyInboundWebhookPatch, ensureWebhookToken } = require('../utils/inboundWebhook')
const WebhookDeliveryLog = require('../models/WebhookDeliveryLog')
const IntegrationDeadLetter = require('../models/IntegrationDeadLetter')
const { requireQuota, requireCanBuild, checkQuota, respond } = require('../middleware/quota')
const { meterSubmission } = require('../utils/usageMeter')
const { releaseFor } = require('../utils/fileGc')
const { DESIGNER_ROLES, isDesigner } = require('../utils/roles')
const { normalizeLinkedForms, claimLinkedForms } = require('../utils/linkedForms')

const router = express.Router()

const isElevated = isDesigner
const isBuilder = isDesigner

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- collection routes ----------

// GET /api/workflows
router.get('/', protect, async (req, res, next) => {
  try {
    const { status, department, search } = req.query
    const query = {}

    if (status) query.status = status
    if (department) query.department = department
    if (search) {
      const regex = new RegExp(escapeRegex(String(search).trim()), 'i')
      query.$or = [{ title: regex }, { description: regex }]
    }

    // Employees see only published; elevated roles see everything.
    if (!isBuilder(req.user)) query.status = 'published'

    const workflows = await Workflow.find(query)
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 })
      .lean()

    return sendSuccess(res, { count: workflows.length, workflows })
  } catch (err) {
    next(err)
  }
})

// POST /api/workflows
router.post('/', protect, roleGuard(...DESIGNER_ROLES), requireCanBuild, requireQuota('workflows'), async (req, res, next) => {
  try {
    const {
      title, description, nodes, edges, department, linkedFormId, linkedFormIds, access,
      triggerOn, preventDuplicates, notifyOnSlaBreach, advanced, inboundWebhook
    } = req.body
    if (!title) return sendError(res, 'title is required', 'MISSING_FIELDS', 400)

    const linked = normalizeLinkedForms({ linkedFormIds, linkedFormId })
    const workflow = new Workflow({
      title,
      description,
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
      department,
      linkedFormId: linked.linkedFormId || undefined,
      linkedFormIds: linked.linkedFormIds,
      access: access || undefined,
      triggerOn: triggerOn || undefined,
      preventDuplicates: preventDuplicates === true,
      notifyOnSlaBreach: notifyOnSlaBreach || undefined,
      advanced: advanced || undefined,
      status: 'draft',
      createdBy: req.user._id,
      version: 1
    })
    applyInboundWebhookPatch(workflow, inboundWebhook)
    await workflow.save()
    if (linked.linkedFormIds.length) {
      await claimLinkedForms(Workflow, workflow._id, linked.linkedFormIds)
    }

    return sendSuccess(res, { workflow: workflow.toObject() }, 201)
  } catch (err) {
    next(err)
  }
})

// ---------- /executions/:executionId (declared BEFORE /:id to avoid capture) ----------

// GET /api/workflows/executions/:executionId
router.get('/executions/:executionId', protect, async (req, res, next) => {
  try {
    const execution = await WorkflowExecution.findById(req.params.executionId)
      .populate('triggeredBy', 'name email department')
      .populate('workflowId', 'title status')
      .lean()
    if (!execution) return sendError(res, 'Execution not found', 'EXECUTION_NOT_FOUND', 404)
    return sendSuccess(res, { execution })
  } catch (err) {
    next(err)
  }
})

// ---------- single-workflow routes ----------

// GET /api/workflows/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean()
    if (!workflow) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)

    if (!isBuilder(req.user) && workflow.status !== 'published') {
      return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)
    }

    return sendSuccess(res, { workflow })
  } catch (err) {
    next(err)
  }
})

// PUT /api/workflows/:id
router.put('/:id', protect, roleGuard(...DESIGNER_ROLES), requireCanBuild, async (req, res, next) => {
  try {
    const existing = await Workflow.findById(req.params.id)
    if (!existing) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)

    const { _id, status, inboundWebhook, linkedFormId, linkedFormIds, ...updates } = req.body

    // Always update in place — the edit button is Admin-only and the user
    // explicitly chose to overwrite. The previous versioning branch created a
    // new draft for published workflows, which caused duplicates in the list.
    Object.assign(existing, updates)
    if (linkedFormId !== undefined || linkedFormIds !== undefined) {
      // Prefer explicit array; legacy single-field write replaces the whole list.
      const linked = linkedFormIds !== undefined
        ? normalizeLinkedForms({ linkedFormIds, linkedFormId })
        : normalizeLinkedForms({
            linkedFormId,
            linkedFormIds: linkedFormId ? [linkedFormId] : [],
          })
      existing.linkedFormIds = linked.linkedFormIds
      existing.linkedFormId = linked.linkedFormId
      if (linked.linkedFormIds.length) {
        await claimLinkedForms(Workflow, existing._id, linked.linkedFormIds)
      }
    }
    // Merge webhook settings carefully so a partial patch cannot wipe the token.
    if (inboundWebhook !== undefined) applyInboundWebhookPatch(existing, inboundWebhook)
    await existing.save()
    return sendSuccess(res, { workflow: existing.toObject(), versioned: false })
  } catch (err) {
    next(err)
  }
})

// POST /api/workflows/:id/publish
router.post('/:id/publish', protect, roleGuard(...DESIGNER_ROLES), requireCanBuild, async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)

    const hasStart = workflow.nodes.some(n => n.type === 'start')
    const hasEnd = workflow.nodes.some(n => n.type === 'end')
    if (!hasStart || !hasEnd) {
      return sendError(
        res,
        'Workflow must have at least one start node and one end node',
        'INVALID_WORKFLOW',
        400
      )
    }

    ensureWebhookToken(workflow)
    workflow.status = 'published'
    await workflow.save()
    return sendSuccess(res, { workflow: workflow.toObject() })
  } catch (err) {
    next(err)
  }
})

// GET /api/workflows/:id/webhook-deliveries — recent inbound webhook attempts
router.get('/:id/webhook-deliveries', protect, roleGuard(...DESIGNER_ROLES), async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id).select('_id').lean()
    if (!workflow) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200)
    const deliveries = await WebhookDeliveryLog.find({ workflowId: workflow._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    return sendSuccess(res, { count: deliveries.length, deliveries })
  } catch (err) {
    next(err)
  }
})

// GET /api/workflows/:id/integration-dlq — failed outbound Integration calls
router.get('/:id/integration-dlq', protect, roleGuard(...DESIGNER_ROLES), async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id).select('_id').lean()
    if (!workflow) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200)
    const items = await IntegrationDeadLetter.find({ workflowId: workflow._id, resolved: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    return sendSuccess(res, { count: items.length, items })
  } catch (err) {
    next(err)
  }
})

// POST /api/workflows/:id/pause
router.post('/:id/pause', protect, roleGuard(...DESIGNER_ROLES), requireCanBuild, async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)

    workflow.status = 'paused'
    await workflow.save()
    return sendSuccess(res, { workflow: workflow.toObject() })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/workflows/:id  (HARD delete — removes the workflow AND its runs + tasks)
router.delete('/:id', protect, roleGuard(...DESIGNER_ROLES), requireCanBuild, async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)

    // Snapshot what holds files before the deletes. Form responses survive a
    // workflow delete (they belong to the form), so their attachments are left
    // alone — only each run's generated documents and each task's own uploads go.
    const [taskDocs, execDocs] = await Promise.all([
      Task.find({ workflowId: workflow._id }).select('formData attachments').lean(),
      WorkflowExecution.find({ workflowId: workflow._id }).select('variables').lean()
    ])

    const tasks = await Task.deleteMany({ workflowId: workflow._id })
    const execs = await WorkflowExecution.deleteMany({ workflowId: workflow._id })
    await workflow.deleteOne()
    const freed = await releaseFor(req.orgId, { tasks: taskDocs, executions: execDocs })

    writeAuditLog({
      action: 'workflow_deleted',
      performedBy: req.user._id,
      targetEntity: `Workflow: ${workflow.title}`,
      department: workflow.department,
      ipAddress: req.ip,
      detail: `${req.user.name} permanently deleted workflow "${workflow.title}" (${execs.deletedCount} run(s), ${tasks.deletedCount} task(s) removed)`,
      metadata: {
        workflowId: String(workflow._id),
        executionsDeleted: execs.deletedCount,
        tasksDeleted: tasks.deletedCount,
        filesDeleted: freed.files
      }
    })

    return sendSuccess(res, {
      message: 'Workflow deleted',
      deleted: { workflow: 1, executions: execs.deletedCount, tasks: tasks.deletedCount, files: freed.files }
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/workflows/:id/execute
router.post('/:id/execute', protect, async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) return sendError(res, 'Workflow not found', 'WORKFLOW_NOT_FOUND', 404)
    if (workflow.status !== 'published') {
      return sendError(res, `Workflow is ${workflow.status}, cannot execute`, 'WORKFLOW_NOT_PUBLISHED', 400)
    }

    const { formResponseId, variables } = req.body || {}

    // A run started from an existing form response was already metered when that
    // response was submitted. A run with no response behind it (API/manual
    // trigger) is a submission in its own right, so it is counted here — that is
    // what stops the allowance from being bypassed by calling /execute directly.
    const meters = !formResponseId
    if (meters) {
      const overQuota = await checkQuota(req.organization, 'submissions')
      if (overQuota) return respond(res, overQuota)
    }

    const execution = await triggerWorkflow(
      workflow._id,
      formResponseId || null,
      req.user._id,
      variables || {}
    )

    if (meters) await meterSubmission(req.orgId)

    return sendSuccess(res, {
      executionId: execution._id,
      status: execution.status
    }, 201)
  } catch (err) {
    next(err)
  }
})

// POST /api/workflows/executions/:id/cancel
// The submitter cancels their own in-flight request. Allowed only when the
// workflow enables advanced.allowCancel. Cancels the execution + open tasks.
router.post('/executions/:id/cancel', protect, async (req, res, next) => {
  try {
    const execution = await WorkflowExecution.findById(req.params.id)
    if (!execution) return sendError(res, 'Request not found', 'EXECUTION_NOT_FOUND', 404)
    if (execution.status !== 'running') {
      return sendError(res, `Request is ${execution.status} and can no longer be cancelled`, 'NOT_CANCELLABLE', 400)
    }
    if (String(execution.triggeredBy) !== String(req.user._id)) {
      return sendError(res, 'Only the submitter can cancel this request', 'NOT_SUBMITTER', 403)
    }

    const workflow = await Workflow.findById(execution.workflowId).select('title advanced').lean()
    if (!workflow?.advanced?.allowCancel) {
      return sendError(res, 'This workflow does not allow cancelling requests', 'CANCEL_DISABLED', 403)
    }

    execution.status = 'cancelled'
    execution.completedAt = new Date()
    execution.currentNodeId = null
    await execution.save()

    // Cancel any still-open tasks for this run and let their assignees know.
    const openTasks = await Task.find({
      workflowExecutionId: execution._id,
      status: { $in: ['pending', 'escalated'] }
    }).populate('assignedTo', 'name').lean()

    await Task.updateMany(
      { workflowExecutionId: execution._id, status: { $in: ['pending', 'escalated'] } },
      { $set: { status: 'cancelled' } }
    )

    for (const t of openTasks) {
      if (t.assignedTo?._id) {
        createNotification({
          userId: t.assignedTo._id,
          title: 'Request cancelled',
          message: `${req.user.name} cancelled "${t.title}", so it no longer needs your action.`,
          type: 'reminder',
          taskId: t._id,
          triggeredBy: req.user._id
        })
      }
    }

    writeAuditLog({
      action: 'workflow_cancelled',
      performedBy: req.user._id,
      targetEntity: `Workflow: ${workflow.title}`,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} cancelled their request`,
      metadata: { executionId: String(execution._id), cancelledTasks: openTasks.length }
    })

    return sendSuccess(res, {
      executionId: execution._id,
      status: execution.status,
      cancelledTasks: openTasks.length
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/workflows/:id/executions
router.get('/:id/executions', protect, roleGuard(...DESIGNER_ROLES), async (req, res, next) => {
  try {
    const executions = await WorkflowExecution.find({ workflowId: req.params.id })
      .populate('triggeredBy', 'name email')
      .sort({ startedAt: -1 })
      .lean()
    return sendSuccess(res, { count: executions.length, executions })
  } catch (err) {
    next(err)
  }
})

module.exports = router

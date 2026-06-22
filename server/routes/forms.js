// M1 - Phase 2 - routes/forms.js
// Form CRUD + publish + submit. Submit triggers the linked workflow (if any)
// via M2's workflowEngine.

const express = require('express')

const Form = require('../models/Form')
const FormResponse = require('../models/FormResponse')
const Workflow = require('../models/Workflow')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { writeAuditLog } = require('../utils/writeAuditLog')

const router = express.Router()

// Roles that can build / edit forms and therefore see drafts.
const BUILDER_ROLES = ['Admin', 'CEO', 'Manager', 'HR', 'VP']
const isBuilder = (user) => BUILDER_ROLES.includes(user?.role?.name)

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// GET /api/forms
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

    if (!isBuilder(req.user)) query.status = 'published'

    const forms = await Form.find(query)
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 })
      .lean()

    return sendSuccess(res, { count: forms.length, forms })
  } catch (err) {
    next(err)
  }
})

// GET /api/forms/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean()
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)

    // Hide draft / archived forms from non-admins
    if (!isBuilder(req.user) && form.status !== 'published') {
      return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)
    }

    return sendSuccess(res, { form })
  } catch (err) {
    next(err)
  }
})

// POST /api/forms
router.post('/', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const { title, description, fields, department } = req.body
    if (!title) return sendError(res, 'title is required', 'MISSING_FIELDS', 400)

    const form = await Form.create({
      title,
      description,
      fields: Array.isArray(fields) ? fields : [],
      department,
      status: 'draft',
      createdBy: req.user._id,
      version: 1
    })

    return sendSuccess(res, { form: form.toObject() }, 201)
  } catch (err) {
    next(err)
  }
})

// PUT /api/forms/:id
// If the form is published, create a new versioned draft instead of mutating.
router.put('/:id', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const existing = await Form.findById(req.params.id)
    if (!existing) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)

    const { _id, status, createdBy, ...updates } = req.body

    // Always update in place — the edit button is Admin-only and the user
    // explicitly chose to overwrite. The previous versioning branch created a
    // new draft for published forms, which caused duplicates in the list.
    Object.assign(existing, updates)
    await existing.save()
    return sendSuccess(res, { form: existing.toObject(), versioned: false })
  } catch (err) {
    next(err)
  }
})

// POST /api/forms/:id/archive  (soft "unpublish" — keeps the form in the DB)
router.post('/:id/archive', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const form = await Form.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true }
    )
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)
    return sendSuccess(res, { message: 'Form archived', form: form.toObject() })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/forms/:id  (HARD delete — removes the form AND its submissions)
router.delete('/:id', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id)
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)

    const responses = await FormResponse.deleteMany({ formId: form._id })
    await form.deleteOne()

    writeAuditLog({
      action: 'form_deleted',
      performedBy: req.user._id,
      targetEntity: `Form: ${form.title}`,
      department: form.department,
      ipAddress: req.ip,
      detail: `${req.user.name} permanently deleted form "${form.title}" (${responses.deletedCount} submission(s) removed)`,
      metadata: { formId: String(form._id), responsesDeleted: responses.deletedCount }
    })

    return sendSuccess(res, {
      message: 'Form deleted',
      deleted: { form: 1, responses: responses.deletedCount }
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/forms/:id/publish
router.post('/:id/publish', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id)
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)

    form.status = 'published'
    await form.save()
    return sendSuccess(res, { form: form.toObject() })
  } catch (err) {
    next(err)
  }
})

// POST /api/forms/:id/submit
// Viewer is read-only by design; everyone else can submit. Admins are allowed
// because in practice they also file their own leave/expense requests.
router.post('/:id/submit', protect, roleGuard(...BUILDER_ROLES, 'Employee'), async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id).lean()
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)
    if (form.status !== 'published') {
      return sendError(res, 'Form is not published', 'FORM_NOT_PUBLISHED', 400)
    }

    const { formData } = req.body || {}
    if (!formData || typeof formData !== 'object') {
      return sendError(res, 'formData object is required', 'MISSING_FORM_DATA', 400)
    }

    // Required-field check
    const missing = (form.fields || [])
      .filter(f => f.required && (formData[f.id] === undefined || formData[f.id] === null || formData[f.id] === ''))
      .map(f => f.label || f.id)
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required field(s): ${missing.join(', ')}`,
        'REQUIRED_FIELDS_MISSING',
        400
      )
    }

    const formResponse = await FormResponse.create({
      formId: form._id,
      submittedBy: req.user._id,
      formData,
      status: 'submitted'
    })

    writeAuditLog({
      action: 'form_submitted',
      performedBy: req.user._id,
      targetEntity: `Form: ${form.title}`,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} submitted "${form.title}"`,
      metadata: { formId: form._id, formResponseId: formResponse._id }
    })

    // Look for a published workflow linked to this form
    const workflow = await Workflow.findOne({
      linkedFormId: form._id,
      status: 'published'
    }).select('_id title').lean()

    let workflowTriggered = false
    let executionId = null

    if (workflow) {
      try {
        // Lazy-require the engine so a corrupt engine module can't take down /submit
        const { triggerWorkflow } = require('../utils/workflowEngine')
        const execution = await triggerWorkflow(
          workflow._id,
          formResponse._id,
          req.user._id
        )
        workflowTriggered = true
        executionId = execution._id
      } catch (err) {
        console.error('triggerWorkflow error:', err.message)
        // Do NOT fail the submit — the response is already persisted.
      }
    }

    return sendSuccess(res, {
      formResponseId: formResponse._id,
      workflowTriggered,
      executionId
    }, 201)
  } catch (err) {
    next(err)
  }
})

module.exports = router

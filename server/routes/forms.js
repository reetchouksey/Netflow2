// M1 - Phase 2 - routes/forms.js
// Form CRUD + publish + submit. Submit triggers the linked workflow (if any)
// via M2's workflowEngine.

const express = require('express')
const crypto = require('crypto')

const Form = require('../models/Form')
const FormResponse = require('../models/FormResponse')
const Workflow = require('../models/Workflow')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { writeAuditLog } = require('../utils/writeAuditLog')
const { isConfigured: llmConfigured, getModel: llmModel, generateJSON } = require('../utils/llm')

const router = express.Router()

// Roles that can build / edit forms and therefore see drafts.
const BUILDER_ROLES = ['Admin', 'CEO', 'Manager', 'HR', 'VP']
const isBuilder = (user) => BUILDER_ROLES.includes(user?.role?.name)

// A "manager" for the "Managers only" submit rule = a people-manager: someone
// with a manager-ish role OR at least one direct report.
const MANAGER_ROLES = ['Manager', 'Admin', 'CEO', 'VP', 'HR']
const userIsManager = async (user) => {
  if (MANAGER_ROLES.includes(user?.role?.name)) return true
  return !!(await User.exists({ managerId: user._id }))
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- AI Form Builder helpers ----------
// System prompt pins Gemini to the exact field schema the builder understands.
// Note: long/paragraph answers are `text` + `multiline:true` (there is no
// separate "textarea" type in the builder UI).
const AI_FORM_SYSTEM = `You are a form-design assistant for a workflow app.
Given a plain-English description, output a JSON object ONLY (no prose, no markdown):
{ "title": string, "description": string, "fields": Field[] }

Field = {
  "type": "text" | "dropdown" | "date" | "file" | "checkbox" | "signature" | "number" | "radio" | "grid",
  "label": string,
  "required": boolean,
  // type-specific (include ONLY when relevant):
  "placeholder"?: string,        // text, number, dropdown
  "multiline"?: boolean,         // text only — true for long/paragraph answers
  "options"?: string[],          // dropdown, radio (2+ options)
  "fileTypes"?: string,          // file, e.g. "PDF / DOCX"
  "maxSize"?: number,            // file, in MB (1-50)
  "columns"?: { "label": string, "type": "text"|"number"|"date"|"dropdown", "options"?: string[] }[] // grid only
}

Rules:
- Use "text" with "multiline": true for paragraph/long answers (e.g. reason, comments). There is no "textarea" type.
- For email/phone/short answers use "type": "text".
- dropdown and radio MUST include a non-empty "options" array.
- grid MUST include a non-empty "columns" array.
- Keep it concise: at most 15 fields. Choose sensible "required" flags.
- Return JSON only.`

const asStr = (v, max = 200) => String(v ?? '').trim().slice(0, max)
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null }

const cleanOptions = (arr) => {
  const out = []
  if (Array.isArray(arr)) {
    for (const o of arr) {
      const s = asStr(o, 80)
      if (s && !out.includes(s)) out.push(s)
      if (out.length >= 20) break
    }
  }
  return out
}

const AI_TYPES = new Set(['text', 'dropdown', 'date', 'file', 'checkbox', 'signature', 'number', 'radio', 'grid'])
const GRID_CELL_TYPES = new Set(['text', 'number', 'date', 'dropdown'])

// Coerce raw LLM JSON into the builder's field shape. NEVER trust the model:
// whitelist types, require labels, normalize per-type props, clamp counts.
function sanitizeAiFields(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue
    const label = asStr(f.label, 120)
    if (!label) continue
    const required = !!f.required
    let type = asStr(f.type, 20).toLowerCase()

    // Map common synonyms onto builder types.
    if (['textarea', 'paragraph', 'longtext', 'long_text'].includes(type)) {
      out.push({ type: 'text', label, required, multiline: true, maxLength: null, placeholder: asStr(f.placeholder, 120) })
    } else if (!AI_TYPES.has(type)) {
      // email / phone / unknown → single-line text so we never drop a field.
      out.push({ type: 'text', label, required, multiline: false, maxLength: null, placeholder: asStr(f.placeholder, 120) })
    } else if (type === 'text') {
      out.push({ type, label, required, multiline: !!f.multiline, maxLength: num(f.maxLength), placeholder: asStr(f.placeholder, 120) })
    } else if (type === 'number') {
      out.push({ type, label, required, min: num(f.min), max: num(f.max), placeholder: asStr(f.placeholder, 120) })
    } else if (type === 'dropdown' || type === 'radio') {
      const options = cleanOptions(f.options)
      if (options.length === 0) options.push('Option 1', 'Option 2')
      const field = { type, label, required, options }
      if (type === 'dropdown') field.placeholder = asStr(f.placeholder, 120) || 'Choose...'
      out.push(field)
    } else if (type === 'file') {
      const ms = num(f.maxSize)
      out.push({ type, label, required, fileTypes: asStr(f.fileTypes, 60) || 'PDF / DOCX', maxSize: ms ? Math.min(Math.max(ms, 1), 50) : 5 })
    } else if (type === 'grid') {
      const columns = []
      for (const c of (Array.isArray(f.columns) ? f.columns : [])) {
        const cl = asStr(c?.label, 60)
        if (!cl) continue
        let ct = asStr(c?.type, 20).toLowerCase()
        if (!GRID_CELL_TYPES.has(ct)) ct = 'text'
        const col = { id: `c${columns.length + 1}`, label: cl, type: ct }
        if (ct === 'dropdown') col.options = cleanOptions(c?.options)
        columns.push(col)
        if (columns.length >= 12) break
      }
      if (columns.length === 0) columns.push({ id: 'c1', label: 'Column 1', type: 'text' })
      out.push({ type, label, required, columns })
    } else {
      // date, checkbox, signature — no extra props.
      out.push({ type, label, required })
    }
    if (out.length >= 25) break
  }
  return out
}

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

    // Department visibility: non-builders only see forms whose linked published
    // workflow has no department restriction OR includes their department.
    // Forms with no linked workflow stay visible to everyone.
    let visible = forms
    if (!isBuilder(req.user) && forms.length) {
      const wfs = await Workflow.find({
        linkedFormId: { $in: forms.map((f) => f._id) },
        status: 'published'
      }).select('linkedFormId access').lean()
      const restrictByForm = new Map()
      for (const w of wfs) {
        const depts = w.access?.departments || []
        if (depts.length) restrictByForm.set(String(w.linkedFormId), depts)
      }
      visible = forms.filter((f) => {
        const depts = restrictByForm.get(String(f._id))
        return !depts || depts.includes(req.user.department)
      })
    }

    // Attach a real submission count per form so the list can display it.
    if (visible.length) {
      const counts = await FormResponse.aggregate([
        { $match: { formId: { $in: visible.map((f) => f._id) } } },
        { $group: { _id: '$formId', n: { $sum: 1 } } }
      ])
      const countMap = new Map(counts.map((c) => [String(c._id), c.n]))
      visible.forEach((f) => { f.submissions = countMap.get(String(f._id)) || 0 })
    }

    return sendSuccess(res, { count: visible.length, forms: visible })
  } catch (err) {
    next(err)
  }
})

// GET /api/forms/ai-status — is an LLM key configured? (drives UI visibility)
// MUST be registered before GET /:id so it isn't captured as an id.
router.get('/ai-status', protect, (req, res) => {
  return sendSuccess(res, { aiConfigured: llmConfigured(), model: llmModel() })
})

// POST /api/forms/ai-draft — turn a plain-English description into form fields.
// Builder-only. Returns a draft { title, description, fields } the client merges
// into the builder; it does NOT persist anything.
router.post('/ai-draft', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const prompt = asStr(req.body?.prompt, 2000)
    if (!prompt) return sendError(res, 'Describe the form you want to generate.', 'MISSING_PROMPT', 400)
    if (!llmConfigured()) return sendError(res, 'AI is not configured on the server.', 'AI_DISABLED', 503)

    let out
    try {
      out = await generateJSON(`Design a form for this request: ${prompt}`, {
        system: AI_FORM_SYSTEM,
        temperature: 0.3
      })
    } catch (err) {
      console.error('ai-draft LLM error:', err.message)
      return sendError(res, 'The AI service failed to respond. Please try again.', 'AI_ERROR', 502)
    }

    const fields = sanitizeAiFields(out?.fields)
    if (!fields.length) {
      return sendError(res, 'The AI did not return usable fields. Try rephrasing your description.', 'AI_EMPTY', 422)
    }

    return sendSuccess(res, {
      title: asStr(out?.title, 120),
      description: asStr(out?.description, 500),
      fields,
      model: llmModel()
    })
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

// POST /api/forms/:id/public   { enabled: boolean }
// Enable/disable a public share link. Generates an unguessable token on first
// enable and returns the updated form so the UI can build the link.
router.post('/:id/public', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id)
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)

    const enabled = req.body?.enabled !== false
    const token = form.public?.token || crypto.randomBytes(24).toString('hex')
    form.public = { enabled, token }
    await form.save()

    return sendSuccess(res, { form: form.toObject() })
  } catch (err) {
    next(err)
  }
})

// GET /api/forms/:id/responses — builder-only list of submissions for a form.
router.get('/:id/responses', protect, roleGuard(...BUILDER_ROLES), async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id).lean()
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)

    const responses = await FormResponse.find({ formId: form._id })
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    return sendSuccess(res, {
      form: { _id: form._id, title: form.title, fields: form.fields || [] },
      count: responses.length,
      responses
    })
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

    // A published workflow linked to this form drives the access checks below
    // and the trigger after submission.
    const linkedWorkflow = await Workflow.findOne({
      linkedFormId: form._id,
      status: 'published'
    }).select('_id title access triggerOn preventDuplicates').lean()

    // --- Who-can-submit / department access enforcement -------------------
    // Builders (Admin/Manager/HR/…) administer everything, so they bypass. For
    // everyone else, restrictions apply. Open by default: no config = anyone.
    if (linkedWorkflow && !isBuilder(req.user)) {
      const access = linkedWorkflow.access || {}

      // Department restriction: a non-empty list restricts to those departments.
      // (When "all departments" is chosen the client stores an empty list.)
      const deptList = access.departments || []
      if (deptList.length && !deptList.includes(req.user.department)) {
        return sendError(res, 'This request is not available for your department', 'DEPARTMENT_NOT_ALLOWED', 403)
      }

      if (access.whoCanSubmit === 'Specific people') {
        const allowed = (access.allowedInitiators || []).map(String)
        if (allowed.length && !allowed.includes(String(req.user._id))) {
          return sendError(res, 'You are not authorized to start this request', 'INITIATOR_NOT_ALLOWED', 403)
        }
      } else if (access.whoCanSubmit === 'Managers only') {
        if (!(await userIsManager(req.user))) {
          return sendError(res, 'Only managers can start this request', 'MANAGERS_ONLY', 403)
        }
      }
    }

    // --- Duplicate prevention (one submission per user per form per day) ---
    if (linkedWorkflow?.preventDuplicates) {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const dupe = await FormResponse.findOne({
        formId: form._id,
        submittedBy: req.user._id,
        createdAt: { $gte: startOfDay }
      }).select('_id').lean()
      if (dupe) {
        return sendError(res, 'You have already submitted this form today', 'DUPLICATE_SUBMISSION', 409)
      }
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

    // Trigger the published workflow linked to this form (looked up above).
    // "Manual trigger only" workflows save the response but don't auto-fire —
    // they're started later via POST /api/workflows/:id/execute.
    const workflow = linkedWorkflow

    let workflowTriggered = false
    let executionId = null

    if (workflow && workflow.triggerOn !== 'Manual trigger only') {
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

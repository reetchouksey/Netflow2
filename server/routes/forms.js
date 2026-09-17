// M1 - Phase 2 - routes/forms.js
// Form CRUD + publish + submit. Submit triggers the linked workflow (if any)
// via M2's workflowEngine.

const express = require('express')
const crypto = require('crypto')

const Form = require('../models/Form')
const FormResponse = require('../models/FormResponse')
const FormDraft = require('../models/FormDraft')
const Workflow = require('../models/Workflow')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { writeAuditLog } = require('../utils/writeAuditLog')
const { isConfigured: llmConfigured, getModel: llmModel, generateJSON, generateText } = require('../utils/llm')
const { isFieldVisible } = require('../utils/conditionalLogic')
const { validateField } = require('../utils/validation')
const { requireQuota, requireCanBuild, checkQuota, respond } = require('../middleware/quota')
const { meterSubmission } = require('../utils/usageMeter')
const { releaseFor } = require('../utils/fileGc')
const { DESIGNER_ROLES, SUBMITTER_ROLES, isDesigner } = require('../utils/roles')
const { linkedFormMatch, linkedFormsMatchAny } = require('../utils/linkedForms')
const { canUserAccessWorkflow, userIsManager, MANAGER_ROLES } = require('../utils/workflowAccess')

const router = express.Router()

// Org Admin designs forms; leaders/employees only see published + submit (unless holding a builder seat).
const isBuilder = isDesigner

const designerGuard = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ success: false, error: 'No role assigned', code: 'NO_ROLE' })
  }
  if (DESIGNER_ROLES.includes(req.user.role.name) || req.user.canBuild === true) {
    return next()
  }
  return res.status(403).json({
    success: false,
    error: `Role '${req.user.role.name}' without builder seat is not authorized for this action`,
    code: 'FORBIDDEN'
  })
}

const canSeeWorkflowForm = (access, user) => {
  return canUserAccessWorkflow(access, user)
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- AI Form Builder helpers ----------
// System prompt pins Gemini to the exact field schema the builder understands.
// Note: long/paragraph answers are `text` + `multiline:true` (there is no
// separate "textarea" type in the builder UI).
// ---------- AI Form Builder helpers ----------
// System prompt pins LLM to the exact field schema the builder understands.
const AI_FORM_SYSTEM = `You are an expert form designer and workflow schema architect.
Given a plain-English request, output a valid JSON object ONLY (no markdown fences, no explanatory text):
{ "title": string, "description": string, "fields": Field[] }

Field = {
  "type": "text" | "dropdown" | "date" | "file" | "checkbox" | "signature" | "number" | "radio" | "grid" | "camera" | "heading",
  "label": string,
  "required": boolean,
  // type-specific properties (include ONLY when relevant):
  "placeholder"?: string,        // for text, number, dropdown
  "multiline"?: boolean,         // for text only — set true for long/paragraph answers (e.g. comments, reason, notes)
  "options"?: string[],          // for dropdown and radio (2+ descriptive options)
  "fileTypes"?: string,          // for file, e.g. "PDF / DOCX / JPG / PNG"
  "maxSize"?: number,            // for file, in MB (1-50)
  "columns"?: { "label": string, "type": "text"|"number"|"date"|"dropdown", "options"?: string[] }[] // for grid only
}

Rules:
- Infer appropriate field types based on natural language clues (e.g., date -> "date", email/phone/name -> "text", select/category/priority -> "dropdown", rating/choice -> "radio", attachment/receipt -> "file", approval/signature -> "signature", comments/reason/description -> "text" with multiline: true).
- dropdown and radio MUST include meaningful, non-empty "options" arrays.
- grid MUST include a non-empty "columns" array.
- Mark genuinely essential fields as required: true.
- Keep the generated fields comprehensive and relevant to the user's prompt (usually 4 to 12 fields).
- Return pure JSON only.`

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

const AI_TYPES = new Set(['text', 'dropdown', 'date', 'file', 'checkbox', 'signature', 'number', 'radio', 'grid', 'camera', 'heading'])
const GRID_CELL_TYPES = new Set(['text', 'number', 'date', 'dropdown'])

// Coerce raw LLM JSON or parsed schema into the builder's field shape.
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
    if (['textarea', 'paragraph', 'longtext', 'long_text', 'multiline'].includes(type)) {
      out.push({ type: 'text', label, required, multiline: true, maxLength: null, placeholder: asStr(f.placeholder, 120) || 'Enter details...' })
    } else if (['select', 'combobox', 'choice'].includes(type)) {
      const options = cleanOptions(f.options)
      if (options.length === 0) options.push('Option 1', 'Option 2')
      out.push({ type: 'dropdown', label, required, options, placeholder: asStr(f.placeholder, 120) || 'Choose...' })
    } else if (['rating'].includes(type)) {
      out.push({
        type: 'radio',
        label,
        required,
        options: cleanOptions(f.options).length ? cleanOptions(f.options) : ['1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent']
      })
    } else if (['photo', 'take_photo', 'live_photo', 'webcam'].includes(type)) {
      out.push({ type: 'camera', label, required })
    } else if (['header', 'section', 'title_divider'].includes(type)) {
      out.push({ type: 'heading', label, required: false, description: asStr(f.description, 200) })
    } else if (['table'].includes(type)) {
      type = 'grid'
    } else if (!AI_TYPES.has(type)) {
      // email / phone / unknown → single-line text so we never drop a field.
      out.push({ type: 'text', label, required, multiline: false, maxLength: null, placeholder: asStr(f.placeholder, 120) })
      continue
    }

    if (type === 'text') {
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
      out.push({ type, label, required, fileTypes: asStr(f.fileTypes, 60) || 'PDF / DOCX / JPG / PNG', maxSize: ms ? Math.min(Math.max(ms, 1), 50) : 10 })
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
      if (columns.length === 0) columns.push({ id: 'c1', label: 'Item Description', type: 'text' }, { id: 'c2', label: 'Quantity / Amount', type: 'number' })
      out.push({ type, label, required, columns })
    } else if (type === 'heading') {
      out.push({ type: 'heading', label, required: false, description: asStr(f.description, 200) })
    } else {
      // date, checkbox, signature, camera
      out.push({ type, label, required })
    }
    if (out.length >= 25) break
  }
  return out
}

// Production-grade dynamic NLP schema generator:
// Parses arbitrary user prompts into structured forms when no remote LLM is configured or on network fallback.
function generateDynamicFormSchema(prompt) {
  const raw = String(prompt || '').trim()
  const lower = raw.toLowerCase()

  // 1. Derive Form Title
  let title = ''
  const formMatch = raw.match(/(?:create|build|design|generate|make)?\s*(?:an?|the)?\s*([a-z0-9\s\-]+?)\s*(?:form|request|tracker|survey|checklist|evaluation|application|feedback|report)/i)
  if (formMatch && formMatch[1] && formMatch[1].trim().length > 2) {
    let topic = formMatch[1].trim()
      .replace(/^(an?|the|new|sample)\s+/i, '')
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    if (!topic.toLowerCase().endsWith('form') && !topic.toLowerCase().endsWith('request')) {
      topic = `${topic} Form`
    }
    title = topic
  } else {
    const words = raw.split(/\s+/).slice(0, 5)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(w => w && !['create', 'a', 'an', 'the', 'for', 'with', 'containing', 'form'].includes(w.toLowerCase()))
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    title = words ? `${words} Form` : 'Custom Form'
  }

  // 2. Extract Fields from Natural Language Description
  // Identify field delimiter tokens: commas, semicolons, "with", "containing", "including", "and", "along with", "as well as", bullet points
  // Isolate clause after "with", "containing", "including", "having", "consisting of"
  const contentIdx = raw.search(/\b(with|containing|including|having|consisting of|fields:?|inputs:?)\b/i)
  const fieldsClause = contentIdx !== -1 ? raw.slice(contentIdx).replace(/\b(with|containing|including|having|consisting of|fields:?|inputs:?)\b/i, '') : raw

  // Split by common separators
  const rawParts = fieldsClause
    .split(/[,;\n\r]+|\band\b|\balong with\b|\bas well as\b/i)
    .map(s => s.trim().replace(/^[-*•\d.)\s]+/, '').replace(/[.,:;?!]+$/, '').trim())
    .filter(s => s.length > 1 && !/^(a|an|the|of|for|form|etc|and)$/i.test(s))

  const fields = []
  const seenLabels = new Set()

  const addField = (candidate) => {
    if (!candidate || !candidate.label) return
    candidate.label = candidate.label.replace(/[.,:;?!]+$/, '').trim()
    const key = candidate.label.toLowerCase()
    if (seenLabels.has(key)) return
    seenLabels.add(key)
    fields.push(candidate)
  }

  // Helper to interpret each candidate phrase
  const parseCandidate = (phrase) => {
    let clean = phrase
      .replace(/^(details|information|fields?|inputs?|provide|enter|select|specify)\s+(about|for|of)?\s*/i, '')
      .replace(/\s+(field|input|box|picker|selector|dropdown|upload|button|details?|info)$/i, '')
      .replace(/[.,:;?!]+$/, '')
      .trim()
    if (!clean) return null

    const pLower = clean.toLowerCase()
    const label = clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

    // Determine Field Type & Configuration
    if (pLower.includes('signature') || pLower.includes('approval') || pLower.includes('sign-off') || pLower.includes('authorized sign')) {
      return { type: 'signature', label, required: true }
    }
    if (pLower.includes('rating') || pLower.includes('score (1-5)') || pLower.includes('stars')) {
      return {
        type: 'radio',
        label,
        required: true,
        options: ['1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent']
      }
    }
    if (pLower.includes('recommendation') || pLower.includes('recommend')) {
      return {
        type: 'radio',
        label,
        required: true,
        options: ['Definitely Yes', 'Likely', 'Neutral', 'Unlikely', 'Definitely Not']
      }
    }
    if (pLower.includes('date') || pLower.includes('dob') || pLower.includes('deadline') || pLower.includes('schedule')) {
      return { type: 'date', label, required: true }
    }
    if (pLower.includes('attachment') || pLower.includes('file') || pLower.includes('receipt') || pLower.includes('document') || pLower.includes('upload') || pLower.includes('resume') || pLower.includes('screenshot')) {
      return { type: 'file', label, required: false, fileTypes: 'PDF / DOCX / JPG / PNG', maxSize: 10 }
    }
    if (pLower.includes('camera') || pLower.includes('photo') || pLower.includes('picture') || pLower.includes('capture')) {
      return { type: 'camera', label, required: false }
    }
    if (pLower.includes('priority') || pLower.includes('urgency') || pLower.includes('severity')) {
      return {
        type: 'dropdown',
        label,
        required: true,
        options: ['Low', 'Medium', 'High', 'Urgent'],
        placeholder: 'Select priority...'
      }
    }
    if (pLower.includes('leave type') || pLower.includes('type of leave')) {
      return {
        type: 'dropdown',
        label,
        required: true,
        options: ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity / Paternity', 'Unpaid Leave'],
        placeholder: 'Select leave type...'
      }
    }
    if (pLower.includes('department') || pLower.includes('dept') || pLower.includes('division')) {
      return {
        type: 'dropdown',
        label,
        required: true,
        options: ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Legal', 'IT Support'],
        placeholder: 'Select department...'
      }
    }
    if (pLower.includes('category') || pLower.includes('issue category') || pLower.includes('expense category')) {
      let options = ['Hardware', 'Software', 'Network & Access', 'Accounts & Permissions', 'Billing', 'Other']
      if (lower.includes('feedback') || lower.includes('customer')) {
        options = ['Product Quality', 'Customer Support', 'Pricing & Billing', 'Feature Request', 'User Experience', 'Other']
      } else if (lower.includes('expense') || lower.includes('claim')) {
        options = ['Travel', 'Meals & Entertainment', 'Lodging', 'Office Supplies', 'Software & Tools', 'Other']
      }
      return { type: 'dropdown', label, required: true, options, placeholder: 'Select category...' }
    }
    if (pLower.includes('reason') || pLower.includes('description') || pLower.includes('comment') || pLower.includes('message') || pLower.includes('feedback') || pLower.includes('notes') || pLower.includes('summary') || pLower.includes('details') || pLower.includes('explanation') || pLower.includes('address')) {
      return { type: 'text', label, required: !pLower.includes('optional'), multiline: true, placeholder: `Provide ${label.toLowerCase()}...` }
    }
    if (pLower.includes('number of') || pLower.includes('days') || pLower.includes('amount') || pLower.includes('quantity') || pLower.includes('budget') || pLower.includes('cost') || pLower.includes('price') || pLower.includes('hours') || pLower.includes('age')) {
      return { type: 'number', label, required: true, placeholder: '0' }
    }
    if (pLower.includes('email')) {
      return { type: 'text', label, required: true, placeholder: 'name@example.com' }
    }
    if (pLower.includes('phone') || pLower.includes('contact number') || pLower.includes('mobile')) {
      return { type: 'text', label, required: false, placeholder: '+1 (555) 000-0000' }
    }
    if (pLower.includes('agree') || pLower.includes('terms') || pLower.includes('consent') || pLower.includes('confirm') || pLower.includes('subscribe')) {
      return { type: 'checkbox', label, required: true }
    }
    if (pLower.includes('table') || pLower.includes('items') || pLower.includes('breakdown')) {
      return {
        type: 'grid',
        label,
        required: false,
        columns: [
          { id: 'c1', label: 'Item', type: 'text' },
          { id: 'c2', label: 'Description', type: 'text' },
          { id: 'c3', label: 'Quantity / Amount', type: 'number' }
        ]
      }
    }

    // Default single-line text
    return {
      type: 'text',
      label,
      required: !pLower.includes('optional'),
      multiline: false,
      placeholder: `Enter ${label.toLowerCase()}...`
    }
  }

  // Parse extracted parts
  for (const part of rawParts) {
    // If a part contains "employee details" or "requester information", expand into standard subfields
    const pLow = part.toLowerCase()
    if (pLow === 'employee details' || pLow === 'employee info' || pLow === 'employee information') {
      addField({ type: 'text', label: 'Employee Name', required: true, placeholder: 'Full legal name' })
      addField({ type: 'text', label: 'Employee ID', required: true, placeholder: 'e.g. EMP-1042' })
      addField({ type: 'dropdown', label: 'Department', required: true, options: ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Legal'], placeholder: 'Select department...' })
      continue
    }
    if (pLow === 'requester information' || pLow === 'requester details' || pLow === 'user details') {
      addField({ type: 'text', label: 'Requester Name', required: true, placeholder: 'Your full name' })
      addField({ type: 'text', label: 'Email Address', required: true, placeholder: 'name@company.com' })
      continue
    }
    if (pLow === 'dates' || pLow === 'leave dates' || pLow === 'travel dates') {
      addField({ type: 'date', label: 'Start Date', required: true })
      addField({ type: 'date', label: 'End Date', required: true })
      continue
    }

    const parsed = parseCandidate(part)
    if (parsed) addField(parsed)
  }

  // If fewer than 3 fields were extracted, synthesize standard fields based on the domain
  if (fields.length < 3) {
    if (lower.includes('leave') || lower.includes('vacation') || lower.includes('time off') || lower.includes('holiday')) {
      addField({ type: 'text', label: 'Employee Name', required: true })
      addField({ type: 'text', label: 'Employee ID', required: true })
      addField({ type: 'dropdown', label: 'Leave Type', required: true, options: ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity / Paternity', 'Unpaid Leave'] })
      addField({ type: 'date', label: 'Start Date', required: true })
      addField({ type: 'date', label: 'End Date', required: true })
      addField({ type: 'text', label: 'Reason for Leave', required: true, multiline: true })
      addField({ type: 'signature', label: 'Manager Approval', required: true })
    } else if (lower.includes('feedback') || lower.includes('review') || lower.includes('survey')) {
      addField({ type: 'text', label: 'Customer Name', required: true })
      addField({ type: 'text', label: 'Email Address', required: true })
      addField({ type: 'radio', label: 'Overall Rating', required: true, options: ['1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent'] })
      addField({ type: 'dropdown', label: 'Feedback Category', required: true, options: ['Product Quality', 'Customer Support', 'Pricing & Billing', 'Feature Request', 'Other'] })
      addField({ type: 'text', label: 'Comments & Suggestions', required: true, multiline: true })
      addField({ type: 'radio', label: 'Would you recommend us?', required: true, options: ['Definitely Yes', 'Likely', 'Neutral', 'Unlikely', 'Definitely Not'] })
    } else if (lower.includes('it support') || lower.includes('ticket') || lower.includes('helpdesk') || lower.includes('incident')) {
      addField({ type: 'text', label: 'Requester Name', required: true })
      addField({ type: 'dropdown', label: 'Department', required: true, options: ['Engineering', 'Product', 'Sales', 'HR', 'Finance', 'Operations'] })
      addField({ type: 'dropdown', label: 'Issue Category', required: true, options: ['Hardware', 'Software', 'Network & WiFi', 'Account Access', 'Email / Google Workspace', 'Other'] })
      addField({ type: 'dropdown', label: 'Priority', required: true, options: ['Low', 'Medium', 'High', 'Critical'] })
      addField({ type: 'text', label: 'Issue Description', required: true, multiline: true })
      addField({ type: 'file', label: 'Attachment / Screenshot', required: false, fileTypes: 'PNG / JPG / PDF', maxSize: 10 })
      addField({ type: 'date', label: 'Preferred Resolution Date', required: false })
    } else if (lower.includes('contact') || lower.includes('inquiry') || lower.includes('reach out')) {
      addField({ type: 'text', label: 'Full Name', required: true })
      addField({ type: 'text', label: 'Email Address', required: true })
      addField({ type: 'text', label: 'Phone Number', required: false })
      addField({ type: 'text', label: 'Subject', required: true })
      addField({ type: 'text', label: 'Message', required: true, multiline: true })
    } else {
      addField({ type: 'text', label: 'Full Name', required: true })
      addField({ type: 'text', label: 'Email Address', required: true })
      addField({ type: 'date', label: 'Submission Date', required: true })
      addField({ type: 'text', label: 'Description & Details', required: true, multiline: true })
    }
  }

  return {
    title,
    description: `Dynamic form generated for: ${raw.slice(0, 160)}`,
    fields
  }
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

    // Visibility: non-builders only see forms their linked published workflow
    // makes visible to them (company-wide / their department / them specifically).
    // Forms with no linked workflow stay visible to everyone.
    let visible = forms
    if (!isBuilder(req.user) && forms.length) {
      const formIds = forms.map((f) => f._id)
      const wfs = await Workflow.find({
        ...linkedFormsMatchAny(formIds),
        status: 'published'
      }).select('linkedFormId linkedFormIds access').lean()
      const accessByForm = new Map()
      for (const w of wfs) {
        if (!w.access) continue
        const ids = new Set([
          ...(w.linkedFormIds || []).map(String),
          ...(w.linkedFormId ? [String(w.linkedFormId)] : []),
        ])
        for (const id of ids) accessByForm.set(id, w.access)
      }
      visible = forms.filter((f) =>
        canSeeWorkflowForm(accessByForm.get(String(f._id)), req.user)
      )
    }

    // Attach a real submission count per form so the list can display it.
    if (visible.length) {
      const counts = await FormResponse.aggregate([
        {
          $lookup: {
            from: 'forms',
            localField: 'formId',
            foreignField: '_id',
            as: 'form'
          }
        },
        { $unwind: '$form' },
        { $group: { _id: '$form.title', n: { $sum: 1 } } }
      ])
      const countMap = new Map(counts.map((c) => [c._id, c.n]))
      visible.forEach((f) => { f.submissions = countMap.get(f.title) || 0 })
    }

    return sendSuccess(res, { count: visible.length, forms: visible })
  } catch (err) {
    next(err)
  }
})

// GET /api/forms/ai-status — always available for form generation
// MUST be registered before GET /:id so it isn't captured as an id.
router.get('/ai-status', protect, (req, res) => {
  return sendSuccess(res, {
    aiConfigured: true,
    model: llmConfigured() ? llmModel() : 'semantic-ai-engine'
  })
})

// POST /api/forms/ai-draft — turn a plain-English description into form fields.
// Builder-only. Returns a draft { title, description, fields } the client merges
// into the builder; it does NOT persist anything.
router.post('/ai-draft', protect, designerGuard, requireCanBuild, async (req, res, next) => {
  try {
    const prompt = asStr(req.body?.prompt, 2000)
    if (!prompt) return sendError(res, 'Describe the form you want to generate.', 'MISSING_PROMPT', 400)

    let out = null
    let usedModel = llmConfigured() ? llmModel() : 'semantic-ai-engine'

    if (llmConfigured()) {
      try {
        out = await generateJSON(`Design a comprehensive form schema for this user requirement:\n${prompt}`, {
          system: AI_FORM_SYSTEM,
          temperature: 0.2
        })
      } catch (err) {
        console.warn('ai-draft remote LLM notice, using dynamic semantic engine:', err.message)
        out = null
      }
    }

    // Dynamic semantic generation fallback
    if (!out || !Array.isArray(out.fields) || out.fields.length === 0) {
      out = generateDynamicFormSchema(prompt)
      usedModel = 'semantic-ai-engine'
    }

    const fields = sanitizeAiFields(out?.fields)
    if (!fields.length) {
      return sendError(res, 'The AI could not generate usable fields. Try rephrasing your description.', 'AI_EMPTY', 422)
    }

    return sendSuccess(res, {
      title: asStr(out?.title, 120) || 'New Form',
      description: asStr(out?.description, 500) || '',
      fields,
      model: usedModel
    })
  } catch (err) {
    next(err)
  }
})

// IDE-style ghost text (VS Code / Cursor): next few tokens only, not a sentence.
const AI_SUGGEST_SYSTEM = `You are inline autocomplete for a form-builder prompt (same feel as VS Code / Cursor ghost text).

The user is typing what form to generate. Reply with ONLY the suffix they would type next.

Hard rules:
- Output ONLY the continuation. Never repeat their text. No quotes, labels, markdown, or explanations.
- Prefer 1–4 words (hard max 5). Never a full sentence. Never end with . ! ?
- If they are mid-word, finish THAT word first (e.g. "employ" → "ee", "reimbur" → "sement").
- Continue the current phrase. Do not invent a long field list unless they already asked for fields.
- Prefer form-building words: request, dates, reason, amount, attachment, signature, approval.
- If the phrase already feels complete, return an empty string.

Examples (input → output):
- "Leave request form with" → " dates and reason"
- "expense reimb" → "ursement with receipts"
- "employee onboarding" → " checklist"
- "IT access request form" → ""`

// Remove any leading overlap so we never repeat words the user already typed
// (models sometimes echo the tail of the prompt).
const trimOverlap = (typed, completion) => {
  let c = completion
  const tail = typed.slice(-40).toLowerCase()
  const cl = c.toLowerCase()
  for (let n = Math.min(tail.length, cl.length); n > 0; n--) {
    if (tail.slice(-n) === cl.slice(0, n)) { c = c.slice(n); break }
  }
  return c
}

// Clamp model output to IDE-like ghost text: short, mid-word aware.
const normalizeSuggest = (typed, raw) => {
  let completion = String(raw || '')
    .replace(/^["'`\s]+|["'`]+$/g, '')
    .replace(/\s*\n[\s\S]*$/, '')
    .replace(/\s+/g, ' ')
  completion = trimOverlap(typed, completion)
  completion = completion.replace(/[.!?…]+$/g, '').replace(/^[:\-~]+\s*/, '')

  const midWord = typed.length > 0 && !/\s$/.test(typed)
  if (midWord) {
    completion = completion.replace(/^\s+/, '')
    const partial = (typed.match(/[A-Za-z0-9'_-]+$/) || [''])[0]
    if (partial && completion.toLowerCase().startsWith(partial.toLowerCase())) {
      completion = completion.slice(partial.length)
    }
  } else if (completion && !completion.startsWith(' ')) {
    completion = ' ' + completion
  }

  const lead = completion.startsWith(' ') ? ' ' : ''
  const words = completion.trim().split(/\s+/).filter(Boolean).slice(0, 4)
  if (!words.length) return ''
  return (lead + words.join(' ')).slice(0, 42).trimEnd()
}

// POST /api/forms/ai-suggest — ghost-text autocomplete for the AI prompt box.
// Builder-only. Returns only the suffix to append. Never throws to the client:
// on any failure it returns an empty suggestion so typing is never disrupted.
router.post('/ai-suggest', protect, designerGuard, requireCanBuild, async (req, res) => {
  try {
    const prompt = asStr(req.body?.prompt, 300)
    if (!llmConfigured() || prompt.length < 3) return sendSuccess(res, { completion: '' })

    let raw = ''
    try {
      raw = await generateText(
        `Typed so far:\n${prompt}\n\nGhost continuation (next 1-4 words only):`,
        {
          system: AI_SUGGEST_SYSTEM,
          temperature: 0.1,
          maxTokens: 16,
          timeoutMs: 4000
        }
      )
    } catch (err) {
      return sendSuccess(res, { completion: '' })
    }

    return sendSuccess(res, { completion: normalizeSuggest(prompt, raw) })
  } catch (err) {
    return sendSuccess(res, { completion: '' })
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

    // Visibility: block direct-URL access for non-builders the linked published
    // workflow doesn't make visible to them.
    if (!isBuilder(req.user)) {
      const wf = await Workflow.findOne({
        ...linkedFormMatch(form._id),
        status: 'published'
      }).select('access').lean()
      if (wf && !canSeeWorkflowForm(wf.access, req.user)) {
        return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)
      }
    }

    return sendSuccess(res, { form })
  } catch (err) {
    next(err)
  }
})

// POST /api/forms
router.post('/', protect, designerGuard, requireCanBuild, requireQuota('forms'), async (req, res, next) => {
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
router.put('/:id', protect, designerGuard, requireCanBuild, async (req, res, next) => {
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
router.post('/:id/archive', protect, designerGuard, requireCanBuild, async (req, res, next) => {
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
router.delete('/:id', protect, designerGuard, requireCanBuild, async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id)
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)

    // Read the submissions before they go, so their attachments can be deleted
    // from disk and the storage meter credited back.
    const docs = await FormResponse.find({ formId: form._id }).select('formData attachments').lean()
    const responses = await FormResponse.deleteMany({ formId: form._id })
    await form.deleteOne()
    const freed = await releaseFor(req.orgId, { responses: docs })

    writeAuditLog({
      action: 'form_deleted',
      performedBy: req.user._id,
      targetEntity: `Form: ${form.title}`,
      department: form.department,
      ipAddress: req.ip,
      detail: `${req.user.name} permanently deleted form "${form.title}" (${responses.deletedCount} submission(s) removed)`,
      metadata: { formId: String(form._id), responsesDeleted: responses.deletedCount, filesDeleted: freed.files }
    })

    return sendSuccess(res, {
      message: 'Form deleted',
      deleted: { form: 1, responses: responses.deletedCount, files: freed.files }
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/forms/:id/publish
router.post('/:id/publish', protect, designerGuard, requireCanBuild, async (req, res, next) => {
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
router.post('/:id/public', protect, designerGuard, requireCanBuild, async (req, res, next) => {
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
router.get('/:id/responses', protect, designerGuard, async (req, res, next) => {
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

// GET /api/forms/:id/draft — the caller's saved draft for this form (or null).
router.get('/:id/draft', protect, roleGuard(...SUBMITTER_ROLES), async (req, res, next) => {
  try {
    const draft = await FormDraft.findOne({ formId: req.params.id, userId: req.user._id })
      .select('formData updatedAt')
      .lean()
    return sendSuccess(res, {
      draft: draft ? { formData: draft.formData || {}, updatedAt: draft.updatedAt } : null
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/forms/:id/draft — save/overwrite the caller's draft. Intentionally
// NO required-field or advanced validation: a draft is allowed to be partial.
router.put('/:id/draft', protect, roleGuard(...SUBMITTER_ROLES), async (req, res, next) => {
  try {
    const { formData } = req.body || {}
    if (!formData || typeof formData !== 'object') {
      return sendError(res, 'formData object is required', 'MISSING_FORM_DATA', 400)
    }
    const draft = await FormDraft.findOneAndUpdate(
      { formId: req.params.id, userId: req.user._id },
      { formData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    return sendSuccess(res, { draft: { formData: draft.formData || {}, updatedAt: draft.updatedAt } })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/forms/:id/draft — discard the caller's draft.
router.delete('/:id/draft', protect, roleGuard(...SUBMITTER_ROLES), async (req, res, next) => {
  try {
    await FormDraft.deleteOne({ formId: req.params.id, userId: req.user._id })
    return sendSuccess(res, { discarded: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/forms/:id/submit
// Every workspace role can submit, Admins included — in practice they also file
// their own leave and expense requests.
router.post('/:id/submit', protect, roleGuard(...SUBMITTER_ROLES), requireQuota('submissions'), async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id).lean()
    if (!form) return sendError(res, 'Form not found', 'FORM_NOT_FOUND', 404)
    if (form.status !== 'published') {
      return sendError(res, 'Form is not published', 'FORM_NOT_PUBLISHED', 400)
    }

    // A published workflow linked to this form drives the access checks below
    // and the trigger after submission.
    const linkedWorkflow = await Workflow.findOne({
      ...linkedFormMatch(form._id),
      status: 'published'
    }).select('_id title access triggerOn preventDuplicates').lean()

    // --- Who-can-submit / department access enforcement -------------------
    // Builders (Admin/Manager/HR/…) administer everything, so they bypass. For
    // everyone else, restrictions apply. Open by default: no config = anyone.
    if (linkedWorkflow && !isBuilder(req.user)) {
      const access = linkedWorkflow.access || {}

      // Visibility & Access gate — you must have permission to see and submit this form.
      if (!canUserAccessWorkflow(access, req.user)) {
        return sendError(res, 'This request is not available to you', 'NOT_VISIBLE', 403)
      }

      if (access.whoCanSubmit === 'Managers only') {
        if (!(await userIsManager(req.user, User))) {
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
      .filter(f => f.required && isFieldVisible(f, formData) && (formData[f.id] === undefined || formData[f.id] === null || formData[f.id] === ''))
      .map(f => f.label || f.id)
    if (missing.length > 0) {
      return sendError(
        res,
        `Missing required field(s): ${missing.join(', ')}`,
        'REQUIRED_FIELDS_MISSING',
        400
      )
    }

    // Advanced validation (length / range / format) on visible, filled fields.
    for (const f of form.fields || []) {
      if (!isFieldVisible(f, formData)) continue
      const err = validateField(f, formData[f.id])
      if (err) return sendError(res, err, 'FIELD_INVALID', 400)
    }

    // Persist DMS ids from file/signature/camera field values onto response.attachments.
    const attachmentRows = []
    for (const f of form.fields || []) {
      if (!['file', 'camera', 'signature'].includes(f.type)) continue
      const v = formData[f.id]
      if (v && typeof v === 'object' && (v.dmsDocId || v.url)) {
        attachmentRows.push({
          filename: v.name || f.label || 'file',
          path: v.url || '',
          mimetype: v.mime || '',
          size: v.size || 0,
          dmsDocId: v.dmsDocId ? String(v.dmsDocId) : null,
          provisionalId: v.provisionalId ? String(v.provisionalId) : null,
        })
      }
    }

    const formResponse = await FormResponse.create({
      formId: form._id,
      submittedBy: req.user._id,
      formData,
      status: 'submitted',
      attachments: attachmentRows,
    })

    // Best-effort DMS audit — never block submit.
    try {
      const { emitWorkflowEvents } = require('../utils/dmsAttachments')
      const ids = attachmentRows.map((a) => a.dmsDocId).filter(Boolean)
      await emitWorkflowEvents(ids, {
        type: 'workflow.submitted',
        actor: req.user,
        detail: `Submitted "${form.title}"`,
        meta: {
          formResponseId: formResponse._id,
          formId: form._id,
          workflowId: linkedWorkflow?._id,
        },
        org: req.organization,
      })
    } catch (err) {
      console.warn('[dms] submit events failed', err.message)
    }

    // Metered after the response exists so a failed create is never billed.
    // Await it: the count has to be visible to the next quota check.
    await meterSubmission(req.orgId)

    // A completed submission should not leave a stale draft behind. Best-effort:
    // never fail the submit if draft cleanup errors.
    FormDraft.deleteOne({ formId: form._id, userId: req.user._id }).catch(() => {})

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

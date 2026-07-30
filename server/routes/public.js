// Public (unauthenticated) form access.
// Lets non-users fill a shared form via an unguessable token link, like Google
// Forms. Submissions are stored as FormResponse with source 'public'. No auth,
// no workflow trigger — pure data collection.

const express = require('express')
const fs = require('fs')
const multer = require('multer')

const Form = require('../models/Form')
const FormResponse = require('../models/FormResponse')
const Organization = require('../models/Organization')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { isFieldVisible } = require('../utils/conditionalLogic')
const { validateField } = require('../utils/validation')
const { checkQuota, checkStorage } = require('../middleware/quota')
const { writeBlockFor } = require('../middleware/licence')
const { meterSubmission, addStorage } = require('../utils/usageMeter')
const { dirForOrg, safeFilename, urlFor } = require('../utils/fileStore')

const router = express.Router()

// The public routes run without `protect`, so the licence/quota gates that
// middleware/auth applies to everyone else have to be called explicitly here.
// A public link is still the tenant's capacity being consumed — by strangers,
// which makes it the easiest limit to blow through.
const tenantOf = (form) => (form?.orgId ? Organization.findById(form.orgId).lean() : Promise.resolve(null))

const gateTenant = async (res, org, resource) => {
  if (!org) return false
  const blocked = writeBlockFor(org)
  if (blocked) {
    sendError(res, blocked.error, blocked.code, blocked.status, blocked.extra)
    return true
  }
  if (resource) {
    const overQuota = await checkQuota(org, resource)
    if (overQuota) {
      // Deliberately vague to an anonymous submitter: they cannot fix a plan
      // limit and should not learn the tenant's licence details.
      sendError(res, 'This form is not accepting submissions right now. Please contact the form owner.',
        'LIMIT_REACHED', 403, { resource })
      return true
    }
  }
  return false
}

// GET /api/public/org?subdomain=acme
// Pre-login tenant lookup for the login page: which org lives on this
// subdomain? Returns only non-sensitive fields (name + status), so the page
// can show "Sign in to Acme" or a friendly suspended/unknown message.
router.get('/org', async (req, res, next) => {
  try {
    const subdomain = String(req.query.subdomain || '').toLowerCase().trim()
    if (!subdomain) return sendError(res, 'subdomain is required', 'MISSING_SUBDOMAIN', 400)

    const org = await Organization.findOne({ subdomain }).select('name subdomain status').lean()
    if (!org) return sendError(res, 'No organization on this subdomain', 'ORG_NOT_FOUND', 404)

    return sendSuccess(res, { org: { name: org.name, subdomain: org.subdomain, status: org.status } })
  } catch (err) {
    next(err)
  }
})

// --- naive per-IP rate limit (in-memory; fine for a single instance) --------
const hits = new Map()
const WINDOW_MS = 60 * 1000
const MAX_PER_WINDOW = 30
const rateLimit = (req, res, next) => {
  const ip = req.ip || 'unknown'
  const now = Date.now()
  const rec = hits.get(ip) || { count: 0, reset: now + WINDOW_MS }
  if (now > rec.reset) { rec.count = 0; rec.reset = now + WINDOW_MS }
  rec.count += 1
  hits.set(ip, rec)
  if (rec.count > MAX_PER_WINDOW) {
    return sendError(res, 'Too many requests. Please slow down.', 'RATE_LIMITED', 429)
  }
  next()
}

// Only serve forms that are explicitly public AND published.
const findPublicForm = (token) => {
  if (!token) return null
  return Form.findOne({
    'public.token': token,
    'public.enabled': true,
    status: 'published'
  }).lean()
}

// Type-aware "is this required field empty?" — mirrors the client validation so
// a direct API call can't bypass required checkboxes/grids.
const fieldEmpty = (field, v) => {
  if (field.type === 'checkbox') return !v
  if (field.type === 'grid') return !Array.isArray(v) || v.length === 0
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

// GET /api/public/forms/:token — fetch the public form definition.
router.get('/forms/:token', async (req, res, next) => {
  try {
    const form = await findPublicForm(req.params.token)
    if (!form) return sendError(res, 'This form is not available.', 'FORM_NOT_FOUND', 404)
    // Expose only what the renderer needs — never createdBy, department, etc.
    return sendSuccess(res, {
      form: {
        title: form.title,
        description: form.description || '',
        fields: form.fields || []
      }
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/public/forms/:token/submit — store an anonymous submission.
router.post('/forms/:token/submit', rateLimit, async (req, res, next) => {
  try {
    const form = await findPublicForm(req.params.token)
    if (!form) return sendError(res, 'This form is not available.', 'FORM_NOT_FOUND', 404)

    const org = await tenantOf(form)
    if (await gateTenant(res, org, 'submissions')) return

    const { formData, submitter } = req.body || {}
    if (!formData || typeof formData !== 'object') {
      return sendError(res, 'formData object is required', 'MISSING_FORM_DATA', 400)
    }

    const missing = (form.fields || [])
      .filter((f) => f.required && isFieldVisible(f, formData) && fieldEmpty(f, formData[f.id]))
      .map((f) => f.label || f.id)
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

    const formResponse = await FormResponse.create({
      // Public path has no tenant context — inherit the org from the form.
      orgId: form.orgId,
      formId: form._id,
      submittedBy: null,
      submittedByExternal: {
        name: (submitter?.name || '').trim(),
        email: (submitter?.email || '').trim()
      },
      source: 'public',
      formData,
      status: 'submitted'
    })

    await meterSubmission(form.orgId)

    // No workflow trigger by design — this is pure data collection.
    return sendSuccess(res, { formResponseId: formResponse._id }, 201)
  } catch (err) {
    next(err)
  }
})

// --- token-gated file upload for public forms with file fields --------------
// Anonymous uploads still land in the owning tenant's folder, so they count
// against that tenant's storage and are served with the same access check as
// everything else (utils/fileStore). The org comes from the form behind the
// token, which is resolved before multer runs.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, dirForOrg(req.publicOrgId))
    } catch (err) {
      cb(err)
    }
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname))
})

const MAX_CEILING_MB = 25

// POST /api/public/forms/:token/upload  (multipart, field "file")
router.post('/forms/:token/upload', rateLimit, async (req, res, next) => {
  try {
    const form = await findPublicForm(req.params.token)
    if (!form) return sendError(res, 'This form is not available.', 'FORM_NOT_FOUND', 404)

    const org = await tenantOf(form)
    if (await gateTenant(res, org)) return
    req.publicOrgId = form.orgId

    const reqMb = Math.min(
      Math.max(parseInt(req.query.maxMb, 10) || MAX_CEILING_MB, 1),
      MAX_CEILING_MB
    )
    const upload = multer({ storage, limits: { fileSize: reqMb * 1024 * 1024 } })
    upload.single('file')(req, res, async (err) => {
      if (err) {
        const code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED'
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? `File too large. Max ${reqMb} MB.`
          : (err.message || 'Upload failed')
        return sendError(res, msg, code, 400)
      }
      if (!req.file) return sendError(res, 'No file provided', 'NO_FILE', 400)

      // Multer has already written the file, so an over-quota upload has to be
      // deleted rather than merely refused — otherwise the disk fills with bytes
      // the tenant was never allowed to store. No buffer here: an anonymous
      // upload is never the thing unblocking an approval.
      const room = await checkStorage(org, req.file.size)
      if (!room.ok) {
        fs.promises.unlink(req.file.path).catch(() => {})
        return sendError(res, 'This form is not accepting attachments right now. Please contact the form owner.',
          'LIMIT_REACHED', 403, { resource: room.extra?.resource || 'storage' })
      }
      await addStorage(form.orgId, req.file.size)

      return sendSuccess(res, {
        file: {
          name: req.file.originalname,
          url: urlFor(form.orgId, req.file.filename),
          mime: req.file.mimetype,
          size: req.file.size
        }
      }, 201)
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

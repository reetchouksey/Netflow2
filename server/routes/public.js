// Public (unauthenticated) form access.
// Lets non-users fill a shared form via an unguessable token link, like Google
// Forms. Submissions are stored as FormResponse with source 'public'. No auth,
// no workflow trigger — pure data collection.

const express = require('express')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('multer')

const Form = require('../models/Form')
const FormResponse = require('../models/FormResponse')
const { sendSuccess, sendError } = require('../utils/apiResponse')

const router = express.Router()

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

    const { formData, submitter } = req.body || {}
    if (!formData || typeof formData !== 'object') {
      return sendError(res, 'formData object is required', 'MISSING_FORM_DATA', 400)
    }

    const missing = (form.fields || [])
      .filter((f) => f.required && fieldEmpty(f, formData[f.id]))
      .map((f) => f.label || f.id)
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
      submittedBy: null,
      submittedByExternal: {
        name: (submitter?.name || '').trim(),
        email: (submitter?.email || '').trim()
      },
      source: 'public',
      formData,
      status: 'submitted'
    })

    // No workflow trigger by design — this is pure data collection.
    return sendSuccess(res, { formResponseId: formResponse._id }, 201)
  } catch (err) {
    next(err)
  }
})

// --- token-gated file upload for public forms with file fields --------------
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12)
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`)
  }
})

const MAX_CEILING_MB = 25

// POST /api/public/forms/:token/upload  (multipart, field "file")
router.post('/forms/:token/upload', rateLimit, async (req, res, next) => {
  try {
    const form = await findPublicForm(req.params.token)
    if (!form) return sendError(res, 'This form is not available.', 'FORM_NOT_FOUND', 404)

    const reqMb = Math.min(
      Math.max(parseInt(req.query.maxMb, 10) || MAX_CEILING_MB, 1),
      MAX_CEILING_MB
    )
    const upload = multer({ storage, limits: { fileSize: reqMb * 1024 * 1024 } })
    upload.single('file')(req, res, (err) => {
      if (err) {
        const code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED'
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? `File too large. Max ${reqMb} MB.`
          : (err.message || 'Upload failed')
        return sendError(res, msg, code, 400)
      }
      if (!req.file) return sendError(res, 'No file provided', 'NO_FILE', 400)
      return sendSuccess(res, {
        file: {
          name: req.file.originalname,
          url: `/uploads/${req.file.filename}`,
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

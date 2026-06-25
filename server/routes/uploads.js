// Phase 2 - routes/uploads.js
// Simple authenticated file upload. Stores files on local disk under
// server/uploads and returns a relative URL the client persists in form data
// (e.g. for `file` form fields). Files are then served statically by server.js
// at /uploads/<filename>, so approvers can open whatever an employee attached.

const express = require('express')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('multer')

const { protect } = require('../middleware/auth')
const { sendSuccess, sendError } = require('../utils/apiResponse')

const router = express.Router()

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Keep the original extension; randomise the name to avoid collisions and
    // path-traversal via crafted filenames.
    const ext = path.extname(file.originalname).slice(0, 12)
    const safe = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
    cb(null, safe)
  }
})

// Global hard ceiling. A form field may request a smaller per-field limit via
// ?maxMb=, but never more than this, so this single endpoint stays safe no
// matter what the client sends.
const MAX_CEILING_MB = 50

// POST /api/uploads  (multipart/form-data, field name "file")
// Optional ?maxMb=N applies the form field's per-field size limit, clamped to
// [1, MAX_CEILING_MB]. multer is built per-request so oversize uploads are
// rejected mid-stream rather than after fully buffering to disk.
router.post('/', protect, (req, res, next) => {
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
})

module.exports = router

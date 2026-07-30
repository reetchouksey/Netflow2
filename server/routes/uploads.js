// Phase 2 - routes/uploads.js
// Authenticated file upload. Files are written to server/uploads/<orgId>/ and
// served back through routes/files.js, which enforces that the caller belongs to
// the owning organization (see utils/fileStore for why the layout matters).
//
// Licensing: every byte counts against the tenant's storage allowance, and the
// file count against maxFiles — "whichever comes first". Two subtleties:
//
//   * multer writes to disk before we can weigh the request, so an upload that
//     turns out to be over quota is deleted again. Refusing without deleting
//     would let a tenant fill the disk with bytes it was never licensed for.
//   * an upload carrying `taskId` may dip into the small completion buffer above
//     the storage limit. That exists so a pending approval which *requires* an
//     attachment can still be finished when the tenant is full or read-only —
//     stranding live approvals is a business outage, not a billing signal.

const express = require('express')
const fs = require('fs')
const multer = require('multer')

const Task = require('../models/Task')
const { protect } = require('../middleware/auth')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { checkStorage, respond } = require('../middleware/quota')
const { isReadOnly } = require('../middleware/licence')
const { addStorage } = require('../utils/usageMeter')
const { dirForOrg, safeFilename, urlFor } = require('../utils/fileStore')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, dirForOrg(req.orgId))
    } catch (err) {
      cb(err)
    }
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname))
})

// Global hard ceiling. A form field may request a smaller per-field limit via
// ?maxMb=, but never more than this, so this single endpoint stays safe no
// matter what the client sends.
const MAX_CEILING_MB = 50

// Is this upload attached to a decision the caller still owes? Only then may it
// use the completion buffer. Anything else is ordinary new work.
const isForOpenTask = async (req) => {
  const taskId = String(req.query.taskId || req.body?.taskId || '').trim()
  if (!/^[0-9a-fA-F]{24}$/.test(taskId)) return false
  const task = await Task.findById(taskId).select('status assignedTo').lean()
  if (!task || task.status !== 'pending') return false
  return String(task.assignedTo) === String(req.user._id)
}

// POST /api/uploads  (multipart/form-data, field name "file")
// Optional ?maxMb=N applies the form field's per-field size limit, clamped to
// [1, MAX_CEILING_MB]. multer is built per-request so oversize uploads are
// rejected mid-stream rather than after fully buffering to disk.
// Optional ?taskId=<id> marks the upload as required by a pending approval.
router.post('/', protect, async (req, res, next) => {
  try {
    const forTask = await isForOpenTask(req)

    // An expired licence still lets an in-flight approval be completed, so a
    // task-scoped attachment is allowed. A general upload is new work.
    if (isReadOnly(req.organization) && !forTask) {
      return sendError(
        res,
        'This workspace is read-only until its licence is renewed. Attachments can only be added to an approval you already have open.',
        'LICENCE_READ_ONLY',
        403,
        { readOnly: true, resource: 'storage' }
      )
    }

    const reqMb = Math.min(
      Math.max(parseInt(req.query.maxMb, 10) || MAX_CEILING_MB, 1),
      MAX_CEILING_MB
    )
    const upload = multer({ storage, limits: { fileSize: reqMb * 1024 * 1024 } })

    upload.single('file')(req, res, async (err) => {
      try {
        if (err) {
          const code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED'
          const msg = err.code === 'LIMIT_FILE_SIZE'
            ? `File too large. Max ${reqMb} MB.`
            : (err.message || 'Upload failed')
          return sendError(res, msg, code, 400)
        }
        if (!req.file) return sendError(res, 'No file provided', 'NO_FILE', 400)

        const room = await checkStorage(req.organization, req.file.size, { allowBuffer: forTask })
        if (!room.ok) {
          await fs.promises.unlink(req.file.path).catch(() => {})
          return respond(res, room)
        }

        await addStorage(req.orgId, req.file.size, { bufferBytes: room.bufferBytes })

        return sendSuccess(res, {
          file: {
            name: req.file.originalname,
            url: urlFor(req.orgId, req.file.filename),
            mime: req.file.mimetype,
            size: req.file.size
          },
          // Surfaced so the client can warn that emergency space is being used.
          ...(room.bufferBytes > 0 ? { usedStorageBuffer: true } : {})
        }, 201)
      } catch (inner) {
        next(inner)
      }
    })
  } catch (e) {
    next(e)
  }
})

module.exports = router

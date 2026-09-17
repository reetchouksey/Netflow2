const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const S3File = require('../models/S3File')
const { sendSuccess, sendError } = require('../utils/apiResponse')

const router = express.Router()

router.use(protect)

// Only Admin users can access S3 routes
router.use(roleGuard('Admin'))

// Organization-level S3 permission guard
router.use((req, res, next) => {
  if (!req.organization?.integrations?.s3Storage) {
    return sendError(res, 'S3 storage is not enabled for this organization', 'FORBIDDEN', 403)
  }
  next()
})

// Use local storage to mock S3 upload as requested
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const orgId = req.organization._id.toString()
    const dir = path.join(__dirname, '..', 'uploads', orgId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage })

// POST /api/s3/upload
router.post(
  '/upload',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('[s3] Multer error:', err.message)
        return sendError(res, err.message || 'File upload error', 'UPLOAD_ERROR', 400)
      }
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return sendError(res, 'No file uploaded', 'BAD_REQUEST', 400)
      }

      const s3File = await S3File.create({
        orgId: req.organization._id,
        uploadedBy: req.user._id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      })

      const { urlFor } = require('../utils/fileStore')
      const populated = await S3File.findById(s3File._id).populate('uploadedBy', 'name email').lean()
      const baseRelUrl = urlFor(req.organization._id, s3File.filename)
      const filePayload = {
        ...populated,
        url: `${baseRelUrl}&name=${encodeURIComponent(s3File.originalName)}`
      }

      return sendSuccess(res, { file: filePayload }, 201)
    } catch (err) {
      console.error('Error uploading S3 file:', err)
      return sendError(res, 'Failed to upload file', 'SERVER_ERROR', 500)
    }
  }
)

// GET /api/s3/files
router.get('/files', async (req, res) => {
  try {
    const rawFiles = await S3File.find({ orgId: req.organization._id })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    const { urlFor } = require('../utils/fileStore')
    const files = rawFiles.map((f) => {
      const baseRelUrl = urlFor(req.organization._id, f.filename)
      return {
        ...f,
        url: `${baseRelUrl}&name=${encodeURIComponent(f.originalName)}`
      }
    })

    const bucket = req.organization.integrations?.s3Bucket || req.organization.subdomain || req.organization.name || 'default'
    const region = req.organization.integrations?.s3Region || 'auto'

    return sendSuccess(res, { files, bucket, region })
  } catch (err) {
    console.error('Error fetching S3 files:', err)
    return sendError(res, 'Failed to fetch files', 'SERVER_ERROR', 500)
  }
})

// DELETE /api/s3/files/:id
router.delete('/files/:id', async (req, res) => {
  try {
    const file = await S3File.findOne({ _id: req.params.id, orgId: req.organization._id })
    if (!file) {
      return sendError(res, 'File not found', 'NOT_FOUND', 404)
    }

    try {
      const { removeStored } = require('../utils/fileStore')
      await removeStored(req.organization._id, file.filename)
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path)
      }
    } catch (fsErr) {
      console.warn('Could not delete file from disk:', fsErr.message)
    }

    await S3File.deleteOne({ _id: file._id })
    return sendSuccess(res, { message: 'File deleted successfully' })
  } catch (err) {
    console.error('Error deleting S3 file:', err)
    return sendError(res, 'Failed to delete file', 'SERVER_ERROR', 500)
  }
})

// GET /api/s3/files/:id/download
router.get('/files/:id/download', async (req, res) => {
  try {
    const file = await S3File.findOne({ _id: req.params.id, orgId: req.organization._id })
    if (!file) {
      return sendError(res, 'File not found', 'NOT_FOUND', 404)
    }
    if (!fs.existsSync(file.path)) {
      return sendError(res, 'File not found on storage', 'FILE_MISSING', 404)
    }
    return res.download(file.path, file.originalName)
  } catch (err) {
    console.error('Error downloading S3 file:', err)
    return sendError(res, 'Failed to download file', 'SERVER_ERROR', 500)
  }
})

module.exports = router

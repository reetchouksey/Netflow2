const express = require('express')
const multer = require('multer')
const { protect } = require('../middleware/auth')
const s3Client = require('../services/s3Client')
const { sendSuccess, sendError } = require('../utils/apiResponse')

const router = express.Router()
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
})

router.use(protect)

// Check if S3 is enabled for the organization
const requireS3 = (req, res, next) => {
  const s3 = req.organization?.integrations?.s3
  if (!s3 || !s3.enabled) {
    return sendError(res, 'S3 storage is not enabled for this organization', 'S3_DISABLED', 403)
  }
  next()
}

router.use(requireS3)

router.get('/list', async (req, res) => {
  try {
    const prefix = req.query.prefix || ''
    const result = await s3Client.listFolder(req.organization, prefix)
    sendSuccess(res, result)
  } catch (error) {
    console.error('S3 List Error:', error)
    sendError(res, error.message, 'S3_ERROR', 500)
  }
})

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    const key = req.body.key
    if (!file || !key) return sendError(res, 'File and key are required', 'VALIDATION_ERROR', 400)
    
    await s3Client.uploadFile(req.organization, key, file.buffer, file.mimetype)
    sendSuccess(res, { key })
  } catch (error) {
    console.error('S3 Upload Error:', error)
    sendError(res, error.message, 'S3_ERROR', 500)
  }
})

router.get('/download', async (req, res) => {
  try {
    const key = req.query.key
    if (!key) return sendError(res, 'Key is required', 'VALIDATION_ERROR', 400)
    
    const url = await s3Client.getPresignedDownloadUrl(req.organization, key)
    sendSuccess(res, { url })
  } catch (error) {
    console.error('S3 Download Error:', error)
    sendError(res, error.message, 'S3_ERROR', 500)
  }
})

router.post('/delete', async (req, res) => {
  try {
    const { key } = req.body
    if (!key) return sendError(res, 'Key is required', 'VALIDATION_ERROR', 400)
    
    await s3Client.deleteFile(req.organization, key)
    sendSuccess(res, { message: 'File deleted successfully' })
  } catch (error) {
    console.error('S3 Delete Error:', error)
    sendError(res, error.message, 'S3_ERROR', 500)
  }
})

module.exports = router

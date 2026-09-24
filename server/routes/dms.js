const express = require('express')
const multer = require('multer')
const fs = require('fs')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const dmsClient = require('../services/dmsClient')
const DmsDocument = require('../models/DmsDocument')
const {
  readDmsStorageUsage,
  persistStorageUsage,
} = require('../services/storageUsage')
const { dirForOrg, safeFilename, urlFor, removeStored, measureOrg } = require('../utils/fileStore')
const { checkStorage, respond } = require('../middleware/quota')
const { addStorage } = require('../utils/usageMeter')

const router = express.Router()

router.use(protect, roleGuard('Admin', 'SuperAdmin'))

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

const uploadMiddleware = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// Helper: normalize extension to category
const getDocType = (filename = '', mime = '') => {
  const ext = (filename.split('.').pop() || '').toUpperCase()
  if (['PDF', 'DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT', 'TXT', 'PNG', 'JPG', 'JPEG', 'CSV', 'ZIP'].includes(ext)) {
    if (ext === 'DOC' || ext === 'DOCX') return 'DOCX'
    if (ext === 'XLS' || ext === 'XLSX' || ext === 'CSV') return 'XLSX'
    if (['JPG', 'JPEG', 'PNG', 'WEBP'].includes(ext)) return 'JPG'
    return ext
  }
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('word')) return 'DOCX'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'XLSX'
  if (mime.includes('image')) return 'JPG'
  return 'Document'
}

// POST /api/dms/upload — Direct upload route
router.post('/upload', uploadMiddleware.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No file provided', 'NO_FILE', 400)

    const room = await checkStorage(req.organization, req.file.size)
    if (!room.ok) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return respond(res, room)
    }

    await addStorage(req.orgId, req.file.size, { bufferBytes: room.bufferBytes })

    const orgName = req.organization?.name || 'Organization'
    const dept = req.body?.department || req.user?.department || 'General'
    const userName = req.user?.name || 'System'
    const docType = getDocType(req.file.originalname, req.file.mimetype)
    const folderPath = req.body?.folderPath || `${orgName}/${dept}/${userName}/${docType}`
    const fileUrl = urlFor(req.orgId, req.file.filename)

    const dmsDoc = await DmsDocument.create({
      orgId: req.orgId,
      uploadedBy: req.user._id,
      name: req.file.originalname,
      filename: req.file.filename,
      mime: req.file.mimetype,
      type: docType,
      sizeBytes: req.file.size,
      department: dept,
      folderPath,
      fileUrl,
      tags: req.body?.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [],
      description: req.body?.description || null,
      status: 'Synced'
    })

    await dmsDoc.populate('uploadedBy', 'name email avatar role')

    return sendSuccess(res, {
      document: {
        _id: dmsDoc._id,
        name: dmsDoc.name,
        type: dmsDoc.type,
        sizeBytes: dmsDoc.sizeBytes,
        folderPath: dmsDoc.folderPath,
        uploadedBy: dmsDoc.uploadedBy,
        createdAt: dmsDoc.createdAt,
        tags: dmsDoc.tags,
        description: dmsDoc.description,
        dmsId: dmsDoc._id,
        fileUrl: dmsDoc.fileUrl,
        version: dmsDoc.version,
        status: 'Synced'
      }
    }, 201)
  } catch (err) {
    next(err)
  }
})

// GET /api/dms/documents
router.get('/documents', async (req, res) => {
  try {
    const { folderId } = req.query
    const orgName = req.organization?.name || 'Organization'

    // 1. Fetch local documents from MongoDB
    const localDocs = await DmsDocument.find({ orgId: req.orgId })
      .populate('uploadedBy', 'name email avatar role')
      .sort({ createdAt: -1 })
      .lean()

    let documents = localDocs.map(doc => {
      const dept = doc.department || 'General'
      const uploadedByObj = doc.uploadedBy || { name: 'System' }
      const userName = uploadedByObj.name || 'System'
      const docType = doc.type || getDocType(doc.name, doc.mime)
      const virtualPath = doc.folderPath || `${orgName}/${dept}/${userName}/${docType}`

      return {
        _id: doc._id,
        name: doc.name || 'Untitled',
        type: docType,
        sizeBytes: doc.sizeBytes || 0,
        folderPath: virtualPath,
        department: dept,
        uploadedBy: uploadedByObj,
        createdAt: doc.createdAt || new Date(),
        tags: doc.tags || [],
        description: doc.description || null,
        dmsId: doc.dmsDocId || doc._id,
        fileUrl: doc.fileUrl || (doc.filename ? urlFor(req.orgId, doc.filename) : null),
        version: doc.version || '1.0',
        status: 'Synced'
      }
    })

    // 2. Fetch directly from external DMS if configured
    if (dmsClient.isEnabled() && dmsClient.isConfiguredFor(req.organization)) {
      try {
        const result = await dmsClient.listDocuments({ org: req.organization, user: req.user, limit: 200 })
        if (result && Array.isArray(result.documents)) {
          const externalDocs = result.documents.map(doc => {
            const dept = doc.department || 'General'
            const uploadedBy = (typeof doc.uploadedBy === 'string' ? doc.uploadedBy : doc.uploadedBy?.name) || 'System'
            const docType = doc.type || getDocType(doc.name, doc.mime)
            const virtualPath = `${orgName}/${dept}/${uploadedBy}/${docType}`

            return {
              _id: doc.id || doc._id || doc.dmsDocId,
              name: doc.name || 'Untitled',
              type: docType,
              sizeBytes: doc.size || doc.bytes || doc.fileSize || 0,
              folderPath: virtualPath,
              department: dept,
              uploadedBy: doc.uploadedBy || doc.createdBy || { name: uploadedBy },
              createdAt: doc.createdAt || doc.date || new Date(),
              tags: doc.tags || [],
              description: doc.description || null,
              dmsId: doc.id || doc._id || doc.dmsDocId,
              fileUrl: doc.url || doc.viewUrl || null,
              version: doc.version || '1.0',
              status: 'Synced'
            }
          })

          // Merge without duplicates
          const seenIds = new Set(documents.map(d => String(d._id)))
          for (const extDoc of externalDocs) {
            if (!seenIds.has(String(extDoc._id))) {
              documents.push(extDoc)
              seenIds.add(String(extDoc._id))
            }
          }
        }
      } catch (dmsErr) {
        console.warn('[dms] External DMS listDocuments skipped:', dmsErr.message)
      }
    }

    // Filter by folder if the UI requested a specific folder path
    if (folderId) {
      documents = documents.filter(d => d.folderPath === folderId || d.folderPath.startsWith(folderId + '/'))
    }

    sendSuccess(res, { documents })
  } catch (err) {
    if (err instanceof dmsClient.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message, code, err.status || 500)
    }
    sendError(res, err.message, 'DMS_DOCUMENTS_ERROR')
  }
})

// GET /api/dms/folders
router.get('/folders', async (req, res) => {
  try {
    const orgName = req.organization?.name || 'Organization'
    const paths = new Set()

    // 1. Default department base folders
    const defaultDepts = (req.organization?.departments && req.organization.departments.length > 0)
      ? req.organization.departments
      : ['General', 'IT', 'HR', 'Finance', 'Operations', 'Sales', 'Legal']

    defaultDepts.forEach(dept => {
      paths.add(`${orgName}/${dept}`)
    })

    // 2. Add paths from local documents
    const localDocs = await DmsDocument.find({ orgId: req.orgId })
      .populate('uploadedBy', 'name')
      .lean()

    localDocs.forEach(doc => {
      if (doc.folderPath) {
        paths.add(doc.folderPath)
      } else {
        const dept = doc.department || 'General'
        const uploadedBy = doc.uploadedBy?.name || 'System'
        const type = doc.type || getDocType(doc.name, doc.mime)
        paths.add(`${orgName}/${dept}/${uploadedBy}/${type}`)
      }
    })

    // 3. Add paths from external DMS if configured
    if (dmsClient.isEnabled() && dmsClient.isConfiguredFor(req.organization)) {
      try {
        const result = await dmsClient.listDocuments({ org: req.organization, user: req.user, limit: 500 })
        const docs = result?.documents || []
        for (const doc of docs) {
          const dept = doc.department || 'General'
          const uploadedBy = (typeof doc.uploadedBy === 'string' ? doc.uploadedBy : doc.uploadedBy?.name) || 'System'
          const type = doc.type || getDocType(doc.name, doc.mime)
          paths.add(`${orgName}/${dept}/${uploadedBy}/${type}`)
        }
      } catch (dmsErr) {
        console.warn('[dms] External DMS listFolders skipped:', dmsErr.message)
      }
    }

    // Construct frontend-friendly tree format
    const foldersMap = {}

    paths.forEach(pathStr => {
      const parts = pathStr.split('/').filter(Boolean)
      let currentPath = ''
      let parentId = null
      for (let i = 0; i < parts.length; i++) {
        currentPath += (i > 0 ? '/' : '') + parts[i]
        if (!foldersMap[currentPath]) {
          foldersMap[currentPath] = {
            _id: currentPath,
            name: parts[i],
            parentId: parentId
          }
        }
        parentId = currentPath
      }
    })

    const folders = Object.values(foldersMap)
    sendSuccess(res, { folders })
  } catch (err) {
    if (err instanceof dmsClient.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message, code, err.status || 500)
    }
    sendError(res, err.message, 'DMS_FOLDERS_ERROR')
  }
})

// GET /api/dms/documents/:id/url
router.get('/documents/:id/url', async (req, res) => {
  try {
    const { mode } = req.query // 'view' or 'download'
    const id = req.params.id

    // 1. Check local MongoDB
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      const doc = await DmsDocument.findOne({ _id: id, orgId: req.orgId })
      if (doc) {
        if (doc.filename) {
          let url = urlFor(req.orgId, doc.filename)
          if (mode === 'download') url += '&download=1'
          return sendSuccess(res, { url })
        }
        if (doc.fileUrl) {
          let url = doc.fileUrl
          if (mode === 'download' && !url.includes('download=1')) {
            url += (url.includes('?') ? '&' : '?') + 'download=1'
          }
          return sendSuccess(res, { url })
        }
        if (doc.dmsDocId && dmsClient.isEnabled()) {
          const url = await dmsClient.signedUrl(doc.dmsDocId, {
            org: req.organization,
            user: req.user,
            mode: mode || 'view'
          })
          if (url) return sendSuccess(res, { url })
        }
      }
    }

    // 2. Fetch signed URL from external DMS
    if (dmsClient.isEnabled()) {
      const url = await dmsClient.signedUrl(id, {
        org: req.organization,
        user: req.user,
        mode: mode || 'view'
      })
      if (url) {
        return sendSuccess(res, { url })
      }
    }

    sendError(res, 'File URL not found', 'DMS_URL_NOT_FOUND', 404)
  } catch (err) {
    if (err instanceof dmsClient.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message, code, err.status || 500)
    }
    sendError(res, err.message, 'DMS_SYNC_ERROR')
  }
})

// DELETE /api/dms/documents/:id
router.delete('/documents/:id', async (req, res) => {
  try {
    const id = req.params.id

    // 1. Check local DB
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      const doc = await DmsDocument.findOne({ _id: id, orgId: req.orgId })
      if (doc) {
        if (doc.filename) {
          await removeStored(req.orgId, doc.filename)
        }
        if (doc.dmsDocId && dmsClient.isEnabled()) {
          await dmsClient.deleteDoc(doc.dmsDocId, { org: req.organization, user: req.user }).catch(() => {})
        }
        await DmsDocument.deleteOne({ _id: doc._id })
        return sendSuccess(res, { message: 'Document deleted successfully' })
      }
    }

    // 2. External DMS delete
    if (dmsClient.isEnabled()) {
      await dmsClient.deleteDoc(id, {
        org: req.organization,
        user: req.user
      })
    }

    sendSuccess(res, { message: 'Document deleted successfully' })
  } catch (err) {
    if (err instanceof dmsClient.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message, code, err.status || 500)
    }
    sendError(res, err.message, 'DMS_DOCUMENT_ERROR')
  }
})

// GET /api/dms/stats
router.get('/stats', async (req, res) => {
  try {
    // 1. Try external DMS stats if enabled and configured
    if (dmsClient.isEnabled() && dmsClient.isConfiguredFor(req.organization)) {
      try {
        const live = await readDmsStorageUsage({ org: req.organization, user: req.user })
        if (live && live.configured && live.available) {
          await persistStorageUsage(req.organization, live)
          const limitMb = req.organization.storageLimitMb ? req.organization.storageLimitMb() : (req.organization.limits?.maxStorageMb || (500 * 1024))
          const stats = {
            enabled: true,
            source: live.source,
            usedBytes: live.usedBytes,
            usedMb: live.usedBytes / (1024 * 1024),
            documentCount: live.documentCount,
            organizationId: live.organizationId,
            limitMb,
            plan: req.organization.plan ? (req.organization.plan.charAt(0).toUpperCase() + req.organization.plan.slice(1)) : 'Basic',
            orgName: req.organization.name
          }
          return sendSuccess(res, { stats })
        }
      } catch (liveErr) {
        console.warn('[dms] readDmsStorageUsage failed, using local stats:', liveErr.message)
      }
    }

    // 2. Local stats calculation
    const docs = await DmsDocument.find({ orgId: req.orgId }).select('sizeBytes').lean()
    const documentCount = docs.length
    let usedBytes = docs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0)

    if (usedBytes === 0) {
      const measured = measureOrg(req.orgId)
      usedBytes = measured.bytes || 0
    }

    const limitMb = req.organization.storageLimitMb ? req.organization.storageLimitMb() : (req.organization.limits?.maxStorageMb || (500 * 1024))
    const plan = req.organization.plan ? (req.organization.plan.charAt(0).toUpperCase() + req.organization.plan.slice(1)) : 'Basic'
    const orgName = req.organization.name || 'Organization'

    const stats = {
      enabled: true,
      source: 'netflow_dms',
      usedBytes,
      usedMb: usedBytes / (1024 * 1024),
      documentCount,
      organizationId: String(req.orgId),
      limitMb: limitMb || (500 * 1024),
      plan,
      orgName
    }

    sendSuccess(res, { stats })
  } catch (err) {
    if (err instanceof dmsClient.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message, code, err.status || 500)
    }
    sendError(res, err.message, 'DMS_STATS_ERROR')
  }
})

module.exports = router

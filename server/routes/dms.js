const express = require('express')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const dmsClient = require('../services/dmsClient')
const S3File = require('../models/S3File')
const { urlFor } = require('../utils/fileStore')

const router = express.Router()

router.use(protect)

// Only Admin users can access DMS routes
router.use(roleGuard('Admin'))

// GET /api/dms/documents
router.get('/documents', async (req, res) => {
  try {
    const { folderId } = req.query
    
    // Fetch directly from BaseLayer DMS
    let documents = []
    try {
      const result = await dmsClient.listDocuments({ org: req.organization, user: req.user, limit: 200 })
      if (result && Array.isArray(result.documents)) {
        documents = result.documents
      }
    } catch (err) {
      console.warn('[dms] listDocuments failed:', err.message)
    }
    
    // Transform DMS documents to frontend format
    let formattedDocs = documents.map(doc => {
       const orgName = req.organization?.name || 'Organization'
       const dept = doc.department || 'General'
       const uploadedBy = (typeof doc.uploadedBy === 'string' ? doc.uploadedBy : doc.uploadedBy?.name) || 'System'
       const docType = doc.type || 'Document'
       const virtualPath = `${orgName}/${dept}/${uploadedBy}/${docType}`

       return {
         _id: doc.id || doc._id || doc.dmsDocId,
         name: doc.name || 'Untitled',
         type: doc.mime || doc.type || 'UNKNOWN',
         sizeBytes: doc.size || doc.bytes || doc.fileSize || 0,
         folderPath: virtualPath,
         uploadedBy: doc.uploadedBy || doc.createdBy || {}, 
         createdAt: doc.createdAt || doc.date || new Date(),
         tags: doc.tags || [],
         description: doc.description || null,
         dmsId: doc.id || doc._id || doc.dmsDocId,
         fileUrl: doc.url || doc.viewUrl || null,
         version: doc.version || '1.0',
         status: 'Synced'
       }
    })

    // Include files stored locally via native database persistence
    try {
      const orgId = req.organization?._id || req.user?.organization
      if (orgId) {
        const localFiles = await S3File.find({ orgId }).populate('uploadedBy', 'name email').lean()
        const orgName = req.organization?.name || 'Organization'

        for (const file of localFiles) {
          const docId = String(file._id)
          if (!formattedDocs.some(d => d._id === docId || d.name === file.filename)) {
            const uploaderName = file.uploadedBy?.name || 'System'
            const docExt = (file.filename || '').split('.').pop() || 'FILE'
            
            formattedDocs.push({
              _id: docId,
              name: file.originalName || file.filename,
              type: file.mimetype || docExt.toUpperCase(),
              sizeBytes: file.size,
              folderPath: `${orgName}/General/${uploaderName}/Document`,
              uploadedBy: file.uploadedBy || { name: 'System' },
              createdAt: file.createdAt,
              tags: ['Upload'],
              description: 'Uploaded Document',
              dmsId: docId,
              fileUrl: urlFor(orgId, file.filename),
              version: '1.0',
              status: 'Synced'
            })
          }
        }
      }
    } catch (localErr) {
      console.warn('[dms] local uploads read error:', localErr.message)
    }

    // Filter by folder if the UI requested a specific folder path
    if (folderId) {
      formattedDocs = formattedDocs.filter(d => d.folderPath === folderId)
    }

    sendSuccess(res, { documents: formattedDocs })
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
    const fs = require('fs')
    const path = require('path')
    
    // Generate virtual folder tree from document metadata
    let docs = []
    try {
      const result = await dmsClient.listDocuments({ org: req.organization, user: req.user, limit: 500 })
      if (result && Array.isArray(result.documents)) {
        docs = result.documents
      }
    } catch (err) {
      console.warn('[dms] listDocuments for folders error:', err.message)
    }
    
    const paths = new Set()
    for (const doc of docs) {
       const orgName = req.organization?.name || 'Organization'
       const dept = doc.department || 'General'
       const uploadedBy = (typeof doc.uploadedBy === 'string' ? doc.uploadedBy : doc.uploadedBy?.name) || 'System'
       const type = doc.type || 'Document'
       
       const pathStr = `${orgName}/${dept}/${uploadedBy}/${type}`
       paths.add(pathStr)
    }

    // Include local folder path
    const orgName = req.organization?.name || 'Organization'
    paths.add(`${orgName}/General/${req.user?.name || 'Admin'}/Document`)
    
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
    const docId = req.params.id

    if (docId && docId.startsWith('local-')) {
      const filename = docId.replace(/^local-/, '')
      const orgId = req.organization?._id || req.user?.organization
      return sendSuccess(res, { url: urlFor(orgId, filename) })
    }

    // Check if this is a native S3File record (local DB persistence)
    const orgId = req.organization?._id || req.user?.organization
    if (orgId && docId && docId.length === 24) {
      try {
        const file = await S3File.findOne({ _id: docId, orgId })
        if (file) {
          return sendSuccess(res, { url: urlFor(orgId, file.filename) })
        }
      } catch (lookupErr) {
        // Not a valid ObjectId or not found — fall through to DMS
      }
    }

    const url = await dmsClient.signedUrl(docId, {
      org: req.organization,
      user: req.user,
      mode: mode || 'view'
    })
    
    if (!url) {
      return sendError(res, 'File URL not found', 'DMS_URL_NOT_FOUND', 404)
    }
    
    sendSuccess(res, { url })
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
    const docId = req.params.id
    if (docId && docId.startsWith('local-')) {
      const filename = docId.replace(/^local-/, '')
      const { removeStored } = require('../utils/fileStore')
      const orgId = req.organization?._id || req.user?.organization
      await removeStored(orgId, filename)
    } else {
      let isNativeLocal = false
      const orgId = req.organization?._id || req.user?.organization
      if (orgId && docId && docId.length === 24) {
        const file = await S3File.findOne({ _id: docId, orgId })
        if (file) {
          isNativeLocal = true
          const { removeStored } = require('../utils/fileStore')
          await removeStored(orgId, file.filename)
          await S3File.deleteOne({ _id: file._id })
        }
      }
      if (!isNativeLocal) {
        await dmsClient.deleteDoc(docId, {
          org: req.organization,
          user: req.user
        })
      }
    }
    sendSuccess(res, { message: 'Document deleted successfully' })
  } catch (err) {
    if (err instanceof dmsClient.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message, code, err.status || 500)
    }
    sendError(res, err.message, 'DMS_DELETE_ERROR')
  }
})

// GET /api/dms/stats
router.get('/stats', async (req, res) => {
  try {
    let stats = await dmsClient.getStorageUsage({ org: req.organization, user: req.user })
    if (!stats) {
      // Calculate local native storage stats
      const orgId = req.organization?._id || req.user?.organization
      if (orgId) {
        const localFiles = await S3File.find({ orgId }).select('size').lean()
        const usedBytes = localFiles.reduce((acc, f) => acc + (f.size || 0), 0)
        stats = {
          enabled: true,
          source: 'local_native',
          usedBytes,
          usedMb: usedBytes / (1024 * 1024),
          limitBytes: (req.organization.limits?.maxStorageMb || (500 * 1024)) * 1024 * 1024,
          limitMb: req.organization.limits?.maxStorageMb || (500 * 1024),
          documentCount: localFiles.length,
          organizationId: String(orgId),
        }
      } else {
        return sendSuccess(res, { stats: null, message: 'No stats available' })
      }
    }
    
    // Inject the NetFlow Organization's plan data into the DMS stats payload
    stats.limitMb = req.organization.limits?.maxStorageMb || (500 * 1024)
    stats.plan = req.organization.plan ? (req.organization.plan.charAt(0).toUpperCase() + req.organization.plan.slice(1)) : 'Basic'
    stats.orgName = req.organization.name

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

// One-time: push legacy local attachments into BaseLayer DMS.
// Does NOT delete local files unless --delete-local is passed (second pass).
//
// Usage:
//   node scripts/migrateUploadsToDms.js
//   node scripts/migrateUploadsToDms.js --delete-local
//   node scripts/migrateUploadsToDms.js --limit=50

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const path = require('path')
const fs = require('fs')
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const FormResponse = require('../models/FormResponse')
const Task = require('../models/Task')
const dms = require('../services/dmsClient')
const { UPLOAD_ROOT } = (() => {
  try {
    return { UPLOAD_ROOT: path.join(__dirname, '..', 'uploads') }
  } catch {
    return { UPLOAD_ROOT: path.join(__dirname, '..', 'uploads') }
  }
})()

const args = process.argv.slice(2)
const deleteLocal = args.includes('--delete-local')
const limitArg = args.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10) || 100) : 200

const resolveLocalPath = (urlOrPath) => {
  if (!urlOrPath) return null
  // /api/files/<orgId>/<file>?k=…  or /uploads/<orgId>/<file> or absolute
  const clean = String(urlOrPath).split('?')[0]
  const m = clean.match(/\/(?:api\/files|uploads)\/([^/]+)\/([^/]+)$/)
  if (m) return path.join(UPLOAD_ROOT, m[1], m[2])
  if (path.isAbsolute(clean) && fs.existsSync(clean)) return clean
  const joined = path.join(UPLOAD_ROOT, clean.replace(/^\/+/, ''))
  return fs.existsSync(joined) ? joined : null
}

async function migrateFormResponses() {
  const rows = await FormResponse.find({
    'attachments.dmsDocId': { $in: [null, ''] },
    attachments: { $exists: true, $ne: [] },
  }).limit(LIMIT).setOptions({ skipOrgScope: true })

  let n = 0
  for (const doc of rows) {
    let changed = false
    for (const att of doc.attachments || []) {
      if (att.dmsDocId) continue
      const local = resolveLocalPath(att.path)
      if (!local || !fs.existsSync(local)) continue
      try {
        const uploaded = await dms.uploadFile({
          filePath: local,
          filename: att.filename || path.basename(local),
          mime: att.mimetype || 'application/octet-stream',
          ref: { formResponseId: doc._id },
        })
        att.dmsDocId = uploaded.id
        changed = true
        n += 1
        if (deleteLocal) fs.unlinkSync(local)
        console.log('FormResponse', doc._id, '→', uploaded.id)
      } catch (err) {
        console.warn('skip FormResponse', doc._id, err.message)
      }
    }
    if (changed) await doc.save()
  }
  return n
}

async function migrateTasks() {
  const rows = await Task.find({
    'attachments.dmsDocId': { $in: [null, ''] },
    attachments: { $exists: true, $ne: [] },
  }).limit(LIMIT).setOptions({ skipOrgScope: true })

  let n = 0
  for (const doc of rows) {
    let changed = false
    for (const att of doc.attachments || []) {
      if (att.dmsDocId) continue
      const local = resolveLocalPath(att.url)
      if (!local || !fs.existsSync(local)) continue
      try {
        const uploaded = await dms.uploadFile({
          filePath: local,
          filename: att.name || path.basename(local),
          mime: att.mime || 'application/octet-stream',
          ref: { taskId: doc._id, workflowId: doc.workflowId },
        })
        att.dmsDocId = uploaded.id
        changed = true
        n += 1
        if (deleteLocal) fs.unlinkSync(local)
        console.log('Task', doc._id, '→', uploaded.id)
      } catch (err) {
        console.warn('skip Task', doc._id, err.message)
      }
    }
    if (changed) await doc.save()
  }
  return n
}

async function main() {
  if (!dms.isEnabled()) {
    console.error('DMS_ENABLED must be true')
    process.exit(1)
  }
  await connectDB()
  const a = await migrateFormResponses()
  const b = await migrateTasks()
  console.log(`Migrated ${a} form-response + ${b} task attachments. deleteLocal=${deleteLocal}`)
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

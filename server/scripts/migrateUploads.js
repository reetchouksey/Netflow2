// Licensing Phase 2 (security) - scripts/migrateUploads.js
// Moves legacy attachments out of the flat, publicly-served uploads directory
// into per-org folders, and rewrites every stored reference to them.
//
// Why it exists: before per-org storage, any attachment could be read by anyone
// who guessed its filename. New uploads are already isolated and access-checked
// (routes/files.js); this closes the door on the historical ones. Once it has run
// cleanly, set SERVE_LEGACY_UPLOADS=0 and the flat directory stops being served.
//
// A file's owner is discovered from the records that reference it — form
// responses, workflow execution variables, user avatars. Anything nothing points
// at is left alone and reported, because deleting an unreferenced file is not a
// decision a migration should make on its own.
//
// Run with:  npm run migrate:uploads   (from /server)
//   --dry    report what would change, write nothing

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const FormResponse = require('../models/FormResponse')
const WorkflowExecution = require('../models/WorkflowExecution')
const User = require('../models/User')
const { UPLOAD_ROOT, dirForOrg, urlFor } = require('../utils/fileStore')

const DRY = process.argv.includes('--dry')

const LEGACY_RE = /^\/uploads\/([A-Za-z0-9._-]+)$/

// Walks any JSON value and rewrites every legacy attachment URL it finds, in
// place. File form fields are stored as { name, url, mime, size } objects, but
// they can be nested inside repeater rows and grid cells, so this cannot assume
// a shape. Returns the filenames it touched.
const rewriteValue = (value, orgId, touched) => {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    value.forEach((v, i) => { value[i] = rewriteValue(v, orgId, touched) })
    return value
  }
  for (const [key, v] of Object.entries(value)) {
    if (key === 'url' && typeof v === 'string') {
      const match = LEGACY_RE.exec(v)
      if (match) {
        touched.add(match[1])
        value[key] = urlFor(orgId, match[1])
      }
      continue
    }
    value[key] = rewriteValue(v, orgId, touched)
  }
  return value
}

const moveFile = (filename, orgId) => {
  const from = path.join(UPLOAD_ROOT, filename)
  const to = path.join(dirForOrg(orgId), filename)
  if (!fs.existsSync(from)) return 'missing'
  if (fs.existsSync(to)) return 'already-there'
  if (DRY) return 'would-move'
  fs.renameSync(from, to)
  return 'moved'
}

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Create server/.env first.')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 })
    console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
    if (DRY) console.log('DRY RUN — no writes will be made')
    console.log('')

    const claimed = new Set()
    const stats = { responses: 0, executions: 0, avatars: 0, moved: 0, missing: 0, alreadyThere: 0 }

    // ── form responses: formData + the attachments array ────────────────────
    const responses = await FormResponse.find({}).setOptions({ skipOrgScope: true })
    for (const response of responses) {
      if (!response.orgId) continue
      const touched = new Set()

      const data = response.formData && typeof response.formData === 'object'
        ? JSON.parse(JSON.stringify(response.formData))
        : null
      if (data) rewriteValue(data, response.orgId, touched)

      const attachments = (response.attachments || []).map((a) => {
        const plain = a.toObject ? a.toObject() : { ...a }
        const match = LEGACY_RE.exec(String(plain.path || ''))
        if (match) {
          touched.add(match[1])
          plain.path = urlFor(response.orgId, match[1])
        }
        return plain
      })

      if (!touched.size) continue
      touched.forEach((f) => claimed.add(`${f}::${response.orgId}`))
      stats.responses += 1
      if (!DRY) {
        if (data) response.formData = data
        response.attachments = attachments
        response.markModified('formData')
        await response.save()
      }
    }

    // ── workflow executions: variables.formData carries a copy ──────────────
    const executions = await WorkflowExecution.find({}).setOptions({ skipOrgScope: true })
    for (const execution of executions) {
      if (!execution.orgId || !execution.variables) continue
      const touched = new Set()
      const vars = JSON.parse(JSON.stringify(execution.variables))
      rewriteValue(vars, execution.orgId, touched)
      if (!touched.size) continue
      touched.forEach((f) => claimed.add(`${f}::${execution.orgId}`))
      stats.executions += 1
      if (!DRY) {
        execution.variables = vars
        execution.markModified('variables')
        await execution.save()
      }
    }

    // ── user avatars ────────────────────────────────────────────────────────
    const users = await User.find({ avatar: /^\/uploads\// }).setOptions({ skipOrgScope: true })
    for (const user of users) {
      const match = LEGACY_RE.exec(String(user.avatar || ''))
      if (!match || !user.orgId) continue
      claimed.add(`${match[1]}::${user.orgId}`)
      stats.avatars += 1
      if (!DRY) {
        user.avatar = urlFor(user.orgId, match[1])
        await user.save()
      }
    }

    // ── move the files the records above claimed ─────────────────────────────
    for (const entry of claimed) {
      const [filename, orgId] = entry.split('::')
      const result = moveFile(filename, orgId)
      if (result === 'moved' || result === 'would-move') stats.moved += 1
      else if (result === 'missing') stats.missing += 1
      else stats.alreadyThere += 1
    }

    // ── anything left in the flat directory is unreferenced ──────────────────
    const leftovers = fs.readdirSync(UPLOAD_ROOT, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)

    console.log(`Records rewritten: ${stats.responses} form response(s), `
      + `${stats.executions} execution(s), ${stats.avatars} avatar(s)`)
    console.log(`Files: ${stats.moved} moved, ${stats.alreadyThere} already in place, `
      + `${stats.missing} referenced but missing from disk`)
    console.log('')

    if (leftovers.length) {
      console.log(`${leftovers.length} file(s) remain in the flat directory with nothing referencing them:`)
      leftovers.slice(0, 20).forEach((f) => console.log(`  ${f}`))
      if (leftovers.length > 20) console.log(`  ... and ${leftovers.length - 20} more`)
      console.log('')
      console.log('Review them, then delete them by hand. Keeping SERVE_LEGACY_UPLOADS on for these')
      console.log('leaves them publicly readable, which is exactly what this migration is closing.')
    } else if (!DRY) {
      console.log('The flat directory is empty. Set SERVE_LEGACY_UPLOADS=0 to stop serving it.')
    }
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

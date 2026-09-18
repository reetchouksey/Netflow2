// Licensing Phase 3 - scripts/backfillStorage.js
// Sets each tenant's storage meters from what is actually on disk.
//
// Uploads have only been metered since Phase 2, so every file that existed before
// then is invisible to the counters — a tenant could be shown 0 MB while holding
// gigabytes. This walks uploads/<orgId>/ and writes the truth.
//
// The filesystem is the source of truth rather than the database, because a file
// with no reference still occupies the disk the customer is paying for, and a
// reference with no file is not storage at all. Orphans are reported so they can
// be investigated, not silently deleted.
//
// The nightly reconciliation job (jobs/usageCron.js) runs exactly the same
// comparison; this script exists to do it once, on demand, with a readable report.
//
// Run with:  npm run backfill:storage   (from /server)
//   --dry     report what would change, write nothing

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const Organization = require('../models/Organization')
const FormResponse = require('../models/FormResponse')
const Task = require('../models/Task')
const WorkflowExecution = require('../models/WorkflowExecution')
const User = require('../models/User')
const { UPLOAD_ROOT, measureOrg } = require('../utils/fileStore')
const { collect } = require('../utils/fileGc')

const DRY = process.argv.includes('--dry')
const MB = 1024 * 1024

const mb = (bytes) => (bytes / MB).toFixed(1)

// Every file the tenant's records still point at, as "<orgId>/<filename>".
const referencedBy = async (orgId) => {
  const [responses, tasks, executions, users] = await Promise.all([
    FormResponse.find({ orgId }).select('formData attachments').setOptions({ skipOrgScope: true }).lean(),
    Task.find({ orgId }).select('formData attachments').setOptions({ skipOrgScope: true }).lean(),
    WorkflowExecution.find({ orgId }).select('variables').setOptions({ skipOrgScope: true }).lean(),
    User.find({ orgId }).select('avatar').setOptions({ skipOrgScope: true }).lean()
  ])

  // Deliberately wide here, unlike utils/fileGc: this only decides whether a file
  // is referenced *somewhere*, and counting a quoted copy as a reference is the
  // safe direction — it keeps a live file off the orphan list.
  return collect([
    responses.map((r) => [r.formData, r.attachments]),
    tasks.map((t) => [t.formData, t.attachments]),
    executions.map((e) => e.variables),
    users.map((u) => u.avatar)
  ])
}

const filesOnDisk = (orgId) => {
  const dir = path.join(UPLOAD_ROOT, String(orgId))
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`Connected: ${mongoose.connection.name}`)
  console.log(`Upload root: ${UPLOAD_ROOT}`)
  console.log(DRY ? '\nDRY RUN — nothing will be written\n' : '\nWriting storage meters\n')

  const orgs = await Organization.find({}).select('name subdomain usage limits').lean()
  let corrected = 0
  let orphanTotal = 0

  for (const org of orgs) {
    const actual = measureOrg(org._id)
    const stored = {
      bytes: Number(org.usage?.storageBytes || 0),
      files: Number(org.usage?.fileCount || 0)
    }

    const names = filesOnDisk(org._id)
    let orphans = []
    if (names.length) {
      const referenced = await referencedBy(org._id)
      orphans = names.filter((name) => !referenced.has(`${org._id}/${name}`))
    }
    orphanTotal += orphans.length

    const drifted = actual.bytes !== stored.bytes || actual.files !== stored.files
    if (!drifted && !orphans.length) continue

    const limitNote = org.limits?.maxStorageMb
      ? ` of ${org.limits.maxStorageMb} MB licensed`
      : ' (unlimited)'
    console.log(`${org.name} (${org.subdomain})`)
    if (drifted) {
      console.log(`  stored ${mb(stored.bytes)} MB / ${stored.files} file(s)`)
      console.log(`  actual ${mb(actual.bytes)} MB / ${actual.files} file(s)${limitNote}`)
    }
    if (orphans.length) {
      console.log(`  ${orphans.length} file(s) on disk with no record pointing at them (kept — they still use space)`)
    }

    if (drifted) corrected += 1
    if (drifted && !DRY) {
      await Organization.updateOne({ _id: org._id }, {
        $set: {
          'usage.storageBytes': actual.bytes,
          'usage.fileCount': actual.files,
          // Buffer usage is only meaningful above the licensed size; once the real
          // total is known, anything under the limit has repaid it.
          'usage.bufferBytesUsed': Math.max(
            0,
            Math.min(
              Number(org.usage?.bufferBytesUsed || 0),
              actual.bytes - Number(org.limits?.maxStorageMb || 0) * MB
            )
          )
        }
      })
    }
  }

  console.log(`\nTenants scanned: ${orgs.length}`)
  console.log(DRY ? `Tenants that would be corrected: ${corrected}` : `Tenants corrected: ${corrected}`)
  if (orphanTotal) {
    console.log(`Unreferenced files found: ${orphanTotal} (counted against storage — review before deleting)`)
  }

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error('\nBackfill failed:', err.message)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})

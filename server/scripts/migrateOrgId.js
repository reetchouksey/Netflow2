// Multi-tenancy Step 2 - scripts/migrateOrgId.js
// One-time migration: stamps every existing business record with the default
// organization's id. Safe + idempotent — only touches documents where orgId
// is missing/null, so re-running never overwrites a real tenant assignment.
//
// Prerequisites:
//   1. A backup exists (npm run backup)
//   2. The default organization exists (npm run seed:org)
//
// Run with:  npm run migrate:org   (from /server)

require('dotenv').config()

const mongoose = require('mongoose')

const Organization = require('../models/Organization')

// Business collections that carry an orgId. Role is intentionally excluded:
// the role catalogue stays global (shared by all tenants) for now.
const COLLECTIONS = [
  'users',
  'forms',
  'formdrafts',
  'formresponses',
  'workflows',
  'workflowexecutions',
  'tasks',
  'notifications',
  'auditlogs',
  'delegationofauthorities'
]

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Create server/.env first.')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      family: 4
    })
    console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

    const defaultOrg = await Organization.findOne({ isDefault: true })
    if (!defaultOrg) {
      console.error('No default organization found. Run "npm run seed:org" first.')
      process.exitCode = 1
      return
    }
    console.log(`Default organization: "${defaultOrg.name}" (${defaultOrg._id})`)
    console.log('')

    const db = mongoose.connection.db
    let totalStamped = 0

    for (const name of COLLECTIONS) {
      const col = db.collection(name)
      const result = await col.updateMany(
        { $or: [{ orgId: { $exists: false } }, { orgId: null }] },
        { $set: { orgId: defaultOrg._id } }
      )
      const remaining = await col.countDocuments({ $or: [{ orgId: { $exists: false } }, { orgId: null }] })
      totalStamped += result.modifiedCount
      console.log(`  ${name}: ${result.modifiedCount} stamped, ${remaining} still missing orgId`)
      if (remaining > 0) {
        console.error(`  WARNING: ${name} still has ${remaining} documents without orgId!`)
        process.exitCode = 1
      }
    }

    console.log('')
    console.log(`Migration complete: ${totalStamped} documents stamped with orgId ${defaultOrg._id}`)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

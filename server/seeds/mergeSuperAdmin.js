// Maintenance - seeds/mergeSuperAdmin.js
// One-time migration: collapse the 'Super Admin' role into the single 'Admin'
// role now that the app uses one top-level administrator role.
//
// Run with:  node seeds/mergeSuperAdmin.js   (from /server)
//
// What it does (idempotent — safe to re-run):
//   1) Ensures an 'Admin' role exists (creates it if missing).
//   2) Reassigns every user currently holding 'Super Admin' to 'Admin'.
//   3) Rewrites any Delegation-of-Authority approver step using 'Super Admin'
//      to 'Admin'.
//   4) Deletes the now-orphaned 'Super Admin' role document.

require('dotenv').config()

const mongoose = require('mongoose')
const dns = require('dns')

// Match the other seeders: force public resolvers so mongodb+srv:// works even
// when the local OS resolver refuses SRV queries. Harmless for localhost URIs.
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])

const Role = require('../models/Role')
const User = require('../models/User')
const DoA = require('../models/DelegationOfAuthority')

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
    console.log('')

    // 1) Ensure the surviving 'Admin' role exists.
    const adminRole = await Role.findOneAndUpdate(
      { name: 'Admin' },
      {
        $setOnInsert: {
          description:
            'Full system access. Manages users, forms, workflows, and is the top approval/escalation authority.',
          permissions: ['*']
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    console.log(`Admin role ready (${adminRole._id}).`)

    // Locate the legacy role. Query by name string works regardless of the
    // (now-narrowed) enum.
    const superRole = await Role.findOne({ name: 'Super Admin' })
    if (!superRole) {
      console.log("No 'Super Admin' role found — nothing to migrate. Already merged.")
      return
    }

    // 2) Reassign users Super Admin -> Admin.
    const userRes = await User.updateMany(
      { role: superRole._id },
      { $set: { role: adminRole._id } }
    )
    console.log(`Users reassigned to Admin: ${userRes.modifiedCount ?? userRes.nModified ?? 0}`)

    // 3) Rewrite DoA approver chains Super Admin -> Admin.
    const doaRes = await DoA.updateMany(
      { 'approverChain.role': 'Super Admin' },
      { $set: { 'approverChain.$[elem].role': 'Admin' } },
      { arrayFilters: [{ 'elem.role': 'Super Admin' }] }
    )
    console.log(`DoA rules updated: ${doaRes.modifiedCount ?? doaRes.nModified ?? 0}`)

    // 4) Drop the legacy role document.
    await Role.deleteOne({ _id: superRole._id })
    console.log("Deleted the 'Super Admin' role.")

    console.log('')
    console.log('Done. Super Admin has been merged into Admin.')
  } catch (err) {
    console.error('mergeSuperAdmin failed:', err.message || err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

// Licensing Phase 1 - scripts/migrateLicensing.js
// Brings pre-licensing data up to the new schema without changing what anyone
// can currently do. Idempotent: re-running only fills gaps.
//
// What it does, and why:
//   1. Organizations keep all-zero limits (= unlimited) and plan 'custom', so no
//      existing tenant is suddenly capped by a plan nobody sold them. It only
//      seeds the fields that must exist: licence status, billing anchor (their
//      signup day) and the first submission window.
//   2. Builder assignments are left untouched. Builder is a per-user licensed
//      entitlement and must never be inferred from a role during migration.
//
// Run with:  npm run migrate:licensing   (from /server)
//   --dry     report what would change, write nothing

require('dotenv').config()

const mongoose = require('mongoose')

const Organization = require('../models/Organization')
const { freshPeriod, deriveLicenceStatus } = require('../utils/licensing')

const DRY = process.argv.includes('--dry')

const migrateOrgs = async () => {
  const orgs = await Organization.find({})
  let touched = 0

  for (const org of orgs) {
    const changes = []

    if (!org.plan) {
      org.plan = 'custom'
      changes.push('plan=custom')
    }
    if (!org.licence?.status) {
      org.licence.status = 'active'
      changes.push('licence.status=active')
    }
    // Perpetual until Sales says otherwise — never invent an expiry date.
    if (org.licence?.validFrom === undefined || org.licence.validFrom === null) {
      org.licence.validFrom = org.createdAt || new Date()
      changes.push('licence.validFrom=createdAt')
    }
    // Anchor the allowance to the day the tenant was created rather than the 1st.
    if (!org.billingAnchorDay || org.billingAnchorDay === 1) {
      const day = new Date(org.createdAt || Date.now()).getUTCDate()
      if (day !== org.billingAnchorDay) {
        org.billingAnchorDay = day
        changes.push(`billingAnchorDay=${day}`)
      }
    }
    if (!org.usage?.submissions?.periodStart) {
      org.usage.submissions = freshPeriod(org)
      changes.push('usage.submissions period seeded')
    }
    const status = deriveLicenceStatus(org)
    if (status !== org.licence.status) {
      org.licence.status = status
      changes.push(`licence.status=${status}`)
    }

    if (!changes.length) {
      console.log(`  ${org.subdomain}: already migrated`)
      continue
    }
    touched += 1
    console.log(`  ${org.subdomain}: ${changes.join(', ')}`)
    if (!DRY) await org.save()
  }

  return { total: orgs.length, touched }
}

const migrateUsers = async () => {
  console.log('  Builder assignments unchanged — manage seats explicitly in Admin → Users')
  return { granted: 0 }
}

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
    if (DRY) console.log('DRY RUN — no writes will be made')
    console.log('')

    console.log('Organizations:')
    const orgResult = await migrateOrgs()
    console.log('')
    console.log('Builder assignments:')
    const userResult = await migrateUsers()
    console.log('')

    console.log(`Done. Orgs: ${orgResult.touched}/${orgResult.total} updated. `
      + `Builder assignments changed: ${userResult.granted}.`)
    if (!DRY) {
      console.log('Next: npm run backfill:storage  (recomputes storage meters from existing attachments)')
    }
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

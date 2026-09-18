// Idempotently applies the approved tenant-wide PDF auto-fill defaults.
// Run from /server with: npm run migrate:pdf-autofill [-- --dry]

require('dotenv').config()
const mongoose = require('mongoose')
const Plan = require('../models/Plan')
const Organization = require('../models/Organization')
const DRY = process.argv.includes('--dry')

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 })
  // Read raw documents so schema defaults do not hide fields that are actually
  // absent in legacy records.
  const sellable = await Plan.collection.find({ isCustom: { $ne: true } })
    .project({ _id: 1, key: 1, features: 1 })
    .toArray()
  const orgs = await Organization.collection.find({ isDefault: { $ne: true } })
    .project({ _id: 1, subdomain: 1, plan: 1, pdfAutoFill: 1 })
    .toArray()
  console.log((DRY ? 'DRY RUN: ' : '') + sellable.length + ' sellable plan(s), ' + orgs.length + ' tenant(s)')

  for (const plan of sellable) {
    if (typeof plan.features?.pdfAutoFill === 'boolean') continue
    console.log('  plan ' + plan.key + ': pdfAutoFill=true')
    if (!DRY) await Plan.collection.updateOne(
      { _id: plan._id },
      { $set: { 'features.pdfAutoFill': true } }
    )
  }

  for (const org of orgs) {
    const update = {}
    if (typeof org.pdfAutoFill?.enabled !== 'boolean') update['pdfAutoFill.enabled'] = true
    if (!org.pdfAutoFill?.languageMode) update['pdfAutoFill.languageMode'] = 'english_hindi'
    if (typeof org.pdfAutoFill?.audiences?.authenticated !== 'boolean') {
      update['pdfAutoFill.audiences.authenticated'] = true
    }
    if (typeof org.pdfAutoFill?.audiences?.public !== 'boolean') {
      update['pdfAutoFill.audiences.public'] = false
    }
    if (org.plan === 'custom' && typeof org.pdfAutoFill?.entitlementOverride !== 'boolean') {
      update['pdfAutoFill.entitlementOverride'] = true
    }
    if (!Object.keys(update).length) continue
    console.log('  tenant ' + org.subdomain + ': ' + Object.keys(update).join(', '))
    if (!DRY) await Organization.collection.updateOne({ _id: org._id }, { $set: update })
  }
}

run()
  .catch((error) => {
    console.error('PDF auto-fill policy migration failed:', error.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())

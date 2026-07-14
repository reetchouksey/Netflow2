// Multi-tenancy Step 1 - seeds/seedOrganization.js
// Creates the single "default" organization that all existing (pre-tenancy)
// records will be migrated into (build-order step 2). Safe + idempotent:
// re-running updates nothing destructive and never creates a duplicate.
//
// Run with:  npm run seed:org   (from /server)

require('dotenv').config()

const mongoose = require('mongoose')

const Organization = require('../models/Organization')

const DEFAULT_ORG = {
  name: 'Default Organization',
  subdomain: 'default',
  allowedDomains: [],
  features: { aiRouting: true, externalUsers: true },
  limits: { maxUsers: 0, maxWorkflows: 0 },
  status: 'active',
  isDefault: true
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

    const existing = await Organization.findOne({ isDefault: true })
    if (existing) {
      console.log(`Default organization already exists: "${existing.name}" (${existing._id})`)
    } else {
      const org = await Organization.create(DEFAULT_ORG)
      console.log(`Default organization created: "${org.name}" (${org._id})`)
    }

    console.log('')
    console.log('Next: build-order step 2 stamps every existing record with this org\'s id.')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

// Multi-tenancy build-order step 7 - seeds/seedSuperAdmin.js
// Creates the platform-level SuperAdmin role and one SuperAdmin user.
// Idempotent: safe to run multiple times.
//
// The SuperAdmin manages organizations via /api/platform/* but holds no
// org-level privileges (not an Admin, not a builder), so they have no
// default access to any tenant's business data.
//
// Usage: node seeds/seedSuperAdmin.js
// Env (optional): SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const Role = require('../models/Role')
const User = require('../models/User')
const Organization = require('../models/Organization')

const EMAIL = (process.env.SUPERADMIN_EMAIL || 'superadmin@netflow.app').toLowerCase()
const PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Super@12345'

const run = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/workflow'
  console.log('Connecting to MongoDB...')
  await mongoose.connect(uri)
  console.log(`Connected: ${mongoose.connection.name}`)

  let role = await Role.findOne({ name: 'SuperAdmin' })
  if (!role) {
    role = await Role.create({
      name: 'SuperAdmin',
      description: 'Platform super admin — manages organizations, no tenant data access',
      permissions: ['platform:manage_orgs']
    })
    console.log('SuperAdmin role created')
  } else {
    console.log('SuperAdmin role already exists')
  }

  // The SuperAdmin user lives in the default org (every user needs an org for
  // auth), but their powers come from the role, not the org.
  const defaultOrg = await Organization.findOne({ isDefault: true }).lean()
  if (!defaultOrg) {
    console.error('No default organization found — run `npm run seed:org` first.')
    process.exit(1)
  }

  const existing = await User.findOne({ email: EMAIL, orgId: defaultOrg._id })
  if (existing) {
    console.log(`SuperAdmin user already exists: ${EMAIL}`)
  } else {
    await User.create({
      orgId: defaultOrg._id,
      name: 'Platform Super Admin',
      email: EMAIL,
      password: PASSWORD,
      department: 'IT',
      role: role._id,
      isProtected: true
    })
    console.log(`SuperAdmin user created: ${EMAIL} (password: ${process.env.SUPERADMIN_PASSWORD ? 'from env' : PASSWORD})`)
  }

  await mongoose.disconnect()
  console.log('DONE')
}

run().catch((err) => {
  console.error('FAILED:', err.message)
  process.exit(1)
})

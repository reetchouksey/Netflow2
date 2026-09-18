// Upsert a Manager user for docs screenshots (no MFA).
// Usage: node scripts/seedDocsManager.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const User = require('../models/User')
const Role = require('../models/Role')
const Organization = require('../models/Organization')

const EMAIL = 'docs.manager@netlink.com'
const PASSWORD = 'Demo@12345'
const SUBDOMAIN = 'netlink'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workflow')
  const org = await Organization.findOne({ subdomain: SUBDOMAIN })
  if (!org) throw new Error(`Org "${SUBDOMAIN}" not found`)
  const role = await Role.findOne({ name: 'Manager' })
  if (!role) throw new Error('Manager role missing')

  let user = await User.findOne({ email: EMAIL, orgId: org._id }).setOptions({ skipOrgScope: true })
  if (user) {
    user.password = PASSWORD
    user.role = role._id
    user.isActive = true
    user.mfaEnabled = false
    user.mfaSecret = undefined
    user.mustChangePassword = false
    user.failedLoginAttempts = 0
    user.lockUntil = null
    await user.save()
    console.log('Updated', EMAIL)
  } else {
    await User.create({
      orgId: org._id,
      name: 'Docs Manager',
      email: EMAIL,
      password: PASSWORD,
      department: 'IT',
      role: role._id,
      isActive: true,
      mfaEnabled: false,
      mustChangePassword: false
    })
    console.log('Created', EMAIL)
  }
  console.log(`Login with ?org=${SUBDOMAIN}: ${EMAIL} / ${PASSWORD}`)
  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })

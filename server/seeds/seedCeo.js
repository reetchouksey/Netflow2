// Org - seeds/seedCeo.js
// Creates (or re-asserts) the permanent, PROTECTED CEO account that sits at the
// top of the org chart. Protected accounts cannot be edited, re-roled, or
// deactivated from the Admin Panel — only this seed can change them.
//
// Run with:  npm run seed:ceo   (from /server)
// Requires the CEO role to exist first:  npm run seed
//
// Override the defaults with env vars (optional):
//   CEO_NAME, CEO_EMAIL, CEO_PASSWORD, CEO_DEPT

require('dotenv').config()

const mongoose = require('mongoose')

const User = require('../models/User')
const Role = require('../models/Role')

const CEO_NAME = process.env.CEO_NAME || 'CEO'
const CEO_EMAIL = (process.env.CEO_EMAIL || 'ceo@netlink.com').toLowerCase().trim()
const CEO_DEPT = process.env.CEO_DEPT || 'Operations'

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
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

    const ceoRole = await Role.findOne({ name: 'CEO' }).lean()
    if (!ceoRole) {
      console.error('CEO role not found. Run `npm run seed` first to create the role catalogue.')
      process.exitCode = 1
      return
    }

    // Re-assert an existing account (idempotent) so re-running never duplicates.
    const existing = await User.findOne({ email: CEO_EMAIL })
    if (existing) {
      existing.name = CEO_NAME
      existing.role = ceoRole._id
      existing.department = existing.department || CEO_DEPT
      existing.managerId = undefined
      existing.isActive = true
      existing.isProtected = true
      if (process.env.CEO_PASSWORD) existing.password = process.env.CEO_PASSWORD
      await existing.save()

      console.log('')
      console.log(`Re-asserted protected CEO account: ${CEO_NAME} <${CEO_EMAIL}>.`)
      console.log(
        process.env.CEO_PASSWORD
          ? 'Password was reset from CEO_PASSWORD.'
          : 'Password left unchanged. (Set CEO_PASSWORD to reset it.)'
      )
      return
    }

    const password = process.env.CEO_PASSWORD || generatePassword()
    const ceo = new User({
      name: CEO_NAME,
      email: CEO_EMAIL,
      password,
      role: ceoRole._id,
      department: CEO_DEPT,
      isActive: true,
      isProtected: true
    })
    await ceo.save()

    console.log('')
    console.log('==================================================')
    console.log('  Permanent CEO account created (PROTECTED / locked)')
    console.log('==================================================')
    console.log(`  Name       : ${CEO_NAME}`)
    console.log(`  Email      : ${CEO_EMAIL}`)
    console.log(`  Password   : ${password}`)
    console.log(`  Role       : CEO`)
    console.log(`  Department : ${CEO_DEPT}`)
    console.log('--------------------------------------------------')
    console.log('  Save this password now — it is shown only once.')
    console.log('  This account cannot be edited, re-roled, or')
    console.log('  deactivated from the Admin Panel. Re-run this')
    console.log('  seed (with env overrides) to change it.')
    console.log('==================================================')
  } catch (err) {
    if (err && err.code === 11000) {
      console.error('A user with that email already exists with a different setup. Set CEO_EMAIL to a free address.')
    } else {
      console.error('CEO seed failed:', err)
    }
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

// Tenant-role bootstrap. Safe and idempotent: existing organization-owned role
// edits are preserved, while organizations without roles receive the defaults.

require('dotenv').config()

const mongoose = require('mongoose')
const Organization = require('../models/Organization')
const { ensureRolesForOrganization } = require('../utils/roleProvisioning')

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
    console.log('Connected: ' + mongoose.connection.host + '/' + mongoose.connection.name)

    const organizations = await Organization.find({}).select('_id name').lean()
    if (!organizations.length) {
      throw new Error('No organizations found. Run npm run seed:org first.')
    }

    for (const organization of organizations) {
      const roles = await ensureRolesForOrganization(organization._id, { force: true })
      console.log('Roles ready for "' + organization.name + '": ' + roles.size)
    }
    console.log('Tenant role catalogues are ready.')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

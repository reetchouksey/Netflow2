// One-time production migration for legacy globally shared roles. The helper is
// also used lazily by authentication, so rerunning this command is safe.

require('dotenv').config()

const mongoose = require('mongoose')
const Organization = require('../models/Organization')
const User = require('../models/User')
const Role = require('../models/Role')
const { ensureRoleIndexes, ensureRolesForOrganization } = require('../utils/roleProvisioning')

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4
  })

  await ensureRoleIndexes()
  const organizations = await Organization.find({}).select('_id name').lean()
  for (const organization of organizations) {
    const roles = await ensureRolesForOrganization(organization._id, { force: true })
    const roleIds = [...roles.values()].map((role) => role._id)
    const unmatched = await User.countDocuments({
      orgId: organization._id,
      role: { $nin: roleIds }
    }).setOptions({ skipOrgScope: true })
    console.log(
      organization.name + ': ' + roles.size + ' tenant roles, ' +
      unmatched + ' users without a tenant-owned role'
    )
    if (unmatched) throw new Error('Role migration verification failed for ' + organization.name)
  }
}

run()
  .then(() => console.log('Role migration complete.'))
  .catch((error) => {
    console.error('Role migration failed:', error)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())

const mongoose = require('mongoose')
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../models/Role')
const User = require('../models/User')

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI)
  const Role = mongoose.model('Role')
  const adminRoles = await Role.find({ name: { $in: ['Admin', 'SuperAdmin', 'Platform Super Admin'] } }).lean()
  const adminRoleIds = adminRoles.map((r) => r._id)

  const res = await User.updateMany(
    { $or: [{ role: { $in: adminRoleIds } }, { email: 'seeder@flowsphere.seed' }] },
    { $set: { canBuild: true } }
  )
  console.log('Successfully updated Admin users canBuild:', res)
  await mongoose.disconnect()
}

fix().catch((err) => {
  console.error(err)
  process.exit(1)
})

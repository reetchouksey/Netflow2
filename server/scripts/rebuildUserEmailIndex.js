// Multi-tenancy build-order step 3 - scripts/rebuildUserEmailIndex.js
// One-time index swap on the users collection:
//   drops the old global  unique(email)        index (email_1)
//   creates the new       unique(orgId, email) compound index
// Idempotent: safe to run multiple times.
//
// Usage: node scripts/rebuildUserEmailIndex.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const User = require('../models/User')

const run = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/workflow'
  console.log('Connecting to MongoDB...')
  await mongoose.connect(uri)
  console.log(`Connected: ${mongoose.connection.name}`)

  const col = mongoose.connection.db.collection('users')
  const indexes = await col.indexes()
  console.log('Current indexes:', indexes.map((i) => i.name).join(', '))

  const oldIndex = indexes.find((i) => i.name === 'email_1')
  if (oldIndex) {
    await col.dropIndex('email_1')
    console.log('Dropped old global unique index: email_1')
  } else {
    console.log('Old email_1 index not present (already dropped)')
  }

  // Creates unique(orgId, email) plus any other schema-declared indexes,
  // and removes indexes no longer declared on the schema.
  await User.syncIndexes()

  const after = await col.indexes()
  console.log('Indexes now:')
  for (const i of after) {
    console.log(`  ${i.name}${i.unique ? ' (unique)' : ''}: ${JSON.stringify(i.key)}`)
  }

  await mongoose.disconnect()
  console.log('DONE')
}

run().catch((err) => {
  console.error('FAILED:', err.message)
  process.exit(1)
})

// AI-01 - seeds/seedDoa.js
// Seeds a synthetic Delegation-of-Authority (DoA) matrix for #01 Approval-Routing.
//
// Run with:  npm run seed:doa   (from /server)
//
// Idempotent: rules are upserted by name, so re-running updates in place and
// never duplicates. Pair with `npm run seed:demo` to get the org chart these
// rules route against (Manager / HR / Admin across departments).

require('dotenv').config()

const mongoose = require('mongoose')
const dns = require('dns')

// Match the other seeders: force public resolvers so mongodb+srv:// works even
// when the local OS resolver refuses SRV queries. Harmless for localhost URIs.
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])

const DoA = require('../models/DelegationOfAuthority')

// Policy bands. Note several rules require a "VP" — the demo org chart has no VP,
// which is intentional: it shows the engine escalating to the nearest higher
// authority (Admin) when a required role has no holder.
const RULES = [
  {
    name: 'Expense — Standard (< $1,000)',
    description: 'Low-value expense claims need only the direct manager.',
    department: 'ANY',
    category: 'expense',
    minAmount: 0,
    maxAmount: 999.99,
    currency: 'USD',
    priority: 10,
    approverChain: [{ order: 1, role: 'Manager', slaHours: 48 }]
  },
  {
    name: 'Expense — Mid ($1,000–$9,999)',
    description: 'Mid-value expenses add a VP sign-off after the manager.',
    department: 'ANY',
    category: 'expense',
    minAmount: 1000,
    maxAmount: 9999.99,
    currency: 'USD',
    priority: 10,
    approverChain: [
      { order: 1, role: 'Manager', slaHours: 48 },
      { order: 2, role: 'VP', slaHours: 48 }
    ]
  },
  {
    name: 'Expense — High ($10,000+)',
    description: 'High-value expenses require manager, VP, then executive sign-off.',
    department: 'ANY',
    category: 'expense',
    minAmount: 10000,
    maxAmount: null,
    currency: 'USD',
    priority: 10,
    approverChain: [
      { order: 1, role: 'Manager', slaHours: 24 },
      { order: 2, role: 'VP', slaHours: 24 },
      { order: 3, role: 'Admin', slaHours: 24 }
    ]
  },
  {
    name: 'Purchase Order / SOW — Any value',
    description: 'POs and SOWs route manager then VP regardless of amount.',
    department: 'ANY',
    category: 'po',
    minAmount: 0,
    maxAmount: null,
    currency: 'USD',
    priority: 8,
    approverChain: [
      { order: 1, role: 'Manager', slaHours: 48 },
      { order: 2, role: 'VP', slaHours: 48 }
    ]
  },
  {
    name: 'Leave — Any',
    description: 'Leave is approved by the manager, then confirmed by HR.',
    department: 'ANY',
    category: 'leave',
    minAmount: 0,
    maxAmount: null,
    currency: 'USD',
    priority: 8,
    approverChain: [
      { order: 1, role: 'Manager', slaHours: 48 },
      { order: 2, role: 'HR', slaHours: 48 }
    ]
  },
  {
    name: 'Default — Single manager approval',
    description: 'Catch-all when no specific DoA rule matches.',
    department: 'ANY',
    category: 'ANY',
    minAmount: 0,
    maxAmount: null,
    currency: 'USD',
    priority: -1,
    approverChain: [{ order: 1, role: 'Manager', slaHours: 48 }]
  }
]

const upsertRules = async () => {
  let created = 0
  let updated = 0
  for (const r of RULES) {
    const result = await DoA.findOneAndUpdate(
      { name: r.name },
      { $set: r },
      { new: true, upsert: true, setDefaultsOnInsert: true, rawResult: true, runValidators: true }
    )
    if (result?.lastErrorObject?.upserted) created++
    else updated++
  }
  console.log(`DoA matrix ready: ${created} created, ${updated} updated (${RULES.length} total).`)
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
    console.log('')

    await upsertRules()

    console.log('')
    console.log('Done. Tip: run `npm run seed:demo` to create the org chart these')
    console.log('rules route against, then POST /api/approval-routing/infer to preview a chain.')
  } catch (err) {
    console.error('seed:doa failed:', err.message || err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

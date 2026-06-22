// Shared - seeds/seed.js
// Roles-only bootstrap. Safe + idempotent: re-running never deletes anything
// and never creates users, forms, or workflows. Those are entered by real
// people through the app's Admin Panel / Form Designer / Workflow Builder.
//
// Run with:  npm run seed   (from /server)
//
// First user who registers via the UI is auto-promoted to Admin (see
// routes/auth.js), so this is all the seeding the app needs.

require('dotenv').config()

const mongoose = require('mongoose')

const Role = require('../models/Role')

const ROLES = [
  {
    name: 'Admin',
    description: 'Full system access. Manages users, forms, workflows, and is the top approval/escalation authority.',
    permissions: ['*']
  },
  {
    name: 'Manager',
    description: 'Builds forms and workflows; approves tasks for their team.',
    permissions: [
      'forms:read', 'forms:write',
      'workflows:read', 'workflows:write',
      'tasks:read', 'tasks:approve',
      'analytics:read'
    ]
  },
  {
    name: 'HR',
    description: 'Owns people processes. Builds HR forms/workflows and approves people-related tasks.',
    permissions: [
      'forms:read', 'forms:write',
      'workflows:read', 'workflows:write',
      'tasks:read', 'tasks:approve',
      'users:read',
      'analytics:read'
    ]
  },
  {
    name: 'CEO',
    description: 'Chief Executive Officer. Top of the approval hierarchy — VPs, AVPs and managers report up to this role. Final sign-off on high-value requests.',
    permissions: [
      'forms:read', 'forms:write',
      'workflows:read', 'workflows:write',
      'tasks:read', 'tasks:approve',
      'users:read',
      'analytics:read'
    ]
  },
  {
    name: 'VP',
    description: 'Senior approver. Reviews high-impact requests and sees org-wide analytics.',
    permissions: [
      'forms:read', 'forms:write',
      'workflows:read', 'workflows:write',
      'tasks:read', 'tasks:approve',
      'analytics:read'
    ]
  },
  {
    name: 'Employee',
    description: 'Submits forms and acts on assigned tasks.',
    permissions: [
      'forms:read', 'forms:submit',
      'tasks:read', 'tasks:act'
    ]
  },
  {
    name: 'Viewer',
    description: 'Read-only access to forms and own tasks.',
    permissions: ['forms:read', 'tasks:read']
  },
  {
    name: 'Receiving Staff',
    description: 'Logs incoming goods and fills the costing form.',
    permissions: ['forms:read', 'forms:submit', 'tasks:read', 'tasks:act']
  },
  {
    name: 'Warehouse Manager',
    description: 'Reviews and approves costing entries from floor staff.',
    permissions: ['forms:read', 'tasks:read', 'tasks:approve']
  },
  {
    name: 'Accounts Officer',
    description: 'Validates cost figures and attaches invoice proof.',
    permissions: ['forms:read', 'tasks:read', 'tasks:approve']
  },
  {
    name: 'Brand Rep',
    description: 'Confirms brand-level pricing and authorises spend.',
    permissions: ['forms:read', 'tasks:read', 'tasks:approve']
  },
  {
    name: 'Finance Approver',
    description: 'Final financial sign-off on costing submissions.',
    permissions: ['forms:read', 'tasks:read', 'tasks:approve', 'analytics:read']
  }
]

const upsertRoles = async () => {
  let created = 0
  let updated = 0
  for (const r of ROLES) {
    const result = await Role.findOneAndUpdate(
      { name: r.name },
      { $set: { description: r.description, permissions: r.permissions } },
      { new: true, upsert: true, setDefaultsOnInsert: true, rawResult: true }
    )
    if (result?.lastErrorObject?.upserted) created++
    else updated++
  }
  console.log(`Roles ready: ${created} created, ${updated} updated.`)
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

    await upsertRoles()

    console.log('')
    console.log('Done. The first user to sign up at /register will be promoted to Admin.')
    console.log('Open the app, register an account, then invite the rest of your team')
    console.log('from the Admin Panel.')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

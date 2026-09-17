// Shared - seeds/seed.js
// Roles-only bootstrap. Safe + idempotent: re-running never touches users,
// forms or workflows — those are entered by real people through the app's Admin
// Panel / Form Designer / Workflow Builder. The one thing it does remove is a
// retired role that nobody holds (see RETIRED below).
//
// Run with:  npm run seed   (from /server)
//
// First user who registers via the UI is auto-promoted to Admin (see
// routes/auth.js), so this is all the seeding the app needs.

require('dotenv').config()

const mongoose = require('mongoose')

const Role = require('../models/Role')
const User = require('../models/User')

const ROLES = [
  {
    name: 'Admin',
    description: 'Full system access. Manages users, forms, workflows, and is the top approval/escalation authority.',
    permissions: ['*']
  },
  {
    name: 'Manager',
    description: 'Approves requests from their team and reads reports. Does not build forms or workflows.',
    permissions: [
      'forms:read', 'forms:submit',
      'workflows:read',
      'tasks:read', 'tasks:approve',
      'analytics:read'
    ]
  },
  {
    name: 'HR',
    description: 'Owns people processes: approves people-related requests and reads reports.',
    permissions: [
      'forms:read', 'forms:submit',
      'workflows:read',
      'tasks:read', 'tasks:approve',
      'users:read',
      'analytics:read'
    ]
  },
  {
    name: 'CEO',
    description: 'Chief Executive Officer. Top of the approval hierarchy — VPs, AVPs and managers report up to this role. Final sign-off on high-value requests.',
    permissions: [
      'forms:read', 'forms:submit',
      'workflows:read',
      'tasks:read', 'tasks:approve',
      'users:read',
      'analytics:read'
    ]
  },
  {
    name: 'VP',
    description: 'Senior approver. Reviews high-impact requests and sees org-wide analytics.',
    permissions: [
      'forms:read', 'forms:submit',
      'workflows:read',
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
  { name: 'Accountant', description: 'Workspace role.', permissions: [] },
  { name: 'Hardware Technician', description: 'Workspace role.', permissions: [] },
  { name: 'Helpdesk Agent', description: 'Workspace role.', permissions: [] },
  { name: 'IT Administrator', description: 'Workspace role.', permissions: [] },
  { name: 'IT Manager', description: 'Workspace role.', permissions: [] },
  { name: 'Lab / Department head', description: 'Workspace role.', permissions: [] },
  { name: 'Network Engineer', description: 'Workspace role.', permissions: [] },
  { name: 'QA', description: 'Workspace role.', permissions: [] },
  { name: 'Software Engineer / Support', description: 'Workspace role.', permissions: [] },
  { name: 'Viewer', description: 'Read-only.', permissions: [] }
]

// Roles this catalogue used to carry. Every one of them promised something the
// API never honoured — Viewer had no shell of its own, and the pilot roles were
// written for one customer's costing flow with permissions no guard reads, so
// "Receiving Staff" could not actually submit the form it existed for. They are
// swept below rather than silently left behind in the catalogue.
const RETIRED = [
  'Receiving Staff', 'Warehouse Manager', 'Accounts Officer',
  'Brand Rep', 'Finance Approver'
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

// Removes a retired role only once nobody holds it. A role with people in it is
// left alone and reported: reassigning somebody is a decision for the admin who
// knows what they do, not for a seed script.
const sweepRetiredRoles = async () => {
  const stale = await Role.find({ name: { $in: RETIRED } }).select('name').lean()
  if (!stale.length) return

  for (const role of stale) {
    const holders = await User.countDocuments({ role: role._id }).setOptions({ skipOrgScope: true })
    if (holders) {
      console.log(`Kept "${role.name}": still assigned to ${holders} ${holders === 1 ? 'person' : 'people'} — move them to Employee first.`)
      continue
    }
    await Role.deleteOne({ _id: role._id })
    console.log(`Retired "${role.name}".`)
  }
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
    await sweepRetiredRoles()

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

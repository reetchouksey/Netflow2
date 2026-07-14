// Multi-tenancy build-order step 6 - tests/isolation.test.js
// Tenant-isolation test suite. Seeds TWO organizations (iso-a / iso-b), each
// with a Manager user, a form, a workflow, a task, a notification and an
// audit-log entry — then asserts, over the live API and at the model layer,
// that org A can never read or mutate org B's data (and vice versa).
//
// Requirements: the server must be running on localhost:5000 (npm run dev)
// and the Manager role must exist (npm run seed).
//
// Usage: npm run test:isolation
// The suite is idempotent: it wipes and re-creates its own test data, and
// cleans up after itself. It never touches other organizations' data.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const Organization = require('../models/Organization')
const User = require('../models/User')
const Role = require('../models/Role')
const Form = require('../models/Form')
const Workflow = require('../models/Workflow')
const WorkflowExecution = require('../models/WorkflowExecution')
const Task = require('../models/Task')
const Notification = require('../models/Notification')
const AuditLog = require('../models/AuditLog')
const FormResponse = require('../models/FormResponse')
const { runWithOrgId } = require('../tenancy/tenantContext')

const API = process.env.TEST_API_URL || 'http://localhost:5000/api'
const PASSWORD = 'Iso@12345'

// ── tiny test harness ────────────────────────────────────────────────────────
let passed = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
const api = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  let json = null
  try { json = await res.json() } catch { /* non-JSON body */ }
  return { status: res.status, body: json }
}

const login = async (email) => {
  const r = await api('POST', '/auth/login', null, { email, password: PASSWORD })
  if (!r.body?.token) throw new Error(`login failed for ${email}: ${JSON.stringify(r.body)}`)
  return r.body.token
}

// ── seed / cleanup ───────────────────────────────────────────────────────────
const SUBDOMAINS = ['iso-a', 'iso-b']

const wipeTestOrgs = async () => {
  const orgs = await Organization.find({ subdomain: { $in: SUBDOMAINS } }).lean()
  if (!orgs.length) return
  const orgIds = orgs.map((o) => o._id)
  const byOrg = { orgId: { $in: orgIds } }
  await Promise.all([
    User.deleteMany(byOrg),
    Form.deleteMany(byOrg),
    Workflow.deleteMany(byOrg),
    WorkflowExecution.deleteMany(byOrg),
    Task.deleteMany(byOrg),
    Notification.deleteMany(byOrg),
    AuditLog.deleteMany(byOrg),
    FormResponse.deleteMany(byOrg)
  ])
  await Organization.deleteMany({ _id: { $in: orgIds } })
}

// Creates one org with a Manager user + form + workflow + task +
// notification + audit log. Everything created INSIDE that org's tenant
// context, which also exercises create-stamping end to end.
const seedOrg = async (subdomain, managerRoleId) => {
  const org = await Organization.create({ name: `Isolation ${subdomain}`, subdomain })

  return runWithOrgId(org._id, async () => {
    const manager = await User.create({
      name: `Manager ${subdomain}`,
      email: `manager@${subdomain}.test`,
      password: PASSWORD,
      department: 'IT',
      role: managerRoleId
    })
    const form = await Form.create({
      title: `Secret form of ${subdomain}`,
      status: 'published',
      createdBy: manager._id,
      fields: [{ id: 'f1', type: 'text', label: 'Field 1' }]
    })
    const workflow = await Workflow.create({
      title: `Secret workflow of ${subdomain}`,
      createdBy: manager._id,
      status: 'draft',
      nodes: []
    })
    const task = await Task.create({
      title: `Secret task of ${subdomain}`,
      type: 'IT',
      status: 'pending',
      assignedTo: manager._id,
      submittedBy: manager._id
    })
    const notification = await Notification.create({
      userId: manager._id,
      title: `Secret notification of ${subdomain}`,
      message: 'internal',
      type: 'assignment'
    })
    const audit = await AuditLog.create({
      action: 'user_updated',
      performedBy: manager._id,
      targetEntity: `Secret audit of ${subdomain}`
    })

    // Sanity: everything created in context must carry the org's id.
    for (const [label, doc] of [['user', manager], ['form', form], ['workflow', workflow], ['task', task], ['notification', notification], ['audit', audit]]) {
      if (String(doc.orgId) !== String(org._id)) {
        throw new Error(`Seed error: ${label} of ${subdomain} not stamped with orgId`)
      }
    }

    return { org, manager, form, workflow, task, notification, audit }
  })
}

// ── API-level assertions for one direction (me → other) ─────────────────────
const runApiChecks = async (label, me, other) => {
  console.log(`\n${label}`)
  const token = await login(me.manager.email)

  // Reads: lists must contain mine and never the other org's.
  const users = await api('GET', '/users', token)
  const userEmails = (users.body?.users || []).map((u) => u.email)
  check('users list contains own user', userEmails.includes(me.manager.email))
  check('users list hides other org user', !userEmails.includes(other.manager.email))

  const forms = await api('GET', '/forms', token)
  const formIds = (forms.body?.forms || []).map((f) => String(f._id))
  check('forms list contains own form', formIds.includes(String(me.form._id)))
  check('forms list hides other org form', !formIds.includes(String(other.form._id)))

  const wfs = await api('GET', '/workflows', token)
  const wfIds = (wfs.body?.workflows || []).map((w) => String(w._id))
  check('workflows list contains own workflow', wfIds.includes(String(me.workflow._id)))
  check('workflows list hides other org workflow', !wfIds.includes(String(other.workflow._id)))

  const tasks = await api('GET', '/tasks/my-tasks', token)
  const taskIds = (tasks.body?.tasks || []).map((t) => String(t._id))
  check('my-tasks contains own task', taskIds.includes(String(me.task._id)))
  check('my-tasks hides other org task', !taskIds.includes(String(other.task._id)))

  const notifs = await api('GET', '/notifications', token)
  const notifTitles = JSON.stringify(notifs.body || {})
  check('notifications contain own item', notifTitles.includes(`Secret notification of ${me.org.subdomain}`))
  check('notifications hide other org item', !notifTitles.includes(`Secret notification of ${other.org.subdomain}`))

  const audits = await api('GET', '/audit-logs?limit=200', token)
  const auditBlob = JSON.stringify(audits.body || {})
  check('audit logs contain own entry', auditBlob.includes(`Secret audit of ${me.org.subdomain}`))
  check('audit logs hide other org entry', !auditBlob.includes(`Secret audit of ${other.org.subdomain}`))

  // Analytics: counters must reflect ONLY this org (each org has exactly 1
  // form / 1 workflow / 1 pending task).
  const summary = await api('GET', '/analytics/summary', token)
  const s = summary.body?.summary || {}
  check('analytics scoped: totalForms = 1', s.totalForms === 1, `got ${s.totalForms}`)
  check('analytics scoped: totalWorkflows = 1', s.totalWorkflows === 1, `got ${s.totalWorkflows}`)
  check('analytics scoped: pendingTasks = 1', s.pendingTasks === 1, `got ${s.pendingTasks}`)

  // Cross-org reads by id must 404.
  check('GET other org form by id -> 404', (await api('GET', `/forms/${other.form._id}`, token)).status === 404)
  check('GET other org workflow by id -> 404', (await api('GET', `/workflows/${other.workflow._id}`, token)).status === 404)
  check('GET other org task by id -> 404', (await api('GET', `/tasks/${other.task._id}`, token)).status === 404)
  check('GET other org user by id -> 404', (await api('GET', `/users/${other.manager._id}`, token)).status === 404)

  // Cross-org mutations must fail AND leave the target untouched.
  const put = await api('PUT', `/forms/${other.form._id}`, token, { title: 'HACKED' })
  check('PUT other org form -> 404', put.status === 404)
  const del = await api('DELETE', `/forms/${other.form._id}`, token)
  check('DELETE other org form -> 404', del.status === 404)
  const approve = await api('POST', `/tasks/${other.task._id}/approve`, token, { comment: 'x' })
  check('APPROVE other org task -> 404', approve.status === 404)
  const wfDel = await api('DELETE', `/workflows/${other.workflow._id}`, token)
  check('DELETE other org workflow -> 404', wfDel.status === 404)

  const otherFormNow = await Form.findById(other.form._id).lean()
  check('other org form untouched', otherFormNow && otherFormNow.title === `Secret form of ${other.org.subdomain}`)
  const otherTaskNow = await Task.findById(other.task._id).lean()
  check('other org task still pending', otherTaskNow && otherTaskNow.status === 'pending')
}

// ── model-level assertions (plugin behaviour, no HTTP) ───────────────────────
const runModelChecks = async (a, b) => {
  console.log('\nModel-level scoping (org A context)')

  const crossRead = await runWithOrgId(a.org._id, async () => await Form.findById(b.form._id).lean())
  check('findById across orgs returns null', crossRead === null)

  const count = await runWithOrgId(a.org._id, async () => await User.countDocuments({}))
  check('countDocuments sees only own org users', count === 1, `got ${count}`)

  const upd = await runWithOrgId(a.org._id, async () =>
    await Task.updateMany({}, { $set: { escalationLevel: 0 } })
  )
  check('updateMany({}) touches only own org', upd.matchedCount === 1, `matched ${upd.matchedCount}`)

  const delRes = await runWithOrgId(a.org._id, async () =>
    await Notification.deleteMany({ title: `Secret notification of ${b.org.subdomain}` })
  )
  check('deleteMany cannot reach other org docs', delRes.deletedCount === 0, `deleted ${delRes.deletedCount}`)

  const agg = await runWithOrgId(a.org._id, async () =>
    await Task.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }])
  )
  check('aggregate auto-scoped to own org', (agg[0]?.n || 0) === 1, `got ${agg[0]?.n}`)

  const escape = await runWithOrgId(a.org._id, async () =>
    await Form.findById(b.form._id).setOptions({ skipOrgScope: true }).lean()
  )
  check('skipOrgScope escape hatch still works', escape !== null)
}

// ── main ─────────────────────────────────────────────────────────────────────
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected. Seeding two isolated test orgs...')

  const managerRole = await Role.findOne({ name: 'Manager' }).lean()
  if (!managerRole) throw new Error('Manager role missing — run `npm run seed` first')

  await wipeTestOrgs()
  const a = await seedOrg('iso-a', managerRole._id)
  const b = await seedOrg('iso-b', managerRole._id)

  await runApiChecks('Org A must not see org B', a, b)
  await runApiChecks('Org B must not see org A', b, a)
  await runModelChecks(a, b)

  await wipeTestOrgs()
  console.log('\nCleanup done')

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  await mongoose.disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(async (e) => {
  console.error('SUITE ERROR:', e.message)
  try { await wipeTestOrgs(); await mongoose.disconnect() } catch { /* best effort */ }
  process.exit(1)
})

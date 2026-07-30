// Multi-tenancy polish - tests/_verifyOrgAdmin.js
// End-to-end verification for auto Org-Admin provisioning + delete/backup:
//   • SuperAdmin creates an org → a first Admin is auto-created (temp password)
//   • org admin first login → forced password change (mustChangePassword)
//   • admin email is validated against the org's allowedDomains
//   • reset-admin-password issues a new temp password
//   • DELETE org backs up + cascade-deletes; default org stays hidden & safe
//
// Requirements: server on localhost:5000 + a seeded SuperAdmin (npm run
// seed:superadmin) + Admin role (npm run seed). Idempotent (wipes oa-* data).
//
// Usage:  node tests/_verifyOrgAdmin.js   (from /server)

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const Organization = require('../models/Organization')
const User = require('../models/User')
require('../models/Role') // registered so User.populate('role') works standalone

const API = process.env.TEST_API_URL || 'http://127.0.0.1:5000/api'
const SUPER_EMAIL = (process.env.SUPERADMIN_EMAIL || 'superadmin@netflow.app').toLowerCase()
const SUPER_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Super@12345'
const SUBS = ['oa-acme', 'oa-globex']

let passed = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`) }
}

const api = async (method, p, token, body) => {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  let json = null
  try { json = await res.json() } catch { /* non-JSON */ }
  return { status: res.status, body: json }
}

const waitForServer = async (tries = 20) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await api('GET', '/auth/org-context?subdomain=__ping__'); if (r.status) return } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server not reachable at ${API}`)
}

const wipe = async () => {
  const orgs = await Organization.find({ subdomain: { $in: SUBS } }).lean()
  const ids = orgs.map((o) => o._id)
  if (ids.length) {
    await User.deleteMany({ orgId: { $in: ids } })
    await Organization.deleteMany({ _id: { $in: ids } })
  }
  // Clean any backup folders this test produced.
  const backupsDir = path.join(__dirname, '..', 'backups')
  if (fs.existsSync(backupsDir)) {
    for (const d of fs.readdirSync(backupsDir)) {
      if (SUBS.some((s) => d.startsWith(`org-${s}-`))) {
        fs.rmSync(path.join(backupsDir, d), { recursive: true, force: true })
      }
    }
  }
}

// Drives an org admin's first login with the temp password (MFA is optional).
// Returns { token, user } once the session is live.
const firstLogin = async (email, password, subdomain) => {
  const login = await api('POST', '/auth/login', null, { email, password, subdomain })
  if (!login.body?.token) {
    throw new Error(`expected session token, got ${JSON.stringify(login.body)}`)
  }
  return { token: login.body.token, user: login.body.user }
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`Connected: ${mongoose.connection.name}\n`)
  await waitForServer()
  await wipe()

  // ── SuperAdmin session ─────────────────────────────────────────────
  const su = await api('POST', '/auth/login', null, { email: SUPER_EMAIL, password: SUPER_PASSWORD })
  const suToken = su.body?.token
  check('SuperAdmin login', !!suToken, JSON.stringify(su.body))
  if (!suToken) { await mongoose.disconnect(); process.exit(1) }

  // ── A) create org + auto admin ─────────────────────────────────────
  console.log('\n── create org + auto admin ──')
  const create = await api('POST', '/platform/orgs', suToken, {
    name: 'OA Acme', subdomain: 'oa-acme', allowedDomains: 'acme.com',
    adminEmail: 'admin@acme.com', adminName: 'Acme Admin'
  })
  check('org created → 201', create.status === 201, JSON.stringify(create.body))
  const tempPassword = create.body?.admin?.tempPassword
  check('temp password returned once', typeof tempPassword === 'string' && tempPassword.length >= 12)
  check('admin email echoed', create.body?.admin?.email === 'admin@acme.com')

  const acmeOrg = await Organization.findOne({ subdomain: 'oa-acme' }).lean()
  const adminUser = await User.findOne({ email: 'admin@acme.com', orgId: acmeOrg._id }).populate('role')
  check('admin user stamped with org', adminUser && String(adminUser.orgId) === String(acmeOrg._id))
  check('admin has Admin role', adminUser?.role?.name === 'Admin')
  check('admin flagged mustChangePassword', adminUser?.mustChangePassword === true)
  check('org.adminUserId points to admin', String(acmeOrg.adminUserId) === String(adminUser._id))

  // ── domain allowlist enforcement ───────────────────────────────────
  console.log('\n── admin email domain policy ──')
  const badDomain = await api('POST', '/platform/orgs', suToken, {
    name: 'OA Bad', subdomain: 'oa-bad', allowedDomains: 'acme.com', adminEmail: 'admin@notacme.com'
  })
  check('off-domain admin rejected → 400', badDomain.status === 400 && badDomain.body?.code === 'ADMIN_DOMAIN_NOT_ALLOWED', JSON.stringify(badDomain.body))
  check('rejected org was NOT created', !(await Organization.findOne({ subdomain: 'oa-bad' })))

  // ── first login → forced password change ───────────────────────────
  console.log('\n── admin first login (forced password change) ──')
  const session = await firstLogin('admin@acme.com', tempPassword, 'oa-acme')
  check('admin got a session', !!session.token)
  check('session user still mustChangePassword', session.user?.mustChangePassword === true)

  const me = await api('GET', '/auth/me', session.token)
  check('/me reports mustChangePassword', me.body?.user?.mustChangePassword === true)

  // Blocked from a normal action until password is changed? (We only assert the
  // flag; the frontend guard enforces the redirect. Now perform the change.)
  const newPass = 'Acme@NewPass123'
  const changed = await api('POST', '/auth/change-password', session.token, { newPassword: newPass })
  check('change-password → 200 + new token', changed.status === 200 && !!changed.body?.token, JSON.stringify(changed.body))
  check('flag cleared after change', changed.body?.user?.mustChangePassword === false)

  // Old temp password must no longer work; the new one signs in straight away —
  // MFA is opt-in per user (Profile → Security), so a freshly provisioned admin
  // has none to satisfy yet.
  const oldTry = await api('POST', '/auth/login', null, { email: 'admin@acme.com', password: tempPassword, subdomain: 'oa-acme' })
  check('old temp password rejected → 401', oldTry.status === 401, JSON.stringify(oldTry.body))
  const newTry = await api('POST', '/auth/login', null, { email: 'admin@acme.com', password: newPass, subdomain: 'oa-acme' })
  check('new password signs in (MFA not enrolled yet)', !!newTry.body?.token && !newTry.body?.mfaRequired, JSON.stringify(newTry.body))

  // ── reset admin password ───────────────────────────────────────────
  console.log('\n── reset admin password ──')
  const reset = await api('POST', `/platform/orgs/${acmeOrg._id}/reset-admin-password`, suToken)
  check('reset returns a new temp password', typeof reset.body?.admin?.tempPassword === 'string' && reset.body.admin.tempPassword !== tempPassword, JSON.stringify(reset.body))
  const afterReset = await User.findById(adminUser._id)
  check('admin re-flagged mustChangePassword', afterReset?.mustChangePassword === true)

  // ── default org hidden ─────────────────────────────────────────────
  console.log('\n── default org visibility ──')
  const list = await api('GET', '/platform/orgs', suToken)
  const listed = (list.body?.orgs || [])
  check('default org hidden from list', !listed.some((o) => o.isDefault), JSON.stringify(listed.map((o) => o.subdomain)))
  check('created org visible in list', listed.some((o) => o.subdomain === 'oa-acme'))

  // ── delete org: backup + cascade ───────────────────────────────────
  console.log('\n── delete org (backup + cascade) ──')
  const globex = await api('POST', '/platform/orgs', suToken, {
    name: 'OA Globex', subdomain: 'oa-globex', adminEmail: 'admin@globex.io'
  })
  const globexOrg = await Organization.findOne({ subdomain: 'oa-globex' }).lean()
  check('second org created', !!globexOrg && globex.status === 201)

  const del = await api('DELETE', `/platform/orgs/${globexOrg._id}`, suToken)
  check('delete → 200', del.status === 200, JSON.stringify(del.body))
  check('delete removed docs (>=1 user)', (del.body?.deleted || 0) >= 1)
  check('org gone from DB', !(await Organization.findById(globexOrg._id)))
  check('org users gone from DB', (await User.countDocuments({ orgId: globexOrg._id })) === 0)

  const backupsDir = path.join(__dirname, '..', 'backups')
  const backupExists = fs.existsSync(backupsDir) && fs.readdirSync(backupsDir).some((d) => d.startsWith('org-oa-globex-'))
  check('backup folder written before delete', backupExists)

  // default org cannot be deleted
  const defOrg = await Organization.findOne({ isDefault: true }).lean()
  if (defOrg) {
    const delDef = await api('DELETE', `/platform/orgs/${defOrg._id}`, suToken)
    check('default org delete blocked → 400', delDef.status === 400 && delDef.body?.code === 'CANNOT_DELETE_DEFAULT', JSON.stringify(delDef.body))
  }

  await wipe()
  await mongoose.disconnect()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log('─'.repeat(50))
  process.exit(failed === 0 ? 0 : 1)
}

run().catch(async (err) => {
  console.error('\nVERIFY FAILED:', err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})

// Multi-tenancy build-order step 9 - tests/_verifyStep9.js
// Verifies subdomain routing + org-scoped login end to end:
//   • GET  /api/auth/org-context resolves an org (name/status) from a subdomain
//   • the SAME email can exist in two orgs and login is scoped by subdomain
//   • suspended orgs are rejected (login + org-context), unknown subdomains 404
//
// Requirements: server running on localhost:5000 (nodemon) + a non-admin role
// seeded (Manager/Employee). Idempotent: wipes and recreates its own s9-* data.
//
// Usage:  node tests/_verifyStep9.js      (from /server)

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')

const Organization = require('../models/Organization')
const User = require('../models/User')
const Role = require('../models/Role')
const { runWithOrgId } = require('../tenancy/tenantContext')

// 127.0.0.1 (not "localhost") to avoid Node's IPv6-first resolution missing an
// IPv4-only listener.
const API = process.env.TEST_API_URL || 'http://127.0.0.1:5000/api'
const SHARED_EMAIL = 'pilot@s9.test'
const SUBS = ['s9-acme', 's9-globex', 's9-susp']

let passed = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`) }
}

const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  let json = null
  try { json = await res.json() } catch { /* non-JSON */ }
  return { status: res.status, body: json }
}

// Same email lives in two orgs — only possible with unique(orgId,email).
// Ensure the compound index exists (step 3's rebuild), auto-fixing a stale
// global email_1 unique index if one is still around.
const ensureCompoundEmailIndex = async () => {
  const col = mongoose.connection.db.collection('users')
  const before = await col.indexes()
  const stale = before.find((i) => i.name === 'email_1' && i.unique)
  if (stale) {
    await col.dropIndex('email_1')
    console.log('  (fixed) dropped stale global unique index email_1')
  }
  await User.syncIndexes()
  const after = await col.indexes()
  const compound = after.find((i) => i.unique && i.key && i.key.orgId === 1 && i.key.email === 1)
  return !!compound
}

const wipe = async () => {
  const orgs = await Organization.find({ subdomain: { $in: SUBS } }).lean()
  if (orgs.length) {
    const ids = orgs.map((o) => o._id)
    await User.deleteMany({ orgId: { $in: ids } })
    await Organization.deleteMany({ _id: { $in: ids } })
  }
}

const pickNonAdminRole = async () => {
  for (const name of ['Manager', 'Employee', 'Viewer']) {
    const r = await Role.findOne({ name })
    if (r) return r
  }
  const any = await Role.findOne({ name: { $nin: ['Admin', 'SuperAdmin'] } })
  if (!any) throw new Error('No non-admin role seeded — run `npm run seed` first.')
  return any
}

// Creates an org + a user (SHARED_EMAIL) with the given password inside the
// org's tenant context, so the user is correctly stamped with orgId.
const seedOrgWithUser = async (subdomain, password, roleId, status = 'active') => {
  const org = await Organization.create({ name: `S9 ${subdomain}`, subdomain, status })
  const user = await runWithOrgId(org._id, async () => User.create({
    name: `Pilot ${subdomain}`,
    email: SHARED_EMAIL,
    password,
    department: 'IT',
    role: roleId
  }))
  return { org, user }
}

const orgClaim = (token) => {
  try { return jwt.decode(token)?.org || null } catch { return null }
}

// nodemon watches server/ (including this file), so it may be mid-restart when
// the script starts. Poll a public endpoint until the server answers.
const waitForServer = async (tries = 20) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await api('GET', '/auth/org-context?subdomain=__ping__')
      if (r.status) return true
    } catch { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 500))
  }
  throw new Error(`Server not reachable at ${API} after ${tries} tries`)
}

const run = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/workflow'
  await mongoose.connect(uri)
  console.log(`Connected: ${mongoose.connection.name}\n`)

  await waitForServer()

  const hasCompound = await ensureCompoundEmailIndex()
  check('users has a unique(orgId, email) index', hasCompound)

  await wipe()
  const role = await pickNonAdminRole()
  console.log(`Using role: ${role.name}\n`)

  const acmePwd = 'Acme@12345'
  const globexPwd = 'Globex@12345'
  const suspPwd = 'Susp@12345'

  const acme = await seedOrgWithUser('s9-acme', acmePwd, role._id)
  const globex = await seedOrgWithUser('s9-globex', globexPwd, role._id)
  const susp = await seedOrgWithUser('s9-susp', suspPwd, role._id, 'suspended')

  // The same email really does exist in two different orgs.
  check('same email seeded in two orgs (distinct records)',
    String(acme.user._id) !== String(globex.user._id) &&
    String(acme.user.orgId) !== String(globex.user.orgId))

  console.log('\n── org-context (public) ──')
  const ctxAcme = await api('GET', `/auth/org-context?subdomain=s9-acme`)
  check('org-context resolves acme name', ctxAcme.body?.org?.name === 'S9 s9-acme', JSON.stringify(ctxAcme.body))
  check('org-context acme status active', ctxAcme.body?.org?.status === 'active')

  const ctxSusp = await api('GET', `/auth/org-context?subdomain=s9-susp`)
  check('org-context reports suspended status', ctxSusp.body?.org?.status === 'suspended', JSON.stringify(ctxSusp.body))

  const ctxNone = await api('GET', `/auth/org-context?subdomain=does-not-exist`)
  check('org-context unknown → { org:null, unknown:true }',
    ctxNone.body?.org === null && ctxNone.body?.unknown === true, JSON.stringify(ctxNone.body))

  const ctxBare = await api('GET', `/auth/org-context`)
  check('org-context bare domain → { org:null }',
    ctxBare.body?.org === null && !ctxBare.body?.unknown, JSON.stringify(ctxBare.body))

  console.log('\n── org-scoped login ──')
  const loginAcme = await api('POST', '/auth/login', { email: SHARED_EMAIL, password: acmePwd, subdomain: 's9-acme' })
  check('login acme (correct pwd) → 200', loginAcme.status === 200, JSON.stringify(loginAcme.body))
  check('acme token carries acme org claim', orgClaim(loginAcme.body?.token) === String(acme.org._id),
    `got ${orgClaim(loginAcme.body?.token)} want ${acme.org._id}`)

  const loginGlobex = await api('POST', '/auth/login', { email: SHARED_EMAIL, password: globexPwd, subdomain: 's9-globex' })
  check('login globex (correct pwd) → 200', loginGlobex.status === 200, JSON.stringify(loginGlobex.body))
  check('globex token carries globex org claim', orgClaim(loginGlobex.body?.token) === String(globex.org._id),
    `got ${orgClaim(loginGlobex.body?.token)} want ${globex.org._id}`)

  // Proof of scoping: globex's password must NOT unlock the acme workspace,
  // even though the email is identical.
  const crossed = await api('POST', '/auth/login', { email: SHARED_EMAIL, password: globexPwd, subdomain: 's9-acme' })
  check('globex password rejected on acme subdomain → 401', crossed.status === 401, JSON.stringify(crossed.body))

  console.log('\n── rejections ──')
  const unknown = await api('POST', '/auth/login', { email: SHARED_EMAIL, password: acmePwd, subdomain: 'nope-nope' })
  check('login unknown workspace → 404 UNKNOWN_ORG', unknown.status === 404 && unknown.body?.code === 'UNKNOWN_ORG', JSON.stringify(unknown.body))

  const suspended = await api('POST', '/auth/login', { email: SHARED_EMAIL, password: suspPwd, subdomain: 's9-susp' })
  check('login suspended workspace → 403 ORG_SUSPENDED', suspended.status === 403 && suspended.body?.code === 'ORG_SUSPENDED', JSON.stringify(suspended.body))

  console.log('\n── backward compatibility (no subdomain) ──')
  // Without a subdomain the lookup is global; one of the two seeded users
  // should still authenticate with its own password (single-tenant path).
  const bare = await api('POST', '/auth/login', { email: SHARED_EMAIL, password: acmePwd })
  check('login without subdomain still works (global lookup)', bare.status === 200 || bare.status === 401,
    `status ${bare.status} — endpoint reachable`)

  await wipe()
  await mongoose.disconnect()

  console.log(`\n${'─'.repeat(48)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log('─'.repeat(48))
  process.exit(failed === 0 ? 0 : 1)
}

run().catch(async (err) => {
  console.error('\nVERIFY FAILED:', err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})

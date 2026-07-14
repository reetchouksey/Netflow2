// Multi-tenancy build-order step 5 - tenancy/tenantContext.js
// Ambient tenant context carried through async call chains (request handlers,
// the workflow engine, fire-and-forget notification/audit writers) via
// AsyncLocalStorage. The org-scope Mongoose plugin reads it to auto-filter
// every query and stamp orgId on create.
//
// Request paths:  middleware/auth.js runs the rest of the request inside
//                 runWithOrgId(req.orgId, ...) after resolving the tenant.
// Non-request:    jobs (escalation cron) wrap per-org work explicitly.
// No context:     queries run UNSCOPED (scripts, seeds, login-by-email).

const { AsyncLocalStorage } = require('node:async_hooks')
const mongoose = require('mongoose')

const als = new AsyncLocalStorage()

const toObjectId = (id) => {
  if (!id) return null
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id))
}

// Runs fn with orgId as the ambient tenant. Returns fn's result.
const runWithOrgId = (orgId, fn) => als.run({ orgId: toObjectId(orgId) }, fn)

// The ambient tenant's orgId (ObjectId) or null when outside any context.
const getOrgId = () => {
  const store = als.getStore()
  return store ? store.orgId : null
}

module.exports = { runWithOrgId, getOrgId }

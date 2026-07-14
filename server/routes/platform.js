// Multi-tenancy build-order step 7 (+ polish) - routes/platform.js
// Platform-level organization management, SuperAdmin only.
//   GET    /api/platform/orgs                     list orgs + usage (hides default)
//   POST   /api/platform/orgs                     create an org + its first Org Admin
//   PUT    /api/platform/orgs/:id                 update name/domains/features/limits
//   POST   /api/platform/orgs/:id/suspend         suspend (blocks every org user)
//   POST   /api/platform/orgs/:id/activate        reactivate
//   POST   /api/platform/orgs/:id/reset-admin-password  new temp password for the admin
//   DELETE /api/platform/orgs/:id                 backup + cascade-delete a tenant
//
// All tenant queries here name orgId explicitly (or use skipOrgScope), so the
// org-scope plugin never silently narrows a Super Admin's cross-tenant view to
// their own (default) org.

const express = require('express')
const fs = require('fs')
const path = require('path')
const { EJSON } = require('bson')

const Organization = require('../models/Organization')
const User = require('../models/User')
const Role = require('../models/Role')
const Form = require('../models/Form')
const FormDraft = require('../models/FormDraft')
const FormResponse = require('../models/FormResponse')
const Workflow = require('../models/Workflow')
const WorkflowExecution = require('../models/WorkflowExecution')
const Task = require('../models/Task')
const Notification = require('../models/Notification')
const AuditLog = require('../models/AuditLog')
const DelegationOfAuthority = require('../models/DelegationOfAuthority')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { checkEmailDomain } = require('../utils/domainPolicy')
const { generatePassword } = require('../utils/password')

const router = express.Router()

router.use(protect, roleGuard('SuperAdmin'))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Every tenant-scoped collection — the blast radius of a tenant delete/backup.
// Role and Organization are intentionally excluded (Role is global; the org
// document is handled separately).
const TENANT_MODELS = [
  User, Form, FormDraft, FormResponse, Workflow,
  WorkflowExecution, Task, Notification, AuditLog, DelegationOfAuthority
]

// Normalises a domains payload: array or comma-separated string → clean list.
const parseDomains = (input) => {
  const raw = Array.isArray(input) ? input : String(input || '').split(',')
  return [...new Set(
    raw.map((d) => String(d).toLowerCase().trim().replace(/^@/, '')).filter(Boolean)
  )]
}

const usageFor = async (orgId) => {
  const [users, forms, workflows, pendingTasks] = await Promise.all([
    User.countDocuments({ orgId }),
    Form.countDocuments({ orgId }),
    Workflow.countDocuments({ orgId }),
    Task.countDocuments({ orgId, status: 'pending' })
  ])
  return { users, forms, workflows, pendingTasks }
}

// Dumps an org's document + every tenant collection scoped to it into a
// timestamped EJSON folder (restorable — types preserved). Native driver reads
// bypass the org-scope plugin. Returns { dir, documents }.
const backupOrg = async (org) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join(__dirname, '..', 'backups', `org-${org.subdomain}-${stamp}`)
  fs.mkdirSync(dir, { recursive: true })

  fs.writeFileSync(
    path.join(dir, 'organization.jsonl'),
    EJSON.stringify(org, { relaxed: false }) + '\n'
  )

  let documents = 0
  for (const model of TENANT_MODELS) {
    const name = model.collection.name
    const docs = await model.collection.find({ orgId: org._id }).toArray()
    if (!docs.length) continue
    const lines = docs.map((d) => EJSON.stringify(d, { relaxed: false })).join('\n')
    fs.writeFileSync(path.join(dir, `${name}.jsonl`), lines + '\n')
    documents += docs.length
  }
  return { dir, documents }
}

// GET /api/platform/orgs — every tenant (default org hidden) with live usage
// and its bootstrap admin's email.
router.get('/orgs', async (req, res, next) => {
  try {
    const orgs = await Organization.find({ isDefault: { $ne: true } }).sort({ createdAt: 1 }).lean()

    const adminIds = orgs.map((o) => o.adminUserId).filter(Boolean)
    const admins = adminIds.length
      ? await User.find({ _id: { $in: adminIds } }).select('email name').setOptions({ skipOrgScope: true }).lean()
      : []
    const adminById = new Map(admins.map((a) => [String(a._id), a]))

    const withUsage = await Promise.all(
      orgs.map(async (org) => ({
        ...org,
        admin: org.adminUserId ? adminById.get(String(org.adminUserId)) || null : null,
        usage: await usageFor(org._id)
      }))
    )
    return sendSuccess(res, { orgs: withUsage })
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/orgs — create a new organization AND its first Org Admin.
// The admin gets a temporary password (returned once) and must change it on
// first login (models/User.mustChangePassword).
router.post('/orgs', async (req, res, next) => {
  try {
    const { name, subdomain, allowedDomains, features, limits, adminEmail, adminName } = req.body || {}
    if (!name || !subdomain) {
      return sendError(res, 'name and subdomain are required', 'MISSING_FIELDS', 400)
    }
    const email = String(adminEmail || '').toLowerCase().trim()
    if (!email) return sendError(res, 'Admin email is required', 'MISSING_ADMIN_EMAIL', 400)
    if (!EMAIL_RE.test(email)) return sendError(res, 'Enter a valid admin email', 'INVALID_ADMIN_EMAIL', 400)

    const sub = String(subdomain).toLowerCase().trim()
    const taken = await Organization.findOne({ subdomain: sub }).lean()
    if (taken) return sendError(res, `Subdomain "${sub}" is already taken`, 'SUBDOMAIN_TAKEN', 400)

    const adminRole = await Role.findOne({ name: 'Admin' })
    if (!adminRole) return sendError(res, 'Admin role is missing. Seed roles first.', 'NO_ADMIN_ROLE', 500)

    const parsedDomains = parseDomains(allowedDomains)
    const parsedFeatures = {
      aiRouting: features?.aiRouting !== false,
      externalUsers: features?.externalUsers === true
    }

    // Validate the admin email against the org's OWN domain policy up front.
    const policy = checkEmailDomain({ name, allowedDomains: parsedDomains, features: parsedFeatures }, email)
    if (!policy.allowed) return sendError(res, policy.reason, 'ADMIN_DOMAIN_NOT_ALLOWED', 400)

    const org = await Organization.create({
      name: String(name).trim(),
      subdomain: sub,
      allowedDomains: parsedDomains,
      features: parsedFeatures,
      limits: {
        maxUsers: Math.max(0, parseInt(limits?.maxUsers, 10) || 0),
        maxWorkflows: Math.max(0, parseInt(limits?.maxWorkflows, 10) || 0)
      }
    })

    const tempPassword = generatePassword(14)
    let admin
    try {
      admin = await User.create({
        orgId: org._id,
        name: String(adminName || '').trim() || `${org.name} Admin`,
        email,
        password: tempPassword,
        department: 'IT',
        role: adminRole._id,
        mustChangePassword: true
      })
    } catch (adminErr) {
      // Never leave an org with no admin — roll the org back.
      await Organization.deleteOne({ _id: org._id })
      if (adminErr.code === 11000) {
        return sendError(res, 'A user with that email already exists in this organization', 'ADMIN_EXISTS', 400)
      }
      throw adminErr
    }

    org.adminUserId = admin._id
    await org.save()

    return sendSuccess(res, {
      org: {
        ...org.toObject(),
        admin: { _id: admin._id, email: admin.email, name: admin.name },
        usage: await usageFor(org._id)
      },
      // Shown to the Super Admin exactly once — the password is hashed at rest.
      admin: { email: admin.email, name: admin.name, tempPassword, warning: policy.warning || null }
    }, 201)
  } catch (err) {
    if (err.name === 'ValidationError') {
      return sendError(res, err.message, 'INVALID_ORG', 400)
    }
    next(err)
  }
})

// PUT /api/platform/orgs/:id — update settings (not status; see suspend/activate).
router.put('/orgs/:id', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)

    const { name, allowedDomains, features, limits } = req.body || {}
    if (name !== undefined) org.name = String(name).trim()
    if (allowedDomains !== undefined) org.allowedDomains = parseDomains(allowedDomains)
    if (features !== undefined) {
      if (features.aiRouting !== undefined) org.features.aiRouting = Boolean(features.aiRouting)
      if (features.externalUsers !== undefined) org.features.externalUsers = Boolean(features.externalUsers)
    }
    if (limits !== undefined) {
      if (limits.maxUsers !== undefined) org.limits.maxUsers = Math.max(0, parseInt(limits.maxUsers, 10) || 0)
      if (limits.maxWorkflows !== undefined) org.limits.maxWorkflows = Math.max(0, parseInt(limits.maxWorkflows, 10) || 0)
    }
    await org.save()
    return sendSuccess(res, { org: { ...org.toObject(), usage: await usageFor(org._id) } })
  } catch (err) {
    if (err.name === 'ValidationError') {
      return sendError(res, err.message, 'INVALID_ORG', 400)
    }
    next(err)
  }
})

// POST /api/platform/orgs/:id/suspend — every user of the org is locked out
// on their next request (middleware/tenant.js rejects with ORG_SUSPENDED).
router.post('/orgs/:id/suspend', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)
    if (org.isDefault) {
      return sendError(res, 'The default organization cannot be suspended (it hosts the platform admin).', 'CANNOT_SUSPEND_DEFAULT', 400)
    }
    org.status = 'suspended'
    await org.save()
    return sendSuccess(res, { org: org.toObject() })
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/orgs/:id/activate
router.post('/orgs/:id/activate', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)
    org.status = 'active'
    await org.save()
    return sendSuccess(res, { org: org.toObject() })
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/orgs/:id/reset-admin-password — issues a fresh temporary
// password for the org's bootstrap admin (shown once), forces a change on next
// login, and revokes the admin's existing sessions.
router.post('/orgs/:id/reset-admin-password', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)
    if (org.isDefault) {
      return sendError(res, 'The default organization has no tenant admin to reset.', 'CANNOT_RESET_DEFAULT', 400)
    }

    let admin = null
    if (org.adminUserId) {
      admin = await User.findOne({ _id: org.adminUserId }).setOptions({ skipOrgScope: true })
    }
    if (!admin) {
      // Legacy org without a recorded admin — fall back to its earliest Admin.
      const adminRole = await Role.findOne({ name: 'Admin' })
      if (adminRole) {
        admin = await User.findOne({ orgId: org._id, role: adminRole._id }).sort({ createdAt: 1 })
      }
    }
    if (!admin) return sendError(res, 'No admin user found for this organization', 'NO_ORG_ADMIN', 404)

    const tempPassword = generatePassword(14)
    admin.password = tempPassword
    admin.mustChangePassword = true
    admin.tokenVersion = (admin.tokenVersion || 0) + 1
    await admin.save()

    if (!org.adminUserId) { org.adminUserId = admin._id; await org.save() }

    return sendSuccess(res, { admin: { email: admin.email, name: admin.name, tempPassword } })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/platform/orgs/:id — irreversibly removes a tenant. Backs the org
// up first (EJSON on disk), then cascade-deletes every tenant collection and
// the org document. The default org is protected.
router.delete('/orgs/:id', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)
    if (org.isDefault) {
      return sendError(res, 'The default organization cannot be deleted.', 'CANNOT_DELETE_DEFAULT', 400)
    }

    const backup = await backupOrg(org.toObject())

    let deleted = 0
    for (const model of TENANT_MODELS) {
      const result = await model.deleteMany({ orgId: org._id })
      deleted += result.deletedCount || 0
    }
    await Organization.deleteOne({ _id: org._id })

    console.log(`[platform] Deleted org "${org.name}" (${org.subdomain}): ${deleted} docs removed. Backup → ${backup.dir}`)
    return sendSuccess(res, { deleted, backup: { documents: backup.documents, dir: path.basename(backup.dir) } })
  } catch (err) {
    next(err)
  }
})

module.exports = router

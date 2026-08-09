// Multi-tenancy build-order step 7 (+ polish) - routes/platform.js
// Platform-level organization management, SuperAdmin only.
//   GET    /api/platform/orgs                     list orgs + usage (hides default)
//   POST   /api/platform/orgs                     create an org + its first Org Admin
//   PUT    /api/platform/orgs/:id                 update name/domains/features/limits
//   POST   /api/platform/orgs/:id/suspend         suspend (blocks every org user)
//   POST   /api/platform/orgs/:id/activate        reactivate
//   GET    /api/platform/orgs/:id/usage           one tenant's meters (?disk=1)
//   POST   /api/platform/orgs/:id/storage-extension     grant temporary storage
//   DELETE /api/platform/orgs/:id/storage-extension     revoke it early
//   POST   /api/platform/orgs/:id/reset-admin-password  new temp password for the admin
//   DELETE /api/platform/orgs/:id                 backup + cascade-delete a tenant
//   GET    /api/platform/activity                 platform org-lifecycle audit
//   GET    /api/platform/plans                    plan catalogue + tenant counts
//   GET    /api/platform/admins                   list SuperAdmin accounts
//   POST   /api/platform/admins                   invite a SuperAdmin
//   POST   /api/platform/admins/:id/reset-password
//   POST   /api/platform/admins/:id/deactivate
//   POST   /api/platform/admins/:id/activate
//   GET    /api/platform/health                   system status for SuperAdmin
//   GET    /api/platform/dms-storage              live BaseLayer DMS storage usage
//
// All tenant queries here name orgId explicitly (or use skipOrgScope), so the
// org-scope plugin never silently narrows a Super Admin's cross-tenant view to
// their own (default) org.

const express = require('express')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
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
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { checkEmailDomain } = require('../utils/domainPolicy')
const { generatePassword } = require('../utils/password')
const { writeAuditLog } = require('../utils/writeAuditLog')
const { applyLicensingPayload, usageSnapshot, freshPeriod, resetNotified } = require('../utils/licensing')
const { countsFor } = require('../utils/usage')
const dms = require('../services/dmsClient')
const { ensurePeriod } = require('../utils/usageMeter')
const { purgeOrgFiles } = require('../utils/fileGc')
const { measureOrg } = require('../utils/fileStore')
const { PLAN_PRESETS, SELLABLE_PLANS } = require('../config/plans')

const formatPlanMb = (mb) => {
  const n = Number(mb) || 0
  if (n <= 0) return 'Unlimited'
  if (n >= 1024) {
    const gb = n / 1024
    return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`
  }
  return `${Math.round(n)} MB`
}

const router = express.Router()

router.use(protect, roleGuard('SuperAdmin'))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PLATFORM_ACTIONS = [
  'org_created',
  'org_updated',
  'org_suspended',
  'org_activated',
  'org_deleted',
  'org_admin_password_reset',
  'org_storage_extended',
  'org_storage_extension_revoked',
  'org_licence_expired'
]

// A temporary storage grant is a support action, not a plan change: it buys a
// tenant time to clean up (or to sign a bigger contract) without stranding the
// approvals that are already waiting on an attachment.
const MAX_EXTENSION_MB = 100 * 1024
const MAX_EXTENSION_DAYS = 90

const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']

const auditPlatform = (req, action, org, detail, metadata = {}) =>
  writeAuditLog({
    action,
    performedBy: req.user._id,
    targetEntity: org?.name || org?.subdomain || 'organization',
    department: req.user.department,
    ipAddress: req.ip,
    detail,
    metadata: {
      ...metadata,
      targetOrgId: org?._id ? String(org._id) : undefined,
      subdomain: org?.subdomain
    }
  })

// Every tenant-scoped collection — the blast radius of a tenant delete/backup.
// Role and Organization are intentionally excluded (Role is global; the org
// document is handled separately).
const TENANT_MODELS = [
  User, Form, FormDraft, FormResponse, Workflow,
  WorkflowExecution, Task, Notification, AuditLog
]

// Normalises a domains payload: array or comma-separated string → clean list.
const parseDomains = (input) => {
  const raw = Array.isArray(input) ? input : String(input || '').split(',')
  return [...new Set(
    raw.map((d) => String(d).toLowerCase().trim().replace(/^@/, '')).filter(Boolean)
  )]
}

// Raw counts for the org card. `users`/`forms`/`workflows` follow the licensing
// rules (utils/usage.js) so the numbers here match what the quota gate enforces;
// totals are kept alongside so a Super Admin can still see deactivated seats.
const usageFor = async (orgId) => {
  const [licensed, usersTotal, formsTotal, workflowsTotal, pendingTasks] = await Promise.all([
    countsFor(orgId),
    User.countDocuments({ orgId }).setOptions({ skipOrgScope: true }),
    Form.countDocuments({ orgId }).setOptions({ skipOrgScope: true }),
    Workflow.countDocuments({ orgId }).setOptions({ skipOrgScope: true }),
    Task.countDocuments({ orgId, status: 'pending' }).setOptions({ skipOrgScope: true })
  ])
  return { ...licensed, usersTotal, formsTotal, workflowsTotal, pendingTasks }
}

// Org card payload: document + admin + counts + the licence/limit snapshot the
// UI meters render.
//
// `usage` stays the flat count object the panel has always rendered, which means
// it shadows the stored usage sub-document. That is deliberate — the stored
// meters (submission window, storage bytes, buffer) are richer than raw numbers
// and are published under `licensing` instead, already paired with their limits.
const withLicensing = async (org, extra = {}) => {
  const plain = typeof org.toObject === 'function' ? org.toObject() : org
  const counts = await usageFor(plain._id)
  return {
    ...plain,
    ...extra,
    usage: counts,
    licensing: usageSnapshot(plain, counts)
  }
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
      orgs.map((org) => withLicensing(org, {
        admin: org.adminUserId ? adminById.get(String(org.adminUserId)) || null : null
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
    const {
      name, subdomain, allowedDomains, features, adminEmail, adminName,
      // Platform Super Admin options for the bootstrap Org Admin (default on):
      //   adminCanBuild           — grant form/workflow builder access
      //   countAdminTowardSeats — bill this admin against user + builder limits
      adminCanBuild,
      countAdminTowardSeats
    } = req.body || {}
    if (!name || !subdomain) {
      return sendError(res, 'name and subdomain are required', 'MISSING_FIELDS', 400)
    }
    const email = String(adminEmail || '').toLowerCase().trim()
    if (!email) return sendError(res, 'Admin email is required', 'MISSING_ADMIN_EMAIL', 400)
    if (!EMAIL_RE.test(email)) return sendError(res, 'Enter a valid admin email', 'INVALID_ADMIN_EMAIL', 400)
    const grantBuild = adminCanBuild !== false && adminCanBuild !== 'false'
    const billSeats = countAdminTowardSeats !== false && countAdminTowardSeats !== 'false'

    const sub = String(subdomain).toLowerCase().trim()
    const taken = await Organization.findOne({ subdomain: sub }).lean()
    if (taken) return sendError(res, `Subdomain "${sub}" is already taken`, 'SUBDOMAIN_TAKEN', 400)

    const adminRole = await Role.findOne({ name: 'Admin' })
    if (!adminRole) return sendError(res, 'Admin role is missing. Seed roles first.', 'NO_ADMIN_ROLE', 500)

    const parsedDomains = parseDomains(allowedDomains)
    const parsedFeatures = {
      externalUsers: features?.externalUsers === true
    }

    // Validate the admin email against the org's OWN domain policy up front.
    const policy = checkEmailDomain({ name, allowedDomains: parsedDomains, features: parsedFeatures }, email)
    if (!policy.allowed) return sendError(res, policy.reason, 'ADMIN_DOMAIN_NOT_ALLOWED', 400)

    // Build the org in memory so a bad plan/limit payload is rejected before we
    // write anything (and before a temp password is generated).
    
    // Parse DMS Integrations for creation time
    const integrationsDoc = {}
    if (req.body?.integrations) {
      const integrations = req.body.integrations
      if (integrations.dmsApiKey !== undefined) integrationsDoc.dmsApiKey = String(integrations.dmsApiKey || '').trim()
      if (integrations.dmsEnabled !== undefined) integrationsDoc.dmsEnabled = Boolean(integrations.dmsEnabled)
      if (integrations.dmsOrgSlug !== undefined) integrationsDoc.dmsOrgSlug = String(integrations.dmsOrgSlug || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '-')
      
      if (Array.isArray(integrations.departmentDms)) {
        integrationsDoc.departmentDms = integrations.departmentDms
          .filter((d) => d && String(d.department || '').trim())
          .map((d) => ({
            department: String(d.department).trim(),
            apiKey:  String(d.apiKey  || '').trim(),
            baseUrl: String(d.baseUrl || '').trim(),
            folder:  String(d.folder  || '').trim(),
            enabled: d.enabled !== false
          }))
      }
    }

    const org = new Organization({
      name: String(name).trim(),
      subdomain: sub,
      allowedDomains: parsedDomains,
      features: parsedFeatures,
      ...(Object.keys(integrationsDoc).length ? { integrations: integrationsDoc } : {})
    })

    const licensingErrors = applyLicensingPayload(org, req.body || {})
    if (licensingErrors.length) {
      return sendError(res, licensingErrors[0], 'INVALID_LICENSING', 400, { errors: licensingErrors })
    }

    // Start the submission allowance from day one rather than waiting for the
    // first submission, so the UI can show a period immediately.
    org.usage.submissions = freshPeriod(org)
    await org.save()

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
        mustChangePassword: true,
        needsProductTour: true,
        // Defaults keep today’s behaviour: first admin can build and bills a seat.
        // Platform Super Admin may opt out of either via the create-org form.
        canBuild: grantBuild,
        countsTowardSeats: billSeats
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

    auditPlatform(req, 'org_created', org, `Created organization "${org.name}" (${org.subdomain}) with admin ${admin.email}`, {
      adminEmail: admin.email,
      adminCanBuild: grantBuild,
      countAdminTowardSeats: billSeats
    })

    return sendSuccess(res, {
      org: await withLicensing(org, {
        admin: { _id: admin._id, email: admin.email, name: admin.name }
      }),
      // Shown to the Super Admin exactly once — the password is hashed at rest.
      admin: {
        email: admin.email,
        name: admin.name,
        tempPassword,
        warning: policy.warning || null,
        canBuild: grantBuild,
        countsTowardSeats: billSeats
      }
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

    const { name, allowedDomains, features, integrations } = req.body || {}
    if (name !== undefined) org.name = String(name).trim()
    if (allowedDomains !== undefined) org.allowedDomains = parseDomains(allowedDomains)
    if (features !== undefined) {
      if (features.externalUsers !== undefined) org.features.externalUsers = Boolean(features.externalUsers)
    }

    // DMS integration settings — SuperAdmin only. dmsApiKey is write-once from
    // this endpoint (pass empty string '' to clear it).
    const dmsChanges = []
    if (integrations !== undefined) {
      if (integrations.dmsApiKey !== undefined) {
        const newKey = String(integrations.dmsApiKey || '').trim()
        if (newKey !== (org.integrations?.dmsApiKey || '')) {
          org.integrations.dmsApiKey = newKey
          dmsChanges.push('dmsApiKey')
        }
      }
      if (integrations.dmsEnabled !== undefined) {
        const newVal = Boolean(integrations.dmsEnabled)
        if (newVal !== Boolean(org.integrations?.dmsEnabled)) {
          org.integrations.dmsEnabled = newVal
          dmsChanges.push(`dmsEnabled=${newVal}`)
        }
      }
      if (integrations.dmsOrgSlug !== undefined) {
        const newSlug = String(integrations.dmsOrgSlug || '').toLowerCase().trim()
          .replace(/[^a-z0-9-]/g, '-')
        if (newSlug !== (org.integrations?.dmsOrgSlug || '')) {
          org.integrations.dmsOrgSlug = newSlug
          dmsChanges.push(`dmsOrgSlug=${newSlug || '(subdomain)'}`)
        }
      }
      // Per-department DMS configs — full replace (send the whole array to update)
      if (Array.isArray(integrations.departmentDms)) {
        org.integrations.departmentDms = integrations.departmentDms
          .filter((d) => d && String(d.department || '').trim())
          .map((d) => {
            const deptName = String(d.department).trim()
            let apiKey = String(d.apiKey || '').trim()
            // Preserve existing key if masked or missing
            if (apiKey === '••••••••' || !apiKey) {
              const existing = org.integrations.departmentDms?.find(
                (e) => String(e.department).toLowerCase() === deptName.toLowerCase()
              )
              // Only fallback to existing if we didn't explicitly send an empty string
              // Wait, if !apiKey, how do we clear it? We can allow frontend to send
              // a special flag or we just let it keep existing if it's strictly '••••••••'
              if (apiKey === '••••••••') {
                apiKey = existing?.apiKey || ''
              }
            }
            return {
              department: deptName,
              apiKey,
              baseUrl: String(d.baseUrl || '').trim(),
              folder:  String(d.folder  || '').trim(),
              enabled: d.enabled !== false
            }
          })
        dmsChanges.push(`departmentDms[${org.integrations.departmentDms.length}]`)
      }
    }

    const before = { plan: org.plan, limits: org.limits.toObject ? org.limits.toObject() : { ...org.limits } }
    const licensingErrors = applyLicensingPayload(org, req.body || {})
    if (licensingErrors.length) {
      return sendError(res, licensingErrors[0], 'INVALID_LICENSING', 400, { errors: licensingErrors })
    }

    // A plan change re-dates the allowance: the new submission cap should apply
    // from now, not from a window that was sized for the old plan.
    if (org.plan !== before.plan
      || Number(org.limits.maxSubmissionsPerPeriod || 0) !== Number(before.limits.maxSubmissionsPerPeriod || 0)) {
      const period = freshPeriod(org)
      // Keep the count — the tenant did submit those — only re-window it.
      org.usage.submissions.periodStart = period.periodStart
      org.usage.submissions.periodEnd = period.periodEnd
      resetNotified(org, 'sub')
    }
    if (Number(org.limits.maxStorageMb || 0) !== Number(before.limits.maxStorageMb || 0)) {
      resetNotified(org, 'stor')
    }

    await org.save()

    const planChanged = org.plan !== before.plan
    const detail = [
      planChanged ? `plan ${before.plan} → ${org.plan}` : null,
      dmsChanges.length ? `DMS: ${dmsChanges.join(', ')}` : null
    ].filter(Boolean).join('; ')

    auditPlatform(
      req,
      'org_updated',
      org,
      `Updated organization "${org.name}" (${org.subdomain})${detail ? ` — ${detail}` : ''}`,
      {
        ...(planChanged ? { planFrom: before.plan, planTo: org.plan } : {}),
        ...(dmsChanges.length ? { dmsChanges } : {})
      }
    )
    return sendSuccess(res, { org: await withLicensing(org) })
  } catch (err) {
    if (err.name === 'ValidationError') {
      return sendError(res, err.message, 'INVALID_ORG', 400)
    }
    next(err)
  }
})

// GET /api/platform/orgs/:id/usage — one tenant's meters, freshly counted.
//
// The list endpoint already carries a snapshot per org; this exists for the org
// detail view, which needs it after an edit, and for support work — with
// `?disk=1` it also measures the attachment directory so drift between the stored
// meter and the filesystem is visible without waiting for the nightly job.
router.get('/orgs/:id/usage', async (req, res, next) => {
  try {
    // Rolling here as well as on the tenant's own endpoint: a Super Admin
    // investigating "why are they blocked?" must not be shown a stale window.
    await ensurePeriod(req.params.id)

    const org = await Organization.findById(req.params.id).lean()
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)

    const counts = await usageFor(org._id)
    const payload = {
      org: { _id: org._id, name: org.name, subdomain: org.subdomain, status: org.status },
      counts,
      usage: usageSnapshot(org, counts),
      storageExtension: org.storageExtension?.extraMb ? org.storageExtension : null
    }

    if (String(req.query.disk || '') === '1') {
      const actual = measureOrg(org._id)
      payload.disk = {
        bytes: actual.bytes,
        files: actual.files,
        driftBytes: actual.bytes - Number(org.usage?.storageBytes || 0),
        driftFiles: actual.files - Number(org.usage?.fileCount || 0)
      }
    }

    return sendSuccess(res, payload)
  } catch (err) {
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
    auditPlatform(req, 'org_suspended', org, `Suspended organization "${org.name}" (${org.subdomain})`)
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
    auditPlatform(req, 'org_activated', org, `Activated organization "${org.name}" (${org.subdomain})`)
    return sendSuccess(res, { org: org.toObject() })
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/orgs/:id/storage-extension — grant temporary extra storage.
// Support lever for a tenant that has filled both its plan and its completion
// buffer: raises the ceiling for a fixed number of days without touching the
// contracted limit, so the plan value stays the source of truth at renewal.
router.post('/orgs/:id/storage-extension', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)

    const extraMb = Number(req.body?.extraMb)
    const days = Number(req.body?.days)
    const reason = String(req.body?.reason || '').trim()

    if (!Number.isFinite(extraMb) || extraMb <= 0 || extraMb > MAX_EXTENSION_MB) {
      return sendError(res, `extraMb must be between 1 and ${MAX_EXTENSION_MB}.`, 'VALIDATION_ERROR', 400)
    }
    if (!Number.isFinite(days) || days <= 0 || days > MAX_EXTENSION_DAYS) {
      return sendError(res, `days must be between 1 and ${MAX_EXTENSION_DAYS}.`, 'VALIDATION_ERROR', 400)
    }
    if (!Number(org.limits?.maxStorageMb || 0)) {
      return sendError(res, 'This organization already has unlimited storage.', 'STORAGE_UNLIMITED', 400)
    }

    const expiresAt = new Date(Date.now() + days * 86400000)
    org.storageExtension = { extraMb, expiresAt, grantedBy: req.user._id, reason }
    // A bigger ceiling means the old "you are full" emails are stale.
    resetNotified(org, 'stor')
    await org.save()

    auditPlatform(
      req,
      'org_storage_extended',
      org,
      `Granted ${extraMb} MB extra storage to "${org.name}" for ${days} day(s)${reason ? ` — ${reason}` : ''}`,
      { extraMb, days, expiresAt, reason }
    )
    return sendSuccess(res, { org: await withLicensing(org) })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/platform/orgs/:id/storage-extension — end the grant early.
router.delete('/orgs/:id/storage-extension', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
    if (!org) return sendError(res, 'Organization not found', 'ORG_NOT_FOUND', 404)

    const had = Number(org.storageExtension?.extraMb || 0)
    org.storageExtension = { extraMb: 0, expiresAt: null, grantedBy: null, reason: '' }
    await org.save()

    if (had) {
      auditPlatform(
        req,
        'org_storage_extension_revoked',
        org,
        `Revoked the ${had} MB storage extension on "${org.name}"`,
        { extraMb: had }
      )
    }
    return sendSuccess(res, { org: await withLicensing(org) })
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

    auditPlatform(req, 'org_admin_password_reset', org, `Reset admin password for "${org.name}" (${admin.email})`, {
      adminEmail: admin.email
    })

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

    const snapshot = org.toObject()
    const backup = await backupOrg(snapshot)

    // Await so the platform event is written under the SuperAdmin's org before
    // the tenant's own AuditLog docs are wiped.
    await auditPlatform(req, 'org_deleted', snapshot, `Deleted organization "${snapshot.name}" (${snapshot.subdomain})`, {
      backupDir: path.basename(backup.dir),
      backupDocuments: backup.documents
    })

    let deleted = 0
    for (const model of TENANT_MODELS) {
      const result = await model.deleteMany({ orgId: org._id })
      deleted += result.deletedCount || 0
    }
    await Organization.deleteOne({ _id: org._id })

    // The backup above already contains every record; the tenant's attachment
    // directory is what the database cannot hold, so it is removed last — after
    // the deletes succeeded, never before.
    const filesPurged = await purgeOrgFiles(org._id)

    console.log(`[platform] Deleted org "${org.name}" (${org.subdomain}): ${deleted} docs removed, attachments ${filesPurged ? 'purged' : 'left in place'}. Backup → ${backup.dir}`)
    return sendSuccess(res, {
      deleted,
      filesPurged,
      backup: { documents: backup.documents, dir: path.basename(backup.dir) }
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/platform/activity — SuperAdmin org-lifecycle audit trail
router.get('/activity', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const action = String(req.query.action || '').trim()
    const search = String(req.query.search || '').trim()

    const query = {
      action: action && PLATFORM_ACTIONS.includes(action)
        ? action
        : { $in: PLATFORM_ACTIONS }
    }
    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$or = [{ targetEntity: regex }, { detail: regex }]
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query).setOptions({ skipOrgScope: true }),
      AuditLog.find(query)
        .setOptions({ skipOrgScope: true })
        .populate({ path: 'performedBy', select: 'name email' })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ])

    return sendSuccess(res, {
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      count: logs.length,
      logs,
      actions: PLATFORM_ACTIONS
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/platform/plans — catalogue + how many tenants sit on each tier.
// Limits are config-driven today (server/config/plans.js); this endpoint is
// read-only so the Super Admin UI can show what is sold without editing code.
router.get('/plans', async (req, res, next) => {
  try {
    const orgs = await Organization.find({ isDefault: { $ne: true } })
      .select('plan status')
      .lean()

    const counts = {}
    for (const key of [...SELLABLE_PLANS, 'custom']) counts[key] = { total: 0, active: 0, suspended: 0 }
    for (const org of orgs) {
      const plan = counts[org.plan] ? org.plan : 'custom'
      counts[plan].total += 1
      if ((org.status || 'active') === 'suspended') counts[plan].suspended += 1
      else counts[plan].active += 1
    }

    const limitLabel = (n) => (n ? String(n) : 'Unlimited')

    const plans = SELLABLE_PLANS.map((key) => {
      const preset = PLAN_PRESETS[key]
      const limits = preset.limits || {}
      return {
        key,
        label: preset.label,
        trialDays: preset.trialDays || null,
        limits: {
          maxUsers: limits.maxUsers || 0,
          maxBuilders: limits.maxBuilders || 0,
          maxForms: limits.maxForms || 0,
          maxWorkflows: limits.maxWorkflows || 0,
          maxSubmissionsPerPeriod: limits.maxSubmissionsPerPeriod || 0,
          maxStorageMb: limits.maxStorageMb || 0,
          maxFiles: limits.maxFiles || 0
        },
        limitsDisplay: {
          users: limitLabel(limits.maxUsers),
          builders: limitLabel(limits.maxBuilders),
          forms: limitLabel(limits.maxForms),
          workflows: limitLabel(limits.maxWorkflows),
          submissions: limitLabel(limits.maxSubmissionsPerPeriod),
          storage: formatPlanMb(limits.maxStorageMb),
          files: limitLabel(limits.maxFiles)
        },
        tenants: counts[key] || { total: 0, active: 0, suspended: 0 }
      }
    })

    return sendSuccess(res, {
      plans,
      custom: {
        key: 'custom',
        label: PLAN_PRESETS.custom.label,
        tenants: counts.custom || { total: 0, active: 0, suspended: 0 }
      },
      totalTenants: orgs.length
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/plans — create a new subscription plan dynamically.
router.post('/plans', async (req, res, next) => {
  try {
    const Plan = require('../models/Plan')
    const { reloadPlans } = require('../config/plans')
    
    const { key, label, trialDays, limits } = req.body
    if (!key || !label) {
      return sendError(res, 'Key and label are required', 'MISSING_FIELDS', 400)
    }
    
    const existing = await Plan.findOne({ key })
    if (existing) {
      return sendError(res, `Plan key "${key}" already exists`, 'PLAN_EXISTS', 400)
    }

    const plan = await Plan.create({
      key,
      label,
      trialDays: trialDays ? Number(trialDays) : null,
      limits: limits || {},
      isCustom: false
    })

    await reloadPlans()
    
    auditPlatform(req, 'plan_created', null, `Created subscription plan "${label}" (${key})`, { key, label })
    return sendSuccess(res, { plan }, 201)
  } catch (err) {
    if (err.name === 'ValidationError') return sendError(res, err.message, 'VALIDATION_ERROR', 400)
    next(err)
  }
})

// PUT /api/platform/plans/:key — update an existing subscription plan.
router.put('/plans/:key', async (req, res, next) => {
  try {
    const Plan = require('../models/Plan')
    const { reloadPlans } = require('../config/plans')
    
    const plan = await Plan.findOne({ key: req.params.key })
    if (!plan) return sendError(res, 'Plan not found', 'PLAN_NOT_FOUND', 404)
    if (plan.isCustom) return sendError(res, 'Cannot edit the custom plan preset', 'INVALID_OPERATION', 400)

    const { label, trialDays, limits } = req.body
    if (label !== undefined) plan.label = label
    if (trialDays !== undefined) plan.trialDays = trialDays === null ? null : Number(trialDays)
    if (limits !== undefined) {
      plan.limits = { ...plan.limits, ...limits }
    }

    await plan.save()
    await reloadPlans()
    
    auditPlatform(req, 'plan_updated', null, `Updated subscription plan "${plan.label}" (${plan.key})`, { key: plan.key })
    return sendSuccess(res, { plan })
  } catch (err) {
    if (err.name === 'ValidationError') return sendError(res, err.message, 'VALIDATION_ERROR', 400)
    next(err)
  }
})

// DELETE /api/platform/plans/:key — delete a subscription plan.
router.delete('/plans/:key', async (req, res, next) => {
  try {
    const Plan = require('../models/Plan')
    const { reloadPlans } = require('../config/plans')
    
    const key = req.params.key
    const plan = await Plan.findOne({ key })
    if (!plan) return sendError(res, 'Plan not found', 'PLAN_NOT_FOUND', 404)
    if (plan.isCustom) return sendError(res, 'Cannot delete the custom plan preset', 'INVALID_OPERATION', 400)

    const inUse = await Organization.exists({ plan: key })
    if (inUse) {
      return sendError(res, 'Cannot delete plan because organizations are actively using it', 'PLAN_IN_USE', 400)
    }

    await Plan.deleteOne({ key })
    await reloadPlans()
    
    auditPlatform(req, 'plan_deleted', null, `Deleted subscription plan "${plan.label}" (${key})`, { key })
    return sendSuccess(res, { deleted: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/platform/admins — every SuperAdmin account on this deployment.
router.get('/admins', async (req, res, next) => {
  try {
    const role = await Role.findOne({ name: 'SuperAdmin' }).lean()
    if (!role) return sendSuccess(res, { admins: [] })

    const admins = await User.find({ role: role._id })
      .setOptions({ skipOrgScope: true })
      .select('name email department isActive isProtected mustChangePassword lastLogin createdAt')
      .sort({ createdAt: 1 })
      .lean()

    return sendSuccess(res, {
      admins: admins.map((u) => ({
        ...u,
        isSelf: String(u._id) === String(req.user._id)
      })),
      count: admins.length
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/admins — provision another platform SuperAdmin.
router.post('/admins', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const name = String(req.body.name || '').trim() || 'Platform Admin'
    if (!EMAIL_RE.test(email)) return sendError(res, 400, 'A valid email is required')

    const role = await Role.findOne({ name: 'SuperAdmin' })
    if (!role) return sendError(res, 500, 'SuperAdmin role is missing — run seed:superadmin')

    const defaultOrg = await Organization.findOne({ isDefault: true }).lean()
    if (!defaultOrg) return sendError(res, 500, 'Default organization is missing')

    const existing = await User.findOne({ email, orgId: defaultOrg._id })
      .setOptions({ skipOrgScope: true })
      .lean()
    if (existing) return sendError(res, 409, 'A user with this email already exists on the platform')

    const tempPassword = generatePassword()
    const user = await User.create({
      orgId: defaultOrg._id,
      name,
      email,
      password: tempPassword,
      department: 'IT',
      role: role._id,
      mustChangePassword: true,
      needsProductTour: true,
      isProtected: false,
      isActive: true
    })

    writeAuditLog({
      action: 'platform_admin_created',
      performedBy: req.user._id,
      targetEntity: email,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `Provisioned SuperAdmin "${name}" <${email}>`,
      metadata: { adminUserId: String(user._id) }
    })

    return sendSuccess(res, {
      admin: {
        _id: user._id,
        name: user.name,
        email: user.email,
        tempPassword
      }
    }, 201)
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/admins/:id/reset-password
router.post('/admins/:id/reset-password', async (req, res, next) => {
  try {
    const role = await Role.findOne({ name: 'SuperAdmin' }).lean()
    if (!role) return sendError(res, 500, 'SuperAdmin role is missing')

    const user = await User.findOne({ _id: req.params.id, role: role._id })
      .setOptions({ skipOrgScope: true })
    if (!user) return sendError(res, 404, 'Platform admin not found')

    const tempPassword = generatePassword()
    user.password = tempPassword
    user.mustChangePassword = true
    user.tokenVersion = (user.tokenVersion || 0) + 1
    await user.save()

    writeAuditLog({
      action: 'platform_admin_password_reset',
      performedBy: req.user._id,
      targetEntity: user.email,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `Reset password for SuperAdmin <${user.email}>`,
      metadata: { adminUserId: String(user._id) }
    })

    return sendSuccess(res, {
      admin: { _id: user._id, email: user.email, tempPassword }
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/platform/admins/:id/deactivate|activate
// Separate paths — newer path-to-regexp rejects `:action(a|b)` regex groups.
const setAdminActive = (activate) => async (req, res, next) => {
  try {
    const role = await Role.findOne({ name: 'SuperAdmin' }).lean()
    if (!role) return sendError(res, 500, 'SuperAdmin role is missing')

    const user = await User.findOne({ _id: req.params.id, role: role._id })
      .setOptions({ skipOrgScope: true })
    if (!user) return sendError(res, 404, 'Platform admin not found')

    if (String(user._id) === String(req.user._id)) {
      return sendError(res, 400, 'You cannot deactivate your own account')
    }
    if (user.isProtected && !activate) {
      return sendError(res, 400, 'The seeded platform admin cannot be deactivated')
    }

    if (!activate) {
      const activeCount = await User.countDocuments({ role: role._id, isActive: true })
        .setOptions({ skipOrgScope: true })
      if (activeCount <= 1) {
        return sendError(res, 400, 'Cannot deactivate the last active platform admin')
      }
    }

    user.isActive = activate
    if (!activate) user.tokenVersion = (user.tokenVersion || 0) + 1
    await user.save()

    writeAuditLog({
      action: activate ? 'platform_admin_activated' : 'platform_admin_deactivated',
      performedBy: req.user._id,
      targetEntity: user.email,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${activate ? 'Activated' : 'Deactivated'} SuperAdmin <${user.email}>`,
      metadata: { adminUserId: String(user._id) }
    })

    return sendSuccess(res, {
      admin: {
        _id: user._id,
        email: user.email,
        isActive: user.isActive
      }
    })
  } catch (err) {
    next(err)
  }
}

router.post('/admins/:id/deactivate', setAdminActive(false))
router.post('/admins/:id/activate', setAdminActive(true))

// GET /api/platform/health — system status for the SuperAdmin Health page
router.get('/health', async (req, res, next) => {
  try {
    const readyState = mongoose.connection.readyState
    const dbOk = readyState === 1

    const [totalOrgs, activeOrgs, suspendedOrgs] = await Promise.all([
      Organization.countDocuments({ isDefault: { $ne: true } }),
      Organization.countDocuments({ isDefault: { $ne: true }, status: 'active' }),
      Organization.countDocuments({ isDefault: { $ne: true }, status: 'suspended' })
    ])

    return sendSuccess(res, {
      overall: dbOk ? 'healthy' : 'degraded',
      api: {
        status: 'ok',
        service: 'netflow-server',
        env: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      },
      database: {
        status: dbOk ? 'ok' : 'degraded',
        readyState: MONGO_STATES[readyState] || String(readyState),
        name: mongoose.connection.name || null,
        host: mongoose.connection.host || null
      },
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        suspended: suspendedOrgs
      }
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/platform/dms-storage — live bytes in BaseLayer DMS (API key org).
router.get('/dms-storage', async (req, res, next) => {
  try {
    if (!dms.isEnabled()) {
      return sendSuccess(res, {
        enabled: false,
        source: null,
        usedBytes: 0,
        usedMb: 0,
        limitBytes: null,
        limitMb: null,
        documentCount: 0,
        organizationId: null,
        message: 'DMS is not enabled'
      })
    }

    const usage = await dms.getStorageUsage({ user: req.user })
    return sendSuccess(res, usage || {
      enabled: true,
      source: null,
      usedBytes: 0,
      usedMb: 0,
      limitBytes: null,
      limitMb: null,
      documentCount: 0,
      organizationId: null
    })
  } catch (err) {
    if (err instanceof dms.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message || 'DMS storage lookup failed', code, err.status || 502, {
        dms: err.body || null
      })
    }
    next(err)
  }
})

// GET /api/platform/dms-documents — paginated DMS document list with folder grouping
// Supports ?limit=&offset= query params. Groups docs by sourceRef type
// (tasks, forms, workflows, other) so the UI can render a simulated folder tree.
router.get('/dms-documents', async (req, res, next) => {
  try {
    if (!dms.isEnabled()) {
      return sendSuccess(res, {
        enabled: false,
        documents: [],
        total: 0,
        groups: { tasks: 0, forms: 0, workflows: 0, other: 0 },
        message: 'DMS is not enabled'
      })
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200)
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)

    const result = await dms.listDocuments({ user: req.user, limit, offset })
    const docs = result?.documents || []
    const total = result?.total ?? null

    // Build folder groups based on sourceRef metadata
    const groups = { tasks: 0, forms: 0, workflows: 0, other: 0 }
    for (const doc of docs) {
      const ref = doc.sourceRef || doc.externalRef || {}
      if (ref.taskId) groups.tasks += 1
      else if (ref.formResponseId) groups.forms += 1
      else if (ref.workflowId) groups.workflows += 1
      else groups.other += 1
    }

    return sendSuccess(res, { enabled: true, documents: docs, total, groups })
  } catch (err) {
    if (err instanceof dms.DmsError) {
      const code = err.status === 401 ? 'DMS_UNAUTHORIZED' : (err.code || 'DMS_ERROR')
      return sendError(res, err.message || 'DMS document listing failed', code, err.status || 502, { dms: err.body || null })
    }
    next(err)
  }
})

module.exports = router



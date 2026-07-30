// Shell 2 (Org Admin) - routes/organization.js
// What a tenant may see and change about itself.
//   GET /api/organization   Admin — profile, policy and plan in one read
//   PUT /api/organization   Admin — display name and billing contact only
//
// Everything that decides what the tenant is allowed to do — subdomain, plan,
// limits, licence dates, email-domain policy, feature flags — stays with the
// Platform Super Admin. It is returned here read-only so the admin can see the
// rules they are working inside without having to ask support what they are.

const express = require('express')

const Organization = require('../models/Organization')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { writeAuditLog } = require('../utils/writeAuditLog')
const { licenceState } = require('../utils/licensing')
const { listFor } = require('../utils/departments')

const router = express.Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NAME_LENGTH = 80

router.use(protect, roleGuard('Admin'))

const publicShape = (org) => ({
  _id: org._id,
  name: org.name,
  subdomain: org.subdomain,
  status: org.status,
  billingEmail: org.billingEmail || '',
  billingAnchorDay: org.billingAnchorDay || 1,
  allowedDomains: org.allowedDomains || [],
  features: {
    externalUsers: Boolean(org.features?.externalUsers)
  },
  departments: listFor(org),
  licence: licenceState(org),
  createdAt: org.createdAt
})

const loadOrg = async (req, res) => {
  if (!req.orgId) {
    sendError(res, 'No workspace resolved for this account', 'NO_ORG', 400)
    return null
  }
  const org = await Organization.findById(req.orgId)
  if (!org) {
    sendError(res, 'Workspace not found', 'ORG_NOT_FOUND', 404)
    return null
  }
  return org
}

// GET /api/organization
router.get('/', async (req, res, next) => {
  try {
    const org = await loadOrg(req, res)
    if (!org) return undefined
    return sendSuccess(res, { organization: publicShape(org) })
  } catch (err) {
    next(err)
  }
})

// PUT /api/organization
router.put('/', async (req, res, next) => {
  try {
    const org = await loadOrg(req, res)
    if (!org) return undefined

    const { name, billingEmail } = req.body || {}
    const changes = []

    if (name !== undefined) {
      const clean = String(name).trim()
      if (!clean) return sendError(res, 'Workspace name is required', 'MISSING_NAME', 400)
      if (clean.length > MAX_NAME_LENGTH) {
        return sendError(res, `Workspace name must be ${MAX_NAME_LENGTH} characters or fewer`, 'NAME_TOO_LONG', 400)
      }
      if (clean !== org.name) {
        changes.push(`name "${org.name}" → "${clean}"`)
        org.name = clean
      }
    }

    if (billingEmail !== undefined) {
      const clean = String(billingEmail).trim().toLowerCase()
      if (clean && !EMAIL_RE.test(clean)) {
        return sendError(res, 'Enter a valid billing email address', 'INVALID_BILLING_EMAIL', 400)
      }
      if (clean !== (org.billingEmail || '')) {
        changes.push(`billing email "${org.billingEmail || 'none'}" → "${clean || 'none'}"`)
        org.billingEmail = clean
      }
    }

    if (!changes.length) return sendSuccess(res, { organization: publicShape(org) })

    await org.save()

    writeAuditLog({
      action: 'org_settings_updated',
      performedBy: req.user._id,
      targetEntity: `Organization: ${org.name}`,
      department: req.user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} updated ${changes.join(', ')}`,
      metadata: { changes }
    })

    return sendSuccess(res, { organization: publicShape(org) })
  } catch (err) {
    next(err)
  }
})

module.exports = router

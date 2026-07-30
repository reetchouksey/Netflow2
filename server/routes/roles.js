// M1 - Phase 2 - routes/roles.js (+ Shell 2 summary)
// The role catalogue, and what each role can actually do here.
//   GET /api/roles          any signed-in user — the assignable catalogue
//   GET /api/roles/summary  Admin — capability matrix + who holds what
//
// SuperAdmin is filtered out of both: it is a platform account created from the
// platform console, so offering it inside a workspace would only ever be a way
// to escape the tenant (see assertAssignableRole in routes/users.js).

const express = require('express')

const Role = require('../models/Role')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { CAPABILITIES, ROLE_ORDER, shellFor } = require('../utils/roles')

const router = express.Router()

const TENANT_ROLES = { name: { $ne: 'SuperAdmin' } }

const byDisplayOrder = (a, b) => {
  const ai = ROLE_ORDER.indexOf(a.name)
  const bi = ROLE_ORDER.indexOf(b.name)
  if (ai !== -1 && bi !== -1) return ai - bi
  if (ai !== -1) return -1
  if (bi !== -1) return 1
  return a.name.localeCompare(b.name)
}

// GET /api/roles
router.get('/', protect, async (req, res, next) => {
  try {
    const roles = await Role.find(TENANT_ROLES).sort({ name: 1 }).lean()
    return sendSuccess(res, { count: roles.length, roles })
  } catch (err) {
    next(err)
  }
})

// GET /api/roles/summary
router.get('/summary', protect, roleGuard('Admin'), async (req, res, next) => {
  try {
    if (!req.orgId) return sendError(res, 'No workspace resolved for this account', 'NO_ORG', 400)

    const roles = await Role.find(TENANT_ROLES).lean()

    // Head counts make the matrix answer the question an admin actually has:
    // not "who could approve?" but "who in my workspace can?".
    const counts = await User.aggregate([
      { $match: { orgId: req.orgId, isActive: { $ne: false } } },
      { $group: { _id: '$role', members: { $sum: 1 }, builders: { $sum: { $cond: ['$canBuild', 1, 0] } } } }
    ])
    const byRoleId = new Map(counts.map((c) => [String(c._id), c]))

    const payload = roles.map((role) => {
      const stats = byRoleId.get(String(role._id)) || { members: 0, builders: 0 }
      return {
        _id: role._id,
        name: role.name,
        description: role.description || '',
        shell: shellFor(role.name),
        members: stats.members,
        builders: stats.builders,
        capabilities: CAPABILITIES
          .filter((cap) => cap.roles.includes(role.name))
          .map((cap) => cap.key)
      }
    }).sort(byDisplayOrder)

    const maxBuilders = req.organization?.limits?.maxBuilders || 0
    return sendSuccess(res, {
      roles: payload,
      capabilities: CAPABILITIES.map(({ key, label, description, note }) => ({ key, label, description, note })),
      builderSeats: {
        used: payload.reduce((sum, r) => sum + r.builders, 0),
        // 0 means the plan does not cap builder seats.
        limit: maxBuilders
      }
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

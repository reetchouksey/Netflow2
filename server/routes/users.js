// M1 - Phase 2 - routes/users.js
// User CRUD + role assignment. All routes require a valid JWT.
// Create / update / delete / assign-role are limited to Admin.

const express = require('express')

const User = require('../models/User')
const Role = require('../models/Role')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { writeAuditLog } = require('../utils/writeAuditLog')
const { sendWelcomeEmail } = require('../utils/emailService')

const router = express.Router()

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const sameId = (a, b) => String(a) === String(b)

// GET /api/users
router.get('/', protect, async (req, res, next) => {
  try {
    const { department, role, search, isActive } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))

    const query = {}
    if (department) query.department = department
    if (isActive !== undefined) query.isActive = isActive === 'true'

    if (role) {
      const roleDoc = await Role.findOne({ name: role }).lean()
      if (roleDoc) query.role = roleDoc._id
      else query.role = null
    }

    if (search) {
      const regex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$or = [{ name: regex }, { email: regex }]
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('-password')
        .populate('role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ])

    return sendSuccess(res, {
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      count: users.length,
      users
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/me/profile
// Current user's own profile, with role + reporting manager populated, plus
// the list of people who report directly to them (their direct reports).
// Declared before /:id so "me" isn't captured as an id.
router.get('/me/profile', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('role')
      .populate({
        path: 'managerId',
        select: 'name email department',
        populate: { path: 'role', select: 'name' }
      })
      .populate({
        path: 'hrId',
        select: 'name email department',
        populate: { path: 'role', select: 'name' }
      })
      .lean()
    if (!user) return sendError(res, 'User not found', 'USER_NOT_FOUND', 404)

    const reports = await User.find({ managerId: req.user._id })
      .select('name email department isActive')
      .populate('role', 'name')
      .sort({ name: 1 })
      .lean()

    return sendSuccess(res, { user, reports })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('role')
      .populate({ path: 'managerId', select: 'name email department' })
      .populate({ path: 'hrId', select: 'name email department' })
      .lean()
    if (!user) return sendError(res, 'User not found', 'USER_NOT_FOUND', 404)
    return sendSuccess(res, { user })
  } catch (err) {
    next(err)
  }
})

// POST /api/users
router.post('/', protect, roleGuard('Admin'), async (req, res, next) => {
  try {
    const { name, email, department, roleId, managerId, hrId } = req.body
    if (!name || !email || !department || !roleId) {
      return sendError(res, 'name, email, department and roleId are required', 'MISSING_FIELDS', 400)
    }

    const normalisedEmail = String(email).toLowerCase().trim()
    const exists = await User.findOne({ email: normalisedEmail }).lean()
    if (exists) return sendError(res, 'Email already registered', 'EMAIL_EXISTS', 400)

    const tempPassword = req.body.password || generateTempPassword()

    const user = new User({
      name,
      email: normalisedEmail,
      password: tempPassword,
      department,
      role: roleId,
      managerId: managerId || undefined,
      hrId: hrId || undefined
    })
    await user.save()
    await user.populate('role')

    sendWelcomeEmail({ to: user.email, name: user.name, tempPassword })

    writeAuditLog({
      action: 'user_invited',
      performedBy: req.user._id,
      targetEntity: `User: ${user.name}`,
      department: user.department,
      ipAddress: req.ip,
      detail: `${req.user.name} invited ${user.name} (${user.email})`,
      metadata: { newUserId: user._id, role: user.role?.name }
    })

    return sendSuccess(res, { user: user.toJSON() }, 201)
  } catch (err) {
    next(err)
  }
})

// PUT /api/users/:id
router.put('/:id', protect, roleGuard('Admin'), async (req, res, next) => {
  try {
    const { password, _id, role, name, email, ...rest } = req.body
    const updates = { ...rest }

    const target = await User.findById(req.params.id).select('name email isProtected').lean()
    if (!target) return sendError(res, 'User not found', 'USER_NOT_FOUND', 404)
    if (target.isProtected) {
      return sendError(res, 'This account is protected and cannot be modified', 'USER_PROTECTED', 403)
    }

    // Optional password reset. Validate up front so we never half-apply changes.
    const newPassword = (password === undefined || password === null) ? '' : String(password)
    const wantsPasswordChange = newPassword.length > 0
    if (wantsPasswordChange && newPassword.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 'WEAK_PASSWORD', 400)
    }

    if (role !== undefined) {
      if (sameId(req.params.id, req.user._id)) {
        return sendError(res, 'You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE', 400)
      }
      updates.role = role
    }

    // Identity fields. Name is trimmed; email is normalised and checked for
    // collisions against everyone else so the unique index never 500s.
    if (name !== undefined) {
      const trimmedName = String(name).trim()
      if (!trimmedName) return sendError(res, 'Name cannot be empty', 'INVALID_NAME', 400)
      updates.name = trimmedName
    }
    if (email !== undefined) {
      const normalisedEmail = String(email).toLowerCase().trim()
      if (!normalisedEmail) return sendError(res, 'Email cannot be empty', 'INVALID_EMAIL', 400)
      const clash = await User.findOne({
        email: normalisedEmail,
        _id: { $ne: req.params.id }
      }).lean()
      if (clash) return sendError(res, 'That email is already used by another user', 'EMAIL_EXISTS', 400)
      updates.email = normalisedEmail
    }

    // Allow clearing the reporting manager; an empty string would otherwise
    // throw a Mongoose CastError on the ObjectId field.
    if ('managerId' in updates) {
      if (!updates.managerId) updates.managerId = null
      else if (sameId(updates.managerId, req.params.id)) {
        return sendError(res, 'A user cannot be their own manager', 'INVALID_MANAGER', 400)
      }
    }

    if ('hrId' in updates) {
      if (!updates.hrId) updates.hrId = null
      else if (sameId(updates.hrId, req.params.id)) {
        return sendError(res, 'A user cannot be their own HR', 'INVALID_HR', 400)
      }
    }

    // Snapshot identity (already loaded above) so we can record what changed.
    const before = (updates.name !== undefined || updates.email !== undefined) ? target : null

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).select('-password').populate('role')

    if (!user) return sendError(res, 'User not found', 'USER_NOT_FOUND', 404)

    if (before) {
      const changes = []
      if (updates.name !== undefined && updates.name !== before.name) {
        changes.push(`name "${before.name}" → "${updates.name}"`)
      }
      if (updates.email !== undefined && updates.email !== before.email) {
        changes.push(`email "${before.email}" → "${updates.email}"`)
      }
      if (changes.length) {
        writeAuditLog({
          action: 'user_updated',
          performedBy: req.user._id,
          targetEntity: `User: ${user.name}`,
          department: user.department,
          ipAddress: req.ip,
          detail: `${req.user.name} updated ${changes.join(' and ')}`,
          metadata: { userId: String(user._id) }
        })
      }
    }

    if (wantsPasswordChange) {
      // Load the document so the pre('save') hook hashes the new password with
      // bcrypt — findByIdAndUpdate would skip the hook and store it in plaintext.
      const doc = await User.findById(req.params.id)
      if (doc) {
        doc.password = newPassword
        await doc.save()
        writeAuditLog({
          action: 'user_updated',
          performedBy: req.user._id,
          targetEntity: `User: ${user.name}`,
          department: user.department,
          ipAddress: req.ip,
          detail: `${req.user.name} reset the password for ${user.name}`,
          metadata: { userId: String(user._id), passwordReset: true }
        })
      }
    }

    return sendSuccess(res, { user })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/users/:id  (soft delete: isActive = false)
router.delete('/:id', protect, roleGuard('Admin'), async (req, res, next) => {
  try {
    if (sameId(req.params.id, req.user._id)) {
      return sendError(res, 'You cannot deactivate your own account', 'CANNOT_DEACTIVATE_SELF', 400)
    }

    const target = await User.findById(req.params.id).select('isProtected').lean()
    if (target?.isProtected) {
      return sendError(res, 'This account is protected and cannot be deactivated', 'USER_PROTECTED', 403)
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password').populate('role')

    if (!user) return sendError(res, 'User not found', 'USER_NOT_FOUND', 404)

    return sendSuccess(res, { message: 'User deactivated', user })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/users/:id/permanent  (HARD delete: removes the user from the DB)
// Detaches the user from anyone who reports to them / has them as HR partner so
// the org chart and approval routing never point at a deleted account.
router.delete('/:id/permanent', protect, roleGuard('Admin'), async (req, res, next) => {
  try {
    if (sameId(req.params.id, req.user._id)) {
      return sendError(res, 'You cannot delete your own account', 'CANNOT_DELETE_SELF', 400)
    }

    const target = await User.findById(req.params.id).populate('role').lean()
    if (!target) return sendError(res, 'User not found', 'USER_NOT_FOUND', 404)
    if (target.isProtected) {
      return sendError(res, 'This account is protected and cannot be deleted', 'USER_PROTECTED', 403)
    }

    const [mgrCleared, hrCleared] = await Promise.all([
      User.updateMany({ managerId: target._id }, { $unset: { managerId: 1 } }),
      User.updateMany({ hrId: target._id }, { $unset: { hrId: 1 } })
    ])

    await User.deleteOne({ _id: target._id })

    writeAuditLog({
      action: 'user_deleted',
      performedBy: req.user._id,
      targetEntity: `User: ${target.name} <${target.email}>`,
      department: target.department,
      ipAddress: req.ip,
      detail: `${req.user.name} permanently deleted ${target.name} (${target.role?.name || 'no role'})`,
      metadata: {
        deletedUserId: String(target._id),
        reportsDetached: mgrCleared.modifiedCount,
        hrLinksDetached: hrCleared.modifiedCount
      }
    })

    return sendSuccess(res, {
      message: 'User permanently deleted',
      detached: { reports: mgrCleared.modifiedCount, hrLinks: hrCleared.modifiedCount }
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/users/:id/assign-role
router.post('/:id/assign-role', protect, roleGuard('Admin'), async (req, res, next) => {
  try {
    const { roleId } = req.body
    if (!roleId) return sendError(res, 'roleId is required', 'MISSING_ROLE', 400)

    if (sameId(req.params.id, req.user._id)) {
      return sendError(res, 'You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE', 400)
    }

    const targetUser = await User.findById(req.params.id).populate('role')
    if (!targetUser) return sendError(res, 'User not found', 'USER_NOT_FOUND', 404)
    if (targetUser.isProtected) {
      return sendError(res, 'This account is protected and its role cannot be changed', 'USER_PROTECTED', 403)
    }

    const newRole = await Role.findById(roleId).lean()
    if (!newRole) return sendError(res, 'Role not found', 'ROLE_NOT_FOUND', 404)

    const previousRoleName = targetUser.role?.name || 'None'
    targetUser.role = newRole._id
    await targetUser.save({ validateBeforeSave: false })
    await targetUser.populate('role')

    writeAuditLog({
      action: 'role_changed',
      performedBy: req.user._id,
      targetEntity: `User: ${targetUser.name}`,
      department: targetUser.department,
      ipAddress: req.ip,
      detail: `${req.user.name} changed ${targetUser.name}'s role from ${previousRoleName} to ${newRole.name}`,
      metadata: { previousRole: previousRoleName, newRole: newRole.name }
    })

    return sendSuccess(res, { user: targetUser.toJSON() })
  } catch (err) {
    next(err)
  }
})

module.exports = router

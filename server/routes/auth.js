// M1 - Phase 2 - routes/auth.js
// Register / login / me / logout. Issues stateless JWTs signed with JWT_SECRET.

const express = require('express')
const jwt = require('jsonwebtoken')

const User = require('../models/User')
const Role = require('../models/Role')
const { protect } = require('../middleware/auth')
const { sendSuccess, sendError } = require('../utils/apiResponse')

const router = express.Router()

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  })

const DEPARTMENTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal']

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, department, roleId } = req.body

    if (!name || !email || !password || !department) {
      return sendError(res, 'name, email, password and department are required', 'MISSING_FIELDS', 400)
    }
    if (!DEPARTMENTS.includes(department)) {
      return sendError(res, `department must be one of: ${DEPARTMENTS.join(', ')}`, 'INVALID_DEPARTMENT', 400)
    }
    if (String(password).length < 6) {
      return sendError(res, 'password must be at least 6 characters', 'PASSWORD_TOO_SHORT', 400)
    }

    const normalisedEmail = String(email).toLowerCase().trim()
    const exists = await User.findOne({ email: normalisedEmail }).lean()
    if (exists) {
      return sendError(res, 'Email already registered', 'EMAIL_EXISTS', 400)
    }

    let resolvedRoleId = roleId
    if (!resolvedRoleId) {
      // Bootstrap: if the database has no users yet, promote the first one
      // to Admin so they can manage everyone else. Everyone after that is
      // an Employee by default; the Admin upgrades them from the Admin Panel.
      const existingUsers = await User.countDocuments({})
      const defaultRoleName = existingUsers === 0 ? 'Admin' : 'Employee'

      const defaultRole = await Role.findOne({ name: defaultRoleName }).lean()
      if (!defaultRole) {
        return sendError(res, 'Default role not configured. Run `npm run seed` first.', 'NO_DEFAULT_ROLE', 500)
      }
      resolvedRoleId = defaultRole._id
    }

    const user = new User({
      name,
      email: normalisedEmail,
      password,
      department,
      role: resolvedRoleId
    })
    await user.save()
    await user.populate('role')

    const token = signToken(user._id)
    return sendSuccess(res, { token, user: user.toJSON() }, 201)
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return sendError(res, 'email and password are required', 'MISSING_CREDENTIALS', 400)
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).populate('role')
    if (!user) {
      return sendError(res, 'Invalid email or password', 'INVALID_CREDENTIALS', 401)
    }
    if (user.isActive === false) {
      return sendError(res, 'Account is deactivated', 'ACCOUNT_DEACTIVATED', 401)
    }

    const ok = await user.comparePassword(password)
    if (!ok) {
      return sendError(res, 'Invalid email or password', 'INVALID_CREDENTIALS', 401)
    }

    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    const token = signToken(user._id)
    return sendSuccess(res, { token, user: user.toJSON() })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  return sendSuccess(res, { user: req.user })
})

// POST /api/auth/logout
// JWT is stateless — server just acknowledges. Client deletes the token.
router.post('/logout', protect, async (req, res) => {
  return sendSuccess(res, { message: 'Logged out successfully' })
})

module.exports = router

// Shared - Phase 2 - middleware/auth.js
// JWT bearer-token verification. Used by every protected route.

const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  try {
    let token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, no token',
        code: 'NO_TOKEN'
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('role')
      .lean()

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User no longer exists',
        code: 'USER_NOT_FOUND'
      })
    }

    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      })
    }

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Token invalid or expired',
      code: 'INVALID_TOKEN'
    })
  }
}

module.exports = { protect }

// Shared - Phase 2 - middleware/auth.js
// JWT bearer-token verification. Used by every protected route.

const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { resolveTenantForUser } = require('./tenant')
const { checkRequest } = require('./licence')
const { checkShellScope } = require('./shellScope')
const { runWithOrgId } = require('../tenancy/tenantContext')

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

    // Token revocation: reject if the token's version is behind the user's
    // current tokenVersion (logout, password reset, deactivation, role change).
    if ((decoded.tv || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        error: 'Session ended. Please sign in again.',
        code: 'TOKEN_REVOKED'
      })
    }

    // Session validation: reject if the token contains a sessionId (sid)
    // but it's no longer in the user's activeSessions array (single device logout).
    if (decoded.sid && (!user.activeSessions || !user.activeSessions.includes(decoded.sid))) {
      return res.status(401).json({
        success: false,
        error: 'Device session ended. Please sign in again.',
        code: 'SESSION_REVOKED'
      })
    }
    
    // Store current sessionId on the request so the logout route can remove it.
    if (decoded.sid) {
      user.currentSessionId = decoded.sid
    }

    // Multi-tenancy: resolve the user's organization (middleware/tenant.js)
    // and attach it so downstream code can scope every query by req.orgId.
    const tenantResult = await resolveTenantForUser(user)
    if (!tenantResult.ok) {
      return res.status(tenantResult.status).json({
        success: false,
        error: tenantResult.error,
        code: tenantResult.code
      })
    }

    req.user = user
    req.organization = tenantResult.org
    req.orgId = tenantResult.org ? tenantResult.org._id : null

    const requestPath = (req.originalUrl || req.url || '').split('?')[0]

    // Shell scoping: platform staff stay in the platform console — see
    // middleware/shellScope.
    const scopeBlock = checkShellScope({ user, path: requestPath })
    if (scopeBlock) {
      return res.status(scopeBlock.status).json({
        success: false,
        error: scopeBlock.error,
        code: scopeBlock.code
      })
    }

    // Licensing: an expired tenant is read-only. Checked here because this is the
    // one place every authenticated request goes through — see middleware/licence.
    const licenceBlock = checkRequest({
      org: req.organization,
      method: req.method,
      path: requestPath
    })
    if (licenceBlock) {
      return res.status(licenceBlock.status).json({
        success: false,
        error: licenceBlock.error,
        code: licenceBlock.code,
        ...licenceBlock.extra
      })
    }

    // Run the rest of the request inside the ambient tenant context so the
    // org-scope plugin auto-filters every query and stamps every create —
    // including async work the handlers kick off (workflow engine,
    // notifications, audit logs).
    if (req.orgId) return runWithOrgId(req.orgId, () => next())
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

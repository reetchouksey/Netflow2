// Rate limiting for sensitive auth endpoints. In-memory store (per-process) —
// fine for a single instance. For multi-instance, swap in a shared store
// (e.g. rate-limit-redis) without changing call sites.

const rateLimit = require('express-rate-limit')

// Login / forgot / reset: brute-force protection per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  max: 5,                  // 5 requests per IP per window
  // Don't count successful logins against the limit — only failures/attempts
  // that keep hammering the endpoint matter. (Applies to any 2xx.)
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many attempts. Please wait a few minutes and try again.',
      code: 'RATE_LIMITED'
    })
  }
})

module.exports = { authLimiter }

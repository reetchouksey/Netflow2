// Shared - Phase 2 - server.js
// NetFlow main HTTP entry point.

const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const dotenv = require('dotenv')

dotenv.config()

const connectDB = require('./config/db')
const errorHandler = require('./middleware/errorHandler')

if (String(process.env.DMS_ENABLED || '').toLowerCase() !== 'true') {
  console.warn('[dms] DMS_ENABLED is not true — uploads stay on local disk. Set DMS_ENABLED=true + DMS_API_URL + DMS_API_KEY to use BaseLayer DMS.')
} else if (!process.env.DMS_API_URL || !process.env.DMS_API_KEY) {
  console.warn('[dms] DMS_ENABLED=true but DMS_API_URL or DMS_API_KEY is missing — uploads will fail until configured.')
} else {
  console.log('[dms] BaseLayer DMS integration enabled →', String(process.env.DMS_API_URL).replace(/\/$/, ''))
}

const app = express()

// Trust the first proxy hop so rate-limiting sees the real client IP
// (needed when deployed behind Nginx / a platform load balancer).
app.set('trust proxy', 1)

connectDB().then(async () => {
  // Load subscription plans from DB to memory
  const { reloadPlans } = require('./config/plans')
  try {
    await reloadPlans()
    console.log('Plans loaded from DB')
  } catch (err) {
    console.error('Failed to load plans from DB', err)
  }

  // DISABLE_CRON=1 skips the hourly escalation sweep — used by the automated
  // test server so a shared/production database is never swept during a run.
  if (process.env.DISABLE_CRON === '1') {
    console.log('Background jobs disabled (DISABLE_CRON=1)')
    return
  }
  const { startEscalationCron } = require('./jobs/escalationCron')
  startEscalationCron()
  console.log('Escalation cron started')
  const { startTimerCron } = require('./jobs/timerCron')
  startTimerCron()
  console.log('Timer cron started (every minute)')
  const { startLicenceCron } = require('./jobs/licenceCron')
  startLicenceCron()
  const { startUsageCron } = require('./jobs/usageCron')
  startUsageCron()
})

app.use(helmet())
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
app.use(cors({
  origin: (origin, cb) => {
    // No origin = curl/server-to-server. Allow in dev.
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    if (process.env.NODE_ENV !== 'production') return cb(null, true)
    return cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true
}))
app.use(morgan('dev'))
// Capture raw body for /api/hooks HMAC verification (X-NetFlow-Signature).
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/hooks')) {
      req.rawBody = Buffer.from(buf)
    }
  }
}))
app.use(express.urlencoded({ extended: false }))

// Attachments uploaded from now on are org-scoped and access-checked — see
// routes/files.js. Mounted before the API routers because it authenticates
// itself (a signed URL or a bearer token) and must keep working while a tenant
// is read-only.
app.use('/api/files', require('./routes/files'))

// Legacy attachments: everything uploaded before per-org storage landed sits in
// one flat, publicly-served directory. Those URLs are embedded in existing form
// data, so removing the mount would break historical submissions. Run
// `npm run migrate:uploads` to move them into org folders and rewrite the stored
// URLs, then set SERVE_LEGACY_UPLOADS=0 to close this door for good.
if (process.env.SERVE_LEGACY_UPLOADS !== '0') {
  app.use(
    '/uploads',
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
    // Flat files only. Without this, /uploads/<orgId>/<file> would walk straight
    // into the per-org directories and undo the access control above.
    (req, res, next) => {
      const rel = String(req.path || '').replace(/^\/+/, '')
      if (!rel || rel.includes('/')) {
        return res.status(404).json({ success: false, error: 'File not found', code: 'FILE_NOT_FOUND' })
      }
      next()
    },
    express.static(path.join(__dirname, 'uploads'), {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
    })
  )
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'flowsphere-server',
    env: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

// Routes — M1
app.use('/api/auth', require('./routes/auth'))
app.use('/api/users', require('./routes/users'))
app.use('/api/roles', require('./routes/roles'))
// Routes — Shell 2 (an Org Admin configuring their own tenant)
app.use('/api/departments', require('./routes/departments'))
app.use('/api/organization', require('./routes/organization'))
app.use('/api/forms', require('./routes/forms'))
app.use('/api/uploads', require('./routes/uploads'))
app.use('/api/dms', require('./routes/dms'))
app.use('/api/s3', require('./routes/s3'))

// Public (unauthenticated) form links — collect data from non-users.
app.use('/api/public', require('./routes/public'))

// Inbound webhook triggers (n8n-style) — external forms POST here to start a run.
app.use('/api/hooks', require('./routes/hooks'))

// Routes — M2
app.use('/api/workflows', require('./routes/workflows'))

// Routes — Shell 3 (a leader operating: approvals, their team, reports)
app.use('/api/team', require('./routes/team'))

// Routes — M3
app.use('/api/tasks', require('./routes/tasks'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/broadcasts', require('./routes/broadcasts'))
app.use('/api/audit-logs', require('./routes/auditLogs'))
app.use('/api/analytics', require('./routes/analytics'))

// Routes — Licensing (a tenant reading its own licence state and usage meters)
app.use('/api/usage', require('./routes/usage'))

// Routes — AI-01 (Approval-Routing AI / Delegation-of-Authority)
// Routes — AI-02 (In-app AI assistant chatbot)
app.use('/api/assistant', require('./routes/assistant'))

// Routes — Multi-tenancy (platform-level org management, SuperAdmin only)
app.use('/api/platform', require('./routes/platform'))

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND'
  })
})

app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`NetFlow server running on port ${PORT}`)
})

module.exports = app

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

const app = express()

connectDB().then(() => {
  const { startEscalationCron } = require('./jobs/escalationCron')
  startEscalationCron()
  console.log('Escalation cron started')
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
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: false }))

// Serve uploaded form attachments. crossOriginResourcePolicy is relaxed so the
// frontend (different origin in dev) can load/download them.
app.use(
  '/uploads',
  helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
  express.static(path.join(__dirname, 'uploads'))
)

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
app.use('/api/forms', require('./routes/forms'))
app.use('/api/uploads', require('./routes/uploads'))

// Public (unauthenticated) form links — collect data from non-users.
app.use('/api/public', require('./routes/public'))

// Routes — M2
app.use('/api/workflows', require('./routes/workflows'))

// Routes — M3
app.use('/api/tasks', require('./routes/tasks'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/audit-logs', require('./routes/auditLogs'))
app.use('/api/analytics', require('./routes/analytics'))

// Routes — AI-01 (Approval-Routing AI / Delegation-of-Authority)
app.use('/api/approval-routing', require('./routes/approvalRouting'))

// Routes — AI-02 (In-app AI assistant chatbot)
app.use('/api/assistant', require('./routes/assistant'))

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

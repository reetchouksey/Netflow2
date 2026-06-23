// seeds/seedExecutions.js
// Seeds ~450 WorkflowExecution documents spread across the last 90 days so the
// Dashboard analytics come alive: stat cards (Completed / In Progress / On Hold),
// SLA Compliance, the Workflow Activity chart (7/30/90 day windows) and the
// Average Completion Time trend.
//
// Idempotent: every seeded doc is tagged `variables._seed = true`. Re-running
// first deletes the previously seeded executions, so it never piles up
// duplicates and never touches real executions created through the app.
//
// Run with:  node seeds/seedExecutions.js   (or npm run seed:exec)

require('dotenv').config()

const mongoose = require('mongoose')

const Workflow          = require('../models/Workflow')
const WorkflowExecution = require('../models/WorkflowExecution')
const User              = require('../models/User')

// ─── helpers ──────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const HOUR = 60 * 60 * 1000
const DAY  = 24 * HOUR

const FAIL_REASONS = [
  'Approver did not respond within SLA',
  'Form validation failed at review step',
  'Rejected by finance — budget exceeded',
  'Missing supporting documents',
  'Cancelled by requester',
]

// weighted pick: pairs = [[value, weight], ...]
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [val, w] of pairs) {
    if ((r -= w) <= 0) return val
  }
  return pairs[0][0]
}

// Pick a non-terminal node id (approval/condition/etc.) for in-flight executions.
const middleNodeId = (wf) => {
  const mids = (wf.nodes || []).filter((n) => n.type !== 'start' && n.type !== 'end')
  return mids.length ? pick(mids).id : 'start'
}

// ─── main ──────────────────────────────────────────────────────────────────────
const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set. Create server/.env first.')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 })
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

  const workflows = await Workflow.find().select('_id title nodes department').lean()
  if (!workflows.length) {
    console.error('No workflows found. Run `npm run seed:demo` first.')
    process.exit(1)
  }

  const users = await User.find().select('_id name').lean()
  if (!users.length) {
    console.error('No users found. Register at least one account first.')
    process.exit(1)
  }
  console.log(`Found ${workflows.length} workflows and ${users.length} users.`)

  // Idempotency: clear previously seeded executions.
  const del = await WorkflowExecution.deleteMany({ 'variables._seed': true })
  if (del.deletedCount) console.log(`Removed ${del.deletedCount} previously seeded executions.`)

  const now = Date.now()
  const DAYS_BACK = 90
  const docs = []

  for (let dayOffset = DAYS_BACK - 1; dayOffset >= 0; dayOffset--) {
    // A little more volume on recent days so the 7-day chart looks active.
    const perDay = dayOffset <= 14 ? rand(4, 11) : rand(2, 7)

    for (let i = 0; i < perDay; i++) {
      const wf   = pick(workflows)
      const user = pick(users)

      // createdAt = that calendar day, at a random business-ish hour.
      const created = new Date(now - dayOffset * DAY)
      created.setHours(rand(8, 19), rand(0, 59), rand(0, 59), 0)
      if (created.getTime() > now) created.setTime(now - rand(1, 60) * 60 * 1000)

      // Recent items can still be in-flight; older ones must have resolved.
      const status = dayOffset <= 10
        ? weighted([['completed', 45], ['running', 25], ['paused', 15], ['failed', 15]])
        : weighted([['completed', 80], ['failed', 20]])

      const doc = {
        workflowId: wf._id,
        triggeredBy: user._id,
        status,
        startedAt: created,
        createdAt: created,
        updatedAt: created,
        variables: { _seed: true, department: wf.department || 'General' },
        executionLog: [{
          nodeId: 'start',
          nodeType: 'start',
          enteredAt: created,
          exitedAt: created,
          status: 'completed',
        }],
      }

      if (status === 'completed') {
        // 75% finish within the 7-day SLA, 25% breach it (capped at "now").
        const withinSla = Math.random() < 0.75
        const dur = withinSla
          ? rand(2, Math.round(6.5 * 24)) * HOUR      // 2h .. 6.5 days
          : rand(Math.round(7.5 * 24), 18 * 24) * HOUR // 7.5 .. 18 days
        let completed = created.getTime() + dur
        if (completed > now) completed = now - rand(1, 120) * 60 * 1000
        doc.completedAt = new Date(completed)
        doc.updatedAt   = new Date(completed)
        doc.currentNodeId = 'end'
      } else if (status === 'failed') {
        let failed = created.getTime() + rand(1, 5 * 24) * HOUR
        if (failed > now) failed = now - rand(1, 120) * 60 * 1000
        doc.failedAt = new Date(failed)
        doc.updatedAt = new Date(failed)
        doc.failureReason = pick(FAIL_REASONS)
        doc.currentNodeId = middleNodeId(wf)
      } else {
        // running / paused — still in flight, sitting on a middle node.
        doc.currentNodeId = middleNodeId(wf)
      }

      docs.push(doc)
    }
  }

  // timestamps:false so our historical createdAt / updatedAt are honored
  // (otherwise Mongoose overwrites them with "now").
  await WorkflowExecution.insertMany(docs, { timestamps: false })

  // ─── summary report ───
  const byStatus = docs.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc }, {})
  console.log(`\nInserted ${docs.length} executions:`)
  console.log(`  completed : ${byStatus.completed || 0}`)
  console.log(`  running   : ${byStatus.running   || 0}`)
  console.log(`  paused    : ${byStatus.paused    || 0}`)
  console.log(`  failed    : ${byStatus.failed    || 0}`)
  console.log('\nDone. Refresh the Dashboard to see the analytics populate.')

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

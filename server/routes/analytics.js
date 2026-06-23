// M3 - Phase 2 - routes/analytics.js
// Read-only aggregate views: summary, completion-time, sla-breaches,
// approval-rate, department-kpis. All protected for Manager+ roles.

const express = require('express')

const Task = require('../models/Task')
const Form = require('../models/Form')
const Workflow = require('../models/Workflow')
const WorkflowExecution = require('../models/WorkflowExecution')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess } = require('../utils/apiResponse')

const router = express.Router()

router.use(protect)

// Routes used by the Dashboard are open to all authenticated users.
// The more detailed analytics routes (sla-breaches, department-kpis) are
// restricted to Manager+ roles and add their own guard inline.

const STATUS_COLOR = {
  approved: '#22c55e',
  rejected: '#ef4444',
  escalated: '#f97316',
  pending: '#94a3b8',
  completed: '#0ea5e9'
}
const STATUS_LABEL = {
  approved: 'Approved',
  rejected: 'Rejected',
  escalated: 'Escalated',
  pending: 'Pending',
  completed: 'Completed'
}

const parseBoundary = (input, end = false) => {
  if (!input) return null
  const d = new Date(input)
  if (isNaN(d.getTime())) return null
  if (end) d.setUTCHours(23, 59, 59, 999)
  else d.setUTCHours(0, 0, 0, 0)
  return d
}

const buildDateFilter = (req) => {
  const fromDate = parseBoundary(req.query.from, false)
  const toDate = parseBoundary(req.query.to, true)
  const filter = {}
  if (fromDate || toDate) {
    filter.createdAt = {}
    if (fromDate) filter.createdAt.$gte = fromDate
    if (toDate) filter.createdAt.$lte = toDate
  }
  return filter
}

// GET /api/analytics/summary
router.get('/summary', async (req, res, next) => {
  try {
    const dateFilter = buildDateFilter(req)

    const SLA_MS = 7 * 24 * 60 * 60 * 1000 // 7-day SLA window in milliseconds

    const [
      totalExecutions,
      runningExecutions,
      completedExecutions,
      pausedExecutions,
      pendingTasks,
      totalForms,
      totalWorkflows,
      approvalAgg,
      slaAgg
    ] = await Promise.all([
      WorkflowExecution.countDocuments(dateFilter),
      WorkflowExecution.countDocuments({ ...dateFilter, status: 'running' }),
      WorkflowExecution.countDocuments({ ...dateFilter, status: 'completed' }),
      WorkflowExecution.countDocuments({ ...dateFilter, status: 'paused' }),
      Task.countDocuments({ ...dateFilter, status: 'pending' }),
      Form.countDocuments(),
      Workflow.countDocuments({}),
      Task.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: ['approved', 'rejected'] }
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // SLA compliance: % of completed executions finished within 7 days
      WorkflowExecution.aggregate([
        {
          $match: {
            ...dateFilter,
            status: 'completed',
            completedAt: { $exists: true, $ne: null }
          }
        },
        {
          $project: {
            withinSla: {
              $lte: [{ $subtract: ['$completedAt', '$startedAt'] }, SLA_MS]
            }
          }
        },
        {
          $group: {
            _id: null,
            total:     { $sum: 1 },
            withinSla: { $sum: { $cond: ['$withinSla', 1, 0] } }
          }
        }
      ])
    ])

    let approved = 0
    let rejected = 0
    for (const row of approvalAgg) {
      if (row._id === 'approved') approved = row.count
      if (row._id === 'rejected') rejected = row.count
    }
    const decisionTotal = approved + rejected
    const approvalRate = decisionTotal > 0
      ? Math.round((approved / decisionTotal) * 100)
      : 0

    const slaRow = slaAgg[0]
    const slaCompliance = slaRow && slaRow.total > 0
      ? Math.round((slaRow.withinSla / slaRow.total) * 100)
      : null

    return sendSuccess(res, {
      summary: {
        totalWorkflows,
        totalExecutions,
        runningExecutions,
        completedExecutions,
        pausedExecutions,
        pendingTasks,
        totalForms,
        approvedTasks: approved,
        rejectedTasks: rejected,
        approvalRate,
        slaCompliance
      }
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/analytics/completion-time
router.get('/completion-time', async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months) || 6))
    const cutoff = new Date()
    cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
    cutoff.setUTCDate(1)
    cutoff.setUTCHours(0, 0, 0, 0)

    const rows = await WorkflowExecution.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $ne: null },
          createdAt: { $gte: cutoff }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          avgMs: { $avg: { $subtract: ['$completedAt', '$createdAt'] } },
          totalCompleted: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])

    const result = rows.map(r => ({
      year: r._id.year,
      month: r._id.month,
      label: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
      avgDays: Number(((r.avgMs || 0) / 86400000).toFixed(2)),
      totalCompleted: r.totalCompleted
    }))

    return sendSuccess(res, { series: result })
  } catch (err) {
    next(err)
  }
})

// GET /api/analytics/sla-breaches
router.get('/sla-breaches', roleGuard('Admin', 'CEO', 'Manager', 'HR', 'VP'), async (req, res, next) => {
  try {
    const weeks = Math.min(52, Math.max(1, parseInt(req.query.weeks) || 8))
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7)
    cutoff.setUTCHours(0, 0, 0, 0)

    const rows = await Task.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoff },
          dueDate: { $ne: null },
          $expr: { $gt: ['$updatedAt', '$dueDate'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $isoWeekYear: '$createdAt' },
            week: { $isoWeek: '$createdAt' }
          },
          breaches: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ])

    const result = rows.map(r => ({
      year: r._id.year,
      week: r._id.week,
      label: `${r._id.year}-W${String(r._id.week).padStart(2, '0')}`,
      breaches: r.breaches,
      target: 5
    }))

    return sendSuccess(res, { series: result })
  } catch (err) {
    next(err)
  }
})

// GET /api/analytics/approval-rate
router.get('/approval-rate', async (req, res, next) => {
  try {
    const dateFilter = buildDateFilter(req)
    const rows = await Task.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])

    const result = rows.map(r => ({
      status: r._id,
      label: STATUS_LABEL[r._id] || r._id,
      count: r.count,
      color: STATUS_COLOR[r._id] || '#64748b'
    }))

    return sendSuccess(res, { distribution: result })
  } catch (err) {
    next(err)
  }
})

// GET /api/analytics/activity?days=7|30|90
// Returns per-day counts of completed / running / paused executions for the
// chart. Every day in the requested window is included (zeros filled in so
// the chart always renders a full, contiguous series).
//
// All dates are bucketed in IST (Asia/Kolkata, UTC+5:30) so they match what
// the user sees in their browser. Today's inProgress / onHold values are
// overwritten with real-time live counts so executions started before the
// window still appear correctly on today's bar.
router.get('/activity', async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7))
    const TZ = 'Asia/Kolkata'
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // UTC+5:30

    // Compute "today" and "cutoff" in IST.
    const nowUtc = Date.now()
    const nowIst = new Date(nowUtc + IST_OFFSET_MS)
    const todayIst = nowIst.toISOString().slice(0, 10)   // YYYY-MM-DD in IST

    // cutoff = start of (today - days + 1) in IST → convert back to UTC for $match
    const cutoffIst = new Date(nowUtc + IST_OFFSET_MS)
    cutoffIst.setDate(cutoffIst.getDate() - days + 1)
    cutoffIst.setHours(0, 0, 0, 0)
    const cutoffUtc = new Date(cutoffIst.getTime() - IST_OFFSET_MS)

    // Historical aggregation: group by local (IST) date + status
    const [rows, liveRunning, livePaused] = await Promise.all([
      WorkflowExecution.aggregate([
        { $match: { createdAt: { $gte: cutoffUtc } } },
        {
          $group: {
            _id: {
              day:    { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
              status: '$status'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.day': 1 } }
      ]),
      // Real-time counts for currently active executions (any start date)
      WorkflowExecution.countDocuments({ status: 'running' }),
      WorkflowExecution.countDocuments({ status: 'paused'  }),
    ])

    // Build the full day range keyed by IST date string, all zeros initially.
    const dayMap = new Map()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(nowUtc + IST_OFFSET_MS)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, { isoDate: key, completed: 0, inProgress: 0, onHold: 0, failed: 0 })
    }

    // Fill in historical counts from the aggregation.
    for (const row of rows) {
      const { day, status } = row._id
      const entry = dayMap.get(day)
      if (!entry) continue
      if (status === 'completed')    entry.completed  += row.count
      else if (status === 'running') entry.inProgress += row.count
      else if (status === 'paused')  entry.onHold     += row.count
      else if (status === 'failed')  entry.failed     += row.count
    }

    // Overwrite today's live values with real-time counts so executions that
    // started before the window still appear on today's bar.
    const todayEntry = dayMap.get(todayIst)
    if (todayEntry) {
      todayEntry.inProgress = Math.max(todayEntry.inProgress, liveRunning)
      todayEntry.onHold     = Math.max(todayEntry.onHold,     livePaused)
    }

    return sendSuccess(res, { series: [...dayMap.values()] })
  } catch (err) {
    next(err)
  }
})

// GET /api/analytics/department-kpis
router.get('/department-kpis', roleGuard('Admin', 'CEO', 'Manager', 'HR', 'VP'), async (req, res, next) => {
  try {
    const dateFilter = buildDateFilter(req)

    const rows = await Task.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'submittedBy',
          foreignField: '_id',
          as: 'submitter'
        }
      },
      { $unwind: { path: '$submitter', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$submitter.department',
          totalRequests: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          escalated: {
            $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] }
          },
          slaBreaches: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ['$dueDate', false] },
                    { $gt: ['$updatedAt', '$dueDate'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          avgCompletionMs: {
            $avg: {
              $cond: [
                { $in: ['$status', ['approved', 'rejected', 'completed']] },
                { $subtract: ['$updatedAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          totalRequests: 1,
          approved: 1,
          rejected: 1,
          escalated: 1,
          slaBreaches: 1,
          avgCompletionDays: {
            $cond: [
              { $gt: ['$avgCompletionMs', 0] },
              { $round: [{ $divide: ['$avgCompletionMs', 86400000] }, 2] },
              0
            ]
          },
          complianceRate: {
            $cond: [
              { $gt: ['$totalRequests', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          { $subtract: ['$totalRequests', '$slaBreaches'] },
                          '$totalRequests'
                        ]
                      },
                      100
                    ]
                  },
                  1
                ]
              },
              0
            ]
          }
        }
      },
      { $sort: { department: 1 } }
    ])

    return sendSuccess(res, { kpis: rows })
  } catch (err) {
    next(err)
  }
})

module.exports = router

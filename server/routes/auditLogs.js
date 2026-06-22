// M3 - Phase 2 - routes/auditLogs.js
// Server-side query for the Audit Log Viewer. Supports search + action +
// department + date range, with manual skip/limit pagination.

const express = require('express')

const AuditLog = require('../models/AuditLog')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess } = require('../utils/apiResponse')

const router = express.Router()

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const parseDayBoundary = (input, end = false) => {
  if (!input) return null
  const d = new Date(input)
  if (isNaN(d.getTime())) return null
  if (end) d.setUTCHours(23, 59, 59, 999)
  else d.setUTCHours(0, 0, 0, 0)
  return d
}

// GET /api/audit-logs
router.get(
  '/',
  protect,
  roleGuard('Admin', 'CEO', 'Manager', 'HR', 'VP'),
  async (req, res, next) => {
    try {
      const { search, action, department, from, to } = req.query
      const page = Math.max(1, parseInt(req.query.page) || 1)
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 10))

      const query = {}
      if (action) query.action = action
      if (department) query.department = department

      if (search) {
        const regex = new RegExp(escapeRegex(String(search).trim()), 'i')
        query.$or = [
          { targetEntity: regex },
          { detail: regex }
        ]
      }

      const fromDate = parseDayBoundary(from, false)
      const toDate = parseDayBoundary(to, true)
      if (fromDate || toDate) {
        query.createdAt = {}
        if (fromDate) query.createdAt.$gte = fromDate
        if (toDate) query.createdAt.$lte = toDate
      }

      const [total, logs] = await Promise.all([
        AuditLog.countDocuments(query),
        AuditLog.find(query)
          .populate({
            path: 'performedBy',
            select: 'name email department',
            populate: { path: 'role', select: 'name' }
          })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
      ])

      return sendSuccess(res, {
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        count: logs.length,
        logs
      })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router

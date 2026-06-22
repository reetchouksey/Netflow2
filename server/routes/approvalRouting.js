// AI-01 - routes/approvalRouting.js
// HTTP surface for #01 Approval-Routing AI (Delegation-of-Authority).
//   GET  /api/approval-routing/status   -> is the LLM configured + which model
//   POST /api/approval-routing/infer    -> preview the inferred approver chain
//   GET  /api/approval-routing/doa      -> list DoA matrix rules
//   POST /api/approval-routing/doa      -> create/update a DoA rule (elevated)
// Reads are protected; DoA mutations require an elevated builder role.

const express = require('express')

const DoA = require('../models/DelegationOfAuthority')
const { protect } = require('../middleware/auth')
const { roleGuard } = require('../middleware/roleGuard')
const { sendSuccess, sendError } = require('../utils/apiResponse')
const { inferApproverChain } = require('../utils/approverInference')
const { isConfigured, getModel } = require('../utils/llm')

const router = express.Router()

const DOA_EDITORS = ['Admin', 'CEO', 'Manager', 'HR', 'VP']

// GET /api/approval-routing/status
router.get('/status', protect, (req, res) => {
  return sendSuccess(res, { llmConfigured: isConfigured(), model: getModel() })
})

// POST /api/approval-routing/infer
// Body: { department?, category?, amount?, currency?, description?, submitterId? }
// Defaults the submitter to the caller so it works out of the box for testing.
router.post('/infer', protect, async (req, res, next) => {
  try {
    const { department, category, amount, currency, description, submitterId } = req.body || {}
    const result = await inferApproverChain({
      department,
      category,
      amount: Number(amount) || 0,
      currency,
      description,
      submitterId: submitterId || req.user._id
    })
    return sendSuccess(res, { routing: result })
  } catch (err) {
    return next(err)
  }
})

// GET /api/approval-routing/doa
router.get('/doa', protect, async (req, res, next) => {
  try {
    const query = {}
    if (req.query.department) query.department = req.query.department
    if (req.query.category) query.category = req.query.category
    if (req.query.active === 'true') query.isActive = true
    const rules = await DoA.find(query).sort({ priority: -1, department: 1, minAmount: 1 }).lean()
    return sendSuccess(res, { rules, count: rules.length })
  } catch (err) {
    return next(err)
  }
})

// POST /api/approval-routing/doa
// Upserts a DoA rule by name. Body mirrors the DelegationOfAuthority schema.
router.post('/doa', protect, roleGuard(...DOA_EDITORS), async (req, res, next) => {
  try {
    const {
      name, description, department, category,
      minAmount, maxAmount, currency, approverChain, priority, isActive
    } = req.body || {}

    if (!name || !String(name).trim()) {
      return sendError(res, 'A rule "name" is required', 'VALIDATION_ERROR', 422)
    }
    if (!Array.isArray(approverChain) || approverChain.length === 0) {
      return sendError(res, 'approverChain must be a non-empty array of { order, role }', 'VALIDATION_ERROR', 422)
    }

    const update = {
      ...(description !== undefined && { description }),
      ...(department !== undefined && { department }),
      ...(category !== undefined && { category }),
      ...(minAmount !== undefined && { minAmount }),
      ...(maxAmount !== undefined && { maxAmount }),
      ...(currency !== undefined && { currency }),
      ...(priority !== undefined && { priority }),
      ...(isActive !== undefined && { isActive }),
      approverChain
    }

    const rule = await DoA.findOneAndUpdate(
      { name: String(name).trim() },
      { $set: update, $setOnInsert: { name: String(name).trim() } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    )
    return sendSuccess(res, { rule }, 201)
  } catch (err) {
    if (err.name === 'ValidationError') {
      return sendError(res, err.message, 'VALIDATION_ERROR', 422)
    }
    return next(err)
  }
})

module.exports = router

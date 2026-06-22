// M1 - Phase 2 - routes/roles.js
// Read-only catalogue endpoint. Seed populates 5 roles once.

const express = require('express')

const Role = require('../models/Role')
const { protect } = require('../middleware/auth')
const { sendSuccess } = require('../utils/apiResponse')

const router = express.Router()

// GET /api/roles
router.get('/', protect, async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ name: 1 }).lean()
    return sendSuccess(res, { count: roles.length, roles })
  } catch (err) {
    next(err)
  }
})

module.exports = router

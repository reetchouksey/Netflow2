// M1 - Phase 2 - models/Role.js
// Fixed catalogue of system roles. Seeded once via /seeds/seed.js.

const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: [
      // Platform-level role: manages organizations (create/suspend, domains,
      // features, limits) via /api/platform. Deliberately NOT part of the
      // org-level guards (Admin, builder roles, ...), so a SuperAdmin has no
      // default access to any tenant's business data.
      'SuperAdmin',
      'Admin', 'CEO', 'Manager', 'HR', 'VP', 'Employee', 'Viewer',
      'Receiving Staff', 'Warehouse Manager', 'Accounts Officer', 'Brand Rep', 'Finance Approver'
    ]
  },
  description: { type: String },
  permissions: [{ type: String }]
}, { timestamps: true })

module.exports = mongoose.model('Role', roleSchema)

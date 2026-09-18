// M1 - Phase 2 - models/Role.js
// Organization-owned role catalogue. SuperAdmin is the only platform role and
// intentionally has no orgId; every workspace role is tenant scoped.

const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameKey: { type: String, trim: true },
  description: { type: String },
  permissions: [{ type: String }]
}, { timestamps: true })

roleSchema.pre('validate', function () {
  this.name = String(this.name || '').trim()
  this.nameKey = this.name.toLowerCase()
})

// The same role name may exist in different workspaces, but not twice in one.
// The partial index excludes the global SuperAdmin document.
roleSchema.index(
  { orgId: 1, nameKey: 1 },
  { unique: true, partialFilterExpression: { orgId: { $type: 'objectId' } } }
)

roleSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('Role', roleSchema)

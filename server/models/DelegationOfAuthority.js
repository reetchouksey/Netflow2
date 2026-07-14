// AI-01 - models/DelegationOfAuthority.js
// The Delegation-of-Authority (DoA) matrix that grounds #01 Approval-Routing.
// Each rule maps a request band (department + category + amount range) to the
// ordered approver ROLES required. The inference service turns those roles into
// real people using the live org chart, so policy and people stay decoupled.

const mongoose = require('mongoose')

// 'ANY' = wildcard. Departments mirror the User.department enum.
const DEPARTMENTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal', 'ANY']
// Roles that can appear in an approval chain (mirrors Role enum, minus the
// non-approving Employee/Viewer roles).
const APPROVER_ROLES = ['Manager', 'HR', 'VP', 'CEO', 'Admin']

const doaStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  role: { type: String, enum: APPROVER_ROLES, required: true },
  slaHours: { type: Number, default: 48 },
  note: { type: String }
}, { _id: false })

const doaRuleSchema = new mongoose.Schema({
  // Multi-tenancy: owning organization (see models/Organization.js).
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String },
  department: { type: String, enum: DEPARTMENTS, default: 'ANY' },
  // e.g. 'expense', 'po', 'sow', 'leave', 'purchase'. 'ANY' matches everything.
  category: { type: String, default: 'ANY', trim: true },
  minAmount: { type: Number, default: 0 },
  // null = no upper bound.
  maxAmount: { type: Number, default: null },
  currency: { type: String, default: 'USD' },
  approverChain: { type: [doaStepSchema], default: [] },
  // Higher priority wins when several rules match the same request.
  priority: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

doaRuleSchema.index({ isActive: 1, department: 1, category: 1, minAmount: 1, maxAmount: 1 })

doaRuleSchema.statics.DEPARTMENTS = DEPARTMENTS
doaRuleSchema.statics.APPROVER_ROLES = APPROVER_ROLES

doaRuleSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('DelegationOfAuthority', doaRuleSchema)

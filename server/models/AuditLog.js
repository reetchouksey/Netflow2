// M3 - Phase 2 - models/AuditLog.js
// Append-only record of every state-changing action across the platform.

const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
  // Multi-tenancy: owning organization (see models/Organization.js).
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  action: {
    type: String,
    enum: [
      'form_submitted',
      'form_deleted',
      'task_approved',
      'task_rejected',
      'task_submitted',
      'task_escalated',
      'workflow_started',
      'workflow_completed',
      'workflow_failed',
      'workflow_deleted',
      'user_invited',
      'user_updated',
      'user_deleted',
      'role_changed',
      'request_changes',
      'approver_inferred',
      'workflow_cancelled',
      'webhook_called',
      'webhook_received',
      'users_imported',
      // Org Admin configuration
      'department_created',
      'department_renamed',
      'department_deleted',
      'org_settings_updated',
      // Platform (SuperAdmin) org lifecycle
      'org_created',
      'org_updated',
      'org_suspended',
      'org_activated',
      'org_deleted',
      'org_admin_password_reset',
      // Licensing / quota lifecycle
      'org_storage_extended',
      'org_storage_extension_revoked',
      'org_licence_expired',
      'org_limit_reached'
    ],
    required: true
  },
  // Absent for entries written by a background job rather than a person (a
  // licence lapsing, for example). Both audit views render that as "System".
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetEntity: { type: String, required: true },
  department: { type: String },
  ipAddress: { type: String },
  detail: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true })

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ performedBy: 1, createdAt: -1 })

auditLogSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('AuditLog', auditLogSchema)

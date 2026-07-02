// M3 - Phase 2 - models/AuditLog.js
// Append-only record of every state-changing action across the platform.

const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
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
      'workflow_cancelled'
    ],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

module.exports = mongoose.model('AuditLog', auditLogSchema)

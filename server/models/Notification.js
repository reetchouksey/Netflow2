// M3 - Phase 2 - models/Notification.js
// In-app notification surfaced by the bell + /notifications page.

const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  // Multi-tenancy: owning organization (see models/Organization.js).
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['approval', 'rejection', 'escalation', 'assignment', 'reminder'],
    required: true
  },
  isRead: { type: Boolean, default: false },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })

notificationSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('Notification', notificationSchema)

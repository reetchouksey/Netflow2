// A partially filled form saved by a user to finish later. Kept in its own
// collection (NOT a FormResponse with status 'draft') so drafts never count as
// submissions, never appear in responses/analytics, and never trigger workflows.
// One draft per user per form — saving again overwrites the previous one.

const mongoose = require('mongoose')

const formDraftSchema = new mongoose.Schema({
  // Multi-tenancy: owning organization (see models/Organization.js).
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  formData: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true })

formDraftSchema.index({ formId: 1, userId: 1 }, { unique: true })

formDraftSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('FormDraft', formDraftSchema)

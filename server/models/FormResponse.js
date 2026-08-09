// M1 - Phase 2 - models/FormResponse.js
// A single submission against a form. Triggers a workflow when linked.

const mongoose = require('mongoose')

const formResponseSchema = new mongoose.Schema({
  // Multi-tenancy: owning organization (see models/Organization.js).
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  // Internal submissions reference a User; public (anonymous) submissions leave
  // this null and capture the optional name/email in `submittedByExternal`.
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedByExternal: {
    name: { type: String },
    email: { type: String }
  },
  source: { type: String, enum: ['internal', 'public'], default: 'internal' },
  formData: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'approved', 'rejected'],
    default: 'submitted'
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    // Bytes. Needed to decrement the org's storage meter when a response is
    // deleted; legacy rows have none, so the reconciliation job stats the file.
    size: Number,
    // BaseLayer DMS document id when uploads are ingested externally.
    dmsDocId: { type: String, default: null },
    provisionalId: { type: String, default: null },
  }]
}, { timestamps: true })

formResponseSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('FormResponse', formResponseSchema)

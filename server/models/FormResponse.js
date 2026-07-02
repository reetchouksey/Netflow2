// M1 - Phase 2 - models/FormResponse.js
// A single submission against a form. Triggers a workflow when linked.

const mongoose = require('mongoose')

const formResponseSchema = new mongoose.Schema({
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
    mimetype: String
  }]
}, { timestamps: true })

module.exports = mongoose.model('FormResponse', formResponseSchema)

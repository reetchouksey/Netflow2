// M1 - Phase 2 - models/Form.js
// Form schema definition: field list, validation rules, lifecycle status.

const mongoose = require('mongoose')

const formSchema = new mongoose.Schema({
  // Multi-tenancy: owning organization (see models/Organization.js).
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  title: { type: String, required: true },
  description: { type: String },
  fields: [{
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['number', 'text', 'dropdown', 'date', 'file', 'checkbox', 'signature', 'repeater', 'textarea', 'radio', 'grid'],
      required: true
    },
    label: { type: String, required: true },
    placeholder: { type: String },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    // Grid/table field: the columns the respondent fills (one value per column per row).
    columns: [{
      id: { type: String },
      label: { type: String },
      type: { type: String },
      options: [{ type: String }]
    }],
    conditionalLogic: {
      enabled: { type: Boolean, default: false },
      dependsOn: { type: String },
      operator: { type: String, enum: ['eq', 'neq', 'contains', 'nonempty'], default: 'eq' },
      showWhen: { type: String }
    },
    validation: {
      minLength: { type: Number },
      maxLength: { type: Number },
      min: { type: Number },
      max: { type: Number },
      pattern: { type: String },
      patternLabel: { type: String }
    },
    referenceUser: { type: Boolean, default: false }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: String },
  version: { type: Number, default: 1 },
  // Public sharing: when enabled, the form can be filled by anyone who has the
  // unguessable token link (no login). Data is collected without a workflow.
  public: {
    enabled: { type: Boolean, default: false },
    token: { type: String, default: null, index: true }
  }
}, { timestamps: true })

formSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('Form', formSchema)

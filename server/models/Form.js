// M1 - Phase 2 - models/Form.js
// Form schema definition: field list, validation rules, lifecycle status.

const mongoose = require('mongoose')

const formSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  fields: [{
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['number', 'text', 'dropdown', 'date', 'file', 'checkbox', 'signature', 'repeater', 'textarea'],
      required: true
    },
    label: { type: String, required: true },
    placeholder: { type: String },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    conditionalLogic: {
      enabled: { type: Boolean, default: false },
      dependsOn: { type: String },
      showWhen: { type: String }
    },
    validation: {
      minLength: { type: Number },
      maxLength: { type: Number },
      pattern: { type: String }
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: String },
  version: { type: Number, default: 1 }
}, { timestamps: true })

module.exports = mongoose.model('Form', formSchema)

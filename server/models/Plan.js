const mongoose = require('mongoose')

const planSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Key must be alphanumeric with hyphens']
  },
  label: { 
    type: String, 
    required: true,
    trim: true
  },
  trialDays: { 
    type: Number, 
    default: null 
  },
  limits: {
    maxUsers: { type: Number, default: 0 },
    maxBuilders: { type: Number, default: 0 },
    maxForms: { type: Number, default: 0 },
    maxWorkflows: { type: Number, default: 0 },
    maxSubmissionsPerPeriod: { type: Number, default: 0 },
    maxStorageMb: { type: Number, default: 0 },
    maxFiles: { type: Number, default: 0 }
  },
  features: {
    // All sellable plans include PDF auto-fill by default. Platform admins can
    // turn the entitlement off for a plan without discarding tenant settings.
    pdfAutoFill: { type: Boolean, default: true }
  },
  isCustom: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true })

module.exports = mongoose.model('Plan', planSchema)

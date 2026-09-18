const mongoose = require('mongoose')

const pdfAutoFillLearningProfileSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true, index: true },
  templateFingerprint: { type: String, required: true, index: true },
  fieldId: { type: String, required: true },
  evidenceKey: { type: String, required: true },
  valuePattern: {
    type: String,
    enum: ['empty', 'boolean', 'number', 'date', 'numeric_identifier', 'alphanumeric_identifier', 'identifier_list', 'text'],
    required: true
  },
  positiveStreak: { type: Number, min: 0, default: 0 },
  totalConfirmations: { type: Number, min: 0, default: 0 },
  correctionCount: { type: Number, min: 0, default: 0 },
  dismissalCount: { type: Number, min: 0, default: 0 },
  learnedTier: { type: String, enum: ['none', 'medium', 'high'], default: 'none' },
  lastFeedbackAt: { type: Date, default: null }
}, { timestamps: true })

pdfAutoFillLearningProfileSchema.index({
  orgId: 1,
  formId: 1,
  templateFingerprint: 1,
  fieldId: 1,
  evidenceKey: 1,
  valuePattern: 1
}, { unique: true, name: 'pdf_autofill_learning_identity' })

pdfAutoFillLearningProfileSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('PdfAutoFillLearningProfile', pdfAutoFillLearningProfileSchema)

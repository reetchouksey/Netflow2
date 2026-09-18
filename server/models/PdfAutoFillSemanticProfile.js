const mongoose = require('mongoose')

const pdfAutoFillSemanticProfileSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true, index: true },
  documentType: { type: String, required: true, maxlength: 80, index: true },
  sourceAlias: { type: String, required: true, maxlength: 160 },
  fieldId: { type: String, required: true },
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

pdfAutoFillSemanticProfileSchema.index({
  orgId: 1,
  formId: 1,
  documentType: 1,
  sourceAlias: 1,
  fieldId: 1,
  valuePattern: 1
}, { unique: true, name: 'pdf_autofill_semantic_identity' })

pdfAutoFillSemanticProfileSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('PdfAutoFillSemanticProfile', pdfAutoFillSemanticProfileSchema)

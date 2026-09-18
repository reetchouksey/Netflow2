const mongoose = require('mongoose')

const sourceRegionSchema = new mongoose.Schema({
  lineId: { type: String, required: true },
  page: { type: Number, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  text: { type: String, default: '' },
  confidence: { type: Number, default: 0 }
}, { _id: false })

const suggestionSchema = new mongoose.Schema({
  fieldId: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
  baseConfidence: { type: Number, min: 0, max: 100, default: 0 },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
  tier: { type: String, enum: ['high', 'medium', 'low'], required: true },
  generatorConfidence: { type: Number, min: 0, max: 100, default: 0 },
  criticConfidence: { type: Number, min: 0, max: 100, default: 0 },
  criticApproved: { type: Boolean, default: false },
  criticStatus: { type: String, enum: ['validated', 'unavailable', 'fallback'], default: 'fallback' },
  sourceLabel: { type: String, maxlength: 160, default: '' },
  decisionReason: { type: String, maxlength: 300, default: '' },
  learnedTier: { type: String, enum: ['none', 'medium', 'high'], default: 'none' },
  learningKey: { type: String, default: null },
  valuePattern: {
    type: String,
    enum: ['empty', 'boolean', 'number', 'date', 'numeric_identifier', 'alphanumeric_identifier', 'identifier_list', 'text'],
    default: 'text'
  },
  valid: { type: Boolean, default: false },
  validationMessage: { type: String, default: null },
  sourceRegions: { type: [sourceRegionSchema], default: [] }
}, { _id: false })

const documentExtractionJobSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true, index: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  audience: { type: String, enum: ['authenticated', 'public'], required: true },
  languageMode: {
    type: String,
    enum: ['english', 'english_hindi', 'hindi'],
    default: 'english_hindi'
  },
  accessTokenHash: { type: String, default: null, select: false },
  sourceFile: {
    filename: { type: String, required: true },
    mimetype: { type: String, default: 'application/pdf' },
    size: { type: Number, required: true },
    storage: { type: String, enum: ['local', 'dms', 's3'], required: true },
    path: { type: String, default: null },
    storedFilename: { type: String, default: null },
    dmsDocId: { type: String, default: null },
    s3Key: { type: String, default: null }
  },
  status: {
    type: String,
    enum: ['queued', 'security_scan', 'inspecting', 'extracting_text', 'ocr_processing', 'mapping_fields', 'validating', 'ready', 'failed', 'cancelled'],
    default: 'queued',
    index: true
  },
  stage: { type: String, default: 'Queued for processing' },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  attempts: { type: Number, default: 0 },
  claimedAt: { type: Date, default: null },
  pageCount: { type: Number, default: 0 },
  pageMeta: { type: [mongoose.Schema.Types.Mixed], default: [] },
  lines: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  templateFingerprint: { type: String, default: null },
  documentType: { type: String, maxlength: 80, default: 'document' },
  criticStatus: { type: String, enum: ['validated', 'unavailable', 'fallback'], default: 'fallback' },
  suggestions: { type: [suggestionSchema], default: [] },
  summary: {
    high: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    low: { type: Number, default: 0 }
  },
  errorCode: { type: String, default: null },
  errorDetail: { type: String, default: null, select: false },
  consumedResponseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse', default: null },
  consumedAt: { type: Date, default: null },
  feedbackProcessedAt: { type: Date, default: null },
  feedbackResponseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse', default: null },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true })

documentExtractionJobSchema.index({ status: 1, createdAt: 1 })
documentExtractionJobSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('DocumentExtractionJob', documentExtractionJobSchema)

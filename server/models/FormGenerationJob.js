const mongoose = require('mongoose')

const sourceRegionSchema = new mongoose.Schema({
  lineId: { type: String, required: true },
  page: { type: Number, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  confidence: { type: Number, default: 0 },
  source: { type: String, enum: ['digital', 'ocr', 'unknown'], default: 'unknown' }
}, { _id: false })

const candidateSchema = new mongoose.Schema({
  scoreVersion: { type: Number, default: 1 },
  candidateId: { type: String, required: true },
  field: { type: mongoose.Schema.Types.Mixed, required: true },
  sourceLabel: { type: String, default: '' },
  context: { type: String, default: '' },
  sourceLineIds: { type: [String], default: [] },
  necessity: {
    type: String,
    enum: ['core', 'optional', 'conditional'],
    default: 'optional'
  },
  decisionReason: { type: String, default: '' },
  requiredReason: { type: String, default: '' },
  generatorConfidence: { type: Number, min: 0, max: 100, default: 0 },
  criticConfidence: { type: Number, min: 0, max: 100, default: 0 },
  criticStatus: { type: String, enum: ['validated', 'unavailable'], default: 'validated' },
  validationReason: { type: String, default: '' },
  sourceConfidence: { type: Number, min: 0, max: 100, default: null },
  sourceMethods: { type: [String], enum: ['digital', 'ocr', 'unknown'], default: [] },
  ocrConfidence: { type: Number, min: 0, max: 100, default: null },
  labelGroundingConfidence: { type: Number, min: 0, max: 100, default: null },
  labelGroundingMethod: { type: String, enum: ['text_match', 'document_context'], default: 'text_match' },
  optionGroundingConfidence: { type: Number, min: 0, max: 100, default: null },
  confidence: { type: Number, min: 0, max: 100, required: true },
  confidenceTier: { type: String, enum: ['high', 'medium', 'low'], required: true },
  includedByDefault: { type: Boolean, default: false },
  reviewWarnings: { type: [String], default: [] },
  sourceRegions: { type: [sourceRegionSchema], default: [] }
}, { _id: false })

const scoreSummarySchema = new mongoose.Schema({
  confidence: { type: Number, min: 0, max: 100, default: null },
  scoredFields: { type: Number, default: 0 },
  totalFields: { type: Number, default: 0 },
  unavailableFields: { type: Number, default: 0 }
}, { _id: false })

const qualitySummarySchema = new mongoose.Schema({
  version: { type: Number, required: true },
  digital: { pageCount: Number, lineCount: Number },
  ocr: { pageCount: Number, lineCount: Number, confidence: { type: Number, min: 0, max: 100, default: null } },
  grounding: scoreSummarySchema,
  validation: scoreSummarySchema
}, { _id: false })

const formGenerationJobSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  languageMode: {
    type: String,
    enum: ['english', 'english_hindi', 'hindi'],
    default: 'english_hindi'
  },
  sourceFile: {
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    storage: { type: String, enum: ['local', 'dms', 's3'], required: true },
    path: { type: String, default: null },
    storedFilename: { type: String, default: null },
    dmsDocId: { type: String, default: null },
    s3Key: { type: String, default: null }
  },
  status: {
    type: String,
    enum: [
      'queued', 'security_scan', 'inspecting', 'extracting_text',
      'ocr_processing', 'generating_schema', 'validating', 'ready',
      'failed', 'cancelled'
    ],
    default: 'queued',
    index: true
  },
  stage: { type: String, default: 'Queued for processing' },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  attempts: { type: Number, default: 0 },
  claimedAt: { type: Date, default: null },
  retryAt: { type: Date, default: null },
  pageCount: { type: Number, default: 0 },
  pageMeta: { type: [mongoose.Schema.Types.Mixed], default: [] },
  lines: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  generatedTitle: { type: String, default: '' },
  generatedDescription: { type: String, default: '' },
  documentType: { type: String, default: '' },
  criticStatus: { type: String, enum: ['validated', 'unavailable'], default: 'validated' },
  candidates: { type: [candidateSchema], default: [] },
  confidenceSummary: {
    high: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    low: { type: Number, default: 0 }
  },
  qualitySummary: { type: qualitySummarySchema, default: null },
  processingVersion: { type: Number, default: 1 },
  maxFields: { type: Number, default: 25 },
  limitReached: { type: Boolean, default: false },
  coverage: {
    type: new mongoose.Schema({
      status: { type: String, enum: ['complete', 'partial'] },
      totalSourceLines: Number,
      unresolvedCount: Number,
      unreadablePageCount: Number,
      lowConfidenceOcrPageCount: Number,
      recoveryAttempts: Number,
      recoveryFailures: Number,
      validationAttempts: Number,
      validationFailures: Number,
      validationSkipped: Number,
      recoverySkipped: Number,
      maxRequestCharacters: Number,
      failureReasons: [String]
    }, { _id: false }),
    default: null
  },
  truncated: { type: Boolean, default: false },
  detectedFieldCount: { type: Number, default: 0 },
  errorCode: { type: String, default: null },
  errorDetail: { type: String, default: null, select: false },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true })

formGenerationJobSchema.index({ status: 1, retryAt: 1, createdAt: 1 })
formGenerationJobSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('FormGenerationJob', formGenerationJobSchema)

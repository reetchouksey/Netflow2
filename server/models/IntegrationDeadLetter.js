// Dead-letter record for an outbound call from the workflow "api" node that
// exhausted its retries (utils/workflowEngine). Kept so an administrator can
// answer "what did my integrations drop?" after the run has moved on.

const mongoose = require('mongoose')

const integrationDeadLetterSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },

  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', index: true },
  executionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowExecution', index: true },

  nodeId: { type: String },
  url: { type: String },
  method: { type: String },
  error: { type: String },
  httpStatus: { type: Number },
  attempts: { type: Number },
  requestBodyPreview: { type: String },

  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
})

integrationDeadLetterSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })
integrationDeadLetterSchema.index({ orgId: 1, resolved: 1, createdAt: -1 })
integrationDeadLetterSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('IntegrationDeadLetter', integrationDeadLetterSchema)

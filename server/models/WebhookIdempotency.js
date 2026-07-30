// Dedupes inbound webhook starts for the same Idempotency-Key (per workflow).

const mongoose = require('mongoose')

const webhookIdempotencySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  key: { type: String, required: true },
  executionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowExecution', required: true },
  createdAt: { type: Date, default: Date.now }
})

webhookIdempotencySchema.index({ orgId: 1, workflowId: 1, key: 1 }, { unique: true })
// Auto-expire after 7 days.
webhookIdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 })

webhookIdempotencySchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('WebhookIdempotency', webhookIdempotencySchema)

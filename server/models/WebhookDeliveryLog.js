// Append-only log of inbound webhook attempts (success + failure), 30-day
// retention. A failed attempt is the whole point of the log, so refusals (bad
// signature, quota, read-only licence) are written here too, with the code that
// caused them, so the workflow owner can see why their integration stopped.

const mongoose = require('mongoose')

const webhookDeliveryLogSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', index: true },
  executionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowExecution' },
  ok: { type: Boolean, default: false },
  statusCode: { type: Number },
  error: { type: String },
  code: { type: String },
  ip: { type: String },
  payloadKeys: [{ type: String }],
  hasSignature: { type: Boolean, default: false },
  idempotencyKey: { type: String },
  replay: { type: Boolean, default: false },
  durationMs: { type: Number },
  createdAt: { type: Date, default: Date.now }
})

webhookDeliveryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })
webhookDeliveryLogSchema.index({ orgId: 1, createdAt: -1 })
webhookDeliveryLogSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('WebhookDeliveryLog', webhookDeliveryLogSchema)

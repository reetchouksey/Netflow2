// M2 - Phase 2 - models/WorkflowExecution.js
// Runtime instance of a workflow: tracks the current node, log, and variables.

const mongoose = require('mongoose')

const workflowExecutionSchema = new mongoose.Schema({
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  formResponseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse' },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed', 'paused', 'cancelled'],
    default: 'running'
  },
  currentNodeId: { type: String },
  executionLog: [{
    nodeId: { type: String },
    nodeType: { type: String },
    enteredAt: { type: Date, default: Date.now },
    exitedAt: { type: Date },
    status: { type: String, enum: ['in_progress', 'completed', 'failed', 'skipped'] },
    output: { type: mongoose.Schema.Types.Mixed }
  }],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
  variables: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true })

module.exports = mongoose.model('WorkflowExecution', workflowExecutionSchema)

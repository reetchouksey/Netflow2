// M2 - Phase 2 - models/Workflow.js
// Declarative workflow definition (nodes + edges) compiled by workflowEngine.js.

const mongoose = require('mongoose')

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['start', 'approval', 'condition', 'api', 'notification', 'timer', 'assignment', 'document', 'submit', 'end'],
    required: true
  },
  label: { type: String },
  config: {
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approverRole: { type: String },
    approvalType: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
    condition: { type: String },
    conditionField: { type: String },
    conditionOperator: { type: String, enum: ['eq', 'gt', 'lt', 'gte', 'lte', 'contains'] },
    conditionValue: { type: String },
    truePath: { type: String },
    falsePath: { type: String },
    slaHours: { type: Number, default: 48 },
    escalateTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notificationMessage: { type: String },
    apiUrl: { type: String },
    apiMethod: { type: String },
    assignTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignToRole: { type: String },
    // Submit-node config: instructions for the assignee + whether a file is required.
    instructions: { type: String },
    requireAttachment: { type: Boolean, default: true },
    slackWebhookUrl: { type: String }
  },
  nextNode: { type: String },
  position: { x: Number, y: Number }
}, { _id: false })

const workflowSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  nodes: [nodeSchema],
  edges: [{
    id: String,
    source: String,
    target: String,
    label: String
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'paused', 'archived'],
    default: 'draft'
  },
  linkedFormId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  department: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 },
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' }
}, { timestamps: true })

module.exports = mongoose.model('Workflow', workflowSchema)

// M2 - Phase 2 - models/Workflow.js
// Declarative workflow definition (nodes + edges) compiled by workflowEngine.js.

const mongoose = require('mongoose')

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['start', 'approval', 'multiApproval', 'condition', 'api', 'notification', 'timer', 'assignment', 'document', 'submit', 'review', 'end'],
    required: true
  },
  label: { type: String },
  config: {
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approverRole: { type: String },
    approvalType: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
    // Multi/committee approval node: the specific people who must vote, and how
    // many approvals are required for the stage to pass (N of M / quorum).
    approverIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    requiredApprovals: { type: Number, default: 1 },
    condition: { type: String },
    conditionField: { type: String },
    conditionOperator: { type: String, enum: ['eq', 'gt', 'lt', 'gte', 'lte', 'contains'] },
    conditionValue: { type: String },
    truePath: { type: String },
    falsePath: { type: String },
    // Review-node routing: forwardPath = "no changes / forward", changesPath = "changes required".
    forwardPath: { type: String },
    changesPath: { type: String },
    slaHours: { type: Number, default: 48 },
    escalateTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notificationMessage: { type: String },
    // Integration / webhook node ('api'): an outbound HTTP call to an external
    // system. Opt-in; interpolated + executed by workflowEngine.handleApiNode.
    apiUrl: { type: String },
    apiMethod: { type: String, default: 'POST' },
    apiHeaders: [{ key: { type: String }, value: { type: String } }],
    apiBody: { type: String }, // JSON template with {{formData.x}} placeholders
    sendAllData: { type: Boolean },
    // 'mode' (not 'type') on purpose: a nested field named `type` would be read
    // by Mongoose as a SchemaType declaration and collapse the subdocument.
    apiAuth: {
      mode: { type: String, enum: ['none', 'bearer', 'basic'], default: 'none' },
      token: { type: String },
      username: { type: String },
      password: { type: String }
    },
    saveResponseAs: { type: String }, // store the response under this variable name
    continueOnError: { type: Boolean, default: true },
    assignTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignToRole: { type: String },
    // Submit-node config: instructions for the assignee + the inline form fields
    // they must fill before submitting. (requireAttachment kept for back-compat.)
    instructions: { type: String },
    requireAttachment: { type: Boolean, default: true },
    formFields: [{
      id: { type: String },
      type: { type: String },
      label: { type: String },
      required: { type: Boolean, default: false },
      placeholder: { type: String },
      options: [{ type: String }],
      conditionalLogic: {
        enabled: { type: Boolean, default: false },
        dependsOn: { type: String },
        operator: { type: String, enum: ['eq', 'neq', 'contains', 'nonempty'], default: 'eq' },
        showWhen: { type: String }
      },
      validation: {
        minLength: { type: Number },
        maxLength: { type: Number },
        min: { type: Number },
        max: { type: Number },
        pattern: { type: String },
        patternLabel: { type: String }
      }
    }],
    // Approval-node option: require the approver to attach an e-signature on decision.
    requireSignature: { type: Boolean, default: false },
    // End-node option: auto-generate a signed PDF of the approved request on completion.
    generatePdf: { type: Boolean, default: false },
    slackWebhookUrl: { type: String }
  },
  nextNode: { type: String },
  position: { x: Number, y: Number }
}, { _id: false })

const workflowSchema = new mongoose.Schema({
  // Multi-tenancy: owning organization (see models/Organization.js).
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
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
  // Primary / legacy single link (kept in sync as linkedFormIds[0]).
  linkedFormId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
  // Multiple forms may start the same workflow; any of these triggers a run.
  linkedFormIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Form' }],
  // Who may initiate (submit) this workflow. Only enforced when
  // whoCanSubmit === 'Specific people' and allowedInitiators is non-empty;
  // otherwise submission stays open (backward-compatible default).
  access: {
    whoCanSubmit: { type: String, default: 'All employees' },
    departments: [{ type: String }],
    allowedInitiators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Visibility = who can SEE/open the linked form (independent of whoCanSubmit):
    //   'company' (everyone) | 'departments' (listed depts) | 'people' (visibleTo).
    visibility: { type: String, default: 'company' },
    visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  // Trigger + submission behaviour set on the workflow's settings page.
  //   triggerOn: 'Every form submission' (auto-fire) | 'Manual trigger only' (only /execute)
  //   notifyOnSlaBreach: 'Always' | 'After first breach' | 'Never'
  triggerOn: { type: String, default: 'Every form submission' },
  preventDuplicates: { type: Boolean, default: false },
  notifyOnSlaBreach: { type: String, default: 'Always' },
  // n8n-style inbound webhook: external systems POST to /api/hooks/:token to
  // start a published run (no NetFlow login / linked form required).
  inboundWebhook: {
    enabled: { type: Boolean, default: false },
    token: { type: String, index: true, sparse: true },
    // HMAC signing secret for X-NetFlow-Signature (sha256=<hex> over raw body).
    secret: { type: String },
    // If false, any POST to the webhook URL will be accepted without signature verification.
    requireSignature: { type: Boolean, default: true },
    // POST here when a webhook-started run completes / fails / is rejected.
    callbackUrl: { type: String, default: '' },
    // Optional schema for inbound payloads (validated when non-empty).
    expectedFields: [{
      id: { type: String },
      label: { type: String },
      type: { type: String, default: 'text' },
      required: { type: Boolean, default: false }
    }]
  },
  advanced: {
    allowCancel: { type: Boolean, default: false },
    autoPdf: { type: Boolean, default: false }
  },
  department: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 },
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' }
}, { timestamps: true })

workflowSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('Workflow', workflowSchema)

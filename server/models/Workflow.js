// M2 - Phase 2 - models/Workflow.js
// Declarative workflow definition (nodes + edges) compiled by workflowEngine.js.

const mongoose = require('mongoose')

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['start', 'approval', 'condition', 'api', 'notification', 'timer', 'assignment', 'document', 'submit', 'review', 'end'],
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
    // Review-node routing: forwardPath = "no changes / forward", changesPath = "changes required".
    forwardPath: { type: String },
    changesPath: { type: String },
    slaHours: { type: Number, default: 48 },
    escalateTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notificationMessage: { type: String },
    apiUrl: { type: String },
    apiMethod: { type: String },
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
      options: [{ type: String }]
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
  advanced: {
    allowCancel: { type: Boolean, default: false },
    autoPdf: { type: Boolean, default: false }
  },
  department: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 },
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' }
}, { timestamps: true })

module.exports = mongoose.model('Workflow', workflowSchema)

// M3 - Phase 2 - models/Task.js
// Approval task created by the workflow engine. Drives the inbox + approvals UI.

const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  workflowExecutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkflowExecution'
  },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  formResponseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse' },
  title: { type: String, required: true },
  type: { type: String, required: true },
  // 'approval' = approve/reject task; 'submit' = assignee uploads + submits to advance;
  // 'review' = reviewer views documents then forwards or sends back for changes.
  actionType: { type: String, enum: ['approval', 'submit', 'review'], default: 'approval' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'escalated', 'completed'],
    default: 'pending'
  },
  dueDate: { type: Date },
  currentNode: { type: String },
  // Submit-node tasks: instructions shown to the assignee + the inline form they
  // fill. formFields = definition snapshot; formData = the submitted values.
  instructions: { type: String },
  requireAttachment: { type: Boolean, default: false },
  formFields: [{
    id: { type: String },
    type: { type: String },
    label: { type: String },
    required: { type: Boolean, default: false },
    placeholder: { type: String },
    options: [{ type: String }]
  }],
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Approval tasks: when true, the approver must attach an e-signature on decision.
  requireSignature: { type: Boolean, default: false },
  attachments: [{
    name: { type: String },
    url: { type: String },
    mime: { type: String },
    size: { type: Number }
  }],
  approvalType: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
  approvalHistory: [{
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'request_changes', 'escalated', 'reassigned']
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    comment: { type: String },
    // Optional e-signature captured at decision time (when the node requires it).
    signature: {
      kind: { type: String, enum: ['uploaded', 'typed'] },
      url: { type: String },
      text: { type: String },
      font: { type: String }
    }
  }],
  parallelApprovers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  parallelApprovals: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'] },
    decidedAt: { type: Date }
  }],
  escalationLevel: { type: Number, default: 0 },
  isEscalated: { type: Boolean, default: false }
}, { timestamps: true })

taskSchema.index({ assignedTo: 1, status: 1 })
taskSchema.index({ dueDate: 1, status: 1, isEscalated: 1 })

module.exports = mongoose.model('Task', taskSchema)

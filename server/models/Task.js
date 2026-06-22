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
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'escalated', 'completed'],
    default: 'pending'
  },
  dueDate: { type: Date },
  currentNode: { type: String },
  approvalType: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
  approvalHistory: [{
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'request_changes', 'escalated', 'reassigned']
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    comment: { type: String }
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

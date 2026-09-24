const mongoose = require('mongoose')

const dmsDocumentSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  filename: {
    type: String,
    required: true,
    trim: true
  },
  mime: {
    type: String,
    default: 'application/octet-stream'
  },
  type: {
    type: String,
    default: 'Document'
  },
  sizeBytes: {
    type: Number,
    required: true,
    default: 0
  },
  department: {
    type: String,
    default: 'General'
  },
  folderPath: {
    type: String,
    default: ''
  },
  fileUrl: {
    type: String,
    default: ''
  },
  dmsDocId: {
    type: String,
    default: null
  },
  tags: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  description: {
    type: String,
    default: null
  },
  version: {
    type: String,
    default: '1.0'
  },
  status: {
    type: String,
    default: 'Synced'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true })

module.exports = mongoose.model('DmsDocument', dmsDocumentSchema)

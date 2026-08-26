const mongoose = require('mongoose')

const platformBroadcastSchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true, maxlength: 500 },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info'
  },
  expiresAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supersededAt: { type: Date, default: null }
}, { timestamps: true })

platformBroadcastSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
platformBroadcastSchema.index({ supersededAt: 1, expiresAt: 1, createdAt: -1 })

module.exports = mongoose.model('PlatformBroadcast', platformBroadcastSchema)

// M1 - Phase 2 - models/User.js
// Application user. Password hashed with bcrypt on save; never serialised.

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true, minlength: 6 },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  department: {
    type: String,
    enum: ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal'],
    required: true
  },
  isActive: { type: Boolean, default: true },
  // Protected (system-seeded) accounts — e.g. the permanent CEO — cannot be
  // edited, re-roled, or deactivated from the Admin Panel. Only a seed can.
  isProtected: { type: Boolean, default: false },
  avatar: { type: String },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // HR partner responsible for this user (an HR-role user).
  hrId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLogin: { type: Date },
  // Out-of-office: while enabled (and within the optional from/until window),
  // any approval / review / submit task that would be assigned to this user is
  // instead auto-routed to their manager by the workflow engine. Self-service.
  outOfOffice: {
    enabled: { type: Boolean, default: false },
    from: { type: Date, default: null },
    until: { type: Date, default: null },
    note: { type: String },
    delegateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true })

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password
    return ret
  }
})

module.exports = mongoose.model('User', userSchema)

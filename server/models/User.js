// M1 - Phase 2 - models/User.js
// Application user. Password hashed with bcrypt on save; never serialised.

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const userSchema = new mongoose.Schema({
  // Multi-tenancy: the organization this record belongs to. Stamped on create,
  // scoped on every query (build-order steps 4-5). Not `required` yet so
  // existing create paths keep working until the scoping plugin lands.
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  name: { type: String, required: true, trim: true },
  // Unique per organization (compound index below), not globally — the same
  // person can exist as a user in two different organizations.
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true, minlength: 6 },
  // Forces a password change on next login. Set for Super-Admin-provisioned org
  // admins (temporary password) and by admin password resets; cleared by
  // POST /api/auth/change-password.
  mustChangePassword: { type: Boolean, default: false },
  // First-login product tour. Set true when an admin provisions a new user /
  // org admin; cleared when they finish or skip the tour. Existing users keep
  // the default false so the tour never auto-fires for them.
  needsProductTour: { type: Boolean, default: false },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  // Free-form on purpose: the valid set is per-tenant and lives on the
  // Organization (see utils/departments.js), so a schema-level enum would be
  // wrong for every org that renames or adds a team. Routes validate against
  // the org's list before writing.
  department: {
    type: String,
    required: true,
    trim: true
  },
  isActive: { type: Boolean, default: true },
  // Bumped to invalidate all previously-issued JWTs for this user (real logout,
  // password reset, deactivation, role change). Tokens embed this value ("tv")
  // and are rejected by the auth middleware once it no longer matches.
  tokenVersion: { type: Number, default: 0 },
  // Active session IDs to allow logging out from a single device.
  activeSessions: { type: [String], default: [] },
  // Licensing: may this user create/edit forms and workflows? Deliberately a
  // per-user grant rather than a role check, because plans sell "1 builder"
  // while roles are global and shared across tenants. The Org Admin decides
  // who holds the seats; role still governs everything else.
  canBuild: { type: Boolean, default: false },
  // When false, this account does not consume user/builder plan seats (used for
  // a complimentary bootstrap Org Admin). Default true so normal users bill.
  // Existing documents without the field still count (query uses $ne: false).
  countsTowardSeats: { type: Boolean, default: true },
  // Protected (system-seeded) accounts — e.g. the permanent CEO — cannot be
  // edited, re-roled, or deactivated from the Admin Panel. Only a seed can.
  isProtected: { type: Boolean, default: false },
  avatar: { type: String },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // HR partner responsible for this user (an HR-role user).
  hrId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLogin: { type: Date },
  // Password reset: we store only a SHA-256 hash of the token that was emailed,
  // plus its expiry. The raw token lives only in the emailed link.
  resetPasswordToken: { type: String, default: null, select: false },
  resetPasswordExpires: { type: Date, default: null, select: false },
  // Brute-force protection: failed login counter + temporary lock window.
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, default: null, select: false },
  // Multi-factor auth (TOTP — Google Authenticator / Authy compatible).
  // mfaSecret is the base32 shared secret; backup codes are stored hashed.
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, default: null, select: false },
  mfaBackupCodes: { type: [String], default: undefined, select: false },
  // Out-of-office: while enabled (and within the optional from/until window),
  // any approval / review / submit task that would be assigned to this user is
  // instead auto-routed to their manager by the workflow engine. Self-service.
  outOfOffice: {
    enabled: { type: Boolean, default: false },
    from: { type: Date, default: null },
    until: { type: Date, default: null },
    note: { type: String },
    delegateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  // Per-event delivery channels. Each event can be delivered in-app, by email,
  // both, or neither. Absent/legacy users fall back to "both on" at read time
  // (see utils/notificationPrefs.resolvePref), so this can stay sparse.
  notificationPrefs: {
    assignment: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    approval: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    rejection: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    escalation: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } }
  }
}, { timestamps: true })

// Multi-tenancy: email is unique WITHIN an organization, not across the
// platform. Replaces the old global unique(email) index (dropped by
// scripts/rebuildUserEmailIndex.js).
userSchema.index({ orgId: 1, email: 1 }, { unique: true })

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = async function (candidatePassword) {
  // The candidate comes straight off a request body, so it can be an object
  // ({ $ne: '' } from an injection probe) — bcrypt throws on anything that is
  // not a string, which would turn a failed login into a 500.
  if (typeof candidatePassword !== 'string' || !this.password) return false
  return bcrypt.compare(candidatePassword, this.password)
}

// Generates a raw reset token (returned to caller for the email link) and
// stores only its SHA-256 hash + expiry on the document. Does not save.
userSchema.methods.createPasswordResetToken = function (ttlMinutes = 30) {
  const rawToken = crypto.randomBytes(32).toString('hex')
  this.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex')
  this.resetPasswordExpires = new Date(Date.now() + ttlMinutes * 60 * 1000)
  return rawToken
}

userSchema.statics.hashResetToken = function (rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex')
}

// True while the account is inside an active lock window.
userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now())
}

// Generates `count` human-friendly one-time backup codes. Returns the raw
// codes (shown to the user once) and stores only their SHA-256 hashes.
userSchema.methods.generateBackupCodes = function (count = 8) {
  const raw = []
  const hashed = []
  for (let i = 0; i < count; i += 1) {
    // e.g. "3f9a-1c7b" — 8 hex chars split by a dash for readability.
    const code = crypto.randomBytes(4).toString('hex')
    const pretty = `${code.slice(0, 4)}-${code.slice(4)}`
    raw.push(pretty)
    hashed.push(crypto.createHash('sha256').update(pretty).digest('hex'))
  }
  this.mfaBackupCodes = hashed
  return raw
}

// Consumes a backup code if it matches an unused one. Mutates the stored
// list (removing the used code). Caller must save(). Returns true on match.
userSchema.methods.consumeBackupCode = function (candidate) {
  if (!Array.isArray(this.mfaBackupCodes) || !this.mfaBackupCodes.length) return false
  const normalized = String(candidate || '').trim().toLowerCase().replace(/\s+/g, '')
  const hash = crypto.createHash('sha256').update(normalized).digest('hex')
  const idx = this.mfaBackupCodes.indexOf(hash)
  if (idx === -1) return false
  this.mfaBackupCodes.splice(idx, 1)
  return true
}

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password
    delete ret.resetPasswordToken
    delete ret.resetPasswordExpires
    delete ret.mfaSecret
    delete ret.mfaBackupCodes
    delete ret.failedLoginAttempts
    delete ret.lockUntil
    return ret
  }
})

userSchema.plugin(require('../tenancy/orgScopePlugin'))

module.exports = mongoose.model('User', userSchema)

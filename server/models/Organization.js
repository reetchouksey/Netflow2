// Multi-tenancy Step 1 - models/Organization.js
// A tenant of the platform. Every business record (User, Form, Workflow,
// Task, ...) is stamped with an orgId pointing here, and all queries are
// scoped by it. Policy knobs (allowedDomains, features, limits) live on
// this document so the Platform Super Admin can change tenant behavior
// without a code change.

const mongoose = require('mongoose')
const { PLAN_KEYS, DEFAULT_PLAN } = require('../config/plans')

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  // Tenant address, e.g. "acme" for acme.netflow.app. Also embedded in JWTs
  // until subdomain routing ships (build-order step 9).
  subdomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'Subdomain may only contain lowercase letters, digits and hyphens']
  },

  // Email domains an Org Admin may create users with (e.g. ["acme.com"]).
  // Empty list = no restriction (enforcement lands in build-order step 8).
  allowedDomains: { type: [String], default: [] },

  // Teams inside this tenant, owned by the Org Admin (see utils/departments.js).
  // Empty means "never configured": the six legacy names are used instead, so
  // pre-existing orgs keep working untouched.
  departments: { type: [String], default: [] },

  features: {
    // Allows user creation with emails outside allowedDomains (contractors).
    externalUsers: { type: Boolean, default: false }
  },

  // Optional per-tenant BaseLayer DMS service key (Administration → API Keys).
  // When empty, server falls back to env DMS_API_KEY. Do not expose in public APIs.
  // All DMS config is set by the Platform Super Admin only — Org Admins get a
  // read-only status view (GET /api/organization/dms-status).
  integrations: {
    // Org-level fallback key — used when a department has no key of its own.
    dmsApiKey:  { type: String, default: '' },
    dmsEnabled: { type: Boolean, default: false },
    // Root folder in DMS (e.g. "acme"). Falls back to org.subdomain when empty.
    dmsOrgSlug: { type: String, default: '' },

    // Per-department DMS configuration. Each entry overrides the org-level key
    // for uploads originating from that department. Resolution order:
    //   1. department entry with apiKey set
    //   2. org-level dmsApiKey
    //   3. platform env DMS_API_KEY
    departmentDms: [{
      _id: false,
      department: { type: String, required: true }, // matches org.departments list
      apiKey:     { type: String, default: '' },     // dept-specific DMS API key
      baseUrl:    { type: String, default: '' },     // optional: dept-specific DMS server URL
      folder:     { type: String, default: '' },     // optional folder override (default: orgSlug/dept)
      enabled:    { type: Boolean, default: true }
    }]
  },

  // Subscription tier. 'custom' is what an org becomes once any single limit is
  // hand-edited away from its preset, so the UI never shows "Basic" next to
  // numbers that are not Basic. Pre-licensing orgs are 'custom' + all-zero
  // limits, i.e. unlimited, which is how they behaved before.
  plan: {
    type: String,
    enum: PLAN_KEYS,
    default: DEFAULT_PLAN
  },

  licence: {
    validFrom: { type: Date, default: null },
    // null = perpetual. Once passed, the org drops to read-only (see
    // middleware/licence.js): existing work can be finished, nothing new starts.
    validUntil: { type: Date, default: null },
    // Set for plan='trial'. Same read-only outcome, different copy in the UI.
    trialEndsAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'expired', 'suspended'],
      default: 'active'
    },
    // Which expiry reminders have already gone out, so the hourly job does not
    // email the admin every hour through the last month of the contract. Cleared
    // whenever the licence dates change (utils/licensing.applyLicensingPayload).
    notified: {
      d30: { type: Boolean, default: false },
      d14: { type: Boolean, default: false },
      d7: { type: Boolean, default: false },
      d1: { type: Boolean, default: false },
      expired: { type: Boolean, default: false }
    }
  },

  // Where limit warnings go in addition to the Org Admin. Optional: finance
  // often wants the 90% email without having a login.
  billingEmail: { type: String, default: '', lowercase: true, trim: true },

  // Day of month the submission allowance resets on, matching the subscription
  // start date rather than the calendar month. Clamped to the last day in
  // shorter months (31 -> 28/29 Feb) by utils/billingPeriod.
  billingAnchorDay: { type: Number, default: 1, min: 1, max: 31 },

  // 0 = unlimited, for every field. Enforced centrally by middleware/quota.js.
  limits: {
    maxUsers: { type: Number, default: 0 },
    // Users allowed to build forms/workflows (User.canBuild), not a role count.
    maxBuilders: { type: Number, default: 0 },
    maxForms: { type: Number, default: 0 },
    maxWorkflows: { type: Number, default: 0 },
    maxSubmissionsPerPeriod: { type: Number, default: 0 },
    maxStorageMb: { type: Number, default: 0 },
    // Second half of the "whichever comes first" rule: storage size OR count.
    maxFiles: { type: Number, default: 0 },
    // Headroom above a limit before it blocks, e.g. 10 = allow 110%. Off by
    // default; here so turning it on later needs no migration.
    gracePercent: { type: Number, default: 0, min: 0, max: 50 }
  },

  // Live meters. Counters are incremented at the point of use and corrected by
  // the nightly reconciliation job, because $inc drifts over months.
  usage: {
    storageBytes: { type: Number, default: 0 },
    fileCount: { type: Number, default: 0 },
    // Storage consumed out of the completion buffer (over the licensed size).
    bufferBytesUsed: { type: Number, default: 0 },
    submissions: {
      periodStart: { type: Date, default: null },
      periodEnd: { type: Date, default: null },
      count: { type: Number, default: 0 }
    },
    // Which warnings have already been sent, so crossing 90% doesn't email the
    // admin on every submission. Cleared when the period rolls over.
    notified: {
      sub80: { type: Boolean, default: false },
      sub90: { type: Boolean, default: false },
      sub100: { type: Boolean, default: false },
      stor80: { type: Boolean, default: false },
      stor90: { type: Boolean, default: false },
      stor95: { type: Boolean, default: false },
      stor100: { type: Boolean, default: false },
      buffer: { type: Boolean, default: false }
    }
  },

  // Temporary storage grant from the Platform Super Admin, for when even the
  // completion buffer is exhausted and an approval still has to go through.
  storageExtension: {
    extraMb: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' }
  },

  status: { type: String, enum: ['active', 'suspended'], default: 'active' },

  // The single bootstrap org that all pre-tenancy records are migrated into.
  // Exactly one organization should have this flag.
  isDefault: { type: Boolean, default: false },

  // The bootstrap Org Admin auto-created with this org from the Platform panel.
  // Lets the Super Admin reset that admin's password and show who owns the
  // workspace. Null for the default org and any legacy orgs.
  adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

// The expiry cron scans by date across all tenants.
organizationSchema.index({ 'licence.validUntil': 1 })
organizationSchema.index({ 'licence.trialEndsAt': 1 })

// Licensed storage plus any unexpired Super Admin extension, in MB.
// 0 stays 0 (unlimited storage cannot be extended).
organizationSchema.methods.storageLimitMb = function () {
  const base = Number(this.limits?.maxStorageMb || 0)
  if (base <= 0) return 0
  const ext = this.storageExtension
  const live = ext?.extraMb > 0 && (!ext.expiresAt || ext.expiresAt.getTime() > Date.now())
  return base + (live ? Number(ext.extraMb) : 0)
}

// The date this org stops being writable, whichever comes first, or null when
// it is perpetual.
organizationSchema.methods.expiryDate = function () {
  const dates = [this.licence?.validUntil, this.licence?.trialEndsAt].filter(Boolean)
  if (!dates.length) return null
  return new Date(Math.min(...dates.map((d) => new Date(d).getTime())))
}

module.exports = mongoose.model('Organization', organizationSchema)

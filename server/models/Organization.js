// Multi-tenancy Step 1 - models/Organization.js
// A tenant of the platform. Every business record (User, Form, Workflow,
// Task, ...) is stamped with an orgId pointing here, and all queries are
// scoped by it. Policy knobs (allowedDomains, features, limits) live on
// this document so the Platform Super Admin can change tenant behavior
// without a code change.

const mongoose = require('mongoose')

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

  features: {
    aiRouting: { type: Boolean, default: true },
    // Allows user creation with emails outside allowedDomains (contractors).
    externalUsers: { type: Boolean, default: false }
  },

  // 0 = unlimited. Enforcement is optional polish (build-order step 10).
  limits: {
    maxUsers: { type: Number, default: 0 },
    maxWorkflows: { type: Number, default: 0 }
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

module.exports = mongoose.model('Organization', organizationSchema)

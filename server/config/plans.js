// Licensing Phase 1 - config/plans.js
// The subscription catalogue. Every limit the product enforces lives here, so a
// price change is a one-file change and nothing has to hunt through routes.
//
// Convention: 0 means unlimited. It is the convention the Organization model
// already used for maxUsers/maxWorkflows, so pre-licensing orgs (which have
// zeros everywhere) keep behaving exactly as before.

// Sizes are stored in MB because that is how they are sold ("10 GB plan").
const GB = 1024

const RESOURCES = [
  'users',
  'builders',
  'forms',
  'workflows',
  'submissions',
  'storage',
  'files',
]

// The limit field on Organization.limits that backs each resource.
const LIMIT_FIELD = {
  users: 'maxUsers',
  builders: 'maxBuilders',
  forms: 'maxForms',
  workflows: 'maxWorkflows',
  submissions: 'maxSubmissionsPerPeriod',
  storage: 'maxStorageMb',
  files: 'maxFiles',
}

const PLAN_PRESETS = {
  // Self-evaluation tier. Expires into read-only mode via trialEndsAt.
  trial: {
    label: 'Trial',
    trialDays: 14,
    limits: {
      maxUsers: 3,
      maxBuilders: 1,
      maxForms: 5,
      maxWorkflows: 2,
      maxSubmissionsPerPeriod: 100,
      maxStorageMb: 1 * GB,
      maxFiles: 0,
    },
  },
  basic: {
    label: 'Basic',
    limits: {
      maxUsers: 10,
      maxBuilders: 1,
      maxForms: 25,
      maxWorkflows: 10,
      maxSubmissionsPerPeriod: 1000,
      maxStorageMb: 5 * GB,
      maxFiles: 0,
    },
  },
  professional: {
    label: 'Professional',
    limits: {
      maxUsers: 50,
      maxBuilders: 3,
      maxForms: 100,
      maxWorkflows: 50,
      maxSubmissionsPerPeriod: 5000,
      maxStorageMb: 10 * GB,
      maxFiles: 0,
    },
  },
  // Negotiated per customer: unlimited by default, tightened per org.
  enterprise: {
    label: 'Enterprise',
    limits: {
      maxUsers: 0,
      maxBuilders: 0,
      maxForms: 0,
      maxWorkflows: 0,
      maxSubmissionsPerPeriod: 0,
      maxStorageMb: 0,
      maxFiles: 0,
    },
  },
  // Not offered for sale — used when no sellable tier was chosen (legacy / omit).
  // Negotiated limits on a sold tier keep that tier name (e.g. enterprise).
  custom: {
    label: 'Custom',
    limits: null,
  },
}

const PLAN_KEYS = Object.keys(PLAN_PRESETS)
// Plans a Super Admin can pick when creating an org ('custom' is derived).
const SELLABLE_PLANS = PLAN_KEYS.filter((p) => p !== 'custom')

const DEFAULT_PLAN = 'custom'

// Warning thresholds (percent of limit). Storage gets a 95% step because
// running out of it interrupts approvals, not just new work.
const WARN_THRESHOLDS = {
  submissions: [80, 90, 100],
  storage: [80, 90, 95, 100],
  default: [80, 90, 100],
}

// Storage headroom that exists only so an in-flight approval carrying a required
// attachment can still be finished. Never for new submissions or ad-hoc uploads.
const BUFFER_PERCENT = 5
const BUFFER_CAP_MB = 500

const presetFor = (plan) => PLAN_PRESETS[plan] || null

const isUnlimited = (limit) => !limit || Number(limit) <= 0

// Returns a fresh limits object for a plan, or null for 'custom'/unknown.
const limitsForPlan = (plan) => {
  const preset = presetFor(plan)
  if (!preset || !preset.limits) return null
  return { ...preset.limits }
}

// The storage buffer for a given licensed size: min(5%, 500 MB). Unlimited
// storage needs no buffer because it can never be full.
const bufferMbFor = (maxStorageMb) => {
  if (isUnlimited(maxStorageMb)) return 0
  return Math.min(Math.round((Number(maxStorageMb) * BUFFER_PERCENT) / 100), BUFFER_CAP_MB)
}

// True when limits still match a catalogue preset (handy for UI hints / tests).
const matchesPreset = (plan, limits = {}) => {
  const preset = limitsForPlan(plan)
  if (!preset) return false
  return Object.keys(preset).every((k) => Number(limits[k] || 0) === Number(preset[k] || 0))
}

module.exports = {
  GB,
  RESOURCES,
  LIMIT_FIELD,
  PLAN_PRESETS,
  PLAN_KEYS,
  SELLABLE_PLANS,
  DEFAULT_PLAN,
  WARN_THRESHOLDS,
  BUFFER_PERCENT,
  BUFFER_CAP_MB,
  presetFor,
  limitsForPlan,
  isUnlimited,
  bufferMbFor,
  matchesPreset,
}

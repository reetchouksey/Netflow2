// Shared platform demo extra orgs to keep organization directory, usage, and dashboard in sync.

export const DEMO_EXTRA_ORGS = [
  {
    _id: 'demo-acme',
    name: 'Acme Corporation',
    subdomain: 'acme',
    plan: 'enterprise',
    status: 'active',
    admin: { name: 'Jane Cooper', email: 'jane@acme.com' },
    adminName: 'Jane Cooper',
    adminEmail: 'jane@acme.com',
    hasMoreAdmin: true,
    validUntil: '2026-12-17',
    createdAt: '2026-01-19T00:00:00.000Z',
    usage: { users: 320, forms: 128, workflows: 62, submissions: 1840, storageMb: 24678 },
    limits: { maxForms: 1000, maxWorkflows: 1000, maxUsers: 1000, storageGb: 1000 }
  },
  {
    _id: 'demo-globex',
    name: 'Globex',
    subdomain: 'globex',
    plan: 'growth',
    status: 'active',
    upgradeRequested: true,
    admin: { name: 'Cody Fisher', email: 'cody@globex.com' },
    adminName: 'Cody Fisher',
    adminEmail: 'cody@globex.com',
    validUntil: '2026-08-06',
    createdAt: '2026-03-30T00:00:00.000Z',
    usage: { users: 262, forms: 89, workflows: 31, submissions: 950, storageMb: 12000 },
    limits: { maxForms: 500, maxWorkflows: 200, maxUsers: 500, storageGb: 500 }
  },
  {
    _id: 'demo-initech',
    name: 'Initech',
    subdomain: 'initech',
    plan: 'scale',
    status: 'suspended',
    admin: { name: 'Robert Vance', email: 'robert@initech.com' },
    adminName: 'Robert Vance',
    adminEmail: 'robert@initech.com',
    validUntil: '2026-07-24',
    createdAt: '2026-02-11T00:00:00.000Z',
    usage: { users: 188, forms: 42, workflows: 18, submissions: 610, storageMb: 8000 },
    limits: { maxForms: 300, maxWorkflows: 100, maxUsers: 300, storageGb: 300 }
  },
  {
    _id: 'demo-umbrella',
    name: 'Umbrella Group',
    subdomain: 'umbrella',
    plan: 'growth',
    status: 'trial',
    admin: { name: 'Marcus Hale', email: 'marcus@umbrella.com' },
    adminName: 'Marcus Hale',
    adminEmail: 'marcus@umbrella.com',
    validUntil: '2026-08-01',
    createdAt: '2026-06-22T00:00:00.000Z',
    usage: { users: 215, forms: 56, workflows: 24, submissions: 520, storageMb: 10500 },
    limits: { maxForms: 500, maxWorkflows: 200, maxUsers: 500, storageGb: 500 }
  },
  {
    _id: 'demo-soylent',
    name: 'Soylent Industries',
    subdomain: 'soylent',
    plan: 'growth',
    status: 'active',
    downgradeRequested: true,
    admin: { name: 'Dana Whitfield', email: 'dana@soylent.com' },
    adminName: 'Dana Whitfield',
    adminEmail: 'dana@soylent.com',
    validUntil: '2026-08-24',
    createdAt: '2026-05-08T00:00:00.000Z',
    usage: { users: 144, forms: 38, workflows: 14, submissions: 289, storageMb: 6000 },
    limits: { maxForms: 500, maxWorkflows: 200, maxUsers: 500, storageGb: 500 }
  }
]

export function mergePlatformOrgs(apiOrgs = []) {
  return Array.isArray(apiOrgs) ? apiOrgs : []
}

// Shared - utils/permissions.js
// Single source of truth for "can this user do X?" in the UI. These helpers
// only gate UI affordances (show/hide buttons + nav links); the backend still
// enforces the same rules via roleGuard middleware, so a sneaky user typing
// the URL directly can't escalate.

const roleName = (user) => user?.role?.name || null

// Roles that can design forms + workflows. Manager, HR and VP all qualify
// as "builders" — they own different slices of the org but each owns at
// least one process.
const BUILDER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

// Roles that can create / edit / deactivate other users.
const ADMIN_ROLES = new Set(['Admin'])

// Roles that can see analytics / audit log.
const REPORT_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

// Roles that can submit a form. Viewers are read-only.
const SUBMITTER_ROLES = new Set([
  'Admin', 'CEO', 'Manager', 'HR', 'VP', 'Employee'
])

export const canCreateForm = (user) => BUILDER_ROLES.has(roleName(user))
export const canCreateWorkflow = (user) => BUILDER_ROLES.has(roleName(user))

// Edit (modify existing) is restricted to Admin only — other builders can
// create new items but cannot mutate published / live ones.
export const canEditWorkflow = (user) => ADMIN_ROLES.has(roleName(user))
export const canEditForm = (user) => ADMIN_ROLES.has(roleName(user))

export const canManageUsers = (user) => ADMIN_ROLES.has(roleName(user))

export const canViewReports = (user) => REPORT_ROLES.has(roleName(user))

export const canSubmitForms = (user) => SUBMITTER_ROLES.has(roleName(user))

export const isViewer = (user) => roleName(user) === 'Viewer'

// Roles that can act on (approve / reject) tasks routed to them. Everyone else
// only ever submits requests, so the UI labels their queue "Requests".
const APPROVER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])
export const isApprover = (user) => APPROVER_ROLES.has(roleName(user))

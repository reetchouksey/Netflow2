// Shared - utils/permissions.js
// Single source of truth for "can this user do X?" in the UI. These helpers
// only gate UI affordances (show/hide buttons + nav links); the backend still
// enforces the same rules via roleGuard middleware.
//
// Four product shells (see AppShell nav):
//   platform  — SuperAdmin
//   orgAdmin  — Org Admin (configure the tenant)
//   ops       — Manager / HR / CEO / VP (approve + monitor)
//   workspace — Employee (submit + track)

const roleName = (user) => user?.role?.name || null

export const SHELL = {
  PLATFORM: 'platform',
  ORG_ADMIN: 'orgAdmin',
  OPS: 'ops',
  WORKSPACE: 'workspace'
}

// Org Admin alone designs forms/workflows. Leaders operate; employees submit.
const DESIGNER_ROLES = new Set(['Admin'])

// Business leaders — approvals + reports, not the builder.
const OPS_ROLES = new Set(['CEO', 'Manager', 'HR', 'VP'])

const ADMIN_ROLES = new Set(['Admin'])

const REPORT_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

const SUBMITTER_ROLES = new Set([
  'Admin', 'CEO', 'Manager', 'HR', 'VP', 'Employee'
])

const APPROVER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

// Roles that answer for other people, so the team roster means something to
// them. Mirrors TEAM_LEADS in server/routes/team.js.
const TEAM_LEAD_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

export const getShell = (user) => {
  const role = roleName(user)
  if (role === 'SuperAdmin') return SHELL.PLATFORM
  if (role === 'Admin') return SHELL.ORG_ADMIN
  if (OPS_ROLES.has(role)) return SHELL.OPS
  return SHELL.WORKSPACE
}

export const canCreateForm = (user) => DESIGNER_ROLES.has(roleName(user))
export const canCreateWorkflow = (user) => DESIGNER_ROLES.has(roleName(user))

export const canEditWorkflow = (user) => ADMIN_ROLES.has(roleName(user))
export const canEditForm = (user) => ADMIN_ROLES.has(roleName(user))

export const canManageUsers = (user) => ADMIN_ROLES.has(roleName(user))

export const canViewReports = (user) => REPORT_ROLES.has(roleName(user))

export const canSubmitForms = (user) => SUBMITTER_ROLES.has(roleName(user))

export const isApprover = (user) => APPROVER_ROLES.has(roleName(user))

export const canViewTeam = (user) => TEAM_LEAD_ROLES.has(roleName(user))

export const isSuperAdmin = (user) => roleName(user) === 'SuperAdmin'

export const isOrgAdmin = (user) => roleName(user) === 'Admin'

export const isOpsLeader = (user) => OPS_ROLES.has(roleName(user))

// Platform staff live outside every workspace: no forms, workflows, tasks,
// reports or user admin. Mirrored server-side by middleware/shellScope.
export const isPlatformShell = (user) => getShell(user) === SHELL.PLATFORM

export const isTenantShell = (user) => getShell(user) !== SHELL.PLATFORM

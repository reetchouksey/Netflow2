// Shared role sets for route guards — keep in sync with frontend/src/utils/permissions.js
// Shells: platform (SuperAdmin) | orgAdmin (Admin) | ops (leaders) | workspace (Employee)

const DESIGNER_ROLES = ['Admin']
const OPS_ROLES = ['Admin', 'CEO', 'Manager', 'HR', 'VP']
const SUBMITTER_ROLES = ['Admin', 'CEO', 'Manager', 'HR', 'VP', 'Employee']
const REPORT_ROLES = ['Admin', 'CEO', 'Manager', 'HR', 'VP']

const isDesigner = (user) => DESIGNER_ROLES.includes(user?.role?.name) || Boolean(user?.canBuild)
const isOps = (user) => OPS_ROLES.includes(user?.role?.name)

const shellFor = (roleName) => {
  if (roleName === 'SuperAdmin') return 'platform'
  if (roleName === 'Admin') return 'orgAdmin'
  if (OPS_ROLES.includes(roleName)) return 'ops'
  return 'workspace'
}

// The capability matrix the Roles & Permissions page renders. Built from the
// very lists the route guards use above, so the page cannot drift away from
// what the API actually enforces — if a guard changes, the matrix changes with
// it. `note` explains a condition the role list alone cannot express.
const CAPABILITIES = [
  {
    key: 'design',
    label: 'Design forms & workflows',
    description: 'Create, edit and publish the templates everyone else uses.',
    roles: DESIGNER_ROLES,
    note: 'Also needs a builder seat'
  },
  {
    key: 'approve',
    label: 'Approve requests',
    description: 'Act on approval, review and submission tasks assigned to them.',
    roles: OPS_ROLES
  },
  {
    key: 'submit',
    label: 'Submit forms',
    description: 'Fill in a form and start a request.',
    roles: SUBMITTER_ROLES
  },
  {
    key: 'reports',
    label: 'Reports & audit log',
    description: 'Analytics, SLA breaches, department KPIs and the audit trail.',
    roles: REPORT_ROLES
  },
  {
    key: 'users',
    label: 'Manage users',
    description: 'Invite, edit, deactivate people and change their roles.',
    roles: DESIGNER_ROLES
  },
  {
    key: 'organization',
    label: 'Organization settings',
    description: 'Workspace name, billing contact and the department list.',
    roles: DESIGNER_ROLES
  }
]

// Display order for the roles page: seniority first, workspace roles last, then
// anything a deployment has added on top.
const ROLE_ORDER = ['Admin', 'CEO', 'VP', 'Manager', 'HR', 'Employee']

module.exports = {
  DESIGNER_ROLES,
  OPS_ROLES,
  SUBMITTER_ROLES,
  REPORT_ROLES,
  CAPABILITIES,
  ROLE_ORDER,
  shellFor,
  isDesigner,
  isOps
}

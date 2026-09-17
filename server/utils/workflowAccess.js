// M1/M2 - utils/workflowAccess.js
// Centralized Access & Visibility control for Workflows and Forms.

const MANAGER_ROLES = ['Manager', 'Admin', 'CEO', 'VP', 'HR']

/**
 * Checks if a user is a manager (by role or by having direct reports)
 */
const userIsManager = async (user, User) => {
  const roleName = user?.role?.name || (typeof user?.role === 'string' ? user.role : '')
  if (MANAGER_ROLES.includes(roleName)) return true
  if (User && user?._id) {
    try {
      const hasReport = await User.exists({ managerId: user._id })
      if (hasReport) return true
    } catch {}
  }
  return false
}

/**
 * Checks if a user has access to see/use a workflow or its linked form.
 *
 * @param {Object} access - The workflow.access object
 * @param {Object} user - The authenticated user object (with ._id, .role, .department, .canBuild)
 * @returns {boolean}
 */
const canUserAccessWorkflow = (access, user) => {
  if (!user) return false

  // Elevated roles & builder seats always bypass
  const roleName = user?.role?.name || (typeof user?.role === 'string' ? user.role : '')
  if (['Admin', 'SuperAdmin'].includes(roleName) || user?.canBuild === true) {
    return true
  }

  // If no access restrictions exist, workflow/form is open by default
  if (!access) return true

  const userId = String(user._id || '')
  const userDept = user.department || ''

  // 1. Visibility Gate:
  const vis = access.visibility || 'company'
  if (vis === 'roles') {
    const roles = access.roles || []
    if (roles.length > 0 && !roles.includes(roleName)) {
      return false
    }
  } else if (vis === 'departments') {
    const depts = access.departments || []
    if (depts.length > 0 && !depts.includes(userDept)) {
      return false
    }
  } else if (vis === 'people') {
    const people = (access.visibleTo || []).map((id) => String(id?._id || id))
    if (people.length > 0 && !people.includes(userId)) {
      return false
    }
  }

  // 2. Who Can Submit Gate:
  const who = access.whoCanSubmit || 'All employees'
  if (who === 'Specific roles') {
    const roles = access.roles || []
    if (roles.length > 0 && !roles.includes(roleName)) {
      return false
    }
  } else if (who === 'Specific departments') {
    const depts = access.departments || []
    if (depts.length > 0 && !depts.includes(userDept)) {
      return false
    }
  } else if (who === 'Specific people') {
    const allowed = (access.allowedInitiators || []).map((id) => String(id?._id || id))
    if (allowed.length > 0 && !allowed.includes(userId)) {
      return false
    }
  } else if (who === 'Managers only') {
    if (!MANAGER_ROLES.includes(roleName)) {
      return false
    }
  }

  // 3. If explicit roles / people / departments are restricted in access object:
  if (Array.isArray(access.roles) && access.roles.length > 0) {
    if (!access.roles.includes(roleName)) {
      return false
    }
  }

  return true
}

module.exports = {
  MANAGER_ROLES,
  userIsManager,
  canUserAccessWorkflow
}

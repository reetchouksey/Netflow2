// Shared - Phase 2 - App.jsx - Routes + auth guards

import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { authStore, useUser } from './utils/auth'
import { getToken } from './utils/api'
import { canCreateWorkflow, canViewReports, canEditWorkflow, canEditForm, canCreateForm, canManageUsers, isSuperAdmin, isTenantShell, isOrgAdmin, canViewTeam } from './utils/permissions'

// Self-registration disabled — admins create users via the Admin Panel.
// import Register from './pages/Register'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Business from './pages/Bussiness/index'
import DocumentsDashboard from './pages/DocumentsDashboard'
import S3Dashboard from './pages/S3Dashboard'
import AdminPanel from './pages/AdminPanel'
import Team from './pages/Team'
import Departments from './pages/Departments'
import RolesPermissions from './pages/RolesPermissions'
import OrgSettings from './pages/OrgSettings'
import Billing from './pages/Billing'
import Workflows from './pages/Workflows'
import NewWorkflow from './pages/NewWorkflow'
import Forms from './pages/Forms'
import NewForm from './pages/NewForm'
import FillForm from './pages/FillForm'
import FormResponses from './pages/FormResponses'
import PublicForm from './pages/PublicForm'
import OAuthCallback from './pages/OAuthCallback'
import TaskInbox from './pages/TaskInbox'
import TaskDetail from './pages/TaskDetail'
import Analytics from './pages/Analytics'
import AuditLog from './pages/AuditLog'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import PlatformPanel from './pages/PlatformPanel'
import PlatformActivity from './pages/PlatformActivity'
import PlatformHealth from './pages/PlatformHealth'
import PlatformUsage from './pages/PlatformUsage'
import PlatformPlans from './pages/PlatformPlans'
import PlatformAdmins from './pages/PlatformAdmins'
import ChangePassword from './pages/ChangePassword'
import DmsProvider from './pages/DmsProvider'
import Toaster from './components/Toaster'
import ConfirmDialog from './components/ConfirmDialog'
import UserGuideHost from './components/UserGuideHost'

// Users flagged mustChangePassword (e.g. a freshly provisioned org admin) are
// held on /change-password until they set a real password.
function needsPasswordChange(user, location) {
  return Boolean(user?.mustChangePassword) && location.pathname !== '/change-password'
}

function RequireAuth({ children }) {
  const user = useUser()
  const location = useLocation()
  const token = getToken()
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (needsPasswordChange(user, location)) {
    return <Navigate to="/change-password" replace />
  }
  return children
}

// Requires auth AND a role check. Logged-out users go to /login; logged-in
// users who fail the role check (e.g. an Employee hitting /workflows) are
// bounced back to their dashboard. Mirrors the nav-visibility rules.
function RequireRole({ can, children }) {
  const user = useUser()
  const location = useLocation()
  const token = getToken()
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (needsPasswordChange(user, location)) {
    return <Navigate to="/change-password" replace />
  }
  if (typeof can === 'function' && !can(user)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

// Workspace pages (forms, requests, reports, user admin) belong to a tenant.
// Platform staff have no workspace, so they land back on the platform console
// instead of an empty or borrowed org. The API refuses the same calls.
function RequireTenant({ children }) {
  return <RequireRole can={isTenantShell}>{children}</RequireRole>
}

function RequireDms({ children }) {
  const user = useUser()
  const location = useLocation()
  const token = getToken()
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (needsPasswordChange(user, location)) {
    return <Navigate to="/change-password" replace />
  }
  if (user.dmsEnabled === false) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function PublicOnly({ children }) {
  const user = useUser()
  const token = getToken()
  if (token && user) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function AuthenticatedTourHost() {
  const user = useUser()
  const location = useLocation()
  const token = getToken()
  if (!token || !user) return null
  if (user.mustChangePassword) return null
  // Public / auth screens never show the application demo overlay.
  if (
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/forgot-password') ||
    location.pathname.startsWith('/reset-password') ||
    location.pathname.startsWith('/change-password') ||
    location.pathname.startsWith('/f/') ||
    location.pathname.startsWith('/oauth/')
  ) {
    return null
  }
  return <UserGuideHost />
}

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // On boot, if we have a token try to refresh user info. This kicks invalid
    // tokens out via the /api wrapper's 401 redirect.
    const token = getToken()
    if (token) {
      authStore.refresh().finally(() => setReady(true))
    } else {
      setReady(true)
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="text-sm text-fg-muted">Loading NetFlow...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Toaster />
      <ConfirmDialog />
      {/* Tour lives at app root so it survives Form/Workflow builders (no AppShell). */}
      <AuthenticatedTourHost />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Self-registration disabled — only admins create users via the Admin Panel.
            /register now falls through to the catch-all below and redirects to /login. */}
        {/* <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} /> */}
        <Route path="/login"    element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/business"        element={<Business />} />
        
        {/* Public (unauthenticated) form links — collect data from non-users */}
        <Route path="/f/:token" element={<PublicForm />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        <Route path="/dashboard"     element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/documents"     element={<RequireDms><DocumentsDashboard /></RequireDms>} />
        <Route path="/s3-storage"    element={<RequireTenant><S3Dashboard /></RequireTenant>} />
        <Route path="/forms"          element={<RequireTenant><Forms /></RequireTenant>} />
        <Route path="/forms/new"      element={<RequireRole can={canCreateForm}><NewForm /></RequireRole>} />
        <Route path="/forms/:id/fill" element={<RequireTenant><FillForm /></RequireTenant>} />
        <Route path="/forms/:id/responses" element={<RequireRole can={canCreateForm}><FormResponses /></RequireRole>} />
        <Route path="/tasks"         element={<RequireTenant><TaskInbox /></RequireTenant>} />
        <Route path="/tasks/:id"     element={<RequireTenant><TaskDetail /></RequireTenant>} />
        <Route path="/analytics"     element={<RequireRole can={canViewReports}><Analytics /></RequireRole>} />
        <Route path="/audit-log"     element={<RequireRole can={canViewReports}><AuditLog /></RequireRole>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/profile"       element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route path="/workflows"          element={<RequireRole can={canCreateWorkflow}><Workflows /></RequireRole>} />
        <Route path="/workflows/new"      element={<RequireRole can={canCreateWorkflow}><NewWorkflow /></RequireRole>} />
        <Route path="/workflows/:id/edit" element={<RequireRole can={canEditWorkflow}><NewWorkflow /></RequireRole>} />
        <Route path="/forms/:id/edit"     element={<RequireRole can={canEditForm}><NewForm /></RequireRole>} />
        <Route path="/admin"         element={<RequireRole can={canManageUsers}><AdminPanel /></RequireRole>} />
        {/* Shell 3 — a leader operating: the people they answer for */}
        <Route path="/team"          element={<RequireRole can={canViewTeam}><Team /></RequireRole>} />
        {/* Shell 2 — configuring the workspace itself, Org Admin only */}
        <Route path="/departments"   element={<RequireRole can={isOrgAdmin}><Departments /></RequireRole>} />
        <Route path="/roles"         element={<RequireRole can={isOrgAdmin}><RolesPermissions /></RequireRole>} />
        <Route path="/settings"      element={<RequireRole can={isOrgAdmin}><OrgSettings /></RequireRole>} />
        <Route path="/billing"       element={<RequireRole can={isOrgAdmin}><Billing /></RequireRole>} />
        <Route path="/platform"      element={<RequireRole can={isSuperAdmin}><PlatformPanel /></RequireRole>} />
        <Route path="/usage"         element={<RequireRole can={isSuperAdmin}><PlatformUsage /></RequireRole>} />
        <Route path="/activity"      element={<RequireRole can={isSuperAdmin}><PlatformActivity /></RequireRole>} />
        <Route path="/health"        element={<RequireRole can={isSuperAdmin}><PlatformHealth /></RequireRole>} />
        <Route path="/plans"         element={<RequireRole can={isSuperAdmin}><PlatformPlans /></RequireRole>} />
        <Route path="/admins"        element={<RequireRole can={isSuperAdmin}><PlatformAdmins /></RequireRole>} />
        <Route path="/dms"           element={<RequireRole can={isSuperAdmin}><DmsProvider /></RequireRole>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

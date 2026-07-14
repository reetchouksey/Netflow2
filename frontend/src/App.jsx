// Shared - Phase 2 - App.jsx - Routes + auth guards

import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { authStore, useUser } from './utils/auth'
import { getToken } from './utils/api'
import { canCreateWorkflow, canViewReports, canEditWorkflow, canEditForm, canCreateForm, isSuperAdmin } from './utils/permissions'

// Self-registration disabled — admins create users via the Admin Panel.
// import Register from './pages/Register'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'
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
import ApprovalRouting from './pages/ApprovalRouting'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import PlatformPanel from './pages/PlatformPanel'
import ChangePassword from './pages/ChangePassword'
import Toaster from './components/Toaster'
import ConfirmDialog from './components/ConfirmDialog'

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

function PublicOnly({ children }) {
  const user = useUser()
  const token = getToken()
  if (token && user) {
    return <Navigate to="/dashboard" replace />
  }
  return children
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
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Self-registration disabled — only admins create users via the Admin Panel.
            /register now falls through to the catch-all below and redirects to /login. */}
        {/* <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} /> */}
        <Route path="/login"    element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Public, unauthenticated form link (share with non-users). */}
        <Route path="/f/:token" element={<PublicForm />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        <Route path="/dashboard"     element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/forms"          element={<RequireAuth><Forms /></RequireAuth>} />
        <Route path="/forms/new"      element={<RequireAuth><NewForm /></RequireAuth>} />
        <Route path="/forms/:id/fill" element={<RequireAuth><FillForm /></RequireAuth>} />
        <Route path="/forms/:id/responses" element={<RequireRole can={canCreateForm}><FormResponses /></RequireRole>} />
        <Route path="/tasks"         element={<RequireAuth><TaskInbox /></RequireAuth>} />
        <Route path="/tasks/:id"     element={<RequireAuth><TaskDetail /></RequireAuth>} />
        <Route path="/analytics"     element={<RequireAuth><Analytics /></RequireAuth>} />
        <Route path="/audit-log"     element={<RequireAuth><AuditLog /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/profile"       element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route path="/workflows"          element={<RequireRole can={canCreateWorkflow}><Workflows /></RequireRole>} />
        <Route path="/workflows/new"      element={<RequireRole can={canCreateWorkflow}><NewWorkflow /></RequireRole>} />
        <Route path="/workflows/:id/edit" element={<RequireRole can={canEditWorkflow}><NewWorkflow /></RequireRole>} />
        <Route path="/forms/:id/edit"     element={<RequireRole can={canEditForm}><NewForm /></RequireRole>} />
        <Route path="/approval-routing" element={<RequireRole can={canViewReports}><ApprovalRouting /></RequireRole>} />
        <Route path="/admin"         element={<RequireAuth><AdminPanel /></RequireAuth>} />
        <Route path="/platform"      element={<RequireRole can={isSuperAdmin}><PlatformPanel /></RequireRole>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

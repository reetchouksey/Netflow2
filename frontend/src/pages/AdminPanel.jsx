// Shared - AdminPanel.jsx
// Real user management. Pulls users from GET /api/users and roles from
// GET /api/roles. Admins can invite, change role, change department, and
// deactivate / reactivate users. Non-admins see a friendly forbidden screen.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser, DEPARTMENTS, initials } from '../utils/auth'
import { canManageUsers } from '../utils/permissions'
import { parseCsv, buildTemplate } from '../utils/csv'
import { confirm } from '../lib/confirmStore'

const AVATAR_PALETTE = [
  'bg-pink-100 text-pink-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700'
]
const avatarClassFor = (name) => {
  if (!name) return AVATAR_PALETTE[0]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

// ---------- create-user dialog ------------------------------------------

// Show roles in a sensible order in the dropdown. Anything not in this list
// (e.g. a future custom role) is appended alphabetically.
const ROLE_ORDER = [
  'Admin', 'CEO', 'Manager', 'HR', 'VP', 'Employee', 'Viewer',
  'Receiving Staff', 'Warehouse Manager', 'Accounts Officer', 'Brand Rep', 'Finance Approver'
]

// System-admin roles sit outside the org chart: no department, no reporting
// manager, and their role isn't reassigned inline from this table.
const SYSTEM_ADMIN_ROLES = new Set(['Admin'])
const sortRoles = (roles) => {
  const indexed = roles.map((r) => ({
    r,
    idx: ROLE_ORDER.indexOf(r.name)
  }))
  indexed.sort((a, b) => {
    if (a.idx === -1 && b.idx === -1) return a.r.name.localeCompare(b.r.name)
    if (a.idx === -1) return 1
    if (b.idx === -1) return -1
    return a.idx - b.idx
  })
  return indexed.map(({ r }) => r)
}

function CreateUserDialog({ roles, managers, hrPeople, onClose, onCreated }) {
  const sortedRoles = useMemo(() => sortRoles(roles), [roles])
  const defaultRoleId =
    sortedRoles.find((r) => r.name === 'Employee')?._id ||
    sortedRoles[0]?._id ||
    ''

  const [form, setForm] = useState({
    name: '',
    email: '',
    department: DEPARTMENTS[0],
    roleId: defaultRoleId,
    managerId: '',
    hrId: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setError('')
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let out = ''
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
    setForm((p) => ({ ...p, password: out }))
    setShowPassword(true)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required')
      return
    }
    if (!form.roleId) {
      setError('Pick a role for this user')
      return
    }
    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        department: form.department,
        roleId: form.roleId,
        managerId: form.managerId || undefined,
        hrId: form.hrId || undefined,
        password: form.password
      }
      const data = await api.post('/api/users', payload)
      onCreated(data.user, data.domainWarning)
    } catch (err) {
      setError(err.message || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface rounded-xl shadow-xl border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg">Create a user</h2>
            <p className="text-[11px] text-fg-muted mt-0.5">
              You set the role, department and initial password. Share the credentials with the user.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-surface-3 text-fg-subtle flex items-center justify-center transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3" noValidate>
          {error && (
            <div className="p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Full name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Arjun Kumar"
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Work email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="arjun@company.com"
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Role</label>
              <select
                name="roleId"
                value={form.roleId}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                {sortedRoles.map((r) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Department</label>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Reporting manager</label>
            <select
              name="managerId"
              value={form.managerId}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            >
              <option value="">— No manager —</option>
              {(managers || []).map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}{m.department ? ` · ${m.department}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-fg-subtle mt-1">
              Who this person reports to. You can change it later from the table.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">HR partner</label>
            <select
              name="hrId"
              value={form.hrId}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            >
              <option value="">— No HR —</option>
              {(hrPeople || []).map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}{h.department ? ` · ${h.department}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-fg-subtle mt-1">
              {(hrPeople || []).length === 0
                ? 'No HR-role users yet — create one to assign HR partners.'
                : 'The HR person responsible for this user.'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-fg-muted">
                Initial password <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                Generate
              </button>
            </div>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-16 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-medium text-fg-muted hover:text-fg"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-fg-subtle mt-1">
              Share this password securely. The user can change it after their first login.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition"
            >
              {submitting ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------- edit-user dialog --------------------------------------------

function EditUserDialog({ user, roles, managers, hrPeople, isSelf, onClose, onSaved }) {
  const sortedRoles = useMemo(() => sortRoles(roles || []), [roles])
  // System admins (Admin) sit outside the org chart: no department, manager or
  // HR partner, and their role is managed separately. You also can't change
  // your own role.
  const orgExempt = SYSTEM_ADMIN_ROLES.has(user.role?.name)
  const roleLocked = orgExempt || isSelf

  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    password: '',
    roleId: user.role?._id || '',
    department: user.department || DEPARTMENTS[0],
    managerId: user.managerId || '',
    hrId: user.hrId || ''
  })
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    const password = form.password
    if (!name) { setError('Name is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }
    if (password && password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setSubmitting(true)
    try {
      // Role has a dedicated endpoint; skip it when locked or unchanged.
      if (!roleLocked && form.roleId && form.roleId !== (user.role?._id || '')) {
        await api.post(`/api/users/${user._id}/assign-role`, { roleId: form.roleId })
      }
      const payload = { name, email }
      if (password) payload.password = password
      if (!orgExempt) {
        payload.department = form.department
        payload.managerId = form.managerId || null
        payload.hrId = form.hrId || null
      }
      const data = await api.put(`/api/users/${user._id}`, payload)
      onSaved(data.user)
    } catch (err) {
      setError(err.message || 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface rounded-xl shadow-xl border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg">Edit user</h2>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Update name, email, role, department, manager &amp; HR partner, or reset the password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-surface-3 text-fg-subtle flex items-center justify-center transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3" noValidate>
          {error && (
            <div className="p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Full name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Arjun Kumar"
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Work email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="arjun@company.com"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              The user signs in with this email — changing it updates their login.
            </p>
          </div>

          {orgExempt ? (
            <>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Role</label>
                <select
                  name="roleId"
                  value={form.roleId}
                  onChange={handleChange}
                  disabled
                  title="System admin roles are managed separately"
                  className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface-2 text-fg-muted cursor-not-allowed focus:outline-none"
                >
                  {sortedRoles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </div>
              <div className="p-2.5 rounded-md bg-surface-2 border border-line text-[11px] text-fg-muted">
                System admins sit outside the org chart, so they have no department, reporting manager or HR partner.
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Role</label>
                  <select
                    name="roleId"
                    value={form.roleId}
                    onChange={handleChange}
                    disabled={isSelf}
                    title={isSelf ? "You can't change your own role" : ''}
                    className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sortedRoles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Department</label>
                  <select
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  >
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Reporting manager</label>
                <select
                  name="managerId"
                  value={form.managerId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                >
                  <option value="">— No manager —</option>
                  {(managers || []).filter((m) => m._id !== user._id).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}{m.department ? ` · ${m.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">HR partner</label>
                <select
                  name="hrId"
                  value={form.hrId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                >
                  <option value="">— No HR —</option>
                  {(hrPeople || []).filter((h) => h._id !== user._id).map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}{h.department ? ` · ${h.department}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-fg-subtle mt-1">
                  {(hrPeople || []).length === 0
                    ? 'No HR-role users yet — create one to assign HR partners.'
                    : 'The HR person who handles this user’s people processes.'}
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">New password</label>
            <div className="relative">
              <input
                name="password"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current"
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-14 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 px-1"
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-fg-subtle mt-1">
              Optional — sets a new sign-in password (min 6 characters). Leave blank to keep the current one.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition"
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------- page --------------------------------------------------------

function AdminPanel() {
  const me = useUser()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [deptFilter, setDeptFilter] = useState('All departments')
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [busy, setBusy] = useState({}) // { [userId]: 'role' | 'department' | 'deactivate' }
  const [feedback, setFeedback] = useState('')

  const isAdmin = canManageUsers(me)

  // ---------- load ----------
  const loadUsers = async () => {
    try {
      const data = await api.get('/api/users?limit=100')
      setUsers(data.users || [])
    } catch (e) {
      setError(e.message || 'Failed to load users')
    }
  }

  const loadRoles = async () => {
    try {
      const data = await api.get('/api/roles')
      setRoles(data.roles || [])
    } catch {
      // Roles are required for the dropdowns. Show a quiet hint instead of
      // a blocking error so the rest of the page still works for browsing.
      setRoles([])
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    Promise.all([loadUsers(), loadRoles()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // ---------- mutations ----------

  const setBusyKey = (id, key) => setBusy((b) => ({ ...b, [id]: key }))
  const clearBusy = (id) => setBusy((b) => {
    const next = { ...b }
    delete next[id]
    return next
  })

  // Role, department, manager and HR partner are all edited from the Edit user
  // dialog (see EditUserDialog) rather than inline in the table.

  const handleToggleActive = async (user) => {
    if (user._id === me?._id) {
      setError('You cannot deactivate your own account.')
      return
    }
    setBusyKey(user._id, 'deactivate')
    setError('')
    try {
      if (user.isActive) {
        await api.delete(`/api/users/${user._id}`)
        setFeedback(`Deactivated ${user.name}.`)
      } else {
        await api.put(`/api/users/${user._id}`, { isActive: true })
        setFeedback(`Reactivated ${user.name}.`)
      }
      await loadUsers()
    } catch (e) {
      setError(e.message || 'Failed to update user')
    } finally {
      clearBusy(user._id)
    }
  }

  const handleDelete = async (user) => {
    if (user._id === me?._id) {
      setError('You cannot delete your own account.')
      return
    }
    const ok = await confirm({
      title: 'Delete user?',
      message:
        `Permanently delete ${user.name} (${user.email})?\n\n` +
        'This removes the account from the database and cannot be undone. ' +
        'Anyone who reports to them — or has them set as HR partner — will be detached.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setBusyKey(user._id, 'delete')
    setError('')
    try {
      await api.delete(`/api/users/${user._id}/permanent`)
      setFeedback(`Permanently deleted ${user.name}.`)
      await loadUsers()
    } catch (e) {
      setError(e.message || 'Failed to delete user')
    } finally {
      clearBusy(user._id)
    }
  }

  const handleCreated = (user, domainWarning) => {
    setCreateOpen(false)
    setFeedback(
      domainWarning
        ? `Created ${user.name}. Warning: ${domainWarning}`
        : `Created ${user.name} (${user.role?.name || 'no role'}). They can log in with the password you set.`
    )
    loadUsers()
  }

  // ---------- derived ----------

  // Candidate managers: active users with a leadership role, sorted by name.
  const MANAGER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])
  const managerOptions = useMemo(() => {
    return users
      .filter((u) => u.isActive !== false && MANAGER_ROLES.has(u.role?.name))
      .sort((a, b) => a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users])

  // HR partners: active users who hold the HR role.
  const hrOptions = useMemo(() => {
    return users
      .filter((u) => u.isActive !== false && u.role?.name === 'HR')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [users])

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search.trim() ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'All roles' || u.role?.name === roleFilter
      const matchesDept = deptFilter === 'All departments' || u.department === deptFilter
      return matchesSearch && matchesRole && matchesDept
    })
  }, [users, search, roleFilter, deptFilter])

  // ---------- gates ----------

  if (!me) return null

  if (!isAdmin) {
    return (
      <AppShell title="Admin Panel">
        <div className="max-w-md mx-auto bg-surface border border-line rounded-lg p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M5 19h14a2 2 0 001.85-2.74L13.85 4.74a2 2 0 00-3.7 0L3.15 16.26A2 2 0 005 19z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-fg">Admins only</p>
          <p className="text-sm text-fg-muted mt-1">
            You need an Admin role to manage users.
          </p>
        </div>
      </AppShell>
    )
  }

  const actions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setImportOpen(true)}
        disabled={roles.length === 0}
        className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-fg text-sm font-medium transition"
      >
        Import users
      </button>
      <button
        onClick={() => setCreateOpen(true)}
        disabled={roles.length === 0}
        className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition"
      >
        + New user
      </button>
    </div>
  )

  return (
    <AppShell
      title="Admin Panel"
      subtitle={`${users.length} ${users.length === 1 ? 'user' : 'users'} in your workspace`}
      actions={actions}
    >
      {feedback && (
        <div className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
      {roles.length === 0 && !loading && (
        <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Role catalogue is empty. Run <code className="font-mono text-xs">npm run seed</code> on the
          server to create the default roles, then refresh this page.
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg">
        <div className="px-5 py-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-line">
          <div className="relative flex-1 md:max-w-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-line bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          >
            <option>All roles</option>
            {roles.map((r) => <option key={r._id}>{r.name}</option>)}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          >
            <option>All departments</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold tracking-wider text-fg-subtle uppercase border-b border-line">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-fg-subtle">
                    Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-fg-subtle">
                    {users.length === 0
                      ? 'No users yet. Click "+ New user" to create your first teammate.'
                      : 'No users match your filters.'}
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const isMe = u._id === me._id
                const userBusy = busy[u._id]
                return (
                  <tr key={u._id} className="hover:bg-surface-2/60 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-md flex items-center justify-center text-xs font-semibold ${avatarClassFor(u.name)}`}>
                          {initials(u.name)}
                        </div>
                        <div className="leading-tight">
                          <p className="font-medium text-fg">
                            {u.name}
                            {isMe && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">You</span>}
                            {u.isProtected && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded" title="Protected system account">Locked</span>}
                          </p>
                          <p className="text-xs text-fg-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {u.role?.name || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                          u.isActive
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-surface-3 text-fg-muted border border-line'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-fg-muted">
                      {u.department}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditUser(u)}
                          disabled={!!userBusy || u.isProtected}
                          title={u.isProtected ? 'Protected account — cannot be edited' : 'Edit details, role & org placement'}
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-line hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-fg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={isMe || !!userBusy || u.isProtected}
                          title={
                            isMe
                              ? 'You cannot deactivate yourself'
                              : u.isProtected
                                ? 'Protected account — cannot be deactivated'
                                : u.isActive ? 'Deactivate user' : 'Reactivate user'
                          }
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-line hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-fg transition"
                        >
                          {userBusy === 'deactivate'
                            ? '...'
                            : u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={isMe || !!userBusy || u.isProtected}
                          title={
                            isMe
                              ? 'You cannot delete yourself'
                              : u.isProtected
                                ? 'Protected account — cannot be deleted'
                                : 'Permanently delete user'
                          }
                          className="p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {userBusy === 'delete' ? (
                            <span className="text-xs px-1">…</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CreateUserDialog
          roles={roles}
          managers={managerOptions}
          hrPeople={hrOptions}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {importOpen && (
        <ImportUsersDialog
          roles={roles}
          onClose={() => setImportOpen(false)}
          onImported={() => { setFeedback('Bulk import finished.'); loadUsers() }}
        />
      )}

      {editUser && (
        <EditUserDialog
          user={editUser}
          roles={roles}
          managers={managerOptions}
          hrPeople={hrOptions}
          isSelf={editUser._id === me._id}
          onClose={() => setEditUser(null)}
          onSaved={(updated) => {
            setEditUser(null)
            setFeedback(`Updated ${updated.name}'s details.`)
            loadUsers()
          }}
        />
      )}
    </AppShell>
  )
}

// ---------- bulk import dialog ------------------------------------------

const REQUIRED_COLUMNS = ['name', 'email', 'department', 'role']

function ImportUsersDialog({ roles, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  const roleNames = useMemo(
    () => new Set((roles || []).map((r) => r.name.toLowerCase())),
    [roles]
  )
  const deptSet = useMemo(() => new Set(DEPARTMENTS.map((d) => d.toLowerCase())), [])

  // Client-side row validity hint (server re-validates authoritatively).
  const rowIssue = (r) => {
    if (!r.name || !r.email || !r.department || !r.role) return 'Missing required field'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return 'Invalid email'
    if (!roleNames.has(String(r.role).toLowerCase())) return `Unknown role "${r.role}"`
    if (!deptSet.has(String(r.department).toLowerCase())) return `Unknown department "${r.department}"`
    return ''
  }

  const validCount = useMemo(() => rows.filter((r) => !rowIssue(r)).length, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = (e) => {
    setParseError('')
    setResult(null)
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { headers, rows: parsed } = parseCsv(reader.result)
        const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
        if (missing.length) {
          setRows([])
          setParseError(`CSV is missing column(s): ${missing.join(', ')}`)
          return
        }
        setRows(parsed.map((r) => ({
          name: r.name || '', email: r.email || '', department: r.department || '',
          role: r.role || '', manager: r.manager || '', hr: r.hr || ''
        })))
      } catch {
        setRows([])
        setParseError('Could not parse this file. Make sure it is a valid CSV.')
      }
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplate()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const submit = async () => {
    setSubmitting(true)
    setResult(null)
    try {
      const data = await api.post('/api/users/import', { users: rows })
      setResult(data)
      onImported?.()
    } catch (err) {
      setParseError(err.message || 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const badgeFor = (status) =>
    status === 'created' ? 'bg-emerald-100 text-emerald-700'
      : status === 'skipped' ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface rounded-xl shadow-xl border border-line flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg">Import users from CSV</h2>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Upload a CSV to invite many users at once. Each gets a temporary password by email.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-surface-3 text-fg-subtle flex items-center justify-center transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />

          {!result && (
            fileName ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                  </svg>
                  <span className="text-sm text-fg truncate">{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 shrink-0"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line px-4 py-7 text-center hover:border-indigo-300 hover:bg-indigo-50/40 transition"
              >
                <svg className="w-6 h-6 text-fg-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
                </svg>
                <span className="text-sm font-medium text-fg">Choose CSV file</span>
                <span className="text-[11px] text-fg-subtle">
                  Columns: name, email, department, role (required), manager, hr (optional)
                </span>
              </button>
            )
          )}



          {parseError && (
            <div className="p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">{parseError}</div>
          )}

          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-fg-muted">{rows.length} row{rows.length === 1 ? '' : 's'} found</span>
                <span className="text-fg-muted">
                  <span className="font-medium text-emerald-600">{validCount} valid</span>
                  {rows.length - validCount > 0 && (
                    <span className="text-red-500"> · {rows.length - validCount} with issues</span>
                  )}
                </span>
              </div>
              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-fg-subtle">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Dept</th>
                      <th className="text-left px-3 py-2 font-medium">Role</th>
                      <th className="text-left px-3 py-2 font-medium">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.slice(0, 20).map((r, i) => {
                      const issue = rowIssue(r)
                      return (
                        <tr key={i} className={issue ? 'bg-red-50/60' : ''}>
                          <td className="px-3 py-2 text-fg">{r.name}</td>
                          <td className="px-3 py-2 text-fg">{r.email}</td>
                          <td className="px-3 py-2 text-fg-muted">{r.department}</td>
                          <td className="px-3 py-2 text-fg-muted">{r.role}</td>
                          <td className="px-3 py-2 text-red-600">{issue}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <p className="px-3 py-2 text-[11px] text-fg-subtle bg-surface-2/60">…and {rows.length - 20} more</p>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{result.created} created</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">{result.skipped} skipped</span>
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700">{result.failed} failed</span>
              </div>
              {(result.results || []).some((r) => r.status !== 'created' || r.reason) && (
                <div className="border border-line rounded-lg max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-line">
                      {(result.results || []).filter((r) => r.status !== 'created' || r.reason).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-fg-subtle w-10">#{r.row}</td>
                          <td className="px-3 py-2 text-fg">{r.email}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] ${badgeFor(r.status)}`}>{r.status}</span>
                          </td>
                          <td className="px-3 py-2 text-fg-muted">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || rows.length === 0 || validCount === 0}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition"
            >
              {submitting ? 'Importing…' : `Import ${validCount} user${validCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminPanel

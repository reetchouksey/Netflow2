// Shared - AdminPanel.jsx
// Real user management. Pulls users from GET /api/users and roles from
// GET /api/roles. Admins can invite, change role, change department, and
// deactivate / reactivate users. Non-admins see a friendly forbidden screen.

import React, { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser, DEPARTMENTS, initials } from '../utils/auth'
import { canManageUsers } from '../utils/permissions'

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
      onCreated(data.user)
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
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Create a user</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              You set the role, department and initial password. Share the credentials with the user.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-400 flex items-center justify-center transition"
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Arjun Kumar"
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Work email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="arjun@company.com"
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                name="roleId"
                value={form.roleId}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                {sortedRoles.map((r) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reporting manager</label>
            <select
              name="managerId"
              value={form.managerId}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            >
              <option value="">— No manager —</option>
              {(managers || []).map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}{m.department ? ` · ${m.department}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Who this person reports to. You can change it later from the table.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">HR partner</label>
            <select
              name="hrId"
              value={form.hrId}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            >
              <option value="">— No HR —</option>
              {(hrPeople || []).map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}{h.department ? ` · ${h.department}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              {(hrPeople || []).length === 0
                ? 'No HR-role users yet — create one to assign HR partners.'
                : 'The HR person responsible for this user.'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">
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
                className="w-full px-3 py-2 pr-16 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-700"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Share this password securely. The user can change it after their first login.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
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
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Edit user</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Update name, email, role, department, manager &amp; HR partner, or reset the password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-400 flex items-center justify-center transition"
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Arjun Kumar"
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Work email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="arjun@company.com"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              The user signs in with this email — changing it updates their login.
            </p>
          </div>

          {orgExempt ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  name="roleId"
                  value={form.roleId}
                  onChange={handleChange}
                  disabled
                  title="System admin roles are managed separately"
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
                >
                  {sortedRoles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </div>
              <div className="p-2.5 rounded-md bg-gray-50 border border-gray-200 text-[11px] text-gray-500">
                System admins sit outside the org chart, so they have no department, reporting manager or HR partner.
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select
                    name="roleId"
                    value={form.roleId}
                    onChange={handleChange}
                    disabled={isSelf}
                    title={isSelf ? "You can't change your own role" : ''}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sortedRoles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <select
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  >
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reporting manager</label>
                <select
                  name="managerId"
                  value={form.managerId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
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
                <label className="block text-xs font-medium text-gray-600 mb-1">HR partner</label>
                <select
                  name="hrId"
                  value={form.hrId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                >
                  <option value="">— No HR —</option>
                  {(hrPeople || []).filter((h) => h._id !== user._id).map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}{h.department ? ` · ${h.department}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  {(hrPeople || []).length === 0
                    ? 'No HR-role users yet — create one to assign HR partners.'
                    : 'The HR person who handles this user’s people processes.'}
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
            <div className="relative">
              <input
                name="password"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current"
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-14 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
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
            <p className="text-[11px] text-gray-400 mt-1">
              Optional — sets a new sign-in password (min 6 characters). Leave blank to keep the current one.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
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
    const ok = window.confirm(
      `Permanently delete ${user.name} (${user.email})?\n\n` +
      'This removes the account from the database and cannot be undone. ' +
      'Anyone who reports to them — or has them set as HR partner — will be detached.'
    )
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

  const handleCreated = (user) => {
    setCreateOpen(false)
    setFeedback(`Created ${user.name} (${user.role?.name || 'no role'}). They can log in with the password you set.`)
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
        <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M5 19h14a2 2 0 001.85-2.74L13.85 4.74a2 2 0 00-3.7 0L3.15 16.26A2 2 0 005 19z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-800">Admins only</p>
          <p className="text-sm text-gray-500 mt-1">
            You need an Admin role to manage users.
          </p>
        </div>
      </AppShell>
    )
  }

  const actions = (
    <button
      onClick={() => setCreateOpen(true)}
      disabled={roles.length === 0}
      className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition"
    >
      + New user
    </button>
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

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-5 py-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-gray-100">
          <div className="relative flex-1 max-w-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          >
            <option>All roles</option>
            {roles.map((r) => <option key={r._id}>{r.name}</option>)}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          >
            <option>All departments</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold tracking-wider text-gray-400 uppercase border-b border-gray-100">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">
                    Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">
                    {users.length === 0
                      ? 'No users yet. Click "+ New user" to create your first teammate.'
                      : 'No users match your filters.'}
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const isMe = u._id === me._id
                const userBusy = busy[u._id]
                return (
                  <tr key={u._id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-md flex items-center justify-center text-xs font-semibold ${avatarClassFor(u.name)}`}>
                          {initials(u.name)}
                        </div>
                        <div className="leading-tight">
                          <p className="font-medium text-gray-800">
                            {u.name}
                            {isMe && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">You</span>}
                            {u.isProtected && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded" title="Protected system account">Locked</span>}
                          </p>
                          <p className="text-xs text-gray-500">{u.email}</p>
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
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditUser(u)}
                          disabled={!!userBusy || u.isProtected}
                          title={u.isProtected ? 'Protected account — cannot be edited' : 'Edit details, role & org placement'}
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 transition"
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
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 transition"
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

export default AdminPanel

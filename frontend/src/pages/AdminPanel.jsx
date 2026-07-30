// Shared - AdminPanel.jsx
// Real user management. Pulls users from GET /api/users and roles from
// GET /api/roles. Admins can invite, change role, grant builder seats, change
// department, and deactivate / reactivate users. Non-admins see a friendly
// forbidden screen.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { fetchAllUsers } from '../utils/users'
import { useUser, initials } from '../utils/auth'
import { useDepartmentNames } from '../lib/departmentsStore'
import { canManageUsers } from '../utils/permissions'
import { parseCsv, buildTemplate } from '../utils/csv'
import { confirm } from '../lib/confirmStore'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import Modal from '../components/Modal'
import UsageCard from '../components/UsageCard'
import { limitBanner, reportLimit } from '../lib/limitFeedback'
import { usageStore, useReadOnly, useUsage } from '../lib/usageStore'
import { meterText } from '../lib/licensing'
import { toast } from '../lib/toastStore'

// A licensing refusal already carries an actionable sentence from the server;
// this only adds the heading so it doesn't read like an unexpected failure.
const errorText = (err, fallback) => {
  const info = limitBanner(err)
  return info ? `${info.title} — ${info.message}` : (err?.message || fallback)
}

const reportDialogError = (err, fallback) => {
  if (reportLimit(err)) return
  toast.error(err?.message || fallback)
}

// Designer routes also require the Administrator role — the seat alone is not enough.
const DESIGNER_ROLE_NAMES = new Set(['Admin'])

function useBuilderSeats() {
  const { usage } = useUsage()
  const meter = usage?.resources?.builders || null
  const seatsFull = Boolean(meter && !meter.unlimited && Number(meter.used) >= Number(meter.limit))
  const seatsHint = !meter
    ? 'Lets this person design forms and workflows.'
    : meter.unlimited
      ? 'Unlimited builder seats on this plan.'
      : `${meterText('builders', meter)} builder seats used.`
  return { meter, seatsFull, seatsHint }
}

function BuilderSeatField({ id, checked, onChange, seatsFull, seatsHint, designerRole }) {
  // Keep an already-granted seat editable (uncheck / re-check) even at the limit.
  const grantBlocked = seatsFull && !checked
  return (
    <div className={`rounded-md border border-line px-3 py-2.5 ${grantBlocked ? 'opacity-70' : ''}`}>
      <label htmlFor={id} className={`flex items-start gap-3 ${grantBlocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={grantBlocked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 rounded border-line text-indigo-600 focus:ring-indigo-400"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-fg">Builder seat</span>
          <span className="block text-[11px] text-fg-subtle mt-0.5">
            {grantBlocked
              ? 'No free builder seats — turn the seat off for someone else first.'
              : seatsHint}
            {!designerRole && !grantBlocked && (
              <> Designing also requires the Administrator role.</>
            )}
          </span>
        </span>
      </label>
    </div>
  )
}

// Identity hues, not statuses — a person's initials shouldn't read as a warning,
// so each entry keeps its own colour and carries an explicit dark pair.
const AVATAR_PALETTE = [
  'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-200',
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
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
const ROLE_ORDER = ['Admin', 'CEO', 'VP', 'Manager', 'HR', 'Employee']

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
  const departments = useDepartmentNames()
  const { seatsFull, seatsHint } = useBuilderSeats()
  const defaultRoleId =
    sortedRoles.find((r) => r.name === 'Employee')?._id ||
    sortedRoles[0]?._id ||
    ''

  const [form, setForm] = useState({
    name: '',
    email: '',
    department: '',
    roleId: defaultRoleId,
    managerId: '',
    hrId: '',
    password: '',
    canBuild: false
  })

  // The list arrives a beat after the dialog opens; pick the first team then.
  useEffect(() => {
    if (!form.department && departments.length) {
      setForm((p) => ({ ...p, department: departments[0] }))
    }
  }, [departments, form.department])
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectedRole = sortedRoles.find((r) => r._id === form.roleId)
  const designerRole = DESIGNER_ROLE_NAMES.has(selectedRole?.name)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let out = ''
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
    setForm((p) => ({ ...p, password: out }))
    setShowPassword(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Enter a valid email address')
      return
    }
    if (!form.roleId) {
      toast.error('Pick a role for this user')
      return
    }
    if (!form.password || form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
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
        password: form.password,
        canBuild: form.canBuild === true
      }
      const data = await api.post('/api/users', payload)
      onCreated(data.user, data.domainWarning)
    } catch (err) {
      reportDialogError(err, 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Create a user"
      description="You set the role, department, builder seat and initial password. Share the credentials with the user."
      bodyClass="overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3" noValidate>
          <div>
            <label htmlFor="cu-name" className="block text-xs font-medium text-fg-muted mb-1">Full name</label>
            <input
              id="cu-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Arjun Kumar"
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div>
            <label htmlFor="cu-email" className="block text-xs font-medium text-fg-muted mb-1">Work email</label>
            <input
              id="cu-email"
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
              <label htmlFor="cu-role" className="block text-xs font-medium text-fg-muted mb-1">Role</label>
              <select
                id="cu-role"
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
              <label htmlFor="cu-department" className="block text-xs font-medium text-fg-muted mb-1">Department</label>
              <select
                id="cu-department"
                name="department"
                value={form.department}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cu-manager" className="block text-xs font-medium text-fg-muted mb-1">Reporting manager</label>
            <select
              id="cu-manager"
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
            <label htmlFor="cu-hr" className="block text-xs font-medium text-fg-muted mb-1">HR partner</label>
            <select
              id="cu-hr"
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

          <BuilderSeatField
            id="cu-canBuild"
            checked={form.canBuild}
            onChange={(canBuild) => { setForm((p) => ({ ...p, canBuild })); setError('') }}
            seatsFull={seatsFull}
            seatsHint={seatsHint}
            designerRole={designerRole}
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="cu-password" className="block text-xs font-medium text-fg-muted">
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
                id="cu-password"
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
    </Modal>
  )
}

// ---------- edit-user dialog --------------------------------------------

function EditUserDialog({ user, roles, managers, hrPeople, isSelf, onClose, onSaved }) {
  const sortedRoles = useMemo(() => sortRoles(roles || []), [roles])
  const orgDepartments = useDepartmentNames()
  const { seatsFull, seatsHint } = useBuilderSeats()
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
    department: user.department || '',
    managerId: user.managerId || '',
    hrId: user.hrId || '',
    canBuild: user.canBuild === true
  })
  // Keep whoever is already filed under a retired department visible in the
  // picker, so saving an unrelated change does not move them.
  const departments = useMemo(
    () => (form.department && !orgDepartments.includes(form.department)
      ? [...orgDepartments, form.department]
      : orgDepartments),
    [orgDepartments, form.department]
  )
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectedRole = sortedRoles.find((r) => r._id === form.roleId)
  const designerRole = DESIGNER_ROLE_NAMES.has(selectedRole?.name || user.role?.name)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    const password = form.password
    if (!name) { toast.error('Name is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSubmitting(true)
    try {
      // Role has a dedicated endpoint; skip it when locked or unchanged.
      if (!roleLocked && form.roleId && form.roleId !== (user.role?._id || '')) {
        await api.post(`/api/users/${user._id}/assign-role`, { roleId: form.roleId })
      }
      const payload = { name, email, canBuild: form.canBuild === true }
      if (password) payload.password = password
      if (!orgExempt) {
        payload.department = form.department
        payload.managerId = form.managerId || null
        payload.hrId = form.hrId || null
      }
      const data = await api.put(`/api/users/${user._id}`, payload)
      onSaved(data.user)
    } catch (err) {
      reportDialogError(err, 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Edit user"
      description="Update name, email, role, builder seat, department, manager & HR partner, or reset the password."
      bodyClass="overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3" noValidate>
          <div>
            <label htmlFor="eu-name" className="block text-xs font-medium text-fg-muted mb-1">Full name</label>
            <input
              id="eu-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Arjun Kumar"
              className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>

          <div>
            <label htmlFor="eu-email" className="block text-xs font-medium text-fg-muted mb-1">Work email</label>
            <input
              id="eu-email"
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
                <label htmlFor="eu-role-locked" className="block text-xs font-medium text-fg-muted mb-1">Role</label>
                <select
                  id="eu-role-locked"
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
                  <label htmlFor="eu-role" className="block text-xs font-medium text-fg-muted mb-1">Role</label>
                  <select
                    id="eu-role"
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
                  <label htmlFor="eu-department" className="block text-xs font-medium text-fg-muted mb-1">Department</label>
                  <select
                    id="eu-department"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  >
                    {departments.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="eu-manager" className="block text-xs font-medium text-fg-muted mb-1">Reporting manager</label>
                <select
                  id="eu-manager"
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
                <label htmlFor="eu-hr" className="block text-xs font-medium text-fg-muted mb-1">HR partner</label>
                <select
                  id="eu-hr"
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

          <BuilderSeatField
            id="eu-canBuild"
            checked={form.canBuild}
            onChange={(canBuild) => { setForm((p) => ({ ...p, canBuild })); setError('') }}
            seatsFull={seatsFull}
            seatsHint={seatsHint}
            designerRole={designerRole}
          />

          <div>
            <label htmlFor="eu-password" className="block text-xs font-medium text-fg-muted mb-1">New password</label>
            <div className="relative">
              <input
                id="eu-password"
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
    </Modal>
  )
}

// ---------- page --------------------------------------------------------

function AdminPanel() {
  const me = useUser()
  const departments = useDepartmentNames()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [deptFilter, setDeptFilter] = useState('All departments')
  const [statusFilter, setStatusFilter] = useState('') // '', 'active', 'inactive', 'admins'
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [busy, setBusy] = useState({}) // { [userId]: 'role' | 'department' | 'deactivate' }
  const [feedback, setFeedback] = useState('')

  const isAdmin = canManageUsers(me)
  const readOnly = useReadOnly()

  // ---------- load ----------
  const loadUsers = async () => {
    try {
      const data = await fetchAllUsers()
      setUsers(data.users || [])
      // Every mutation on this page reloads the list, and each one can move a
      // seat count, so the card is refreshed from the same place.
      usageStore.refresh({ withUsage: true }).catch(() => {})
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
    if (user.isActive) {
      const ok = await confirm({
        title: 'Deactivate user?',
        message: `${user.name} will be signed out and won't be able to log in until reactivated.`,
        confirmLabel: 'Deactivate',
        danger: true,
      })
      if (!ok) return
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
      setError(errorText(e, 'Failed to update user'))
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
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active' && u.isActive) ||
        (statusFilter === 'inactive' && !u.isActive) ||
        (statusFilter === 'admins' && SYSTEM_ADMIN_ROLES.has(u.role?.name))
      return matchesSearch && matchesRole && matchesDept && matchesStatus
    })
  }, [users, search, roleFilter, deptFilter, statusFilter])

  const userStats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length
    const inactive = users.length - active
    const admins = users.filter((u) => SYSTEM_ADMIN_ROLES.has(u.role?.name)).length
    return { total: users.length, active, inactive, admins }
  }, [users])

  // ---------- gates ----------

  if (!me) return null

  if (!isAdmin) {
    return (
      <AppShell title="Users">
        <div className="max-w-md mx-auto bg-surface border border-line rounded-xl p-8 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-danger-subtle flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-danger-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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

  const newUserBlocked = roles.length === 0 || readOnly
  const blockedHint = readOnly ? 'The workspace licence has expired — adding users is paused.' : undefined
  const actions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setImportOpen(true)}
        disabled={newUserBlocked}
        title={blockedHint}
        className="px-4 py-2 rounded-lg border border-line hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-fg text-sm font-medium transition"
      >
        Import users
      </button>
      <button
        onClick={() => setCreateOpen(true)}
        disabled={newUserBlocked}
        title={blockedHint}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New user
      </button>
    </div>
  )

  const fieldCls =
    'w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface-2 text-fg placeholder:text-fg-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition'
  const selectCls =
    'px-3 py-2 text-sm rounded-lg border border-line bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition'

  const selectStatus = (next) => setStatusFilter((cur) => (cur === next ? '' : next))

  return (
    <AppShell
      title="Users"
      subtitle="Invite teammates, assign roles and builder seats, and manage access"
      actions={actions}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 w-full overflow-hidden">
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusCard
            label="All users"
            value={loading ? '—' : userStats.total}
            hint="In this workspace"
            loading={loading}
            active={!statusFilter}
            onClick={() => setStatusFilter('')}
            tone="neutral"
            icon={<IconUsers className="w-5 h-5" />}
          />
          <StatusCard
            label="Active"
            value={loading ? '—' : userStats.active}
            hint="Can sign in"
            loading={loading}
            active={statusFilter === 'active'}
            onClick={() => selectStatus('active')}
            tone="success"
            icon={<IconActive className="w-5 h-5" />}
          />
          <StatusCard
            label="Inactive"
            value={loading ? '—' : userStats.inactive}
            hint="Deactivated accounts"
            loading={loading}
            active={statusFilter === 'inactive'}
            onClick={() => selectStatus('inactive')}
            tone="muted"
            icon={<IconInactive className="w-5 h-5" />}
          />
          <StatusCard
            label="Admins"
            value={loading ? '—' : userStats.admins}
            hint="Workspace administrators"
            loading={loading}
            active={statusFilter === 'admins'}
            onClick={() => selectStatus('admins')}
            tone="info"
            icon={<IconAdmin className="w-5 h-5" />}
          />
        </div>

        <div className="shrink-0">
          <UsageCard />
        </div>

        {(feedback || error || (roles.length === 0 && !loading)) && (
          <div className="shrink-0 space-y-3">
            {feedback && <AlertBanner tone="success">{feedback}</AlertBanner>}
            {error && <AlertBanner>{error}</AlertBanner>}
            {roles.length === 0 && !loading && (
              <AlertBanner tone="warning">
                No roles are set up for this workspace yet, so new users can&rsquo;t be created. Ask your
                platform administrator to finish setting up the workspace, then reload this page.
              </AlertBanner>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-line bg-surface-2/40">
            <div className="relative flex-1 min-w-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search users"
                className={fieldCls}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
                className={selectCls}
              >
                <option>All roles</option>
                {roles.map((r) => <option key={r._id}>{r.name}</option>)}
              </select>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                aria-label="Filter by department"
                className={selectCls}
              >
                <option>All departments</option>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {loading ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full hidden sm:block" />
                    <Skeleton className="h-8 w-24 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full min-h-[16rem] flex items-center justify-center">
                <EmptyState
                  title={users.length === 0 ? 'No users yet' : 'No users match your filters'}
                  description={
                    users.length === 0
                      ? 'Use “New user” to add your first teammate.'
                      : 'Try clearing the search, status, role or department filter.'
                  }
                />
              </div>
            ) : (
              <>
                <table className="hidden md:table w-full table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[9rem]" />
                    <col className="w-[7.5rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[14rem]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-[11px] font-semibold tracking-wider text-fg-subtle uppercase border-b border-line bg-surface-2/95 backdrop-blur-sm">
                      <th scope="col" className="px-5 py-3 font-semibold">User</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                      <th scope="col" className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((u) => {
                      const isMe = u._id === me._id
                      const userBusy = busy[u._id]
                      return (
                        <tr key={u._id} className="hover:bg-surface-2/50 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarClassFor(u.name)}`}>
                                {initials(u.name)}
                              </div>
                              <div className="min-w-0 leading-tight">
                                <p className="font-semibold text-fg truncate">
                                  {u.name}
                                  {isMe && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-info-fg bg-info-subtle px-1.5 py-0.5 rounded">You</span>}
                                  {u.isProtected && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-warning-fg bg-warning-subtle px-1.5 py-0.5 rounded" title="Protected system account">Locked</span>}
                                  {u.canBuild && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 dark:text-indigo-200 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded" title="Holds a builder seat">Builder</span>}
                                </p>
                                <p className="text-xs text-fg-muted truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-info-subtle text-info-fg">
                              {u.role?.name || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                u.isActive
                                  ? 'bg-success-subtle text-success-fg'
                                  : 'bg-surface-3 text-fg-muted'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-success-fg' : 'bg-fg-subtle'}`} />
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-fg-muted">
                            {u.department || '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditUser(u)}
                                disabled={!!userBusy || u.isProtected}
                                title={u.isProtected ? 'Protected account — cannot be edited' : 'Edit details, role, builder seat & org placement'}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
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
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-line hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed text-fg transition"
                              >
                                {userBusy === 'deactivate'
                                  ? '...'
                                  : u.isActive ? 'Deactivate' : 'Reactivate'}
                              </button>
                              <button
                                onClick={() => handleDelete(u)}
                                disabled={isMe || !!userBusy || u.isProtected}
                                aria-label={`Delete ${u.name}`}
                                title={
                                  isMe
                                    ? 'You cannot delete yourself'
                                    : u.isProtected
                                      ? 'Protected account — cannot be deleted'
                                      : 'Permanently delete user'
                                }
                                className="w-8 h-8 rounded-lg border border-line text-fg-muted hover:text-danger-fg hover:border-danger-line hover:bg-danger-subtle disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
                              >
                                {userBusy === 'delete' ? (
                                  <span className="text-xs">…</span>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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

                <ul className="md:hidden divide-y divide-line">
                  {filtered.map((u) => {
                    const isMe = u._id === me._id
                    const userBusy = busy[u._id]
                    return (
                      <li key={u._id} className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarClassFor(u.name)}`}>
                            {initials(u.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-fg truncate">
                              {u.name}
                              {isMe && <span className="ml-1.5 text-[10px] font-semibold text-info-fg">You</span>}
                            </p>
                            <p className="text-xs text-fg-muted truncate">{u.email}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-info-subtle text-info-fg">
                                {u.role?.name || '—'}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                u.isActive ? 'bg-success-subtle text-success-fg' : 'bg-surface-3 text-fg-muted'
                              }`}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                              {u.canBuild && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-indigo-700 bg-indigo-50 dark:text-indigo-200 dark:bg-indigo-500/20">
                                  Builder
                                </span>
                              )}
                              {u.department && (
                                <span className="text-[11px] text-fg-subtle">{u.department}</span>
                              )}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => setEditUser(u)}
                                disabled={!!userBusy || u.isProtected}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleActive(u)}
                                disabled={isMe || !!userBusy || u.isProtected}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line disabled:opacity-50"
                              >
                                {u.isActive ? 'Deactivate' : 'Reactivate'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
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

function StatusCard({ label, value, hint, tone = 'neutral', icon, active, onClick, loading }) {
  const tones = {
    neutral: {
      icon: 'bg-surface-2 text-fg-muted ring-line',
      value: 'text-fg',
      active: 'border-indigo-300 ring-2 ring-indigo-100 dark:ring-indigo-500/20',
    },
    success: {
      icon: 'bg-success-subtle text-success-fg ring-success-line',
      value: 'text-success-fg',
      active: 'border-success-line ring-2 ring-success-subtle',
    },
    muted: {
      icon: 'bg-surface-3 text-fg-muted ring-line',
      value: 'text-fg',
      active: 'border-line ring-2 ring-surface-3',
    },
    info: {
      icon: 'bg-info-subtle text-info-fg ring-info-line',
      value: 'text-info-fg',
      active: 'border-info-line ring-2 ring-info-subtle',
    },
  }
  const t = tones[tone] || tones.neutral
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-surface px-4 py-3.5 shadow-sm flex items-start gap-3 text-left transition w-full ${
        active ? t.active : 'border-line hover:border-indigo-200'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ${t.icon}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-12 mt-1.5" />
        ) : (
          <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${t.value}`}>{value}</p>
        )}
        {hint ? <p className="mt-0.5 text-[11px] text-fg-muted truncate">{hint}</p> : null}
      </div>
    </button>
  )
}

function IconUsers(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
    </svg>
  )
}
function IconActive(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconInactive(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  )
}
function IconAdmin(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

// ---------- bulk import dialog ------------------------------------------

const REQUIRED_COLUMNS = ['name', 'email', 'department', 'role']

function ImportUsersDialog({ roles, onClose, onImported }) {
  const departments = useDepartmentNames()
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
  const deptSet = useMemo(() => new Set(departments.map((d) => d.toLowerCase())), [departments])

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
    const blob = new Blob([buildTemplate(departments)], { type: 'text/csv;charset=utf-8' })
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
      setParseError(errorText(err, 'Import failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const badgeFor = (status) =>
    status === 'created' ? 'bg-success-subtle text-success-fg'
      : status === 'skipped' ? 'bg-warning-subtle text-warning-fg'
        : 'bg-danger-subtle text-danger-fg'

  return (
    <Modal
      onClose={onClose}
      size="xl"
      title="Import users from CSV"
      description="Upload a CSV to invite many users at once. Each gets a temporary password by email."
      bodyClass="overflow-y-auto"
      footer={
        <>
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
        </>
      }
    >
        <div className="px-5 py-4 space-y-4">
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
                className="w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line px-4 py-7 text-center hover:border-info-line hover:bg-info-subtle/50 transition"
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
            <div className="p-2 rounded-md bg-danger-subtle border border-danger-line text-xs text-danger-fg">{parseError}</div>
          )}

          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-fg-muted">{rows.length} row{rows.length === 1 ? '' : 's'} found</span>
                <span className="text-fg-muted">
                  <span className="font-medium text-success-fg">{validCount} valid</span>
                  {rows.length - validCount > 0 && (
                    <span className="text-danger-fg"> · {rows.length - validCount} with issues</span>
                  )}
                </span>
              </div>
              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-fg-subtle">
                    <tr>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Name</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Email</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Dept</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Role</th>
                      <th scope="col" className="text-left px-3 py-2 font-medium">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.slice(0, 20).map((r, i) => {
                      const issue = rowIssue(r)
                      return (
                        <tr key={i} className={issue ? 'bg-danger-subtle/60' : ''}>
                          <td className="px-3 py-2 text-fg">{r.name}</td>
                          <td className="px-3 py-2 text-fg">{r.email}</td>
                          <td className="px-3 py-2 text-fg-muted">{r.department}</td>
                          <td className="px-3 py-2 text-fg-muted">{r.role}</td>
                          <td className="px-3 py-2 text-danger-fg">{issue}</td>
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
                <span className="px-2.5 py-1 rounded-full bg-success-subtle text-success-fg">{result.created} created</span>
                <span className="px-2.5 py-1 rounded-full bg-warning-subtle text-warning-fg">{result.skipped} skipped</span>
                <span className="px-2.5 py-1 rounded-full bg-danger-subtle text-danger-fg">{result.failed} failed</span>
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
    </Modal>
  )
}

export default AdminPanel

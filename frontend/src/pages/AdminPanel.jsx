// Shared - AdminPanel.jsx
// Real user management. Pulls users from GET /api/users and roles from
// GET /api/roles. Admins can invite, change role, grant builder seats, change
// department, and deactivate / reactivate users. Non-admins see a friendly
// forbidden screen.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { fetchAllUsers } from '../utils/users'
import { useUser, initials, authStore } from '../utils/auth'
import { useDepartmentNames } from '../lib/departmentsStore'
import { canManageUsers } from '../utils/permissions'
import { parseCsv, buildTemplate } from '../utils/csv'
import { confirm } from '../lib/confirmStore'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import Modal from '../components/Modal'
import { limitBanner, reportLimit } from '../lib/limitFeedback'
import { usageStore, useReadOnly, useUsage } from '../lib/usageStore'
import { meterText, formatDate } from '../lib/licensing'
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
    <div className={`rounded-xl border border-line px-3.5 py-3 bg-surface-2/40 ${grantBlocked ? 'opacity-70' : ''}`}>
      <label htmlFor={id} className={`flex items-start gap-3 ${grantBlocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={grantBlocked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 rounded border-line text-indigo-600 focus:ring-indigo-400 w-4 h-4 cursor-pointer"
        />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-fg">Builder seat</span>
          <span className="block text-[11px] text-fg-subtle mt-0.5">
            {grantBlocked
              ? 'No free builder seats — turn the seat off for someone else first.'
              : seatsHint || 'Grants this user permission to design and edit forms.'}
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
const SYSTEM_ADMIN_ROLES = new Set(['SuperAdmin'])
const ADMIN_ROLES = new Set(['Admin', 'SuperAdmin'])
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
    employeeId: '',
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
        employeeId: form.employeeId.trim() || undefined,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cu-name" className="block text-xs font-medium text-fg-muted mb-1">Full name <span className="text-rose-500">*</span></label>
              <input
                id="cu-name"
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Arjun Kumar"
                className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
            </div>
            <div>
              <label htmlFor="cu-employeeId" className="block text-xs font-medium text-fg-muted mb-1">Employee ID</label>
              <input
                id="cu-employeeId"
                name="employeeId"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={form.employeeId}
                onChange={handleChange}
                placeholder="e.g. EMP-001"
                className="w-full px-3 py-2 text-sm rounded-md border border-line focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cu-email" className="block text-xs font-medium text-fg-muted mb-1">Work email <span className="text-rose-500">*</span></label>
            <input
              id="cu-email"
              name="email"
              type="email"
              autoComplete="username"
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
  const orgExempt = SYSTEM_ADMIN_ROLES.has(user.role?.name)
  const roleLocked = orgExempt || isSelf

  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    employeeId: user.employeeId || '',
    password: '',
    roleId: user.role?._id || user.role || '',
    department: user.department || '',
    managerId: (typeof user.managerId === 'object' && user.managerId ? user.managerId._id : user.managerId) || '',
    hrId: (typeof user.hrId === 'object' && user.hrId ? user.hrId._id : user.hrId) || '',
    canBuild: user.canBuild === true
  })

  const departments = useMemo(
    () => (form.department && !orgDepartments.includes(form.department)
      ? [...orgDepartments, form.department]
      : orgDepartments),
    [orgDepartments, form.department]
  )
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const handleDeactivate = async () => {
    if (isSelf) {
      toast.error('You cannot deactivate your own account.')
      return
    }

    const firstOk = await confirm({
      title: `Deactivate ${user.name}'s account?`,
      message: `Are you sure you want to deactivate ${user.name}'s account? They will be signed out and won't be able to log in until reactivated.`,
      confirmLabel: 'Deactivate account',
      danger: true,
    })
    if (!firstOk) return

    const secondOk = await confirm({
      title: `Final Confirmation: Deactivate ${user.name}?`,
      message: `Are you absolutely sure you want to deactivate ${user.name}'s account? Active sessions will be terminated and all access will be suspended.`,
      confirmLabel: 'Yes, deactivate account',
      danger: true,
    })
    if (!secondOk) return

    setSubmitting(true)
    try {
      await api.delete(`/api/users/${user._id}`)
      toast.success(`${user.name} has been deactivated`)
      onSaved({ ...user, isActive: false })
      onClose()
    } catch (err) {
      reportDialogError(err, 'Failed to deactivate account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReactivate = async () => {
    const ok = await confirm({
      title: `Reactivate ${user.name}'s account?`,
      message: `Are you sure you want to restore access for ${user.name}?`,
      confirmLabel: 'Reactivate account',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      await api.put(`/api/users/${user._id}`, { isActive: true })
      toast.success(`${user.name} has been reactivated`)
      onSaved({ ...user, isActive: true })
      onClose()
    } catch (err) {
      reportDialogError(err, 'Failed to reactivate account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    const employeeId = form.employeeId.trim()
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
      if (!roleLocked && form.roleId && form.roleId !== (user.role?._id || '')) {
        await api.post(`/api/users/${user._id}/assign-role`, { roleId: form.roleId })
      }
      const payload = { name, email, employeeId: employeeId || null, canBuild: form.canBuild === true }
      if (password) payload.password = password
      if (!orgExempt) {
        payload.department = form.department
        payload.managerId = form.managerId || null
        payload.hrId = form.hrId || null
      }
      const data = await api.put(`/api/users/${user._id}`, payload)
      onSaved(data.user || { ...user, ...payload })
    } catch (err) {
      reportDialogError(err, 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#111a2e] rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-7 pt-7 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Edit user
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Update name, email, employee ID, role, department, manager & HR partner, or reset the password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-7 py-3 space-y-4" noValidate>
          {/* User ID display */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase block">USER ID</span>
              <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 select-all">{user._id || '—'}</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              user.isActive !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {user.isActive !== false ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="eu-name" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Full name <span className="text-rose-500">*</span>
              </label>
              <input
                id="eu-name"
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Arjun Kumar"
                className="w-full px-4 py-3 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label htmlFor="eu-employeeId" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Employee ID
              </label>
              <input
                id="eu-employeeId"
                name="employeeId"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={form.employeeId}
                onChange={handleChange}
                placeholder="e.g. EMP-001"
                className="w-full px-4 py-3 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="eu-email" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Work email <span className="text-rose-500">*</span>
            </label>
            <input
              id="eu-email"
              name="email"
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={handleChange}
              placeholder="arjun@company.com"
              className="w-full px-4 py-3 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              The user signs in with this email — changing it updates their login.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="eu-role" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Role
              </label>
              <select
                id="eu-role"
                name="roleId"
                value={form.roleId}
                onChange={handleChange}
                disabled={roleLocked}
                className="w-full px-4 py-3 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {sortedRoles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="eu-department" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Department
              </label>
              <select
                id="eu-department"
                name="department"
                value={form.department}
                onChange={handleChange}
                className="w-full px-4 py-3 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition cursor-pointer"
              >
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="eu-manager" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Reporting manager
            </label>
            <select
              id="eu-manager"
              name="managerId"
              value={form.managerId}
              onChange={handleChange}
              className="w-full px-4 py-3 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition cursor-pointer"
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
            <label htmlFor="eu-hr" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              HR partner
            </label>
            <select
              id="eu-hr"
              name="hrId"
              value={form.hrId}
              onChange={handleChange}
              className="w-full px-4 py-3 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="">— No HR —</option>
              {(hrPeople || []).filter((h) => h._id !== user._id).map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}{h.department ? ` · ${h.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          <BuilderSeatField
            id="eu-canBuild"
            checked={form.canBuild}
            onChange={(canBuild) => setForm((p) => ({ ...p, canBuild }))}
            seatsFull={seatsFull}
            seatsHint={seatsHint}
            designerRole={DESIGNER_ROLE_NAMES.has(roles?.find(r => r._id === form.roleId)?.name || user.role?.name)}
          />

          <div className="pt-1">
            <label htmlFor="eu-password" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                id="eu-password"
                name="password"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current"
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-14 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                tabIndex={-1}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 hover:text-indigo-700 px-1"
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Footer inside modal */}
          <div className="pt-5 pb-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            {/* Left: Deactivate / Reactivate account button */}
            <div>
              {!isSelf && (
                user.isActive !== false ? (
                  <button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Deactivate account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReactivate}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Reactivate account
                  </button>
                )
              )}
            </div>

            {/* Right: Cancel & Save buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-2xl bg-[#6366F1] hover:bg-indigo-600 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-bold shadow-md shadow-indigo-500/25 transition cursor-pointer"
              >
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function ViewUserDialog({ user, managers = [], users = [], onClose, onEdit }) {
  if (!user) return null

  const roleName = user.role?.name || (user.name === 'Platform Super Admin' ? 'SuperAdmin' : 'Member')
  const formattedJoined = user.createdAt ? formatDate(user.createdAt) : '—'
  const formattedLastLogin = user.lastLogin ? formatDate(user.lastLogin) : 'Never'
  const userId = user._id || '—'

  const managerObj = typeof user.managerId === 'object' && user.managerId !== null
    ? user.managerId
    : (managers || []).find((m) => m._id === user.managerId) || (users || []).find((u) => u._id === user.managerId)
  const managerName = managerObj ? managerObj.name : (user.managerName || '—')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#111a2e] rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-7 pt-7 pb-5 flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {user.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {roleName}
              </span>
            </div>
            <p className="text-xs font-normal text-slate-400 dark:text-slate-500 mt-1">
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body 2-Column Grid */}
        <div className="p-7 grid grid-cols-2 gap-y-6 gap-x-8">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">FULL NAME</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{user.name}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">EMPLOYEE ID</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{user.employeeId || '—'}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">EMAIL ADDRESS</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{user.email}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">ROLE</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{roleName}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">DEPARTMENT</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{user.department || 'IT'}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">REPORTING MANAGER</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{managerName}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">STATUS</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              user.isActive !== false
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {user.isActive !== false ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">LAST LOGIN</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{formattedLastLogin}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">DATE JOINED</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{formattedJoined}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">USER ID</p>
            <p className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate" title={userId}>{userId}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 flex items-center justify-end border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-sm shadow-2xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
  const [currentPage, setCurrentPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [viewUser, setViewUser] = useState(null)
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
      setError('You cannot change your own account status.')
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
    } else {
      const ok = await confirm({
        title: 'Activate user?',
        message: `Activate ${user.name}? They will be able to log in to the workspace again.`,
        confirmLabel: 'Activate',
        danger: false,
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
        (statusFilter === 'admins' && (ADMIN_ROLES.has(u.role?.name) || ADMIN_ROLES.has(u.role)))
      return matchesSearch && matchesRole && matchesDept && matchesStatus
    })
  }, [users, search, roleFilter, deptFilter, statusFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, roleFilter, deptFilter, statusFilter])

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * 10
    return filtered.slice(start, start + 10)
  }, [filtered, currentPage])
  const totalPages = Math.ceil(filtered.length / 10) || 1

  const userStats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length
    const inactive = users.length - active
    const admins = users.filter((u) => ADMIN_ROLES.has(u.role?.name) || ADMIN_ROLES.has(u.role)).length
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

  const fieldCls =
    'w-full pl-9 pr-3 py-2.5 text-[13px] font-medium rounded-[8px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-[#111a2e] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition'
  const selectCls =
    'px-4 py-2.5 text-[13px] font-medium rounded-[8px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-[#111a2e] text-slate-600 dark:text-slate-300 focus:outline-none transition cursor-pointer'

  const selectStatus = (next) => setStatusFilter((cur) => (cur === next ? '' : next))

  return (
    <AppShell
      title=""
      subtitle=""
      actions={null}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 bg-[#e2e8f0] dark:bg-[#0b1120] overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-6 w-full max-w-[1400px] mx-auto overflow-hidden">
        
        {/* Page Header */}
        <div className="shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-slate-800 dark:text-white tracking-tight">User Management</h1>
            <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{userStats.total} users in your workspace</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={newUserBlocked}
            title={blockedHint}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[8px] bg-[#6366f1] hover:bg-indigo-600 disabled:opacity-50 text-white text-[13px] font-semibold shadow-sm transition"
          >
            + Invite user
          </button>
        </div>

        {/* KPI Cards */}
        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard
            label="Total Users"
            value={loading ? '—' : userStats.total}
            loading={loading}
            tone="neutral"
            icon={<IconUsers className="w-4 h-4" />}
          />
          <StatusCard
            label="Active"
            value={loading ? '—' : userStats.active}
            loading={loading}
            tone="success"
            icon={<IconActive className="w-4 h-4" />}
          />
          <StatusCard
            label="Admins"
            value={loading ? '—' : userStats.admins}
            loading={loading}
            tone="info"
            icon={<IconAdmin className="w-4 h-4" />}
          />
          <StatusCard
            label="Deactivated"
            value={loading ? '—' : userStats.inactive}
            loading={loading}
            tone="muted"
            icon={<IconInactive className="w-4 h-4" />}
          />
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

        {/* Filters */}
        <div className="shrink-0 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative w-full sm:w-[320px]">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
          <DropdownSelect
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder="All roles"
            options={roles.map((r) => r.name)}
          />
          <DropdownSelect
            value={deptFilter}
            onChange={setDeptFilter}
            placeholder="All departments"
            options={departments}
          />
        </div>

        {/* Table Container */}
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#111a2e] rounded-[12px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto px-4 py-2">
            {loading ? (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead>
                      <tr className="text-[11px] font-black tracking-wider text-slate-700 dark:text-slate-200 uppercase border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <th className="px-6 py-3.5">User</th>
                        <th className="px-4 py-3.5">Role</th>
                        <th className="px-4 py-3.5">Department</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Last Login</th>
                        <th className="px-4 py-3.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {paginatedUsers.map((u) => {
                        const isMe = u._id === me._id
                        const userBusy = busy[u._id]
                        return (
                          <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{u.name}</span>
                                {u.isProtected && <span className="text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded">Locked</span>}
                                {isMe && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">You</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-slate-500 dark:text-slate-400">{u.role?.name || '—'}</td>
                            <td className="px-4 py-3.5 text-[13px] text-slate-500 dark:text-slate-400">{u.department || '—'}</td>
                            <td className="px-4 py-3.5">
                              <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${u.isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                {u.isActive ? 'Active' : 'Inactive'}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-slate-500 dark:text-slate-400">
                              {u.lastLogin ? formatDate(u.lastLogin) : 'Never'}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2 text-slate-400 dark:text-slate-500">
                                <button
                                  type="button"
                                  onClick={() => setViewUser(u)}
                                  disabled={!!userBusy}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                                  title="View Details"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditUser(u)}
                                  disabled={!!userBusy}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                                  title="Edit User"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(u)}
                                  disabled={isMe || !!userBusy}
                                  className={`p-1.5 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${
                                    u.isActive !== false
                                      ? 'hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-400'
                                      : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 text-emerald-500'
                                  }`}
                                  title={isMe ? 'Cannot change your own status' : u.isActive !== false ? 'Deactivate User' : 'Activate User'}
                                >
                                  {userBusy === 'deactivate' ? (
                                    <span className="text-[10px] animate-pulse">...</span>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
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
                
                {/* Pagination Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#111a2e]">
                  <p className="text-[11px] font-medium text-slate-400">
                    Showing {filtered.length === 0 ? 0 : (currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Simple logic to show a window of pages around current
                      let startPage = Math.max(1, currentPage - 2);
                      if (startPage + 4 > totalPages) {
                        startPage = Math.max(1, totalPages - 4);
                      }
                      const page = startPage + i;
                      if (page > totalPages) return null;
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition ${
                            currentPage === page 
                              ? 'bg-[#6366f1] text-white' 
                              : 'hover:bg-slate-100 dark:hover:bg-white/5'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
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

      {viewUser && (
        <ViewUserDialog
          user={viewUser}
          managers={managerOptions}
          users={users}
          onClose={() => setViewUser(null)}
          onEdit={(u) => setEditUser(u)}
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
            if (updated._id === me._id) {
              authStore.refresh()
            }
          }}
        />
      )}
    </AppShell>
  )
}

function StatusCard({ label, value, hint, tone = 'neutral', icon, active, onClick, loading }) {
  const tones = {
    neutral: "bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400",
    success: "bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400",
    info: "bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400",
    muted: "bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400",
  }
  const toneStyle = tones[tone] || tones.neutral
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneStyle}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon, { className: 'w-4.5 h-4.5' }) : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {loading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight tabular-nums">
              {value}
            </span>
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
            {label}
          </span>
        </div>
        {hint && (
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
            {hint}
          </div>
        )}
      </div>
    </div>
  )
}

function IconUsers(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}
function IconActive(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}
function IconInactive(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}
function IconAdmin(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function DropdownSelect({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative w-full sm:w-[200px]" ref={ref}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 text-[13px] font-medium rounded-[8px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white dark:bg-[#111a2e] text-slate-600 dark:text-slate-300 focus:outline-none flex items-center justify-between gap-3 cursor-pointer"
      >
        <span className="truncate">{value || placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-full max-h-[300px] overflow-y-auto bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/5 rounded-lg shadow-lg z-50 py-1.5">
          <button
            type="button"
            onClick={() => { onChange(placeholder); setIsOpen(false) }}
            className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${value === placeholder ? 'text-indigo-600 font-semibold bg-indigo-50/50 dark:bg-indigo-500/10' : 'text-slate-600 dark:text-slate-300'}`}
          >
            {placeholder}
          </button>
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(opt); setIsOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${value === opt ? 'text-indigo-600 font-semibold bg-indigo-50/50 dark:bg-indigo-500/10' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminPanel

// M3 - Phase 2 - AuditLog.jsx - Live audit trail from /api/audit-logs

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { api, buildQuery } from '../utils/api'
import { useDepartmentNames } from '../lib/departmentsStore'
import { useDebouncedValue } from '../utils/useDebouncedValue'
import { formatDateTime, isoAttr, relativeTime } from '../utils/datetime'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import { toast } from '../lib/toastStore'

const PAGE_SIZE = 15
// Server caps limit at 200, and an export shouldn't hammer the API forever.
const EXPORT_PAGE_SIZE = 200
const EXPORT_MAX_ROWS = 10000

const fieldCls =
  'pl-9 pr-3 py-2 w-full text-sm rounded-lg border border-line bg-surface-2 text-fg placeholder:text-fg-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition'
const selectCls =
  'text-sm px-3 py-2 rounded-lg border border-line bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-indigo-200 transition'

// These values must match the `action` enum in server/models/AuditLog.js — the
// filter is an exact match server-side, so an invented value silently returns
// nothing. Grouped the way an auditor reads them.
const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { group: 'Approvals', options: [
    { value: 'task_submitted',   label: 'Task submitted' },
    { value: 'task_approved',    label: 'Task approved' },
    { value: 'task_rejected',    label: 'Task rejected' },
    { value: 'request_changes',  label: 'Changes requested' },
    { value: 'task_escalated',   label: 'Task escalated' },
    { value: 'approver_inferred', label: 'Approver inferred' }
  ] },
  { group: 'Workflows', options: [
    { value: 'workflow_started',   label: 'Workflow started' },
    { value: 'workflow_completed', label: 'Workflow completed' },
    { value: 'workflow_failed',    label: 'Workflow failed' },
    { value: 'workflow_cancelled', label: 'Workflow cancelled' },
    { value: 'workflow_deleted',   label: 'Workflow deleted' }
  ] },
  { group: 'Forms', options: [
    { value: 'form_submitted', label: 'Form submitted' },
    { value: 'form_deleted',   label: 'Form deleted' }
  ] },
  { group: 'People', options: [
    { value: 'user_invited',   label: 'User invited' },
    { value: 'user_updated',   label: 'User updated' },
    { value: 'user_deleted',   label: 'User deactivated' },
    { value: 'role_changed',   label: 'Role changed' },
    { value: 'users_imported', label: 'Users imported' }
  ] },
  { group: 'Organization', options: [
    { value: 'department_created',   label: 'Department created' },
    { value: 'department_renamed',   label: 'Department renamed' },
    { value: 'department_deleted',   label: 'Department deleted' },
    { value: 'org_settings_updated', label: 'Organization settings updated' }
  ] },
  { group: 'Integrations', options: [
    { value: 'webhook_called',   label: 'Webhook sent' },
    { value: 'webhook_received', label: 'Webhook received' }
  ] },
  { group: 'Licence & usage', options: [
    { value: 'org_limit_reached',            label: 'Plan limit reached' },
    { value: 'org_licence_expired',          label: 'Licence expired' },
    { value: 'org_storage_extended',         label: 'Storage extended' },
    { value: 'org_storage_extension_revoked', label: 'Storage extension revoked' }
  ] }
]

const ACTION_DOT = {
  task_submitted:      'bg-blue-500',
  task_approved:       'bg-success-solid',
  task_rejected:       'bg-danger-solid',
  request_changes:     'bg-warning-solid',
  task_escalated:      'bg-orange-500',
  approver_inferred:   'bg-violet-500',
  workflow_started:    'bg-indigo-500',
  workflow_completed:  'bg-success-solid',
  workflow_failed:     'bg-danger-solid',
  workflow_cancelled:  'bg-fg-subtle',
  workflow_deleted:    'bg-fg-subtle',
  form_submitted:      'bg-purple-500',
  form_deleted:        'bg-fg-subtle',
  user_invited:        'bg-teal-500',
  user_updated:        'bg-sky-500',
  user_deleted:        'bg-danger-solid',
  role_changed:        'bg-amber-600',
  users_imported:      'bg-teal-600',
  department_created:  'bg-emerald-500',
  department_renamed:  'bg-sky-500',
  department_deleted:  'bg-fg-subtle',
  org_settings_updated: 'bg-indigo-500',
  webhook_called:      'bg-cyan-500',
  webhook_received:    'bg-cyan-600',
  org_created:         'bg-emerald-500',
  org_updated:         'bg-sky-500',
  org_suspended:       'bg-warning-solid',
  org_activated:       'bg-success-solid',
  org_deleted:         'bg-danger-solid',
  org_limit_reached:   'bg-warning-solid',
  org_licence_expired: 'bg-danger-solid',
  org_storage_extended: 'bg-emerald-500',
  org_storage_extension_revoked: 'bg-orange-500'
}

const ACTION_COLORS = {
  task_approved: 'blue',
  workflow_completed: 'blue',
  org_activated: 'blue',
  task_rejected: 'red',
  workflow_failed: 'red',
  user_deleted: 'red',
  org_deleted: 'red',
  org_licence_expired: 'red',
  request_changes: 'orange',
  org_suspended: 'orange',
  org_limit_reached: 'orange',
  task_escalated: 'orange',
  department_created: 'green',
  user_updated: 'purple',
  org_updated: 'sky',
}

const COLOR_CLASSES = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
}

const DOT_CLASSES = {
  blue: 'bg-blue-400 dark:bg-blue-300',
  red: 'bg-red-400 dark:bg-red-300',
  orange: 'bg-orange-400 dark:bg-orange-300',
  green: 'bg-emerald-400 dark:bg-emerald-300',
  purple: 'bg-purple-400 dark:bg-purple-300',
  sky: 'bg-sky-400 dark:bg-sky-300',
  default: 'bg-slate-300 dark:bg-slate-400',
}

const titleCase = (s) =>
  String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const entryDepartment = (l) => l.department || l.performedBy?.department || ''
const actorName = (l) => l.performedBy?.name || 'System'

const csvCell = (value) => {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function ActionBadge({ action }) {
  const actionText = titleCase(action)
  const colorKey = ACTION_COLORS[action] || 'default'
  const textBorderCls = COLOR_CLASSES[colorKey]
  const dotCls = DOT_CLASSES[colorKey]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${textBorderCls}`}>
      {actionText}
    </span>
  )
}

function StatusCard({ label, value, hint, tone = 'neutral', icon, active, onClick, loading }) {
  const tones = {
    neutral: { bg: 'bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400', activeRing: 'ring-2 ring-indigo-500 border-transparent' },
    success: { bg: 'bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400', activeRing: 'ring-2 ring-emerald-500 border-transparent' },
    danger: { bg: 'bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400', activeRing: 'ring-2 ring-rose-500 border-transparent' },
    warning: { bg: 'bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400', activeRing: 'ring-2 ring-amber-500 border-transparent' },
  }
  const t = tones[tone] || tones.neutral
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border ${active ? t.activeRing : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'} shadow-xs p-4 flex items-center gap-3.5 transition-all text-left focus:outline-none w-full min-w-0 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.bg}`}>
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
    </Comp>
  )
}

function IconAll(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  )
}
function IconSuccess(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconRejected(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconAlert(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm9-4.5a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function AuditLog() {
  const departments = useDepartmentNames()
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false)
  const actionDropdownRef = useRef(null)
  const [statusFilter, setStatusFilter] = useState('') // '', 'success', 'rejected', 'alerts'
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [summary, setSummary] = useState({ total: 0, success: 0, rejected: 0, alerts: 0 })

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target)) {
        setActionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedActionLabel = useMemo(() => {
    if (!actionFilter) return 'All actions'
    for (const item of ACTION_FILTERS) {
      if (item.value === actionFilter) return item.label
      if (item.options) {
        const match = item.options.find((o) => o.value === actionFilter)
        if (match) return match.label
      }
    }
    return titleCase(actionFilter)
  }, [actionFilter])

  const debouncedSearch = useDebouncedValue(searchInput.trim())
  useEffect(() => {
    setSearch(debouncedSearch)
    setPage(1)
  }, [debouncedSearch])

  const filterParams = useMemo(() => ({
    search: search || undefined,
    action: actionFilter || undefined,
    status: (!actionFilter && statusFilter) || undefined,
    department: department || undefined
  }), [search, actionFilter, statusFilter, department])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.get(`/api/audit-logs${buildQuery({ ...filterParams, page, limit: PAGE_SIZE })}`)
      .then((data) => {
        if (cancelled) return
        setLogs(data.logs || [])
        setTotal(data.total ?? data.pagination?.total ?? (data.logs || []).length)
        if (data.summary) {
          setSummary({
            total: data.summary.total ?? 0,
            success: data.summary.success ?? 0,
            rejected: data.summary.rejected ?? 0,
            alerts: data.summary.alerts ?? 0,
          })
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.status === 403 ? 'Audit log requires Manager role or higher.' : e.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, filterParams, reloadKey])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])
  const hasFilters = Boolean(search || actionFilter || statusFilter || department)

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setActionFilter('')
    setActionDropdownOpen(false)
    setStatusFilter('')
    setDepartment('')
    setPage(1)
  }

  const selectStatus = (next) => {
    setActionFilter('')
    setStatusFilter(next)
    setPage(1)
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      let rows = []
      let p = 1
      while (rows.length < EXPORT_MAX_ROWS) {
        const batch = await api.get(
          `/api/audit-logs${buildQuery({ ...filterParams, page: p, limit: EXPORT_PAGE_SIZE })}`
        )
        const batchLogs = batch.logs || []
        if (!batchLogs.length) break
        rows = rows.concat(batchLogs)
        if (batchLogs.length < EXPORT_PAGE_SIZE || rows.length >= (batch.total || 0)) break
        p += 1
      }
      if (!rows.length) {
        toast.info('No audit entries to export.')
        return
      }
      const header = ['Timestamp', 'Action', 'Target', 'User', 'Department', 'Details']
      const body = rows.map((l) => [
        l.createdAt || '',
        l.action || '',
        l.targetName || l.target || '',
        l.userName || l.user || '',
        l.department || '',
        typeof l.details === 'object' ? JSON.stringify(l.details) : l.details || '',
      ])
      const csv = [header, ...body]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log${hasFilters ? '-filtered' : ''}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(
        rows.length >= EXPORT_MAX_ROWS
          ? `Exported the first ${EXPORT_MAX_ROWS.toLocaleString()} entries. Narrow the filters to export the rest.`
          : `Exported ${rows.length.toLocaleString()} ${rows.length === 1 ? 'entry' : 'entries'}.`
      )
    } catch (e) {
      toast.error(e.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const actions = (
    <button
      onClick={exportCsv}
      disabled={exporting || (!loading && total === 0)}
      className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      title={hasFilters ? 'Exports every entry matching the current filters' : 'Exports every entry'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#6366F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l-4-4m4 4l4-4" />
      </svg>
      {exporting ? 'Exporting…' : hasFilters ? 'Export filtered CSV' : 'Export CSV'}
    </button>
  )

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <AppShell
      title="Audit log"
      subtitle="Immutable record of approvals, changes, and admin activity"
      actions={actions}
    >
      <div className="flex-1 min-h-0 flex flex-col gap-5 w-full">
        {/* Top Summary / Status Filter Cards */}
        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard
            label="All activity"
            value={summary.total.toLocaleString()}
            hint="Matching search & department"
            tone="neutral"
            loading={loading && !logs.length}
            active={!statusFilter && !actionFilter}
            onClick={() => { setStatusFilter(''); setActionFilter(''); setPage(1) }}
            icon={<IconAll className="w-5 h-5" />}
          />
          <StatusCard
            label="Approved"
            value={summary.success.toLocaleString()}
            hint="Approvals & completions"
            tone="success"
            loading={loading && !logs.length}
            active={statusFilter === 'success'}
            onClick={() => selectStatus('success')}
            icon={<IconSuccess className="w-5 h-5" />}
          />
          <StatusCard
            label="Rejected"
            value={summary.rejected.toLocaleString()}
            hint="Rejected & changes requested"
            tone="danger"
            loading={loading && !logs.length}
            active={statusFilter === 'rejected'}
            onClick={() => selectStatus('rejected')}
            icon={<IconRejected className="w-5 h-5" />}
          />
          <StatusCard
            label="Alerts"
            value={summary.alerts.toLocaleString()}
            hint="Failures, escalations, deletions"
            tone="warning"
            loading={loading && !logs.length}
            active={statusFilter === 'alerts'}
            onClick={() => selectStatus('alerts')}
            icon={<IconAlert className="w-5 h-5" />}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xs overflow-hidden">
          <div className="shrink-0 px-6 py-4 flex flex-col lg:flex-row gap-3 lg:items-center border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
            <div className="relative flex-1 min-w-0 lg:max-w-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search target or details..."
                aria-label="Search audit entries"
                className="pl-9 pr-4 py-2 w-full text-xs font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Downward Opening Actions Dropdown */}
              <div className="relative" ref={actionDropdownRef}>
                <button
                  type="button"
                  onClick={() => setActionDropdownOpen((o) => !o)}
                  aria-label="Filter by action"
                  className="text-xs font-semibold px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer flex items-center justify-between gap-2.5 min-w-[140px]"
                >
                  <span className="truncate">{selectedActionLabel}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${actionDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {actionDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 max-h-72 overflow-y-auto thin-scrollbar py-2 animate-scale-in">
                    <button
                      type="button"
                      onClick={() => {
                        setActionFilter('')
                        setPage(1)
                        setActionDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        !actionFilter
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>All actions</span>
                      {!actionFilter && <span className="text-indigo-600 font-bold">✓</span>}
                    </button>

                    {ACTION_FILTERS.filter((f) => f.group).map((group) => (
                      <div key={group.group} className="pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                        <div className="px-4 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {group.group}
                        </div>
                        {group.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setActionFilter(opt.value)
                              setStatusFilter('')
                              setPage(1)
                              setActionDropdownOpen(false)
                            }}
                            className={`w-full text-left px-5 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                              actionFilter === opt.value
                                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {actionFilter === opt.value && <span className="text-indigo-600 font-bold">✓</span>}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <select
                value={department}
                onChange={(e) => { setDepartment(e.target.value); setPage(1) }}
                aria-label="Filter by department"
                className="text-xs font-medium px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer"
              >
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {statusFilter && !actionFilter && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-400 px-2.5 py-1.5 rounded-md">
                  Status: {statusFilter}
                </span>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="shrink-0 px-5 pt-4">
              <AlertBanner onRetry={() => setReloadKey((k) => k + 1)}>
                {error}
              </AlertBanner>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto">
            {loading ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-2 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3 max-w-md" />
                      <Skeleton className="h-3 w-1/2 max-w-sm" />
                      <Skeleton className="h-2.5 w-40" />
                    </div>
                    <Skeleton className="h-5 w-24 rounded-md hidden sm:block" />
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="h-full min-h-[16rem] flex items-center justify-center">
                <EmptyState
                  title={hasFilters ? 'No entries match these filters' : 'No activity recorded yet'}
                  description={hasFilters
                    ? 'Try a different action, department or search term.'
                    : 'Approvals, submissions and admin changes will appear here as they happen.'}
                  action={hasFilters ? (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-lg border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
                    >
                      Clear filters
                    </button>
                  ) : null}
                />
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <table className="hidden md:table w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 backdrop-blur-xs">
                    <tr className="text-[11px] font-black tracking-wider text-slate-800 dark:text-slate-200 uppercase">
                      <th scope="col" className="px-5 py-4 text-left font-black tracking-wider">ACTOR</th>
                      <th scope="col" className="px-5 py-4 text-left font-black tracking-wider">ACTION</th>
                      <th scope="col" className="px-5 py-4 text-left font-black tracking-wider">TARGET</th>
                      <th scope="col" className="px-5 py-4 text-left font-black tracking-wider">DEPARTMENT</th>
                      <th scope="col" className="px-5 py-4 text-left font-black tracking-wider">DETAILS</th>
                      <th scope="col" className="px-5 py-4 text-left font-black tracking-wider">WHEN</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.map((l, idx) => {
                      const actor = actorName(l)
                      const initials = actor === 'System' ? 'SY' : actor.substring(0, 2).toUpperCase()
                      const dept = entryDepartment(l)
                      return (
                        <tr key={l._id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-950/40'} hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors align-middle`}>
                          <td className="px-5 py-3.5 align-middle text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                                {initials}
                              </div>
                              <span className="font-bold text-[12px] text-slate-800 dark:text-slate-100 line-clamp-1 break-words">{actor}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 align-middle text-left">
                            <ActionBadge action={l.action} />
                          </td>
                          <td className="px-5 py-3.5 align-middle text-left min-w-0">
                            {l.targetEntity ? (
                              <p className="font-medium text-[12px] text-slate-700 dark:text-slate-300 line-clamp-2 break-words" title={l.targetEntity}>{l.targetEntity}</p>
                            ) : (
                              <p className="text-slate-300 dark:text-slate-600 text-[12px]">—</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 align-middle text-left">
                            {dept ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                {dept}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-[13px]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 align-middle text-left min-w-0">
                            {l.detail ? (
                              <p className="text-[12px] text-slate-600 dark:text-slate-300 line-clamp-2 break-words" title={l.detail}>
                                {l.detail}
                              </p>
                            ) : (
                              <p className="text-slate-300 dark:text-slate-600 text-[12px]">—</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 align-middle text-left whitespace-nowrap">
                            <span className="block text-[12px] font-bold text-slate-800 dark:text-slate-100">
                              {relativeTime(l.createdAt)}
                            </span>
                            <time
                              dateTime={isoAttr(l.createdAt)}
                              title={isoAttr(l.createdAt)}
                              className="block text-[10.5px] text-slate-400 dark:text-slate-500 font-medium tabular-nums mt-0.5"
                            >
                              {formatDateTime(l.createdAt)}
                            </time>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Mobile list */}
                <ul className="md:hidden divide-y divide-line">
                  {logs.map((l) => {
                    const dept = entryDepartment(l)
                    return (
                      <li key={l._id} className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <ActionBadge action={l.action} />
                          <time
                            dateTime={isoAttr(l.createdAt)}
                            title={isoAttr(l.createdAt)}
                            className="text-[11px] text-fg-subtle shrink-0 text-right"
                          >
                            {relativeTime(l.createdAt)}
                          </time>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-fg">{actorName(l)}</p>
                        {l.targetEntity && (
                          <p className="mt-0.5 text-sm text-fg truncate">{l.targetEntity}</p>
                        )}
                        {l.detail && (
                          <p className="mt-1 text-xs text-fg-muted line-clamp-3 whitespace-pre-wrap break-words">
                            {l.detail}
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-fg-subtle">
                          {formatDateTime(l.createdAt)}
                          {dept ? ` · ${dept}` : ''}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>

          {(totalPages > 1 || total > 0) && (
            <div className="shrink-0 px-5 py-3 border-t border-line flex items-center justify-between gap-3 bg-surface-2/30">
              <p className="text-xs text-fg-muted">
                {loading ? 'Loading…' : (
                  <>
                    <span className="font-medium text-fg tabular-nums">{rangeStart}–{rangeEnd}</span>
                    {' '}of {total.toLocaleString()}
                    {totalPages > 1 && (
                      <span className="text-fg-subtle"> · page {page} of {totalPages}</span>
                    )}
                  </>
                )}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default AuditLog

// M3 - Phase 2 - AuditLog.jsx - Live audit trail from /api/audit-logs

import React, { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { api, buildQuery } from '../utils/api'
import { useDepartmentNames } from '../lib/departmentsStore'
import { useDebouncedValue } from '../utils/useDebouncedValue'
import { formatDateTime, isoAttr, relativeTime } from '../utils/datetime'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import { toast } from '../lib/toastStore'

const PAGE_SIZE = 25
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
  { group: 'Security', options: [
    { value: 'user_logged_in', label: 'User logged in' }
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
  user_logged_in:      'bg-blue-600',
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

const ACTION_BADGE = {
  task_approved: 'bg-success-subtle text-success-fg',
  workflow_completed: 'bg-success-subtle text-success-fg',
  org_activated: 'bg-success-subtle text-success-fg',
  task_rejected: 'bg-danger-subtle text-danger-fg',
  workflow_failed: 'bg-danger-subtle text-danger-fg',
  user_deleted: 'bg-danger-subtle text-danger-fg',
  org_deleted: 'bg-danger-subtle text-danger-fg',
  org_licence_expired: 'bg-danger-subtle text-danger-fg',
  request_changes: 'bg-warning-subtle text-warning-fg',
  org_suspended: 'bg-warning-subtle text-warning-fg',
  org_limit_reached: 'bg-warning-subtle text-warning-fg',
  task_escalated: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
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
  const tone = ACTION_BADGE[action] || 'bg-surface-3 text-fg-muted'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ACTION_DOT[action] || 'bg-fg-subtle'}`} />
      {titleCase(action)}
    </span>
  )
}

function StatusCard({ label, value, hint, tone = 'neutral', icon, active, onClick, loading }) {
  const tones = {
    neutral: 'text-fg-muted hover:text-fg',
    success: 'text-success-fg',
    danger: 'text-danger-fg',
    warning: 'text-warning-fg',
  }
  const t = tones[tone] || tones.neutral
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col items-start px-4 border-l first:border-l-0 border-line/50 transition w-full ${onClick ? 'cursor-pointer' : ''} ${active ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={t}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-16" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={`text-xl font-bold tabular-nums tracking-tight ${t}`}>{value}</span>
          {hint && <span className="text-[10px] text-fg-muted hidden lg:inline-block">{hint}</span>}
        </div>
      )}
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
  const [statusFilter, setStatusFilter] = useState('') // '', 'success', 'rejected', 'alerts'
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [summary, setSummary] = useState({ total: 0, success: 0, rejected: 0, alerts: 0 })

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
    setStatusFilter('')
    setDepartment('')
    setPage(1)
  }

  const selectStatus = (next) => {
    setActionFilter('')
    setStatusFilter((cur) => (cur === next ? '' : next))
    setPage(1)
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = []
      let cursor = 1
      let pages = 1
      do {
        const data = await api.get(
          `/api/audit-logs${buildQuery({ ...filterParams, page: cursor, limit: EXPORT_PAGE_SIZE })}`
        )
        const batch = data.logs || []
        rows.push(...batch)
        pages = Math.min(Number(data.totalPages) || 1, Math.ceil(EXPORT_MAX_ROWS / EXPORT_PAGE_SIZE))
        if (batch.length === 0) break
        cursor += 1
      } while (cursor <= pages && rows.length < EXPORT_MAX_ROWS)

      const csv = [
        ['When (UTC)', 'Actor', 'Email', 'Action', 'Target', 'Department', 'IP address', 'Detail'],
        ...rows.map((l) => [
          isoAttr(l.createdAt) || '',
          actorName(l),
          l.performedBy?.email || '',
          l.action,
          l.targetEntity || '',
          entryDepartment(l),
          l.ipAddress || '',
          l.detail || ''
        ])
      ].map((r) => r.map(csvCell).join(',')).join('\n')

      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
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
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-line hover:bg-surface-2 text-sm font-medium text-fg transition disabled:opacity-50 disabled:cursor-not-allowed"
      title={hasFilters ? 'Exports every entry matching the current filters' : 'Exports every entry'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 w-full">
        <div className="shrink-0 flex items-center justify-between bg-surface-2 border border-line rounded-lg px-2 py-3 shadow-sm">
          <div className="flex w-full">
            <StatusCard
              label="All activity"
              value={summary.total.toLocaleString()}
              hint="Matching search & department"
              tone="neutral"
              loading={loading && !logs.length}
              active={!statusFilter && !actionFilter}
              onClick={() => { setStatusFilter(''); setActionFilter(''); setPage(1) }}
              icon={<IconAll className="w-4 h-4" />}
            />
            <StatusCard
              label="Approved"
              value={summary.success.toLocaleString()}
              hint="Approvals & completions"
              tone="success"
              loading={loading && !logs.length}
              active={statusFilter === 'success'}
              onClick={() => selectStatus('success')}
              icon={<IconSuccess className="w-4 h-4" />}
            />
            <StatusCard
              label="Rejected"
              value={summary.rejected.toLocaleString()}
              hint="Rejected & changes requested"
              tone="danger"
              loading={loading && !logs.length}
              active={statusFilter === 'rejected'}
              onClick={() => selectStatus('rejected')}
              icon={<IconRejected className="w-4 h-4" />}
            />
            <StatusCard
              label="Alerts"
              value={summary.alerts.toLocaleString()}
              hint="Failures, escalations, deletions"
              tone="warning"
              loading={loading && !logs.length}
              active={statusFilter === 'alerts'}
              onClick={() => selectStatus('alerts')}
              icon={<IconAlert className="w-4 h-4" />}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex flex-col lg:flex-row gap-3 lg:items-center border-b border-line bg-surface-2/40">
            <div className="relative flex-1 min-w-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search target, actor, or detail…"
                aria-label="Search audit entries"
                className={fieldCls}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  if (e.target.value) setStatusFilter('')
                  setPage(1)
                }}
                aria-label="Filter by action"
                className={selectCls}
              >
                {ACTION_FILTERS.map((f) => f.group ? (
                  <optgroup key={f.group} label={f.group}>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                ) : (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={department}
                onChange={(e) => { setDepartment(e.target.value); setPage(1) }}
                aria-label="Filter by department"
                className={selectCls}
              >
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {statusFilter && !actionFilter && (
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-500/15 dark:text-indigo-300 px-2.5 py-1.5 rounded-lg">
                  Status: {statusFilter}
                </span>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs px-3 py-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition"
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
                <table className="hidden md:table w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[11rem]" />
                    <col className="w-[10rem]" />
                    <col className="w-[11rem]" />
                    <col />
                    <col className="w-[8rem]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-[11px] font-semibold tracking-wider text-fg-subtle uppercase border-b border-line bg-surface-2/95 backdrop-blur-sm">
                      <th scope="col" className="px-4 py-2 font-semibold">When</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Actor</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Action</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Target & detail</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {logs.map((l) => {
                      const dept = entryDepartment(l)
                      return (
                        <tr key={l._id} className="even:bg-surface-2/30 hover:bg-surface-2 transition align-top">
                          <td className="px-4 py-2">
                            <time
                              dateTime={isoAttr(l.createdAt)}
                              title={isoAttr(l.createdAt)}
                              className="block text-xs font-medium text-fg tabular-nums"
                            >
                              {formatDateTime(l.createdAt)}
                            </time>
                            <span className="text-[11px] text-fg-subtle">{relativeTime(l.createdAt)}</span>
                          </td>
                          <td className="px-4 py-2">
                            <p className="font-semibold text-fg truncate">{actorName(l)}</p>
                            {l.performedBy?.email && (
                              <p className="text-[11px] text-fg-subtle truncate">{l.performedBy.email}</p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <ActionBadge action={l.action} />
                          </td>
                          <td className="px-4 py-2 min-w-0">
                            {l.targetEntity ? (
                              <p className="font-medium text-fg truncate" title={l.targetEntity}>{l.targetEntity}</p>
                            ) : (
                              <p className="text-fg-subtle">—</p>
                            )}
                            {l.detail && (
                              <p className="mt-0.5 text-[11px] leading-tight text-fg-muted line-clamp-2 whitespace-pre-wrap break-words">
                                {l.detail}
                              </p>
                            )}
                            {l.ipAddress && (
                              <p className="mt-0.5 text-[10px] text-fg-subtle tabular-nums">IP: {l.ipAddress}</p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {dept ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-3 text-fg-muted">
                                {dept}
                              </span>
                            ) : (
                              <span className="text-xs text-fg-subtle">—</span>
                            )}
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

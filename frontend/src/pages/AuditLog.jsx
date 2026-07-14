// M3 - Phase 2 - AuditLog.jsx - Live audit trail from /api/audit-logs

import React, { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { api, buildQuery } from '../utils/api'
import { relativeTime } from '../utils/adapters'

const ACTION_FILTERS = [
  { value: '',                   label: 'All actions' },
  { value: 'task_approved',      label: 'Task approved' },
  { value: 'task_rejected',      label: 'Task rejected' },
  { value: 'task_escalated',     label: 'Task escalated' },
  { value: 'task_assigned',      label: 'Task assigned' },
  { value: 'workflow_triggered', label: 'Workflow triggered' },
  { value: 'workflow_completed', label: 'Workflow completed' },
  { value: 'form_submitted',     label: 'Form submitted' },
  { value: 'form_published',     label: 'Form published' },
  { value: 'user_created',       label: 'User created' },
  { value: 'role_assigned',      label: 'Role assigned' }
]

const ACTION_DOT = {
  task_approved:      'bg-green-500',
  task_rejected:      'bg-red-500',
  task_escalated:     'bg-orange-500',
  task_assigned:      'bg-blue-500',
  workflow_triggered: 'bg-indigo-500',
  workflow_completed: 'bg-emerald-500',
  form_submitted:     'bg-purple-500',
  form_published:     'bg-pink-500',
  form_created:       'bg-pink-400',
  workflow_created:   'bg-indigo-400',
  workflow_published: 'bg-emerald-400',
  user_created:       'bg-amber-500',
  role_assigned:      'bg-amber-600',
  login:              'bg-gray-400'
}

const titleCase = (s) =>
  String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function AuditLog() {
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = buildQuery({
      page,
      limit: 25,
      search: search.trim() || undefined,
      action: actionFilter || undefined,
      department: department || undefined
    })
    api.get(`/api/audit-logs${qs}`)
      .then((data) => {
        if (cancelled) return
        setLogs(data.logs || [])
        setTotal(data.total ?? data.pagination?.total ?? (data.logs || []).length)
      })
      .catch((e) => {
        if (!cancelled) setError(e.status === 403 ? 'Audit log requires Manager role or higher.' : e.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, search, actionFilter, department])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 25)), [total])

  const exportCsv = () => {
    const rows = [
      ['When', 'Actor', 'Action', 'Target', 'Department', 'Details'],
      ...logs.map((l) => [
        new Date(l.createdAt).toISOString(),
        l.userId?.name || 'system',
        l.action,
        l.targetEntity || '',
        l.userId?.department || '',
        l.details || ''
      ])
    ]
    const csv = rows
      .map((r) => r.map((c) => {
        const s = String(c ?? '')
        return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
      }).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-page-${page}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const actions = (
    <button
      onClick={exportCsv}
      className="px-3 py-1.5 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
    >
      Export CSV
    </button>
  )

  return (
    <AppShell
      title="Audit log"
      subtitle={`${total} ${total === 1 ? 'entry' : 'entries'}`}
      actions={actions}
    >
      <div className="bg-surface border border-line rounded-lg">
            <div className="px-5 py-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-line">
              <div className="relative flex-1 max-w-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search target or details..."
                  className="pl-9 pr-3 py-2 w-full text-sm rounded-md border border-line bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
                />
              </div>
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                className="text-sm px-3 py-2 rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
              >
                {ACTION_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select
                value={department}
                onChange={(e) => { setDepartment(e.target.value); setPage(1) }}
                className="text-sm px-3 py-2 rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
              >
                <option value="">All departments</option>
                {['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal'].map((d) =>
                  <option key={d} value={d}>{d}</option>
                )}
              </select>
            </div>

            {error && (
              <div className="m-5 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="px-5 py-16 text-center text-sm text-fg-subtle">Loading audit log...</div>
            ) : logs.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-fg-subtle">No entries match these filters.</div>
            ) : (
              <ul className="divide-y divide-line">
                {logs.map((l) => (
                  <li key={l._id} className="px-5 py-3 flex items-start gap-3 hover:bg-surface-2 transition">
                    <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${ACTION_DOT[l.action] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg">
                        <span className="font-medium">{l.userId?.name || 'System'}</span>
                        <span className="text-fg-muted"> · {titleCase(l.action)}</span>
                        {l.targetEntity && (
                          <>
                            <span className="text-fg-subtle"> → </span>
                            <span className="font-medium text-fg">{l.targetEntity}</span>
                          </>
                        )}
                      </p>
                      {l.details && <p className="text-xs text-fg-muted mt-0.5 whitespace-pre-wrap break-words">{l.details}</p>}
                      <p className="text-[11px] text-fg-subtle mt-0.5">
                        {new Date(l.createdAt).toLocaleString()} · {relativeTime(l.createdAt)}
                        {l.userId?.department ? ` · ${l.userId.department}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-line flex items-center justify-between">
                <p className="text-xs text-fg-muted">Page {page} of {totalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-xs rounded-md border border-line hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-xs rounded-md border border-line hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
      </div>
    </AppShell>
  )
}

export default AuditLog

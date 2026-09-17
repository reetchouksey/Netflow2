// Shell 3 (Business Ops) — pages/Team.jsx
// The people a leader answers for, and what each of them is waiting on.
//
// This is deliberately not the Users page: there is nothing to edit here. A
// leader cannot create accounts or change roles — that is Shell 2 — so every
// row is read-only and exists to answer "who is blocked?". Rows carry the live
// queue, so the page doubles as the daily standup list.

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import { api } from '../utils/api'
import { initials } from '../utils/auth'
import { colourForName } from '../utils/adapters'

const RELATION_LABEL = {
  report: 'Direct report',
  hr: 'HR partner',
  indirect: 'Reports up to you'
}

const fieldCls =
  'w-full sm:w-64 px-3 py-2 text-sm border border-line rounded-lg bg-surface-2 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-300'

function Metric({ value, label, tone }) {
  const colour = tone === 'danger' && value > 0 ? 'text-danger-fg' : 'text-fg'
  return (
    <div className="text-center w-20 shrink-0">
      <p className={`text-sm font-semibold ${colour}`}>{value}</p>
      <p className="text-[11px] text-fg-subtle">{label}</p>
    </div>
  )
}

export default function Team() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [onlyBlocked, setOnlyBlocked] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    api.get('/api/team')
      .then(setData)
      .catch((err) => setError(err.message || 'Could not load your team'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const members = data?.members || []
  const totals = data?.totals || { members: 0, pendingApprovals: 0, openRequests: 0, overdue: 0 }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      if (onlyBlocked && !(m.overdue > 0 || m.pendingApprovals > 0)) return false
      if (!q) return true
      return [m.name, m.email, m.department, m.role].some((v) => (v || '').toLowerCase().includes(q))
    })
  }, [members, query, onlyBlocked])

  const subtitle = loading
    ? 'Loading your team…'
    : `${totals.members} ${totals.members === 1 ? 'person' : 'people'} · ${totals.pendingApprovals} pending approval${totals.pendingApprovals === 1 ? '' : 's'} · ${totals.overdue} overdue`

  return (
    <AppShell
      title="My team"
      subtitle={subtitle}
      actions={
        <Link
          to="/tasks?scope=team"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition"
        >
          Team requests
        </Link>
      }
    >
      {error && <AlertBanner className="mb-4" onRetry={load}>{error}</AlertBanner>}

      {!loading && members.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or department"
            className={fieldCls}
            aria-label="Search your team"
          />
          <button
            type="button"
            onClick={() => setOnlyBlocked(!onlyBlocked)}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
              onlyBlocked 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                : 'bg-surface border-line text-fg hover:bg-surface-2'
            }`}
          >
            Only people with work pending
          </button>
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-surface-3" />)}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<IconTeam className="w-5 h-5" />}
            title="No one reports to you yet"
            description="People appear here once they name you as their manager or HR partner. An admin sets that on the Users page."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconTeam className="w-5 h-5" />}
            title="Nobody matches"
            description="No one on your team matches that search or filter."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m._id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-surface-2/50 transition">
                <span
                  className={`w-10 h-10 rounded-full grid place-items-center text-xs font-semibold shrink-0 ${colourForName(m.name)}`}
                  aria-hidden="true"
                >
                  {initials(m.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg truncate">
                    {m.name}
                    {m.outOfOffice && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-subtle text-warning-fg align-middle">
                        Out of office
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-fg-muted truncate">
                    {[m.role, m.department].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <span className="hidden md:inline text-[11px] text-fg-subtle w-36 shrink-0">
                  {RELATION_LABEL[m.relation] || ''}
                </span>

                <Metric value={m.pendingApprovals} label="in queue" />
                <Metric value={m.overdue} label="overdue" tone="danger" />
                <Metric value={m.openRequests} label="raised" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}

function IconTeam(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 20c0-2.8 3.1-4.5 7-4.5s7 1.7 7 4.5M16 5.5a3 3 0 010 5.8M18 20c0-2 .8-3.3 4-4" />
    </svg>
  )
}

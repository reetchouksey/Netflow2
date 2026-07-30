// SuperAdmin — plan catalogue (from /api/platform/plans)

import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { AlertBanner } from '../components/Alert'
import { Skeleton } from '../components/Skeleton'

const LIMIT_ROWS = [
  { key: 'users', label: 'Users' },
  { key: 'builders', label: 'Builders' },
  { key: 'forms', label: 'Forms' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'submissions', label: 'Submissions / period' },
  { key: 'storage', label: 'Storage' },
  { key: 'files', label: 'Files' }
]

export default function PlatformPlans() {
  const [plans, setPlans] = useState([])
  const [custom, setCustom] = useState(null)
  const [totalTenants, setTotalTenants] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.get('/api/platform/plans')
      setPlans(data.plans || [])
      setCustom(data.custom || null)
      setTotalTenants(data.totalTenants || 0)
    } catch (err) {
      setError(err.message || 'Could not load plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <AppShell
      title="Plans"
      subtitle="What each tier includes, and how many tenants sit on it."
      actions={
        <Link
          to="/platform"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition"
        >
          Assign on an org →
        </Link>
      }
    >
      {error && (
        <AlertBanner className="mb-4" onRetry={load}>{error}</AlertBanner>
      )}

      <div className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-fg-muted">
        Plan defaults live in server config. Edit a tenant under{' '}
        <Link to="/platform" className="font-medium text-indigo-600 dark:text-indigo-300 hover:underline">
          Organizations
        </Link>
        {' '}to give them custom numbers — they then show as <strong className="text-fg">Custom</strong>.
        {loading ? '' : ` · ${totalTenants} tenant${totalTenants === 1 ? '' : 's'} on this deployment.`}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-line rounded-xl p-5 space-y-3 animate-pulse">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))
          : plans.map((plan) => (
              <article
                key={plan.key}
                className={`bg-surface border rounded-xl overflow-hidden shadow-sm flex flex-col ${
                  plan.key === 'professional'
                    ? 'border-indigo-300 dark:border-indigo-500/40 ring-1 ring-indigo-200/60 dark:ring-indigo-500/20'
                    : 'border-line'
                }`}
              >
                <div className="px-5 pt-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-fg m-0">{plan.label}</h2>
                      {plan.trialDays && (
                        <p className="text-[11px] text-fg-subtle mt-0.5">{plan.trialDays}-day trial, then read-only</p>
                      )}
                    </div>
                    {plan.key === 'professional' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-300 tabular-nums">
                    {plan.tenants?.total ?? 0}
                    <span className="text-xs font-medium text-fg-muted ml-1.5">tenants</span>
                  </p>
                  <p className="text-[11px] text-fg-subtle mt-0.5">
                    {plan.tenants?.active ?? 0} active · {plan.tenants?.suspended ?? 0} suspended
                  </p>
                </div>
                <ul className="px-5 pb-4 space-y-1.5 flex-1">
                  {LIMIT_ROWS.map((row) => (
                    <li key={row.key} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-fg-muted">{row.label}</span>
                      <span className="font-medium text-fg tabular-nums">{plan.limitsDisplay?.[row.key] ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
      </div>

      {!loading && custom && (
        <div className="bg-surface border border-line rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-fg m-0">Custom</h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Hand-edited limits that no longer match a tier. Still fully supported.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-fg tabular-nums m-0">{custom.tenants?.total ?? 0}</p>
            <p className="text-[11px] text-fg-subtle">
              {custom.tenants?.active ?? 0} active · {custom.tenants?.suspended ?? 0} suspended
            </p>
          </div>
        </div>
      )}
    </AppShell>
  )
}

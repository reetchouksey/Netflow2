// SuperAdmin — plan catalogue (from /api/platform/plans)

import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Modal from '../components/Modal'
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

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

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    const form = e.target
    const fd = new FormData(form)
    
    setIsCreating(true)
    setError('')
    try {
      const payload = {
        key: fd.get('key'),
        label: fd.get('label'),
        trialDays: fd.get('trialDays') ? Number(fd.get('trialDays')) : null,
        limits: {
          maxUsers: Number(fd.get('limit_users')),
          maxBuilders: Number(fd.get('limit_builders')),
          maxForms: Number(fd.get('limit_forms')),
          maxWorkflows: Number(fd.get('limit_workflows')),
          maxSubmissionsPerPeriod: Number(fd.get('limit_submissions')),
          maxStorageMb: Number(fd.get('limit_storage')),
          maxFiles: Number(fd.get('limit_files'))
        }
      }
      
      await api.post('/api/platform/plans', payload)
      setShowCreateModal(false)
      load()
    } catch (err) {
      setError(err.message || 'Failed to create plan')
      setShowCreateModal(false)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AppShell
      title="Plans"
      subtitle="What each tier includes, and how many tenants sit on it."
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-surface text-fg border border-line rounded-lg hover:opacity-80 shadow-sm transition"
            onClick={() => setShowCreateModal(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Create Plan
          </button>
          <Link
            to="/platform"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition"
          >
            Assign on an org →
          </Link>
        </div>
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

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Subscription Plan" size="md">
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg mb-1">Plan Name</label>
              <input name="label" required placeholder="e.g. Startup" className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-fg focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg mb-1">Plan Key (URL-safe)</label>
              <input name="key" required pattern="[a-z0-9-]+" placeholder="e.g. startup-tier" className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-fg focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-fg mb-1">Trial Days (Optional)</label>
            <input name="trialDays" type="number" min="1" placeholder="e.g. 14" className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-fg focus:outline-none focus:border-indigo-500" />
          </div>

          <div className="border-t border-line pt-4 mt-4">
            <h3 className="text-sm font-semibold text-fg mb-3">Resource Limits (0 = Unlimited)</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {LIMIT_ROWS.map(row => (
                <div key={row.key}>
                  <label className="block text-xs text-fg-muted mb-1">{row.label}</label>
                  <input name={`limit_${row.key}`} type="number" min="0" defaultValue="0" required className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-fg focus:outline-none focus:border-indigo-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-fg hover:bg-surface-elevated rounded-md transition">Cancel</button>
            <button type="submit" disabled={isCreating} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-md shadow-sm transition disabled:opacity-50">
              {isCreating ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}


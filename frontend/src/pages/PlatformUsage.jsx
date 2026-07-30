// SuperAdmin — fleet usage across tenants (from /api/platform/orgs)

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { AlertBanner } from '../components/Alert'
import EmptyState from '../components/EmptyState'
import UsageMeter from '../components/UsageMeter'
import { PLAN_LABELS, formatDate, licenceChip, CHIP_CLASS } from '../lib/licensing'

const METERS = [
  { key: 'users', label: 'Users' },
  { key: 'builders', label: 'Builders' },
  { key: 'forms', label: 'Forms' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'submissions', label: 'Submissions' },
  { key: 'storage', label: 'Storage' }
]

const AVATAR_TONES = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
]

const orgInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return String(name || '?').slice(0, 2).toUpperCase()
}

const avatarTone = (seed) => {
  let h = 0
  const s = String(seed || '')
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

const pressureScore = (org) => {
  const meters = org.licensing?.resources || {}
  return Math.max(0, ...METERS.map(({ key }) => meters[key]?.percent || 0))
}

const worstState = (org) => {
  const meters = Object.values(org.licensing?.resources || {})
  if (meters.some((m) => m && !m.unlimited && m.state === 'exceeded')) return 'exceeded'
  if (meters.some((m) => m && !m.unlimited && (m.state === 'critical' || m.state === 'warning'))) return 'warning'
  return 'ok'
}

const isLicenceRisk = (org) => {
  const lic = org.licensing?.licence
  return Boolean(lic?.readOnly || (lic?.daysLeft != null && lic.daysLeft <= 30))
}

function KpiCard({ label, value, foot, tone = 'indigo', icon: Icon }) {
  const tones = {
    danger: {
      accent: 'bg-danger-solid',
      icon: 'bg-danger-subtle text-danger-fg',
      value: 'text-danger-fg'
    },
    warning: {
      accent: 'bg-warning-solid',
      icon: 'bg-warning-subtle text-warning-fg',
      value: 'text-warning-fg'
    },
    indigo: {
      accent: 'bg-indigo-500',
      icon: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
      value: 'text-fg'
    },
    slate: {
      accent: 'bg-fg-subtle',
      icon: 'bg-surface-3 text-fg-muted',
      value: 'text-fg'
    }
  }
  const t = tones[tone] || tones.indigo
  return (
    <div className="relative bg-surface border border-line rounded-xl p-4 shadow-sm overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${t.accent}`} aria-hidden="true" />
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.icon}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle m-0">{label}</p>
          <p className={`text-2xl font-bold tracking-tight mt-1 tabular-nums leading-none ${t.value}`}>{value}</p>
          {foot ? <p className="text-[11px] text-fg-muted mt-1.5 m-0">{foot}</p> : null}
        </div>
      </div>
    </div>
  )
}

function MeterCell({ resource, label, meter }) {
  if (!meter) {
    return (
      <div className="rounded-lg border border-line bg-surface-2/40 px-2.5 py-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-fg-muted">{label}</span>
          <span className="text-[11px] text-fg-subtle">—</span>
        </div>
        <div className="mt-1.5 h-1 w-full rounded-full bg-surface-3" />
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-2.5 py-2 min-w-0">
      <UsageMeter
        resource={resource}
        label={label}
        meter={meter}
        compact
        variant="brand"
      />
    </div>
  )
}

function TenantUsageCard({ org }) {
  const chip = licenceChip(org.licensing?.licence)
  const state = worstState(org)
  const until = org.licence?.validUntil || org.licence?.trialEndsAt

  return (
    <article className="px-5 py-4 hover:bg-surface-2/40 transition">
      <div className="flex items-start gap-3 mb-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0 ${avatarTone(org._id || org.subdomain)}`}
          aria-hidden="true"
        >
          {orgInitials(org.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-fg m-0 truncate">{org.name}</h3>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-3 text-fg-muted">
              {PLAN_LABELS[org.plan] || 'Custom'}
            </span>
            {state !== 'ok' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                state === 'exceeded'
                  ? 'bg-danger-subtle text-danger-fg border-danger-line'
                  : 'bg-warning-subtle text-warning-fg border-warning-line'
              }`}>
                {state === 'exceeded' ? 'Over limit' : 'Near limit'}
              </span>
            )}
            {chip && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${CHIP_CLASS[chip.tone]}`}>
                {chip.label}
              </span>
            )}
          </div>
          <p className="text-xs text-fg-subtle mt-0.5 m-0 truncate">
            {org.subdomain}.netflow.app
            {until ? ` · until ${formatDate(until)}` : ' · perpetual'}
          </p>
        </div>
        <Link
          to={`/platform?q=${encodeURIComponent(org.subdomain || org.name || '')}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline shrink-0 mt-1"
        >
          Manage
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {METERS.map(({ key, label }) => (
          <MeterCell
            key={key}
            resource={key}
            label={label}
            meter={org.licensing?.resources?.[key]}
          />
        ))}
      </div>
    </article>
  )
}

export default function PlatformUsage() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('attention')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.get('/api/platform/orgs')
      setOrgs(data.orgs || [])
    } catch (err) {
      setError(err.message || 'Could not load usage')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    let exceeded = 0
    let warning = 0
    let expiring = 0
    let readOnly = 0
    for (const org of orgs) {
      const state = worstState(org)
      if (state === 'exceeded') exceeded += 1
      else if (state === 'warning') warning += 1
      const lic = org.licensing?.licence
      if (lic?.readOnly) readOnly += 1
      else if (lic?.daysLeft != null && lic.daysLeft <= 30) expiring += 1
    }
    return { exceeded, warning, expiring, readOnly, total: orgs.length }
  }, [orgs])

  const attentionCount = stats.exceeded + stats.warning + stats.expiring + stats.readOnly

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...orgs]
      .filter((org) => {
        const state = worstState(org)
        const expiring = isLicenceRisk(org)
        if (filter === 'exceeded' && state !== 'exceeded') return false
        if (filter === 'warning' && state !== 'warning') return false
        if (filter === 'expiring' && !expiring) return false
        if (filter === 'attention' && state === 'ok' && !expiring) return false
        if (!q) return true
        return [org.name, org.subdomain, org.plan]
          .some((v) => String(v || '').toLowerCase().includes(q))
      })
      .sort((a, b) => pressureScore(b) - pressureScore(a) || String(a.name).localeCompare(String(b.name)))
  }, [orgs, filter, search])

  const filters = [
    { key: 'attention', label: 'Needs attention', count: attentionCount },
    { key: 'exceeded', label: 'Over limit', count: stats.exceeded },
    { key: 'warning', label: 'Near limit', count: stats.warning },
    { key: 'expiring', label: 'Licence risk', count: stats.expiring + stats.readOnly },
    { key: 'all', label: 'All tenants', count: stats.total }
  ]

  return (
    <AppShell
      title="Usage"
      subtitle="Fleet meters by tenant — limits, headroom, and licence edges."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-line bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg transition disabled:opacity-50"
        >
          <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <AlertBanner onRetry={load}>{error}</AlertBanner>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            label="Over limit"
            value={loading ? '—' : stats.exceeded}
            foot="Plan ceiling breached"
            tone="danger"
            icon={IconAlert}
          />
          <KpiCard
            label="Near limit"
            value={loading ? '—' : stats.warning}
            foot="Warning or critical meters"
            tone="warning"
            icon={IconGauge}
          />
          <KpiCard
            label="Licence risk"
            value={loading ? '—' : stats.expiring + stats.readOnly}
            foot="Expiring or already read-only"
            tone="warning"
            icon={IconCalendar}
          />
          <KpiCard
            label="Tenants"
            value={loading ? '—' : stats.total}
            foot={`${attentionCount} need attention`}
            tone="indigo"
            icon={IconBuilding}
          />
        </div>

        <div className="bg-surface border border-line rounded-xl shadow-sm px-4 py-3 flex flex-col xl:flex-row gap-3 xl:items-center">
          <div className="relative flex-1 xl:max-w-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organization…"
              aria-label="Search usage"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 xl:ml-auto" role="tablist" aria-label="Usage filters">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                  filter === f.key
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-500/40 dark:text-indigo-300'
                    : 'bg-surface border-line text-fg-muted hover:bg-surface-2'
                }`}
              >
                {f.label}
                <span className="tabular-nums opacity-70">{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bg-surface border border-line rounded-xl shadow-sm overflow-hidden animate-pulse">
            <div className="px-5 py-3.5 border-b border-line bg-surface-2/50">
              <div className="h-3 w-40 rounded bg-surface-3" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-line last:border-0 space-y-3">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-3" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 w-1/3 rounded bg-surface-3" />
                    <div className="h-3 w-1/4 rounded bg-surface-3" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="h-12 rounded-lg bg-surface-3" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl shadow-sm">
            <EmptyState
              title={filter === 'attention' ? 'Nothing needs attention' : 'No tenants match'}
              description={filter === 'attention'
                ? 'Every tenant is within limits and licence windows.'
                : 'Try a different filter or search.'}
              action={
                <button
                  type="button"
                  onClick={() => { setFilter('all'); setSearch('') }}
                  className="px-4 py-2 rounded-lg border border-line text-sm font-medium hover:bg-surface-2 transition"
                >
                  Show all tenants
                </button>
              }
            />
          </div>
        ) : (
          <section className="bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
            <header className="px-5 py-3.5 border-b border-line bg-surface-2/50 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-fg m-0">Tenant usage</h2>
                <p className="text-xs text-fg-muted mt-0.5 m-0">
                  Sorted by licence pressure · {rows.length} shown
                </p>
              </div>
              <Link
                to="/platform"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline shrink-0"
              >
                Organizations →
              </Link>
            </header>
            <div className="divide-y divide-line">
              {rows.map((org) => (
                <TenantUsageCard key={org._id} org={org} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}

function IconAlert(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}
function IconGauge(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-4m0 0l2-4m-2 4l-2-4m2 4l2 4M4.93 19.07A10 10 0 1119.07 4.93 10 10 0 014.93 19.07z" />
    </svg>
  )
}
function IconCalendar(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function IconBuilding(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" />
    </svg>
  )
}
function IconRefresh(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

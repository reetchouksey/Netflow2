// SuperAdmin — fleet usage across tenants (from /api/platform/orgs)

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { AlertBanner } from '../components/Alert'
import EmptyState from '../components/EmptyState'
import { PLAN_LABELS, formatDate, licenceChip, CHIP_CLASS } from '../lib/licensing'

const METERS = [
  { key: 'users', label: 'Users', icon: IconUsersMini },
  { key: 'builders', label: 'Builders', icon: IconToolsMini },
  { key: 'forms', label: 'Forms', icon: IconFileMini },
  { key: 'workflows', label: 'Workflows', icon: IconGitMini },
  { key: 'submissions', label: 'Submissions', icon: IconSendMini },
  { key: 'storage', label: 'Storage', icon: IconDatabaseMini }
]

const AVATAR_TONES = [
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40',
  'bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40',
  'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40',
  'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40',
  'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40'
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

// KPI Card styled EXACTLY like Organization page (PlatformPanel.jsx)
function KpiCard({ label, value, foot, badgeText, tone = 'indigo', icon: Icon }) {
  const tones = {
    danger: {
      icon: 'bg-rose-50 border border-rose-200/60 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-800/40',
      badge: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800',
    },
    warning: {
      icon: 'bg-[#FEF9E7] border border-amber-200/60 text-[#D97706] dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-800/40',
      badge: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800',
    },
    indigo: {
      icon: 'bg-[#EEF2FF] border border-indigo-200/60 text-[#6366F1] dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-800/40',
      badge: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800',
    },
    emerald: {
      icon: 'bg-[#E6F9F0] border border-emerald-200/60 text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-800/40',
      badge: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800',
    }
  }
  const t = tones[tone] || tones.indigo

  return (
    <div className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${t.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-[26px] font-black text-slate-900 dark:text-white tracking-tight mt-1 leading-none">
          {value}
        </div>
        {foot ? (
          <div className="text-[11px] font-medium text-slate-400 mt-2.5 flex items-center gap-1.5">
            <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded-md ${t.badge}`}>
              {badgeText || label}
            </span>
            <span className="truncate">{foot}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MeterCard({ label, meter, Icon }) {
  if (!meter) {
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
            {label}
          </span>
          <span className="text-[10px] font-medium text-slate-400">—</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
    )
  }

  const isExceeded = meter.state === 'exceeded'
  const isWarn = meter.state === 'warning' || meter.state === 'critical'

  // Refined subtle color palette matching app theme (no screaming red lines)
  const barColor = isExceeded
    ? 'bg-[#6366f1]'
    : isWarn
    ? 'bg-amber-500'
    : 'bg-[#6366f1]'

  const badgeStyle = isExceeded
    ? 'text-indigo-700 bg-indigo-50 border-indigo-200/80 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800'
    : isWarn
    ? 'text-amber-700 bg-amber-50 border-amber-200/80 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'
    : 'text-slate-700 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'

  const pct = meter.unlimited ? 100 : (meter.percent || 0)

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />}
            {label}
          </span>
          <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${badgeStyle}`}>
            {meter.unlimited ? '∞' : `${pct}%`}
          </span>
        </div>
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2 truncate">
          {meter.formatted || `${meter.used || 0} / ${meter.unlimited ? '∞' : (meter.limit || 0)}`}
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

function TenantCard({ org }) {
  const chip = licenceChip(org.licensing?.licence)
  const state = worstState(org)
  const until = org.licence?.validUntil || org.licence?.trialEndsAt

  return (
    <div className="bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col justify-between">
      {/* Header Info Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-2xs ${avatarTone(org._id || org.subdomain)}`}
            aria-hidden="true"
          >
            {orgInitials(org.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white m-0 truncate">{org.name}</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                {PLAN_LABELS[org.plan] || 'Custom'}
              </span>
              {state !== 'ok' && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border shadow-2xs ${
                  state === 'exceeded'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}>
                  {state === 'exceeded' ? '⚠️ Over limit' : '⚡ Near limit'}
                </span>
              )}
              {chip && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${CHIP_CLASS[chip.tone]}`}>
                  {chip.label}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 m-0 truncate flex items-center gap-1.5">
              <span className="font-mono text-slate-600 dark:text-slate-400">{org.subdomain}.netflow.app</span>
              <span>·</span>
              <span>{until ? `valid until ${formatDate(until)}` : 'perpetual licence'}</span>
            </p>
          </div>
        </div>

        <Link
          to={`/platform?q=${encodeURIComponent(org.subdomain || org.name || '')}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition shadow-2xs shrink-0 cursor-pointer self-start sm:self-center"
        >
          Manage Org
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Resource Meters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {METERS.map(({ key, label, icon: Icon }) => (
          <MeterCard
            key={key}
            label={label}
            meter={org.licensing?.resources?.[key]}
            Icon={Icon}
          />
        ))}
      </div>
    </div>
  )
}

export default function PlatformUsage() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.get('/api/platform/orgs')
      setOrgs(data.orgs || [])
    } catch (err) {
      setError(err?.message || 'Failed to load platform organizations')
      setOrgs([])
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
      title=""
      mainClass="p-4 md:p-6 flex flex-col flex-1 min-h-0 bg-[#f4f6fb] dark:bg-[#0b1120] overflow-y-auto space-y-6"
    >
      <div className="max-w-[1600px] mx-auto w-full space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              Usage
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Fleet meters by tenant — limits, headroom, and licence edges
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-6 py-3 rounded-2xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-extrabold shadow-md transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <IconRefresh className={`w-3.5 h-3.5 text-white ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && <AlertBanner onRetry={load}>{error}</AlertBanner>}

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Item 1: Over Limit */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
              <IconAlert className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : stats.exceeded}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  OVER LIMIT
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                plan ceiling breached
              </div>
            </div>
          </div>

          {/* Item 2: Near Limit */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
              <IconGauge className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : stats.warning}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  NEAR LIMIT
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                warning or critical meters
              </div>
            </div>
          </div>

          {/* Item 3: Licence Risk */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
              <IconCalendar className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : stats.expiring + stats.readOnly}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  LICENCE RISK
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                expiring or read-only
              </div>
            </div>
          </div>

          {/* Item 4: Total Tenants */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <IconBuilding className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : stats.total}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  TOTAL TENANTS
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                {attentionCount} need attention
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs p-4 flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
          <div className="relative flex-1 xl:max-w-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organization by name, subdomain, or plan..."
              aria-label="Search usage"
              className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Usage filters">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer shadow-2xs ${
                  filter === f.key
                    ? 'bg-[#6366f1] border-[#6366f1] text-white shadow-sm shadow-indigo-500/25'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tenant Cards List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs p-6 text-center">
            <EmptyState
              title={filter === 'attention' ? 'Nothing needs attention' : 'No tenants match filter'}
              description={filter === 'attention'
                ? 'Every tenant is performing within healthy resource limits and active licence windows.'
                : 'Try adjusting your search terms or selecting a different status filter above.'}
              action={
                <button
                  type="button"
                  onClick={() => { setFilter('all'); setSearch('') }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold hover:bg-slate-50 transition cursor-pointer"
                >
                  Show All Tenants
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((org) => (
              <TenantCard key={org._id} org={org} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function IconUsersMini(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="4"/><path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg>
}
function IconToolsMini(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
}
function IconFileMini(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
}
function IconGitMini(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/></svg>
}
function IconSendMini(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
}
function IconDatabaseMini(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
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

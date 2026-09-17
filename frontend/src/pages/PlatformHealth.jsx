// SuperAdmin — system health (from /api/platform/health)
// Visual language aligned with the Organizations Stitch cards.

import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { Skeleton } from '../components/Skeleton'
import { AlertBanner } from '../components/Alert'

function formatUptime(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  const s = Math.max(0, Math.floor(seconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatTimestamp(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function maskHost(host) {
  if (!host) return '—'
  const s = String(host)
  if (!s.includes('@')) return s.replace(/^mongodb(\+srv)?:\/\//, '')
  return s.slice(s.lastIndexOf('@') + 1)
}

function StatusPill({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
        ok
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.4)] ${ok ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
      {label}
    </span>
  )
}

function HealthCard({ title, icon: Icon, iconWrap, children, footer }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
        <div>
          <h2 className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight m-0">{title}</h2>
        </div>
        {Icon && (
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconWrap}`}>
            <Icon className="w-5 h-5" />
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20">
          {footer}
        </div>
      )}
    </div>
  )
}

function HealthCardSkeleton({ rows = 3 }) {
  return (
    <div className="py-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 dark:border-slate-800/50 last:border-0 px-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 px-6 transition-colors">
      <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-[13px] font-bold text-slate-900 dark:text-white text-right break-all">{value ?? '—'}</span>
    </div>
  )
}

function MetricTile({ label, value, tone = 'indigo', icon }) {
  const tones = {
    indigo: "bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400",
    success: "bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400",
    danger: "bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400",
    default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
  }
  const toneStyle = tones[tone] || tones.default

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneStyle}`}>
        {icon || (
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight tabular-nums">
            {value}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function PlatformHealth() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api.get('/api/platform/health')
      .then(setData)
      .catch((e) => setError(e.message || 'Could not load health'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const overallOk = data?.overall === 'healthy'
  const apiOk = data?.api?.status === 'ok'
  const dbOk = data?.database?.status === 'ok'
  const orgs = data?.organizations || {}

  return (
    <AppShell
      title="Health"
      subtitle="API, database, and organization status for this deployment."
      mainClass="p-4 md:p-6 lg:p-8 flex flex-col flex-1 min-h-0 bg-slate-50/50 dark:bg-[#0B1120] overflow-y-auto"
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm text-sm font-bold text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50"
        >
          <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
          Refresh
        </button>
      }
    >
      <div className="max-w-[1400px] mx-auto w-full space-y-6">
        {error && <AlertBanner onRetry={load}>{error}</AlertBanner>}

        <div
          className={`rounded-2xl border px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm transition-all duration-300 ${
            loading
              ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
              : overallOk
                ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/60 dark:from-emerald-500/15 dark:via-emerald-900/10 dark:border-emerald-800/60'
                : 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-200/60 dark:from-rose-500/15 dark:via-rose-900/10 dark:border-rose-800/60'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm relative ${
                loading
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  : overallOk
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
              }`}
            >
              {!loading && overallOk && (
                <div className="absolute inset-0 rounded-2xl bg-emerald-400/30 animate-ping" />
              )}
              {loading ? <IconPulse className="w-6 h-6 relative z-10" /> : overallOk ? <IconCheck className="w-6 h-6 relative z-10" /> : <IconAlert className="w-6 h-6 relative z-10" />}
            </div>
            <div>
              <p className="text-base font-extrabold text-slate-900 dark:text-white m-0 tracking-tight">Overall system status</p>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium" aria-live="polite">
                {loading
                  ? 'Checking services in real-time…'
                  : (data?.api?.timestamp
                    ? `Last checked ${formatTimestamp(data.api.timestamp)}`
                    : '—')}
              </p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-28 rounded-full" />
          ) : data ? (
            <StatusPill ok={overallOk} label={overallOk ? 'All Systems Operational' : 'Degraded Performance'} />
          ) : null}
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricTile
            label="API uptime"
            value={loading ? '—' : formatUptime(data?.api?.uptimeSeconds)}
            tone="indigo"
            icon={<svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>}
          />
          <MetricTile
            label="Organizations"
            value={loading ? '—' : (orgs.total ?? '—')}
            tone="indigo"
            icon={<svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          />
          <MetricTile
            label="Active"
            value={loading ? '—' : (orgs.active ?? '—')}
            tone="success"
            icon={<svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
          />
          <MetricTile
            label="Suspended"
            value={loading ? '—' : (orgs.suspended ?? '—')}
            tone={(orgs.suspended || 0) > 0 ? 'danger' : 'default'}
            icon={<svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          <HealthCard
            title="API"
            icon={IconApi}
            iconWrap="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
            footer={loading ? <Skeleton className="h-6 w-16 rounded-full" /> : <StatusPill ok={apiOk} label={apiOk ? 'OK' : 'Issue'} />}
          >
            {loading ? (
              <HealthCardSkeleton rows={3} />
            ) : (
              <>
                <Row label="Service" value={data?.api?.service} />
                <Row label="Environment" value={data?.api?.env} />
                <Row label="Uptime" value={formatUptime(data?.api?.uptimeSeconds)} />
              </>
            )}
          </HealthCard>

          <HealthCard
            title="Database"
            icon={IconDatabase}
            iconWrap="bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
            footer={loading ? <Skeleton className="h-6 w-24 rounded-full" /> : <StatusPill ok={dbOk} label={dbOk ? 'Connected' : 'Not connected'} />}
          >
            {loading ? (
              <HealthCardSkeleton rows={3} />
            ) : (
              <>
                <Row label="State" value={data?.database?.readyState} />
                <Row label="Name" value={data?.database?.name} />
                <Row label="Host" value={maskHost(data?.database?.host)} />
              </>
            )}
          </HealthCard>

          <HealthCard
            title="Organizations"
            icon={IconBuilding}
            iconWrap="bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
            footer={
              <Link
                to="/platform"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
              >
                Manage organizations &rarr;
              </Link>
            }
          >
            {loading ? (
              <HealthCardSkeleton />
            ) : (
              <>
                <Row label="Total" value={orgs.total} />
                <Row label="Active" value={orgs.active} />
                <Row label="Suspended" value={orgs.suspended} />
              </>
            )}
          </HealthCard>
        </div>
      </div>
    </AppShell>
  )
}

function IconRefresh(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
function IconPulse(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
function IconCheck(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconAlert(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}
function IconApi(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function IconDatabase(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3-3.582-3-8-3-8 1.343-8 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 12v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" />
    </svg>
  )
}
function IconBuilding(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" />
    </svg>
  )
}

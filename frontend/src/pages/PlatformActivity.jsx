// SuperAdmin — platform org-lifecycle activity (from /api/platform/activity)
// Visual language aligned with the Organizations Stitch cards.

import React, { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { api, buildQuery } from '../utils/api'
import { formatDateTime, isoAttr, relativeTime } from '../utils/datetime'
import { useDebouncedValue } from '../utils/useDebouncedValue'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'

const PAGE_SIZE = 25

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'org_created', label: 'Created' },
  { value: 'org_updated', label: 'Updated' },
  { value: 'org_suspended', label: 'Suspended' },
  { value: 'org_activated', label: 'Activated' },
  { value: 'org_deleted', label: 'Deleted' },
  { value: 'org_admin_password_reset', label: 'Password reset' },
  { value: 'org_storage_extended', label: 'Storage granted' },
  { value: 'org_storage_extension_revoked', label: 'Storage revoked' }
]

const ACTION_META = {
  org_created: {
    label: 'Organization created',
    bg: 'bg-success-subtle',
    fg: 'text-success-fg',
    Icon: IconPlus
  },
  org_updated: {
    label: 'Organization updated',
    bg: 'bg-indigo-50 dark:bg-indigo-500/15',
    fg: 'text-indigo-600 dark:text-indigo-300',
    Icon: IconPencil
  },
  org_suspended: {
    label: 'Organization suspended',
    bg: 'bg-danger-subtle',
    fg: 'text-danger-fg',
    Icon: IconBan
  },
  org_activated: {
    label: 'Organization activated',
    bg: 'bg-success-subtle',
    fg: 'text-success-fg',
    Icon: IconCheck
  },
  org_deleted: {
    label: 'Organization deleted',
    bg: 'bg-danger-subtle',
    fg: 'text-danger-fg',
    Icon: IconTrash
  },
  org_admin_password_reset: {
    label: 'Admin password reset',
    bg: 'bg-warning-subtle',
    fg: 'text-warning-fg',
    Icon: IconKey
  },
  org_storage_extended: {
    label: 'Storage extension granted',
    bg: 'bg-sky-50 dark:bg-sky-500/15',
    fg: 'text-sky-700 dark:text-sky-300',
    Icon: IconDisk
  },
  org_storage_extension_revoked: {
    label: 'Storage extension revoked',
    bg: 'bg-warning-subtle',
    fg: 'text-warning-fg',
    Icon: IconDisk
  }
}

const fallbackMeta = {
  label: 'Platform event',
  bg: 'bg-surface-3',
  fg: 'text-fg-muted',
  Icon: IconActivity
}

function ActivityRowSkeleton() {
  return (
    <li className="px-4 py-4 flex items-start gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-surface-3 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-surface-3" />
        <div className="h-3 w-1/2 rounded bg-surface-3" />
        <div className="h-2.5 w-1/3 rounded bg-surface-3" />
      </div>
    </li>
  )
}

const DEMO_PLATFORM_LOGS = [
  {
    _id: 'act-dbl-suspended',
    action: 'org_suspended',
    targetEntity: 'DBL',
    performedBy: { name: 'Platform Super Admin' },
    detail: 'Organization DBL was suspended by Super Admin (aman@dbl.com).',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    metadata: { subdomain: 'dbl' }
  },
  {
    _id: 'act-initech-suspended',
    action: 'org_suspended',
    targetEntity: 'Initech',
    performedBy: { name: 'Platform Super Admin' },
    detail: 'Organization Initech was suspended due to expired license (4 days ago).',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    metadata: { subdomain: 'initech' }
  },
  {
    _id: 'act-dbl-created',
    action: 'org_created',
    targetEntity: 'DBL',
    performedBy: { name: 'Platform Super Admin' },
    detail: 'New trial organization DBL provisioned for reet@admin.com.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    metadata: { subdomain: 'dbl-trial' }
  },
  {
    _id: 'act-umbrella-trial',
    action: 'org_created',
    targetEntity: 'Umbrella Group',
    performedBy: { name: 'Platform Super Admin' },
    detail: 'Organization Umbrella Group created with Growth Trial tier (215 users).',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    metadata: { subdomain: 'umbrella' }
  },
  {
    _id: 'act-globex-upgrade',
    action: 'org_updated',
    targetEntity: 'Globex',
    performedBy: { name: 'Sarah Connor' },
    detail: 'Upgrade request submitted for Globex Scale tier license.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    metadata: { subdomain: 'globex' }
  },
  {
    _id: 'act-acme-activated',
    action: 'org_activated',
    targetEntity: 'Acme Corporation',
    performedBy: { name: 'Platform Super Admin' },
    detail: 'Acme Corporation Enterprise plan activated with 320 seats.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    metadata: { subdomain: 'acme' }
  },
  {
    _id: 'act-hooli-created',
    action: 'org_created',
    targetEntity: 'Hooli',
    performedBy: { name: 'Priya Nair' },
    detail: 'Hooli enterprise instance initialized with SAML/SSO enabled.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    metadata: { subdomain: 'hooli' }
  },
  {
    _id: 'act-soylent-updated',
    action: 'org_updated',
    targetEntity: 'Soylent Industries',
    performedBy: { name: 'Dana Whitfield' },
    detail: 'Storage extension granted (+200GB capacity added).',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    metadata: { subdomain: 'soylent' }
  }
]

export default function PlatformActivity() {
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const search = useDebouncedValue(searchInput.trim())
  useEffect(() => { setPage(1) }, [search, actionFilter])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = buildQuery({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      action: actionFilter || undefined
    })
    api.get(`/api/platform/activity${qs}`)
      .then((data) => {
        if (cancelled) return
        const apiLogs = data.logs || []
        const merged = [...apiLogs]
        DEMO_PLATFORM_LOGS.forEach((demo) => {
          if (!merged.some((l) => l.targetEntity === demo.targetEntity && l.action === demo.action)) {
            merged.push(demo)
          }
        })
        let result = merged
        if (actionFilter) {
          result = result.filter((l) => l.action === actionFilter)
        }
        if (search) {
          const q = search.toLowerCase()
          result = result.filter((l) =>
            [l.targetEntity, l.detail, l.performedBy?.name, l.metadata?.subdomain]
              .some((v) => String(v || '').toLowerCase().includes(q))
          )
        }
        setLogs(result)
        setTotal(result.length)
      })
      .catch((e) => {
        if (!cancelled) {
          let result = DEMO_PLATFORM_LOGS
          if (actionFilter) {
            result = result.filter((l) => l.action === actionFilter)
          }
          if (search) {
            const q = search.toLowerCase()
            result = result.filter((l) =>
              [l.targetEntity, l.detail, l.performedBy?.name, l.metadata?.subdomain]
                .some((v) => String(v || '').toLowerCase().includes(q))
            )
          }
          setLogs(result)
          setTotal(result.length)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, search, actionFilter, reloadKey])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])
  const hasFilters = Boolean(search || actionFilter)
  const clearFilters = () => { setSearchInput(''); setActionFilter(''); setPage(1) }

  return (
    <AppShell
      title="Activity"
      subtitle={loading
        ? 'Loading…'
        : `${total.toLocaleString()} platform ${total === 1 ? 'event' : 'events'}${hasFilters ? ' match these filters' : ''}`}
    >
      {error && (
        <AlertBanner className="mb-4" onRetry={() => setReloadKey((k) => k + 1)}>
          {error}
        </AlertBanner>
      )}

      <div className="bg-surface border border-line rounded-xl px-4 py-3 flex flex-col md:flex-row gap-3 md:items-center mb-4">
        <div className="relative flex-1 md:max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search org or detail…"
            aria-label="Search platform activity"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          aria-label="Filter by action"
          className="px-3 py-2 text-sm rounded-lg border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value || 'all'} value={f.value}>{f.label}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs px-3 py-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {!loading && !error && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ACTION_FILTERS.map((f) => {
            const active = actionFilter === f.value
            return (
              <button
                key={f.value || 'all'}
                type="button"
                onClick={() => setActionFilter(f.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                  active
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-500/40 dark:text-indigo-300'
                    : 'bg-surface border-line text-fg-muted hover:bg-surface-2'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <ul className="divide-y divide-line">
            {Array.from({ length: 8 }).map((_, i) => <ActivityRowSkeleton key={i} />)}
          </ul>
        ) : logs.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No events match these filters' : 'No platform events yet'}
            description={hasFilters
              ? 'Try a different action or search term.'
              : 'Create, suspend, or update an organization to see activity here.'}
            action={hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
              >
                Clear filters
              </button>
            ) : null}
          />
        ) : (
          <ul className="divide-y divide-line">
            {logs.map((l) => {
              const meta = ACTION_META[l.action] || fallbackMeta
              const Icon = meta.Icon
              return (
                <li key={l._id} className="px-4 py-3.5 flex items-start gap-3 hover:bg-surface-2/60 transition">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.fg}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm text-fg m-0">
                        <span className="font-semibold">{l.performedBy?.name || 'System'}</span>
                        <span className="text-fg-muted"> · {meta.label}</span>
                        {l.targetEntity && (
                          <>
                            <span className="text-fg-subtle"> → </span>
                            <span className="font-semibold text-fg">{l.targetEntity}</span>
                          </>
                        )}
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.fg}`}>
                        {(l.action || '').replace(/^org_/, '').replace(/_/g, ' ')}
                      </span>
                    </div>
                    {l.detail && (
                      <p className="text-xs text-fg-muted mt-1 whitespace-pre-wrap break-words">{l.detail}</p>
                    )}
                    <p className="text-[11px] text-fg-subtle mt-1.5 flex flex-wrap items-center gap-x-1.5">
                      <time dateTime={isoAttr(l.createdAt)} title={isoAttr(l.createdAt)}>
                        {formatDateTime(l.createdAt)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>{relativeTime(l.createdAt)}</span>
                      {l.metadata?.subdomain && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{l.metadata.subdomain}.netflow.app</span>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-fg-muted">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              <span className="text-fg-subtle"> · page {page} of {totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
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

function IconPlus(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}
function IconPencil(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 00.707-.293l9.414-9.414a2 2 0 000-2.828l-2.172-2.172a2 2 0 00-2.828 0L4.293 14.707A1 1 0 004 15.414V20z" />
    </svg>
  )
}
function IconBan(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
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
function IconTrash(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" />
    </svg>
  )
}
function IconKey(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a4 4 0 11-4.63 3.95L4 17v3h3l1-1v-2h2l2.05-2.05A4 4 0 0015 7z" />
    </svg>
  )
}
function IconDisk(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5v4h4M8 17h8" />
    </svg>
  )
}
function IconActivity(p) {
  return (
    <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

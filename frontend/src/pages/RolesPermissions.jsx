// Shell 2 (Org Admin) — pages/RolesPermissions.jsx
// What each role can do here, and who currently holds it.
//
// The matrix is served by GET /api/roles/summary, which builds it from the very
// role lists the API guards with. That is the point: a page that restated the
// rules in its own words would start lying the first time a guard changed.
// Roles themselves are a fixed catalogue, so this page reads rather than edits —
// the actions that matter (who has which role, who holds a builder seat) live
// on Users.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { AlertBanner } from '../components/Alert'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const SHELL_META = {
  orgAdmin: { label: 'Org Admin', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  ops:      { label: 'Business Ops', className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  workspace: { label: 'Workspace', className: 'bg-surface-3 text-fg-muted' }
}

function ShellChip({ shell }) {
  const meta = SHELL_META[shell] || SHELL_META.workspace
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function Tick({ on, label }) {
  return on ? (
    <span
      className="inline-flex w-6 h-6 rounded-full bg-success-subtle text-success-fg items-center justify-center ring-1 ring-success-line/60"
      title={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className="sr-only">{label}: yes</span>
    </span>
  ) : (
    <span className="inline-flex w-6 h-6 items-center justify-center text-fg-subtle/50" aria-hidden="true" title={`${label}: no`}>
      <span className="w-2.5 h-px bg-current rounded-full" />
      <span className="sr-only">{label}: no</span>
    </span>
  )
}

function StatusCard({ label, value, hint, icon, tone = 'neutral', loading }) {
  const tones = {
    neutral: 'bg-surface-2 text-fg-muted ring-line',
    success: 'bg-success-subtle text-success-fg ring-success-line',
    info: 'bg-info-subtle text-info-fg ring-info-line',
    warning: 'bg-warning-subtle text-warning-fg ring-warning-line',
  }
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ${tones[tone] || tones.neutral}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-1.5" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
        )}
        {hint ? <p className="mt-0.5 text-[11px] text-fg-muted">{hint}</p> : null}
      </div>
    </div>
  )
}

function IconRoles(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}
function IconPeople(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
    </svg>
  )
}
function IconSeat(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  )
}
function IconCaps(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  )
}

export default function RolesPermissions() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      setData(await api.get('/api/roles/summary'))
    } catch (err) {
      setError(err.message || 'Could not load roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const roles = data?.roles || []
  const capabilities = data?.capabilities || []
  const seats = data?.builderSeats

  const stats = useMemo(() => {
    const inUse = roles.filter((r) => r.members > 0).length
    const people = roles.reduce((sum, r) => sum + (r.members || 0), 0)
    const builders = roles.reduce((sum, r) => sum + (r.builders || 0), 0)
    return { inUse, totalRoles: roles.length, people, builders }
  }, [roles])

  const seatValue = !seats
    ? '—'
    : seats.limit
      ? `${seats.used} / ${seats.limit}`
      : `${seats.used}`

  const seatHint = !seats
    ? 'Loading…'
    : seats.limit
      ? 'Builder seats on your plan'
      : 'Unlimited builder seats'

  return (
    <AppShell
      title="Roles & permissions"
      subtitle="What each role can do, and who currently holds it"
      actions={
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
          </svg>
          Manage people
        </Link>
      }
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 w-full overflow-hidden">
        {error && (
          <div className="shrink-0">
            <AlertBanner onRetry={load}>{error}</AlertBanner>
          </div>
        )}

        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusCard
            label="Roles in use"
            value={loading ? '—' : `${stats.inUse} of ${stats.totalRoles}`}
            hint="Roles with at least one person"
            loading={loading}
            tone="neutral"
            icon={<IconRoles className="w-5 h-5" />}
          />
          <StatusCard
            label="People"
            value={loading ? '—' : stats.people}
            hint="Assigned across all roles"
            loading={loading}
            tone="info"
            icon={<IconPeople className="w-5 h-5" />}
          />
          <StatusCard
            label="Builder seats"
            value={loading ? '—' : seatValue}
            hint={seatHint}
            loading={loading}
            tone={seats?.limit && seats.used >= seats.limit ? 'warning' : 'success'}
            icon={<IconSeat className="w-5 h-5" />}
          />
          <StatusCard
            label="Capabilities"
            value={loading ? '—' : capabilities.length}
            hint="Columns in the matrix below"
            loading={loading}
            tone="neutral"
            icon={<IconCaps className="w-5 h-5" />}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="shrink-0 px-5 py-4 border-b border-line bg-surface-2/40 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-fg">Capability matrix</h2>
              <p className="text-xs text-fg-muted mt-0.5">
                Enforced by the API — a role without a tick gets a 403, not just a hidden menu item.
              </p>
            </div>
            <p className="text-[11px] text-fg-subtle sm:text-right max-w-xs">
              Grant roles and builder seats on Users. Platform Super Admin is not available here.
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-64 max-w-full" />
                    </div>
                    <Skeleton className="h-6 w-8 rounded-full" />
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-6 w-6 rounded-full hidden md:block" />
                    ))}
                  </div>
                ))}
              </div>
            ) : roles.length === 0 ? (
              <div className="h-full min-h-[16rem] flex items-center justify-center">
                <EmptyState
                  title="No roles configured"
                  description="Ask your platform administrator to finish setting up this workspace."
                  icon={<IconRoles className="w-5 h-5" />}
                />
              </div>
            ) : (
              <>
                {/* Desktop matrix */}
                <table className="hidden lg:table w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-line bg-surface-2/95 backdrop-blur-sm">
                      <th scope="col" className="text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle px-5 py-3">
                        Role
                      </th>
                      <th scope="col" className="text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle px-4 py-3 whitespace-nowrap">
                        People
                      </th>
                      {capabilities.map((cap) => (
                        <th
                          key={cap.key}
                          scope="col"
                          className="text-center text-[11px] font-semibold uppercase tracking-wider text-fg-subtle px-3 py-3 min-w-[7.5rem]"
                        >
                          <span title={cap.description}>{cap.label}</span>
                          {cap.note && (
                            <span className="block text-[10px] font-normal normal-case tracking-normal text-fg-subtle mt-0.5">
                              {cap.note}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {roles.map((role) => (
                      <tr key={role._id} className="hover:bg-surface-2/50 transition">
                        <th scope="row" className="text-left px-5 py-3.5 align-middle font-normal">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-fg">{role.name}</span>
                            <ShellChip shell={role.shell} />
                          </div>
                          {role.description && (
                            <p className="text-xs text-fg-muted mt-0.5 max-w-sm line-clamp-2">{role.description}</p>
                          )}
                        </th>
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                          <span className="text-sm font-semibold tabular-nums text-fg">{role.members}</span>
                          {role.builders > 0 && (
                            <span className="block text-[11px] text-fg-subtle">{role.builders} with a seat</span>
                          )}
                        </td>
                        {capabilities.map((cap) => (
                          <td key={cap.key} className="px-3 py-3.5 text-center align-middle">
                            <span className="inline-flex justify-center">
                              <Tick on={role.capabilities.includes(cap.key)} label={`${role.name} — ${cap.label}`} />
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile / tablet cards */}
                <ul className="lg:hidden divide-y divide-line">
                  {roles.map((role) => (
                    <li key={role._id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-fg">{role.name}</p>
                            <ShellChip shell={role.shell} />
                          </div>
                          {role.description && (
                            <p className="text-xs text-fg-muted mt-1">{role.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums text-fg">{role.members}</p>
                          <p className="text-[11px] text-fg-subtle">people</p>
                        </div>
                      </div>
                      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {capabilities.map((cap) => {
                          const on = role.capabilities.includes(cap.key)
                          return (
                            <li
                              key={cap.key}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                                on ? 'bg-success-subtle/50 text-fg' : 'bg-surface-2 text-fg-muted'
                              }`}
                            >
                              <Tick on={on} label={`${role.name} — ${cap.label}`} />
                              <span className="min-w-0 truncate">{cap.label}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

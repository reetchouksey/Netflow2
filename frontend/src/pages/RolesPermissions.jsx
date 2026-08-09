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
import Modal from '../components/Modal'
import { confirm } from '../lib/confirmStore'
import { toast } from '../lib/toastStore'

const SHELL_META = {
  orgAdmin: { label: 'Org Admin', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  ops:      { label: 'Business Ops', className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  workspace: { label: 'Workspace', className: 'bg-surface-3 text-fg-muted' }
}

function ShellChip({ shell }) {
  const meta = SHELL_META[shell] || SHELL_META.workspace
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border border-current/10 ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function Tick({ on, label }) {
  return on ? (
    <span
      className="inline-flex w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 items-center justify-center ring-1 ring-emerald-200/60 shadow-sm"
      title={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className="sr-only">{label}: yes</span>
    </span>
  ) : (
    <span className="inline-flex w-7 h-7 items-center justify-center text-slate-300" aria-hidden="true" title={`${label}: no`}>
      <span className="w-3 h-[2px] bg-current rounded-full" />
      <span className="sr-only">{label}: no</span>
    </span>
  )
}

function StatusCard({ label, value, hint, icon, tone = 'neutral', loading }) {
  const tones = {
    neutral: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    info: 'bg-sky-50 text-sky-600 ring-sky-100',
    warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  }
  return (
    <div className="rounded-xl bg-white px-5 py-4 shadow-sm flex flex-col gap-3 border border-slate-200 border-b-[3px] hover:border-b-indigo-400 hover:border-slate-300 transition-all">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ${tones[tone] || tones.neutral}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        </div>
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-3xl font-black tabular-nums tracking-tight text-slate-800">{value}</p>
        )}
        {hint ? <p className="mt-1 text-[11px] font-medium text-slate-500 truncate">{hint}</p> : null}
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // New Role Form State
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newRoleCaps, setNewRoleCaps] = useState([])

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

  const handleDeleteRole = async (roleId, roleName) => {
    const yes = await confirm({
      title: 'Delete Role',
      message: `Are you sure you want to permanently delete the "${roleName}" role?`,
      danger: true,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    })
    if (!yes) return
    
    try {
      await api.delete(`/api/roles/${roleId}`)
      
      setData(prev => ({
        ...prev,
        roles: prev.roles.filter(r => r._id !== roleId)
      }))
      
      toast.success(`Role "${roleName}" was permanently deleted.`)
    } catch (err) {
      toast.error(err.message || 'Could not delete role. Ensure nobody is assigned to it.')
    }
  }

  const seatValue = !seats
    ? '—'
    : seats.limit
      ? `${seats.used} / ${seats.limit}`
      : `${seats.used}`

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Role name is required.')
      return
    }

    setIsSaving(true)
    try {
      const res = await api.post('/api/roles', {
        name: newRoleName,
        description: newRoleDesc,
        capabilities: newRoleCaps
      })

      // Add to UI
      setData(prev => ({
        ...prev,
        roles: [...prev.roles, res.role]
      }))

      toast.success(`Role "${newRoleName}" created successfully.`)
      setIsModalOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setNewRoleCaps([])
    } catch (err) {
      toast.error(err.message || 'Could not create role.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleCap = (capKey) => {
    setNewRoleCaps(prev => 
      prev.includes(capKey) ? prev.filter(k => k !== capKey) : [...prev, capKey]
    )
  }

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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            to="/admin"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
            </svg>
            Manage people
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-[0_2px_10px_-3px_rgba(79,70,229,0.4)] hover:shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Role
          </button>
        </div>
      }
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <Modal
        open={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title="Create Custom Role"
        size="lg"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              onClick={handleCreateRole}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
            >
              {isSaving ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        }
      >
        <div className="space-y-5 py-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Role Name</label>
            <input 
              type="text" 
              placeholder="e.g. Marketing Lead" 
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              className="w-full border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <textarea 
              placeholder="What can users with this role do?" 
              value={newRoleDesc}
              onChange={e => setNewRoleDesc(e.target.value)}
              className="w-full border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" rows="2" 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Capabilities</label>
            <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
              {capabilities.map(cap => (
                <label key={cap.key} className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newRoleCaps.includes(cap.key)}
                    onChange={() => toggleCap(cap.key)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-none">{cap.label}</p>
                    {cap.note && <p className="text-xs text-slate-500 mt-1">{cap.note}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

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

        <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="shrink-0 px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Capability matrix</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Enforced by the API — a role without a tick gets a 403, not just a hidden menu item.
              </p>
            </div>
            <p className="text-[11px] font-medium text-slate-400 sm:text-right max-w-xs mt-1 sm:mt-0">
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
                    <tr className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <th scope="col" className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-6 py-4">
                        Role
                      </th>
                      <th scope="col" className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-4 whitespace-nowrap">
                        People
                      </th>
                      {capabilities.map((cap) => (
                        <th
                          key={cap.key}
                          scope="col"
                          className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-4 min-w-[8.5rem]"
                        >
                          <span title={cap.description}>{cap.label}</span>
                          {cap.note && (
                            <span className="block text-[10px] font-medium normal-case tracking-normal text-slate-400/80 mt-1">
                              {cap.note}
                            </span>
                          )}
                        </th>
                      ))}
                      <th scope="col" className="w-12 px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {roles.map((role) => (
                      <tr key={role._id} className="hover:bg-indigo-50/40 transition-colors duration-150 group">
                        <th scope="row" className="text-left px-6 py-4 align-middle font-normal">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{role.name}</span>
                            <ShellChip shell={role.shell} />
                          </div>
                          {role.description && (
                            <p className="text-xs font-medium text-slate-500 mt-1 max-w-sm line-clamp-2">{role.description}</p>
                          )}
                        </th>
                        <td className="px-4 py-4 align-middle whitespace-nowrap">
                          <span className="text-sm font-bold tabular-nums text-slate-800">{role.members}</span>
                          {role.builders > 0 && (
                            <span className="block text-[10px] font-medium text-slate-400 mt-0.5">{role.builders} with a seat</span>
                          )}
                        </td>
                        {capabilities.map((cap) => (
                          <td key={cap.key} className="px-3 py-4 text-center align-middle">
                            <span className="inline-flex justify-center transition-transform duration-200 group-hover:scale-110">
                              <Tick on={role.capabilities.includes(cap.key)} label={`${role.name} — ${cap.label}`} />
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-4 text-right align-middle">
                          <button
                            onClick={() => handleDeleteRole(role._id, role.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete Role"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile / tablet cards */}
                <ul className="lg:hidden divide-y divide-slate-100 bg-white">
                  {roles.map((role) => (
                    <li key={role._id} className="px-5 py-5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-800">{role.name}</p>
                            <ShellChip shell={role.shell} />
                          </div>
                          {role.description && (
                            <p className="text-xs font-medium text-slate-500 mt-1.5">{role.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <button
                            onClick={() => handleDeleteRole(role._id, role.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors -mr-1.5"
                            title="Delete Role"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <div className="text-right mt-1">
                            <p className="text-base font-black tabular-nums text-slate-800">{role.members}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">people</p>
                          </div>
                        </div>
                      </div>
                      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {capabilities.map((cap) => {
                          const on = role.capabilities.includes(cap.key)
                          return (
                            <li
                              key={cap.key}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                                on ? 'bg-emerald-50/50 text-emerald-700' : 'bg-slate-50 text-slate-400'
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

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import EmptyState from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { useWorkflows, workflowsStore } from '../lib/workflowsStore'
import { useDepartmentNames } from '../lib/departmentsStore'
import { useUser } from '../utils/auth'
import { canCreateWorkflow, canEditWorkflow } from '../utils/permissions'
import { confirm } from '../lib/confirmStore'
import { toast } from '../lib/toastStore'
import { categoryBadge } from '../utils/badges'
import { useReadOnly } from '../lib/usageStore'

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

const fieldCls =
  'w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface-2 text-fg placeholder:text-fg-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition'
const selectCls =
  'px-3 py-2 text-sm rounded-lg border border-line bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition'

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-fg-muted">{hint}</p> : null}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function WorkflowGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function IconWorkflow(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 7.5l7 3.5M8.5 16.5l7-3.5" />
    </svg>
  )
}

function StatusBadge({ status, onClick, interactive }) {
  const active = status === 'Active'
  const cls = active
    ? 'bg-success-subtle text-success-fg'
    : 'bg-surface-3 text-fg-muted'
  const base = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`
  if (!interactive) {
    return (
      <span className={base}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-success-fg' : 'bg-fg-subtle'}`} />
        {status}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? 'Deactivate workflow' : 'Activate workflow'}
      className={`${base} hover:brightness-95 transition`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-success-fg' : 'bg-fg-subtle'}`} />
      {status}
    </button>
  )
}

function Workflows() {
  const navigate = useNavigate()
  const workflows = useWorkflows()
  const categories = useDepartmentNames()
  const me = useUser()
  const canCreate = canCreateWorkflow(me)
  const canEdit = canEditWorkflow(me)
  const readOnly = useReadOnly()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [statusFilter, setStatusFilter] = useState('All status')
  const [booting, setBooting] = useState(true)
  useEffect(() => { workflowsStore.refresh().finally(() => setBooting(false)) }, [])

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      const matchesSearch =
        !search.trim() ||
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.description || '').toLowerCase().includes(search.toLowerCase())
      const matchesCat = categoryFilter === 'All categories' || w.category === categoryFilter
      const matchesStatus = statusFilter === 'All status' || w.status === statusFilter
      return matchesSearch && matchesCat && matchesStatus
    })
  }, [workflows, search, categoryFilter, statusFilter])

  const handleToggleStatus = async (w) => {
    if (w.status === 'Active') {
      const ok = await confirm({
        title: 'Deactivate workflow?',
        message: `New submissions won't be routed through "${w.name}" until you activate it again. Runs already in progress continue.`,
        confirmLabel: 'Deactivate',
        danger: true,
      })
      if (!ok) return
    }
    try {
      await workflowsStore.toggleStatus(w.id)
      toast.success(w.status === 'Active' ? 'Workflow deactivated' : 'Workflow activated')
    } catch (err) {
      toast.error(err.message || 'Could not change the workflow status')
    }
  }

  const handleDelete = async (w) => {
    const ok = await confirm({
      title: 'Delete workflow?',
      message: 'This permanently deletes the workflow and its runs and tasks. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await workflowsStore.remove(w.id)
      toast.success('Workflow deleted')
    } catch (err) {
      toast.error(err.message || 'Could not delete workflow')
    }
  }

  const activeCount = workflows.filter((w) => w.status === 'Active').length
  const draftCount = workflows.filter((w) => w.status === 'Draft').length
  const pausedCount = workflows.filter((w) => w.status === 'Paused').length

  const actions = canCreate ? (
    <button
      data-tour="workflows-create"
      onClick={() => navigate('/workflows/new')}
      disabled={readOnly}
      title={readOnly ? 'The workspace licence has expired — new workflows are paused.' : undefined}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      New workflow
    </button>
  ) : null

  return (
    <AppShell
      title="Workflows"
      subtitle="Design approval routes and automation"
      actions={actions}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 w-full">
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total workflows" value={booting && !workflows.length ? '—' : workflows.length} hint="In this workspace" />
          <StatCard
            label="Active"
            value={booting && !workflows.length ? '—' : activeCount}
            hint="Routing submissions live"
          />
          <StatCard
            label="Drafts"
            value={booting && !workflows.length ? '—' : draftCount}
            hint="Not activated yet"
          />
          <StatCard
            label="Paused"
            value={booting && !workflows.length ? '—' : pausedCount}
            hint="Temporarily not routing"
          />
        </div>

        <div data-tour="workflows-list" className="flex-1 min-h-0 flex flex-col bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-line bg-surface-2/40">
            <div className="relative flex-1 min-w-0">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description…"
                aria-label="Search workflows"
                className={fieldCls}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className={selectCls}
              >
                <option>All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className={selectCls}
              >
                <option>All status</option>
                <option>Active</option>
                <option>Paused</option>
                <option>Draft</option>
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {booting && workflows.length === 0 ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-3 w-80 max-w-full" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full hidden sm:block" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full min-h-[16rem] flex items-center justify-center">
                <EmptyState
                  icon={<IconWorkflow className="w-5 h-5" />}
                  title={workflows.length === 0 ? 'No workflows yet' : 'No workflows match'}
                  description={
                    workflows.length === 0
                      ? canCreate
                        ? 'Create a workflow to route form submissions through approvals and automations.'
                        : 'No workflows have been published yet. Ask an Admin or Manager to create one.'
                      : 'Try a different search or clear the filters.'
                  }
                  action={
                    workflows.length === 0 && canCreate ? (
                      <button
                        onClick={() => navigate('/workflows/new')}
                        className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition"
                      >
                        Create workflow
                      </button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <>
                <div className="hidden md:block w-full">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-[8rem]" />
                      <col className="w-[5.5rem]" />
                      <col className="w-[7.5rem]" />
                      <col className="w-[7rem]" />
                      <col className="w-[10rem]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="text-left text-[11px] font-semibold tracking-wider text-fg-subtle uppercase border-b border-line bg-surface-2/95 backdrop-blur-sm">
                        <th scope="col" className="px-5 py-3 font-semibold">Workflow</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">Steps</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Created</th>
                        <th scope="col" className="px-5 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filtered.map((w) => (
                        <tr key={w.id} className="group hover:bg-surface-2/50 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0 ring-1 ring-indigo-100 dark:ring-indigo-500/20">
                                <WorkflowGlyph className="w-[18px] h-[18px]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => canEdit && navigate(`/workflows/${w.id}/edit`)}
                                  className="text-left font-semibold text-fg hover:text-indigo-600 disabled:hover:text-fg transition truncate w-full block"
                                >
                                  {w.name || 'Untitled workflow'}
                                </button>
                                <p className="mt-0.5 text-xs text-fg-muted truncate">
                                  {w.description || 'No description'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${categoryBadge(w.category)}`}>
                              {w.category || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-fg font-medium">{w.steps ?? 0}</td>
                          <td className="px-4 py-3.5">
                            <StatusBadge
                              status={w.status}
                              interactive={canCreate}
                              onClick={() => handleToggleStatus(w)}
                            />
                          </td>
                          <td className="px-4 py-3.5 text-xs text-fg-muted whitespace-nowrap">{formatDate(w.createdAt)}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/workflows/${w.id}/edit`)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition"
                                >
                                  Edit
                                </button>
                              )}
                              {canCreate && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(w)}
                                  title="Delete workflow"
                                  aria-label={`Delete ${w.name}`}
                                  className="w-8 h-8 rounded-lg border border-line text-fg-muted hover:text-danger-fg hover:border-danger-line hover:bg-danger-subtle flex items-center justify-center transition"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                  </svg>
                                </button>
                              )}
                              {!canEdit && !canCreate && <span className="text-xs text-fg-subtle">—</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="md:hidden divide-y divide-line">
                  {filtered.map((w) => (
                    <li key={w.id} className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0">
                          <WorkflowGlyph className="w-[18px] h-[18px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-fg truncate">{w.name || 'Untitled workflow'}</p>
                          <p className="text-xs text-fg-muted line-clamp-2 mt-0.5">
                            {w.description || 'No description'}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {w.category && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${categoryBadge(w.category)}`}>
                                {w.category}
                              </span>
                            )}
                            <StatusBadge
                              status={w.status}
                              interactive={canCreate}
                              onClick={() => handleToggleStatus(w)}
                            />
                            <span className="text-[11px] text-fg-subtle">
                              {w.steps ?? 0} steps · {formatDate(w.createdAt)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => navigate(`/workflows/${w.id}/edit`)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white"
                              >
                                Edit
                              </button>
                            )}
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => handleDelete(w)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-danger-fg"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
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

export default Workflows

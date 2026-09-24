import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { useReadOnly, useUsage } from '../lib/usageStore'
import { useOutsideDismiss } from '../utils/a11y'

function getWorkflowTag(w) {
  try {
    const stored = JSON.parse(localStorage.getItem('netflow_wf_tags') || '{}')
    if (w.id && stored[w.id]) {
      const v = stored[w.id]
      const first = Array.isArray(v) ? v[0] : String(v).trim().split(/[,\s]+/)[0]
      if (first) return first.startsWith('#') ? first : `#${first}`
    }
    if (w._id && stored[w._id]) {
      const v = stored[w._id]
      const first = Array.isArray(v) ? v[0] : String(v).trim().split(/[,\s]+/)[0]
      if (first) return first.startsWith('#') ? first : `#${first}`
    }
    if (w.name && stored[w.name]) {
      const v = stored[w.name]
      const first = Array.isArray(v) ? v[0] : String(v).trim().split(/[,\s]+/)[0]
      if (first) return first.startsWith('#') ? first : `#${first}`
    }
  } catch (e) { }

  const rawTags = w.tags || w.metadata?.tags
  if (rawTags) {
    const first = Array.isArray(rawTags) ? rawTags[0] : String(rawTags).trim().split(/[,\s]+/)[0]
    if (first) return first.startsWith('#') ? first : `#${first}`
  }

  if (w.name === 'Leave Approval Workflow' || w.title === 'Leave Approval Workflow' || w.name === 'Leave Workflow') {
    return 'WT'
  }
  if (w.name === 'Payment Voucher Approval' || w.title === 'Payment Voucher Approval') {
    return 'FIN'
  }
  if (w.category && w.category !== 'General') {
    return w.category
  }
  return null
}

/* ─── Workflow Card Action Dropdown Menu ─────────────────────────────── */
function WorkflowRowMenu({ workflow, canEdit, canCreate, onEdit, onToggleStatus, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutsideDismiss(open, ref, () => setOpen(false))

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
        title="More options"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onEdit()
              }}
              className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 font-medium flex items-center gap-2.5 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Edit workflow
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onToggleStatus()
              }}
              className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 font-medium flex items-center gap-2.5 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {workflow.status === 'Active' ? 'Pause workflow' : 'Activate workflow'}
            </button>
          )}
          {canCreate && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onDelete()
                }}
                className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-medium flex items-center gap-2.5 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6m5 0V4h4v2" /></svg>
                Delete workflow
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Workflow Status Pill Badge ─────────────────────────────────────── */
function WorkflowStatusBadge({ status, onClick, interactive }) {
  const active = status === 'Active'
  const paused = status === 'Paused'

  let cls = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
  let dotColor = 'bg-slate-400'

  if (active) {
    cls = 'bg-[#DCFCE7] text-[#16A34A] dark:bg-emerald-950/60 dark:text-emerald-400'
    dotColor = 'bg-[#16A34A]'
  } else if (paused) {
    cls = 'bg-[#FEF3C7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400'
    dotColor = 'bg-[#D97706]'
  }

  const base = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cls}`

  if (!interactive) {
    return (
      <span className={base}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {status}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      title={active ? 'Pause workflow' : 'Activate workflow'}
      className={`${base} hover:brightness-95 transition cursor-pointer`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
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
  const { usage } = useUsage()
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [statusFilter, setStatusFilter] = useState('All') // 'All' | 'Active' | 'Drafts' | 'Paused'
  const [sortBy, setSortBy] = useState('recently_updated') // 'recently_updated' | 'name' | 'steps'
  const [booting, setBooting] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    workflowsStore.refresh().finally(() => setBooting(false))
  }, [])

  const activeCount = useMemo(() => workflows.filter((w) => w.status === 'Active').length, [workflows])
  const draftCount = useMemo(() => workflows.filter((w) => w.status === 'Draft').length, [workflows])
  const pausedCount = useMemo(() => workflows.filter((w) => w.status === 'Paused').length, [workflows])

  // Plan usage calculation from live organization usage
  const planUsed = usage?.resources?.workflows?.used ?? workflows.length
  const planLimit = usage?.licence?.limits?.maxWorkflows || usage?.resources?.workflows?.limit || 100
  const planRemaining = Math.max(0, planLimit - planUsed)
  const planPct = usage?.resources?.workflows?.percent != null ? usage.resources.workflows.percent : (planLimit > 0 ? Math.round((planUsed / planLimit) * 100) : 0)

  const filtered = useMemo(() => {
    let result = workflows.filter((w) => {
      const q = search.trim().toLowerCase()
      const wfTag = (getWorkflowTag(w) || '').toLowerCase()
      const rawTags = (Array.isArray(w.tags) ? w.tags.join(' ') : String(w.tags || '')).toLowerCase()

      const matchesSearch =
        !q ||
        w.name.toLowerCase().includes(q) ||
        (w.description || '').toLowerCase().includes(q) ||
        wfTag.includes(q) ||
        rawTags.includes(q)

      const matchesCat = categoryFilter === 'All categories' || w.category === categoryFilter

      const t = tagFilter.trim().toLowerCase().replace(/^#/, '')
      const matchesTag = !t || wfTag.replace(/^#/, '').includes(t) || rawTags.replace(/^#/, '').includes(t)

      let matchesStatus = true
      if (statusFilter === 'Active') matchesStatus = w.status === 'Active'
      else if (statusFilter === 'Drafts') matchesStatus = w.status === 'Draft'
      else if (statusFilter === 'Paused') matchesStatus = w.status === 'Paused'

      return matchesSearch && matchesCat && matchesTag && matchesStatus
    })

    if (sortBy === 'recently_updated') {
      result.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    } else if (sortBy === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else if (sortBy === 'steps') {
      result.sort((a, b) => (b.nodes?.length || 0) - (a.nodes?.length || 0))
    }

    return result
  }, [workflows, search, categoryFilter, tagFilter, statusFilter, sortBy])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter, tagFilter, statusFilter, sortBy])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filtered.length)
  const paginatedWorkflows = useMemo(() => {
    return filtered.slice(startIndex, endIndex)
  }, [filtered, startIndex, endIndex])

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
      title: `Delete "${w.name}" workflow?`,
      message: `Are you sure you want to delete "${w.name}"?`,
      confirmLabel: 'Delete workflow',
      danger: true,
    })
    if (!ok) return

    const finalOk = await confirm({
      title: `Final Confirmation: Delete "${w.name}"?`,
      message: `Are you absolutely sure you want to permanently delete "${w.name}"? This action cannot be undone. All associated tasks, configurations, and execution histories will be deleted.`,
      confirmLabel: 'Yes, delete permanently',
      danger: true,
    })
    if (!finalOk) return

    try {
      await workflowsStore.remove(w.id)
      toast.success('Workflow deleted')
    } catch (err) {
      toast.error(err.message || 'Could not delete workflow')
    }
  }

  const tabs = [
    { key: 'All', label: 'All' },
    { key: 'Active', label: 'Active' },
    { key: 'Drafts', label: 'Drafts' },
    { key: 'Paused', label: 'Paused' },
  ]

  const formatUpdatedDate = (w) => {
    const d = new Date(w.updatedAt || w.createdAt || Date.now())
    const day = d.getDate()
    const month = d.toLocaleString('en-US', { month: 'short' })
    const year = d.getFullYear()
    return `Updated ${day} ${month} ${year}`
  }

  return (
    <AppShell
      title="Workflows"
    >
      <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Workflows</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {workflows.length} total · {activeCount} active
            </p>
          </div>
          {canCreate && (
            <button
              data-tour="workflows-create"
              onClick={() => navigate('/workflows/new')}
              disabled={readOnly}
              title={readOnly ? 'The workspace licence has expired — new workflows are paused.' : undefined}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-2xl bg-[#6366F1] hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New workflow
            </button>
          )}
        </div>

        {/* Enterprise Plan Usage Bar Card */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className="bg-[#EEF2FF] dark:bg-indigo-500/15 text-[#6366F1] dark:text-indigo-400 font-bold px-3 py-1 rounded-xl text-[11px]">
              Enterprise plan
            </span>
            <div className="text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white">{planUsed} of {planLimit} workflows used</span>{' '}
              <span className="text-slate-400 dark:text-slate-500">· {planRemaining} workflows left</span>
            </div>
          </div>
          <div className="w-full sm:w-72 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(planPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Search, Tag & Category Filters */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflows..."
              aria-label="Search workflows"
              className="w-full h-10 pl-9 pr-4 text-xs font-medium rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-[#111a2e] text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
            />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Tag Search (#) Input */}
            <div className="relative w-36 sm:w-44">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-indigo-600 dark:text-indigo-400 pointer-events-none select-none">#</span>
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Search #tag..."
                aria-label="Search workflows by tag"
                className="w-full h-10 pl-7.5 pr-7 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-[#111a2e] text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
              />
              {tagFilter && (
                <button
                  type="button"
                  onClick={() => setTagFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-0.5"
                  title="Clear tag filter"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="appearance-none h-10 pl-4.5 pr-9 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-[#111a2e] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition cursor-pointer"
              >
                <option>All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <svg
                className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Minimalist Tab Navigation & Sort Row (Matching Screenshot) */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pt-2 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-6 sm:gap-8">
            {tabs.map((tab) => {
              const isActive = statusFilter === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition relative cursor-pointer ${isActive
                      ? 'text-[#6366F1] dark:text-indigo-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6366F1] dark:bg-indigo-400 rounded-full" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 pb-2.5">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Sort by:</span>
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort workflows"
                className="appearance-none bg-transparent pr-6 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="recently_updated" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">Recently updated</option>
                <option value="name" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">Name (A-Z)</option>
                <option value="steps" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">Most steps</option>
              </select>
              <svg
                className="w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none absolute right-0 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h6.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Workflow Rows / Cards List (Matching Screenshot) */}
        <div data-tour="workflows-list" className="space-y-3.5">
          {booting && workflows.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
                    <div className="space-y-2 flex-1 max-w-md">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-64" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-10 rounded-md" />
                        <Skeleton className="h-5 w-10 rounded-md" />
                        <Skeleton className="h-5 w-14 rounded-md" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 flex flex-col items-end">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-16 flex items-center justify-center shadow-xs">
              <EmptyState
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="12" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 7.5l7 3.5M8.5 16.5l7-3.5" /></svg>}
                title={workflows.length === 0 ? 'No workflows yet' : 'No workflows match'}
                description={
                  workflows.length === 0
                    ? canCreate
                      ? 'Create a workflow to route form submissions through approvals and automations.'
                      : 'No workflows have been created yet.'
                    : 'Try a different search query or filter choice.'
                }
                action={
                  workflows.length === 0 && canCreate ? (
                    <button
                      onClick={() => navigate('/workflows/new')}
                      className="mt-2 px-4.5 py-2.5 rounded-2xl bg-[#134287] hover:bg-[#0f346c] active:bg-[#0c2340] text-white text-xs font-bold shadow-md shadow-blue-900/20 transition cursor-pointer"
                    >
                      New workflow
                    </button>
                  ) : null
                }
              />
            </div>
          ) : (
            <>
              {/* List of Workflow Horizontal Cards */}
              <div className="space-y-3.5">
                {paginatedWorkflows.map((w) => {
                  const tag = getWorkflowTag(w)
                  const category = w.category || w.department || 'IT'
                  const stepsCount = w.steps ?? (w.nodes?.length ? w.nodes.filter(n => n.type !== 'start' && n.type !== 'end').length : 4)
                  const desc = w.description || `Approval flow for ${w.name}${category ? ` (${category})` : ''}.`

                  return (
                    <div
                      key={w.id}
                      onClick={() => canEdit && navigate(`/workflows/${w.id}/edit`)}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                    >
                      {/* Left: Workflow Node Icon + Title + Description + Chips */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="6" cy="6" r="2.5" />
                            <circle cx="18" cy="12" r="2.5" />
                            <circle cx="6" cy="18" r="2.5" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 7.5l7 3.5M8.5 16.5l7-3.5" />
                          </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base group-hover:text-[#6366F1] dark:group-hover:text-indigo-400 transition truncate">
                              {w.name || 'Untitled workflow'}
                            </h2>
                          </div>

                          <p className="text-xs text-slate-400 dark:text-slate-400 mt-1 line-clamp-1 truncate" title={desc}>
                            {desc}
                          </p>

                          {/* Chips: Category / Tag / Steps */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            {category && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {category}
                              </span>
                            )}
                            {tag && tag !== category && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {tag.replace(/^#/, '')}
                              </span>
                            )}
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {stepsCount} Steps
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status Pill Badge + 3-Dot Menu / Updated Date + Chevron */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <WorkflowStatusBadge
                            status={w.status}
                            interactive={canCreate}
                            onClick={() => handleToggleStatus(w)}
                          />
                          <WorkflowRowMenu
                            workflow={w}
                            canEdit={canEdit}
                            canCreate={canCreate}
                            onEdit={() => navigate(`/workflows/${w.id}/edit`)}
                            onToggleStatus={() => handleToggleStatus(w)}
                            onDelete={() => handleDelete(w)}
                          />
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400">
                          <span>{formatUpdatedDate(w)}</span>
                          <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Footer */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length > 0 ? startIndex + 1 : 0}-{endIndex}</span> of <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                    >
                      Prev
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) {
                          acc.push('ellipsis-' + p)
                        }
                        acc.push(p)
                        return acc
                      }, [])
                      .map((item) => {
                        if (typeof item === 'string') {
                          return <span key={item} className="px-1 text-slate-400">...</span>
                        }
                        const isCurrent = item === currentPage
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                            className={`min-w-[30px] h-7.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${isCurrent
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
                              }`}
                          >
                            {item}
                          </button>
                        )
                      })}

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default Workflows


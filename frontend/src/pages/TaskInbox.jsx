import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import AppShell from '../components/AppShell'
import { useTasks, tasksStore, TASK_FILTERS } from '../lib/tasksStore'
import { useUser } from '../utils/auth'
import { canViewTeam, isApprover as isApproverRole } from '../utils/permissions'
import { api } from '../utils/api'
import { adaptTask } from '../utils/adapters'
import { confirm } from '../lib/confirmStore'
import { ListRowSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import { statusBadge } from '../utils/badges'

// The list is grouped by department, so a page-number pager would split groups
// oddly. Progressive "show more" keeps the grouping intact.
const PAGE_SIZE = 15

const SORTS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc',  label: 'Oldest first' },
  { value: 'name_asc',  label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'status',    label: 'Status' }
]

// A request is deletable only once it's finished. Workflow requests use the
// parent execution's status; standalone tasks fall back to their own status.
const FINISHED_EXEC = new Set(['completed', 'failed', 'cancelled'])
const RESOLVED_STATUS = new Set(['Approved', 'Rejected', 'Cancelled'])
const isRequestFinished = (task) =>
  task.executionId ? FINISHED_EXEC.has(task.executionStatus) : RESOLVED_STATUS.has(task.status)

const formatTimeLeft = (minutes) => {
  if (minutes < 0) return null
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m left`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)}h left`
  return `${Math.round(hours / 24)}d left`
}

// Urgency was signalled by colour alone, which colour-blind users can't read.
// Each level now carries its own glyph and wording too.
const slaBadge = (task) => {
  if (task.slaBreached || task.dueInMinutes < 0) {
    return {
      label: 'SLA breached',
      icon: '▲',
      srLabel: 'Overdue: ',
      cls: 'bg-danger-subtle text-danger-fg border-danger-line',
    }
  }
  if (task.dueInMinutes < 6 * 60) {
    return {
      label: `Due soon · ${formatTimeLeft(task.dueInMinutes)}`,
      icon: '●',
      srLabel: 'Due soon: ',
      cls: 'bg-warning-subtle text-warning-fg border-warning-line',
    }
  }
  return {
    label: formatTimeLeft(task.dueInMinutes),
    icon: '○',
    srLabel: 'On track: ',
    cls: 'bg-success-subtle text-success-fg border-success-line',
  }
}

const taskStatusBadge = (status) => {
  if (status === 'Approved' || status === 'Rejected' || status === 'Escalated') {
    return { label: status, cls: statusBadge(status).badge }
  }
  return { label: 'Pending your approval', cls: 'bg-surface-2 text-fg-muted border-line' }
}

function TaskCard({ task, onOpen, onApprove, onReject, busy, canAct, showApprover, canDelete, onDelete, selectable, selected, onToggleSelect }) {
  const sla = slaBadge(task)
  const status = taskStatusBadge(task.status)
  const isResolved = task.status !== 'Pending'

  return (
    <div
      onClick={() => onOpen(task.id)}
      className="flex items-start gap-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer"
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect(task.id)}
          aria-label={`Select ${task.title} for bulk approval`}
          className="mt-2.5 w-4.5 h-4.5 rounded-lg border-slate-300 text-[#6366F1] focus:ring-indigo-400 shrink-0"
        />
      )}
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${task.avatarColor}`}>
        {task.initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
          {task.title}
          <span className="text-slate-400 dark:text-slate-500 font-normal"> · {task.detail}</span>
        </p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
          {showApprover
            ? `With ${task.approver || 'an approver'} · ${task.workflow}`
            : `${task.requester} · ${task.workflow}`}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {sla.label && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-xl border font-bold ${sla.cls}`}>
              <span aria-hidden="true">{sla.icon}</span>
              <span className="sr-only">{sla.srLabel}</span>
              {sla.label}
            </span>
          )}
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-xl border ${status.cls}`}>
            {showApprover && task.status === 'Pending' ? 'Awaiting approval' : status.label}
          </span>
        </div>
      </div>

      {canAct ? (
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isResolved || busy}
            onClick={(e) => {
              e.stopPropagation()
              onApprove(task.id)
            }}
            className={`px-4.5 py-1.5 text-xs font-bold rounded-2xl border transition cursor-pointer ${
              isResolved || busy
                ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                : 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
            }`}
          >
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={isResolved || busy}
            onClick={(e) => {
              e.stopPropagation()
              onReject(task.id)
            }}
            className={`px-4.5 py-1.5 text-xs font-bold rounded-2xl border transition cursor-pointer ${
              isResolved || busy
                ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                : 'border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10'
            }`}
          >
            {busy === 'reject' ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      ) : (
        <div className="shrink-0 self-center flex items-center gap-3">
          {canDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
              disabled={busy === 'delete'}
              aria-label="Delete request"
              title="Delete request"
              className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-700/80 hover:border-rose-200 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40 transition cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(task.id)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            View &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

function TaskInbox() {
  const navigate = useNavigate()
  const tasks = useTasks()
  const me = useUser()
  const isApprover = isApproverRole(me)
  const leadsTeam = canViewTeam(me)
  const meId = me?._id ? String(me._id) : null
  const [searchParams, setSearchParams] = useSearchParams()

  // Approvers default to their approval queue; everyone else to their requests.
  // ?scope=team lets the ops dashboard and Team page deep-link into the tab.
  const [scope, setScope] = useState(() => {
    const wanted = searchParams.get('scope')
    if (wanted === 'team' && leadsTeam) return 'team'
    if (wanted === 'assigned' || wanted === 'submitted') return wanted
    return isApprover ? 'assigned' : 'submitted'
  })
  const [filter, setFilter] = useState(() => {
    const wanted = searchParams.get('filter')
    return TASK_FILTERS.includes(wanted) ? wanted : 'All tasks'
  })
  const [sort, setSort] = useState('date_desc')
  const [query, setQuery] = useState('')
  const [busyMap, setBusyMap] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [teamTasks, setTeamTasks] = useState([])
  const [teamLoading, setTeamLoading] = useState(false)

  useEffect(() => {
    tasksStore.refresh().catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  // The team's work is not in the personal store — it is a different query — so
  // it is fetched on demand the first time the tab is opened.
  const loadTeamTasks = () => {
    setTeamLoading(true)
    return api.get('/api/tasks/my-tasks?scope=team')
      .then((res) => setTeamTasks((res.tasks || []).map(adaptTask).filter(Boolean)))
      .catch((err) => setError(err.message || "Could not load your team's requests"))
      .finally(() => setTeamLoading(false))
  }

  useEffect(() => {
    if (scope !== 'team' || !leadsTeam) return
    loadTeamTasks()
  }, [scope, leadsTeam])

  const refresh = () => (scope === 'team' ? loadTeamTasks() : tasksStore.refresh())

  // Keep the URL honest so the tab survives a refresh or a shared link.
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    if (next.get('scope') !== scope) {
      next.set('scope', scope)
      changed = true
    }
    if (filter !== 'All tasks' && next.get('filter') !== filter) {
      next.set('filter', filter)
      changed = true
    } else if (filter === 'All tasks' && next.has('filter')) {
      next.delete('filter')
      changed = true
    }
    if (changed) {
      setSearchParams(next, { replace: true })
    }
  }, [scope, filter])

  // Sync state if URL query params change externally
  useEffect(() => {
    const wantedScope = searchParams.get('scope')
    if (wantedScope && (wantedScope === 'submitted' || wantedScope === 'assigned' || wantedScope === 'team')) {
      setScope(wantedScope)
    }
    const wantedFilter = searchParams.get('filter')
    if (wantedFilter && TASK_FILTERS.includes(wantedFilter)) {
      setFilter(wantedFilter)
    }
  }, [searchParams])

  const openTask = (id) => navigate(`/tasks/${id}`)

  const handleAction = async (id, action) => {
    if (action === 'reject') {
      const ok = await confirm({
        title: 'Reject this request?',
        message: 'The requester is notified straight away. Open the request instead if you want to add a reason.',
        confirmLabel: 'Reject',
        danger: true,
      })
      if (!ok) return
    }
    setBusyMap((m) => ({ ...m, [id]: action }))
    setError('')
    try {
      if (action === 'approve') await tasksStore.approve(id)
      else await tasksStore.reject(id)
      await tasksStore.refresh()
    } catch (err) {
      setError(err.message || 'Action failed')
    } finally {
      setBusyMap((m) => {
        const next = { ...m }
        delete next[id]
        return next
      })
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete request?',
      message: 'Permanently delete this request and its history? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setBusyMap((m) => ({ ...m, [id]: 'delete' }))
    setError('')
    try {
      await tasksStore.deleteRequest(id)
    } catch (err) {
      setError(err.message || 'Delete failed')
    } finally {
      setBusyMap((m) => {
        const next = { ...m }
        delete next[id]
        return next
      })
    }
  }

  // Scope first (assigned to me / submitted by me / my team's), then the status
  // filter. The team scope comes from its own request, the other two are slices
  // of the personal store.
  const scoped = useMemo(() => {
    if (scope === 'team') return teamTasks
    if (!meId) return tasks
    const list = tasks.filter((t) =>
      scope === 'assigned'
        ? String(t.assignedToId) === meId
        : String(t.submittedById) === meId
    )
    // Employees' "My requests" are ordered by submission date/time, newest first.
    if (scope === 'submitted') {
      const sortedList = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      const execMap = new Map()
      for (const t of sortedList) {
        if (!t.executionId) {
          execMap.set(t.id, t)
          continue
        }
        if (!execMap.has(t.executionId)) {
          execMap.set(t.executionId, t)
        }
      }
      return Array.from(execMap.values())
    }
    return list
  }, [tasks, teamTasks, scope, meId])

  const byFilter = useMemo(() => {
    switch (filter) {
      case 'Pending':      return scoped.filter((t) => t.status === 'Pending')
      case 'SLA breached': return scoped.filter((t) => t.slaBreached || t.status === 'Escalated' || t.dueInMinutes < 0)
      case 'Approved':     return scoped.filter((t) => t.status === 'Approved')
      case 'Rejected':     return scoped.filter((t) => t.status === 'Rejected')
      default:             return scoped
    }
  }, [scoped, filter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return byFilter
    return byFilter.filter((t) =>
      [t.title, t.detail, t.requester, t.approver, t.workflow, t.department]
        .some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [byFilter, query])

  useEffect(() => { setCurrentPage(1) }, [query, filter, scope, sort])

  // Sort the visible tasks (flat list, no department grouping)
  const sortedAllTasks = useMemo(() => {
    const byDate = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    const byName = (a, b) => (a.title || '').localeCompare(b.title || '')
    const sortItems = (arr) => {
      const copy = [...arr]
      switch (sort) {
        case 'date_asc':  return copy.sort(byDate)
        case 'name_asc':  return copy.sort(byName)
        case 'name_desc': return copy.sort((a, b) => byName(b, a))
        case 'status':    return copy.sort((a, b) => (a.status || '').localeCompare(b.status || '') || byDate(b, a))
        default:          return copy.sort((a, b) => byDate(b, a)) // date_desc — newest first
      }
    }
    return sortItems(filtered)
  }, [filtered, sort])

  const totalPages = Math.ceil(sortedAllTasks.length / PAGE_SIZE) || 1
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, sortedAllTasks.length)
  const sortedTasks = useMemo(() => sortedAllTasks.slice(startIndex, endIndex), [sortedAllTasks, startIndex, endIndex])

  // Bulk approve only ever touches rows the user can actually act on.
  const bulkEligible = useMemo(
    () =>
      scope === 'assigned'
        ? filtered.filter((t) => t.status === 'Pending' && String(t.assignedToId) === meId)
        : [],
    [filtered, scope, meId]
  )
  const eligibleIds = useMemo(() => new Set(bulkEligible.map((t) => t.id)), [bulkEligible])
  const selected = useMemo(() => selectedIds.filter((id) => eligibleIds.has(id)), [selectedIds, eligibleIds])

  useEffect(() => { setSelectedIds([]) }, [scope, filter, query])

  const toggleSelect = (id) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const handleBulkApprove = async () => {
    if (selected.length === 0) return
    const ok = await confirm({
      title: `Approve ${selected.length} ${selected.length === 1 ? 'task' : 'tasks'}?`,
      message: 'Each one is approved without a comment. Open a task individually if you need to add one.',
      confirmLabel: `Approve ${selected.length}`,
    })
    if (!ok) return
    setBulkBusy(true)
    setError('')
    const failures = []
    for (const id of selected) {
      try {
        await tasksStore.approve(id)
      } catch (err) {
        failures.push(err.message || 'Unknown error')
      }
    }
    await tasksStore.refresh().catch(() => {})
    setSelectedIds([])
    setBulkBusy(false)
    if (failures.length) {
      setError(
        `${selected.length - failures.length} of ${selected.length} approved. ${failures.length} failed: ${failures[0]}`
      )
    }
  }

  const tabs = [
    { key: 'submitted', label: 'My requests' },
    { key: 'assigned', label: 'Assigned to me' },
    ...(leadsTeam ? [{ key: 'team', label: 'My team' }] : [])
  ]

  // "My requests" tab shows things you submitted (requests); "Assigned to me"
  // shows approvals routed to you (tasks); "My team" shows what the people you
  // lead have in flight. Title + counts follow the active tab.
  const onRequests = scope === 'submitted'
  const onTeam = scope === 'team'
  const itemNoun = onRequests || onTeam ? 'request' : 'task'

  const actions = (
    <>
      <label className="sr-only" htmlFor="task-search">Search {itemNoun}s</label>
      <input
        id="task-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${itemNoun}s…`}
        className="text-sm px-3 py-1.5 w-44 lg:w-56 rounded-md border border-line bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
      />
      <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setScope(t.key)}
            className={`text-sm px-3 py-1 rounded transition ${
              scope === t.key
                ? 'bg-indigo-600 text-white'
                : 'text-fg-muted hover:bg-surface-2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="text-sm px-3 py-1.5 rounded-md border border-line bg-surface text-fg hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
      >
        {TASK_FILTERS.map((f) => <option key={f}>{f}</option>)}
      </select>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        aria-label="Sort requests"
        className="text-sm px-3 py-1.5 rounded-md border border-line bg-surface text-fg hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
      >
        {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <button
        type="button"
        onClick={refresh}
        className="text-sm px-3 py-1.5 rounded-md border border-line bg-surface text-fg hover:bg-surface-2 transition"
        title="Refresh"
      >
        Refresh
      </button>
    </>
  )

  return (
    <AppShell
      title={<span className="whitespace-nowrap">{onTeam ? "My team's requests" : onRequests ? 'My requests' : 'Task inbox'}</span>}
      subtitle={
        query.trim()
          ? `${filtered.length} of ${byFilter.length} ${itemNoun}s match`
          : `${filtered.length} ${filtered.length === 1 ? itemNoun : itemNoun + 's'} shown`
      }
      actions={actions}
    >
      {error && <AlertBanner className="mb-4">{error}</AlertBanner>}

      {bulkEligible.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg border border-line bg-surface">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={selected.length === bulkEligible.length && bulkEligible.length > 0}
              onChange={(e) => setSelectedIds(e.target.checked ? bulkEligible.map((t) => t.id) : [])}
              className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
            />
            Select all {bulkEligible.length} pending
          </label>
          <span className="text-sm text-fg-muted">
            {selected.length > 0 ? `${selected.length} selected` : 'Nothing selected'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-sm px-3 py-1.5 rounded-md border border-line text-fg hover:bg-surface-2 transition"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={selected.length === 0 || bulkBusy}
              className="text-sm px-3 py-1.5 rounded-md bg-success-solid text-white font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition"
            >
              {bulkBusy ? 'Approving…' : `Approve ${selected.length || ''}`.trim()}
            </button>
          </div>
        </div>
      )}

          {(loading && tasks.length === 0) || (onTeam && teamLoading && teamTasks.length === 0) ? (
            <div className="bg-surface border border-line rounded-lg divide-y divide-line">
              {Array.from({ length: 6 }).map((_, i) => <ListRowSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-surface border border-dashed border-line rounded-lg py-16">
              {query.trim() ? (
                <EmptyState
                  title={`Nothing matches “${query.trim()}”`}
                  description="Try a shorter search term, or clear it to see everything."
                  action={
                    <button
                      onClick={() => setQuery('')}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Clear search
                    </button>
                  }
                />
              ) : filter !== 'All tasks' ? (
                <EmptyState
                  title="Nothing matches this filter"
                  description="Try a different filter to see more."
                  action={
                    <button
                      onClick={() => setFilter('All tasks')}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Show all
                    </button>
                  }
                />
              ) : onTeam ? (
                <EmptyState
                  title="Nothing from your team"
                  description="Requests raised by the people who report to you show up here while they move through approvals."
                />
              ) : scope === 'submitted' ? (
                <EmptyState
                  title="No requests yet"
                  description="You haven't submitted any requests yet. Fill out a form to get started."
                  action={
                    <button
                      onClick={() => navigate('/forms')}
                      className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
                    >
                      Browse forms
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="You're all caught up"
                  description="Nothing is waiting on your approval right now."
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={openTask}
                  onApprove={(id) => handleAction(id, 'approve')}
                  onReject={(id) => handleAction(id, 'reject')}
                  busy={busyMap[task.id]}
                  canAct={scope === 'assigned' && String(task.assignedToId) === meId}
                  showApprover={scope !== 'assigned'}
                  canDelete={scope === 'submitted'}
                  onDelete={handleDelete}
                  selectable={bulkEligible.length > 1 && eligibleIds.has(task.id)}
                  selected={selected.includes(task.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}

              {totalPages > 1 && (
                <div className="flex justify-end items-center gap-1.5 mt-8 mb-4">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition"
                  >
                    Prev
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .reduce((acc, p) => {
                      if (
                        p === 1 || p === totalPages ||
                        (p >= currentPage - 1 && p <= currentPage + 1)
                      ) {
                        acc.push(p)
                      } else if (acc[acc.length - 1] !== '...') {
                        acc.push('...')
                      }
                      return acc
                    }, [])
                    .map((item, idx) => {
                      if (typeof item === 'string') {
                        return <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">...</span>
                      }
                      const isCurrent = item === currentPage
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    })}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
    </AppShell>
  )
}

export default TaskInbox

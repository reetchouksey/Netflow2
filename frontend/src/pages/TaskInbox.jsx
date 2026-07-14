// M3 - Phase 2 - TaskInbox.jsx - Live tasks from GET /api/tasks/my-tasks

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useTasks, tasksStore, TASK_FILTERS } from '../lib/tasksStore'
import { useUser } from '../utils/auth'
import { confirm } from '../lib/confirmStore'
import { ListRowSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const APPROVER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

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

const slaBadge = (task) => {
  if (task.slaBreached || task.dueInMinutes < 0) {
    return { label: 'SLA breached', cls: 'bg-red-50 text-red-600 border-red-200' }
  }
  if (task.dueInMinutes < 6 * 60) {
    return { label: formatTimeLeft(task.dueInMinutes), cls: 'bg-orange-50 text-orange-600 border-orange-200' }
  }
  return { label: formatTimeLeft(task.dueInMinutes), cls: 'bg-green-50 text-green-700 border-green-200' }
}

const statusBadge = (status) => {
  switch (status) {
    case 'Approved':
      return { label: 'Approved', cls: 'bg-green-50 text-green-700 border-green-200' }
    case 'Rejected':
      return { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-200' }
    case 'Escalated':
      return { label: 'Escalated', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
    default:
      return { label: 'Pending your approval', cls: 'bg-surface-2 text-fg-muted border-line' }
  }
}

function TaskCard({ task, onOpen, onApprove, onReject, busy, canAct, showApprover, canDelete, onDelete }) {
  const sla = slaBadge(task)
  const status = statusBadge(task.status)
  const isResolved = task.status !== 'Pending'

  return (
    <div
      onClick={() => onOpen(task.id)}
      className="flex items-start gap-4 px-5 py-4 bg-surface rounded-lg border border-line hover:border-indigo-300 hover:shadow-sm transition cursor-pointer"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${task.avatarColor}`}>
        {task.initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-fg truncate">
          {task.title}
          <span className="text-fg-subtle font-normal"> · {task.detail}</span>
        </p>
        <p className="text-xs text-fg-muted mt-0.5">
          {showApprover
            ? `With ${task.approver || 'an approver'} · ${task.workflow}`
            : `${task.requester} · ${task.workflow}`}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {sla.label && (
            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${sla.cls}`}>
              {sla.label}
            </span>
          )}
          <span className={`text-[11px] px-2 py-0.5 rounded-md border ${status.cls}`}>
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
            className={`px-4 py-1 text-xs font-medium rounded-md border transition ${
              isResolved || busy
                ? 'border-line text-fg-subtle cursor-not-allowed'
                : 'border-green-200 text-green-700 hover:bg-green-50'
            }`}
          >
            {busy === 'approve' ? '...' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={isResolved || busy}
            onClick={(e) => {
              e.stopPropagation()
              onReject(task.id)
            }}
            className={`px-4 py-1 text-xs font-medium rounded-md border transition ${
              isResolved || busy
                ? 'border-line text-fg-subtle cursor-not-allowed'
                : 'border-red-200 text-red-600 hover:bg-red-50'
            }`}
          >
            {busy === 'reject' ? '...' : 'Reject'}
          </button>
        </div>
      ) : (
        <div className="shrink-0 self-center flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
              disabled={busy === 'delete'}
              aria-label="Delete request"
              title="Delete request"
              className="p-1 rounded-md text-fg-subtle hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-1 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7m3 4v6m4-6v6" />
              </svg>
            </button>
          )}
          <span className="text-xs text-fg-subtle">View →</span>
        </div>
      )}
    </div>
  )
}

function TaskInbox() {
  const navigate = useNavigate()
  const tasks = useTasks()
  const me = useUser()
  const isApprover = APPROVER_ROLES.has(me?.role?.name)
  const meId = me?._id ? String(me._id) : null

  // Approvers default to their approval queue; everyone else to their requests.
  const [scope, setScope] = useState(isApprover ? 'assigned' : 'submitted')
  const [filter, setFilter] = useState('All tasks')
  const [sort, setSort] = useState('date_desc')
  const [busyMap, setBusyMap] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setScope(isApprover ? 'assigned' : 'submitted')
  }, [isApprover])

  useEffect(() => {
    tasksStore.refresh().catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const openTask = (id) => navigate(`/tasks/${id}`)

  const handleAction = async (id, action) => {
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

  // Scope first (assigned to me vs submitted by me), then the status filter.
  const scoped = useMemo(() => {
    if (!meId) return tasks
    const list = tasks.filter((t) =>
      scope === 'assigned'
        ? String(t.assignedToId) === meId
        : String(t.submittedById) === meId
    )
    // Employees' "My requests" are ordered by submission date/time, newest first.
    if (scope === 'submitted') {
      return [...list].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )
    }
    return list
  }, [tasks, scope, meId])

  const filtered = useMemo(() => {
    switch (filter) {
      case 'Pending':      return scoped.filter((t) => t.status === 'Pending')
      case 'SLA breached': return scoped.filter((t) => t.slaBreached || t.status === 'Escalated' || t.dueInMinutes < 0)
      case 'Approved':     return scoped.filter((t) => t.status === 'Approved')
      case 'Rejected':     return scoped.filter((t) => t.status === 'Rejected')
      default:             return scoped
    }
  }, [scoped, filter])

  // Group the visible tasks by department, departments sorted alphabetically,
  // and within each department by submission date/time (newest first).
  const groups = useMemo(() => {
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

    const byDept = new Map()
    for (const t of filtered) {
      const dept = t.department || 'General'
      if (!byDept.has(dept)) byDept.set(dept, [])
      byDept.get(dept).push(t)
    }
    return [...byDept.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([department, items]) => ({ department, items: sortItems(items) }))
  }, [filtered, sort])

  const tabs = [
    { key: 'submitted', label: 'My requests' },
    { key: 'assigned', label: 'Assigned to me' }
  ]

  // "My requests" tab shows things you submitted (requests); "Assigned to me"
  // shows approvals routed to you (tasks). Title + counts follow the active tab.
  const onRequests = scope === 'submitted'
  const itemNoun = onRequests ? 'request' : 'task'

  const actions = (
    <>
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
        onClick={() => tasksStore.refresh()}
        className="text-sm px-3 py-1.5 rounded-md border border-line bg-surface text-fg hover:bg-surface-2 transition"
        title="Refresh"
      >
        Refresh
      </button>
    </>
  )

  return (
    <AppShell
      title={onRequests ? 'My requests' : 'Task inbox'}
      subtitle={`${filtered.length} ${filtered.length === 1 ? itemNoun : itemNoun + 's'} shown`}
      actions={actions}
    >
      {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && tasks.length === 0 ? (
            <div className="bg-surface border border-line rounded-lg divide-y divide-line">
              {Array.from({ length: 6 }).map((_, i) => <ListRowSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-surface border border-dashed border-line rounded-lg py-16">
              {filter !== 'All tasks' ? (
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
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.department}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <h2 className="text-xs font-semibold tracking-wider text-fg-muted uppercase">
                      {group.department}
                    </h2>
                    <span className="text-[11px] font-medium text-fg-subtle bg-surface-3 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {group.items.length}
                    </span>
                    <div className="flex-1 h-px bg-surface-3" />
                  </div>
                  <div className="space-y-3">
                    {group.items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onOpen={openTask}
                        onApprove={(id) => handleAction(id, 'approve')}
                        onReject={(id) => handleAction(id, 'reject')}
                        busy={busyMap[task.id]}
                        canAct={scope === 'assigned' && String(task.assignedToId) === meId}
                        showApprover={scope === 'submitted'}
                        canDelete={scope === 'submitted' && String(task.submittedById) === meId && isRequestFinished(task)}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
    </AppShell>
  )
}

export default TaskInbox

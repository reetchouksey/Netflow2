// M3 - Phase 2 - TaskInbox.jsx - Live tasks from GET /api/tasks/my-tasks

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useTasks, tasksStore, TASK_FILTERS } from '../lib/tasksStore'
import { useUser } from '../utils/auth'

const APPROVER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

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
      return { label: 'Pending your approval', cls: 'bg-gray-50 text-gray-600 border-gray-200' }
  }
}

function TaskCard({ task, onOpen, onApprove, onReject, busy, canAct, showApprover }) {
  const sla = slaBadge(task)
  const status = statusBadge(task.status)
  const isResolved = task.status !== 'Pending'

  return (
    <div
      onClick={() => onOpen(task.id)}
      className="flex items-start gap-4 px-5 py-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition cursor-pointer"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${task.avatarColor}`}>
        {task.initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {task.title}
          <span className="text-gray-400 font-normal"> · {task.detail}</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
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
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
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
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-red-200 text-red-600 hover:bg-red-50'
            }`}
          >
            {busy === 'reject' ? '...' : 'Reject'}
          </button>
        </div>
      ) : (
        <div className="shrink-0 self-center">
          <span className="text-xs text-gray-400">View →</span>
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
    const byDept = new Map()
    for (const t of filtered) {
      const dept = t.department || 'General'
      if (!byDept.has(dept)) byDept.set(dept, [])
      byDept.get(dept).push(t)
    }
    return [...byDept.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([department, items]) => ({
        department,
        items: [...items].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
      }))
  }, [filtered])

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
      <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setScope(t.key)}
            className={`text-sm px-3 py-1 rounded transition ${
              scope === t.key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="text-sm px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
      >
        {TASK_FILTERS.map((f) => <option key={f}>{f}</option>)}
      </select>
      <button
        type="button"
        onClick={() => tasksStore.refresh()}
        className="text-sm px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
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
            <div className="bg-white border border-dashed border-gray-200 rounded-lg py-16 text-center">
              <p className="text-sm text-gray-500">Loading {onRequests ? 'requests' : 'tasks'}...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-lg py-16 text-center">
              <p className="text-sm text-gray-500">
                {scope === 'submitted'
                  ? 'You have not submitted any requests yet. Fill a form to get started.'
                  : 'Nothing assigned to you matches this filter.'}
              </p>
              {filter !== 'All tasks' && (
                <button
                  onClick={() => setFilter('All tasks')}
                  className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Show all
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.department}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                      {group.department}
                    </h2>
                    <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {group.items.length}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
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

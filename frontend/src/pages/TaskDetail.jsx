// M3 - Phase 2 - TaskDetail.jsx - Live task + approve/reject/request-changes

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { tasksStore, useTask } from '../lib/tasksStore'
import { useUser } from '../utils/auth'
import { toAbsoluteUrl } from '../utils/api'

const APPROVER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

const statusPill = (status) => {
  switch (status) {
    case 'Approved':  return { label: 'Approved',  cls: 'text-green-600' }
    case 'Rejected':  return { label: 'Rejected',  cls: 'text-red-600' }
    case 'Escalated': return { label: 'Escalated', cls: 'text-orange-600' }
    default:          return { label: 'Pending',   cls: 'text-orange-500' }
  }
}

function SubmissionDetails({ task }) {
  const pill = statusPill(task.status)
  return (
    <section className="bg-white border border-gray-200 rounded-lg px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Submission details</h2>
        <span className={`text-xs font-medium ${pill.cls}`}>{pill.label}</span>
      </div>
      {task.submission.length === 0 ? (
        <p className="text-sm text-gray-400">No form data attached.</p>
      ) : (
        <dl className="divide-y divide-gray-100">
          {task.submission.map((row, i) => (
            <div key={`${row.label}-${i}`} className="grid grid-cols-3 gap-4 py-2.5">
              <dt className="text-sm text-gray-500">{row.label}</dt>
              <dd className="col-span-2 text-sm text-gray-800 font-medium break-words">
                {row.href ? (
                  <a
                    href={toAbsoluteUrl(row.href)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 underline"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {row.value || 'Download'}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function ApprovalActions({ task, onAction, commentRef, busy, error }) {
  const [comment, setComment] = useState('')
  const isResolved = task.status !== 'Pending'

  const submit = (action) => {
    onAction(action, comment)
    setComment('')
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Approval actions</h2>

      <textarea
        ref={commentRef}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment..."
        rows={2}
        disabled={isResolved || !!busy}
        className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition resize-none disabled:bg-gray-50 disabled:text-gray-400"
      />

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3 mt-3">
        <button
          type="button"
          disabled={isResolved || !!busy}
          onClick={() => submit('approve')}
          className="px-4 py-2 rounded-md border border-green-200 bg-green-50/40 text-green-700 hover:bg-green-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          type="button"
          disabled={isResolved || !!busy}
          onClick={() => submit('reject')}
          className="px-4 py-2 rounded-md border border-red-200 bg-red-50/40 text-red-600 hover:bg-red-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
        <button
          type="button"
          disabled={isResolved || !!busy}
          onClick={() => submit('changes')}
          className="px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'changes' ? 'Sending...' : 'Request changes'}
        </button>
      </div>

      {isResolved && (
        <p className="mt-3 text-xs text-gray-400">
          This task is {task.status.toLowerCase()} — no further action needed.
        </p>
      )}
    </section>
  )
}

const STAGE_META = {
  approved:  { dot: 'bg-green-500',  text: 'text-green-600',  label: 'Approved' },
  rejected:  { dot: 'bg-red-500',    text: 'text-red-600',    label: 'Rejected' },
  escalated: { dot: 'bg-orange-500', text: 'text-orange-600', label: 'Escalated' },
  pending:   { dot: 'bg-blue-500',   text: 'text-blue-600',   label: 'Awaiting approval' },
  upcoming:  { dot: 'bg-gray-300',   text: 'text-gray-400',   label: 'Not started' }
}

function ApprovalChain({ task }) {
  const chain = task.approvalChain || []
  const summary = task.approvalSummary
  if (chain.length === 0) return null

  const stageLine = (s) => {
    if (s.status === 'approved' || s.status === 'rejected' || s.status === 'escalated') {
      const verb = STAGE_META[s.status].label
      return `${verb} by ${s.decidedBy || s.assignee || '—'}`
    }
    if (s.status === 'pending') {
      return `Awaiting ${s.assignee || s.roleLabel || 'approver'}`
    }
    return s.roleLabel ? `${s.roleLabel} (auto-assigned)` : 'Waiting for the previous step'
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800">Approval chain</h2>
        {summary && (
          <span className="text-xs font-medium text-gray-500">
            {summary.approved} of {summary.required} approved
          </span>
        )}
      </div>
      <ol className="relative">
        {chain.map((s, i) => {
          const meta = STAGE_META[s.status] || STAGE_META.upcoming
          const isLast = i === chain.length - 1
          return (
            <li key={s.nodeId} className="relative pl-6 pb-4 last:pb-0">
              {!isLast && (
                <span className="absolute left-[5px] top-3.5 bottom-0 w-px bg-gray-200" />
              )}
              <span
                className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full ${meta.dot} ${
                  s.isCurrent ? 'ring-2 ring-blue-200' : ''
                }`}
              />
              <div className="leading-tight">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">
                    {s.title}
                    {s.isCurrent && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                        current
                      </span>
                    )}
                  </p>
                  <span className={`text-[11px] font-medium shrink-0 ${meta.text}`}>{meta.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{stageLine(s)}</p>
                {s.decidedAt && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.decidedAt}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function ApprovalHistory({ task }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg px-5 py-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Approval history</h2>
      {task.history.length === 0 ? (
        <p className="text-sm text-gray-400">No history yet.</p>
      ) : (
        <ul className="space-y-3">
          {task.history.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${step.dotColor}`} />
              <div className="leading-tight">
                <p className="text-sm text-gray-800">{step.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{step.time}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SlaStatus({ task }) {
  const { totalHours = 24, assignedHoursAgo = 0 } = task.sla || {}
  const remaining = totalHours - assignedHoursAgo
  const pct = Math.max(0, Math.min(100, (assignedHoursAgo / totalHours) * 100))
  const breached = remaining < 0 || task.slaBreached

  const remainingLabel = breached
    ? `${Math.abs(Math.round(remaining))} hours overdue`
    : `${Math.round(remaining)} hours remaining`

  const barColor = breached
    ? 'bg-red-500'
    : pct >= 75
    ? 'bg-orange-500'
    : 'bg-green-500'

  return (
    <section className="bg-white border border-gray-200 rounded-lg px-5 py-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">SLA status</h2>
      <p className={`text-sm font-medium ${breached ? 'text-red-600' : 'text-gray-800'}`}>
        {remainingLabel}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.max(0, pct)}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Assigned {assignedHoursAgo}h ago · {totalHours}h SLA
      </p>
    </section>
  )
}

function TaskDetail() {
  const { id } = useParams()
  const task = useTask(id)
  const me = useUser()
  const navigate = useNavigate()
  const commentRef = useRef(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      tasksStore.loadOne(id)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id])

  const pageTitle = useMemo(() => {
    if (!task) return ''
    return `${task.subject} — ${task.requester}`
  }, [task])

  if (loading && !task) {
    return (
      <AppShell title="Loading task…" back={{ to: '/tasks', label: 'Back to inbox' }}>
        <p className="text-sm text-gray-500">Please wait while we fetch this task.</p>
      </AppShell>
    )
  }

  if (!task) {
    return (
      <AppShell title="Task unavailable" back={{ to: '/tasks', label: 'Back to inbox' }}>
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center max-w-md mx-auto">
          <p className="text-sm text-gray-500">{error || 'Task not found.'}</p>
          <Link to="/tasks" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Back to inbox
          </Link>
        </div>
      </AppShell>
    )
  }

  const handleAction = async (action, comment) => {
    setBusy(action)
    setError('')
    try {
      if (action === 'approve')  await tasksStore.approve(task.id, comment)
      if (action === 'reject')   await tasksStore.reject(task.id, comment)
      if (action === 'changes')  await tasksStore.requestChanges(task.id, comment)
      if (action !== 'changes') {
        setTimeout(() => navigate('/tasks'), 600)
      }
    } catch (err) {
      setError(err.message || 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const focusComment = () => {
    commentRef.current?.focus()
    commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Only the assignee (or an elevated approver) can act — matches the backend.
  const meId = me?._id ? String(me._id) : null
  const isAssignee = meId && String(task.assignedToId) === meId
  const canAct = isAssignee || APPROVER_ROLES.has(me?.role?.name)

  return (
    <AppShell
      title={pageTitle}
      back={{ to: '/tasks', label: 'Back to inbox' }}
      actions={
        <button
          onClick={focusComment}
          className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
        >
          Comment
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-0">
          <SubmissionDetails task={task} />
          {canAct ? (
            <ApprovalActions
              task={task}
              onAction={handleAction}
              commentRef={commentRef}
              busy={busy}
              error={error}
            />
          ) : (
            <section className="bg-white border border-gray-200 rounded-lg px-6 py-5 mt-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Your request</h2>
              <p className="text-sm text-gray-500">
                {task.status === 'Pending'
                  ? `This request is awaiting approval${task.approver ? ` from ${task.approver}` : ''}. You'll be notified when there's an update.`
                  : `This request has been ${task.status.toLowerCase()}.`}
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <ApprovalChain task={task} />
          <ApprovalHistory task={task} />
          <SlaStatus task={task} />
        </aside>
      </div>
    </AppShell>
  )
}

export default TaskDetail

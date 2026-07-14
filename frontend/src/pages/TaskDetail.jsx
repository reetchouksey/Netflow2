// M3 - Phase 2 - TaskDetail.jsx - Live task + approve/reject/request-changes

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { tasksStore, useTask } from '../lib/tasksStore'
import { useUser } from '../utils/auth'
import { toAbsoluteUrl } from '../utils/api'
import { SignaturePad, SignatureMark, FieldRow, validateFields, FieldValueView, isFieldVisible, stripHiddenValues } from '../components/FormFields'
import { confirm } from '../lib/confirmStore'

const APPROVER_ROLES = new Set(['Admin', 'CEO', 'Manager', 'HR', 'VP'])

const statusPill = (status) => {
  switch (status) {
    case 'Approved':  return { label: 'Approved',  cls: 'text-green-600' }
    case 'Rejected':  return { label: 'Rejected',  cls: 'text-red-600' }
    case 'Escalated': return { label: 'Escalated', cls: 'text-orange-600' }
    default:          return { label: 'Awaiting approval', cls: 'text-blue-600' }
  }
}

// The submission/request status reflects the WHOLE approval chain, not the
// single stage being viewed. A request is only "Approved" once EVERY required
// stage is approved; while any stage is still pending/escalated it's awaiting
// approval, and any rejection makes the whole request "Rejected".
const requestStatus = (task) => {
  const chain = task.approvalChain || []
  const summary = task.approvalSummary

  // Any rejection (in the chain or on this task) rejects the whole request.
  if (task.status === 'Rejected' || chain.some((s) => s.status === 'rejected')) return 'Rejected'

  // Prefer the "X of Y approved" summary — the most reliable completeness signal
  // ("1 of 2 approved" must read as awaiting, not approved).
  if (summary && Number(summary.required) > 0) {
    return Number(summary.approved) >= Number(summary.required) ? 'Approved' : 'Pending'
  }

  // Fallbacks when no summary is attached.
  if (chain.length > 0) return chain.every((s) => s.status === 'approved') ? 'Approved' : 'Pending'
  return task.status
}

// Read-only render of a submitted grid/table value (columns + rows).
function GridValueTable({ grid }) {
  const cols = grid?.columns || []
  const rows = Array.isArray(grid?.rows) ? grid.rows : []
  if (cols.length === 0) return <span className="text-fg-subtle">—</span>
  return (
    <div className="overflow-x-auto border border-line rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-2">
            {cols.map((c) => (
              <th key={c.id} className="px-2 py-1.5 text-left font-medium text-fg-muted border-b border-line whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-2 py-2 text-center text-xs text-fg-subtle">No rows</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.id} className="px-2 py-1.5 border-b border-line text-fg align-top">
                    {r?.[c.id] === undefined || r?.[c.id] === '' ? '—' : String(r[c.id])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function SubmissionDetails({ task }) {
  const pill = statusPill(requestStatus(task))
  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-fg">Submission details</h2>
        <span className={`text-xs font-medium ${pill.cls}`}>{pill.label}</span>
      </div>
      {task.submission.length === 0 ? (
        <p className="text-sm text-fg-subtle">No form data attached.</p>
      ) : (
        <dl className="divide-y divide-line">
          {task.submission.map((row, i) => (
            <div key={`${row.label}-${i}`} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2.5">
              <dt className="text-sm text-fg-muted">{row.label}</dt>
              <dd className="sm:col-span-2 text-sm text-fg font-medium break-words">
                {row.grid ? (
                  <GridValueTable grid={row.grid} />
                ) : row.href ? (
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
  const [signature, setSignature] = useState(null)
  const [localErr, setLocalErr] = useState('')
  const isResolved = task.status !== 'Pending'
  const needsSig = !!task.requireSignature

  const submit = (action) => {
    if (needsSig && !signature) {
      setLocalErr('Please add your e-signature before continuing.')
      return
    }
    setLocalErr('')
    onAction(action, comment, signature)
    setComment('')
  }

  const blocked = isResolved || !!busy || (needsSig && !signature)

  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Approval actions</h2>

      <textarea
        ref={commentRef}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment..."
        rows={2}
        disabled={isResolved || !!busy}
        className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition resize-none disabled:bg-surface-2 disabled:text-fg-subtle"
      />

      {needsSig && (
        <div className="mt-3">
          <SignaturePad
            onChange={setSignature}
            disabled={isResolved || !!busy}
            label={<>E-signature <span className="text-red-500">*</span></>}
          />
        </div>
      )}

      {(error || localErr) && (
        <p className="mt-2 text-xs text-red-600">{error || localErr}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-3">
        <button
          type="button"
          disabled={blocked}
          onClick={() => submit('approve')}
          className="px-4 py-2 rounded-md border border-green-200 bg-green-50/40 text-green-700 hover:bg-green-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => submit('reject')}
          className="px-4 py-2 rounded-md border border-red-200 bg-red-50/40 text-red-600 hover:bg-red-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => submit('changes')}
          className="px-4 py-2 rounded-md border border-line bg-surface text-fg hover:bg-surface-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'changes' ? 'Sending...' : 'Request changes'}
        </button>
      </div>

      {needsSig && !signature && !isResolved && (
        <p className="mt-2 text-[11px] text-fg-subtle">
          This step requires your e-signature before you can act.
        </p>
      )}

      {isResolved && (
        <p className="mt-3 text-xs text-fg-subtle">
          This task is {task.status.toLowerCase()} — no further action needed.
        </p>
      )}
    </section>
  )
}

// Submit-node action panel: the assignee fills the inline form the designer
// defined (if any) + an optional comment, then submits to advance the workflow.
function SubmitActions({ task, onSubmitted }) {
  const fields = Array.isArray(task.formFields) ? task.formFields : []
  const [values, setValues] = useState({})
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isResolved = task.status !== 'Pending'

  // Conditional logic: only the fields whose show/hide rule currently passes.
  const shownFields = fields.filter((f) => isFieldVisible(f, values))

  const setField = (id, v) => {
    setValues((prev) => ({ ...prev, [id]: v }))
    setErrors((prev) => (prev[id] ? { ...prev, [id]: undefined } : prev))
  }

  const doSubmit = async () => {
    setError('')
    const errs = validateFields(shownFields, values)
    if (Object.keys(errs).length) {
      setErrors(errs)
      setError('Please complete the required fields.')
      return
    }
    setBusy(true)
    try {
      await tasksStore.submit(task.id, { comment, formData: stripHiddenValues(shownFields, values) })
      onSubmitted?.()
    } catch (err) {
      setError(err.message || 'Submit failed')
      setBusy(false)
    }
  }

  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-fg mb-1">Submit this step</h2>
      <p className="text-sm text-fg-muted mb-4">
        {task.instructions
          ? task.instructions
          : fields.length
          ? 'Fill out the form below and submit to advance the workflow.'
          : 'Add an optional comment and submit to advance the workflow.'}
      </p>

      {shownFields.length > 0 && (
        <div className="space-y-4 mb-4">
          {shownFields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              value={values[f.id]}
              error={errors[f.id]}
              richSignature
              disabled={isResolved || busy}
              onChange={(v) => setField(f.id, v)}
            />
          ))}
        </div>
      )}

      <label className="block text-sm font-medium text-fg mb-1">Comment</label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment..."
        rows={2}
        disabled={isResolved || busy}
        className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition resize-none disabled:bg-surface-2 disabled:text-fg-subtle"
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button
        type="button"
        disabled={isResolved || busy}
        onClick={doSubmit}
        className="mt-3 w-full px-4 py-2 rounded-md border border-teal-200 bg-teal-50/60 text-teal-700 hover:bg-teal-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Submitting…' : 'Submit'}
      </button>

      {isResolved && (
        <p className="mt-3 text-xs text-fg-subtle">
          This step has been submitted — no further action needed.
        </p>
      )}
    </section>
  )
}

// Review-node tasks: the reviewer reads the submission + prior documents above,
// then forwards (no changes) or sends it back for changes. Deliberately not an
// approve/reject — it's a review checkpoint that routes the workflow.
function ReviewActions({ task, onReviewed }) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const isResolved = task.status !== 'Pending'

  const submit = async (outcome) => {
    setError('')
    if (outcome === 'changes' && !comment.trim()) {
      setError('Please describe what changes are needed before sending it back.')
      return
    }
    setBusy(outcome)
    try {
      await tasksStore.review(task.id, outcome, comment)
      onReviewed?.()
    } catch (err) {
      setError(err.message || 'Action failed')
      setBusy(null)
    }
  }

  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-fg mb-1">Review</h2>
      <p className="text-sm text-fg-muted mb-3">
        {task.instructions
          ? task.instructions
          : 'Review the submission and documents above, then forward it or send it back for changes. This is a review checkpoint — not an approval.'}
      </p>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (required when requesting changes)..."
        rows={2}
        disabled={isResolved || !!busy}
        className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition resize-none disabled:bg-surface-2 disabled:text-fg-subtle"
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isResolved || !!busy}
          onClick={() => submit('forward')}
          className="px-4 py-2 rounded-md border border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'forward' ? 'Forwarding…' : 'No changes — forward'}
        </button>
        <button
          type="button"
          disabled={isResolved || !!busy}
          onClick={() => submit('changes')}
          className="px-4 py-2 rounded-md border border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === 'changes' ? 'Sending back…' : 'Changes required'}
        </button>
      </div>

      {isResolved && (
        <p className="mt-3 text-xs text-fg-subtle">
          This review is complete — no further action needed.
        </p>
      )}
    </section>
  )
}

// Read-only list of files attached to a submit task (visible to everyone once
// the assignee has submitted).
function SubmittedFiles({ task }) {
  if (!task.attachments || task.attachments.length === 0) return null
  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Submitted files</h2>
      <ul className="space-y-2">
        {task.attachments.map((a, i) => (
          <li key={`${a.url}-${i}`}>
            <a
              href={toAbsoluteUrl(a.url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {a.name || 'Attachment'}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Read-only list of documents uploaded at EARLIER workflow steps (e.g. a submit
// node's costing doc). Lets the current assignee/approver review everything that
// came before — not just their own step's files.
function PriorDocuments({ task }) {
  if (!task.priorDocuments || task.priorDocuments.length === 0) return null
  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Documents from previous steps</h2>
      <ul className="space-y-2">
        {task.priorDocuments.map((d, i) => (
          <li key={`${d.url}-${i}`} className="flex items-center gap-2">
            <a
              href={toAbsoluteUrl(d.url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {d.name || 'Attachment'}
            </a>
            {d.step && <span className="text-xs text-fg-subtle truncate">— {d.step}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

// Read-only label→value grid for a submitted form. File fields are skipped here
// because they already render as attachments / "Documents from previous steps".
function SubmittedFormFields({ fields, data }) {
  const list = (fields || []).filter((f) => f.type !== 'file')
  if (!list.length) return null
  return (
    <dl className="divide-y divide-line">
      {list.map((f) => (
        <div key={f.id} className="py-2 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
          <dt className="text-sm text-fg-muted">{f.label}</dt>
          <dd className="sm:col-span-2 text-sm">
            <FieldValueView field={f} value={data?.[f.id]} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

// The current Submit task's own form, shown read-only once it's been submitted.
function SubmittedForm({ task }) {
  if (task.actionType !== 'submit' || task.status === 'Pending') return null
  const fields = Array.isArray(task.formFields) ? task.formFields : []
  if (!fields.some((f) => f.type !== 'file')) return null
  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Submitted form</h2>
      <SubmittedFormFields fields={fields} data={task.formData} />
    </section>
  )
}

// Structured form values submitted at EARLIER submit-node steps, so the current
// reviewer/approver can read them (name, account no., e-signature, …).
function PriorForms({ task }) {
  const forms = Array.isArray(task.priorForms)
    ? task.priorForms.filter((f) => (f.fields || []).some((x) => x.type !== 'file'))
    : []
  if (!forms.length) return null
  return (
    <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Form data from previous steps</h2>
      <div className="space-y-4">
        {forms.map((f, i) => (
          <div key={`${f.nodeId}-${i}`}>
            {f.step && <p className="text-xs font-medium text-fg-subtle mb-1">{f.step}</p>}
            <SubmittedFormFields fields={f.fields} data={f.data} />
          </div>
        ))}
      </div>
    </section>
  )
}

const STAGE_META = {
  approved:  { dot: 'bg-green-500',  text: 'text-green-600',  label: 'Approved' },
  rejected:  { dot: 'bg-red-500',    text: 'text-red-600',    label: 'Rejected' },
  escalated: { dot: 'bg-orange-500', text: 'text-orange-600', label: 'Escalated' },
  pending:   { dot: 'bg-blue-500',   text: 'text-blue-600',   label: 'Awaiting approval' },
  upcoming:  { dot: 'bg-gray-300',   text: 'text-fg-subtle',   label: 'Not started' }
}

const VOTE_META = {
  approved: { dot: 'bg-green-500', text: 'text-green-600', label: 'Approved' },
  rejected: { dot: 'bg-red-500', text: 'text-red-600', label: 'Rejected' },
  pending: { dot: 'bg-gray-300', text: 'text-fg-subtle', label: 'Awaiting' }
}

// Committee / quorum panel: shows "N of M approved", a progress bar, and each
// approver's vote. Only rendered for multiApproval tasks.
function CommitteeApprovals({ task }) {
  if (!task.isMultiApproval) return null

  const voters = task.parallelApprovers || []
  const voteById = new Map((task.parallelApprovals || []).map((p) => [String(p.id), p]))
  const required = task.requiredApprovals || 1
  const total = voters.length
  const approved = (task.parallelApprovals || []).filter((p) => p.status === 'approved').length
  const rejected = (task.parallelApprovals || []).filter((p) => p.status === 'rejected').length
  const met = approved >= required
  const failed = total - rejected < required
  const pct = Math.min(100, Math.round((approved / Math.max(1, required)) * 100))

  return (
    <section className="bg-surface border border-line rounded-lg px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-fg">Committee approval</h2>
        <span className={`text-xs font-semibold ${met ? 'text-green-600' : failed ? 'text-red-600' : 'text-indigo-600'}`}>
          {approved} of {required} approved
        </span>
      </div>
      <p className="text-[11px] text-fg-muted mb-2">
        {met
          ? `Quorum reached — only ${required} of ${total} approval${required === 1 ? '' : 's'} were needed.`
          : failed
          ? 'Too many rejections — this stage can no longer reach quorum.'
          : `Needs ${required} of ${total} approvals to pass. ${rejected > 0 ? `${rejected} rejected so far.` : ''}`}
      </p>
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden mb-3">
        <div className={`h-full ${met ? 'bg-green-500' : failed ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {voters.map((v) => {
          const vote = voteById.get(String(v.id))
          const meta = VOTE_META[vote?.status] || VOTE_META.pending
          return (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                <span className="text-sm text-fg truncate">{v.name || 'Approver'}</span>
              </span>
              <span className={`text-[11px] font-medium shrink-0 ${meta.text}`}>
                {meta.label}
                {vote?.decidedAt ? ` · ${vote.decidedAt}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
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
    <section className="bg-surface border border-line rounded-lg px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-fg">Approval chain</h2>
        {summary && (
          <span className="text-xs font-medium text-fg-muted">
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
                <span className="absolute left-[5px] top-3.5 bottom-0 w-px bg-line" />
              )}
              <span
                className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full ${meta.dot} ${
                  s.isCurrent ? 'ring-2 ring-blue-200' : ''
                }`}
              />
              <div className="leading-tight">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-fg">
                    {s.title}
                    {s.isCurrent && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                        current
                      </span>
                    )}
                  </p>
                  <span className={`text-[11px] font-medium shrink-0 ${meta.text}`}>{meta.label}</span>
                </div>
                <p className="text-xs text-fg-muted mt-0.5">{stageLine(s)}</p>
                {s.decidedAt && (
                  <p className="text-[11px] text-fg-subtle mt-0.5">{s.decidedAt}</p>
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
    <section className="bg-surface border border-line rounded-lg px-5 py-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Approval history</h2>
      {task.history.length === 0 ? (
        <p className="text-sm text-fg-subtle">No activity on this request yet.</p>
      ) : (
        <ul className="space-y-3">
          {task.history.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${step.dotColor}`} />
              <div className="leading-tight">
                <p className="text-sm text-fg">{step.label}</p>
                {step.signature && <SignatureMark signature={step.signature} className="mt-1" />}
                <p className="text-xs text-fg-subtle mt-0.5">{step.time}</p>
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
    <section className="bg-surface border border-line rounded-lg px-5 py-4">
      <h2 className="text-sm font-semibold text-fg mb-3">SLA status</h2>
      <p className={`text-sm font-medium ${breached ? 'text-red-600' : 'text-fg'}`}>
        {remainingLabel}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.max(0, pct)}%` }} />
      </div>
      <p className="text-xs text-fg-subtle mt-2">
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
        <p className="text-sm text-fg-muted">Please wait while we fetch this task.</p>
      </AppShell>
    )
  }

  if (!task) {
    return (
      <AppShell title="Task unavailable" back={{ to: '/tasks', label: 'Back to inbox' }}>
        <div className="bg-surface border border-line rounded-lg p-8 text-center max-w-md mx-auto">
          <p className="text-sm text-fg-muted">{error || 'Task not found.'}</p>
          <Link to="/tasks" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Back to inbox
          </Link>
        </div>
      </AppShell>
    )
  }

  const handleAction = async (action, comment, signature) => {
    setBusy(action)
    setError('')
    try {
      if (action === 'approve')  await tasksStore.approve(task.id, comment, signature)
      if (action === 'reject')   await tasksStore.reject(task.id, comment, signature)
      if (action === 'changes')  await tasksStore.requestChanges(task.id, comment, signature)
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

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Cancel request?',
      message: 'This stops the approval and notifies anyone it was waiting on.',
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!ok) return
    setBusy('cancel')
    setError('')
    try {
      await tasksStore.cancel(task.executionId)
      setTimeout(() => navigate('/tasks'), 400)
    } catch (err) {
      setError(err.message || 'Could not cancel the request')
      setBusy(null)
    }
  }

  // Only the assignee (or an elevated approver) can act — matches the backend.
  const meId = me?._id ? String(me._id) : null
  const isAssignee = meId && String(task.assignedToId) === meId
  // For committee tasks, any listed voter can act (not just the representative
  // assignee). Their vote is hidden once cast so they can't double-vote.
  const isCommitteeVoter =
    task.isMultiApproval && (task.parallelApprovers || []).some((p) => String(p.id) === meId)
  const myVote =
    task.isMultiApproval
      ? (task.parallelApprovals || []).find((p) => String(p.id) === meId && p.status !== 'pending')
      : null
  const canAct = isAssignee || isCommitteeVoter || APPROVER_ROLES.has(me?.role?.name)

  // Request-level status (the whole chain) drives the requester's summary text.
  const reqStatus = requestStatus(task)
  const reqResolved = reqStatus === 'Approved' || reqStatus === 'Rejected'
  const currentApprover =
    (task.approvalChain || []).find((s) => s.isCurrent || s.status === 'pending')?.assignee ||
    task.approver

  return (
    <AppShell
      title={pageTitle}
      back={{ to: '/tasks', label: 'Back to inbox' }}
      actions={
        <button
          onClick={focusComment}
          className="px-3 py-1.5 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
        >
          Comment
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-0">
          <SubmissionDetails task={task} />
          <PriorForms task={task} />
          <PriorDocuments task={task} />
          {canAct && myVote ? (
            <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
              <h2 className="text-sm font-semibold text-fg mb-1">Your decision</h2>
              <p className="text-sm text-fg-muted">
                You have already <span className={myVote.status === 'approved' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{myVote.status}</span> this
                committee task. It stays open until the required number of approvals is reached.
              </p>
            </section>
          ) : canAct ? (
            task.actionType === 'submit' ? (
              <SubmitActions
                task={task}
                onSubmitted={() => setTimeout(() => navigate('/tasks'), 600)}
              />
            ) : task.actionType === 'review' ? (
              <ReviewActions
                task={task}
                onReviewed={() => setTimeout(() => navigate('/tasks'), 600)}
              />
            ) : (
              <ApprovalActions
                task={task}
                onAction={handleAction}
                commentRef={commentRef}
                busy={busy}
                error={error}
              />
            )
          ) : (
            <section className="bg-surface border border-line rounded-lg px-6 py-5 mt-4">
              <h2 className="text-sm font-semibold text-fg mb-1">Your request</h2>
              <p className="text-sm text-fg-muted">
                {reqResolved
                  ? `This request has been ${reqStatus.toLowerCase()}.`
                  : `This request is awaiting approval${currentApprover ? ` from ${currentApprover}` : ''}. You'll be notified when there's an update.`}
              </p>
              {task.canCancel && !reqResolved && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={busy === 'cancel'}
                    className="px-4 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    {busy === 'cancel' ? 'Cancelling…' : 'Cancel request'}
                  </button>
                  {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                </div>
              )}
            </section>
          )}
          <SubmittedForm task={task} />
          <SubmittedFiles task={task} />
        </div>

        <aside className="space-y-4">
          <CommitteeApprovals task={task} />
          <ApprovalChain task={task} />
          <ApprovalHistory task={task} />
          <SlaStatus task={task} />
        </aside>
      </div>
    </AppShell>
  )
}

export default TaskDetail

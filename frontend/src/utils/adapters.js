// Shared - Phase 2 - utils/adapters.js
// Translates backend payloads into the shapes the existing UI components
// already render. Keeps every page from having to know API field names.

import { initials } from './auth'

// ---------- shared helpers ----------

export const relativeTime = (iso) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-orange-100 text-orange-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-green-100 text-green-700',
  'bg-indigo-100 text-indigo-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700'
]
const colourForName = (name) => {
  if (!name) return AVATAR_PALETTE[0]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

const titleCase = (s) =>
  String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// ---------- tasks ----------

const TASK_STATUS_MAP = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  escalated: 'Escalated',
  completed: 'Approved'
}

const ACTION_DOT = {
  submitted: 'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  escalated: 'bg-orange-500',
  request_changes: 'bg-amber-500',
  reassigned: 'bg-purple-500'
}

// Friendly labels for the semantic approver tokens the engine resolves at runtime.
const APPROVER_ROLE_LABELS = {
  direct_manager: 'Reporting manager',
  hr_partner: 'HR partner',
  hr_admin: 'Admin',
  ceo: 'CEO',
  super_admin: 'Admin',
  hr_manager: 'HR Manager',
  finance_manager: 'Finance Manager',
  it_manager: 'IT Manager',
  operations_manager: 'Operations Manager',
  sales_manager: 'Sales Manager',
  legal_manager: 'Legal Manager'
}

export const adaptTask = (apiTask) => {
  if (!apiTask) return null

  const submitter = apiTask.submittedBy?.name || 'Unknown'
  const status = TASK_STATUS_MAP[apiTask.status] || 'Pending'
  const dueMs = apiTask.dueDate ? new Date(apiTask.dueDate).getTime() - Date.now() : 0
  const dueInMinutes = Math.round(dueMs / 60000)
  const slaBreached = apiTask.status === 'escalated' || apiTask.isEscalated || dueInMinutes < 0

  const formData = apiTask.formResponseId?.formData || {}
  // Map field id -> definition so we can show the human label (not the raw id)
  // and detect file fields to render as download links.
  const fieldDefs = apiTask.formResponseId?.formId?.fields || []
  const fieldMap = new Map(fieldDefs.map((f) => [f.id, f]))

  const fileValue = (v) => {
    // A file field stores { name, url, ... }. Older data may be a bare string.
    if (v && typeof v === 'object' && v.url) return { name: v.name || 'Attachment', url: v.url }
    return null
  }

  const submission = Object.entries(formData).map(([k, v]) => {
    const def = fieldMap.get(k)
    const label = def?.label || titleCase(k)
    const file = def?.type === 'file' ? fileValue(v) : fileValue(v)
    if (file) {
      return { label, value: file.name, href: file.url, isFile: true }
    }
    return {
      label,
      value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
    }
  })
  if (submitter) submission.unshift({ label: 'Submitted by', value: submitter })
  if (apiTask.submittedBy?.department) submission.push({ label: 'Department', value: apiTask.submittedBy.department })

  const history = (apiTask.approvalHistory || []).map((h) => {
    const who = h.performedBy?.name || 'System'
    const verb = h.action === 'submitted' ? 'submitted' : h.action.replace(/_/g, ' ')
    return {
      label: `${who} ${verb}${h.comment ? ` — "${h.comment}"` : ''}`,
      time: h.performedAt ? new Date(h.performedAt).toLocaleString() : '',
      dotColor: ACTION_DOT[h.action] || 'bg-gray-400'
    }
  })

  // SLA: approx 48h default if no dueDate. Time-since-created vs total budget.
  const createdMs = apiTask.createdAt ? new Date(apiTask.createdAt).getTime() : Date.now()
  const totalHours = apiTask.dueDate
    ? Math.max(1, Math.round((new Date(apiTask.dueDate).getTime() - createdMs) / 3600000))
    : 48
  const assignedHoursAgo = Math.max(0, Math.round((Date.now() - createdMs) / 3600000))

  // assignedTo / submittedBy may be populated objects or raw ObjectId strings,
  // depending on the endpoint. Normalise both to plain id strings so the UI can
  // decide who is allowed to act on the task.
  const idOf = (v) => (v && typeof v === 'object' ? v._id : v) || null
  const approver = apiTask.assignedTo?.name || null

  return {
    _raw: apiTask,
    id: apiTask._id,
    title: apiTask.title,
    subject: apiTask.title,
    detail: apiTask.type || apiTask.workflowId?.title || 'General',
    requester: submitter,
    approver,
    department: apiTask.type || apiTask.workflowId?.department || apiTask.submittedBy?.department || 'General',
    assignedToId: idOf(apiTask.assignedTo),
    submittedById: idOf(apiTask.submittedBy),
    workflow: apiTask.workflowId?.title || apiTask.type || 'Standalone',
    initials: initials(submitter),
    avatarColor: colourForName(submitter),
    dueInMinutes,
    slaBreached,
    status,
    dueDate: apiTask.dueDate,
    createdAt: apiTask.createdAt,
    submission,
    history,
    approvalChain: (apiTask.approvalChain || []).map((s) => ({
      nodeId: s.nodeId,
      title: s.title,
      roleLabel: s.role ? (APPROVER_ROLE_LABELS[s.role] || titleCase(s.role)) : null,
      status: s.status, // approved | rejected | escalated | pending | upcoming
      isCurrent: !!s.isCurrent,
      assignee: s.assignee?.name || null,
      decidedBy: s.decidedBy || null,
      decidedAt: s.decidedAt ? new Date(s.decidedAt).toLocaleString() : null
    })),
    approvalSummary: apiTask.approvalSummary || null,
    sla: { totalHours, assignedHoursAgo },
    comments: []
  }
}

// ---------- notifications ----------

const NOTIF_DOT = {
  approval:   'bg-green-100',
  rejection:  'bg-red-100',
  escalation: 'bg-orange-100',
  assignment: 'bg-blue-100',
  reminder:   'bg-yellow-100'
}

export const adaptNotification = (n) => ({
  _raw: n,
  id: n._id,
  message: n.message,
  title: n.title,
  time: relativeTime(n.createdAt),
  read: n.isRead,
  type: n.type,
  taskId: n.taskId,
  dotColor: NOTIF_DOT[n.type] || 'bg-gray-100'
})

// ---------- forms ----------

const FORM_STATUS_MAP = {
  draft:     'Draft',
  published: 'Published',
  archived:  'Archived'
}

export const adaptForm = (f) => ({
  _raw: f,
  id: f._id,
  name: f.title,
  title: f.title,
  description: f.description || '',
  category: f.department || 'General',
  status: FORM_STATUS_MAP[f.status] || 'Draft',
  fields: Array.isArray(f.fields) ? f.fields.length : 0,
  fieldDefs: f.fields || [],
  submissions: f.submissions || 0,
  createdAt: f.createdAt,
  createdBy: f.createdBy?.name || 'Unknown',
  version: f.version || 1
})

// ---------- workflows ----------

const WORKFLOW_STATUS_MAP = {
  draft:     'Draft',
  published: 'Active',
  paused:    'Paused',
  archived:  'Archived'
}

export const adaptWorkflow = (w) => ({
  _raw: w,
  id: w._id,
  name: w.title,
  title: w.title,
  description: w.description || '',
  category: w.department || 'General',
  status: WORKFLOW_STATUS_MAP[w.status] || 'Draft',
  steps: Array.isArray(w.nodes) ? w.nodes.length : 0,
  nodes: w.nodes || [],
  edges: w.edges || [],
  linkedFormId: w.linkedFormId,
  createdAt: w.createdAt,
  createdBy: w.createdBy?.name || 'Unknown',
  version: w.version || 1
})

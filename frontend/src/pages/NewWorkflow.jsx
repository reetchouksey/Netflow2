import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { workflowsStore, WORKFLOW_CATEGORIES } from '../lib/workflowsStore'
import { useForms } from '../lib/formsStore'
import { api } from '../utils/api'
import NodeTypesSidebar from './WorkflowCanvas/NodeTypesSidebar'
import WorkflowEditor from './WorkflowCanvas/WorkflowEditor'
import NodeConfig from './WorkflowCanvas/NodeConfig'
import { NODE_DEFAULTS, NODE_STYLES, createNodeId } from './WorkflowCanvas/nodeStyles'
import { confirm } from '../lib/confirmStore'

const STEPS = [
  { id: 1, label: 'Choose template' },
  { id: 2, label: 'Build workflow' },
  { id: 3, label: 'Settings & triggers' },
  { id: 4, label: 'Review & publish' },
]

const TEMPLATES = [
  {
    id: 'leave',
    title: 'Leave approval',
    subtitle: 'Employee → Manager → HR two-step leave flow',
    iconClass: 'bg-blue-50 text-blue-600',
    defaults: {
      name: 'Leave Approval Workflow',
      category: 'HR',
      description: 'Two-step leave request flow with manager and HR approval gates.',
      formHint: 'leave',
      nodes: [
        { id: 'n1', type: 'start', title: 'Form submitted', subtitle: 'Start trigger', x: 300, y: 20 },
        { id: 'n2', type: 'approval', title: 'Manager review', subtitle: 'Approval node · 24h SLA', x: 300, y: 120, approverRole: 'direct_manager', slaValue: 24, slaUnit: 'Hours', onBreach: 'Escalate to admin', sequential: true },
        { id: 'n3', type: 'condition', title: 'Decision', subtitle: 'Approved / Rejected', x: 300, y: 230, branches: ['Approved', 'Rejected'] },
        { id: 'n4', type: 'notify', title: 'Notify reject', subtitle: 'Email + in-app', x: 110, y: 340, channels: ['Email', 'In-app'] },
        { id: 'n5', type: 'approval', title: 'HR approval', subtitle: 'Approval node · 48h SLA', x: 470, y: 340, approverRole: 'hr_admin', slaValue: 48, slaUnit: 'Hours', onBreach: 'Escalate to admin' },
        { id: 'n6', type: 'end', title: 'Approved', subtitle: 'Generate PDF', x: 470, y: 440 },
      ],
      connections: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4', dashed: true },
        { from: 'n3', to: 'n5' },
        { from: 'n5', to: 'n6' },
      ],
    },
  },
  {
    id: 'expense',
    title: 'Expense reimbursement',
    subtitle: 'Submit receipts, manager sign-off, finance payout',
    iconClass: 'bg-emerald-50 text-emerald-600',
    defaults: {
      name: 'Expense Reimbursement',
      category: 'Finance',
      description: 'Receipt submission → manager approval → finance payout.',
      formHint: 'expense',
      nodes: [
        { id: 'n1', type: 'start', title: 'Form submitted', subtitle: 'Start trigger', x: 300, y: 20 },
        { id: 'n2', type: 'approval', title: 'Manager sign-off', subtitle: 'Approval node · 24h SLA', x: 300, y: 130, approverRole: 'direct_manager', slaValue: 24, slaUnit: 'Hours' },
        { id: 'n3', type: 'approval', title: 'Finance payout', subtitle: 'Approval node · 48h SLA', x: 300, y: 240, approverRole: 'finance_manager', slaValue: 48, slaUnit: 'Hours' },
        { id: 'n4', type: 'end', title: 'Reimbursed', subtitle: 'Generate PDF', x: 300, y: 350 },
      ],
      connections: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
      ],
    },
  },
  {
    id: 'it',
    title: 'IT access request',
    subtitle: 'Software / hardware provisioning approval',
    iconClass: 'bg-purple-50 text-purple-600',
    defaults: {
      name: 'IT Access Request',
      category: 'IT',
      description: 'Software / hardware provisioning approval flow.',
      formHint: 'access',
      nodes: [
        { id: 'n1', type: 'start', title: 'Form submitted', subtitle: 'Start trigger', x: 300, y: 20 },
        { id: 'n2', type: 'approval', title: 'Manager approval', subtitle: 'Approval node · 24h SLA', x: 300, y: 130, approverRole: 'direct_manager', slaValue: 24, slaUnit: 'Hours' },
        { id: 'n3', type: 'approval', title: 'IT provisioning', subtitle: 'Approval node · 24h SLA', x: 300, y: 240, approverRole: 'it_manager', slaValue: 24, slaUnit: 'Hours' },
        { id: 'n4', type: 'notify', title: 'Notify requester', subtitle: 'Email + in-app', x: 300, y: 350, channels: ['Email', 'In-app'] },
        { id: 'n5', type: 'end', title: 'Access granted', subtitle: 'Finish', x: 300, y: 450 },
      ],
      connections: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
      ],
    },
  },
  {
    id: 'po',
    title: 'Purchase order',
    subtitle: 'Multi-tier PO approval with CFO escalation',
    iconClass: 'bg-amber-50 text-amber-600',
    defaults: {
      name: 'Purchase Order',
      category: 'Finance',
      description: 'Multi-tier PO approval with CFO escalation over $10k.',
      formHint: 'purchase',
      nodes: [
        { id: 'n1', type: 'start', title: 'PO submitted', subtitle: 'Start trigger', x: 300, y: 20 },
        { id: 'n2', type: 'approval', title: 'Dept head approval', subtitle: 'Approval node · 24h SLA', x: 300, y: 130, approverRole: 'direct_manager', slaValue: 24, slaUnit: 'Hours' },
        { id: 'n3', type: 'condition', title: 'Amount > $10k?', subtitle: 'Branch logic', x: 300, y: 240, branches: ['Yes', 'No'] },
        { id: 'n4', type: 'approval', title: 'CFO approval', subtitle: 'Approval node · 48h SLA', x: 470, y: 350, approverRole: 'ceo', slaValue: 48, slaUnit: 'Hours' },
        { id: 'n5', type: 'end', title: 'PO issued', subtitle: 'Generate PDF', x: 300, y: 460 },
      ],
      connections: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n3', to: 'n5', dashed: true },
        { from: 'n4', to: 'n5' },
      ],
    },
  },
  {
    id: 'onboarding',
    title: 'Onboarding checklist',
    subtitle: 'New hire document collection and sign-offs',
    iconClass: 'bg-pink-50 text-pink-600',
    defaults: {
      name: 'Onboarding Checklist',
      category: 'HR',
      description: 'New hire document collection and sign-offs.',
      formHint: 'onboarding',
      nodes: [
        { id: 'n1', type: 'start', title: 'New hire created', subtitle: 'Start trigger', x: 300, y: 20 },
        { id: 'n2', type: 'notify', title: 'Send docs to hire', subtitle: 'Email + in-app', x: 300, y: 130, channels: ['Email', 'In-app'] },
        { id: 'n3', type: 'approval', title: 'HR verification', subtitle: 'Approval node · 24h SLA', x: 300, y: 240, approverRole: 'hr_manager', slaValue: 24, slaUnit: 'Hours' },
        { id: 'n4', type: 'timer', title: 'Wait 24h', subtitle: 'Delay', x: 300, y: 350, waitValue: 24, waitUnit: 'Hours' },
        { id: 'n5', type: 'end', title: 'Onboarded', subtitle: 'Finish', x: 300, y: 450 },
      ],
      connections: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
      ],
    },
  },
  {
    id: 'scratch',
    title: 'Start from scratch',
    subtitle: 'Build a custom workflow from an empty canvas',
    iconClass: 'bg-surface-3 text-fg-muted',
    defaults: {
      name: '',
      category: 'HR',
      description: '',
      formHint: '',
      nodes: [
        { id: 'n1', type: 'start', title: 'Form submitted', subtitle: 'Start trigger', x: 300, y: 40 },
        { id: 'n2', type: 'end', title: 'Completed', subtitle: 'Finish', x: 300, y: 440 },
      ],
      connections: [{ from: 'n1', to: 'n2' }],
    },
  },
]

// Category + department lists mirror the backend enums exactly
// (User.department / Workflow.department). Using anything else here
// silently fails Mongoose validation on POST /api/workflows.
const CATEGORIES = WORKFLOW_CATEGORIES
const DEPARTMENTS = WORKFLOW_CATEGORIES

// 'Manual trigger only' saves the linked form submission but does NOT auto-fire
// the workflow — it can be started later via the execute endpoint instead.
const TRIGGER_OPTIONS = [
  'Every form submission',
  'Manual trigger only',
]

const SUBMITTER_OPTIONS = ['All employees', 'Managers only', 'Specific people']

const SLA_OPTIONS = ['Always', 'After first breach', 'Never']

function StepIndicator({ current }) {
  return (
    <div className="border-b border-line bg-surface">
      
      <div className="px-6 py-4 flex items-center gap-3">
        {STEPS.map((s, i) => {
          const isCurrent = current === s.id
          const isDone = current > s.id
          return (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-indigo-600 text-white'
                      : 'bg-surface border border-line text-fg-subtle'
                  }`}
                >
                  {isDone ? '✓' : s.id}
                </div>
                <span
                  className={`text-sm ${
                    isCurrent
                      ? 'font-semibold text-fg'
                      : isDone
                      ? 'text-fg'
                      : 'text-fg-muted'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${isDone ? 'bg-green-400' : 'bg-line'}`} />
              )}
            </React.Fragment>
          )
        })}
        
      </div>
      
    </div>
    
  )
}

function Step1Template({ selected, onSelect }) {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-fg">Choose a template to start with</h2>
      <p className="text-sm text-fg-muted mt-1 mb-6">
        Pick a pre-built workflow or start from scratch. You can customise everything in the next step.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TEMPLATES.map((t) => {
          const isSelected = selected === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`text-left p-5 rounded-lg border transition ${
                isSelected
                  ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-200'
                  : 'border-line bg-surface hover:border-line'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-md flex items-center justify-center mb-3 ${t.iconClass}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="font-semibold text-fg">{t.title}</p>
              <p className="text-sm text-fg-muted mt-1">{t.subtitle}</p>
              {isSelected && (
                <p className="mt-3 text-sm font-medium text-indigo-600 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Selected
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// "Tail" = best node to extend the chain from when the user clicks a node
// type in the palette. Preference: the currently-selected node, else the most
// recently added non-end node, else the last node, else nothing. We never
// extend out of an `end` node because by definition the flow has finished.
const pickTailNode = (nodes, selectedNodeId) => {
  if (nodes.length === 0) return null
  if (selectedNodeId) {
    const sel = nodes.find((n) => n.id === selectedNodeId)
    if (sel && sel.type !== 'end') return sel
  }
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].type !== 'end') return nodes[i]
  }
  return nodes[nodes.length - 1]
}

function Step2Builder({ data, setData }) {
  const { nodes, connections, selectedNodeId } = data
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null

  const selectNode = (id) => setData((d) => ({ ...d, selectedNodeId: id }))

  const updateNode = (updated) =>
    setData((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === updated.id ? updated : n)) }))

  const moveNode = (id, x, y) =>
    setData((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }))

  const deleteNode = (id) =>
    setData((d) => ({
      ...d,
      nodes: d.nodes.filter((n) => n.id !== id),
      connections: d.connections.filter((c) => c.from !== id && c.to !== id),
      selectedNodeId: d.selectedNodeId === id ? null : d.selectedNodeId,
    }))

  // Drag-and-drop from the palette: place exactly where the user dropped it,
  // no auto-connect (user is positioning manually).
  const addNodeAt = (type, x, y) => {
    const def = NODE_DEFAULTS[type] || {}
    const id = createNodeId()
    const node = { id, type, x, y, ...def }
    setData((d) => ({ ...d, nodes: [...d.nodes, node], selectedNodeId: id }))
  }

  // Click from the palette: smart insert. Drops below the tail node and
  // auto-connects from it so a click stream builds a chain step by step.
  const addNodeAfterTail = (type) => {
    const def = NODE_DEFAULTS[type] || {}
    const id = createNodeId()

    setData((d) => {
      const tail = pickTailNode(d.nodes, d.selectedNodeId)
      const x = tail ? tail.x : 300
      // Flow new nodes straight down. The canvas is a large pannable world now,
      // so we only cap near the world's bottom (use Fit/zoom to see them all).
      const y = tail ? Math.min(tail.y + 110, 3900) : 40
      const node = { id, type, x, y, ...def }

      // Skip auto-connect if the tail already has an outgoing edge to avoid
      // silently inserting a stray branch — user can wire it manually.
      const tailHasOutgoing =
        tail && d.connections.some((c) => c.from === tail.id)

      const nextConnections =
        tail && !tailHasOutgoing
          ? [...d.connections, { from: tail.id, to: id }]
          : d.connections

      return {
        ...d,
        nodes: [...d.nodes, node],
        connections: nextConnections,
        selectedNodeId: id,
      }
    })
  }

  const addConnection = (conn) =>
    setData((d) => ({ ...d, connections: [...d.connections, conn] }))

  const deleteConnection = (idx) =>
    setData((d) => ({ ...d, connections: d.connections.filter((_, i) => i !== idx) }))

  const setConnections = (next) =>
    setData((d) => ({ ...d, connections: typeof next === 'function' ? next(d.connections) : next }))

  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="flex h-[640px] min-h-0">
        <NodeTypesSidebar onAddNode={addNodeAfterTail} />
        <WorkflowEditor
          nodes={nodes}
          connections={connections}
          selectedNodeId={selectedNodeId}
          onSelectNode={selectNode}
          onMoveNode={moveNode}
          onDropNewNode={addNodeAt}
          onDeleteNode={deleteNode}
          onAddConnection={addConnection}
          onDeleteConnection={deleteConnection}
        />
        <NodeConfig
          node={selectedNode}
          onChange={updateNode}
          nodes={nodes}
          connections={connections}
          onConnectionsChange={setConnections}
        />
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="bg-surface border border-line rounded-lg">
      <div className="px-5 py-3 border-b border-line bg-surface-2/60 rounded-t-lg">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}

function Step3Settings({ data, setData, forms }) {
  const { settings } = data
  const update = (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  const updateAdvanced = (patch) =>
    setData((d) => ({
      ...d,
      settings: { ...d.settings, advanced: { ...d.settings.advanced, ...patch } },
    }))

  // Active users for the "Specific people" initiator picker.
  const [users, setUsers] = useState([])
  useEffect(() => {
    let cancelled = false
    api
      .get('/api/users?isActive=true&limit=100')
      .then((d) => { if (!cancelled) setUsers(d.users || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const allowedInitiators = settings.allowedInitiators || []
  const addInitiator = (id) => {
    if (id && !allowedInitiators.includes(id)) {
      update({ allowedInitiators: [...allowedInitiators, id] })
    }
  }
  const removeInitiator = (id) =>
    update({ allowedInitiators: allowedInitiators.filter((x) => x !== id) })

  const visibleTo = settings.visibleTo || []
  const addVisiblePerson = (id) => {
    if (id && !visibleTo.includes(id)) update({ visibleTo: [...visibleTo, id] })
  }
  const removeVisiblePerson = (id) =>
    update({ visibleTo: visibleTo.filter((x) => x !== id) })

  const publishedForms = forms.filter((f) => f.status === 'Published')

  const toggleDept = (dept) => {
    const has = settings.visibleDepartments.includes(dept)
    update({
      visibleDepartments: has
        ? settings.visibleDepartments.filter((d) => d !== dept)
        : [...settings.visibleDepartments, dept],
    })
  }

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold text-fg">Settings &amp; triggers</h2>
        <p className="text-sm text-fg-muted mt-1">
          Configure global settings, form linkage, and access for this workflow.
        </p>
      </div>

      <Section title="Basic info">
        <div>
          <label className="block text-sm font-medium text-fg mb-1">Workflow name</label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Leave Approval Workflow"
            className={inputCls}
          />
        </div>
        <div> 
          <label className="block text-sm font-medium text-fg mb-1">Description</label>
          <textarea
            rows={3}
            value={settings.description}
            onChange={(e) => update({ description: e.target.value })}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-1">Category</label>
          <select
            value={settings.category}
            onChange={(e) => update({ category: e.target.value })}
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Form & trigger linkage">
        <div>
          <label className="block text-sm font-medium text-fg mb-1">Linked form</label>
          <select
            value={settings.linkedFormId || ''}
            onChange={(e) => update({ linkedFormId: e.target.value || null })}
            className={inputCls}
          >
            <option value="">— Select a published form —</option>
            {publishedForms.map((f) => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
          {publishedForms.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              No published forms yet. Create one in Forms first, then come back.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-1">Trigger on</label>
          <select
            value={settings.triggerOn}
            onChange={(e) => update({ triggerOn: e.target.value })}
            className={inputCls}
          >
            {TRIGGER_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={settings.preventDuplicates}
            onChange={(e) => update({ preventDuplicates: e.target.checked })}
            className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
          />
          Prevent duplicate submissions per user per day
        </label>
      </Section>

      <Section title="Access & permissions">
        <div>
          <label className="block text-sm font-medium text-fg mb-1">Who can submit</label>
          <select
            value={settings.whoCanSubmit}
            onChange={(e) => update({ whoCanSubmit: e.target.value })}
            className={inputCls}
          >
            {SUBMITTER_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          {settings.whoCanSubmit === 'Specific people' && (
            <div className="mt-2 space-y-2">
              <select
                value=""
                onChange={(e) => { addInitiator(e.target.value); e.target.value = '' }}
                className={inputCls}
              >
                <option value="">+ Add a person…</option>
                {users
                  .filter((u) => !allowedInitiators.includes(String(u._id)))
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}{u.department ? ` · ${u.department}` : ''}
                    </option>
                  ))}
              </select>

              {allowedInitiators.length === 0 ? (
                <p className="text-[11px] text-amber-600">
                  Add at least one person — otherwise anyone who can see the form can start it.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allowedInitiators.map((id) => {
                    const u = users.find((x) => String(x._id) === String(id))
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs rounded-md border border-indigo-300 bg-indigo-50 text-indigo-700"
                      >
                        {u ? u.name : 'Unknown user'}
                        <button
                          type="button"
                          onClick={() => removeInitiator(id)}
                          className="w-4 h-4 rounded hover:bg-indigo-200 flex items-center justify-center text-indigo-500"
                          aria-label={`Remove ${u ? u.name : 'user'}`}
                        >
                          &times;
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              <p className="text-[11px] text-fg-muted">
                Only these people can submit the linked form and start this workflow.
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-1">Visibility</label>
          <p className="text-xs text-fg-muted mb-1.5">Who can see and open this form.</p>
          <select
            value={settings.visibility}
            onChange={(e) => update({ visibility: e.target.value })}
            className={inputCls}
          >
            <option value="company">Company-wide (everyone)</option>
            <option value="departments">Specific departments</option>
            <option value="people">Specific people</option>
          </select>

          {settings.visibility === 'departments' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {DEPARTMENTS.map((d) => {
                const on = settings.visibleDepartments.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDept(d)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition flex items-center gap-1.5 ${
                      on
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-line bg-surface text-fg-muted hover:bg-surface-2'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center ${
                        on ? 'bg-indigo-600 text-white' : 'border border-line'
                      }`}
                    >
                      {on && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {d}
                  </button>
                )
              })}
            </div>
          )}

          {settings.visibility === 'people' && (
            <div className="mt-2 space-y-2">
              <select
                value=""
                onChange={(e) => {
                  addVisiblePerson(e.target.value)
                  e.target.value = ''
                }}
                className={inputCls}
              >
                <option value="">+ Add a person…</option>
                {users
                  .filter((u) => !visibleTo.includes(String(u._id)))
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                      {u.department ? ` · ${u.department}` : ''}
                    </option>
                  ))}
              </select>

              {visibleTo.length === 0 ? (
                <p className="text-[11px] text-amber-600">
                  Add at least one person, otherwise the form stays visible to everyone.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {visibleTo.map((id) => {
                    const u = users.find((x) => String(x._id) === String(id))
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs rounded-md border border-indigo-300 bg-indigo-50 text-indigo-700"
                      >
                        {u ? u.name : 'Unknown user'}
                        <button
                          type="button"
                          onClick={() => removeVisiblePerson(id)}
                          className="w-4 h-4 rounded hover:bg-indigo-200 flex items-center justify-center text-indigo-500"
                          aria-label="Remove person"
                        >
                          &times;
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              <p className="text-[11px] text-fg-muted">Only these people can see and open this form.</p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-1">
            Notify admin on SLA breach
          </label>
          <select
            value={settings.notifyOnSlaBreach}
            onChange={(e) => update({ notifyOnSlaBreach: e.target.value })}
            className={inputCls}
          >
            {SLA_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Advanced options">
        {[
          { key: 'allowCancel', label: 'Allow submitter to cancel pending request' },
          { key: 'autoPdf', label: 'Auto-generate PDF on workflow completion' },
        ].map((opt) => (
          <label
            key={opt.key}
            className="flex items-center justify-between text-sm text-fg"
          >
            <span>{opt.label}</span>
            <input
              type="checkbox"
              checked={!!settings.advanced[opt.key]}
              onChange={(e) => updateAdvanced({ [opt.key]: e.target.checked })}
              className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
            />
          </label>
        ))}
      </Section>
    </div>
  )
}

// Renders one row of node chips joined by arrows. `muted` = smaller styling,
// used for the rejected-branch sub-lines shown beneath the main flow.
function PreviewChips({ path, muted = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {path.map((n, i) => {
        const s = NODE_STYLES[n.type] || NODE_STYLES.start
        return (
          <React.Fragment key={n.id}>
            <span
              className={`rounded-md border font-medium ${s.card} ${s.title} ${
                muted ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
              }`}
            >
              {n.title}
            </span>
            {i < path.length - 1 && <span className="text-fg-subtle">→</span>}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function Step4Review({ data, forms }) {
  const { settings, nodes, connections } = data
  const { main: mainPath, branches, orphans } = useMemo(
    () => buildPreviewPaths(nodes, connections),
    [nodes, connections]
  )
  const slaPolicy = useMemo(() => {
    const approvals = nodes.filter((n) => n.type === 'approval')
    if (approvals.length === 0) return 'No SLA defined'
    return approvals
      .map((a) => `${a.slaValue ?? 24}${(a.slaUnit || 'Hours')[0].toLowerCase()} ${a.title}`)
      .join(' · ')
  }, [nodes])

  const linkedFormTitle = useMemo(() => {
    if (!settings.linkedFormId) return 'None'
    const f = forms.find((x) => x.id === settings.linkedFormId)
    return f ? f.title : '(form not found)'
  }, [forms, settings.linkedFormId])

  const hasApprover = (n) =>
    n.type === 'multiApproval'
      ? Array.isArray(n.approverIds) && n.approverIds.length > 0
      : !!(n.approverId || n.approverRole || n.approver)

  const flowProblems = graphIssues(nodes, connections)

  const checklist = [
    { label: 'Linked form is selected and published', ok: !!settings.linkedFormId },
    {
      label: 'All approval, submit & review nodes have an assigned owner',
      ok: nodes.filter((n) => n.type === 'approval' || n.type === 'multiApproval' || n.type === 'submit' || n.type === 'review').every(hasApprover),
    },
    {
      label: 'SLA deadlines configured on all approval nodes',
      ok: nodes.filter((n) => n.type === 'approval').every((n) => !!n.slaValue),
    },
    {
      label: 'Every step is connected (Decision branches, approvals → next, no orphans)',
      ok: flowProblems.length === 0,
    },
    { label: 'Email notification templates selected', ok: true },
  ]

  const connectionsCount = connections?.length ?? 0

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold text-fg">Review &amp; publish</h2>
        <p className="text-sm text-fg-muted mt-1">
          Everything looks good. Review the summary below, then hit Publish.
        </p>
      </div>

      <Section title="Workflow summary">
        <div className="flex justify-end -mt-2">
          <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">
            Draft
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          {[
            ['Name', settings.name || '(unnamed)'],
            ['Category', settings.category],
            ['Linked form', linkedFormTitle],
            ['Trigger', settings.triggerOn],
            ['Visibility',
              settings.visibility === 'company'
                ? 'Company-wide'
                : settings.visibility === 'departments'
                  ? (settings.visibleDepartments.join(', ') || 'No departments')
                  : `${(settings.visibleTo || []).length} specific ${(settings.visibleTo || []).length === 1 ? 'person' : 'people'}`],
            ['Who can submit', settings.whoCanSubmit],
            ...(settings.whoCanSubmit === 'Specific people'
              ? [[
                  'Initiators',
                  (settings.allowedInitiators || []).length
                    ? `${settings.allowedInitiators.length} specific ${settings.allowedInitiators.length === 1 ? 'person' : 'people'}`
                    : 'None selected',
                ]]
              : []),
            ['SLA policy', slaPolicy],
            [
              'PDF generation',
              settings.advanced.autoPdf ? 'Enabled on completion' : 'Disabled',
            ],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="col-span-1 text-fg-muted">{k}</dt>
              <dd className="col-span-2 font-medium text-fg">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Section>

      <Section title="Workflow canvas preview">
        <div className="flex items-center justify-between -mt-2 mb-1">
          <span className="text-xs text-fg-muted">
            {nodes.length} nodes · {connectionsCount} connections
          </span>
        </div>
        {/* Main (approved) flow rendered inline; each Decision's rejected branch
            drops straight DOWN from its Decision chip (↓) so the split reads
            top-to-bottom (e.g. Decision ↓ Notify → End) instead of as a
            left-side sub-line. */}
        <div className="flex flex-wrap items-start gap-2">
          {mainPath.map((n, i) => {
            const s = NODE_STYLES[n.type] || NODE_STYLES.start
            const branch = branches.find((b) => b[0]?.id === n.id)
            return (
              <React.Fragment key={n.id}>
                <div className="flex flex-col items-center gap-1">
                  <span className={`px-3 py-1.5 rounded-md border text-sm font-medium ${s.card} ${s.title}`}>
                    {n.title}
                  </span>
                  {branch && (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <span className="text-rose-400 leading-none">↓</span>
                      <span className="text-[10px] font-medium text-rose-500">reject</span>
                      <PreviewChips path={branch.slice(1)} muted />
                    </div>
                  )}
                </div>
                {i < mainPath.length - 1 && <span className="text-fg-subtle leading-9">→</span>}
              </React.Fragment>
            )
          })}
        </div>
        {orphans.length > 0 && (
          <div className="mt-3 pl-2">
            <p className="text-[11px] font-medium text-amber-600 mb-1">Not connected to the flow</p>
            <PreviewChips path={orphans} muted />
          </div>
        )}
      </Section>

      <Section title="Checklist before publishing">
        <ul className="-my-2">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 py-2 border-b border-line last:border-0">
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center ${
                  c.ok ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm text-fg">{c.label}</span>
            </li>
          ))}
        </ul>
      </Section>

      {flowProblems.length > 0 && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
          <p className="font-semibold mb-1.5">Fix these before publishing:</p>
          <ul className="list-disc pl-5 space-y-1">
            {flowProblems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900">
        Publishing will make this workflow live immediately. Existing form submissions will be
        routed through this workflow. You can pause or unpublish at any time from the workflow list.
      </div>
    </div>
  )
}

function NewWorkflow() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEditMode = !!editId
  const forms = useForms()
  // Edit mode starts at the canvas (step 2); create mode starts at template picker (step 1).
  const [step, setStep] = useState(isEditMode ? 2 : 1)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [loadError, setLoadError] = useState('')

  const [data, setData] = useState(() => {
    const tpl = TEMPLATES.find((t) => t.id === 'scratch')
    return {
      template: 'scratch',
      nodes: tpl.defaults.nodes.map((n) => ({ ...n })),
      connections: tpl.defaults.connections.map((c) => ({ ...c })),
      selectedNodeId: null,
      settings: {
        name: '',
        description: '',
        category: 'HR',
        linkedFormId: null,
        triggerOn: 'Every form submission',
        preventDuplicates: true,
        whoCanSubmit: 'All employees',
        visibleDepartments: [...WORKFLOW_CATEGORIES],
        allowedInitiators: [],
        visibility: 'company',
        visibleTo: [],
        notifyOnSlaBreach: 'Always',
        advanced: {
          allowCancel: false,
          autoPdf: true,
        },
      },
    }
  })

  // In edit mode, fetch the existing workflow and populate the form state.
  useEffect(() => {
    if (!editId) return
    ;(async () => {
      try {
        const { workflow } = await api.get(`/api/workflows/${editId}`)
        const nodes = deserializeNodes(workflow.nodes)
        const connections = deserializeEdges(workflow.edges)
        setData((d) => ({
          ...d,
          nodes,
          connections,
          settings: {
            ...d.settings,
            name: workflow.title || '',
            description: workflow.description || '',
            category: workflow.department || 'HR',
            linkedFormId: workflow.linkedFormId || null,
            whoCanSubmit: SUBMITTER_OPTIONS.includes(workflow.access?.whoCanSubmit)
              ? workflow.access.whoCanSubmit
              : d.settings.whoCanSubmit,
            visibleDepartments: workflow.access?.departments?.length
              ? workflow.access.departments
              : d.settings.visibleDepartments,
            allowedInitiators: (workflow.access?.allowedInitiators || []).map((x) => String(x)),
            visibility:
              workflow.access?.visibility ||
              (workflow.access?.departments?.length ? 'departments' : 'company'),
            visibleTo: (workflow.access?.visibleTo || []).map((x) => String(x)),
            triggerOn: TRIGGER_OPTIONS.includes(workflow.triggerOn)
              ? workflow.triggerOn
              : d.settings.triggerOn,
            preventDuplicates: workflow.preventDuplicates === true,
            notifyOnSlaBreach: workflow.notifyOnSlaBreach || d.settings.notifyOnSlaBreach,
            advanced: {
              ...d.settings.advanced,
              allowCancel: workflow.advanced?.allowCancel === true,
              autoPdf: workflow.advanced?.autoPdf === true,
            },
          },
        }))
      } catch (err) {
        setLoadError(err.message || 'Could not load workflow')
      }
    })()
  }, [editId])

  const applyTemplate = (templateId) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    // Try to auto-select a published form whose title matches the hint.
    const hint = (tpl.defaults.formHint || '').toLowerCase()
    const matched = hint
      ? forms.find(
          (f) => f.status === 'Published' && f.title.toLowerCase().includes(hint)
        )
      : null

    setData((d) => ({
      ...d,
      template: templateId,
      nodes: tpl.defaults.nodes.map((n) => ({ ...n })),
      connections: tpl.defaults.connections.map((c) => ({ ...c })),
      selectedNodeId: null,
      settings: {
        ...d.settings,
        name: tpl.defaults.name || d.settings.name,
        category: tpl.defaults.category || d.settings.category,
        description: tpl.defaults.description || d.settings.description,
        linkedFormId: matched ? matched.id : d.settings.linkedFormId,
      },
    }))
  }

  const handleDiscard = async () => {
    if (await confirm({ title: 'Discard workflow?', message: 'Unsaved changes will be lost.', confirmLabel: 'Discard', danger: false })) {
      navigate('/workflows')
    }
  }

  const handlePublish = async () => {
    setPublishError('')
    const issues = graphIssues(data.nodes, data.connections)
    if (issues.length) {
      setPublishError(`Can't publish yet — ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}`)
      return
    }
    setPublishing(true)
    try {
      const payload = {
        name: data.settings.name || 'Untitled workflow',
        description: data.settings.description,
        category: data.settings.category,
        linkedFormId: data.settings.linkedFormId || undefined,
        access: {
          whoCanSubmit: data.settings.whoCanSubmit,
          allowedInitiators:
            data.settings.whoCanSubmit === 'Specific people'
              ? data.settings.allowedInitiators || []
              : [],
          visibility: data.settings.visibility,
          // departments only apply in 'departments' mode; "all selected" → [] (open).
          departments:
            data.settings.visibility !== 'departments'
              ? []
              : (data.settings.visibleDepartments || []).length >= WORKFLOW_CATEGORIES.length
                ? []
                : data.settings.visibleDepartments,
          visibleTo:
            data.settings.visibility === 'people' ? data.settings.visibleTo || [] : [],
        },
        triggerOn: data.settings.triggerOn,
        preventDuplicates: data.settings.preventDuplicates === true,
        notifyOnSlaBreach: data.settings.notifyOnSlaBreach,
        advanced: {
          allowCancel: data.settings.advanced.allowCancel === true,
          autoPdf: data.settings.advanced.autoPdf === true,
        },
        nodes: serializeNodes(data.nodes, data.connections),
        edges: serializeEdges(data.connections)
      }
      if (isEditMode) {
        const updated = await workflowsStore.update(editId, payload)
        // Only publish if the updated doc came back as a draft (e.g. it was
        // paused before editing). If it's already published the PUT preserved
        // that status and a second publish call is unnecessary.
        if (updated.status !== 'Active') {
          await workflowsStore.publish(updated.id)
        }
      } else {
        const created = await workflowsStore.add(payload)
        await workflowsStore.publish(created.id)
      }
      navigate('/workflows')
    } catch (err) {
      setPublishError(err.message || 'Failed to save workflow')
    } finally {
      setPublishing(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="p-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm max-w-md text-center">
          <p className="font-semibold mb-1">Could not load workflow</p>
          <p>{loadError}</p>
          <button onClick={() => navigate('/workflows')} className="mt-4 px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition">Back to workflows</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-2 text-fg">


      <StepIndicator current={step} />

      <main className="flex-1 p-6 overflow-y-auto">
        {step === 1 && !isEditMode && <Step1Template selected={data.template} onSelect={applyTemplate} />}
        {step === 2 && <Step2Builder data={data} setData={setData} />}
        {step === 3 && <Step3Settings data={data} setData={setData} forms={forms} />}
        {step === 4 && (
          <>
            <Step4Review data={data} forms={forms} />
            {publishError && (
              <div className="max-w-3xl mx-auto mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                {publishError}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="h-16 bg-surface border-t border-line px-6 flex items-center justify-between">
        <p className="text-sm text-fg-muted">Step {step} of {STEPS.length}</p>
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          <button
            onClick={handleDiscard}
            className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Discard
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition flex items-center gap-1.5"
            >
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {publishing ? 'Saving…' : isEditMode ? 'Save & publish' : 'Publish workflow'}
            </button>
          )}
        </div>
      </footer>
      
    </div>
  )
}

// Frontend uses 'notify' but the backend Workflow.node enum spells it
// 'notification'. Mongoose silently rejects the doc without this map.
const NODE_TYPE_TO_API = {
  start: 'start',
  approval: 'approval',
  multiApproval: 'multiApproval',
  submit: 'submit',
  review: 'review',
  condition: 'condition',
  notify: 'notification',
  api: 'api',
  timer: 'timer',
  end: 'end'
}

const SLA_UNIT_TO_HOURS = { Minutes: 1 / 60, Hours: 1, Days: 24 }

const toHours = (value, unit) => {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return 48
  return Math.max(1, Math.round(v * (SLA_UNIT_TO_HOURS[unit] ?? 1)))
}

// Structural checks run before publishing. These catch the broken graphs that
// otherwise fail silently at runtime (e.g. a Decision node whose branches are
// not connected, an approval with no next step, or an orphaned node).
function graphIssues(nodes, connections) {
  const issues = []
  const conns = connections || []
  const label = (n) => n.title || n.id
  const outFrom = (id) => conns.filter((c) => c.from === id)

  for (const n of nodes) {
    if (n.type === 'condition') {
      const hasApprove = conns.some((c) => c.from === n.id && c.branch === 'approve')
      const hasReject = conns.some((c) => c.from === n.id && c.branch === 'reject')
      if (!hasApprove || !hasReject) {
        const missing = [!hasApprove && 'Approved', !hasReject && 'Rejected']
          .filter(Boolean)
          .join(' and ')
        issues.push(`Decision "${label(n)}" is missing its ${missing} branch — drag a connection from it to the next step.`)
      }
    }
    if (n.type === 'review') {
      const hasForward = conns.some((c) => c.from === n.id && c.branch === 'approve')
      const hasChanges = conns.some((c) => c.from === n.id && c.branch === 'reject')
      if (!hasForward || !hasChanges) {
        const missing = [!hasForward && 'No-changes / forward', !hasChanges && 'Changes-required']
          .filter(Boolean)
          .join(' and ')
        issues.push(`Review "${label(n)}" is missing its ${missing} branch — drag a connection from it to the next step.`)
      }
    }
    if ((n.type === 'approval' || n.type === 'multiApproval' || n.type === 'submit' || n.type === 'notify' || n.type === 'api' || n.type === 'timer') && outFrom(n.id).length === 0) {
      issues.push(`"${label(n)}" has no next step — connect it to the following node (e.g. the next approval or End).`)
    }
  }

  // Reachability from the Start node.
  const start = nodes.find((n) => n.type === 'start')
  if (start) {
    const seen = new Set([start.id])
    const stack = [start.id]
    while (stack.length) {
      const id = stack.pop()
      for (const c of conns.filter((c) => c.from === id)) {
        if (!seen.has(c.to)) {
          seen.add(c.to)
          stack.push(c.to)
        }
      }
    }
    for (const n of nodes) {
      if (n.type === 'start') continue
      if (!seen.has(n.id)) {
        issues.push(`"${label(n)}" is not reachable from Start — nothing connects into it.`)
      }
    }
  }

  return issues
}

// Builds the chip preview as a MAIN path (Start → … → End, following the
// approved/plain edges) plus one sub-line per Decision's rejected branch
// (Decision → … → merge node, usually End). A single straight line can't show a
// branch that splits and re-merges, so the rejected path is rendered beneath the
// main flow. `orphans` surfaces any node reachable by neither, so nothing hides.
function buildPreviewPaths(nodes, connections) {
  const list = nodes || []
  const byId = new Map(list.map((n) => [n.id, n]))
  const start = list.find((n) => n.type === 'start') || list[0]
  if (!start) return { main: list, branches: [], orphans: [] }

  const outBy = new Map()
  for (const c of connections || []) {
    if (!outBy.has(c.from)) outBy.set(c.from, [])
    outBy.get(c.from).push(c)
  }
  // Primary edge = the approved branch, else a plain edge, else whatever exists.
  const primary = (id) => {
    const e = outBy.get(id) || []
    return (
      e.find((c) => c.branch === 'approve') ||
      e.find((c) => !c.branch && !c.dashed) ||
      e[0]
    )
  }

  // Main line: walk primary edges from Start until End / a repeat / a dead end.
  const main = []
  const onMain = new Set()
  let cur = start.id
  while (cur && byId.has(cur) && !onMain.has(cur)) {
    onMain.add(cur)
    main.push(byId.get(cur))
    cur = primary(cur)?.to
  }

  // One sub-line per Decision reject/false branch: Decision → … → (merge node).
  const branches = []
  for (const node of main) {
    if (node.type !== 'condition' && node.type !== 'review') continue
    const rej = (outBy.get(node.id) || []).find((c) => c.branch === 'reject' || c.dashed)
    if (!rej) continue
    const line = [node] // include the Decision for context
    const seen = new Set([node.id])
    let id = rej.to
    while (id && byId.has(id) && !seen.has(id)) {
      seen.add(id)
      line.push(byId.get(id))
      if (onMain.has(id)) break // merged back into the main path (e.g. End)
      id = primary(id)?.to
    }
    if (line.length > 1) branches.push(line)
  }

  // Anything shown in neither the main line nor a branch (truly disconnected).
  const shown = new Set(onMain)
  for (const b of branches) for (const n of b) shown.add(n.id)
  const orphans = list.filter((n) => !shown.has(n.id))

  return { main, branches, orphans }
}

function serializeNodes(nodes, connections) {
  // Build a map for nextNode. For most nodes this is just the first outgoing
  // edge. For Decision (condition) nodes we deliberately skip — branching is
  // expressed via truePath / falsePath in config, not via a single nextNode.
  const firstNext = new Map()
  for (const c of connections || []) {
    if (c.branch) continue
    if (!firstNext.has(c.from)) firstNext.set(c.from, c.to)
  }

  // Index Decision branch targets so we can compose config.truePath / falsePath.
  const approveTargetByFrom = new Map()
  const rejectTargetByFrom = new Map()
  for (const c of connections || []) {
    if (c.branch === 'approve' && !approveTargetByFrom.has(c.from)) {
      approveTargetByFrom.set(c.from, c.to)
    }
    if (c.branch === 'reject' && !rejectTargetByFrom.has(c.from)) {
      rejectTargetByFrom.set(c.from, c.to)
    }
  }

  return nodes.map((n) => {
    const config = {}
    if (n.type === 'approval') {
      // Prefer a specific assigned user; fall back to a semantic role token.
      // Backward compat: older nodes might still carry a free-form `approver`
      // string (e.g. "Direct manager") from the previous demo UI.
      if (n.approverId) {
        config.approverId = n.approverId
      } else if (n.approverRole) {
        config.approverRole = n.approverRole
      } else if (n.approver) {
        config.approverRole = n.approver
      }
      config.slaHours = toHours(n.slaValue, n.slaUnit)
      config.approvalType = n.sequential ? 'sequential' : 'parallel'
      config.requireSignature = n.requireSignature === true
    }
    if (n.type === 'multiApproval') {
      // Committee approval: an explicit list of people + how many (N of M) must
      // approve. The engine builds one shared task from these.
      const ids = Array.isArray(n.approverIds) ? n.approverIds.filter(Boolean) : []
      config.approverIds = ids
      config.requiredApprovals = Math.min(
        Math.max(1, Number(n.requiredApprovals) || 1),
        Math.max(1, ids.length)
      )
      config.slaHours = toHours(n.slaValue, n.slaUnit)
      config.requireSignature = n.requireSignature === true
    }
    if (n.type === 'submit') {
      // Submit node: the assignee fills an inline form + comment to advance.
      // Reuses the approver fields to resolve who the submission task goes to.
      if (n.approverId) {
        config.approverId = n.approverId
      } else if (n.approverRole) {
        config.approverRole = n.approverRole
      } else if (n.approver) {
        config.approverRole = n.approver
      }
      config.instructions = n.instructions || ''
      config.formFields = Array.isArray(n.formFields) ? n.formFields : []
      config.slaHours = toHours(n.slaValue, n.slaUnit)
    }
    if (n.type === 'review') {
      // Review (viewer) node: assigns a reviewer (reuses the approver fields) and
      // branches like a Decision. Forward (no changes) = 'approve' edge, Changes
      // required = 'reject' edge. Engine reads config.forwardPath / changesPath.
      if (n.approverId) {
        config.approverId = n.approverId
      } else if (n.approverRole) {
        config.approverRole = n.approverRole
      } else if (n.approver) {
        config.approverRole = n.approver
      }
      config.instructions = n.instructions || ''
      config.slaHours = toHours(n.slaValue, n.slaUnit)
      const forwardPath = approveTargetByFrom.get(n.id)
      const changesPath = rejectTargetByFrom.get(n.id)
      if (forwardPath) config.forwardPath = forwardPath
      if (changesPath) config.changesPath = changesPath
    }
    if (n.type === 'api') {
      // Integration / webhook node: outbound HTTP call config.
      config.apiUrl = n.apiUrl || ''
      config.apiMethod = n.apiMethod || 'POST'
      config.apiHeaders = (Array.isArray(n.apiHeaders) ? n.apiHeaders : [])
        .filter((h) => h && h.key)
        .map((h) => ({ key: h.key, value: h.value || '' }))
      config.apiBody = n.apiBody || ''
      config.apiAuth = {
        mode: n.apiAuth?.mode || 'none',
        token: n.apiAuth?.token || '',
        username: n.apiAuth?.username || '',
        password: n.apiAuth?.password || ''
      }
      config.saveResponseAs = n.saveResponseAs || ''
      config.continueOnError = n.continueOnError !== false
    }
    if (n.type === 'condition') {
      // Decision nodes branch on whether the immediately preceding approval
      // was approved or rejected. The engine's `advanceWorkflow` caches that
      // outcome as `variables.lastApprovalOutcome`.
      config.conditionField = 'lastApprovalOutcome'
      config.conditionOperator = 'eq'
      config.conditionValue = 'approved'
      const truePath = approveTargetByFrom.get(n.id)
      const falsePath = rejectTargetByFrom.get(n.id)
      if (truePath) config.truePath = truePath
      if (falsePath) config.falsePath = falsePath
    }
    if (n.type === 'timer') {
      config.slaHours = toHours(n.waitValue, n.waitUnit)
    }
    if (n.type === 'end') {
      config.generatePdf = n.generatePdf === true
    }
    return {
      id: n.id,
      type: NODE_TYPE_TO_API[n.type] || n.type,
      label: n.title,
      position: { x: n.x, y: n.y },
      config,
      nextNode: firstNext.get(n.id)
    }
  })
}

function serializeEdges(connections) {
  return (connections || []).map((c, i) => {
    let label = ''
    if (c.branch === 'approve') label = 'approved'
    else if (c.branch === 'reject') label = 'rejected'
    else if (c.dashed) label = 'reject'
    return {
      id: `e${i}`,
      source: c.from,
      target: c.to,
      label
    }
  })
}

// Reverse of NODE_TYPE_TO_API — map backend type back to UI type.
const API_NODE_TYPE_TO_UI = {
  start: 'start',
  approval: 'approval',
  multiApproval: 'multiApproval',
  submit: 'submit',
  review: 'review',
  condition: 'condition',
  notification: 'notify',
  api: 'api',
  timer: 'timer',
  end: 'end',
  document: 'end',
}

const SLA_HOURS_TO_DISPLAY = (hours) => {
  if (!hours) return { slaValue: 48, slaUnit: 'Hours' }
  if (hours < 1) return { slaValue: Math.round(hours * 60), slaUnit: 'Minutes' }
  if (hours % 24 === 0 && hours >= 24) return { slaValue: hours / 24, slaUnit: 'Days' }
  return { slaValue: hours, slaUnit: 'Hours' }
}

function deserializeNodes(apiNodes) {
  return (apiNodes || []).map((n) => {
    const uiType = API_NODE_TYPE_TO_UI[n.type] || n.type
    const base = {
      id: n.id,
      type: uiType,
      title: n.label || n.id,
      subtitle: '',
      x: n.position?.x ?? 300,
      y: n.position?.y ?? 40,
    }
    const cfg = n.config || {}
    if (uiType === 'approval') {
      const { slaValue, slaUnit } = SLA_HOURS_TO_DISPLAY(cfg.slaHours)
      Object.assign(base, {
        approverRole: cfg.approverRole || '',
        approverId: cfg.approverId || null,
        slaValue,
        slaUnit,
        sequential: cfg.approvalType !== 'parallel',
        requireSignature: cfg.requireSignature === true,
      })
    }
    if (uiType === 'multiApproval') {
      const { slaValue, slaUnit } = SLA_HOURS_TO_DISPLAY(cfg.slaHours)
      const ids = Array.isArray(cfg.approverIds)
        ? cfg.approverIds.map((id) => (id && typeof id === 'object' ? id._id || String(id) : id)).filter(Boolean)
        : []
      Object.assign(base, {
        approverIds: ids,
        requiredApprovals: Math.min(Math.max(1, Number(cfg.requiredApprovals) || 1), Math.max(1, ids.length)),
        requireSignature: cfg.requireSignature === true,
        slaValue,
        slaUnit,
      })
    }
    if (uiType === 'submit') {
      const { slaValue, slaUnit } = SLA_HOURS_TO_DISPLAY(cfg.slaHours)
      Object.assign(base, {
        approverRole: cfg.approverRole || '',
        approverId: cfg.approverId || null,
        instructions: cfg.instructions || '',
        formFields: Array.isArray(cfg.formFields)
          ? cfg.formFields.map((f) => ({
              id: f.id,
              type: f.type,
              label: f.label,
              required: !!f.required,
              placeholder: f.placeholder || '',
              options: Array.isArray(f.options) ? f.options : [],
              conditionalLogic:
                f.conditionalLogic && typeof f.conditionalLogic === 'object'
                  ? f.conditionalLogic
                  : undefined,
              validation:
                f.validation && typeof f.validation === 'object'
                  ? f.validation
                  : undefined,
            }))
          : [],
        slaValue,
        slaUnit,
      })
    }
    if (uiType === 'review') {
      const { slaValue, slaUnit } = SLA_HOURS_TO_DISPLAY(cfg.slaHours)
      Object.assign(base, {
        approverRole: cfg.approverRole || '',
        approverId: cfg.approverId || null,
        instructions: cfg.instructions || '',
        slaValue,
        slaUnit,
      })
    }
    if (uiType === 'api') {
      Object.assign(base, {
        apiUrl: cfg.apiUrl || '',
        apiMethod: cfg.apiMethod || 'POST',
        apiHeaders: Array.isArray(cfg.apiHeaders)
          ? cfg.apiHeaders.map((h) => ({ key: h.key || '', value: h.value || '' }))
          : [],
        apiBody: cfg.apiBody || '',
        apiAuth: {
          mode: cfg.apiAuth?.mode || 'none',
          token: cfg.apiAuth?.token || '',
          username: cfg.apiAuth?.username || '',
          password: cfg.apiAuth?.password || ''
        },
        saveResponseAs: cfg.saveResponseAs || '',
        continueOnError: cfg.continueOnError !== false,
      })
    }
    if (uiType === 'timer') {
      const { slaValue, slaUnit } = SLA_HOURS_TO_DISPLAY(cfg.slaHours)
      Object.assign(base, { waitValue: slaValue, waitUnit: slaUnit })
    }
    if (uiType === 'end') {
      base.generatePdf = cfg.generatePdf === true
    }
    return base
  })
}

function deserializeEdges(apiEdges) {
  return (apiEdges || []).map((e) => {
    const conn = { from: e.source, to: e.target }
    if (e.label === 'approved') conn.branch = 'approve'
    else if (e.label === 'rejected') conn.branch = 'reject'
    else if (e.label === 'reject') conn.dashed = true
    return conn
  })
}

export default NewWorkflow

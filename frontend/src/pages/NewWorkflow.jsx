import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { workflowsStore } from '../lib/workflowsStore'
import { useDepartmentNames } from '../lib/departmentsStore'
import { useForms, formsStore } from '../lib/formsStore'
import { api } from '../utils/api'
import NodeTypesSidebar from './WorkflowCanvas/NodeTypesSidebar'
import WorkflowEditor from './WorkflowCanvas/WorkflowEditor'
import NodeConfig from './WorkflowCanvas/NodeConfig'
import { NODE_DEFAULTS, NODE_STYLES, createNodeId } from './WorkflowCanvas/nodeStyles'
import { confirm } from '../lib/confirmStore'
import { toast } from '../lib/toastStore'
import { useNotificationsPanelOpen } from '../lib/notificationsStore'
import { limitBanner } from '../lib/limitFeedback'
import { AlertBanner } from '../components/Alert'
import { createDraftStore, useBeforeUnloadWarning } from '../utils/localDraft'
import { fetchAllUsers } from '../utils/users'
import { useFocusTrap, useScrollLock } from '../utils/a11y'
import AppShell from '../components/AppShell'
import Modal from '../components/Modal'

const apiBase = () => String(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

const draftStore = createDraftStore('netflow.workflow.draft.v1')
const readDraft = () => {
  const d = draftStore.read()
  return d?.data?.settings ? d : null
}

function webhookUrlFor(token) {
  if (!token) return ''
  return `${apiBase()}/api/hooks/${token}`
}

function PublishSuccessModal({ open, name, webhookUrl, secret, onClose, onGoToList }) {
  const panelRef = useRef(null)
  useScrollLock(open)
  useFocusTrap(open, panelRef, { onEscape: onClose })

  if (!open) return null
  const copy = async (text, label) => {
    try {
      await navigator.clipboard?.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`)
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-success-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl bg-surface border border-line shadow-xl overflow-hidden focus:outline-none"
      >
        <div className="px-5 py-4 border-b border-line flex items-start gap-3">
          <span className="mt-0.5 w-8 h-8 rounded-full bg-success-subtle text-success-fg flex items-center justify-center text-sm font-bold shrink-0">
            ✓
          </span>
          <div className="min-w-0">
            <h2 id="publish-success-title" className="text-base font-semibold text-fg">Workflow published</h2>
            <p className="text-sm text-fg-muted mt-0.5 truncate">
              {name || 'Untitled workflow'} is live.
              {webhookUrl ? ' Copy the webhook credentials below for your external form.' : ''}
            </p>
          </div>
        </div>
        {webhookUrl ? (
          <div className="px-5 py-4 space-y-3">
            <div>
              <label htmlFor="publish-webhook-url" className="block text-xs font-medium text-fg-muted mb-1">Webhook URL</label>
              <div className="flex gap-2">
                <input
                  id="publish-webhook-url"
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-md border border-line bg-surface-2 text-fg"
                />
                <button
                  type="button"
                  onClick={() => copy(webhookUrl, 'Webhook URL')}
                  className="shrink-0 px-3 py-2 text-xs font-medium rounded-md border border-line bg-surface hover:bg-surface-2 text-fg"
                >
                  Copy
                </button>
              </div>
            </div>
            {secret ? (
              <div>
                <label htmlFor="publish-signing-secret" className="block text-xs font-medium text-fg-muted mb-1">Signing secret</label>
                <div className="flex gap-2">
                  <input
                    id="publish-signing-secret"
                    type="text"
                    readOnly
                    value={secret}
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-md border border-line bg-surface-2 text-fg"
                  />
                  <button
                    type="button"
                    onClick={() => copy(secret, 'Signing secret')}
                    className="shrink-0 px-3 py-2 text-xs font-medium rounded-md border border-line bg-surface hover:bg-surface-2 text-fg"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-fg-muted">
                  Send header <code className="text-[10px]">X-NetFlow-Signature: sha256=&lt;hmac&gt;</code> with
                  each POST. You can also find these anytime under Settings.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2 bg-surface-2/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium rounded-md border border-line bg-surface hover:bg-surface-2 text-fg"
          >
            {webhookUrl ? 'Stay in editor' : 'Close'}
          </button>
          <button
            type="button"
            onClick={onGoToList}
            className="px-3 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Go to workflows
          </button>
        </div>
      </div>
    </div>
  )
}

const TEMPLATES = [
  {
    id: 'leave',
    title: 'Leave approval',
    subtitle: 'Employee → Manager → HR two-step leave flow',
    icon: 'calendar',
    iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
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
    icon: 'receipt',
    iconClass: 'bg-success-subtle text-success-fg',
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
    icon: 'key',
    iconClass: 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300',
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
    icon: 'cart',
    iconClass: 'bg-warning-subtle text-warning-fg',
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
    icon: 'userPlus',
    iconClass: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300',
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
    icon: 'plus',
    iconClass: 'bg-surface-3 text-fg-muted',
    defaults: {
      name: '',
      category: 'HR',
      description: '',
      formHint: '',
      nodes: [
        { id: 'n1', type: 'start', title: 'Form submitted', subtitle: 'Start trigger', x: 320, y: 80 },
        { id: 'n2', type: 'end', title: 'Completed', subtitle: 'Finish', x: 320, y: 220 },
      ],
      connections: [{ from: 'n1', to: 'n2' }],
    },
  },
]

function templateMeta(nodes = []) {
  const steps = nodes.length
  const approvals = nodes.filter((n) => n.type === 'approval' || n.type === 'multiApproval').length
  const branching = nodes.some((n) => n.type === 'condition')
  const parts = [
    `${steps} step${steps === 1 ? '' : 's'}`,
    `${approvals} approval${approvals === 1 ? '' : 's'}`,
  ]
  if (branching) parts.push('branching')
  return parts.join(' · ')
}

function TemplateIcon({ name, className = 'w-5 h-5' }) {
  const props = {
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: '2',
    'aria-hidden': 'true',
  }
  switch (name) {
    case 'calendar':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'receipt':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
        </svg>
      )
    case 'key':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      )
    case 'cart':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    case 'userPlus':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
  }
}

// The category *is* the owning department (it saves to Workflow.department), so
// both pickers read the tenant's own list from useDepartmentNames() rather than
// a constant — an org that renamed "Finance" to "Commercial" must not be shown
// a category it no longer uses.

// 'Manual trigger only' saves the linked form submission but does NOT auto-fire
// the workflow — it can be started later via the execute endpoint instead.
const TRIGGER_OPTIONS = [
  'Every form submission',
  'Manual trigger only',
]

const SUBMITTER_OPTIONS = [
  'All employees',
  'Specific roles',
  'Specific people',
  'Specific departments',
  'Managers only',
]

const SLA_OPTIONS = ['Always', 'After first breach', 'Never']

function Step1Template({
  selected,
  onSelect,
  aiAvailable,
  aiPrompt,
  onAiPromptChange,
  onAiKeyDown,
  aiSuggestion,
  aiBusy,
  generateWithAI,
  aiError,
  showAiPanel,
  setShowAiPanel,
  aiInputRef,
}) {
  return (
    <div className="max-w-4xl mx-auto py-2 pb-12">
      {/* Title & Subtitle */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Choose a template to start with
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Pick a pre-built workflow or start from scratch. You can customise everything in the next step.
        </p>
      </div>

      {/* Templates Grid (2 Columns x 3 Rows) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {TEMPLATES.map((t) => {
          const isSelected = selected === t.id && !showAiPanel
          const dept = t.defaults.category || 'General'

          let iconBg = 'bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-300'
          let tagBg = 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
          let countsText = `${t.defaults.nodes.length} steps · ${t.defaults.connections.length} connections`

          if (t.id === 'expense') {
            iconBg = 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-300'
            tagBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
          } else if (t.id === 'it') {
            iconBg = 'bg-purple-50 text-purple-500 dark:bg-purple-500/15 dark:text-purple-300'
            tagBg = 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300'
          } else if (t.id === 'po') {
            iconBg = 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300'
            tagBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
          } else if (t.id === 'onboarding') {
            iconBg = 'bg-pink-50 text-pink-500 dark:bg-pink-500/15 dark:text-pink-300'
            tagBg = 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
          } else if (t.id === 'scratch') {
            iconBg = 'bg-purple-50 text-purple-500 dark:bg-purple-500/15 dark:text-purple-300'
            tagBg = 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
          }

          return (
            <div
              key={t.id}
              onClick={() => {
                setShowAiPanel(false)
                onSelect(t.id)
              }}
              className={`group relative text-left p-6 rounded-2xl border bg-white dark:bg-slate-800/80 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[145px] ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/10 dark:bg-indigo-500/10'
                  : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-500/40'
              }`}
            >
              <div>
                {/* Top Row: Branch Icon + Category Badge + Checkmark (if selected) */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="6" cy="6" r="2" />
                      <circle cx="18" cy="12" r="2" />
                      <circle cx="6" cy="18" r="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7.5l7 3.5M8 16.5l7-3.5" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagBg}`}>
                      {t.id === 'scratch' ? 'Blank' : dept}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-600 transition">
                  {t.title}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">
                  {t.subtitle}
                </p>
              </div>

              {/* Card Footer: steps & connections count */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/40 flex items-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {countsText}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Option Button & Panel */}
      {aiAvailable && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => {
              setShowAiPanel(true)
              onSelect('ai_generated')
            }}
            aria-pressed={showAiPanel}
            className={`w-full flex items-center gap-4 text-left p-4 rounded-2xl border transition ${
              showAiPanel
                ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-500/10 ring-2 ring-indigo-500/30'
                : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 hover:border-indigo-300'
            }`}
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Build with AI</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Describe your process in plain English and let AI build it</p>
            </div>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
              showAiPanel ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
            }`}>
              {showAiPanel && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            </span>
          </button>

          {showAiPanel && (
            <div className="mt-4 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <label htmlFor="ai-workflow-prompt" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                What kind of workflow do you need?
              </label>
              <textarea
                id="ai-workflow-prompt"
                ref={aiInputRef}
                rows={3}
                value={aiPrompt}
                onChange={onAiPromptChange}
                onKeyDown={onAiKeyDown}
                disabled={aiBusy}
                placeholder="e.g. A purchase order request that needs department head approval, and CFO approval if the amount is over $10k."
                className="w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              <div className="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={generateWithAI}
                  disabled={aiBusy || !aiPrompt.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                >
                  {aiBusy ? 'Generating...' : 'Generate Workflow'}
                </button>
              </div>
              {aiError && <p className="mt-2 text-xs text-rose-500">{aiError}</p>}
            </div>
          )}
        </div>
      )}
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

const GRID = 10
const snap = (v) => Math.round(v / GRID) * GRID

// Decision / Review need tagged approve|reject edges. A plain drag from those
// nodes gets the next free branch so a dashed “looks connected” line isn’t left
// untagged (which would fail at publish / runtime).
function withBranchIfNeeded(fromNode, conn, existing) {
  if (!fromNode || (fromNode.type !== 'condition' && fromNode.type !== 'review')) {
    return conn
  }
  if (conn.branch === 'approve' || conn.branch === 'reject') return conn
  const outs = existing.filter((c) => c.from === conn.from)
  const hasApprove = outs.some((c) => c.branch === 'approve' || (!c.branch && !c.dashed))
  const hasReject = outs.some((c) => c.branch === 'reject' || c.dashed)
  if (!hasApprove) return { ...conn, branch: 'approve', dashed: false }
  if (!hasReject) return { ...conn, branch: 'reject', dashed: true }
  return conn
}

function Step2Builder({ data, setData, fitKey = 0, stepperHeader = null }) {
  const { nodes, connections, selectedNodeId } = data
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null
  const [isMaximized, setIsMaximized] = useState(false)
  const [isStepperCollapsed, setIsStepperCollapsed] = useState(false)
  const notifPanelOpen = useNotificationsPanelOpen()
  const flowProblems = useMemo(
    () => graphIssues(nodes, connections),
    [nodes, connections]
  )
  const problemNodeIds = useMemo(() => {
    const ids = new Set()
    for (const issue of flowProblems) {
      for (const id of issue.nodeIds || []) ids.add(id)
    }
    return ids
  }, [flowProblems])

  const selectNode = (id) => setData((d) => ({ ...d, selectedNodeId: id }))

  const updateNode = (updated) =>
    setData((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === updated.id ? updated : n)) }))

  // Snap to a 10px grid so hand-placed nodes still line up with each other.
  const moveNode = (id, x, y) =>
    setData((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === id ? { ...n, x: snap(x), y: snap(y) } : n)),
    }))

  const resizeNode = (id, w, h) =>
    setData((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === id ? { ...n, w, h } : n)),
    }))

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
    const node = { id, type, x: snap(x), y: snap(y), ...def }
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
      const y = tail ? Math.min(tail.y + 120, 3900) : 40
      const node = { id, type, x, y, ...def }

      // Skip auto-connect if the tail already has an outgoing edge to avoid
      // silently inserting a stray branch — user can wire it manually.
      const tailHasOutgoing =
        tail && d.connections.some((c) => c.from === tail.id)

      let nextConnections = d.connections
      if (tail && !tailHasOutgoing) {
        const conn = withBranchIfNeeded(tail, { from: tail.id, to: id }, d.connections)
        nextConnections = [...d.connections, conn]
      }

      return {
        ...d,
        nodes: [...d.nodes, node],
        connections: nextConnections,
        selectedNodeId: id,
      }
    })
  }

  const addConnection = (conn) =>
    setData((d) => {
      const fromNode = d.nodes.find((n) => n.id === conn.from)
      const next = withBranchIfNeeded(fromNode, conn, d.connections)
      return { ...d, connections: [...d.connections, next] }
    })

  const deleteConnection = (idx) =>
    setData((d) => ({ ...d, connections: d.connections.filter((_, i) => i !== idx) }))

  const setConnections = (next) =>
    setData((d) => ({ ...d, connections: typeof next === 'function' ? next(d.connections) : next }))

  const jumpToProblem = (issue) => {
    const id = issue?.nodeIds?.[0]
    if (id) selectNode(id)
  }

  return (
    <div className={`bg-surface overflow-hidden transition-all duration-300 ${isMaximized ? 'fixed inset-0 z-50 flex flex-col' : 'flex-1 min-h-0 flex flex-col'}`}>
      <div className="flex flex-1 min-h-0">
        {!isMaximized && <NodeTypesSidebar onAddNode={addNodeAfterTail} />}
        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          {!isMaximized && (
            <>
              <div
                className={`grid shrink-0 transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                  isStepperCollapsed
                    ? 'grid-rows-[0fr] opacity-0'
                    : 'grid-rows-[1fr] opacity-100'
                }`}
              >
                <div className="min-h-0 overflow-hidden">{stepperHeader}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsStepperCollapsed((collapsed) => !collapsed)}
                aria-label={isStepperCollapsed ? 'Expand workflow stepper' : 'Collapse workflow stepper'}
                aria-expanded={!isStepperCollapsed}
                title={isStepperCollapsed ? 'Expand stepper' : 'Collapse stepper'}
                className={`absolute top-2 right-3 z-30 w-7 h-7 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm backdrop-blur flex items-center justify-center transition-colors ${notifPanelOpen ? 'invisible' : ''}`}
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${isStepperCollapsed ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </button>
            </>
          )}
          <div className="flex flex-1 min-h-0">
            <WorkflowEditor
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized(m => !m)}
              fitKey={fitKey}
              nodes={nodes}
              connections={connections}
              selectedNodeId={selectedNodeId}
              problemNodeIds={problemNodeIds}
              flowProblems={flowProblems}
              onSelectProblem={jumpToProblem}
              onSelectNode={selectNode}
              onMoveNode={moveNode}
              onResizeNode={resizeNode}
              onDropNewNode={addNodeAt}
              onDeleteNode={deleteNode}
              onAddConnection={addConnection}
              onDeleteConnection={deleteConnection}
            />
          </div>
        </div>
        {!isMaximized && (
          <NodeConfig
            node={selectedNode}
            onChange={updateNode}
            nodes={nodes}
            connections={connections}
            onConnectionsChange={setConnections}
            onClose={() => selectNode(null)}
          />
        )}
      </div>
    </div>
  )
}

function Section({ title, description, icon, children }) {
  return (
    <section className="bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-line bg-surface-2/40 flex items-start gap-3">
        {icon && (
          <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0 ring-1 ring-indigo-100 dark:ring-indigo-500/30">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg tracking-tight">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-fg-muted leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-5">{children}</div>
    </section>
  )
}

function FieldLabel({ htmlFor, children, hint }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {children}
      </label>
      {hint && <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>}
    </div>
  )
}

function ToggleRow({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface-2/40 px-4 py-3 cursor-pointer hover:bg-surface-2 transition">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint && <span className="block mt-0.5 text-xs text-fg-muted leading-relaxed">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <span className="w-10 h-6 rounded-full bg-line peer-checked:bg-indigo-600 transition" />
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
    </label>
  )
}

function AiFormGeneratorModal({ open, onClose, workflowName, onApprove }) {
  const [mode, setMode] = useState('config') // 'config' | 'preview'
  const [activeTab, setActiveTab] = useState('auto') // 'auto' | 'custom'
  const [prompt, setPrompt] = useState(`Form for ${workflowName || 'Workflow'}`)
  const [fields, setFields] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editDraft, setEditDraft] = useState({ label: '', required: false, type: 'Text' })
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null)

  const FIELD_TYPES = [
    'Text', 'Number', 'Dropdown', 'Radio', 'Checkbox', 
    'Date', 'File', 'Signature', 'Textarea', 'Grid'
  ]

  useEffect(() => {
    setPrompt(`Form for ${workflowName || 'Workflow'}`)
    setMode('config')
    setActiveTab('auto')
    setEditingIndex(null)
    setConfirmDeleteIndex(null)
  }, [workflowName, open])

  if (!open) return null

  const handleGeneratePreview = async () => {
    try {
      setIsGenerating(true)
      const res = await api.post('/api/forms/ai-draft', { prompt })
      if (res.fields) {
        const withIds = res.fields.map(f => ({
          ...f,
          id: f.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f_${Math.random().toString(36).slice(2, 8)}`)
        }))
        setFields(withIds)
        setMode('preview')
        toast.success('Generated form preview from AI')
      } else {
        throw new Error('No fields generated')
      }
    } catch (err) {
      toast.error(err.message || 'AI generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const startEdit = (idx, f) => {
    setConfirmDeleteIndex(null)
    setEditingIndex(idx)
    setEditDraft({ label: f.label, required: !!f.required, type: f.type || 'Text' })
  }

  const saveEdit = (idx) => {
    if (!editDraft.label.trim()) {
      toast.error('Field label cannot be empty')
      return
    }
    setFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...editDraft, label: editDraft.label.trim() } : f))
    )
    setEditingIndex(null)
  }

  const cancelEdit = () => {
    setEditingIndex(null)
  }

  const requestDelete = (idx) => {
    setEditingIndex(null)
    setConfirmDeleteIndex(idx)
  }

  const cancelDelete = () => {
    setConfirmDeleteIndex(null)
  }

  const confirmDelete = (idx) => {
    setFields((prev) => prev.filter((_, i) => i !== idx))
    setConfirmDeleteIndex(null)
    if (editingIndex === idx) setEditingIndex(null)
    toast.success('Field deleted')
  }

  const handleAddField = () => {
    setConfirmDeleteIndex(null)
    const newFieldId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f_${Math.random().toString(36).slice(2, 8)}`
    const newField = { id: newFieldId, label: 'New Field', required: false, type: 'Text' }
    setFields((prev) => [...prev, newField])
    setEditingIndex(fields.length)
    setEditDraft(newField)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI Form Generator"
      size="lg"
      className="max-w-lg"
    >
      {mode === 'config' ? (
        /* STEP 1: Auto-Generate / Custom Prompt Config Screen */
        <div className="space-y-5 pt-1">
          {/* Tab Selection */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === 'auto'
                  ? 'border-[#6366F1] text-[#6366F1] dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Auto-Generate (Fast)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === 'custom'
                  ? 'border-[#6366F1] text-[#6366F1] dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Custom Prompt
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'auto' ? (
            <div className="py-2 space-y-1.5 min-h-[70px]">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                The AI will automatically generate a form based on the workflow name:
              </p>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                {workflowName || 'Workflow'}
              </p>
            </div>
          ) : (
            <div className="py-1 space-y-2 min-h-[70px]">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Describe the fields needed:
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Employee name, Reason for request, Start date, Department..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={isGenerating}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#6366F1] hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md shadow-indigo-500/20 transition cursor-pointer"
            >
              {isGenerating ? 'Generating...' : 'Generate Preview'}
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: Form Fields Preview & Inline Editing Screen */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('config')}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                title="Back to config"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {workflowName || 'Workflow'} — Preview
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Generated fields preview (Editable)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddField}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Field
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 sidebar-scroll">
            {fields.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                No fields available. Click &ldquo;Add Field&rdquo; to add custom fields.
              </div>
            ) : (
              fields.map((f, idx) => {
                const isEditing = editingIndex === idx
                const isConfirmingDelete = confirmDeleteIndex === idx

                if (isConfirmingDelete) {
                  return (
                    <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-rose-50/70 dark:bg-rose-950/30 border-l-4 border-rose-500 transition">
                      <div className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                        Delete &ldquo;{f.label}&rdquo;?
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={cancelDelete}
                          className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDelete(idx)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  )
                }

                if (isEditing) {
                  return (
                    <div key={idx} className="p-3 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editDraft.label}
                          onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                          placeholder="Field label..."
                          className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          autoFocus
                        />
                        <select
                          value={editDraft.type}
                          onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editDraft.required}
                            onChange={(e) => setEditDraft((d) => ({ ...d, required: e.target.checked }))}
                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          Required field
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(idx)}
                            className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={idx} className="group flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <div className="flex items-center text-slate-800 dark:text-slate-200 font-medium text-sm truncate mr-2">
                      <span className="truncate">{f.label}</span>
                      {f.required && <span className="text-rose-500 font-bold ml-1 shrink-0">*</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80">
                        {f.type}
                      </span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEdit(idx, f)}
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 transition cursor-pointer"
                          title="Edit Field"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(idx)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition cursor-pointer"
                          title="Delete Field"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode('config')}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer shadow-2xs"
            >
              Back to Prompt
            </button>
            <button
              type="button"
              onClick={() => {
                onApprove?.(fields)
                onClose()
              }}
              className="px-4.5 py-2.5 text-xs font-bold rounded-xl bg-[#6366F1] hover:bg-indigo-700 text-white transition cursor-pointer shadow-md shadow-indigo-500/20"
            >
              Apply Form &amp; Link
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Step3Settings({ data, setData, forms, editId }) {
  const { settings } = data
  const navigate = useNavigate()
  const [aiFormModalOpen, setAiFormModalOpen] = useState(false)
  const orgDepartments = useDepartmentNames()
  // A workflow written before a department was renamed still names the old one;
  // keep it in the list so opening the page does not quietly re-file the flow.
  const categories = useMemo(
    () => (settings.category && !orgDepartments.includes(settings.category)
      ? [...orgDepartments, settings.category]
      : orgDepartments),
    [orgDepartments, settings.category]
  )
  const update = (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  // A brand-new workflow starts with no category; once the tenant's list
  // arrives, file it under the first team rather than showing an empty select.
  useEffect(() => {
    if (!settings.category && orgDepartments.length) update({ category: orgDepartments[0] })
  }, [settings.category, orgDepartments])
  const updateAdvanced = (patch) =>
    setData((d) => ({
      ...d,
      settings: { ...d.settings, advanced: { ...d.settings.advanced, ...patch } },
    }))
  const updateWebhook = (patch) =>
    update({ inboundWebhook: { ...(settings.inboundWebhook || {}), ...patch } })

  // Active users & roles for access pickers
  const [users, setUsers] = useState([])
  const [tenantRoles, setTenantRoles] = useState(['Manager', 'VP', 'HR', 'Employee', 'Admin', 'Viewer', 'CEO'])
  const [deliveries, setDeliveries] = useState([])
  const [dlq, setDlq] = useState([])
  const [showSecret, setShowSecret] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchAllUsers({ isActive: true })
      .then((d) => { if (!cancelled) setUsers(d.users || []) })
      .catch(() => {})
    api.get('/api/roles')
      .then((d) => {
        if (!cancelled && Array.isArray(d.roles) && d.roles.length) {
          const names = d.roles.map((r) => r.name).filter(Boolean)
          if (names.length) setTenantRoles(names)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!editId || !settings.inboundWebhook?.enabled) return
    let cancelled = false
    Promise.all([
      api.get(`/api/workflows/${editId}/webhook-deliveries?limit=20`).catch(() => ({ deliveries: [] })),
      api.get(`/api/workflows/${editId}/integration-dlq?limit=20`).catch(() => ({ items: [] })),
    ]).then(([d, q]) => {
      if (cancelled) return
      setDeliveries(d.deliveries || [])
      setDlq(q.items || [])
    })
    return () => { cancelled = true }
  }, [editId, settings.inboundWebhook?.enabled])

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

  const visibleRoles = settings.visibleRoles || []
  const toggleRole = (role) => {
    const has = visibleRoles.includes(role)
    update({
      visibleRoles: has
        ? visibleRoles.filter((r) => r !== role)
        : [...visibleRoles, role],
    })
  }

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
    'w-full px-3.5 py-2.5 text-sm rounded-lg border border-line bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'
  const btnGhost =
    'shrink-0 px-3 py-2.5 text-xs font-semibold rounded-lg border border-line bg-surface hover:bg-surface-2 text-fg transition'

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-2">
      <h2 className="text-2xl font-bold tracking-tight text-fg">Settings</h2>

      <Section
        title="Basic info"
        icon={(
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="wf-name">Workflow name</FieldLabel>
            <input
              id="wf-name"
              type="text"
              value={settings.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Leave Approval Workflow"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="wf-description">Description</FieldLabel>
            <textarea
              id="wf-description"
              rows={2}
              value={settings.description}
              onChange={(e) => update({ description: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <FieldLabel htmlFor="wf-category">Category</FieldLabel>
            <select
              id="wf-category"
              value={settings.category}
              onChange={(e) => update({ category: e.target.value })}
              className={inputCls}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="wf-tags">Tags (#)</FieldLabel>
            <input
              id="wf-tags"
              type="text"
              value={settings.tags || ''}
              onChange={(e) => update({ tags: e.target.value })}
              placeholder="e.g. #finance #urgent #approval"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Form & trigger"
        icon={(
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        )}
      >
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel htmlFor="wf-linked-forms" className="!mb-0">Linked forms</FieldLabel>
              <button
                type="button"
                onClick={() => setAiFormModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer"
              >
                <span className="text-[#F59E0B]">✨</span> Auto-generate Form
              </button>
            </div>
            {(() => {
              const linkedIds = settings.linkedFormIds?.length
                ? settings.linkedFormIds.map(String)
                : (settings.linkedFormId ? [String(settings.linkedFormId)] : [])
              return (
                <>
            <select
              id="wf-linked-forms"
              value=""
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                if (linkedIds.includes(id)) return
                const next = [...linkedIds, id]
                update({ linkedFormIds: next, linkedFormId: next[0] || null })
                e.target.value = ''
              }}
              className={inputCls}
            >
              <option value="">+ Add a published form…</option>
              {publishedForms
                .filter((f) => !linkedIds.includes(String(f.id)))
                .map((f) => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
            </select>
            {publishedForms.length === 0 && (
              <p className="mt-1.5 text-xs text-warning-fg">No published forms yet.</p>
            )}
            {linkedIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedIds.map((id) => {
                  const f = publishedForms.find((x) => String(x.id) === String(id))
                    || forms.find((x) => String(x.id) === String(id))
                  const formTitle = f ? f.title : 'Unknown form'
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-indigo-200/90 dark:border-indigo-800 bg-[#EEF2FF] dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 transition-all"
                    >
                      <span className="truncate">{formTitle}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = linkedIds.filter((x) => String(x) !== String(id))
                          update({ linkedFormIds: next, linkedFormId: next[0] || null })
                        }}
                        className="ml-0.5 text-xs font-bold text-[#4F46E5] dark:text-indigo-300 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                        aria-label="Remove form"
                      >
                        &times;
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
                </>
              )
            })()}
          </div>
          <div>
            <FieldLabel htmlFor="wf-trigger-on">Trigger on</FieldLabel>
            <select
              id="wf-trigger-on"
              value={settings.triggerOn}
              onChange={(e) => update({ triggerOn: e.target.value })}
              className={inputCls}
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <ToggleRow
          checked={settings.preventDuplicates}
          onChange={(e) => update({ preventDuplicates: e.target.checked })}
          label="Block duplicate submissions (per user / day)"
        />
      </Section>

      <Section
        title="Inbound webhook"
        icon={(
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      >
        <ToggleRow
          checked={!!settings.inboundWebhook?.enabled}
          onChange={(e) =>
            update({
              inboundWebhook: {
                ...(settings.inboundWebhook || {}),
                enabled: e.target.checked,
              },
            })
          }
          label="Enable inbound webhook"
        />
        {settings.inboundWebhook?.enabled && (
          <div className="space-y-3">
            {settings.inboundWebhook?.token ? (
              <>
                <div>
                  <FieldLabel htmlFor="wf-webhook-url">Webhook URL</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      id="wf-webhook-url"
                      type="text"
                      readOnly
                      value={webhookUrlFor(settings.inboundWebhook.token)}
                      className={`${inputCls} font-mono text-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = webhookUrlFor(settings.inboundWebhook.token)
                        navigator.clipboard?.writeText(url)
                        toast.success('Webhook URL copied')
                      }}
                      className={btnGhost}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {settings.inboundWebhook?.secret && (
                  <div>
                    <FieldLabel htmlFor="wf-signing-secret">Signing secret</FieldLabel>
                    <div className="flex gap-2">
                      {/* Masked by default — this screen gets shared and
                          screen-shared far more often than the secret is read. */}
                      <input
                        id="wf-signing-secret"
                        type={showSecret ? 'text' : 'password'}
                        readOnly
                        value={settings.inboundWebhook.secret}
                        className={`${inputCls} font-mono text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        className={btnGhost}
                      >
                        {showSecret ? 'Hide' : 'Reveal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(settings.inboundWebhook.secret)
                          toast.success('Signing secret copied')
                        }}
                        className={btnGhost}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <FieldLabel htmlFor="wf-callback-url">
                    Result callback URL
                  </FieldLabel>
                  <input
                    id="wf-callback-url"
                    type="url"
                    value={settings.inboundWebhook?.callbackUrl || ''}
                    onChange={(e) => updateWebhook({ callbackUrl: e.target.value })}
                    placeholder="https://friend-app.example.com/netflow-result"
                    className={inputCls}
                  />
                </div>
                <div role="group" aria-labelledby="wf-payload-contract" className="rounded-lg border border-line bg-surface-2/30 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span id="wf-payload-contract" className="block text-sm font-medium text-fg">Expected fields</span>
                    <button
                      type="button"
                      className="text-xs font-medium text-indigo-600"
                      onClick={() =>
                        updateWebhook({
                          expectedFields: [
                            ...(settings.inboundWebhook?.expectedFields || []),
                            { id: '', label: '', type: 'text', required: false },
                          ],
                        })
                      }
                    >
                      + Add field
                    </button>
                  </div>
                  {(settings.inboundWebhook?.expectedFields || []).length === 0 ? (
                    <p className="text-[11px] text-fg-muted">None — any JSON keys accepted.</p>
                  ) : (
                    <div className="space-y-2">
                      {(settings.inboundWebhook.expectedFields || []).map((f, i) => (
                        <div key={i} className="flex flex-wrap gap-2 items-center">
                          <input
                            className={`${inputCls} flex-1 min-w-[6rem]`}
                            placeholder="id (e.g. grnNo)"
                            value={f.id}
                            onChange={(e) => {
                              const next = [...(settings.inboundWebhook.expectedFields || [])]
                              next[i] = { ...next[i], id: e.target.value }
                              updateWebhook({ expectedFields: next })
                            }}
                          />
                          <input
                            className={`${inputCls} flex-1 min-w-[6rem]`}
                            placeholder="Label"
                            value={f.label}
                            onChange={(e) => {
                              const next = [...(settings.inboundWebhook.expectedFields || [])]
                              next[i] = { ...next[i], label: e.target.value }
                              updateWebhook({ expectedFields: next })
                            }}
                          />
                          <label className="flex items-center gap-1 text-xs text-fg">
                            <input
                              type="checkbox"
                              checked={!!f.required}
                              onChange={(e) => {
                                const next = [...(settings.inboundWebhook.expectedFields || [])]
                                next[i] = { ...next[i], required: e.target.checked }
                                updateWebhook({ expectedFields: next })
                              }}
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            className="text-xs text-danger-fg"
                            onClick={() => {
                              const next = (settings.inboundWebhook.expectedFields || []).filter((_, j) => j !== i)
                              updateWebhook({ expectedFields: next })
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => updateWebhook({ regenerateToken: true })}
                  className="text-xs font-medium text-warning-fg hover:text-warning-fg"
                >
                  Regenerate token &amp; secret on next save
                </button>
                {settings.inboundWebhook?.regenerateToken && (
                  <p className="text-[11px] text-warning-fg">
                    New token &amp; secret on next save.
                  </p>
                )}
                {editId && (
                  <div className="pt-2 border-t border-line space-y-2">
                    <p className="text-xs font-semibold text-fg">Recent deliveries</p>
                    {deliveries.length === 0 ? (
                      <p className="text-[11px] text-fg-muted">None yet.</p>
                    ) : (
                      <ul className="text-[11px] space-y-1 max-h-36 overflow-y-auto">
                        {deliveries.map((d) => (
                          <li key={d._id} className="flex gap-2 flex-wrap">
                            <span className={d.ok ? 'text-success-fg' : 'text-danger-fg'}>{d.ok ? 'OK' : 'Fail'}</span>
                            <span className="text-fg-muted">{d.statusCode}</span>
                            <span className="text-fg-subtle">{d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}</span>
                            {d.error && <span className="text-fg">{d.error}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs font-semibold text-fg pt-1">Dead letters</p>
                    {dlq.length === 0 ? (
                      <p className="text-[11px] text-fg-muted">None.</p>
                    ) : (
                      <ul className="text-[11px] space-y-1 max-h-36 overflow-y-auto">
                        {dlq.map((d) => (
                          <li key={d._id} className="text-warning-fg">
                            {d.nodeId}: {d.error} {d.httpStatus ? `(HTTP ${d.httpStatus})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-warning-fg">
                Save or publish to generate the webhook URL and secret.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Access & Permissions"
        icon={(
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel htmlFor="wf-who-can-submit">Who can access & submit</FieldLabel>
            <select
              id="wf-who-can-submit"
              value={settings.whoCanSubmit}
              onChange={(e) => {
                const who = e.target.value
                const needsSeedRoles = who === 'Specific roles' && !(settings.visibleRoles || []).length
                const needsSeedDepts = who === 'Specific departments' && !(settings.visibleDepartments || []).length
                let patch = { whoCanSubmit: who }
                if (needsSeedRoles) patch.visibleRoles = ['Manager', 'VP']
                if (needsSeedDepts) patch.visibleDepartments = [...orgDepartments]
                update(patch)
              }}
              className={inputCls}
            >
              {SUBMITTER_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            {settings.whoCanSubmit === 'Specific roles' && (
              <div className="mt-3">
                <p className="text-[11px] text-fg-muted mb-2 font-medium">Select specific roles (e.g. Manager, VP, HR):</p>
                <div className="flex flex-wrap gap-2">
                  {tenantRoles.map((r) => {
                    const on = (settings.visibleRoles || []).includes(r)
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
                          on
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40'
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
                        {r}
                      </button>
                    )
                  })}
                </div>
                {(settings.visibleRoles || []).length === 0 && (
                  <p className="mt-1.5 text-[11px] text-warning-fg">Select at least one role.</p>
                )}
              </div>
            )}

            {settings.whoCanSubmit === 'Specific departments' && (
              <div className="mt-3">
                <p className="text-[11px] text-fg-muted mb-2 font-medium">Select departments that can access & submit:</p>
                <div className="flex flex-wrap gap-2">
                  {orgDepartments.map((d) => {
                    const on = (settings.visibleDepartments || []).includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDept(d)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
                          on
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40'
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
              </div>
            )}

            {settings.whoCanSubmit === 'Specific people' && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-fg-muted mb-1 font-medium">Add specific employees by name:</p>
                <select
                  value=""
                  onChange={(e) => { addInitiator(e.target.value); e.target.value = '' }}
                  className={inputCls}
                >
                  <option value="">+ Add an employee…</option>
                  {users
                    .filter((u) => !allowedInitiators.includes(String(u._id)))
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}{u.department ? ` · ${u.department}` : ''}{u.role?.name ? ` (${u.role.name})` : ''}
                      </option>
                    ))}
                </select>

                {allowedInitiators.length === 0 ? (
                  <p className="text-[11px] text-warning-fg">Add at least one employee.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allowedInitiators.map((id) => {
                      const u = users.find((x) => String(x._id) === String(id))
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs rounded-md border border-info-line bg-info-subtle text-info-fg"
                        >
                          {u ? u.name : 'Unknown user'}
                          <button
                            type="button"
                            onClick={() => removeInitiator(id)}
                            className="w-4 h-4 rounded hover:brightness-95 flex items-center justify-center text-info-fg"
                            aria-label={`Remove ${u ? u.name : 'user'}`}
                          >
                            &times;
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <FieldLabel htmlFor="wf-sla-notify">SLA breach notify</FieldLabel>
            <select
              id="wf-sla-notify"
              value={settings.notifyOnSlaBreach}
              onChange={(e) => update({ notifyOnSlaBreach: e.target.value })}
              className={inputCls}
            >
              {SLA_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <div className="mt-5">
              <FieldLabel htmlFor="wf-visibility">Visibility (Who can view)</FieldLabel>
              <select
                id="wf-visibility"
                value={settings.visibility}
                onChange={(e) => {
                  const visibility = e.target.value
                  const needsSeed = visibility === 'departments' && !(settings.visibleDepartments || []).length
                  const needsSeedRoles = visibility === 'roles' && !(settings.visibleRoles || []).length
                  let patch = { visibility }
                  if (needsSeed) patch.visibleDepartments = [...orgDepartments]
                  if (needsSeedRoles) patch.visibleRoles = ['Manager', 'VP']
                  update(patch)
                }}
                className={inputCls}
              >
                <option value="company">Company-wide (Everyone)</option>
                <option value="roles">Specific roles only</option>
                <option value="departments">Specific departments only</option>
                <option value="people">Specific people only</option>
              </select>

              {settings.visibility === 'roles' && settings.whoCanSubmit !== 'Specific roles' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tenantRoles.map((r) => {
                    const on = (settings.visibleRoles || []).includes(r)
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
                          on
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40'
                            : 'border-line bg-surface text-fg-muted hover:bg-surface-2'
                        }`}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              )}

              {settings.visibility === 'departments' && settings.whoCanSubmit !== 'Specific departments' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {orgDepartments.map((d) => {
                    const on = (settings.visibleDepartments || []).includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDept(d)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
                          on
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40'
                            : 'border-line bg-surface text-fg-muted hover:bg-surface-2'
                        }`}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}

              {settings.visibility === 'people' && settings.whoCanSubmit !== 'Specific people' && (
                <div className="mt-3 space-y-2">
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
                          {u.name}{u.department ? ` · ${u.department}` : ''}
                        </option>
                      ))}
                  </select>

                  <div className="flex flex-wrap gap-2">
                    {visibleTo.map((id) => {
                      const u = users.find((x) => String(x._id) === String(id))
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs rounded-lg border border-info-line bg-info-subtle text-info-fg"
                        >
                          {u ? u.name : 'Unknown user'}
                          <button
                            type="button"
                            onClick={() => removeVisiblePerson(id)}
                            className="w-4 h-4 rounded hover:brightness-95 flex items-center justify-center text-info-fg"
                          >
                            &times;
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Advanced"
        icon={(
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        )}
      >
        <div className="space-y-3">
          <ToggleRow
            checked={!!settings.advanced.allowCancel}
            onChange={(e) => updateAdvanced({ allowCancel: e.target.checked })}
            label="Allow submitter to cancel"
          />
          <ToggleRow
            checked={!!settings.advanced.autoPdf}
            onChange={(e) => updateAdvanced({ autoPdf: e.target.checked })}
            label="Auto-generate PDF on completion"
          />
        </div>
      </Section>

      <AiFormGeneratorModal
        open={aiFormModalOpen}
        onClose={() => setAiFormModalOpen(false)}
        workflowName={settings.name}
        onApprove={async (fields) => {
          try {
            const form = await formsStore.add({
              name: settings.name || 'AI Generated Form',
              description: 'Auto-generated form for workflow',
              category: settings.category || 'Company-wide',
              fields: fields
            })
            await formsStore.publish(form.id)
            
            const linkedIds = settings.linkedFormIds?.length
                ? settings.linkedFormIds.map(String)
                : (settings.linkedFormId ? [String(settings.linkedFormId)] : [])
            const nextIds = [...linkedIds]
            if (!nextIds.includes(String(form.id))) {
              nextIds.push(String(form.id))
            }
            update({ linkedFormIds: nextIds, linkedFormId: nextIds[0] || null })
            setAiFormModalOpen(false)
            toast.success('Form generated and published!')
          } catch (err) {
            toast.error(err.message || 'Failed to generate form')
          }
        }}
      />
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

  const linkedFormsLabel = useMemo(() => {
    const ids = settings.linkedFormIds?.length
      ? settings.linkedFormIds
      : (settings.linkedFormId ? [settings.linkedFormId] : [])
    if (!ids.length) return 'None'
    const titles = ids.map((id) => {
      const f = forms.find((x) => String(x.id) === String(id))
      return f ? f.title : '(missing)'
    })
    return titles.join(', ')
  }, [forms, settings.linkedFormId, settings.linkedFormIds])

  const hasApprover = (n) =>
    n.type === 'multiApproval'
      ? Array.isArray(n.approverIds) && n.approverIds.length > 0
      : !!(n.approverId || n.approverRole || n.approver)

  const flowProblems = graphIssues(nodes, connections)
  const notifyNodes = nodes.filter((n) => n.type === 'notify')

  const checklist = [
    {
      label: 'Name set',
      ok: !!settings.name?.trim(),
    },
    {
      label: 'Trigger configured',
      ok: !!(settings.linkedFormIds?.length || settings.linkedFormId) || !!settings.inboundWebhook?.enabled,
    },
    {
      label: 'Owners assigned',
      ok: nodes.filter((n) => n.type === 'approval' || n.type === 'multiApproval' || n.type === 'submit' || n.type === 'review').every(hasApprover),
    },
    {
      label: 'SLA set on approvals',
      ok: nodes.filter((n) => n.type === 'approval').every((n) => !!n.slaValue),
    },
    {
      label: 'All steps connected',
      ok: flowProblems.length === 0,
    },
    {
      label: notifyNodes.length ? 'Notify channels set' : 'No notify steps',
      // `every` on an empty list is true, so this passes when there are none.
      ok: notifyNodes.every((n) => (n.channels || []).length > 0),
    },
  ]
  const failing = checklist.filter((c) => !c.ok).length
  const connectionsCount = connections?.length ?? 0

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-fg">Review</h2>
        {failing > 0 && (
          <p className="text-sm text-warning-fg">
            {failing} {failing === 1 ? 'item' : 'items'} to fix
          </p>
        )}
      </div>

      <Section title="Summary">
        <div className="flex justify-end -mt-2">
          <span className="px-2.5 py-0.5 rounded-md bg-warning-subtle text-warning-fg text-xs font-medium">
            Draft
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          {[
            ['Name', settings.name || '(unnamed)'],
            ['Category', settings.category],
            ['Forms', linkedFormsLabel],
            ['Trigger', settings.triggerOn],
            ['Webhook', settings.inboundWebhook?.enabled ? 'On' : 'Off'],
            ['Visibility',
              settings.visibility === 'company'
                ? 'Company-wide'
                : settings.visibility === 'departments'
                  ? (settings.visibleDepartments.join(', ') || 'No departments')
                  : `${(settings.visibleTo || []).length} people`],
            ['Submitters', settings.whoCanSubmit],
            ...(settings.whoCanSubmit === 'Specific people'
              ? [[
                  'Initiators',
                  (settings.allowedInitiators || []).length
                    ? `${settings.allowedInitiators.length} people`
                    : 'None',
                ]]
              : []),
            ['SLA', slaPolicy],
            ['PDF', settings.advanced.autoPdf ? 'On' : 'Off'],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="col-span-1 text-fg-muted">{k}</dt>
              <dd className="col-span-2 font-medium text-fg">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Section>

      <Section title="Flow preview">
        <div className="flex items-center justify-between -mt-2 mb-1">
          <span className="text-xs text-fg-muted">
            {nodes.length} nodes · {connectionsCount} links
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
            <p className="text-[11px] font-medium text-warning-fg mb-1">Disconnected</p>
            <PreviewChips path={orphans} muted />
          </div>
        )}
      </Section>

      <Section title="Checklist">
        <ul className="-my-2">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 py-2 border-b border-line last:border-0">
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center ${
                  c.ok ? 'bg-success-subtle text-success-fg' : 'bg-warning-subtle text-warning-fg'
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
        <div className="p-4 rounded-md bg-danger-subtle border border-danger-line text-sm text-danger-fg">
          <p className="font-semibold mb-1.5">Fix before publishing</p>
          <ul className="list-disc pl-5 space-y-1">
            {flowProblems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NewWorkflow() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: editId } = useParams()
  const isEditMode = !!editId
  const forms = useForms()
  const orgDepartments = useDepartmentNames()
  // Read once, before any state initialiser looks at it.
  const restoredDraft = useRef(isEditMode ? null : readDraft()).current
  // Edit mode starts at the canvas (step 2); create mode starts at template picker (step 1).
  // After publishing with inbound webhook, we reopen settings so the URL is copyable.
  const [step, setStep] = useState(
    location.state?.openSettings ? 3 : isEditMode ? 2 : restoredDraft?.step || 1
  )
  const [publishing, setPublishing] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loadedStatus, setLoadedStatus] = useState('')
  const [draftNotice, setDraftNotice] = useState(!!restoredDraft)
  const [publishSuccess, setPublishSuccess] = useState(() => location.state?.publishSuccess || null)
  // Bumped when the canvas graph is replaced so WorkflowEditor auto-fits again.
  const [canvasFitKey, setCanvasFitKey] = useState(0)
  const isLive = isEditMode && loadedStatus === 'published'

  // --- AI Builder State ---
  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiStatusReady, setAiStatusReady] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const aiInputRef = useRef(null)

  // UX Enhancements
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameModalContext, setRenameModalContext] = useState(null) // 'rename' | 'publish'
  const [renameInput, setRenameInput] = useState('')

  useEffect(() => {
    api.get('/api/workflows/ai-status')
      .then((d) => {
        setAiAvailable(!!d.aiConfigured)
        setAiStatusReady(true)
      })
      .catch(() => {
        setAiAvailable(false)
        setAiStatusReady(true)
      })
  }, [])

  useEffect(() => {
    if (location.state?.openSettings) setStep(3)
    if (location.state?.publishSuccess) setPublishSuccess(location.state.publishSuccess)
  }, [location.state])

  const [data, setData] = useState(() => {
    if (restoredDraft?.data) return restoredDraft.data
    const tpl = TEMPLATES.find((t) => t.id === 'scratch')
    return {
      template: 'scratch',
      nodes: tpl.defaults.nodes.map((n) => ({ ...n })),
      connections: tpl.defaults.connections.map((c) => ({ ...c })),
      selectedNodeId: null,
      settings: {
        name: '',
        description: '',
        category: '',
        tags: '',
        linkedFormId: null,
        linkedFormIds: [],
        triggerOn: 'Every form submission',
        preventDuplicates: true,
        whoCanSubmit: 'All employees',
        visibleRoles: [],
        // Filled from the tenant's list the first time visibility is set to
        // 'departments' — there is no list to copy from at this point.
        visibleDepartments: [],
        allowedInitiators: [],
        visibility: 'company',
        visibleTo: [],
        notifyOnSlaBreach: 'Always',
        inboundWebhook: {
          enabled: false,
          token: '',
          secret: '',
          callbackUrl: '',
          expectedFields: [],
          regenerateToken: false,
        },
        advanced: {
          allowCancel: false,
          autoPdf: true,
        },
        webhookUrl: '',
      },
    }
  })

  const generateWithAI = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt || aiBusy) return
    setAiBusy(true)
    setAiError('')
    try {
      const res = await api.post('/api/workflows/ai-draft', { prompt })
      if (!res.nodes || !res.connections) throw new Error('Invalid AI response format.')
      setData((d) => ({
        ...d,
        template: 'ai_generated',
        nodes: res.nodes,
        connections: res.connections,
        settings: {
          ...d.settings,
          name: res.title || 'AI Generated Workflow',
          description: res.description || prompt,
        },
      }))
      setCanvasFitKey((k) => k + 1)
      setStep(2)
      toast.success('Workflow generated successfully!')
    } catch (err) {
      setAiError(err.message || 'AI generation failed. Please try again.')
    } finally {
      setAiBusy(false)
    }
  }

  const onAiPromptChange = (e) => {
    const val = e.target.value
    setAiPrompt(val)
    setAiSuggestion('')
    if (!aiAvailable || aiBusy || val.trim().length < 3) return
    if (!val.endsWith(' ')) return
    const base = val.trim()
    api.post('/api/workflows/ai-suggest', { prompt: base })
      .then((res) => {
        const el = aiInputRef.current
        if (el && document.activeElement === el) setAiSuggestion(res?.completion || '')
      })
      .catch(() => setAiSuggestion(''))
  }

  const onAiKeyDown = (e) => {
    const el = aiInputRef.current
    if (!el) return
    const caretAtEnd = el.selectionStart === aiPrompt.length && el.selectionStart === el.selectionEnd
    if (aiSuggestion && (e.key === 'Tab' || (e.key === 'ArrowRight' && caretAtEnd))) {
      e.preventDefault()
      const next = aiPrompt + aiSuggestion
      setAiPrompt(next)
      setAiSuggestion('')
      requestAnimationFrame(() => {
        const el2 = aiInputRef.current
        if (el2) { el2.focus(); el2.setSelectionRange(next.length, next.length) }
      })
      return
    }
    if (e.key === 'Escape') { setAiSuggestion(''); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setAiSuggestion(''); generateWithAI() }
  }

  // Load existing workflow if edit mode, fetch the existing workflow and populate the form state.
  useEffect(() => {
    if (!editId) return
    ;(async () => {
      try {
        const { workflow } = await api.get(`/api/workflows/${editId}`)
        const nodes = deserializeNodes(workflow.nodes)
        const connections = deserializeEdges(workflow.edges)
        setLoadedStatus(workflow.status || '')
        // Re-baseline the dirty check: what came back from the server is the
        // new "unchanged" state, not whatever the empty initial state was.
        pristineRef.current = null
        setData((d) => ({
          ...d,
          nodes,
          connections,
          settings: {
            ...d.settings,
            name: workflow.title || '',
            description: workflow.description || '',
            category: workflow.department || d.settings.category,
            tags: workflow.tags || (Array.isArray(workflow.tags) ? workflow.tags.join(' ') : '') || '',
            linkedFormIds: (() => {
              if (Array.isArray(workflow.linkedFormIds) && workflow.linkedFormIds.length) {
                return workflow.linkedFormIds.map(String)
              }
              return workflow.linkedFormId ? [String(workflow.linkedFormId)] : []
            })(),
            linkedFormId: workflow.linkedFormId
              ? String(workflow.linkedFormId)
              : (workflow.linkedFormIds?.[0] ? String(workflow.linkedFormIds[0]) : null),
            whoCanSubmit: SUBMITTER_OPTIONS.includes(workflow.access?.whoCanSubmit)
              ? workflow.access.whoCanSubmit
              : (workflow.access?.roles?.length ? 'Specific roles' : workflow.access?.departments?.length ? 'Specific departments' : workflow.access?.allowedInitiators?.length ? 'Specific people' : d.settings.whoCanSubmit),
            visibleRoles: Array.isArray(workflow.access?.roles)
              ? workflow.access.roles
              : [],
            visibleDepartments: workflow.access?.departments?.length
              ? workflow.access.departments
              : d.settings.visibleDepartments,
            allowedInitiators: (workflow.access?.allowedInitiators || []).map((x) => String(x?._id || x)),
            visibility:
              workflow.access?.visibility ||
              (workflow.access?.roles?.length ? 'roles' : workflow.access?.departments?.length ? 'departments' : (workflow.access?.visibleTo?.length ? 'people' : 'company')),
            visibleTo: (workflow.access?.visibleTo || []).map((x) => String(x?._id || x)),
            triggerOn: TRIGGER_OPTIONS.includes(workflow.triggerOn)
              ? workflow.triggerOn
              : d.settings.triggerOn,
            preventDuplicates: workflow.preventDuplicates === true,
            notifyOnSlaBreach: workflow.notifyOnSlaBreach || d.settings.notifyOnSlaBreach,
            inboundWebhook: {
              enabled: workflow.inboundWebhook?.enabled === true,
              token: workflow.inboundWebhook?.token || '',
              secret: workflow.inboundWebhook?.secret || '',
              callbackUrl: workflow.inboundWebhook?.callbackUrl || '',
              expectedFields: Array.isArray(workflow.inboundWebhook?.expectedFields)
                ? workflow.inboundWebhook.expectedFields.map((f) => ({
                    id: f.id || '',
                    label: f.label || '',
                    type: f.type || 'text',
                    required: f.required === true,
                  }))
                : [],
              regenerateToken: false,
            },
            advanced: {
              ...d.settings.advanced,
              allowCancel: workflow.advanced?.allowCancel === true,
              autoPdf: workflow.advanced?.autoPdf === true,
            },
          },
        }))
        setCanvasFitKey((k) => k + 1)
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
        // Templates are named after common teams; only adopt the suggestion when
        // this tenant actually has that department.
        category: orgDepartments.includes(tpl.defaults.category)
          ? tpl.defaults.category
          : d.settings.category,
        description: tpl.defaults.description || d.settings.description,
        linkedFormIds: matched
          ? [matched.id]
          : (d.settings.linkedFormIds || []),
        linkedFormId: matched
          ? matched.id
          : d.settings.linkedFormId,
      },
    }))
    setCanvasFitKey((k) => k + 1)
  }

  // Mirror the wizard into localStorage so a refresh doesn't lose the canvas.
  // Debounced, and only once the user has actually changed something — otherwise
  // opening the builder and leaving would leave a "restore draft" prompt behind.
  const pristineRef = useRef(null)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    const snapshot = JSON.stringify({ step, data })
    if (pristineRef.current === null) {
      pristineRef.current = snapshot
      return
    }
    const changed = snapshot !== pristineRef.current
    setDirty(changed)
    if (isEditMode) return
    if (!changed) {
      draftStore.clear()
      return
    }
    const t = setTimeout(() => draftStore.write({ step, data }), 600)
    return () => clearTimeout(t)
  }, [step, data, isEditMode])

  useBeforeUnloadWarning(dirty && !publishing && !savingDraft)

  const handleDiscard = async () => {
    if (await confirm({ title: 'Discard workflow?', message: 'Unsaved changes will be lost.', confirmLabel: 'Discard', danger: false })) {
      draftStore.clear()
      navigate('/workflows')
    }
  }

  const buildPayload = () => {
    const settings = data.settings
    return {
      name: settings.name.trim(),
      description: settings.description,
      category: settings.category,
      tags: settings.tags || '',
      linkedFormIds: (() => {
        const ids = settings.linkedFormIds?.length
          ? settings.linkedFormIds
          : (settings.linkedFormId ? [settings.linkedFormId] : [])
        return ids.map(String)
      })(),
      linkedFormId: (() => {
        const ids = settings.linkedFormIds?.length
          ? settings.linkedFormIds
          : (settings.linkedFormId ? [settings.linkedFormId] : [])
        return ids[0] || undefined
      })(),
      access: {
        whoCanSubmit: settings.whoCanSubmit,
        allowedInitiators:
          settings.whoCanSubmit === 'Specific people'
            ? settings.allowedInitiators || []
            : (settings.visibility === 'people' ? settings.visibleTo || [] : []),
        visibility: settings.visibility,
        departments:
          settings.visibility === 'departments'
            ? settings.visibleDepartments || []
            : (settings.whoCanSubmit === 'Specific departments' ? settings.visibleDepartments || [] : []),
        visibleTo:
          settings.visibility === 'people'
            ? settings.visibleTo || []
            : (settings.whoCanSubmit === 'Specific people' ? settings.allowedInitiators || [] : []),
        roles:
          settings.visibility === 'roles'
            ? settings.visibleRoles || []
            : (settings.whoCanSubmit === 'Specific roles' ? settings.visibleRoles || [] : []),
      },
      triggerOn: settings.triggerOn,
      preventDuplicates: settings.preventDuplicates === true,
      notifyOnSlaBreach: settings.notifyOnSlaBreach,
      inboundWebhook: {
        enabled: settings.inboundWebhook?.enabled === true,
        callbackUrl: settings.inboundWebhook?.callbackUrl || '',
        expectedFields: Array.isArray(settings.inboundWebhook?.expectedFields)
          ? settings.inboundWebhook.expectedFields
          : [],
        ...(settings.inboundWebhook?.regenerateToken ? { regenerateToken: true } : {}),
      },
      advanced: {
        allowCancel: settings.advanced.allowCancel === true,
        autoPdf: settings.advanced.autoPdf === true,
      },
      nodes: serializeNodes(data.nodes, data.connections),
      edges: serializeEdges(data.connections),
    }
  }

  // A name is the one thing we can't invent — it used to silently become
  // "Untitled workflow", leaving lists full of identical entries.
  const requireName = () => {
    if (data.settings.name.trim()) return true
    setRenameInput('')
    setRenameModalContext('rename') // or fallback to rename if they just clicked save draft
    setRenameModalOpen(true)
    return false
  }

  const handleSaveDraft = async () => {
    if (!requireName()) return
    if (isLive) {
      const ok = await confirm({
        title: 'Push changes live now?',
        message: `"${data.settings.name.trim()}" is published, so saving applies your changes to new runs immediately. Runs already in progress keep the old steps.`,
        confirmLabel: 'Save & go live',
      })
      if (!ok) return
    }
    setPublishError('')
    setSavingDraft(true)
    try {
      if (isEditMode) {
        await workflowsStore.update(editId, buildPayload())
        toast.success(isLive ? 'Changes are live' : 'Draft saved')
      } else {
        const created = await workflowsStore.add(buildPayload())
        draftStore.clear()
        setDraftNotice(false)
        toast.success('Draft saved — publish when you are ready')
        navigate(`/workflows/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      const limit = limitBanner(err)
      const msg = limit ? `${limit.title} — ${limit.message}` : (err.message || 'Could not save the draft')
      setPublishError(msg)
      toast.error(msg)
    } finally {
      setSavingDraft(false)
    }
  }

  const handlePublish = async () => {
    setPublishError('')
    if (!data.settings.name.trim()) {
      setRenameInput('')
      setRenameModalContext('publish')
      setRenameModalOpen(true)
      return
    }
    const issues = graphIssues(data.nodes, data.connections)
    if (issues.length) {
      const msg = `Can't publish yet — ${issues[0].message}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}`
      setPublishError(msg)
      toast.error(msg)
      return
    }
    if (isLive) {
      const ok = await confirm({
        title: 'Push changes live now?',
        message: `"${data.settings.name.trim()}" is already published, so new submissions start using these steps as soon as you save. Runs already in progress keep the old steps.`,
        confirmLabel: 'Save & go live',
      })
      if (!ok) return
    }
    setPublishing(true)
    try {
      const payload = buildPayload()
      let saved
      if (isEditMode) {
        const updated = await workflowsStore.update(editId, payload)
        // Only publish if the updated doc came back as a draft (e.g. it was
        // paused before editing). If it's already published the PUT preserved
        // that status and a second publish call is unnecessary.
        saved = updated.status !== 'Active'
          ? await workflowsStore.publish(updated.id)
          : updated
      } else {
        const created = await workflowsStore.add(payload)
        saved = await workflowsStore.publish(created.id)
      }
      const savedId = saved?.id
      const wh = saved?.inboundWebhook || saved?._raw?.inboundWebhook
      if (payload.tags) {
        try {
          const map = JSON.parse(localStorage.getItem('netflow_wf_tags') || '{}')
          if (savedId) map[savedId] = payload.tags
          if (payload.name) map[payload.name] = payload.tags
          localStorage.setItem('netflow_wf_tags', JSON.stringify(map))
        } catch (e) {}
      }
      draftStore.clear()
      setDraftNotice(false)

      if (payload.inboundWebhook?.enabled && savedId) {
        const token = wh?.token || ''
        const secret = wh?.secret || ''
        setData((d) => ({
          ...d,
          settings: {
            ...d.settings,
            inboundWebhook: {
              ...(d.settings.inboundWebhook || {}),
              enabled: true,
              token,
              secret,
              regenerateToken: false,
            },
          },
        }))
        const successPayload = {
          name: payload.name,
          webhookUrl: webhookUrlFor(token),
          secret,
        }
        setPublishSuccess(successPayload)
        toast.success('Workflow published')
        navigate(`/workflows/${savedId}/edit`, {
          replace: true,
          state: {
            openSettings: true,
            justPublished: true,
            publishSuccess: successPayload,
          },
        })
        setStep(3)
        return
      }

      toast.success('Workflow published')
      navigate('/workflows')
    } catch (err) {
      // Keeps the canvas intact and names the limit, so the builder can archive
      // an old workflow and press publish again.
      const limit = limitBanner(err)
      const msg = limit ? `${limit.title} — ${limit.message}` : (err.message || 'Failed to save workflow')
      setPublishError(msg)
      toast.error(msg)
    } finally {
      setPublishing(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="p-6 rounded-lg bg-danger-subtle border border-danger-line text-danger-fg text-sm max-w-md text-center">
          <p className="font-semibold mb-1">Could not load workflow</p>
          <p>{loadError}</p>
          <button onClick={() => navigate('/workflows')} className="mt-4 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition">Back to workflows</button>
        </div>
      </div>
    )
  }

  const builderFullscreen = step === 2

  const stepNames = [
    'Choose template',
    'Build workflow',
    'Settings & triggers',
    'Review & publish',
  ]

  const openRenameModal = () => {
    setRenameInput(data.settings.name || '')
    setRenameModalContext('rename')
    setRenameModalOpen(true)
  }

  const handleRenameSave = () => {
    const newName = renameInput.trim()
    if (!newName) {
      toast.error('Workflow name cannot be empty')
      return
    }
    setData((d) => ({ ...d, settings: { ...d.settings, name: newName } }))
    setRenameModalOpen(false)
    if (renameModalContext === 'publish') {
      // Need a small timeout to let React batch state updates before we trigger the publish
      setTimeout(() => {
        handlePublish()
      }, 50)
    }
  }

  const [isStudioFullscreen, setIsStudioFullscreen] = useState(false)

  useEffect(() => {
    const onFsChange = () => {
      setIsStudioFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!isStudioFullscreen && !document.fullscreenElement) {
      setIsStudioFullscreen(true)
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      setIsStudioFullscreen(false)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  const stepperHeader = (
    <div className="shrink-0 px-6 py-2.5 bg-[#e2e8f0] dark:bg-[#0b1120] border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-full py-1.5 px-4 sm:px-6 shadow-xs flex items-center justify-center max-w-3xl mx-auto gap-2 sm:gap-4 overflow-x-auto thin-scrollbar">
        {stepNames.map((name, index) => {
          const stepNum = index + 1
          const isActive = step === stepNum
          const isPast = step > stepNum

          return (
            <React.Fragment key={stepNum}>
              <button
                type="button"
                onClick={() => setStep(stepNum)}
                className={`flex items-center gap-2 transition cursor-pointer text-xs shrink-0 ${
                  isActive
                    ? 'px-4 py-1.5 rounded-full bg-[#4F46E5] text-white font-bold shadow-xs shadow-indigo-500/20'
                    : isPast
                    ? 'text-slate-700 dark:text-slate-200 font-semibold hover:text-[#4F46E5]'
                    : 'text-slate-400 dark:text-slate-500 font-semibold hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isPast
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {isPast ? '✓' : stepNum}
                </span>
                <span className="whitespace-nowrap">{name}</span>
              </button>

              {index < stepNames.length - 1 && (
                <span className="w-4 sm:w-6 h-px bg-slate-200 dark:bg-slate-700 shrink-0" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )

  return (
    <AppShell
      title="Workflows"
      fullscreen={isStudioFullscreen}
      mainClass="p-0 flex flex-col flex-1 min-h-0 bg-[#e2e8f0] dark:bg-[#0b1120] overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Top Workflow Builder Bar (Matching exact UI) */}
        <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate('/workflows')}
              className="text-xs font-bold text-[#4F46E5] dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              ← Back to workflows
            </button>
            <div className="h-6 w-px bg-slate-200/80 dark:border-slate-800" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-[15px] font-bold text-slate-800 dark:text-slate-100">
                  {data.settings.name || 'Untitled workflow'}
                </h1>
                <button
                  type="button"
                  onClick={openRenameModal}
                  className="text-slate-400 hover:text-indigo-600 transition cursor-pointer p-0.5"
                  title="Edit workflow name"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </div>
              <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5">
                Design an approval flow in four quick steps.
              </p>
            </div>
          </div>

          {/* Top Right Badges & Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const d = readDraft()
                if (d?.data) {
                  setData(d.data)
                  if (d.step) setStep(d.step)
                  toast.success('Draft restored')
                } else {
                  toast.info('No earlier draft found')
                }
              }}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Resume draft"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Resume</span>
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`px-3.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 shadow-2xs cursor-pointer text-xs font-semibold ${
                  isStudioFullscreen
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200/90 dark:border-slate-700 bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
                title={isStudioFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen'}
              >
                <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  {isStudioFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4m6 6l5-5m0 0v4m0-4h-4m-7 7l-5 5m0 0v-4m0 4h4m6-6l5 5m0 0v-4m0 4h-4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
                  )}
                </svg>
                <span>{isStudioFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
              </button>
            )}

            <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
              Step {step} of 4
            </span>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
              dirty
                ? 'bg-rose-50/90 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800'
                : 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dirty ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              {isLive ? 'Live' : dirty ? 'Unsaved' : 'Saved'}
            </span>
          </div>
        </div>

        {/* Stepper Header Horizontal Pill Tabs (NetFlow Indigo Theme) */}
        {step !== 2 && stepperHeader}

        {/* Main Wizard Content Area */}
        <main
          data-tour="workflow-builder-main"
          className={
            builderFullscreen || step === 2
              ? 'flex-1 min-h-0 flex flex-col overflow-hidden'
              : 'flex-1 min-h-0 p-6 overflow-y-auto'
          }
        >
          {draftNotice && step !== 2 && (
            <div className={`mb-4 shrink-0 ${builderFullscreen ? 'px-4 pt-3' : 'max-w-3xl mx-auto'}`}>
              <AlertBanner
                tone="info"
                onRetry={async () => {
                  const ok = await confirm({
                    title: 'Start over?',
                    message: 'Your restored draft will be thrown away and the builder resets to a blank workflow.',
                    confirmLabel: 'Start fresh',
                    danger: true,
                  })
                  if (!ok) return
                  draftStore.clear()
                  setDraftNotice(false)
                  navigate(0)
                }}
                retryLabel="Start fresh"
              >
                Picked up where you left off — this is an unsaved draft from your last visit.
              </AlertBanner>
            </div>
          )}

          {step === 1 && !isEditMode && (
            <Step1Template
              selected={data.template}
              onSelect={applyTemplate}
              aiAvailable={aiAvailable}
              aiPrompt={aiPrompt}
              onAiPromptChange={onAiPromptChange}
              onAiKeyDown={onAiKeyDown}
              aiSuggestion={aiSuggestion}
              aiBusy={aiBusy}
              generateWithAI={generateWithAI}
              aiError={aiError}
              showAiPanel={showAiPanel}
              setShowAiPanel={setShowAiPanel}
              aiInputRef={aiInputRef}
            />
          )}
          {step === 2 && (
            <Step2Builder
              data={data}
              setData={setData}
              fitKey={canvasFitKey}
              stepperHeader={stepperHeader}
            />
          )}
          {step === 3 && <Step3Settings data={data} setData={setData} forms={forms} editId={editId} />}
          {step === 4 && (
            <>
              <Step4Review data={data} forms={forms} />
              {publishError && (
                <div className="max-w-3xl mx-auto mt-3 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {publishError}
                </div>
              )}
            </>
          )}
        </main>

        {/* Bottom Bar Action Footer */}
        <footer
          data-tour="workflow-builder-actions"
          className="h-16 shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between text-xs"
        >
          <div className="font-semibold text-slate-500 dark:text-slate-400">
            Step {step} of 4 · {stepNames[step - 1]}
          </div>

          <div className="flex items-center gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
              >
                ‹ Back
              </button>
            )}
            <button
              type="button"
              onClick={handleDiscard}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
            >
              ✕ Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || publishing}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              ✓ {savingDraft ? 'Saving…' : 'Save as draft'}
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-7 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm hover:shadow transition flex items-center gap-1.5"
              >
                Continue ›
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="px-7 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm hover:shadow transition flex items-center gap-1.5 disabled:opacity-70"
              >
                {publishing ? 'Publishing…' : isEditMode ? 'Save & publish' : 'Publish workflow'}
              </button>
            )}
          </div>
        </footer>
      </div>

      <PublishSuccessModal
        open={!!publishSuccess}
        name={publishSuccess?.name}
        webhookUrl={publishSuccess?.webhookUrl}
        secret={publishSuccess?.secret}
        onClose={() => setPublishSuccess(null)}
        onGoToList={() => {
          setPublishSuccess(null)
          navigate('/workflows')
        }}
      />

      <Modal
        open={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Rename workflow"
        description="Give this workflow a clear, recognisable name."
        size="md"
        showClose={true}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRenameModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-line bg-surface hover:bg-surface-2 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRenameSave}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition flex items-center gap-1.5"
            >
              ✓ Save name
            </button>
          </>
        }
      >
        <div>
          <label htmlFor="rename-input" className="block text-xs font-semibold text-fg-muted mb-1">
            Workflow name <span className="text-danger-fg">*</span>
          </label>
          <input
            id="rename-input"
            type="text"
            placeholder="e.g. Employee Leave Approval"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleRenameSave()
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            autoFocus
          />
        </div>
      </Modal>
    </AppShell>
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

// Is this edge the approved / forward branch? Explicit tag wins; a plain
// (non-dashed) edge from a Decision/Review counts as approve for legacy graphs.
const isApproveEdge = (c) => c.branch === 'approve' || (!c.branch && !c.dashed)
// Reject / changes-required: explicit tag or legacy dashed style.
const isRejectEdge = (c) => c.branch === 'reject' || c.dashed === true

// Structural checks for the canvas banner, Review checklist, and publish gate.
// Returns { message, nodeIds }[] so the builder can highlight the bad nodes.
function graphIssues(nodes, connections) {
  const issues = []
  const conns = connections || []
  const label = (n) => n.title || n.id
  const outFrom = (id) => conns.filter((c) => c.from === id)
  const push = (message, nodeIds = []) => issues.push({ message, nodeIds: nodeIds.filter(Boolean) })

  for (const n of nodes) {
    if (n.type === 'condition') {
      const outs = outFrom(n.id)
      const hasApprove = outs.some(isApproveEdge)
      const hasReject = outs.some(isRejectEdge)
      if (!hasApprove || !hasReject) {
        const missing = [!hasApprove && 'Approved', !hasReject && 'Rejected']
          .filter(Boolean)
          .join(' and ')
        push(
          `Decision "${label(n)}" is missing its ${missing} branch — connect both paths (or set them in Node Config).`,
          [n.id]
        )
      }
      // Untagged extras confuse runtime; Decision may only have two branch edges.
      if (outs.length > 2) {
        push(
          `Decision "${label(n)}" has extra connections — keep only Approved and Rejected paths.`,
          [n.id]
        )
      }
    }
    if (n.type === 'review') {
      const outs = outFrom(n.id)
      const hasForward = outs.some(isApproveEdge)
      const hasChanges = outs.some(isRejectEdge)
      if (!hasForward || !hasChanges) {
        const missing = [!hasForward && 'No-changes / forward', !hasChanges && 'Changes-required']
          .filter(Boolean)
          .join(' and ')
        push(
          `Review "${label(n)}" is missing its ${missing} branch — connect both paths (or set them in Node Config).`,
          [n.id]
        )
      }
    }
    if ((n.type === 'approval' || n.type === 'multiApproval' || n.type === 'submit' || n.type === 'api' || n.type === 'timer') && outFrom(n.id).length === 0) {
      push(
        `"${label(n)}" has no next step — connect it to the following node (e.g. the next approval or End).`,
        [n.id]
      )
    }
    if (n.type === 'end' && outFrom(n.id).length > 0) {
      push(
        `"${label(n)}" is an End step and should not connect onward — remove its outgoing link.`,
        [n.id]
      )
    }
  }

  // Self-loops and edges to missing nodes.
  for (const c of conns) {
    if (c.from === c.to) {
      const n = nodes.find((x) => x.id === c.from)
      push(`"${label(n || { id: c.from })}" connects to itself — remove that loop.`, [c.from])
    }
    if (!nodes.some((n) => n.id === c.to)) {
      push('A connection points to a missing node — delete the broken link.', [c.from])
    }
  }

  // Reachability from the Start node.
  const start = nodes.find((n) => n.type === 'start')
  if (!start) {
    push('There is no Start step — add one so NetFlow knows where a run begins.')
  } else if (outFrom(start.id).length === 0) {
    push('Start has no next step — drag a connection from it to the first step of the flow.', [start.id])
  }
  if (start) {
    const seen = new Set([start.id])
    const stack = [start.id]
    while (stack.length) {
      const id = stack.pop()
      for (const c of conns.filter((edge) => edge.from === id)) {
        if (!seen.has(c.to)) {
          seen.add(c.to)
          stack.push(c.to)
        }
      }
    }
    for (const n of nodes) {
      if (n.type === 'start') continue
      if (!seen.has(n.id)) {
        push(`"${label(n)}" is not reachable from Start — nothing connects into it.`, [n.id])
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

  // Index Decision / Review branch targets (truePath / falsePath, forward / changes).
  // Legacy dashed edges count as reject; plain untagged as approve.
  const approveTargetByFrom = new Map()
  const rejectTargetByFrom = new Map()
  for (const c of connections || []) {
    if (isApproveEdge(c) && !approveTargetByFrom.has(c.from)) {
      approveTargetByFrom.set(c.from, c.to)
    }
    if (isRejectEdge(c) && !rejectTargetByFrom.has(c.from)) {
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
    else if (c.branch === 'reject' || c.dashed) label = 'rejected'
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
    if (e.label === 'approved') {
      conn.branch = 'approve'
    } else if (e.label === 'rejected' || e.label === 'reject') {
      conn.branch = 'reject'
      conn.dashed = true
    }
    return conn
  })
}

export default NewWorkflow

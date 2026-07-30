import React from 'react'

export const WORKFLOW_TEMPLATES = [
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

export function templateMeta(nodes = []) {
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

export function TemplateIcon({ name, className = 'w-5 h-5' }) {
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

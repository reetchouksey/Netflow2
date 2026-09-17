// seeds/seedRealistic.js
// Seeds a fully-connected, realistic dataset:
//   Form → Workflow(linkedFormId) → FormResponse → WorkflowExecution → Task(s)
// plus a roster of realistic users (employees + per-dept approvers with
// managerId / hrId links) so approval chains, the task inbox and every
// dashboard/analytics card light up with believable data.
//
// SAFE + IDEMPOTENT:
//   • Seeded users live on the "@flowsphere.seed" email domain.
//   • Seeded Forms/Workflows are owned by a dedicated "Seed Bot" service account.
//   • Seeded Executions are tagged variables._seed = true.
//   Re-running deletes ONLY this seed's previous output (Tasks → Executions →
//   FormResponses → Workflows → Forms) — your real forms (Leave/Onboarding/
//   Costing) and any app-created data are never touched. Roster users are
//   reused (find-or-create), not duplicated.
//
// Run with:  node seeds/seedRealistic.js   (or npm run seed:real)

require('dotenv').config()

const mongoose = require('mongoose')
const crypto   = require('crypto')

const Role              = require('../models/Role')
const User              = require('../models/User')
const Form              = require('../models/Form')
const Workflow          = require('../models/Workflow')
const FormResponse      = require('../models/FormResponse')
const WorkflowExecution = require('../models/WorkflowExecution')
const Task              = require('../models/Task')

const { Types } = mongoose
const oid = () => new Types.ObjectId()

// ─── config ─────────────────────────────────────────────────────────────────
const SEED_DOMAIN     = 'flowsphere.seed'
const SEEDER_EMAIL    = `seeder@${SEED_DOMAIN}`
const DEFAULT_PASSWORD = 'Seed@12345'
const NUM_EXECUTIONS  = 450
const DAYS_BACK       = 90

// ─── small helpers ────────────────────────────────────────────────────────────
const uid    = () => crypto.randomUUID()
const pick   = (a) => a[Math.floor(Math.random() * a.length)]
const rand   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const HOUR   = 60 * 60 * 1000
const DAY    = 24 * HOUR
const NOW    = Date.now()
const slug   = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [val, w] of pairs) if ((r -= w) <= 0) return val
  return pairs[0][0]
}

// keep a timestamp strictly in the past
const clampPast = (t) => (t > NOW ? NOW - rand(1, 180) * 60000 : t)

// ─── realistic value pools ──────────────────────────────────────────────────
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Kabir', 'Ananya', 'Diya', 'Saanvi', 'Aisha', 'Priya',
  'Rohan', 'Karan', 'Neha', 'Pooja', 'Sneha', 'Vikram', 'Arjun', 'Meera', 'Riya', 'Nikhil',
  'Sanjay', 'Anita', 'Divya', 'Manish', 'Aarti', 'Suresh', 'Rajesh', 'Kavya', 'Farhan', 'Zoya']
const LAST = ['Sharma', 'Verma', 'Patel', 'Nair', 'Iyer', 'Reddy', 'Mehta', 'Kapoor', 'Khanna', 'Bansal',
  'Joshi', 'Gupta', 'Rao', 'Menon', 'Desai', 'Malhotra', 'Krishnan', 'Chopra', 'Sengupta', 'Pillai']
const COMPANY_ROOTS = ['Apex', 'Orion', 'Sterling', 'Nimbus', 'Vertex', 'Crescent', 'Summit', 'Indus', 'Quanta', 'Zenith',
  'Pioneer', 'Meridian', 'Cobalt', 'Falcon', 'Granite', 'Harbor', 'Ivory', 'Lotus', 'Maple', 'Onyx']
const COMPANY_SUFFIX = ['Pvt Ltd', 'LLP', 'Industries', 'Solutions', 'Enterprises', 'Traders', 'Systems', 'Logistics']
const SENTENCES = [
  'Required for the upcoming quarter rollout.', 'Approved as per departmental policy.',
  'Please process at the earliest convenience.', 'Routine submission for monthly cycle.',
  'Urgent — client commitment depends on this.', 'Replacement for end-of-life equipment.',
  'Budget already allocated under the current plan.', 'Supporting documents attached for review.',
  'As discussed in the weekly planning meeting.', 'Standard request, no exceptions needed.',
]
const personName = () => `${pick(FIRST)} ${pick(LAST)}`
const company    = () => `${pick(COMPANY_ROOTS)} ${pick(COMPANY_SUFFIX)}`

const FILE_SAMPLES = [
  { ext: 'pdf',  mime: 'application/pdf', size: 84211, base: 'invoice' },
  { ext: 'pdf',  mime: 'application/pdf', size: 64200, base: 'delivery_challan' },
  { ext: 'jpg',  mime: 'image/jpeg',      size: 152233, base: 'receipt_scan' },
  { ext: 'webp', mime: 'image/webp',      size: 47586, base: 'id_proof' },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 37284, base: 'agreement' },
]
const fileValue = () => {
  const f = pick(FILE_SAMPLES)
  return {
    name: `${f.base}_${rand(1000, 9999)}.${f.ext}`,
    url:  `/uploads/${NOW - rand(0, 90) * DAY}-${crypto.randomBytes(8).toString('hex')}.${f.ext}`,
    mime: f.mime,
    size: f.size,
  }
}

// Generate a believable value for a single form field.
function valueForField(field, created) {
  const label = (field.label || '').toLowerCase()
  switch (field.type) {
    case 'dropdown': return field.options?.length ? pick(field.options) : 'N/A'
    case 'checkbox': return Math.random() < 0.6
    case 'date':     return new Date(clampPast(created.getTime() + rand(-10, 20) * DAY)).toISOString().slice(0, 10)
    case 'file':     return fileValue()
    case 'signature': return personName()
    case 'number':
      if (/(amount|cost|value|salary|budget|price)/.test(label)) return rand(1000, 500000)
      if (/(qty|quantity|days|number|count)/.test(label))        return rand(1, 60)
      return rand(1, 1000)
    case 'textarea':
    case 'text':
    default:
      if (/(account name|counterparty|client|vendor|supplier|payee|company)/.test(label)) return company()
      if (/invoice/.test(label))                       return `INV-${rand(10000, 99999)}`
      if (/grn/.test(label))                           return `GRN-${rand(1000, 9999)}`
      if (/(purchase order|^po\b| po )/.test(label))   return `PO-${rand(1000, 9999)}`
      if (/(reference|^ref\b)/.test(label))            return `REF-${rand(1000, 9999)}`
      if (/account number/.test(label))                return `${rand(1000, 9999)}-${rand(1000, 9999)}`
      if (/(asset tag|tag)/.test(label))               return `AT-${rand(100, 999)}`
      if (/(cost cent|centre|center)/.test(label))     return pick(['CC-100', 'CC-200', 'CC-300', 'CC-400'])
      if (/(employee|requester|requestor|holder|rep\b|name)/.test(label)) return personName()
      if (field.type === 'textarea' || /(reason|description|justification|notes|narration|scope|details|work)/.test(label)) return pick(SENTENCES)
      return pick(['Standard request', 'As discussed', 'Q3 requirement', 'Routine submission', 'Approved per policy'])
  }
}

// ─── field templates per department (realistic) ──────────────────────────────
const FIELD_POOLS = {
  HR: [
    { type: 'text',     label: 'Employee Name',       placeholder: 'Full name',   required: true  },
    { type: 'text',     label: 'Employee ID',          placeholder: 'EMP-0001',    required: true  },
    { type: 'dropdown', label: 'Leave Type',           options: ['Annual', 'Sick', 'Casual', 'Maternity/Paternity'], required: true },
    { type: 'date',     label: 'Start Date',           required: true  },
    { type: 'date',     label: 'End Date',             required: true  },
    { type: 'number',   label: 'Number of Days',       placeholder: '5',           required: true  },
    { type: 'textarea', label: 'Reason',               placeholder: 'Briefly explain', required: false },
    { type: 'file',     label: 'Supporting Document',  required: false },
  ],
  Finance: [
    { type: 'text',     label: 'Requester Name',       placeholder: 'Full name',   required: true  },
    { type: 'number',   label: 'Amount (INR)',          placeholder: '0.00',        required: true  },
    { type: 'dropdown', label: 'Expense Category',     options: ['Travel', 'Office Supplies', 'Software', 'Equipment', 'Other'], required: true },
    { type: 'date',     label: 'Expense Date',         required: true  },
    { type: 'text',     label: 'Vendor / Payee',       placeholder: 'Vendor name', required: true  },
    { type: 'text',     label: 'Invoice Number',       placeholder: 'INV-0001',    required: false },
    { type: 'file',     label: 'Invoice / Receipt',    required: true  },
    { type: 'textarea', label: 'Business Justification', placeholder: 'Why is this needed?', required: true },
  ],
  IT: [
    { type: 'text',     label: 'Requester',            placeholder: 'Full name',   required: true  },
    { type: 'dropdown', label: 'Request Type',         options: ['Hardware', 'Software', 'Access', 'Support', 'Other'], required: true },
    { type: 'text',     label: 'Asset / Software Name', placeholder: 'e.g. MacBook Pro', required: true },
    { type: 'textarea', label: 'Description',          placeholder: 'Details of request', required: true },
    { type: 'dropdown', label: 'Priority',             options: ['Low', 'Medium', 'High', 'Critical'], required: true },
    { type: 'number',   label: 'Estimated Cost (INR)', placeholder: '0',           required: false },
    { type: 'file',     label: 'Attachment',           required: false },
  ],
  Operations: [
    { type: 'text',     label: 'Requestor Name',       placeholder: 'Full name',   required: true  },
    { type: 'dropdown', label: 'Request Category',     options: ['Maintenance', 'Procurement', 'Vendor', 'Logistics', 'Other'], required: true },
    { type: 'textarea', label: 'Work Description',     placeholder: 'Describe the work', required: true },
    { type: 'date',     label: 'Requested Date',       required: true  },
    { type: 'number',   label: 'Estimated Cost',       placeholder: '0',           required: false },
    { type: 'text',     label: 'Location / Site',      placeholder: 'Site name',   required: false },
    { type: 'file',     label: 'Reference Document',   required: false },
  ],
  Sales: [
    { type: 'text',     label: 'Sales Rep Name',       placeholder: 'Full name',   required: true  },
    { type: 'text',     label: 'Client / Account',     placeholder: 'Client name', required: true  },
    { type: 'number',   label: 'Deal Value (INR)',      placeholder: '0',           required: true  },
    { type: 'dropdown', label: 'Deal Stage',           options: ['Proposal', 'Negotiation', 'Closing', 'Won', 'Lost'], required: true },
    { type: 'date',     label: 'Expected Close Date',  required: true  },
    { type: 'textarea', label: 'Deal Notes',           placeholder: 'Key deal details', required: false },
    { type: 'file',     label: 'Proposal Document',    required: false },
  ],
  Legal: [
    { type: 'text',     label: 'Requestor',            placeholder: 'Full name',   required: true  },
    { type: 'dropdown', label: 'Document Type',        options: ['NDA', 'Contract', 'MOU', 'Policy', 'Amendment'], required: true },
    { type: 'text',     label: 'Counterparty Name',    placeholder: 'Company / Person', required: true },
    { type: 'date',     label: 'Effective Date',       required: true  },
    { type: 'textarea', label: 'Scope of Work',        placeholder: 'Brief description', required: true },
    { type: 'file',     label: 'Draft Document',       required: true  },
  ],
  Warehouse: [
    { type: 'text',     label: 'GRN Number',           placeholder: 'GRN-0001',    required: true  },
    { type: 'text',     label: 'Supplier Name',        placeholder: 'Supplier',    required: true  },
    { type: 'text',     label: 'Item Description',     placeholder: 'Item name',   required: true  },
    { type: 'number',   label: 'Quantity Received',    placeholder: '0',           required: true  },
    { type: 'number',   label: 'Unit Cost (INR)',       placeholder: '0.00',        required: true  },
    { type: 'date',     label: 'Received Date',        required: true  },
    { type: 'file',     label: 'Delivery Challan',     required: true  },
  ],
  Accounts: [
    { type: 'text',     label: 'Account Name',         placeholder: 'Account holder', required: true },
    { type: 'dropdown', label: 'Transaction Type',     options: ['Payment', 'Receipt', 'Journal', 'Adjustment'], required: true },
    { type: 'number',   label: 'Amount (INR)',          placeholder: '0.00',        required: true  },
    { type: 'date',     label: 'Transaction Date',     required: true  },
    { type: 'text',     label: 'Reference Number',     placeholder: 'REF-0001',    required: false },
    { type: 'textarea', label: 'Narration',            placeholder: 'Transaction details', required: true },
    { type: 'file',     label: 'Supporting Document',  required: true  },
  ],
}

// ─── form titles per department (realistic, unique) ───────────────────────────
const FORM_TITLES = {
  HR: ['Annual Leave Request', 'Sick Leave Application', 'Casual Leave Form', 'Maternity Leave Request',
    'Work From Home Request', 'Overtime Approval Form', 'Employee Onboarding Checklist', 'Exit Interview Form',
    'Training Request Form', 'Performance Review Form', 'Probation Extension Request', 'Promotion Recommendation',
    'Salary Revision Request', 'Internal Transfer Request'],
  Finance: ['Travel Expense Claim', 'Petty Cash Request', 'Advance Payment Request', 'Vendor Payment Form',
    'Capital Expenditure Request', 'Budget Revision Form', 'Reimbursement Request', 'Purchase Order Approval',
    'Invoice Processing Form', 'Credit Note Request', 'Imprest Replenishment', 'Project Cost Approval',
    'Loan Request Form', 'Asset Write-off Request'],
  IT: ['Hardware Request Form', 'Software License Request', 'System Access Request', 'VPN Access Form',
    'IT Support Ticket', 'New User Account Setup', 'Data Access Request', 'Cloud Resource Request',
    'Mobile Device Request', 'IT Asset Disposal Form', 'Password Reset Request', 'Server Upgrade Request',
    'Network Change Request', 'Security Incident Report'],
  Operations: ['Maintenance Request', 'Procurement Request', 'Vendor Registration Form', 'Site Visit Request',
    'Vehicle Request Form', 'Fuel Expense Form', 'Facility Booking Form', 'Safety Incident Report',
    'Quality Check Form', 'Supplier Evaluation Form', 'Purchase Requisition', 'Equipment Rental Request',
    'Work Order Form', 'Project Initiation Request'],
  Sales: ['Discount Approval Form', 'Deal Registration Form', 'Client Onboarding Form', 'Sales Order Form',
    'Demo Request Form', 'Proposal Submission', 'Commission Claim Form', 'Lead Assignment Form',
    'Contract Renewal Request', 'Customer Complaint Form', 'Territory Change Request', 'Sales Target Form',
    'Pilot Agreement Form', 'Channel Partner Registration'],
  Legal: ['NDA Request Form', 'Contract Review Form', 'MOU Draft Request', 'Policy Revision Request',
    'Legal Opinion Request', 'Litigation Hold Notice', 'IP Disclosure Form', 'Vendor Contract Form',
    'Employment Agreement', 'Amendment Request', 'Compliance Declaration', 'Power of Attorney Request',
    'Regulatory Filing Form', 'Data Protection Request'],
  Warehouse: ['Goods Receipt Note', 'Stock Transfer Request', 'Inventory Adjustment Form', 'Return to Vendor Form',
    'Bin Location Change', 'Quality Hold Form', 'Dispatch Note', 'Packing Slip Form', 'Costing Entry Form',
    'Stock Count Sheet', 'Damage Report Form', 'Reorder Request', 'Consignment Inward Form', 'Material Issue Request'],
  Accounts: ['Journal Entry Form', 'Payment Voucher', 'Receipt Voucher', 'Bank Reconciliation Form',
    'Accounts Payable Request', 'Accounts Receivable Form', 'GST Filing Form', 'TDS Deduction Form',
    'Monthly Closing Checklist', 'Audit Query Response', 'Fixed Asset Registration', 'Depreciation Schedule Form',
    'Credit Limit Request', 'Write-off Approval Form'],
}

const USER_DEPTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal']

// Which role approves stage 2 for a given (form) department.
const SECOND_ROLE = {
  HR: 'hr_partner', Finance: 'Finance Approver', Accounts: 'Finance Approver',
  Warehouse: 'Warehouse Manager', Sales: 'VP', Legal: 'VP', IT: 'VP', Operations: 'VP',
}
const approverLabel = (roleKey) => ({
  direct_manager: 'Manager review', hr_partner: 'HR approval',
})[roleKey] || `${roleKey} approval`

// ─── workflow graph builder (mirrors the real exported shape) ─────────────────
function buildGraph(dept) {
  const stages = weighted([[1, 30], [2, 50], [3, 20]])
  const roleSeq = ['direct_manager']
  if (stages >= 2) roleSeq.push(SECOND_ROLE[dept] || 'VP')
  if (stages >= 3) roleSeq.push('CEO')

  const nodes = []
  const edges = []
  const byId  = {}
  const addNode = (n) => { nodes.push(n); byId[n.id] = n; return n }
  const addEdge = (s, t, label = '') => edges.push({ id: `e${edges.length}`, source: s, target: t, label })

  let y = 20
  addNode({ id: 'n1', type: 'start', label: 'Form submitted', config: { approvalType: 'sequential', slaHours: 48 }, nextNode: 'a1', position: { x: 300, y } }); y += 110

  const approvalIds = []
  roleSeq.forEach((role, i) => {
    const id = `a${i + 1}`
    approvalIds.push(id)
    addNode({
      id, type: 'approval', label: approverLabel(role),
      config: { approverRole: role, approvalType: i === 1 ? 'parallel' : 'sequential', slaHours: pick([24, 48, 72]) },
      position: { x: 300, y },
    }); y += 110
  })

  // Condition after the FIRST approval; approved → next stage (or approved-end), rejected → notify → reject-end.
  const truePath = approvalIds[1] || 'end_ok'
  addNode({
    id: 'c1', type: 'condition', label: 'Decision',
    config: { conditionField: 'lastApprovalOutcome', conditionOperator: 'eq', conditionValue: 'approved', truePath, falsePath: 'notify_reject', approvalType: 'sequential', slaHours: 48 },
    nextNode: 'notify_reject', position: { x: 300, y },
  }); y += 110

  addNode({ id: 'notify_reject', type: 'notification', label: 'Notify rejection', config: { approvalType: 'sequential', slaHours: 48, notificationMessage: 'Your request was not approved.' }, nextNode: 'end_reject', position: { x: 110, y } })
  addNode({ id: 'end_reject',    type: 'end',          label: 'Rejected',         config: { approvalType: 'sequential', slaHours: 48 }, position: { x: 110, y: y + 110 } })
  addNode({ id: 'end_ok',        type: 'end',          label: 'Approved',         config: { approvalType: 'sequential', slaHours: 48 }, position: { x: 470, y: y + 110 } })

  // wire nextNode pointers + edges
  byId.a1.nextNode = 'c1'
  addEdge('n1', 'a1')
  addEdge('a1', 'c1')
  addEdge('c1', truePath, 'approved')
  addEdge('c1', 'notify_reject', 'rejected')
  for (let i = 1; i < approvalIds.length; i++) {
    const next = approvalIds[i + 1] || 'end_ok'
    byId[approvalIds[i]].nextNode = next
    addEdge(approvalIds[i], next)
  }
  addEdge('notify_reject', 'end_reject')

  return { nodes, edges, approvalIds, roleSeq }
}

// ─── user roster (deterministic → idempotent find-or-create) ──────────────────
const ROSTER_MANAGERS = {
  HR: 'Anita Desai', Finance: 'Rohan Mehta', IT: 'Vikram Nair',
  Operations: 'Sanjay Patel', Sales: 'Neha Kapoor', Legal: 'Arjun Rao',
}
const ROSTER_HR   = ['Pooja Iyer', 'Karan Malhotra', 'Divya Menon']
const ROSTER_VP   = ['Suresh Gupta', 'Meera Krishnan']
const ROSTER_EMPLOYEES = {
  HR:         ['Riya Sharma', 'Farhan Khan'],
  Finance:    ['Aditya Verma', 'Kavya Reddy'],
  IT:         ['Ishaan Pillai', 'Zoya Sengupta'],
  Operations: ['Kabir Joshi', 'Saanvi Rao'],
  Sales:      ['Aarav Chopra', 'Diya Kapoor'],
  Legal:      ['Vivaan Nair', 'Ananya Iyer'],
}

async function getRoleMap() {
  const wanted = ['Admin', 'CEO', 'Manager', 'HR', 'VP', 'Employee', 'Finance Approver', 'Warehouse Manager', 'Accounts Officer', 'Brand Rep']
  const map = {}
  for (const name of wanted) {
    let role = await Role.findOne({ name })
    if (!role) role = await Role.create({ name, description: `${name} (auto-created by seedRealistic)`, permissions: [] })
    map[name] = role._id
  }
  return map
}

async function ensureUser({ name, roleId, roleName, department, managerId, hrId, orgId }) {
  const email = `${slug(name)}@${SEED_DOMAIN}`
  const canBuild = roleName === 'Admin'
  let user = await User.findOne({ email })
  if (!user) {
    user = await User.create({ name, email, password: DEFAULT_PASSWORD, role: roleId, department, isActive: true, managerId, hrId, orgId, canBuild })
  } else {
    let changed = false
    if (roleName === 'Admin' && !user.canBuild) { user.canBuild = true; changed = true }
    if (managerId && String(user.managerId) !== String(managerId)) { user.managerId = managerId; changed = true }
    if (hrId && String(user.hrId) !== String(hrId)) { user.hrId = hrId; changed = true }
    if (orgId && !user.orgId) { user.orgId = orgId; changed = true }
    if (changed) await user.save()
  }
  return { _id: user._id, name: user.name, email: user.email, department: user.department, roleName }
}

async function buildRoster(roleMap, defaultOrgId) {
  // Managers (one per dept)
  const managers = {}
  for (const dept of USER_DEPTS) {
    managers[dept] = await ensureUser({ name: ROSTER_MANAGERS[dept], roleId: roleMap.Manager, roleName: 'Manager', department: dept, orgId: defaultOrgId })
  }
  // HR partners + VPs
  const hrPool = []
  for (const n of ROSTER_HR) hrPool.push(await ensureUser({ name: n, roleId: roleMap.HR, roleName: 'HR', department: 'HR', orgId: defaultOrgId }))
  const vps = []
  for (const n of ROSTER_VP) vps.push(await ensureUser({ name: n, roleId: roleMap.VP, roleName: 'VP', department: pick(USER_DEPTS), orgId: defaultOrgId }))

  // CEO — reuse a real one if present, else create a seeded one.
  let ceo = await User.findOne({ role: roleMap.CEO })
  ceo = ceo
    ? { _id: ceo._id, name: ceo.name, email: ceo.email, department: ceo.department, roleName: 'CEO' }
    : await ensureUser({ name: 'Rajesh Khanna', roleId: roleMap.CEO, roleName: 'CEO', department: 'Operations', orgId: defaultOrgId })

  // Specialist approvers (custom roles). Departments must be from the User enum.
  const financeApprover  = await ensureUser({ name: 'Aarti Joshi',   roleId: roleMap['Finance Approver'],  roleName: 'Finance Approver',  department: 'Finance', orgId: defaultOrgId })
  const warehouseManager = await ensureUser({ name: 'Manish Verma',  roleId: roleMap['Warehouse Manager'], roleName: 'Warehouse Manager', department: 'Operations', orgId: defaultOrgId })
  const accountsOfficer  = await ensureUser({ name: 'Sneha Reddy',   roleId: roleMap['Accounts Officer'],  roleName: 'Accounts Officer',  department: 'Finance', orgId: defaultOrgId })
  const brandRep         = await ensureUser({ name: 'Nikhil Bansal', roleId: roleMap['Brand Rep'],         roleName: 'Brand Rep',         department: 'Sales', orgId: defaultOrgId })

  // Employees (submitters), each linked to their dept manager + an HR partner.
  const employees = []
  for (const dept of USER_DEPTS) {
    for (const n of ROSTER_EMPLOYEES[dept]) {
      const hr = pick(hrPool)
      const emp = await ensureUser({ name: n, roleId: roleMap.Employee, roleName: 'Employee', department: dept, managerId: managers[dept]._id, hrId: hr._id, orgId: defaultOrgId })
      emp.managerRef = managers[dept]
      emp.hrRef = hr
      employees.push(emp)
    }
  }

  const allApprovers = [...Object.values(managers), ...hrPool, ...vps, ceo, financeApprover, warehouseManager, accountsOfficer, brandRep]
  return { managers, hrPool, vps, ceo, financeApprover, warehouseManager, accountsOfficer, brandRep, employees, allApprovers }
}

function resolveApprover(roleKey, submitter, roster) {
  switch (roleKey) {
    case 'direct_manager':   return submitter.managerRef || pick(Object.values(roster.managers))
    case 'Manager':          return submitter.managerRef || pick(Object.values(roster.managers))
    case 'hr_partner':       return submitter.hrRef || pick(roster.hrPool)
    case 'HR':               return pick(roster.hrPool)
    case 'VP':               return pick(roster.vps)
    case 'CEO':              return roster.ceo
    case 'Finance Approver': return roster.financeApprover
    case 'Warehouse Manager':return roster.warehouseManager
    case 'Accounts Officer': return roster.accountsOfficer
    case 'Brand Rep':        return roster.brandRep
    default:                 return pick(roster.allApprovers)
  }
}
const routingNote = (roleKey, submitter, approver) => {
  const rel = roleKey === 'direct_manager' ? `${submitter.name}'s assigned manager`
    : roleKey === 'hr_partner' ? `${submitter.name}'s assigned HR partner`
    : `the ${roleKey.replace(/_/g, ' ')}`
  return `Auto-routed to ${approver.name} — ${rel}.`
}

// ─── main ─────────────────────────────────────────────────────────────────────
const run = async () => {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI not set in server/.env'); process.exit(1) }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, family: 4 })
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}\n`)

  const Organization = require('../models/Organization')
  const defaultOrg = await Organization.findOne({ isDefault: true })
  const defaultOrgId = defaultOrg?._id

  const roleMap = await getRoleMap()

  // Dedicated owner for all seeded forms/workflows (idempotency anchor).
  let seeder = await User.findOne({ email: SEEDER_EMAIL })
  if (!seeder) {
    seeder = await User.create({ name: 'Seed Bot', email: SEEDER_EMAIL, password: DEFAULT_PASSWORD, role: roleMap.Admin, department: 'IT', isActive: true, orgId: defaultOrgId })
  } else if (!seeder.orgId && defaultOrgId) {
    seeder.orgId = defaultOrgId
    await seeder.save()
  }
  const seederId = seeder._id

  // ── 1. Clean previous seed output (precise, never touches real data) ──
  const prevExecs = await WorkflowExecution.find({ 'variables._seed': true }).select('_id formResponseId').lean()
  const prevExecIds = prevExecs.map((e) => e._id)
  const prevRespIds = prevExecs.map((e) => e.formResponseId).filter(Boolean)
  const delTasks = await Task.deleteMany({ workflowExecutionId: { $in: prevExecIds } })
  const delExecs = await WorkflowExecution.deleteMany({ 'variables._seed': true })
  const delResp  = await FormResponse.deleteMany({ _id: { $in: prevRespIds } })
  const delWf    = await Workflow.deleteMany({ createdBy: seederId })
  const delForms = await Form.deleteMany({ createdBy: seederId })
  console.log(`Cleared previous seed → forms:${delForms.deletedCount} workflows:${delWf.deletedCount} responses:${delResp.deletedCount} executions:${delExecs.deletedCount} tasks:${delTasks.deletedCount}\n`)

  // ── 2. Roster ──
  const roster = await buildRoster(roleMap)
  console.log(`Roster ready → ${roster.employees.length} employees, ${roster.allApprovers.length} approvers (password: ${DEFAULT_PASSWORD})\n`)

  // ── 3. Forms + linked Workflows ──
  const formDocs = []
  const wfDocs   = []
  const pairs    = [] // { form, workflow, dept } for published+published

  let fi = 0
  for (const dept of Object.keys(FORM_TITLES)) {
    for (const title of FORM_TITLES[dept]) {
      const formId = oid()
      const fields = (FIELD_POOLS[dept] || FIELD_POOLS.HR).map((f) => ({ ...f, id: uid(), conditionalLogic: { enabled: false } }))
      // ~88% published; the rest draft/archived for realism.
      const formStatus = (fi % 8 === 7) ? pick(['draft', 'archived']) : 'published'
      const form = { _id: formId, title, description: `${fields.length} field form`, fields, status: formStatus, department: dept, createdBy: seederId, version: 1 }
      formDocs.push(form)

      const { nodes, edges, approvalIds, roleSeq } = buildGraph(dept)
      const wfId = oid()
      const wfStatus = formStatus === 'published' ? 'published' : pick(['draft', 'paused'])
      const workflow = { _id: wfId, title: `${title} Approval`, description: `Approval flow for ${title} (${dept}).`, nodes, edges, status: wfStatus, linkedFormId: formId, department: dept, createdBy: seederId, version: 1 }
      wfDocs.push(workflow)

      if (formStatus === 'published' && wfStatus === 'published') {
        pairs.push({ form, workflow, dept, approvalIds, roleSeq })
      }
      fi++
    }
  }

  await Form.insertMany(formDocs)
  await Workflow.insertMany(wfDocs)
  console.log(`Forms: ${formDocs.length}  |  Workflows: ${wfDocs.length}  |  live pairs: ${pairs.length}\n`)

  // ── 4. FormResponses + Executions + Tasks ──
  const responses = []
  const executions = []
  const tasks = []
  const counts = { completed: 0, running: 0, paused: 0, failed: 0, approvedTasks: 0, rejectedTasks: 0, pendingTasks: 0, escalatedTasks: 0 }

  for (let n = 0; n < NUM_EXECUTIONS; n++) {
    const dayOffset = rand(0, DAYS_BACK - 1)
    const pairRec   = pick(pairs)
    const { form, workflow, dept, approvalIds, roleSeq } = pairRec
    const submitter = pick(roster.employees)

    const created = new Date(NOW - dayOffset * DAY)
    created.setHours(rand(8, 19), rand(0, 59), rand(0, 59), 0)
    created.setTime(clampPast(created.getTime()))

    // form submission data
    const formData = {}
    for (const f of form.fields) formData[f.id] = valueForField(f, created)

    const submitterBlock = {
      id: submitter._id, name: submitter.name, email: submitter.email, role: submitter.roleName,
      department: submitter.department, managerId: submitter.managerRef?._id, hrId: submitter.hrRef?._id,
    }

    // scenario → status
    const scenario = dayOffset <= 10
      ? weighted([['approved', 40], ['rejected', 12], ['running', 23], ['paused', 10], ['failed', 15]])
      : weighted([['approved', 62], ['rejected', 23], ['failed', 15]])

    const respId = oid()
    const execId = oid()
    const k = approvalIds.length

    const execLog = [{ nodeId: 'n1', nodeType: 'start', enteredAt: created, exitedAt: created, status: 'completed' }]
    const variables = { _seed: true, department: dept, submitter: submitterBlock, formData }
    let execStatus, respStatus, currentNodeId, completedAt, failedAt, failureReason
    let stepTime = created.getTime() + rand(1, 6) * HOUR

    // helper to push one approval task
    const makeTask = (nodeId, status, decidedAt, slaHours, approver, breach) => {
      const tCreated = new Date(Math.min(stepTime, NOW - 60000))
      const due = new Date(tCreated.getTime() + slaHours * HOUR)
      const history = [{ action: 'submitted', performedBy: submitter._id, performedAt: tCreated, comment: '' }]
      let updatedAt = tCreated
      if (status === 'approved' || status === 'rejected') {
        let decided = decidedAt || (tCreated.getTime() + rand(1, Math.max(2, slaHours - 2)) * HOUR)
        if (breach) decided = due.getTime() + rand(2, 40) * HOUR // push past SLA
        decided = clampPast(decided)
        updatedAt = new Date(decided)
        history.push({ action: status, performedBy: approver._id, performedAt: updatedAt, comment: status === 'approved' ? pick(['Looks good.', 'Approved.', 'Cleared for processing.']) : pick(['Insufficient justification.', 'Budget exceeded.', 'Missing documents.']) })
      }
      tasks.push({
        _id: oid(), workflowExecutionId: execId, workflowId: workflow._id, assignedTo: approver._id,
        submittedBy: submitter._id, formResponseId: respId, title: `${workflow.title} — Approval Required`,
        type: dept, status, dueDate: due, currentNode: nodeId,
        approvalType: 'sequential', approvalHistory: history,
        isEscalated: status === 'escalated', escalationLevel: status === 'escalated' ? 1 : 0,
        createdAt: tCreated, updatedAt, orgId: defaultOrgId,
      })
      if (status === 'approved') counts.approvedTasks++
      else if (status === 'rejected') counts.rejectedTasks++
      else if (status === 'escalated') counts.escalatedTasks++
      else counts.pendingTasks++
      stepTime = updatedAt.getTime() + rand(1, 5) * HOUR
      return updatedAt
    }

    const approverFor = (i) => resolveApprover(roleSeq[i], submitter, roster)
    const slaFor = (i) => workflow.nodes.find((nd) => nd.id === approvalIds[i])?.config?.slaHours || 48
    variables.routingReason = routingNote(roleSeq[0], submitter, approverFor(0))

    if (scenario === 'approved') {
      execStatus = 'completed'; respStatus = 'approved'; variables.lastApprovalOutcome = 'approved'
      let last = created
      for (let i = 0; i < k; i++) {
        const breach = Math.random() < 0.18
        last = makeTask(approvalIds[i], 'approved', null, slaFor(i), approverFor(i), breach)
        execLog.push({ nodeId: approvalIds[i], nodeType: 'approval', enteredAt: last, exitedAt: last, status: 'completed', output: { outcome: 'approved' } })
        if (i === 0) execLog.push({ nodeId: 'c1', nodeType: 'condition', enteredAt: last, exitedAt: last, status: 'completed', output: { conditionMet: true, nextNodeId: approvalIds[1] || 'end_ok' } })
      }
      completedAt = new Date(clampPast(last.getTime() + rand(1, 4) * HOUR))
      execLog.push({ nodeId: 'end_ok', nodeType: 'end', enteredAt: completedAt, exitedAt: completedAt, status: 'completed' })
      currentNodeId = 'end_ok'
      counts.completed++
    } else if (scenario === 'rejected') {
      execStatus = 'completed'; respStatus = 'rejected'; variables.lastApprovalOutcome = 'rejected'
      const breach = Math.random() < 0.18
      const dec = makeTask(approvalIds[0], 'rejected', null, slaFor(0), approverFor(0), breach)
      execLog.push({ nodeId: approvalIds[0], nodeType: 'approval', enteredAt: dec, exitedAt: dec, status: 'completed', output: { outcome: 'rejected' } })
      execLog.push({ nodeId: 'c1', nodeType: 'condition', enteredAt: dec, exitedAt: dec, status: 'completed', output: { conditionMet: false, nextNodeId: 'notify_reject' } })
      const notifyAt = new Date(clampPast(dec.getTime() + rand(1, 3) * HOUR))
      execLog.push({ nodeId: 'notify_reject', nodeType: 'notification', enteredAt: notifyAt, exitedAt: notifyAt, status: 'completed' })
      completedAt = notifyAt
      execLog.push({ nodeId: 'end_reject', nodeType: 'end', enteredAt: notifyAt, exitedAt: notifyAt, status: 'completed' })
      currentNodeId = 'end_reject'
      counts.completed++
    } else if (scenario === 'failed') {
      execStatus = 'failed'; respStatus = 'under_review'
      const cur = rand(0, k - 1)
      for (let i = 0; i < cur; i++) {
        const last = makeTask(approvalIds[i], 'approved', null, slaFor(i), approverFor(i), false)
        execLog.push({ nodeId: approvalIds[i], nodeType: 'approval', enteredAt: last, exitedAt: last, status: 'completed', output: { outcome: 'approved' } })
      }
      if (cur > 0) variables.lastApprovalOutcome = 'approved'
      const escAt = makeTask(approvalIds[cur], 'escalated', null, slaFor(cur), approverFor(cur), true)
      execLog.push({ nodeId: approvalIds[cur], nodeType: 'approval', enteredAt: escAt, status: 'failed' })
      failedAt = new Date(clampPast(escAt.getTime() + rand(1, 6) * HOUR))
      failureReason = pick(['Approver did not respond within SLA', 'Escalation chain exhausted', 'Missing supporting documents'])
      currentNodeId = approvalIds[cur]
      counts.failed++
    } else {
      // running / paused — sitting on a current approval node
      execStatus = scenario; respStatus = 'under_review'
      const cur = rand(0, k - 1)
      for (let i = 0; i < cur; i++) {
        const last = makeTask(approvalIds[i], 'approved', null, slaFor(i), approverFor(i), false)
        execLog.push({ nodeId: approvalIds[i], nodeType: 'approval', enteredAt: last, exitedAt: last, status: 'completed', output: { outcome: 'approved' } })
      }
      if (cur > 0) variables.lastApprovalOutcome = 'approved'
      // current pending task (due in the future)
      const tCreated = new Date(Math.min(stepTime, NOW - 30 * 60000))
      const sla = slaFor(cur)
      const approver = approverFor(cur)
      const due = new Date(NOW + rand(2, 60) * HOUR)
      const pendId = oid()
      tasks.push({
        _id: pendId, workflowExecutionId: execId, workflowId: workflow._id, assignedTo: approver._id,
        submittedBy: submitter._id, formResponseId: respId, title: `${workflow.title} — Approval Required`,
        type: dept, status: 'pending', dueDate: due, currentNode: approvalIds[cur], approvalType: 'sequential',
        approvalHistory: [{ action: 'submitted', performedBy: submitter._id, performedAt: tCreated, comment: '' }],
        createdAt: tCreated, updatedAt: tCreated, orgId: defaultOrgId,
      })
      counts.pendingTasks++
      execLog.push({ nodeId: approvalIds[cur], nodeType: 'approval', enteredAt: tCreated, status: 'in_progress' })
      variables.pendingNodeId = approvalIds[cur]
      variables.pendingTaskId = String(pendId)
      variables.routingReason = routingNote(roleSeq[cur], submitter, approver)
      currentNodeId = approvalIds[cur]
      counts[scenario]++
    }

    const execUpdatedAt = completedAt || failedAt || new Date(clampPast(stepTime))
    responses.push({ _id: respId, formId: form._id, submittedBy: submitter._id, formData, status: respStatus, createdAt: created, updatedAt: execUpdatedAt, orgId: defaultOrgId })
    executions.push({
      _id: execId, workflowId: workflow._id, formResponseId: respId, triggeredBy: submitter._id,
      status: execStatus, currentNodeId, executionLog: execLog, variables,
      startedAt: created, createdAt: created, updatedAt: execUpdatedAt, orgId: defaultOrgId,
      ...(completedAt ? { completedAt } : {}), ...(failedAt ? { failedAt, failureReason } : {}),
    })
  }

  // timestamps:false so our historical createdAt/updatedAt are preserved.
  await FormResponse.insertMany(responses, { timestamps: false })
  await WorkflowExecution.insertMany(executions, { timestamps: false })
  await Task.insertMany(tasks, { timestamps: false })

  console.log(`Executions: ${executions.length}`)
  console.log(`  completed:${counts.completed}  running:${counts.running}  paused:${counts.paused}  failed:${counts.failed}`)
  console.log(`FormResponses: ${responses.length}`)
  console.log(`Tasks: ${tasks.length}  (approved:${counts.approvedTasks} rejected:${counts.rejectedTasks} pending:${counts.pendingTasks} escalated:${counts.escalatedTasks})`)
  console.log('\nDone. Refresh the app — Dashboard, Analytics, Forms, Workflows and Tasks are now populated.')
  console.log(`Tip: log in as a seeded employee to see the employee dashboard, e.g. ${slug(ROSTER_EMPLOYEES.Finance[0])}@${SEED_DOMAIN} / ${DEFAULT_PASSWORD}`)

  await mongoose.disconnect()
}

run().catch((err) => { console.error('Seed failed:', err); process.exit(1) })

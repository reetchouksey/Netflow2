// seeds/seedDemo.js
// Seeds 100 realistic Forms + 100 Workflows (linked together) across all departments.
// Safe + idempotent: skips documents whose title already exists.
//
// Run with:  node seeds/seedDemo.js   (from /server)

require('dotenv').config()

const mongoose = require('mongoose')
const crypto   = require('crypto')

const Form     = require('../models/Form')
const Workflow = require('../models/Workflow')
const User     = require('../models/User')

// ─── helpers ──────────────────────────────────────────────────────────────────
const uid  = () => crypto.randomUUID()
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const DEPTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal', 'Warehouse', 'Accounts']
const STATUSES_FORM = ['published', 'published', 'published', 'draft', 'archived']
const STATUSES_WF   = ['published', 'published', 'published', 'draft', 'paused']

const APPROVAL_ROLES = [
  'Manager', 'HR', 'VP', 'CEO', 'Finance Approver',
  'Warehouse Manager', 'Accounts Officer', 'Brand Rep'
]

// ─── Field templates per department ───────────────────────────────────────────
const FIELD_POOLS = {
  HR: [
    { type: 'text',     label: 'Employee Name',       placeholder: 'Full name',         required: true  },
    { type: 'text',     label: 'Employee ID',          placeholder: 'EMP-0001',          required: true  },
    { type: 'dropdown', label: 'Leave Type',           options: ['Annual','Sick','Casual','Maternity/Paternity'], required: true },
    { type: 'date',     label: 'Start Date',           required: true  },
    { type: 'date',     label: 'End Date',             required: true  },
    { type: 'number',   label: 'Number of Days',       placeholder: '5',                 required: true  },
    { type: 'textarea', label: 'Reason',               placeholder: 'Briefly explain',   required: false },
    { type: 'dropdown', label: 'Department',           options: DEPTS,                   required: true  },
    { type: 'file',     label: 'Supporting Document',  required: false },
    { type: 'checkbox', label: 'Manager Informed',     required: false },
  ],
  Finance: [
    { type: 'text',     label: 'Requester Name',       placeholder: 'Full name',         required: true  },
    { type: 'number',   label: 'Amount (INR)',          placeholder: '0.00',              required: true  },
    { type: 'dropdown', label: 'Expense Category',     options: ['Travel','Office Supplies','Software','Equipment','Other'], required: true },
    { type: 'date',     label: 'Expense Date',         required: true  },
    { type: 'text',     label: 'Vendor / Payee',       placeholder: 'Vendor name',       required: true  },
    { type: 'text',     label: 'Invoice Number',       placeholder: 'INV-0001',          required: false },
    { type: 'file',     label: 'Invoice / Receipt',    required: true  },
    { type: 'textarea', label: 'Business Justification', placeholder: 'Why is this needed?', required: true },
    { type: 'dropdown', label: 'Cost Centre',          options: ['CC-100','CC-200','CC-300','CC-400'], required: true },
    { type: 'checkbox', label: 'Budget Available',     required: false },
  ],
  IT: [
    { type: 'text',     label: 'Requester',            placeholder: 'Full name',         required: true  },
    { type: 'dropdown', label: 'Request Type',         options: ['Hardware','Software','Access','Support','Other'], required: true },
    { type: 'text',     label: 'Asset / Software Name', placeholder: 'e.g. MacBook Pro', required: true  },
    { type: 'textarea', label: 'Description',          placeholder: 'Details of request', required: true },
    { type: 'dropdown', label: 'Priority',             options: ['Low','Medium','High','Critical'], required: true },
    { type: 'date',     label: 'Required By',          required: false },
    { type: 'number',   label: 'Estimated Cost (INR)', placeholder: '0',                required: false },
    { type: 'text',     label: 'Current Asset Tag',    placeholder: 'AT-0001',           required: false },
    { type: 'file',     label: 'Attachment',           required: false },
    { type: 'checkbox', label: 'Approval from HOD',    required: false },
  ],
  Operations: [
    { type: 'text',     label: 'Requestor Name',       placeholder: 'Full name',         required: true  },
    { type: 'dropdown', label: 'Request Category',     options: ['Maintenance','Procurement','Vendor','Logistics','Other'], required: true },
    { type: 'textarea', label: 'Work Description',     placeholder: 'Describe the work', required: true  },
    { type: 'date',     label: 'Requested Date',       required: true  },
    { type: 'date',     label: 'Deadline',             required: false },
    { type: 'number',   label: 'Estimated Cost',       placeholder: '0',                 required: false },
    { type: 'text',     label: 'Location / Site',      placeholder: 'Site name',         required: false },
    { type: 'dropdown', label: 'Urgency',              options: ['Normal','Urgent','Critical'], required: true },
    { type: 'file',     label: 'Reference Document',   required: false },
    { type: 'checkbox', label: 'Safety Check Done',    required: false },
  ],
  Sales: [
    { type: 'text',     label: 'Sales Rep Name',       placeholder: 'Full name',         required: true  },
    { type: 'text',     label: 'Client / Account',     placeholder: 'Client name',       required: true  },
    { type: 'number',   label: 'Deal Value (INR)',      placeholder: '0',                 required: true  },
    { type: 'dropdown', label: 'Deal Stage',           options: ['Proposal','Negotiation','Closing','Won','Lost'], required: true },
    { type: 'date',     label: 'Expected Close Date',  required: true  },
    { type: 'dropdown', label: 'Discount Type',        options: ['None','5%','10%','15%','Custom'], required: false },
    { type: 'number',   label: 'Discount Amount',      placeholder: '0',                 required: false },
    { type: 'textarea', label: 'Deal Notes',           placeholder: 'Key deal details',  required: false },
    { type: 'file',     label: 'Proposal Document',    required: false },
    { type: 'checkbox', label: 'CRM Updated',          required: false },
  ],
  Legal: [
    { type: 'text',     label: 'Requestor',            placeholder: 'Full name',         required: true  },
    { type: 'dropdown', label: 'Document Type',        options: ['NDA','Contract','MOU','Policy','Amendment'], required: true },
    { type: 'text',     label: 'Counterparty Name',    placeholder: 'Company / Person',  required: true  },
    { type: 'date',     label: 'Effective Date',       required: true  },
    { type: 'date',     label: 'Expiry Date',          required: false },
    { type: 'number',   label: 'Contract Value (INR)', placeholder: '0',                 required: false },
    { type: 'textarea', label: 'Scope of Work',        placeholder: 'Brief description', required: true  },
    { type: 'file',     label: 'Draft Document',       required: true  },
    { type: 'dropdown', label: 'Governing Law',        options: ['Indian Law','International','Other'], required: false },
    { type: 'checkbox', label: 'Legal Review Required', required: true },
  ],
  Warehouse: [
    { type: 'text',     label: 'GRN Number',           placeholder: 'GRN-0001',          required: true  },
    { type: 'text',     label: 'Supplier Name',        placeholder: 'Supplier',          required: true  },
    { type: 'text',     label: 'Item Description',     placeholder: 'Item name',         required: true  },
    { type: 'number',   label: 'Quantity Received',    placeholder: '0',                 required: true  },
    { type: 'number',   label: 'Unit Cost (INR)',       placeholder: '0.00',              required: true  },
    { type: 'number',   label: 'Total Cost (INR)',      placeholder: '0.00',              required: true  },
    { type: 'date',     label: 'Received Date',        required: true  },
    { type: 'text',     label: 'Invoice Number',       placeholder: 'INV-0001',          required: false },
    { type: 'file',     label: 'Delivery Challan',     required: true  },
    { type: 'dropdown', label: 'Condition',            options: ['Good','Damaged','Partial'], required: true },
  ],
  Accounts: [
    { type: 'text',     label: 'Account Name',         placeholder: 'Account holder',    required: true  },
    { type: 'text',     label: 'Account Number',       placeholder: 'XXXX-XXXX',         required: true  },
    { type: 'dropdown', label: 'Transaction Type',     options: ['Payment','Receipt','Journal','Adjustment'], required: true },
    { type: 'number',   label: 'Amount (INR)',          placeholder: '0.00',              required: true  },
    { type: 'date',     label: 'Transaction Date',     required: true  },
    { type: 'text',     label: 'Reference Number',     placeholder: 'REF-0001',          required: false },
    { type: 'textarea', label: 'Narration',            placeholder: 'Transaction details', required: true },
    { type: 'file',     label: 'Supporting Document',  required: true  },
    { type: 'dropdown', label: 'Ledger Head',          options: ['Assets','Liabilities','Revenue','Expense','Equity'], required: true },
    { type: 'checkbox', label: 'GST Applicable',       required: false },
  ],
}

// ─── Form titles per department ───────────────────────────────────────────────
const FORM_TITLES = {
  HR: [
    'Annual Leave Request','Sick Leave Application','Casual Leave Form',
    'Maternity Leave Request','Paternity Leave Form','Work From Home Request',
    'Overtime Approval Form','Employee Onboarding Checklist','Exit Interview Form',
    'Training Request Form','Performance Review Form','Probation Extension Request',
    'Promotion Recommendation','Salary Revision Request',
  ],
  Finance: [
    'Travel Expense Claim','Petty Cash Request','Advance Payment Request',
    'Vendor Payment Form','Capital Expenditure Request','Budget Revision Form',
    'Reimbursement Request','Purchase Order Approval','Invoice Processing Form',
    'Credit Note Request','Imprest Account Replenishment','Project Cost Approval',
    'Loan Request Form','Asset Write-off Request',
  ],
  IT: [
    'Hardware Request Form','Software License Request','System Access Request',
    'VPN Access Form','IT Support Ticket','New User Account Setup',
    'Data Access Request','Cloud Resource Request','Mobile Device Request',
    'IT Asset Disposal Form','Password Reset Request','Server Upgrade Request',
    'Network Change Request','Security Incident Report',
  ],
  Operations: [
    'Maintenance Request','Procurement Request','Vendor Registration Form',
    'Site Visit Request','Vehicle Request Form','Fuel Expense Form',
    'Facility Booking Form','Safety Incident Report','Quality Check Form',
    'Supplier Evaluation Form','Purchase Requisition','Equipment Rental Request',
    'Work Order Form','Project Initiation Request',
  ],
  Sales: [
    'Discount Approval Form','Deal Registration Form','Client Onboarding Form',
    'Sales Order Form','Demo Request Form','Proposal Submission',
    'Commission Claim Form','Lead Assignment Form','Contract Renewal Request',
    'Customer Complaint Form','Territory Change Request','Sales Target Form',
    'Pilot Agreement Form','Channel Partner Registration',
  ],
  Legal: [
    'NDA Request Form','Contract Review Form','MOU Draft Request',
    'Policy Revision Request','Legal Opinion Request','Litigation Hold Notice',
    'Intellectual Property Disclosure','Vendor Contract Form','Employment Agreement',
    'Amendment Request','Compliance Declaration','Power of Attorney Request',
    'Regulatory Filing Form','Data Protection Request',
  ],
  Warehouse: [
    'Goods Receipt Note','Stock Transfer Request','Inventory Adjustment Form',
    'Return to Vendor Form','Bin Location Change','Quality Hold Form',
    'Dispatch Note','Packing Slip Form','Costing Entry Form',
    'Stock Count Sheet','Damage Report Form','Reorder Request',
    'Consignment Inward Form','Material Issue Request',
  ],
  Accounts: [
    'Journal Entry Form','Payment Voucher','Receipt Voucher',
    'Bank Reconciliation Form','Accounts Payable Request','Accounts Receivable Form',
    'GST Filing Form','TDS Deduction Form','Monthly Closing Checklist',
    'Audit Query Response','Fixed Asset Registration','Depreciation Schedule Form',
    'Credit Limit Request','Write-off Approval Form',
  ],
}

// ─── Workflow titles per department ───────────────────────────────────────────
const WORKFLOW_TITLES = {
  HR: [
    'Leave Approval Workflow','Onboarding Workflow','Exit Process Workflow',
    'Promotion Approval Flow','Training Approval Workflow','Salary Revision Flow',
    'Performance Review Cycle','Overtime Authorization Flow','WFH Approval Process',
    'Probation Review Workflow','Disciplinary Action Flow','Transfer Request Flow',
    'Recruitment Approval Flow','Employee Grievance Flow',
  ],
  Finance: [
    'Expense Reimbursement Flow','Budget Approval Workflow','Vendor Payment Flow',
    'Capital Expenditure Flow','Purchase Order Workflow','Invoice Approval Flow',
    'Petty Cash Workflow','Advance Payment Flow','Project Cost Approval Flow',
    'Credit Note Workflow','Asset Write-off Flow','Loan Approval Workflow',
    'Financial Audit Flow','Tax Filing Workflow',
  ],
  IT: [
    'Hardware Procurement Flow','Software Request Workflow','Access Control Flow',
    'IT Onboarding Workflow','Incident Management Flow','Change Management Workflow',
    'Asset Disposal Flow','Cloud Provisioning Flow','Security Review Workflow',
    'Vendor Approval Flow','System Upgrade Workflow','Data Migration Flow',
    'Patch Management Flow','IT Audit Workflow',
  ],
  Operations: [
    'Maintenance Approval Flow','Procurement Workflow','Vendor Onboarding Flow',
    'Safety Incident Workflow','Quality Assurance Flow','Facility Management Flow',
    'Project Kickoff Workflow','Supplier Review Flow','Work Order Workflow',
    'Equipment Approval Flow','Logistics Coordination Flow','Rental Approval Workflow',
    'Site Inspection Flow','Operational Audit Flow',
  ],
  Sales: [
    'Discount Approval Workflow','Deal Registration Flow','Client Onboarding Flow',
    'Contract Review Workflow','Commission Approval Flow','Lead Qualification Flow',
    'Proposal Approval Workflow','Sales Order Processing','Territory Change Flow',
    'Channel Partner Approval','Pilot Agreement Flow','Price Exception Workflow',
    'Customer Escalation Flow','Revenue Recognition Flow',
  ],
  Legal: [
    'Contract Review Workflow','NDA Approval Flow','MOU Signing Workflow',
    'Policy Update Flow','Legal Clearance Workflow','Dispute Resolution Flow',
    'IP Filing Workflow','Compliance Review Flow','Regulatory Approval Workflow',
    'Employment Agreement Flow','Data Privacy Workflow','Litigation Approval Flow',
    'Audit Response Workflow','Amendment Approval Flow',
  ],
  Warehouse: [
    'GRN & Costing Workflow','Stock Transfer Approval','Inventory Adjustment Flow',
    'Return to Vendor Flow','Quality Inspection Workflow','Dispatch Approval Flow',
    'Goods Receipt Workflow','Reorder Approval Flow','Damage Assessment Flow',
    'Material Issue Workflow','Consignment Approval Flow','Bin Transfer Flow',
    'Annual Stock Audit Flow','Costing Verification Workflow',
  ],
  Accounts: [
    'Payment Voucher Workflow','Journal Entry Approval','Bank Reconciliation Flow',
    'GST Filing Workflow','TDS Processing Flow','Monthly Closing Workflow',
    'Audit Query Flow','Asset Registration Workflow','Depreciation Approval Flow',
    'Credit Limit Workflow','Write-off Approval Flow','Accounts Payable Flow',
    'Accounts Receivable Workflow','Year-end Closing Flow',
  ],
}

// ─── Build nodes for a workflow ───────────────────────────────────────────────
function buildNodes(dept) {
  const roles = APPROVAL_ROLES.filter(r =>
    !['Warehouse Manager','Accounts Officer','Brand Rep','Finance Approver'].includes(r) ||
    ['Warehouse','Accounts','Finance'].includes(dept)
  )
  const approverCount = rand(1, 3)
  const nodes = []
  const edges = []

  // start
  nodes.push({ id: 'start', type: 'start', label: 'Start', position: { x: 100, y: 200 } })

  let prev = 'start'
  for (let i = 0; i < approverCount; i++) {
    const id = `approval_${i + 1}`
    nodes.push({
      id,
      type: 'approval',
      label: `Approval ${i + 1}`,
      config: { approverRole: pick(roles), slaHours: pick([24, 48, 72]), approvalType: 'sequential' },
      position: { x: 300 + i * 200, y: 200 }
    })
    edges.push({ id: `e_${prev}_${id}`, source: prev, target: id })
    prev = id
  }

  // end
  nodes.push({ id: 'end', type: 'end', label: 'End', position: { x: 300 + approverCount * 200, y: 200 } })
  edges.push({ id: `e_${prev}_end`, source: prev, target: 'end' })

  return { nodes, edges }
}

// ─── Main seeder ──────────────────────────────────────────────────────────────
const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 })
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

  // We need a real user _id for createdBy (required field on Form).
  const adminUser = await User.findOne().sort({ createdAt: 1 }).lean()
  if (!adminUser) {
    console.error('No users found. Register at least one account first, then re-run.')
    process.exit(1)
  }
  const creatorId = adminUser._id
  console.log(`Using creator: ${adminUser.name} (${adminUser.email})`)

  let formsCreated = 0, formsSkipped = 0
  let wfCreated = 0, wfSkipped = 0

  const deptKeys = Object.keys(FORM_TITLES)

  // Build a flat list of 100 form definitions cycling through departments
  const formDefs = []
  for (let i = 0; i < 100; i++) {
    const dept = deptKeys[i % deptKeys.length]
    const titlePool = FORM_TITLES[dept]
    const title = titlePool[Math.floor(i / deptKeys.length) % titlePool.length]
      + (Math.floor(i / deptKeys.length) > 0 ? ` v${Math.floor(i / deptKeys.length) + 1}` : '')
    formDefs.push({ title, dept })
  }

  const formIds = [] // parallel array, index matches formDefs

  // Upsert forms
  for (let i = 0; i < formDefs.length; i++) {
    const { title, dept } = formDefs[i]
    const existing = await Form.findOne({ title }).lean()
    if (existing) {
      formIds.push(existing._id)
      formsSkipped++
      continue
    }

    const pool = FIELD_POOLS[dept] || FIELD_POOLS.HR
    const fieldCount = rand(3, pool.length)
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, fieldCount)
    const fields = shuffled.map(f => ({ ...f, id: uid() }))

    const status = pick(STATUSES_FORM)
    const form = await Form.create({
      title,
      description: `${fieldCount} field form`,
      fields,
      department: dept,
      status,
      createdBy: creatorId,
      version: 1,
    })
    formIds.push(form._id)
    formsCreated++
  }

  console.log(`Forms  → created: ${formsCreated}, skipped (already exist): ${formsSkipped}`)

  // Build a flat list of 100 workflow definitions cycling through departments
  const wfDefs = []
  for (let i = 0; i < 100; i++) {
    const dept = deptKeys[i % deptKeys.length]
    const titlePool = WORKFLOW_TITLES[dept]
    const title = titlePool[Math.floor(i / deptKeys.length) % titlePool.length]
      + (Math.floor(i / deptKeys.length) > 0 ? ` v${Math.floor(i / deptKeys.length) + 1}` : '')
    wfDefs.push({ title, dept, formId: formIds[i] })
  }

  // Upsert workflows
  for (let i = 0; i < wfDefs.length; i++) {
    const { title, dept, formId } = wfDefs[i]
    const existing = await Workflow.findOne({ title }).lean()
    if (existing) {
      wfSkipped++
      continue
    }

    const { nodes, edges } = buildNodes(dept)
    const status = pick(STATUSES_WF)

    await Workflow.create({
      title,
      description: `Automated approval flow for ${dept} department`,
      nodes,
      edges,
      department: dept,
      status,
      linkedFormId: formId,
      createdBy: creatorId,
      version: 1,
    })
    wfCreated++
  }

  console.log(`Workflows → created: ${wfCreated}, skipped (already exist): ${wfSkipped}`)
  console.log('\nDone. Open the app → Forms and Workflows pages to see the data.')
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

// seeds/populateCreatedOrgs.js
// Ensures every organization created in the platform (Bansal, TCS, Netlink, DBL, etc.)
// has its complete, linked database data: Users, Departments, Forms, Workflows,
// Form Responses, Executions, Tasks/Approvals, and Audit Logs.

require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/netflow')
  console.log('Connected to MongoDB for Org Data Population...')

  const db = mongoose.connection.db
  const hashedPassword = await bcrypt.hash('Admin@12345', 10)

  // Fetch all organizations in MongoDB
  const orgs = await db.collection('organizations').find({ subdomain: { $ne: 'default' } }).toArray()
  console.log(`Found ${orgs.length} created Organizations to populate:`)

  const defaultRoles = await db.collection('roles').find().toArray()
  const orgAdminRole = defaultRoles.find(r => r.code === 'ORG_ADMIN' || r.key === 'org_admin') || defaultRoles[0]
  const deptHeadRole = defaultRoles.find(r => r.code === 'DEPT_HEAD' || r.key === 'dept_head') || defaultRoles[0]
  const employeeRole = defaultRoles.find(r => r.code === 'EMPLOYEE' || r.key === 'employee') || defaultRoles[0]

  const sampleTemplates = [
    { name: 'Leave Application Form', dept: 'HR', type: 'HR' },
    { name: 'Expense Claim Form', dept: 'Finance', type: 'Finance' },
    { name: 'IT Support & Access Request', dept: 'IT', type: 'IT' },
    { name: 'Purchase Order Requisition', dept: 'Operations', type: 'Operations' },
    { name: 'New Vendor Onboarding', dept: 'Procurement', type: 'Legal' },
    { name: 'Travel Allowance Claim', dept: 'Finance', type: 'Finance' },
    { name: 'Employee Offboarding Checklist', dept: 'HR', type: 'HR' },
    { name: 'Software Licence Approval', dept: 'IT', type: 'IT' }
  ]

  const departments = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal']

  for (const org of orgs) {
    console.log(`\n▶ Populating Org: "${org.name}" (subdomain: ${org.subdomain}, id: ${org._id})`)
    const orgId = org._id
    const sub = String(org.subdomain || 'org').toLowerCase()

    const orgUsers = []

    // 1. Ensure Primary Admin User exists
    let primaryAdmin = await db.collection('users').findOne({
      $or: [
        { orgId: orgId, isPrimaryAdmin: true },
        { organization: orgId, isPrimaryAdmin: true },
        { orgId: orgId, role: 'Org Admin' },
        { organization: orgId, role: 'Org Admin' }
      ]
    })

    if (!primaryAdmin && (org.adminEmail || org.contactEmail)) {
      primaryAdmin = await db.collection('users').findOne({
        $or: [
          { email: org.adminEmail },
          { email: org.contactEmail }
        ]
      })
    }

    if (!primaryAdmin) {
      const adminEmail = org.adminEmail || org.contactEmail || `admin.${sub}@flowsphere.app`
      primaryAdmin = {
        _id: new mongoose.Types.ObjectId(),
        name: org.contactName || `${org.name} Admin`,
        email: adminEmail,
        password: hashedPassword,
        role: 'Org Admin',
        roleId: orgAdminRole?._id,
        organization: orgId,
        orgId: orgId,
        department: 'Executive',
        status: 'Active',
        isPrimaryAdmin: true,
        createdAt: new Date()
      }
      await db.collection('users').insertOne(primaryAdmin)
      console.log(`   + Created Primary Admin: ${primaryAdmin.email}`)
    } else {
      // Ensure user has correct orgId & status
      await db.collection('users').updateOne(
        { _id: primaryAdmin._id },
        { $set: { orgId: orgId, organization: orgId, status: 'Active', isPrimaryAdmin: true } }
      )
      console.log(`   ✓ Found Primary Admin: ${primaryAdmin.email}`)
    }
    orgUsers.push(primaryAdmin)

    // Ensure Organization document has owner details
    await db.collection('organizations').updateOne(
      { _id: orgId },
      { $set: { adminEmail: primaryAdmin.email, contactEmail: primaryAdmin.email, contactName: primaryAdmin.name } }
    )

    // 2. Ensure Department Heads & Employees exist for each department
    for (const dept of departments) {
      const deptHeadEmail = `head.${dept.toLowerCase()}.${sub}@flowsphere.app`
      let deptHead = await db.collection('users').findOne({ email: deptHeadEmail })
      if (!deptHead) {
        deptHead = {
          _id: new mongoose.Types.ObjectId(),
          name: `${dept} Lead - ${org.name}`,
          email: deptHeadEmail,
          password: hashedPassword,
          role: 'Department Head',
          roleId: deptHeadRole?._id,
          organization: orgId,
          orgId: orgId,
          department: dept,
          status: 'Active',
          createdAt: new Date()
        }
        await db.collection('users').insertOne(deptHead)
      } else {
        await db.collection('users').updateOne(
          { _id: deptHead._id },
          { $set: { orgId: orgId, organization: orgId, status: 'Active' } }
        )
      }
      orgUsers.push(deptHead)

      const empEmail = `user.${dept.toLowerCase()}.${sub}@flowsphere.app`
      let emp = await db.collection('users').findOne({ email: empEmail })
      if (!emp) {
        emp = {
          _id: new mongoose.Types.ObjectId(),
          name: `${dept} Executive - ${org.name}`,
          email: empEmail,
          password: hashedPassword,
          role: 'Employee',
          roleId: employeeRole?._id,
          organization: orgId,
          orgId: orgId,
          department: dept,
          status: 'Active',
          createdAt: new Date()
        }
        await db.collection('users').insertOne(emp)
      } else {
        await db.collection('users').updateOne(
          { _id: emp._id },
          { $set: { orgId: orgId, organization: orgId, status: 'Active' } }
        )
      }
      orgUsers.push(emp)
    }

    // Update user count in Organization document
    await db.collection('organizations').updateOne(
      { _id: orgId },
      { $set: { userCount: orgUsers.length } }
    )

    // 3. Create Forms, Workflows, Form Responses, Executions, Tasks & Audit Logs
    let createdForms = 0
    let createdWorkflows = 0
    let createdTasks = 0

    for (const tpl of sampleTemplates) {
      const formId = new mongoose.Types.ObjectId()
      const workflowId = new mongoose.Types.ObjectId()

      const formDoc = {
        _id: formId,
        orgId: orgId,
        title: `${tpl.name}`,
        description: `Standard ${tpl.name} process for ${org.name}`,
        department: tpl.dept,
        fields: [
          { id: 'field_1', label: 'Requester Name', type: 'text', required: true },
          { id: 'field_2', label: 'Department', type: 'text', required: true },
          { id: 'field_3', label: 'Amount / Details', type: 'text', required: true },
          { id: 'field_4', label: 'Justification / Reason', type: 'textarea', required: false }
        ],
        status: 'Published',
        createdBy: primaryAdmin._id,
        linkedWorkflowId: workflowId,
        createdAt: new Date()
      }
      await db.collection('forms').updateOne({ _id: formId }, { $set: formDoc }, { upsert: true })
      createdForms++

      const deptUsers = orgUsers.filter(u => u.department === tpl.dept)
      const approver = deptUsers.find(u => u.role === 'Department Head') || primaryAdmin

      const workflowDoc = {
        _id: workflowId,
        orgId: orgId,
        name: `${tpl.name} Approval Workflow`,
        description: `Automated approval chain for ${tpl.name}`,
        department: tpl.dept,
        linkedFormId: formId,
        steps: [
          { id: 'step_1', label: 'Department Head Review', type: 'approval', assignee: approver._id, status: 'pending' },
          { id: 'step_2', label: 'Organization Admin Sign-off', type: 'approval', assignee: primaryAdmin._id, status: 'pending' }
        ],
        status: 'Active',
        createdBy: primaryAdmin._id,
        createdAt: new Date()
      }
      await db.collection('workflows').updateOne({ _id: workflowId }, { $set: workflowDoc }, { upsert: true })
      createdWorkflows++

      const requester = deptUsers.find(u => u.role === 'Employee') || primaryAdmin
      const formResponseId = new mongoose.Types.ObjectId()
      const executionId = new mongoose.Types.ObjectId()

      const responseDoc = {
        _id: formResponseId,
        orgId: orgId,
        formId: formId,
        submittedBy: requester._id,
        submittedByName: requester.name,
        values: {
          field_1: requester.name,
          field_2: tpl.dept,
          field_3: '$500 / Standard Request',
          field_4: 'Standard operational request for organization requirements.'
        },
        status: 'Submitted',
        createdAt: new Date()
      }
      await db.collection('formresponses').updateOne({ _id: formResponseId }, { $set: responseDoc }, { upsert: true })

      const executionDoc = {
        _id: executionId,
        orgId: orgId,
        workflowId: workflowId,
        formResponseId: formResponseId,
        triggeredBy: requester._id,
        status: 'running',
        currentStepIndex: 0,
        steps: [
          { id: 'step_1', label: 'Department Head Review', assignee: approver._id, status: 'pending', startedAt: new Date() }
        ],
        createdAt: new Date()
      }
      await db.collection('workflowexecutions').updateOne({ _id: executionId }, { $set: executionDoc }, { upsert: true })

      const taskDoc = {
        _id: new mongoose.Types.ObjectId(),
        orgId: orgId,
        title: `Approve: ${tpl.name} - ${requester.name}`,
        workflowId: workflowId,
        executionId: executionId,
        formResponseId: formResponseId,
        assignedTo: approver._id,
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 86400000 * 3),
        createdAt: new Date()
      }
      await db.collection('tasks').updateOne({ _id: taskDoc._id }, { $set: taskDoc }, { upsert: true })
      createdTasks++

      const auditDoc = {
        _id: new mongoose.Types.ObjectId(),
        orgId: orgId,
        performedBy: { _id: primaryAdmin._id, name: primaryAdmin.name, email: primaryAdmin.email },
        action: 'create_form',
        targetType: 'Form',
        targetId: formId,
        details: `Created ${formDoc.title}`,
        createdAt: new Date()
      }
      await db.collection('auditlogs').updateOne({ _id: auditDoc._id }, { $set: auditDoc }, { upsert: true })
    }

    console.log(`   ✓ Org "${org.name}" Ready → ${orgUsers.length} Users, ${createdForms} Forms, ${createdWorkflows} Workflows, ${createdTasks} Tasks`)
  }

  console.log('\n✅ Population completed! All organization data stored in MongoDB database.')
  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Population script failed:', err)
  process.exit(1)
})

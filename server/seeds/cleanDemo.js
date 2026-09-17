// Maintenance - seeds/cleanDemo.js
// Removes every demo/dev record from the database so the app shows only the
// real data your team enters through the UI. Targets known demo identities by
// email + the known demo form/workflow titles, then wipes all downstream
// records (form responses, executions, tasks, notifications, audit logs) that
// reference them.
//
// Run with:  npm run clean-demo   (from /server)
//
// Real users / forms / workflows created through the app are NOT matched and
// stay untouched. After running, the first account to register at /register is
// promoted to Admin (see routes/auth.js).

require('dotenv').config()

const mongoose = require('mongoose')
const dns = require('dns')

dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])

const User = require('../models/User')
const Form = require('../models/Form')
const Workflow = require('../models/Workflow')
const FormResponse = require('../models/FormResponse')
const WorkflowExecution = require('../models/WorkflowExecution')
const Task = require('../models/Task')
const Notification = require('../models/Notification')
const AuditLog = require('../models/AuditLog')

// Every demo / dev account these seeders ever created.
const DEMO_USER_EMAILS = [
  // current showcase dataset (@flowsphere.dev)
  'sarah@flowsphere.dev', 'marcus@flowsphere.dev', 'priya@flowsphere.dev',
  'james@flowsphere.dev', 'lin@flowsphere.dev', 'rahul@flowsphere.dev',
  'aisha@flowsphere.dev', 'david@flowsphere.dev', 'maya@flowsphere.dev',
  // dev convenience logins (@flowsphere.local)
  'admin@flowsphere.local', 'manager@flowsphere.local', 'employee@flowsphere.local',
  // legacy demo accounts from earlier seeders
  'superadmin@flowsphere.dev', 'admin@flowsphere.dev',
  'manager.hr@flowsphere.dev', 'manager.finance@flowsphere.dev',
  'employee.hr@flowsphere.dev', 'employee.finance@flowsphere.dev',
  'viewer@flowsphere.dev'
]

// Known demo titles — a safety net in case a demo form/workflow was created by
// an account that no longer exists.
const DEMO_FORM_TITLES = [
  'Leave Request', 'Expense Claim', 'IT Access Request', 'New Hire Onboarding'
]
const DEMO_WORKFLOW_TITLES = [
  'Leave Approval Workflow', 'Expense Approval Workflow', 'IT Access Workflow'
]

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Create server/.env first.')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      family: 4
    })
    console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
    console.log('')

    const demoUsers = await User.find({
      $or: [
        { email: { $in: DEMO_USER_EMAILS } },
        { email: /@flowsphere\./i }
      ]
    }).select('_id email').lean()
    const demoUserIds = demoUsers.map((u) => u._id)
    console.log(`Found ${demoUsers.length} demo user(s).`)

    // Forms / workflows owned by demo users, plus any matching the known titles.
    const demoForms = await Form.find({
      $or: [{ createdBy: { $in: demoUserIds } }, { title: { $in: DEMO_FORM_TITLES } }]
    }).select('_id').lean()
    const demoFormIds = demoForms.map((f) => f._id)

    const demoWorkflows = await Workflow.find({
      $or: [{ createdBy: { $in: demoUserIds } }, { title: { $in: DEMO_WORKFLOW_TITLES } }]
    }).select('_id').lean()
    const demoWorkflowIds = demoWorkflows.map((w) => w._id)

    // Downstream records that reference any demo entity.
    const [responses, executions, tasks, notifications, auditLogs] = await Promise.all([
      FormResponse.deleteMany({
        $or: [{ formId: { $in: demoFormIds } }, { submittedBy: { $in: demoUserIds } }]
      }),
      WorkflowExecution.deleteMany({
        $or: [{ workflowId: { $in: demoWorkflowIds } }, { triggeredBy: { $in: demoUserIds } }]
      }),
      Task.deleteMany({
        $or: [
          { workflowId: { $in: demoWorkflowIds } },
          { submittedBy: { $in: demoUserIds } },
          { assignedTo: { $in: demoUserIds } }
        ]
      }),
      Notification.deleteMany({
        $or: [{ userId: { $in: demoUserIds } }, { triggeredBy: { $in: demoUserIds } }]
      }),
      AuditLog.deleteMany({ performedBy: { $in: demoUserIds } })
    ])

    const forms     = await Form.deleteMany({ _id: { $in: demoFormIds } })
    const workflows = await Workflow.deleteMany({ _id: { $in: demoWorkflowIds } })
    const users     = await User.deleteMany({ _id: { $in: demoUserIds } })

    console.log('')
    console.log('Cleanup summary')
    console.log('---------------')
    console.log(`Users removed:           ${users.deletedCount}`)
    console.log(`Forms removed:           ${forms.deletedCount}`)
    console.log(`Workflows removed:       ${workflows.deletedCount}`)
    console.log(`Form responses removed:  ${responses.deletedCount}`)
    console.log(`Executions removed:      ${executions.deletedCount}`)
    console.log(`Tasks removed:           ${tasks.deletedCount}`)
    console.log(`Notifications removed:   ${notifications.deletedCount}`)
    console.log(`Audit logs removed:      ${auditLogs.deletedCount}`)
    console.log('')
    console.log('Done. Roles are preserved. Register an account')
    console.log('at /register — the first sign-up is promoted to Admin.')
  } catch (err) {
    console.error('clean-demo failed:', err.message || err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()

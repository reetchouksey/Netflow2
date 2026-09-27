// seeds/seedDefaultHierarchy.js
// Seeds Default Organization, platform & tenant roles, and key hierarchy users:
// SuperAdmin, Admin, CEO, VP, Manager, HR, Finance Approver, and Employee.
// Safe & Idempotent: Can be run multiple times.

require('dotenv').config()
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

const Organization = require('../models/Organization')
const Role = require('../models/Role')
const User = require('../models/User')

const DEFAULT_USERS = [
  {
    key: 'superadmin',
    name: 'Platform Super Admin',
    email: 'superadmin@netflow.app',
    password: process.env.SUPERADMIN_PASSWORD || 'Super@12345',
    roleName: 'SuperAdmin',
    department: 'IT',
    isPlatform: true,
    isProtected: true,
    canBuild: true,
    description: 'Platform management, organization creation, system-wide administration'
  },
  {
    key: 'admin',
    name: 'Workspace Admin',
    email: 'admin@netflow.app',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    roleName: 'Admin',
    department: 'IT',
    isProtected: true,
    canBuild: true,
    description: 'Full workspace administration, user management, and builder access'
  },
  {
    key: 'ceo',
    name: 'Chief Executive Officer',
    email: 'ceo@netflow.app',
    password: process.env.CEO_PASSWORD || 'Ceo@12345',
    roleName: 'CEO',
    department: 'Operations',
    isProtected: true,
    canBuild: true,
    description: 'Executive decisions, organization-wide reporting, and audit oversight'
  },
  {
    key: 'vp',
    name: 'Vice President',
    email: 'vp@netflow.app',
    password: process.env.VP_PASSWORD || 'Vp@12345',
    roleName: 'VP',
    department: 'Operations',
    canBuild: true,
    description: 'Senior approvals, high-level workflow reviews, and analytics'
  },
  {
    key: 'manager',
    name: 'Operations Manager',
    email: 'manager@netflow.app',
    password: process.env.MANAGER_PASSWORD || 'Manager@12345',
    roleName: 'Manager',
    department: 'IT',
    canBuild: true,
    description: 'Team management, direct approvals, and team workflow decisions'
  },
  {
    key: 'hr',
    name: 'HR Partner',
    email: 'hr@netflow.app',
    password: process.env.HR_PASSWORD || 'Hr@12345',
    roleName: 'HR',
    department: 'HR',
    canBuild: false,
    description: 'People-process decisions, employee onboarding, and HR approvals'
  },
  {
    key: 'finance',
    name: 'Finance Approver',
    email: 'finance@netflow.app',
    password: process.env.FINANCE_PASSWORD || 'Finance@12345',
    roleName: 'Finance Approver',
    department: 'Finance',
    canBuild: false,
    description: 'Financial reviews, expense claims, and budget sign-offs'
  },
  {
    key: 'employee',
    name: 'Alex Rivera (Employee)',
    email: 'employee@netflow.app',
    password: process.env.EMPLOYEE_PASSWORD || 'Employee@12345',
    roleName: 'Employee',
    department: 'IT',
    canBuild: false,
    description: 'General workspace user, form submissions, and task execution'
  }
]

const run = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI
  if (!uri) {
    console.error('MongoDB URI not found in .env')
    process.exit(1)
  }

  console.log('Connecting to MongoDB...')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, family: 4 })
  console.log(`Connected to: ${mongoose.connection.name}\n`)

  // 1. Ensure Default Organization
  let org = await Organization.findOne({ isDefault: true })
  if (!org) {
    org = await Organization.create({
      name: 'Default Organization',
      subdomain: 'default',
      allowedDomains: [],
      departments: ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal', 'Warehouse', 'Accounts'],
      features: { externalUsers: true },
      limits: { maxUsers: 0, maxWorkflows: 0 },
      status: 'active',
      isDefault: true
    })
    console.log(`Created Default Organization: ${org.name} (${org._id})`)
  } else {
    console.log(`Default Organization exists: ${org.name} (${org._id})`)
  }

  // 2. Ensure Platform Role: SuperAdmin (no orgId)
  let superAdminRole = await Role.findOne({ name: 'SuperAdmin' })
  if (!superAdminRole) {
    superAdminRole = await Role.create({
      name: 'SuperAdmin',
      description: 'Platform super admin — manages organizations, system-wide admin',
      permissions: ['platform:manage_orgs', '*']
    })
    console.log('Created SuperAdmin role')
  }

  // 3. Ensure Tenant Roles for Default Org
  const tenantRolesConfig = [
    { name: 'Admin', description: 'Full workspace administration.', permissions: ['*'] },
    { name: 'CEO', description: 'Executive decisions, organization-wide reporting, and audit oversight.', permissions: ['forms:read', 'forms:submit', 'tasks:read', 'tasks:act', 'tasks:decide', 'audit:read', 'analytics:read'] },
    { name: 'VP', description: 'Senior approvals and organization-wide analytics.', permissions: ['forms:read', 'forms:submit', 'tasks:read', 'tasks:act', 'tasks:decide', 'analytics:read'] },
    { name: 'Manager', description: 'Team decisions and operational reporting.', permissions: ['forms:read', 'forms:submit', 'tasks:read', 'tasks:act', 'tasks:decide', 'analytics:read'] },
    { name: 'HR', description: 'People-process decisions and operational reporting.', permissions: ['forms:read', 'forms:submit', 'tasks:read', 'tasks:act', 'tasks:decide', 'users:read', 'analytics:read'] },
    { name: 'Finance Approver', description: 'Financial review and expense approvals.', permissions: ['forms:read', 'forms:submit', 'tasks:read', 'tasks:act', 'tasks:decide'] },
    { name: 'Employee', description: 'Request submission and personal task tracking.', permissions: ['forms:read', 'forms:submit', 'tasks:read', 'tasks:act'] }
  ]

  const roleMap = {
    SuperAdmin: superAdminRole._id
  }

  for (const r of tenantRolesConfig) {
    const key = r.name.toLowerCase()
    let role = await Role.findOne({ orgId: org._id, nameKey: key }).setOptions({ skipOrgScope: true })
    if (!role) {
      role = await Role.create({
        orgId: org._id,
        name: r.name,
        nameKey: key,
        description: r.description,
        permissions: r.permissions
      })
      console.log(`Created tenant role: ${r.name}`)
    }
    roleMap[r.name] = role._id
  }

  // 4. Seed Users
  const userDocs = {}
  for (const u of DEFAULT_USERS) {
    const targetOrgId = u.isPlatform ? org._id : org._id
    let user = await User.findOne({ email: u.email, orgId: targetOrgId }).setOptions({ skipOrgScope: true })
    
    if (user) {
      user.name = u.name
      user.role = roleMap[u.roleName]
      user.department = u.department
      user.isActive = true
      if (u.isProtected) user.isProtected = true
      if (u.canBuild !== undefined) user.canBuild = u.canBuild
      user.password = u.password // Mongoose pre('save') hashes it
      await user.save()
      console.log(`Updated user: ${u.name} <${u.email}> (${u.roleName})`)
    } else {
      user = await User.create({
        orgId: targetOrgId,
        name: u.name,
        email: u.email,
        password: u.password,
        role: roleMap[u.roleName],
        department: u.department,
        isActive: true,
        isProtected: !!u.isProtected,
        canBuild: !!u.canBuild
      })
      console.log(`Created user: ${u.name} <${u.email}> (${u.roleName})`)
    }
    userDocs[u.key] = user
  }

  // Link Employee to Manager & HR
  if (userDocs.employee && userDocs.manager && userDocs.hr) {
    userDocs.employee.managerId = userDocs.manager._id
    userDocs.employee.hrId = userDocs.hr._id
    await userDocs.employee.save()
    console.log(`Linked ${userDocs.employee.name} -> Manager: ${userDocs.manager.name}, HR: ${userDocs.hr.name}`)
  }

  // 5. Generate Markdown and JSON credential files
  const credentialsMarkdown = generateMarkdownCredentials(DEFAULT_USERS, org)
  const credentialsJson = JSON.stringify({
    organization: {
      name: org.name,
      subdomain: org.subdomain,
      id: org._id
    },
    users: DEFAULT_USERS.map(u => ({
      role: u.roleName,
      name: u.name,
      email: u.email,
      password: u.password,
      department: u.department,
      canBuild: !!u.canBuild,
      description: u.description
    }))
  }, null, 2)

  const rootPath = path.resolve(__dirname, '..', '..')
  const serverPath = path.resolve(__dirname, '..')

  fs.writeFileSync(path.join(rootPath, 'CREDENTIALS.md'), credentialsMarkdown, 'utf8')
  fs.writeFileSync(path.join(serverPath, 'CREDENTIALS.md'), credentialsMarkdown, 'utf8')
  fs.writeFileSync(path.join(rootPath, 'credentials.json'), credentialsJson, 'utf8')

  console.log('\n======================================================')
  console.log(' SEED COMPLETED SUCCESSFULLY!')
  console.log(' Generated: CREDENTIALS.md and credentials.json')
  console.log('======================================================\n')

  await mongoose.disconnect()
}

function generateMarkdownCredentials(users, org) {
  return `# 🔐 NetFlow System Demo Credentials

> **Default Organization:** \`${org.name}\` (Subdomain: \`${org.subdomain}\`)  
> **API / Web URL:** \`http://localhost:5173\` (Frontend) | \`http://localhost:5000\` (Backend API)  
> **Last Generated:** ${new Date().toISOString()}

---

## 👥 Seed User Accounts

| Role | Name | Email | Password | Department | Permissions / Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
${users.map(u => `| **${u.roleName}** | ${u.name} | \`${u.email}\` | \`${u.password}\` | ${u.department} | ${u.description} |`).join('\n')}

---

## 🧭 Role Hierarchy & Workflow Roles

\`\`\`mermaid
graph TD
    SuperAdmin["Platform SuperAdmin<br/>(superadmin@netflow.app)"]
    Admin["Workspace Admin<br/>(admin@netflow.app)"]
    CEO["Chief Executive Officer<br/>(ceo@netflow.app)"]
    VP["Vice President<br/>(vp@netflow.app)"]
    Manager["Operations Manager<br/>(manager@netflow.app)"]
    HR["HR Partner<br/>(hr@netflow.app)"]
    Finance["Finance Approver<br/>(finance@netflow.app)"]
    Employee["Alex Rivera (Employee)<br/>(employee@netflow.app)"]

    SuperAdmin -.-> Admin
    Admin --> CEO
    CEO --> VP
    VP --> Manager
    Manager --> Employee
    HR -. HR Support .-> Employee
    Finance -. Financial Review .-> Employee
\`\`\`

---

## 🚀 Quick Login Guide
1. Go to the login page: \`http://localhost:5173/login\`
2. Use any of the email & password pairs above.
3. For testing workflow approvals:
   - Submit a request as **Employee** (\`employee@netflow.app\`).
   - Log in as **Manager** (\`manager@netflow.app\`) or **HR** / **Finance** to approve/review the request in the Task Inbox.
   - Log in as **Admin** or **CEO** to inspect forms, workflows, and workspace analytics.
`
}

run().catch((err) => {
  console.error('Failed to seed default hierarchy:', err)
  process.exit(1)
})

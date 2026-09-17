require('dotenv').config();
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const path = require('path');

const User = require('../models/User');
const Organization = require('../models/Organization');
const Form = require('../models/Form');
const Workflow = require('../models/Workflow');
const Task = require('../models/Task');
const FormResponse = require('../models/FormResponse');

const baseDir = path.resolve(__dirname, '../../');

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      family: 4
    });
    console.log(`Connected to MongoDB: ${mongoose.connection.host}`);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NetFlow Analytics Exporter';

    // Helper to format sheets
    const formatSheet = (sheet) => {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      
      sheet.columns.forEach((col) => {
        col.width = 25;
      });
    };

    // 1. Users
    const users = await User.find().populate('orgId').lean();
    const wsUsers = wb.addWorksheet('Users');
    wsUsers.columns = [
      { header: 'ID', key: '_id' },
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Role', key: 'role' },
      { header: 'Organization', key: 'orgName' },
      { header: 'Subdomain', key: 'subdomain' },
      { header: 'Department', key: 'department' },
      { header: 'Job Title', key: 'jobTitle' },
      { header: 'Last Active', key: 'lastActiveAt' },
      { header: 'Created At', key: 'createdAt' },
    ];
    users.forEach(u => {
      wsUsers.addRow({
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        orgName: u.orgId?.name || '',
        subdomain: u.orgId?.subdomain || '',
        department: u.department,
        jobTitle: u.jobTitle,
        lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : '',
        createdAt: u.createdAt ? u.createdAt.toISOString() : ''
      });
    });
    formatSheet(wsUsers);

    // 2. Organizations
    const orgs = await Organization.find().lean();
    const wsOrgs = wb.addWorksheet('Organizations');
    wsOrgs.columns = [
      { header: 'ID', key: '_id' },
      { header: 'Name', key: 'name' },
      { header: 'Subdomain', key: 'subdomain' },
      { header: 'Plan', key: 'plan' },
      { header: 'Status', key: 'status' },
      { header: 'Users Count', key: 'usersCount' },
      { header: 'Storage Config', key: 'storageType' },
      { header: 'Trial Valid Until', key: 'validUntil' },
      { header: 'Created At', key: 'createdAt' },
    ];
    orgs.forEach(o => {
      wsOrgs.addRow({
        _id: o._id.toString(),
        name: o.name,
        subdomain: o.subdomain,
        plan: o.plan,
        status: o.status,
        usersCount: o.licensing?.resources?.users?.used || 0,
        storageType: o.storage?.type || 'local',
        validUntil: o.licence?.validUntil ? o.licence.validUntil.toISOString() : '',
        createdAt: o.createdAt ? o.createdAt.toISOString() : ''
      });
    });
    formatSheet(wsOrgs);

    // 3. Forms
    const forms = await Form.find().lean();
    const wsForms = wb.addWorksheet('Forms');
    wsForms.columns = [
      { header: 'ID', key: '_id' },
      { header: 'Title', key: 'title' },
      { header: 'Status', key: 'status' },
      { header: 'Org ID', key: 'org' },
      { header: 'Created By', key: 'createdBy' },
      { header: 'Category', key: 'category' },
      { header: 'Fields Count', key: 'fieldsCount' },
      { header: 'Created At', key: 'createdAt' },
    ];
    forms.forEach(f => {
      wsForms.addRow({
        _id: f._id.toString(),
        title: f.title,
        status: f.status,
        org: f.orgId?.toString() || '',
        createdBy: f.createdBy?.toString() || '',
        category: f.category || '',
        fieldsCount: f.fields ? f.fields.length : 0,
        createdAt: f.createdAt ? f.createdAt.toISOString() : ''
      });
    });
    formatSheet(wsForms);

    // 4. Workflows
    const workflows = await Workflow.find().lean();
    const wsWorkflows = wb.addWorksheet('Workflows');
    wsWorkflows.columns = [
      { header: 'ID', key: '_id' },
      { header: 'Title', key: 'title' },
      { header: 'Status', key: 'status' },
      { header: 'Org ID', key: 'org' },
      { header: 'Created By', key: 'createdBy' },
      { header: 'Nodes Count', key: 'nodesCount' },
      { header: 'Created At', key: 'createdAt' },
    ];
    workflows.forEach(w => {
      wsWorkflows.addRow({
        _id: w._id.toString(),
        title: w.title,
        status: w.status,
        org: w.orgId?.toString() || '',
        createdBy: w.createdBy?.toString() || '',
        nodesCount: w.nodes ? w.nodes.length : 0,
        createdAt: w.createdAt ? w.createdAt.toISOString() : ''
      });
    });
    formatSheet(wsWorkflows);

    // 5. Tasks (Pending/Approvals)
    const tasks = await Task.find().lean();
    const wsTasks = wb.addWorksheet('Tasks_Approvals');
    wsTasks.columns = [
      { header: 'ID', key: '_id' },
      { header: 'Status', key: 'status' },
      { header: 'Org ID', key: 'org' },
      { header: 'Workflow ID', key: 'workflowId' },
      { header: 'Execution ID', key: 'executionId' },
      { header: 'Assigned To', key: 'assignedTo' },
      { header: 'Department', key: 'department' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Resolved At', key: 'resolvedAt' },
      { header: 'Resolution', key: 'resolution' },
    ];
    tasks.forEach(t => {
      wsTasks.addRow({
        _id: t._id.toString(),
        status: t.status,
        org: t.orgId?.toString() || '',
        workflowId: t.workflowId?.toString() || '',
        executionId: t.executionId?.toString() || '',
        assignedTo: Array.isArray(t.assignedTo) ? t.assignedTo.join(', ') : t.assignedTo?.toString() || '',
        department: t.department || '',
        dueDate: t.dueDate ? t.dueDate.toISOString() : '',
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : '',
        resolution: t.resolution || ''
      });
    });
    formatSheet(wsTasks);

    // 6. Form Responses (Submissions)
    const responses = await FormResponse.find().lean();
    const wsResponses = wb.addWorksheet('Form_Submissions');
    wsResponses.columns = [
      { header: 'ID', key: '_id' },
      { header: 'Status', key: 'status' },
      { header: 'Form ID', key: 'formId' },
      { header: 'Org ID', key: 'org' },
      { header: 'Submitted By', key: 'submittedBy' },
      { header: 'Submitted At', key: 'createdAt' },
    ];
    responses.forEach(r => {
      wsResponses.addRow({
        _id: r._id.toString(),
        status: r.status,
        formId: r.formId?.toString() || '',
        org: r.orgId?.toString() || '',
        submittedBy: r.submittedBy?.toString() || '',
        createdAt: r.createdAt ? r.createdAt.toISOString() : ''
      });
    });
    formatSheet(wsResponses);

    const filePath = path.join(baseDir, 'Business_Analyst_Dashboard_Data.xlsx');
    await wb.xlsx.writeFile(filePath);
    console.log('Successfully generated complete data export for Business Analyst!');
    console.log('File Path: ' + filePath);

  } catch (err) {
    console.error('Failed to export data:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();

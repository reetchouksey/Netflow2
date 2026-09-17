const ExcelJS = require('exceljs');
const path = require('path');

const baseDir = path.resolve('c:/Users/rchouksey/Downloads/NetFlow-main (3)/NetFlow-main');

// Styling constants
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate-800
const HEADER_FONT = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
const BORDER_STYLE = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
};

function formatSheet(sheet, headers, rows) {
  sheet.views = [{ showGridLines: true }];
  
  // Header Row
  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = BORDER_STYLE;
  });

  // Data Rows
  rows.forEach((rowData, idx) => {
    const row = sheet.addRow(rowData);
    row.height = 24;
    const isEven = idx % 2 === 0;
    row.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.border = BORDER_STYLE;
      if (!isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  // Set column widths
  sheet.columns.forEach((col) => {
    col.width = 30;
  });
  if (sheet.columns[0]) sheet.columns[0].width = 22;
  if (sheet.columns[1]) sheet.columns[1].width = 28;
  if (sheet.columns[2]) sheet.columns[2].width = 35;
  if (sheet.columns[3]) sheet.columns[3].width = 35;
  if (sheet.columns[4]) sheet.columns[4].width = 45;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUPER ADMIN DASHBOARD SPECIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function generateSuperAdminExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NetFlow System';

  // Sheet 1: Dashboard Overview & KPIs
  const ws1 = wb.addWorksheet('SuperAdmin Overview & KPIs');
  const headers1 = ['Category', 'KPI / Widget Name', 'Value / Formula', 'Data Source', 'Brief Description & Business Purpose'];
  const rows1 = [
    ['Header KPI', 'Total Monthly Revenue (MRR)', '$12.9k / mo', 'Subscription Plans DB', 'Tracks combined monthly recurring revenue from all active paid tenant organizations.'],
    ['Header KPI', 'Annual Recurring Revenue (ARR)', '$154.8k / yr (MRR × 12)', 'Calculated from MRR', 'Projected annual revenue generated across the entire platform fleet.'],
    ['Header KPI', 'Total Organizations', '6 Organizations (Active)', 'Platform Org Collection', 'Total tenant organizations onboarded on NetFlow platform.'],
    ['Header KPI', 'Platform Users', '6 Users (Fleet total)', 'User Collection (All orgs)', 'Total active user accounts across all tenant organizations.'],
    ['Header KPI', 'Workflow Runs', '56 Executions', 'Workflow Execution Logs', 'Total active and completed workflow executions across all organizations.'],
    ['Header KPI', 'Suspended Organizations', '1 Organization', 'Org Status Flag', 'Number of organizations currently suspended due to payment or policy breach.'],
    ['Revenue Chart', 'Revenue Trend (MRR)', 'Monthly breakdown ($4.2k - $12.9k)', 'Billing History DB', 'Area chart showing month-on-month revenue growth trends from Jan to Aug 2026.'],
    ['System Health', 'API Uptime & Latency', '99.98% Uptime / 0.02ms Latency', 'Platform Health Monitor', 'Monitors global server health, API response rates, and queue backlog.'],
    ['Action Bar', '+ New Org Provisioning', 'Modal Trigger', 'Org Creation Endpoint', 'Allows Super Admin to instantly create & onboard a new tenant organization.']
  ];
  formatSheet(ws1, headers1, rows1);

  // Sheet 2: Organizations Management
  const ws2 = wb.addWorksheet('Tenants & Subscriptions');
  const headers2 = ['Organization Name', 'Subdomain', 'Current Plan', 'MRR Contribution', 'Status & Licence Expiry', 'Available Controls & Actions'];
  const rows2 = [
    ['Bansal', 'bansal-djg9.netflow.app', 'Trial Plan', '$0 / mo', 'Trial Active (Valid till 24 Dec 2026)', 'Change Plan, Reset Admin Password, Suspend/Activate, Storage Config'],
    ['DBL', 'dbl-puvc.netflow.app', 'Trial Plan', '$0 / mo', 'Trial Active (Valid till 10 Oct 2026)', 'Change Plan, Reset Admin Password, Suspend/Activate, Storage Config'],
    ['DBL', 'dbl-r1li.netflow.app', 'Trial Plan', '$0 / mo', 'Trial Active (Valid till 10 Oct 2026)', 'Change Plan, Reset Admin Password, Suspend/Activate, Storage Config'],
    ['Netlink', 'netlink-yi0n.netflow.app', 'Trial Plan', '$0 / mo', 'Perpetual Licence', 'Change Plan, Reset Admin Password, Suspend/Activate, Storage Config'],
    ['TCS', 'tcs-vmw4.netflow.app', 'Trial Plan', '$0 / mo', 'Trial Active (Valid till 31 Dec 2026)', 'Change Plan, Reset Admin Password, Suspend/Activate, Storage Config'],
    ['Xebia', 'xebia-test.netflow.app', 'Starter Plan', '$49 / mo', 'Active (Valid till 31 Dec 2026)', 'Change Plan, Reset Admin Password, Suspend/Activate, Storage Config']
  ];
  formatSheet(ws2, headers2, rows2);

  // Sheet 3: Fleet Resource Usage
  const ws3 = wb.addWorksheet('Fleet Meters & Quotas');
  const headers3 = ['Resource Meter', 'Meter Description', 'Platform Headroom', 'Warning Threshold', 'Usage Action'];
  const rows3 = [
    ['Users Meter', 'Active user seats allocated per organization', '3 to 25 Users per Org', '80% Seat Capacity', 'Notify Org Admin to upgrade plan when seat capacity is breached.'],
    ['Builders Meter', 'Form & Workflow Builder accounts permitted', '1 to 5 Builders per Org', '100% Builder Cap', 'Restrict new form creation if builder limit is reached.'],
    ['Forms Meter', 'Published digital forms allowed', '5 to 1000 Forms per Org', 'Over Limit Alert', 'Prompts plan upgrade or archiving old inactive forms.'],
    ['Workflows Meter', 'Active automated workflow pipelines', '2 to 100 Workflows per Org', 'Over Limit Alert', 'Pauses new workflow activation until upgraded.'],
    ['Submissions Meter', 'Monthly form response submission quota', '100 to 10,000 / month', '90% Quota Used', 'Sends email reminder to Org Admin for quota extension.'],
    ['Storage Meter', 'BaseLayer DMS & Document storage quota', '1.0 GB to 500 GB per Org', '85% Storage Used', 'Provides additional cloud storage add-on options.']
  ];
  formatSheet(ws3, headers3, rows3);

  const filePath = path.join(baseDir, 'SuperAdmin_Dashboard_Specification.xlsx');
  await wb.xlsx.writeFile(filePath);
  console.log('Generated SuperAdmin_Dashboard_Specification.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ORG ADMIN DASHBOARD SPECIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function generateOrgAdminExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NetFlow System';

  // Sheet 1: Org Admin Overview
  const ws1 = wb.addWorksheet('OrgAdmin Overview & KPIs');
  const headers1 = ['Category', 'KPI / Widget Name', 'Value / Target', 'Data Source', 'Brief Description & Business Purpose'];
  const rows1 = [
    ['Header Metric', 'Total Members', '26 Users Onboarded', 'Org User Roster', 'Total active employees and staff members added in the organization.'],
    ['Header Metric', 'Active Departments', '5 Departments (HR, Finance, Ops...)', 'Department Roster', 'Functional departments configured for workflow routing.'],
    ['Header Metric', 'Forms Created', '16 Digital Forms', 'Form Builder DB', 'Total active forms configured for data collection across teams.'],
    ['Header Metric', 'Workflows Active', '16 Automated Pipelines', 'Workflow Engine DB', 'Active multi-step approval workflows handling business automation.'],
    ['Header Metric', 'Form Responses', '16 Submissions Processed', 'Response Submissions DB', 'Total form submissions received from employees or external users.'],
    ['Header Metric', 'Storage Consumption', '113.4 KB Used of 500 GB', 'BaseLayer DMS Storage', 'Cloud document storage space utilized by attachments and files.'],
    ['Governance', 'Pending Approvals', '2 Tasks Awaiting Review', 'Task Assignment DB', 'Critical organization tasks pending manager or admin approval.'],
    ['DMS Status', 'BaseLayer DMS Connection', 'Connected (Status: Green)', 'DMS API Health Check', 'Verifies active API key connection to BaseLayer Document Storage.']
  ];
  formatSheet(ws1, headers1, rows1);

  // Sheet 2: User & Department Roster
  const ws2 = wb.addWorksheet('User Roster & Access Controls');
  const headers2 = ['Designation / Role', 'Access Scope', 'Primary Responsibilities', 'Permitted Dashboard Tabs', 'Security Permissions'];
  const rows2 = [
    ['Organization Admin', 'Full Tenant Scope', 'Manage users, roles, forms, workflows, integrations & audit logs', 'Dashboard, Departments, Users, Roles, Forms, Workflows, DMS, Reports, Audit Logs, Settings', 'Create/Edit/Delete Users, Assign Roles, Publish Forms, Edit DMS Keys'],
    ['Department Manager', 'Department Scope', 'Approve/Reject tasks, monitor team performance & manage department docs', 'Dashboard, Tasks, Forms, Workflows, Document Storage (DMS), Reports', 'Approve/Reject Tasks, Reassign Tasks, View Department Analytics, Upload Docs'],
    ['Standard Employee', 'Personal Scope', 'Submit forms, view assigned tasks, track request status & access DMS', 'Dashboard, My Tasks, Submit Forms, Document Storage (DMS)', 'Fill Forms, View Personal Submissions, Download Permitted Documents']
  ];
  formatSheet(ws2, headers2, rows2);

  // Sheet 3: Governance & Integration Settings
  const ws3 = wb.addWorksheet('Governance & DMS Setup');
  const headers3 = ['Feature Area', 'Setting / Option', 'Configuration Detail', 'Business Impact'];
  const rows3 = [
    ['Document Management', 'BaseLayer DMS Integration', 'DMS API Key & Base URL (https://base-layer.systems)', 'Enables secure Cloud R2 signed document uploads, folder organization, and document previews.'],
    ['Security Governance', 'Session & Password Policy', 'Reset Admin Password & Force Logout', 'Allows Org Admin to reset compromised user credentials instantly.'],
    ['Form Builder', 'Field & Grid Controls', 'Dynamic Input Fields, Tables, File Uploads', 'Standardizes business data intake across HR, Finance, and Operations.'],
    ['Audit Logging', 'System Activity Logs', 'User login times, IP addresses, workflow state updates', 'Ensures legal compliance, data traceability, and enterprise security auditing.']
  ];
  formatSheet(ws3, headers3, rows3);

  const filePath = path.join(baseDir, 'OrgAdmin_Dashboard_Specification.xlsx');
  await wb.xlsx.writeFile(filePath);
  console.log('Generated OrgAdmin_Dashboard_Specification.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MANAGER & EMPLOYEE DASHBOARD SPECIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function generateManagerEmployeeExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NetFlow System';

  // Sheet 1: Manager Dashboard Specs
  const ws1 = wb.addWorksheet('Manager Dashboard');
  const headers1 = ['Category', 'Widget / Metric Name', 'Metric Formula / Target', 'Data Source', 'Brief Description & Manager Action'];
  const rows1 = [
    ['Header KPI', 'Pending Team Approvals', 'Count of Tasks in "Pending" state', 'Task Assignment Engine', 'Shows tasks awaiting manager approval (e.g. Leave, Expense, Purchase Orders). Action: Approve / Reject.'],
    ['Header KPI', 'Avg Approval Time (SLA)', '< 24 Hours Target', 'Task Resolution Timestamps', 'Measures average hours taken by manager to resolve incoming team requests.'],
    ['Header KPI', 'Team SLA Breaches', 'Count of overdue tasks (>48h)', 'Task Due Date Engine', 'Highlights urgent tasks exceeding department response deadlines.'],
    ['Header KPI', 'Approved Requests (This Month)', 'Count of Approved tasks', 'Task History DB', 'Tracks monthly volume of approved business requests.'],
    ['Widget', 'Department Workflow Pipeline', 'Visual Status Bar (Pending/Approved/Rejected)', 'Workflow Submissions', 'Real-time breakdown of all active workflows in manager department.'],
    ['Widget', 'Recent Team Submissions', 'List of top 10 recent submissions', 'Form Submissions DB', 'Displays applicant name, submission date, attached docs, and current step.'],
    ['Action Bar', '+ Quick Approval / Batch Action', 'Approve/Reject Button Row', 'Task Action Endpoint', 'Allows manager to approve or reject requests with comments in 1-click.']
  ];
  formatSheet(ws1, headers1, rows1);

  // Sheet 2: Employee Dashboard Specs
  const ws2 = wb.addWorksheet('Employee Dashboard');
  const headers2 = ['Category', 'Widget / Metric Name', 'Value / Display Format', 'Data Source', 'Brief Description & Employee Action'];
  const rows2 = [
    ['Header KPI', 'My Pending Tasks', 'Count of Actionable Tasks', 'User Task Queue', 'Tasks assigned specifically to employee needing input or re-submission.'],
    ['Header KPI', 'Submitted Requests', 'Count of Active Requests', 'User Submission History', 'Track status of submitted forms (e.g. Under Review, Approved, Rejected).'],
    ['Header KPI', 'Draft Forms', 'Count of Saved Form Drafts', 'Local Storage / Draft DB', 'Resume uncompleted form submissions saved as draft.'],
    ['Header KPI', 'Completed Approvals', 'Count of Approved Forms', 'User Submission History', 'History of successfully approved requests.'],
    ['Widget', 'Quick Form Launchpad', 'Grid of Available Forms', 'Published Forms Roster', 'Allows employee to click & launch HR, Expense, IT, or Travel forms.'],
    ['Widget', 'Recent Request Timeline', 'Step Progress Bar (Submitted → Manager Review → Completed)', 'Workflow Node Tracker', 'Visual step-by-step progress tracking for active submitted requests.']
  ];
  formatSheet(ws2, headers2, rows2);

  // Sheet 3: Document Storage (DMS) Specs for Manager & Employee
  const ws3 = wb.addWorksheet('Document Storage (DMS)');
  const headers3 = ['Component', 'Feature / View Name', 'Functional Requirement', 'Access Permission', 'Brief Description & User Benefit'];
  const rows3 = [
    ['Folder Tree', 'Department Folders', 'Bansal > General / HR / Finance', 'Manager & Employee', 'Hierarchical folder structure organizing company and department files.'],
    ['Upload Action', '+ Upload Document', 'Native File Selection + Progress Toast', 'Manager & Employee', 'Uploads local PDF, Word, Excel, or Image files directly into DMS storage.'],
    ['Document List', 'Files Table', 'Shows File Name, Type, Size, Uploaded By, Date', 'Manager & Employee', 'Displays list of stored documents downside with quick action icons.'],
    ['Preview Action', 'Document Viewer Modal', 'Inline Image & Signed PDF Viewer', 'Manager & Employee', 'Displays document preview immediately without forcing full file download.'],
    ['DMS Portal Link', 'DMS Login Redirect', 'Link to https://base-layer.systems', 'Manager & Employee', 'Direct single sign-on shortcut link to BaseLayer Enterprise DMS.']
  ];
  formatSheet(ws3, headers3, rows3);

  const filePath = path.join(baseDir, 'Manager_Employee_Dashboard_Specification.xlsx');
  await wb.xlsx.writeFile(filePath);
  console.log('Generated Manager_Employee_Dashboard_Specification.xlsx');
}

async function run() {
  await generateSuperAdminExcel();
  await generateOrgAdminExcel();
  await generateManagerEmployeeExcel();
  console.log('All 3 Excel files generated successfully!');
}

run().catch(console.error);

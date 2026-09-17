const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const baseDir = path.resolve('c:/Users/rchouksey/Downloads/NetFlow-main (3)/NetFlow-main');

// Styling constants
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate-900
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
    col.width = 28;
  });
  if (sheet.columns[0]) sheet.columns[0].width = 22;
  if (sheet.columns[1]) sheet.columns[1].width = 26;
  if (sheet.columns[2]) sheet.columns[2].width = 32;
  if (sheet.columns[3]) sheet.columns[3].width = 35;
  if (sheet.columns[4]) sheet.columns[4].width = 45;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUPER ADMIN ANALYTICS DASHBOARD DATA
// ─────────────────────────────────────────────────────────────────────────────
async function generateSuperAdminAnalyticsExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NetFlow Analytics Team';

  // Sheet 1: Dashboard KPI & Chart Brief
  const ws1 = wb.addWorksheet('KPI & Visual Specifications');
  const headers1 = ['Widget / Chart Name', 'Visual Type', 'Calculation Formula', 'Required Slicers / Filters', 'Analyst Guidance & Business Objective'];
  const rows1 = [
    ['Total MRR', 'Single Value KPI Card', 'SUM(Organizations.planPrice)', 'Date Range, Plan Type', 'Displays current Monthly Recurring Revenue across all paid tenant orgs. Target: $12.9k/mo.'],
    ['Total ARR', 'Single Value KPI Card', 'MRR * 12', 'Date Range', 'Annualized revenue projection. Target: $154.8k/yr.'],
    ['Total Organizations', 'Single Value KPI Card', 'COUNT(Organizations.id)', 'Status (Active/Suspended/Trial)', 'Total count of onboarded tenant companies on NetFlow platform.'],
    ['Total Platform Users', 'Single Value KPI Card', 'COUNT(Users.id)', 'Org Name, Role, Department', 'Total registered user accounts across all tenant organizations.'],
    ['Workflow Runs', 'Single Value KPI Card', 'COUNT(WorkflowExecutions.id)', 'Status (Completed/Failed/Pending)', 'Total execution volume of automated workflows.'],
    ['Suspended Orgs', 'Single Value KPI Card', 'COUNT(Organizations WHERE status="suspended")', 'Org Status', 'Monitors count of non-compliant or billing-paused tenant orgs.'],
    ['Revenue Growth Trend', 'Area / Line Chart', 'SUM(MRR) GROUP BY Month', 'Month-Year Selector (Jan - Aug 2026)', 'Plots monthly MRR trajectory to show month-on-month growth percentage (+68%).'],
    ['Fleet Resource Utilization', 'Grouped Bar Chart', 'AVG(ResourceUsage.percent) BY Org', 'Resource Meter Type (Users, Storage, Workflows)', 'Compares tenant resource consumption against plan limits to identify upsell opportunities.'],
    ['System Latency & Uptime', 'Gauge / Scorecard Chart', 'Uptime % & Response Time (ms)', 'Environment (Production/Staging)', 'Monitors platform infrastructure health, API response rates, and queue backlog.']
  ];
  formatSheet(ws1, headers1, rows1);

  // Sheet 2: Data Schema & Entities
  const ws2 = wb.addWorksheet('Data Schema & Fields');
  const headers2 = ['Entity / Table Name', 'Field Name', 'Data Type', 'Sample Value', 'Description for Analyst'];
  const rows2 = [
    ['Organizations', '_id / id', 'String / ObjectId', 'org_bansal_01', 'Unique tenant organization identifier.'],
    ['Organizations', 'name', 'String', 'Bansal', 'Organization company title.'],
    ['Organizations', 'subdomain', 'String', 'bansal-djg9', 'Tenant subdomain URL prefix.'],
    ['Organizations', 'plan', 'String', 'starter / growth / trial', 'Subscription plan tier.'],
    ['Organizations', 'status', 'String', 'active / suspended', 'Organization account operational state.'],
    ['Organizations', 'validUntil', 'Date ISO String', '2026-12-24T00:00:00.000Z', 'Licence validity or trial expiry date.'],
    ['ResourceUsage', 'usersCount', 'Integer', '26', 'Total active users in tenant.'],
    ['ResourceUsage', 'formsCount', 'Integer', '16', 'Total forms created in tenant.'],
    ['ResourceUsage', 'workflowsCount', 'Integer', '16', 'Total workflows active in tenant.'],
    ['ResourceUsage', 'storageBytes', 'Number (Bytes)', '116121', 'Total cloud storage bytes used.']
  ];
  formatSheet(ws2, headers2, rows2);

  // Sheet 3: Raw Sample Data Records
  const ws3 = wb.addWorksheet('Sample Data Records');
  const headers3 = ['Org ID', 'Org Name', 'Subdomain', 'Plan Tier', 'MRR ($)', 'Users', 'Forms', 'Workflows', 'Storage (KB)', 'Status'];
  const rows3 = [
    ['org_01', 'Bansal', 'bansal-djg9', 'Trial', '0', '26', '16', '16', '113.4', 'Active'],
    ['org_02', 'DBL (Primary)', 'dbl-puvc', 'Trial', '0', '26', '16', '16', '113.4', 'Active'],
    ['org_03', 'DBL (Regional)', 'dbl-r1li', 'Trial', '0', '14', '8', '8', '56.7', 'Active'],
    ['org_04', 'Netlink', 'netlink-yi0n', 'Trial', '0', '14', '8', '8', '56.7', 'Active'],
    ['org_05', 'TCS', 'tcs-vmw4', 'Trial', '0', '14', '8', '8', '56.7', 'Active'],
    ['org_06', 'Xebia', 'xebia-test', 'Starter', '49', '10', '5', '5', '45.0', 'Active']
  ];
  formatSheet(ws3, headers3, rows3);

  const filePath = path.join(baseDir, 'SuperAdmin_Analytics_Dashboard_Data.xlsx');
  await wb.xlsx.writeFile(filePath);
  console.log('Generated SuperAdmin_Analytics_Dashboard_Data.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ORG ADMIN ANALYTICS DASHBOARD DATA
// ─────────────────────────────────────────────────────────────────────────────
async function generateOrgAdminAnalyticsExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NetFlow Analytics Team';

  // Sheet 1: Dashboard KPI & Chart Brief
  const ws1 = wb.addWorksheet('KPI & Visual Specifications');
  const headers1 = ['Widget / Chart Name', 'Visual Type', 'Calculation Formula', 'Required Slicers / Filters', 'Analyst Guidance & Business Objective'];
  const rows1 = [
    ['Total Members', 'Single Value KPI Card', 'COUNT(Users.id)', 'Department, Role', 'Total employee count within the organization (e.g. 26 Users).'],
    ['Active Departments', 'Single Value KPI Card', 'COUNT(Departments.id)', 'Department Status', 'Count of active operational departments (HR, Finance, Operations, Sales, IT).'],
    ['Forms Created', 'Single Value KPI Card', 'COUNT(Forms.id)', 'Form Status (Published/Draft)', 'Total forms published for business data collection (e.g. 16 Forms).'],
    ['Active Workflows', 'Single Value KPI Card', 'COUNT(Workflows.id)', 'Workflow Status', 'Total automated multi-stage workflow pipelines configured (e.g. 16 Workflows).'],
    ['Total Submissions', 'Single Value KPI Card', 'COUNT(FormResponses.id)', 'Date Range, Department', 'Total form response submissions processed across all forms.'],
    ['DMS Storage Used', 'Gauge Chart', 'Sum(File.size) / TotalQuota', 'File Category, Department', 'Monitors storage space consumed against organization quota (113.4 KB / 500 GB).'],
    ['Submissions by Department', 'Donut / Pie Chart', 'COUNT(Responses) GROUP BY Department', 'Date Range, Form Type', 'Displays department-wise submission volume to identify active business units.'],
    ['Form Completion Rate', 'Stacked Bar Chart', 'Completed / (Completed + Abandoned)', 'Form ID, Month', 'Measures user completion efficiency for digital forms.'],
    ['Pending Approvals Queue', 'Data Table Grid', 'Filter Tasks WHERE status="Pending"', 'Priority, Manager Name', 'Lists top pending tasks requiring approval attention.']
  ];
  formatSheet(ws1, headers1, rows1);

  // Sheet 2: Data Schema & Fields
  const ws2 = wb.addWorksheet('Data Schema & Fields');
  const headers2 = ['Entity / Table Name', 'Field Name', 'Data Type', 'Sample Value', 'Description for Analyst'];
  const rows2 = [
    ['Users', '_id', 'ObjectId', 'usr_9981273', 'Unique user account ID.'],
    ['Users', 'name', 'String', 'Rahul Sharma', 'User full name.'],
    ['Users', 'email', 'String', 'rahul@bansal.com', 'User work email address.'],
    ['Users', 'role', 'String', 'org_admin / manager / employee', 'User access level.'],
    ['Users', 'department', 'String', 'HR / Finance / Operations', 'Assigned department name.'],
    ['Forms', 'title', 'String', 'Employee Onboarding Form', 'Form title.'],
    ['FormResponses', 'status', 'String', 'Pending / Approved / Rejected', 'Workflow state of the submission.'],
    ['FormResponses', 'submittedAt', 'Date ISO String', '2026-08-24T10:15:00.000Z', 'Timestamp when form was submitted.'],
    ['DocumentStorage', 'filename', 'String', 'invoice_2026.pdf', 'Uploaded document filename.'],
    ['DocumentStorage', 'size', 'Number', '116121', 'Document size in bytes.']
  ];
  formatSheet(ws2, headers2, rows2);

  // Sheet 3: Sample Data Records
  const ws3 = wb.addWorksheet('Sample Data Records');
  const headers3 = ['User Name', 'Role', 'Department', 'Forms Created', 'Workflows Active', 'Submissions Managed', 'DMS Documents', 'Status'];
  const rows3 = [
    ['Eswar Kumar', 'Org Admin', 'Executive', '16', '16', '16', '12 Files', 'Active'],
    ['Priya Verma', 'Department Manager', 'HR', '4', '4', '6', '3 Files', 'Active'],
    ['Amit Patel', 'Department Manager', 'Finance', '4', '4', '4', '4 Files', 'Active'],
    ['Vikram Singh', 'Department Manager', 'Operations', '4', '4', '3', '2 Files', 'Active'],
    ['Neha Gupta', 'Standard Employee', 'HR', '0', '0', '2', '1 File', 'Active'],
    ['Rohan Mehta', 'Standard Employee', 'Finance', '0', '0', '1', '0 Files', 'Active']
  ];
  formatSheet(ws3, headers3, rows3);

  const filePath = path.join(baseDir, 'OrgAdmin_Analytics_Dashboard_Data.xlsx');
  await wb.xlsx.writeFile(filePath);
  console.log('Generated OrgAdmin_Analytics_Dashboard_Data.xlsx');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MANAGER & EMPLOYEE ANALYTICS DASHBOARD DATA
// ─────────────────────────────────────────────────────────────────────────────
async function generateManagerEmployeeAnalyticsExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NetFlow Analytics Team';

  // Sheet 1: Manager Analytics Brief
  const ws1 = wb.addWorksheet('Manager KPI & Visual Brief');
  const headers1 = ['Widget / Metric Name', 'Visual Type', 'Calculation Formula', 'Required Slicers / Filters', 'Analyst Guidance & Manager Action'];
  const rows1 = [
    ['Pending Team Approvals', 'Single Value KPI Card', 'COUNT(Tasks WHERE status="Pending")', 'Urgency, Employee Name', 'Count of pending tasks awaiting manager approval. Target: 0 overdue.'],
    ['Avg Approval Time (SLA)', 'Single Value KPI Card', 'AVG(ResolvedAt - AssignedAt) in Hours', 'Month, Workflow Type', 'Tracks manager decision speed. Target: < 24 Hours.'],
    ['SLA Breached Tasks', 'Single Value KPI Card', 'COUNT(Tasks WHERE DueDate < Now)', 'Department, Priority', 'Highlights overdue tasks exceeding department response window.'],
    ['Monthly Team Approvals', 'Single Value KPI Card', 'COUNT(Tasks WHERE status="Approved")', 'Date Range', 'Total requests approved by manager in the current month.'],
    ['Workflow Status Pipeline', 'Horizontal Stacked Bar', 'COUNT(Tasks) BY Status', 'Form Type, Employee', 'Visual breakdown of pending, approved, and rejected team tasks.'],
    ['Recent Submissions Table', 'Data Grid Table', 'Top 10 Recent Tasks', 'Status Filter', 'Displays applicant name, submission date, attached docs, and action buttons (Approve/Reject).']
  ];
  formatSheet(ws1, headers1, rows1);

  // Sheet 2: Employee Analytics Brief
  const ws2 = wb.addWorksheet('Employee KPI & Visual Brief');
  const headers2 = ['Widget / Metric Name', 'Visual Type', 'Calculation Formula', 'Required Slicers / Filters', 'Analyst Guidance & Employee Action'];
  const rows2 = [
    ['My Pending Tasks', 'Single Value KPI Card', 'COUNT(UserTasks WHERE status="Pending")', 'Task Priority', 'Actionable tasks assigned specifically to employee for input.'],
    ['Submitted Requests', 'Single Value KPI Card', 'COUNT(MySubmissions)', 'Status (Under Review / Approved)', 'Tracks status of all submitted forms.'],
    ['Saved Drafts', 'Single Value KPI Card', 'COUNT(Drafts)', 'Form Category', 'Count of uncompleted saved form drafts.'],
    ['Completed Approvals', 'Single Value KPI Card', 'COUNT(MySubmissions WHERE status="Approved")', 'Date Range', 'Successfully approved employee requests.'],
    ['Available Forms Launchpad', 'Icon Grid Cards', 'Published Forms List', 'Category (HR, Finance, IT)', 'Quick launch buttons for employee to initiate new requests.'],
    ['Submission Timeline', 'Progress Stepper Tracker', 'Workflow Stage Node Index', 'Request ID', 'Visual 3-step timeline (Submitted → Manager Review → Final Approval).']
  ];
  formatSheet(ws2, headers2, rows2);

  // Sheet 3: Document Management (DMS) Specifications
  const ws3 = wb.addWorksheet('Document Storage (DMS) Specs');
  const headers3 = ['Component', 'Feature / View Name', 'Technical Spec', 'Access Scope', 'Description for Analyst'];
  const rows3 = [
    ['Folder Tree View', 'Department Folders', 'Bansal > General / HR / Finance', 'Manager & Employee', 'Hierarchical folder navigation tree displaying document directories.'],
    ['File Upload Action', '+ Upload Document', 'Native file picker POST /api/uploads', 'Manager & Employee', 'Triggers file upload and attaches document record to local & DMS storage.'],
    ['Files Table', 'Document List View', 'Columns: Name, Type, Size, UploadedBy, Date', 'Manager & Employee', 'Table downside listing all department files with quick action icons.'],
    ['Inline Preview', 'Document Viewer Modal', 'GET /api/dms/documents/:id/url', 'Manager & Employee', 'Inline viewer modal supporting images (PNG/JPG) and PDF previews.'],
    ['External DMS Portal', 'DMS Login Shortcut', 'Redirect to https://base-layer.systems', 'Manager & Employee', 'Direct portal link for BaseLayer Enterprise DMS single sign-on.']
  ];
  formatSheet(ws3, headers3, rows3);

  const filePath = path.join(baseDir, 'Manager_Employee_Analytics_Dashboard_Data.xlsx');
  await wb.xlsx.writeFile(filePath);
  console.log('Generated Manager_Employee_Analytics_Dashboard_Data.xlsx');
}

async function run() {
  await generateSuperAdminAnalyticsExcel();
  await generateOrgAdminAnalyticsExcel();
  await generateManagerEmployeeAnalyticsExcel();
  console.log('Analytics Brief Excel files generated successfully!');
}

run().catch(console.error);

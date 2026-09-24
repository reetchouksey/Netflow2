# NetFlow Project Directory & Architecture Map

This document provides a systematic overview of the entire NetFlow repository to make searching and navigating files fast and intuitive.

---

## 🗂️ High-Level Project Structure

```text
NetFlow-main (3)/
├── frontend/                     # React + Vite Client Application (Git-tracked)
│   ├── src/
│   │   ├── components/           # Reusable UI components & layouts
│   │   ├── pages/                # All application route views & dashboards
│   │   ├── lib/                  # State management & stores
│   │   └── utils/                # API client, Auth helpers, RBAC Permissions
│   ├── public/                   # Static assets, icons, screenshots
│   └── package.json
│
├── server/                       # Node.js + Express Backend API (Git-tracked)
│   ├── .env                      # Server environment variables & API keys
│   ├── routes/                   # API endpoint controllers
│   ├── models/                   # MongoDB Mongoose schemas
│   ├── middleware/               # Auth, Tenancy, RoleGuard, Quotas
│   ├── services/                 # S3, DMS, OCR, AI LLM integrations
│   ├── scripts/                  # Automated test suites & DB migrations
│   └── server.js                 # Main server entrypoint
│
├── NetFlow-main/                 # Working workspace copy & QA artifacts
│   ├── *.xlsx                    # QA test reports, role specs & analytics data
│   ├── frontend/                 # Workspace frontend mirror
│   └── server/                   # Workspace backend mirror
│
├── PROJECT_STRUCTURE.md          # Complete directory index (this file)
└── README.md                     # Project overview & running instructions
```

---

## 💻 Frontend Directory Guide (`frontend/src/`)

### 1. `pages/` (Application Views)
| Page Component | Route Path | Purpose / Shell |
| :--- | :--- | :--- |
| `Dashboard.jsx` | `/dashboard` | Main operational dashboard for tenant users |
| `PlatformOverview.jsx` | `/dashboard` (SuperAdmin) | Platform Super Admin overview with ARR & metrics |
| `PlatformPanel.jsx` | `/platform` | Organization / tenant management |
| `PlatformPlans.jsx` | `/plans` | Subscription tiers, pricing, and MRR tracking |
| `PlatformHealth.jsx` | `/health` | System and database health monitoring |
| `DocumentsDashboard.jsx` | `/documents` | DMS (Document Management System) file browser |
| `S3Storage.jsx` | `/s3-storage` | Amazon S3 dedicated cloud file explorer |
| `Workflows.jsx` | `/workflows` | Workflow designer, list, and lifecycle rules |
| `NewWorkflow.jsx` | `/workflows/new` | Multi-step interactive workflow builder |
| `Forms.jsx` | `/forms` | Form builder & response management |
| `NewForm.jsx` | `/forms/new` | Dynamic form schema editor |
| `FillForm.jsx` | `/forms/:id/fill` | Form submission view for employees & managers |
| `TaskInbox.jsx` | `/tasks` | Multi-role approval inbox and queue |
| `TaskDetail.jsx` | `/tasks/:id` | Detailed approval decision and timeline view |
| `AdminPanel.jsx` | `/admin` | Tenant user roster and team management |
| `Departments.jsx` | `/departments` | Organization department management |
| `RolesPermissions.jsx` | `/roles` | Custom roles and RBAC permission matrix |
| `OrgSettings.jsx` | `/settings` | Organization configuration & integrations |
| `Billing.jsx` | `/billing` | Tenant subscription & invoice management |
| `Analytics.jsx` | `/analytics` | Business intelligence & workflow analytics |
| `AuditLog.jsx` | `/audit-log` | Security audit trail and event logging |
| `SignaLandingPage.jsx` | `/` | Public marketing landing page & product showcase |
| `Login.jsx` | `/login` | User authentication & SSO sign-in |

### 2. `components/` (Core UI Components)
* `AppShell.jsx`: Primary application shell, top bar, sidebar navigation, and theme switches.
* `AssistantWidget.jsx`: AI Assistant interactive chat widget.
* `DmsProviderWidget.jsx`: DMS cloud status indicator widget.
* `FilePreviewPane.jsx`: In-app file viewer for PDFs, images, and documents.
* `FormFields.jsx`: Reusable form inputs and validation components.
* `ProductTour.jsx`: Guided product walkthrough for new users.
* `NetFlowLogo.jsx`: Vector brand logo component.

### 3. `utils/` & `lib/` (Helpers & State)
* `utils/api.js`: Unified API fetch wrapper, bearer JWT injector, base URL handler.
* `utils/permissions.js`: Role-based access control (RBAC) helpers (`isOrgAdmin`, `isSuperAdmin`, `getShell`).
* `utils/auth.js`: User token storage, session management, and auth context.
* `lib/workflowsStore.js`: Zustand store for active workflows and executions.
* `lib/formsStore.js`: Store for forms, draft schemas, and responses.
* `lib/tasksStore.js`: Store for approval queues and pending task counts.
* `lib/themeStore.js`: Dark / light mode state persistence.

---

## ⚙️ Backend Directory Guide (`server/`)

### 1. `routes/` (API Endpoints)
* `routes/auth.js`: `/api/auth` — Authentication, login, password reset, token verification.
* `routes/dms.js`: `/api/dms` — Document Management System APIs (Admin/SuperAdmin protected).
* `routes/s3.js`: `/api/s3` — Dedicated S3 Cloud storage APIs (Admin/SuperAdmin protected).
* `routes/platform.js`: `/api/platform` — SuperAdmin tenant management, metrics, and global plans.
* `routes/workflows.js`: `/api/workflows` — Workflow CRUD, execution triggers, state machine transitions.
* `routes/forms.js`: `/api/forms` — Form schema definitions, field builder, submission endpoints.
* `routes/tasks.js`: `/api/tasks` — Approval task lifecycle, decisions, DOA escalations.
* `routes/users.js`: `/api/users` — User management, inviting team members, password provisioning.
* `routes/organization.js`: `/api/org` — Tenant settings, integrations (S3/DMS config), logos.
* `routes/uploads.js`: `/api/uploads` — File storage, local disk uploads, presigned URLs.
* `routes/analytics.js`: `/api/analytics` — Aggregated approval times, SLAs, tenant metrics.

### 2. `models/` (Database Schemas)
* `User.js`: User accounts, hashed passwords, roles, tenant association.
* `Organization.js`: Tenant details, plan tier, S3/DMS integration configurations.
* `Workflow.js`: Workflow canvas graphs, trigger nodes, step actions.
* `Form.js`: Dynamic form schemas, fields, conditions, validation rules.
* `Task.js`: Approval requests, assigned approvers, decision audit history.
* `DmsDocument.js`: Persistent metadata records for DMS files.
* `S3File.js`: Stored metadata records for Amazon S3 objects.
* `AuditLog.js`: Timestamped immutable security and operational event logs.

### 3. `middleware/` (Security & Flow Controls)
* `auth.js`: `protect` — JWT bearer authentication and token revocation checks.
* `roleGuard.js`: `roleGuard` — Strict whitelist-based RBAC endpoint protection.
* `tenant.js`: Multi-tenant resolution via headers, tokens, or subdomains.
* `quota.js`: Storage and resource quota limits enforcement.

### 4. `services/` (External Integrations)
* `dmsClient.js`: Multi-department DMS connector with failover.
* `s3Client.js`: AWS S3 presigned URLs, streaming, bucket validation.
* `paddleOcrClient.js`: Local AI OCR service connector.
* `emailService.js`: Brevo SMTP transactional email delivery.

---

## 📊 Reports & Data Spreadsheets Index

Located in root and `NetFlow-main/`:
* `NetFlow_QA_Comprehensive_Test_Report.xlsx`: Complete QA test matrix and verification results.
* `SuperAdmin_Analytics_Dashboard_Data.xlsx`: SuperAdmin dashboard dataset specifications.
* `OrgAdmin_Analytics_Dashboard_Data.xlsx`: Org Admin metrics and analytics specification.
* `Manager_Employee_Analytics_Dashboard_Data.xlsx`: Manager and Employee workload specifications.
* `Business_Analyst_Dashboard_Data.xlsx`: Business analytical flow and requirements.
* `Full_Users_Dashboard_Data.xlsx`: Comprehensive user matrix and test data.

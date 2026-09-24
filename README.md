# NetFlow — Multi-Tenant Workflow Automation Platform

Enterprise workflow orchestration, document management, and intelligent approval routing platform.

---

## 📖 Project Documentation & Architecture
For a complete, systematic breakdown of all directories, frontend pages, backend routes, models, and QA reports:
👉 **[View Full Project Structure Map](PROJECT_STRUCTURE.md)**

---

## 🚀 Quick Start (Local Development)

### 1. Start the Backend API
```bash
cd server
npm install
npm run dev
```
* Backend runs on: `http://localhost:5000`
* Configuration file: [`server/.env`](server/.env)

### 2. Start the Frontend Client
```bash
cd frontend
npm install
npm run dev
```
* Frontend runs on: `http://localhost:5173`

---

## 🌐 Production Deployment Guide
* **Frontend (Vercel):**
  * Set `VITE_API_URL=https://netflow-s4de.onrender.com` in Vercel environment variables.
* **Backend (Render):**
  * Set `CLIENT_URL` in Render environment to include your Vercel URL (e.g. `https://your-app.vercel.app`).

---

## 🔒 Security & RBAC Roles
* **Platform SuperAdmin:** Global overview, ARR/MRR revenue analytics, tenant management, plans.
* **Organization Admin:** Form & workflow builder, user roster, departments, S3/DMS integrations.
* **Operations (Manager / VP / HR):** Approval task queue, decision audit, team requests.
* **Workspace (Employee):** Form submissions, request tracking, personal notifications.
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { themeStore, useTheme } from '../lib/themeStore'
import NetFlowLogo from '../components/NetFlowLogo'
import {
  ArrowRight,
  Check,
  Shield,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Globe,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ExternalLink,
  Lock,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Inbox,
  UserCheck,
  Zap,
  Bell,
  Sliders,
  Users,
  Building2,
  HelpCircle,
  FileCheck2,
  FileSpreadsheet,
  Workflow,
  KeyRound,
  Sun,
  Moon,
  Play,
  Pause,
  LayoutDashboard,
  FileSignature,
  FileCode2,
  CheckSquare,
  Search
} from 'lucide-react'

// ---------- Mini Interactive App Demo Screen Component ----------
function AppLiveDemoScreen() {
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [isPlaying, setIsPlaying] = useState(true)

  const screens = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: 'app.netflow.io/dashboard' },
    { id: 'workflow', label: 'Workflow Canvas', icon: Workflow, path: 'app.netflow.io/workflows/builder' },
    { id: 'forms', label: 'Form Intake', icon: FileText, path: 'app.netflow.io/forms/vendor-nda' },
    { id: 'approvals', label: 'Approvals & Audit', icon: CheckSquare, path: 'app.netflow.io/tasks/approval-queue' }
  ]

  // Auto-cycle through the demo screens
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setActiveScreen(curr => {
        const idx = screens.findIndex(s => s.id === curr)
        return screens[(idx + 1) % screens.length].id
      })
    }, 4500)
    return () => clearInterval(interval)
  }, [isPlaying, screens.length])

  const currentScreenMeta = screens.find(s => s.id === activeScreen) || screens[0]

  return (
    <div className="w-full bg-[#08182b] rounded-3xl p-3 sm:p-4 border border-blue-500/30 shadow-2xl shadow-blue-950/80 backdrop-blur-xl relative group">
      {/* Glow highlight */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-500 pointer-events-none" />

      {/* Browser / Laptop Top Bar Window Chrome */}
      <div className="relative bg-[#0c2340] rounded-2xl border border-blue-900/60 p-2.5 sm:p-3 mb-3 flex items-center justify-between gap-2">
        {/* Window Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-rose-500/90 shadow-2xs" />
          <span className="w-3 h-3 rounded-full bg-amber-500/90 shadow-2xs" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/90 shadow-2xs" />
        </div>

        {/* URL Pill */}
        <div className="flex-1 max-w-xs mx-auto bg-[#071526] px-3 py-1 rounded-xl border border-blue-800/40 text-[11px] font-mono text-blue-200/80 flex items-center justify-center gap-2 truncate">
          <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">{currentScreenMeta.path}</span>
        </div>

        {/* Live indicator / Pause toggle */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 text-[10px] font-bold border border-blue-800/50 transition cursor-pointer"
          title={isPlaying ? 'Pause Auto-cycle' : 'Play Auto-cycle'}
        >
          {isPlaying ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">LIVE</span>
              <Pause className="w-2.5 h-2.5 ml-0.5 text-blue-300" />
            </>
          ) : (
            <>
              <Play className="w-2.5 h-2.5 text-amber-400" />
              <span className="hidden sm:inline text-amber-300">PAUSED</span>
            </>
          )}
        </button>
      </div>

      {/* Interactive Navigation Tabs for Demo Screens */}
      <div className="relative flex items-center gap-1.5 p-1 bg-[#091b30] rounded-xl border border-blue-900/50 mb-3 overflow-x-auto no-scrollbar">
        {screens.map(s => {
          const Icon = s.icon
          const active = activeScreen === s.id
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveScreen(s.id)
                setIsPlaying(false)
              }}
              className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#134287] text-white shadow-md shadow-blue-900/50 border border-blue-400/40'
                  : 'text-blue-200/70 hover:text-white hover:bg-blue-950/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-blue-400'}`} />
              <span className="text-[11px]">{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* Live Application Screen Preview Area */}
      <div className="relative bg-[#0b1c33] rounded-2xl border border-blue-900/60 p-4 min-h-[300px] flex flex-col justify-between overflow-hidden">
        
        {/* SCREEN 1: DASHBOARD */}
        {activeScreen === 'dashboard' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between bg-[#0e2444] p-3 rounded-xl border border-blue-800/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#134287] text-white text-[10px] font-black flex items-center justify-center">
                  YA
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">Welcome back, Yash</div>
                  <div className="text-[9.5px] text-blue-300/80">Organization Overview · All Departments</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-[#134287] text-blue-100 border border-blue-400/40">
                Workflow Admin
              </span>
            </div>

            {/* KPI Stat Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-[#091b32] p-2.5 rounded-xl border border-blue-800/30">
                <div className="text-[9.5px] font-bold text-blue-300/80 uppercase">Submissions</div>
                <div className="text-base font-black text-white mt-0.5">3</div>
                <div className="w-full h-1 bg-blue-950 rounded-full mt-1.5 overflow-hidden">
                  <div className="w-3/4 h-full bg-blue-500 rounded-full" />
                </div>
              </div>
              <div className="bg-[#091b32] p-2.5 rounded-xl border border-blue-800/30">
                <div className="text-[9.5px] font-bold text-emerald-400 uppercase">Completed</div>
                <div className="text-base font-black text-white mt-0.5">3</div>
                <div className="w-full h-1 bg-blue-950 rounded-full mt-1.5 overflow-hidden">
                  <div className="w-full h-full bg-emerald-500 rounded-full" />
                </div>
              </div>
              <div className="bg-[#091b32] p-2.5 rounded-xl border border-blue-800/30">
                <div className="text-[9.5px] font-bold text-amber-400 uppercase">Active Flows</div>
                <div className="text-base font-black text-white mt-0.5">1</div>
                <div className="w-full h-1 bg-blue-950 rounded-full mt-1.5 overflow-hidden">
                  <div className="w-1/2 h-full bg-amber-500 rounded-full" />
                </div>
              </div>
              <div className="bg-[#091b32] p-2.5 rounded-xl border border-blue-800/30">
                <div className="text-[9.5px] font-bold text-blue-200 uppercase">Success Rate</div>
                <div className="text-base font-black text-emerald-400 mt-0.5">100%</div>
                <div className="w-full h-1 bg-blue-950 rounded-full mt-1.5 overflow-hidden">
                  <div className="w-full h-full bg-emerald-400 rounded-full" />
                </div>
              </div>
            </div>

            {/* Performance mini chart visual */}
            <div className="bg-[#091b32] p-3 rounded-xl border border-blue-800/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#134287]" />
                  Workflow Performance
                </span>
                <span className="text-emerald-400 text-[10px]">99.8% On-Time SLA</span>
              </div>
              <div className="flex items-end gap-1.5 h-12 pt-1">
                {[40, 65, 30, 85, 55, 95, 75, 100, 80, 90].map((val, i) => (
                  <div key={i} className="flex-1 bg-blue-950 rounded-t overflow-hidden h-full flex items-end">
                    <div
                      style={{ height: `${val}%` }}
                      className="w-full bg-gradient-to-t from-[#134287] to-blue-400 rounded-t transition-all duration-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2: WORKFLOW BUILDER CANVAS */}
        {activeScreen === 'workflow' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between bg-[#0e2444] px-3 py-2 rounded-xl border border-blue-800/40 text-xs font-bold text-white">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-blue-400" />
                <span>Vendor Onboarding & Payment Workflow</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-800">
                Active Route
              </span>
            </div>

            {/* Node flow diagram */}
            <div className="space-y-2 py-1">
              {/* Step 1 */}
              <div className="flex items-center gap-3 bg-[#091b32] p-2.5 rounded-xl border border-emerald-500/40">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                  ✓
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">1. Vendor Intake Form</div>
                  <div className="text-[10px] text-emerald-300/90 font-medium">Submitted by Acme Corp · Attachments verified</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 shrink-0">Completed</span>
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-3 bg-[#091b32] p-2.5 rounded-xl border border-blue-500/40">
                <div className="w-6 h-6 rounded-lg bg-[#134287] text-white text-xs font-black flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">2. Department Head Review</div>
                  <div className="text-[10px] text-blue-200/80 font-medium">Assigned to Operations Lead · SLA: 24 hrs</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 text-[9.5px] font-extrabold border border-blue-500/40 shrink-0">
                  In Review
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-3 bg-[#071526] p-2.5 rounded-xl border border-blue-900/40 opacity-70">
                <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 text-xs font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-300 truncate">3. Finance & Legal Sign-off</div>
                  <div className="text-[10px] text-slate-400 font-medium">Auto-trigger on Step 2 approval</div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 shrink-0">Queued</span>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3: FORM INTAKE STUDIO */}
        {activeScreen === 'forms' && (
          <div className="space-y-2.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between bg-[#0e2444] px-3 py-2 rounded-xl border border-blue-800/40 text-xs font-bold text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Smart Dynamic Request Form</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 text-[10px] border border-blue-800">
                Public Link Enabled
              </span>
            </div>

            <div className="bg-[#091b32] p-3 rounded-xl border border-blue-800/30 space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-200">Request Title</label>
                <div className="w-full bg-[#071526] px-2.5 py-1.5 rounded-lg border border-blue-900/60 text-xs text-white font-medium">
                  Cloud Infrastructure Upgrade — Q4 Budget
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-blue-200">Department</label>
                  <div className="w-full bg-[#071526] px-2.5 py-1.5 rounded-lg border border-blue-900/60 text-xs text-white font-medium">
                    Engineering & IT
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-blue-200">Estimated Capex</label>
                  <div className="w-full bg-[#071526] px-2.5 py-1.5 rounded-lg border border-blue-900/60 text-xs text-emerald-400 font-bold">
                    $14,500.00 USD
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#071526] border border-dashed border-blue-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-semibold text-white">Vendor_Proposal_v2.pdf</span>
                </div>
                <span className="text-[9.5px] font-bold text-emerald-400">Attached ✓</span>
              </div>

              <button className="w-full py-1.5 rounded-lg bg-[#134287] hover:bg-[#0f346c] text-white text-xs font-bold shadow-sm transition">
                Submit for Multi-Tier Approval →
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 4: APPROVALS & AUDIT LOG */}
        {activeScreen === 'approvals' && (
          <div className="space-y-2.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between bg-[#0e2444] px-3 py-2 rounded-xl border border-blue-800/40 text-xs font-bold text-white">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span>Executive Approval Queue</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 text-[10px] border border-amber-800">
                1 Action Required
              </span>
            </div>

            {/* Approval Item */}
            <div className="bg-[#091b32] p-3 rounded-xl border border-blue-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Annual Enterprise Server SLA Contract</div>
                  <div className="text-[10px] text-blue-300 font-medium">Submitted by Priya · Amount: $24,000</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-900/60 text-blue-200 border border-blue-500/30">
                  SLA: 3h Left
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs">
                  <span>Approve & Sign</span>
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-[#071526] hover:bg-rose-950/60 text-rose-300 text-xs font-bold border border-rose-900/40 transition">
                  Reject
                </button>
              </div>

              {/* Audit Proof Banner */}
              <div className="p-2 rounded-lg bg-[#071526] border border-blue-900/50 flex items-center justify-between text-[9.5px]">
                <span className="text-blue-300/80 font-mono">Immutable Hash: #4021-SHA256</span>
                <span className="text-emerald-400 font-bold">Anchored ✓</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer info strip inside preview */}
        <div className="mt-2 pt-2 border-t border-blue-900/40 flex items-center justify-between text-[10px] text-blue-300/80">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-blue-400" />
            <span>Encrypted with TLS 1.3 · SOC2 Compliant</span>
          </span>
          <span className="text-blue-400 font-bold hover:underline cursor-pointer">
            Interactive Preview
          </span>
        </div>
      </div>
    </div>
  )
}

export default function SignaLandingPage() {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState('workflows')
  const [openFaq, setOpenFaq] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const capabilities = [
    {
      id: 'workflows',
      label: 'Workflow Orchestration',
      icon: Workflow,
      title: 'Visual Workflow Engine & Multi-Tier Approvals',
      desc: 'Build sequential, parallel, and conditional approval paths with zero coding. Route requests automatically based on dollar values, department budgets, or executive thresholds.',
      highlights: [
        'Multi-stage approvals with conditional branching',
        'Automatic delegate routing when managers are on leave',
        'Visual step-by-step canvas with real-time stage tracking',
        'Parallel sign-off matrix across cross-functional teams'
      ],
      previewBadge: 'Workflow Engine',
      previewTitle: 'Capex Approval > $10,000',
      previewSteps: [
        { label: 'Form Submission', actor: 'Department Requester', status: 'Submitted', color: 'emerald' },
        { label: 'Manager Review', actor: 'Direct Manager', status: 'Approved', color: 'emerald' },
        { label: 'Finance & Legal SLA', actor: 'Finance Director', status: 'In Review', color: 'blue' },
        { label: 'Executive Sign-off', actor: 'CFO Office', status: 'Pending', color: 'slate' }
      ]
    },
    {
      id: 'forms',
      label: 'No-Code Form Studio',
      icon: FileText,
      title: 'Smart Intake Forms with Real-Time Validation',
      desc: 'Design beautiful, dynamic forms that adapt based on user inputs. Share securely with team members or distribute public links to external vendors and partners.',
      highlights: [
        'Drag-and-drop input fields, file uploads, and currency formats',
        'Dynamic conditional logic that reveals fields based on previous answers',
        'Public form links for external customer/vendor onboarding',
        'Automated responses spreadsheet export & CSV downloads'
      ],
      previewBadge: 'Form Studio',
      previewTitle: 'Vendor Onboarding & NDA Request',
      previewSteps: [
        { label: 'Vendor Details', actor: 'Entity & Tax ID', status: 'Validated', color: 'emerald' },
        { label: 'NDA Document', actor: 'Signed PDF Attachment', status: 'Uploaded', color: 'emerald' },
        { label: 'Security Review', actor: 'IT Compliance Check', status: 'Active', color: 'blue' },
        { label: 'Contract Execution', actor: 'Procurement Dispatch', status: 'Queued', color: 'slate' }
      ]
    },
    {
      id: 'sla',
      label: 'SLA & Escalations',
      icon: Zap,
      title: 'Automated Deadlines & Escalation Triggers',
      desc: 'Never let critical requests sit unattended. Set strict turn-around SLAs per approval step with automated notification nudges, overdue warnings, and auto-escalations.',
      highlights: [
        'Configurable SLA targets in hours or days per workflow stage',
        'Automated email and in-app reminder notifications',
        'Escalation triggers that reassign tasks when deadlines are breached',
        'Real-time SLA health dashboard with department bottleneck analysis'
      ],
      previewBadge: 'SLA Engine',
      previewTitle: 'Emergency Server Access SLA',
      previewSteps: [
        { label: 'Access Requested', actor: 'DevOps Engineer', status: '00:00 (Logged)', color: 'emerald' },
        { label: 'Security Lead Nudge', actor: 'Slack & Email Triggered', status: '00:15 (Sent)', color: 'emerald' },
        { label: 'SLA Warning Stage', actor: 'Automated Escalation', status: '01:30 (Breached)', color: 'amber' },
        { label: 'Re-routed to VP Eng', actor: 'Executive Fast-Track', status: 'Active SLA', color: 'blue' }
      ]
    },
    {
      id: 'governance',
      label: 'Audit & Governance',
      icon: Shield,
      title: 'Immutable Cryptographic Audit Trails',
      desc: 'Achieve effortless audit readiness. Every submission, comment, approval signature, delegation, and status change is logged immutably with timestamped proofs.',
      highlights: [
        'Complete chronological audit history with IP and user metadata',
        'Tamper-evident verification logs ready for compliance audits',
        'Role-based access control (RBAC) with granular permission sets',
        'Enterprise data isolation across organizations and departments'
      ],
      previewBadge: 'Audit Ledger',
      previewTitle: 'SOC2 Compliance Trail',
      previewSteps: [
        { label: 'Payload Signed', actor: 'AES-256 Verified', status: 'Immutable', color: 'emerald' },
        { label: 'Identity Auth', actor: 'Microsoft Entra SSO', status: 'Verified', color: 'emerald' },
        { label: 'Timestamp Lock', actor: 'SHA-256 Ledger Entry', status: 'Anchored', color: 'emerald' },
        { label: 'Compliance Export', actor: 'One-Click Audit PDF', status: 'Ready', color: 'blue' }
      ]
    }
  ]

  const activeCapability = capabilities.find(c => c.id === activeTab) || capabilities[0]

  const faqs = [
    {
      q: 'How does NetFlow handle multi-stage approvals across different departments?',
      a: 'NetFlow allows you to define sequential, parallel, or conditional approval steps. When a form is submitted, requests automatically route to designated department managers, finance heads, or executives based on rules you define.'
    },
    {
      q: 'Can external vendors or clients submit forms without having an account?',
      a: 'Yes! NetFlow supports Public Forms with shareable secure links. External respondents can fill out forms and attach documents without requiring a user seat, while submissions feed directly into your private approval pipeline.'
    },
    {
      q: 'How do SLAs and automated escalations prevent approval bottlenecks?',
      a: 'Each stage in a workflow can have a target completion SLA (e.g., 24 hours). If an approver does not respond within the timeframe, NetFlow triggers automated email reminders and can automatically escalate or reassign the request to a deputy.'
    },
    {
      q: 'Does NetFlow support Single Sign-On (SSO) and enterprise security?',
      a: 'Yes. NetFlow includes Microsoft Entra ID (Azure AD) SSO, multi-factor authentication (MFA/TOTP), granular role-based permissions (RBAC), and immutable audit logs with timestamped signature tracking.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#071526] text-white font-sans selection:bg-blue-900 selection:text-white overflow-x-hidden">
      
      {/* ── HEADER / TOP BAR (Dark Blue Theme Matching Login) ── */}
      <header className="sticky top-0 z-50 bg-[#0c2340]/95 backdrop-blur-md border-b border-blue-900/60 shadow-lg shadow-blue-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* NetFlow Brand Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition group cursor-pointer shrink-0">
            <NetFlowLogo size={38} className="w-[38px] h-[38px] shrink-0" />
            <span className="text-2xl font-black tracking-tight text-white">
              NetFlow
            </span>
          </Link>

          {/* Central Enterprise Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            <a
              href="#workflows"
              onClick={() => setActiveTab('workflows')}
              className="text-xs lg:text-[13.5px] font-bold text-blue-100 hover:text-white hover:underline transition-colors"
            >
              Workflows
            </a>
            <a
              href="#forms"
              onClick={() => setActiveTab('forms')}
              className="text-xs lg:text-[13.5px] font-bold text-blue-100 hover:text-white hover:underline transition-colors"
            >
              Forms
            </a>
            <a
              href="#sla"
              onClick={() => setActiveTab('sla')}
              className="text-xs lg:text-[13.5px] font-bold text-blue-100 hover:text-white hover:underline transition-colors"
            >
              SLA & Approvals
            </a>
            <a
              href="#compliance"
              onClick={() => setActiveTab('governance')}
              className="text-xs lg:text-[13.5px] font-bold text-blue-100 hover:text-white hover:underline transition-colors"
            >
              Audit & Compliance
            </a>
            <a
              href="#faq"
              className="text-xs lg:text-[13.5px] font-bold text-blue-100 hover:text-white hover:underline transition-colors"
            >
              FAQ
            </a>
          </nav>

          {/* Right Action: Theme Toggle & Login Option */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => themeStore.toggle()}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-2xl bg-[#102c52] hover:bg-[#163b6d] text-blue-200 hover:text-white flex items-center justify-center transition-all border border-blue-700/40 shadow-xs cursor-pointer"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in-75 duration-200" />
              ) : (
                <Moon className="w-4 h-4 text-blue-200 animate-in fade-in zoom-in-75 duration-200" />
              )}
            </button>

            {/* Login Button in Dark Blue Theme */}
            <Link
              to="/login"
              className="px-6 py-2.5 rounded-2xl bg-[#134287] hover:bg-[#0f346c] active:bg-[#0c2340] text-white font-bold text-xs shadow-md shadow-blue-950/50 border border-blue-400/40 transition-all hover:scale-[1.02] flex items-center gap-2"
            >
              <span>Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-blue-200 hover:bg-blue-900/60"
              aria-label="Toggle navigation menu"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`h-0.5 w-full bg-current rounded-full transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`h-0.5 w-full bg-current rounded-full transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`h-0.5 w-full bg-current rounded-full transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0c2340] border-b border-blue-900/60 px-6 py-4 space-y-3">
            <a
              href="#workflows"
              onClick={() => { setActiveTab('workflows'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-blue-100 hover:text-white"
            >
              Workflows
            </a>
            <a
              href="#forms"
              onClick={() => { setActiveTab('forms'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-blue-100 hover:text-white"
            >
              Forms
            </a>
            <a
              href="#sla"
              onClick={() => { setActiveTab('sla'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-blue-100 hover:text-white"
            >
              SLA & Approvals
            </a>
            <a
              href="#compliance"
              onClick={() => { setActiveTab('governance'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-blue-100 hover:text-white"
            >
              Audit & Compliance
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-bold text-blue-100 hover:text-white"
            >
              FAQ
            </a>
          </div>
        )}
      </header>

      {/* ── HERO SECTION (Dark Blue Gradient Matching Login Page) ── */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#0c2340] via-[#0f2d57] to-[#071526]">
        
        {/* Subtle Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[380px] bg-blue-500/15 blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 right-1/4 translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-indigo-500/15 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#102d54] border border-blue-400/40 text-blue-200 text-xs font-extrabold tracking-wide shadow-md">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span>ENTERPRISE WORKFLOW AUTOMATION</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight leading-[1.12] text-white">
                Every document, workflow, and approval — <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-200 to-indigo-200">in one place</span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-blue-100/90 leading-relaxed max-w-xl font-medium">
                NetFlow is an enterprise workflow orchestration and document governance platform that eliminates manual approval chains and operational bottlenecks. Design, route, approve, and audit every process seamlessly.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  to="/login"
                  className="px-7 py-3.5 rounded-2xl bg-[#134287] hover:bg-[#0f346c] active:bg-[#0c2340] text-white font-bold text-sm shadow-xl shadow-blue-950/60 border border-blue-400/40 transition-all hover:scale-[1.02] flex items-center gap-2"
                >
                  <span>Get started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3.5 rounded-2xl border border-blue-700/60 bg-[#102a4e]/80 hover:bg-[#163a69] text-white font-bold text-sm shadow-md transition"
                >
                  Sign in to workspace
                </Link>
              </div>

              {/* Trust Badges Strip */}
              <div className="pt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-blue-200/80">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>SOC 2 Type II Certified</span>
                </div>
                <span className="text-blue-700">•</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Microsoft Entra SSO</span>
                </div>
                <span className="text-blue-700">•</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Immutable Audit Ledger</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Application Screen Mockup */}
            <div className="lg:col-span-6 relative">
              <AppLiveDemoScreen />
            </div>

          </div>
        </div>
      </section>

      {/* ── ENTERPRISE PERFORMANCE KPI STATS STRIP ── */}
      <section className="py-12 bg-[#0a1e36] border-y border-blue-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center divide-y lg:divide-y-0 lg:divide-x divide-blue-900/60">
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                85%
              </div>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mt-1">
                Faster Turnaround
              </div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-blue-300 tracking-tight">
                &lt; 15 min
              </div>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mt-1">
                Median Approval Time
              </div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                99.98%
              </div>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mt-1">
                Uptime SLA
              </div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                100%
              </div>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mt-1">
                Audit Trail Coverage
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SHIFTED SECTION: REAL-TIME OPERATIONAL SIGNALS & KPI SHOWCASE ── */}
      <section className="py-20 bg-[#071526] border-b border-blue-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#102d54] border border-blue-500/40 text-blue-200 text-[11px] font-extrabold tracking-wide uppercase mb-3">
              Real-Time Governance Modules
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              Live Visibility Across Every Department
            </h2>
            <p className="text-blue-100/80 text-base sm:text-lg font-medium">
              Every request, signature, review queue, and analytics metric monitored with zero guesswork.
            </p>
          </div>

          {/* Clean Modern 5-Card Operational Grid (Shifted from Hero) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Audit Log */}
            <div className="bg-[#0b1f38] rounded-3xl p-6 border border-blue-800/50 shadow-xl shadow-blue-950/50 hover:border-blue-500/50 transition-all duration-300 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base font-extrabold text-white block">Audit Log & Ledger</span>
                  <span className="text-[11px] text-blue-300 font-medium">Cryptographic Proofs</span>
                </div>
              </div>
              <div className="space-y-2.5 text-xs font-bold pt-1">
                <div className="flex items-center gap-2 text-emerald-400 bg-[#071526] p-2 rounded-xl border border-emerald-900/40">
                  <span className="text-base font-black">✓</span>
                  <span>Invoice approved · Priya (Finance Lead)</span>
                </div>
                <div className="flex items-center gap-2 text-blue-300 bg-[#071526] p-2 rounded-xl border border-blue-900/40">
                  <span className="text-base font-black">✓</span>
                  <span>Hash verified · chain #4021-SHA256</span>
                </div>
                <div className="text-[11px] font-semibold text-blue-300/70 pt-1">
                  Immutable retention policy automatically applied
                </div>
              </div>
            </div>

            {/* Card 2: Approvals */}
            <div className="bg-[#0b1f38] rounded-3xl p-6 border border-blue-800/50 shadow-xl shadow-blue-950/50 hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-base font-extrabold text-white block">Multi-Tier Approvals</span>
                      <span className="text-[11px] text-blue-300 font-medium">Stage Sign-offs</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                    Approved
                  </span>
                </div>
                <p className="text-xs text-blue-100/80 mt-3 font-medium">
                  Sequential and parallel approval chains with automated threshold escalation.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-blue-900/40">
                <div className="flex -space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#134287] text-white text-xs font-black flex items-center justify-center border-2 border-[#0b1f38] shadow-xs">P</div>
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center border-2 border-[#0b1f38] shadow-xs">A</div>
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center border-2 border-[#0b1f38] shadow-xs">S</div>
                </div>
                <span className="text-xs font-bold text-blue-200 ml-2">3 executive signers verified</span>
              </div>
            </div>

            {/* Card 3: Notifications & Review Queue */}
            <div className="bg-[#0b1f38] rounded-3xl p-6 border border-blue-800/50 shadow-xl shadow-blue-950/50 hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-base font-extrabold text-white block">SLA & Notifications</span>
                    <span className="text-[11px] text-blue-300 font-medium">Automated Alerts</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-black text-amber-300 bg-[#071526] p-3 rounded-xl border border-amber-900/40 mt-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span>Review queue · 2 SLA alerts active</span>
                </div>
              </div>
              <p className="text-xs text-blue-200/70 font-medium">
                Instant email, in-app notifications and delegate fallback.
              </p>
            </div>

            {/* Card 4: Analytics Chart */}
            <div className="bg-[#0b1f38] rounded-3xl p-6 border border-blue-800/50 shadow-xl shadow-blue-950/50 hover:border-blue-500/50 transition-all duration-300 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-base font-extrabold text-white block">Performance Analytics</span>
                    <span className="text-[11px] text-blue-300 font-medium">Weekly Throughput Breakdown</span>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60">
                  +14.2% Growth
                </span>
              </div>
              {/* Blue Bar Chart Visual */}
              <div className="flex items-end gap-3 h-20 pt-2">
                {[35, 65, 45, 80, 55, 90, 70, 100, 85, 95].map((val, idx) => (
                  <div key={idx} className="flex-1 bg-[#071526] rounded-t-lg h-full flex items-end overflow-hidden">
                    <div
                      style={{ height: `${val}%` }}
                      className="w-full bg-gradient-to-t from-[#134287] via-blue-500 to-blue-300 rounded-t-md transition-all duration-300"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold text-blue-300/80 pt-1">
                3,420 total workflow executions processed this billing cycle across all departments.
              </p>
            </div>

            {/* Card 5: Workflow & Document Capture Card */}
            <div className="bg-[#0b1f38] rounded-3xl p-6 border border-blue-800/50 shadow-xl shadow-blue-950/50 hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base font-extrabold text-white block">Intake Channels</span>
                  <span className="text-[11px] text-blue-300 font-medium">Forms · API · Webhooks</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#071526] border border-blue-900/50 space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>Active Integrations</span>
                  <span className="text-emerald-400 font-mono">6 Connected</span>
                </div>
                <div className="text-[11px] text-blue-300/80">
                  Direct ingestion via S3, Webhooks, Form Studio, & REST APIs
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── INTERACTIVE ENTERPRISE PLATFORM SHOWCASE (TABBED VIEW) ── */}
      <section id="workflows" className="py-20 lg:py-28 bg-[#0a1e36] border-b border-blue-900/60 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#102d54] border border-blue-500/40 text-blue-200 text-[11px] font-extrabold tracking-wide uppercase mb-3">
              Comprehensive Platform Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              Everything your enterprise needs to automate governance
            </h2>
            <p className="text-blue-100/80 text-base sm:text-lg font-medium">
              Explore how NetFlow coordinates forms, workflows, SLAs, and cryptographic logs in real-time.
            </p>
          </div>

          {/* Tab Selector Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10 max-w-4xl mx-auto">
            {capabilities.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#134287] text-white shadow-lg shadow-blue-950/80 border border-blue-400/50 scale-[1.02]'
                      : 'bg-[#0b1f38] border border-blue-900/60 text-blue-200 hover:bg-[#102c52] hover:text-white shadow-xs'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Active Tab Card Preview Display */}
          <div className="bg-[#0b1f38] rounded-3xl p-8 sm:p-10 border border-blue-800/50 shadow-2xl shadow-blue-950/70">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              
              {/* Tab Left Info */}
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#102d54] text-blue-200 text-xs font-bold border border-blue-700/50">
                  {activeCapability.label}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {activeCapability.title}
                </h3>
                <p className="text-blue-100/90 text-sm sm:text-base leading-relaxed font-medium">
                  {activeCapability.desc}
                </p>

                <div className="space-y-3 pt-2">
                  {activeCapability.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-blue-100">
                      <div className="w-5 h-5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center justify-center font-bold text-xs shrink-0">
                        ✓
                      </div>
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-xs font-bold text-blue-300 hover:text-white hover:underline"
                  >
                    <span>Launch in your workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Tab Right Interactive Mockup Visual */}
              <div className="lg:col-span-6">
                <div className="bg-[#071526] rounded-3xl p-6 border border-blue-900/60 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-blue-900/60">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="text-xs font-bold text-white">{activeCapability.previewTitle}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#134287] text-blue-100 text-[10px] font-extrabold border border-blue-400/40">
                      {activeCapability.previewBadge}
                    </span>
                  </div>

                  {/* Step pipeline progression */}
                  <div className="space-y-3">
                    {activeCapability.previewSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0b1f38] rounded-2xl p-4 border border-blue-800/40 shadow-xs flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-xl bg-[#134287] text-white font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{step.label}</div>
                            <div className="text-[11px] text-blue-300/80 font-medium">{step.actor}</div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                            step.color === 'emerald'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                              : step.color === 'blue'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-700/60'
                              : step.color === 'amber'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                              : 'bg-slate-900 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-center">
                    <span className="text-[11px] font-semibold text-blue-300/70">
                      Live orchestration stream active · Encrypted TLS 1.3
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 6-PILLAR ENTERPRISE CAPABILITIES BENTO GRID ── */}
      <section id="forms" className="py-20 lg:py-28 bg-[#071526] border-b border-blue-900/60 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
              Enterprise-grade from the ground up
            </h2>
            <p className="text-blue-100/80 text-base sm:text-lg font-medium">
              Architected to scale across high-volume departments with zero compromises on security or velocity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Bento Card 1 */}
            <div className="bg-[#0b1f38] hover:bg-[#102d54] rounded-3xl p-7 border border-blue-800/50 shadow-xl shadow-blue-950/50 transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold shadow-xs">
                <Workflow className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Multi-Tier Approval Chains</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed font-medium">
                Create hierarchical approval matrices with automatic threshold checks and delegate backups during leaves.
              </p>
            </div>

            {/* Bento Card 2 */}
            <div className="bg-[#0b1f38] hover:bg-[#102d54] rounded-3xl p-7 border border-blue-800/50 shadow-xl shadow-blue-950/50 transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold shadow-xs">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Dynamic Intake Forms</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed font-medium">
                Drag-and-drop form builder with calculated fields, file attachments, and public vendor submission links.
              </p>
            </div>

            {/* Bento Card 3 */}
            <div className="bg-[#0b1f38] hover:bg-[#102d54] rounded-3xl p-7 border border-blue-800/50 shadow-xl shadow-blue-950/50 transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold shadow-xs">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">SLA Escalation Engine</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed font-medium">
                Prevent bottlenecks with automated reminder notifications, overdue alerts, and emergency auto-reassignment.
              </p>
            </div>

            {/* Bento Card 4 */}
            <div className="bg-[#0b1f38] hover:bg-[#102d54] rounded-3xl p-7 border border-blue-800/50 shadow-xl shadow-blue-950/50 transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold shadow-xs">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Cryptographic Audit Trail</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed font-medium">
                Every action, decision, comment, and document version is permanently logged with tamper-evident audit proofs.
              </p>
            </div>

            {/* Bento Card 5 */}
            <div className="bg-[#0b1f38] hover:bg-[#102d54] rounded-3xl p-7 border border-blue-800/50 shadow-xl shadow-blue-950/50 transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold shadow-xs">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Enterprise SSO & RBAC</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed font-medium">
                Seamless Microsoft Entra ID SSO, MFA authenticator support, and granular department-level permission boundaries.
              </p>
            </div>

            {/* Bento Card 6 */}
            <div className="bg-[#0b1f38] hover:bg-[#102d54] rounded-3xl p-7 border border-blue-800/50 shadow-xl shadow-blue-950/50 transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#134287] text-white flex items-center justify-center font-bold shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Live Analytics & Exports</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed font-medium">
                Real-time operational dashboards, approval cycle duration metrics, and automated one-click CSV/Excel exports.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECURITY & COMPLIANCE BADGES SECTION ── */}
      <section id="compliance" className="py-14 bg-[#0a1e36] border-y border-blue-900/60 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-5 rounded-2xl bg-[#0b1f38] border border-blue-800/40 shadow-sm space-y-1.5">
              <div className="text-sm font-extrabold text-white">SOC 2 Type II</div>
              <div className="text-xs text-blue-300 font-medium">Certified compliance standards</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#0b1f38] border border-blue-800/40 shadow-sm space-y-1.5">
              <div className="text-sm font-extrabold text-white">AES-256 Encryption</div>
              <div className="text-xs text-blue-300 font-medium">In-transit & at-rest security</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#0b1f38] border border-blue-800/40 shadow-sm space-y-1.5">
              <div className="text-sm font-extrabold text-white">GDPR & CCPA</div>
              <div className="text-xs text-blue-300 font-medium">Data privacy governance</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#0b1f38] border border-blue-800/40 shadow-sm space-y-1.5">
              <div className="text-sm font-extrabold text-white">Multi-Tenant Isolation</div>
              <div className="text-xs text-blue-300 font-medium">Dedicated tenancy models</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FREQUENTLY ASKED QUESTIONS (ENTERPRISE ACCORDION) ── */}
      <section id="faq" className="py-20 lg:py-28 bg-[#071526] scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#102d54] border border-blue-500/40 text-blue-200 text-[11px] font-extrabold tracking-wide uppercase mb-3">
              Got Questions?
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-blue-900/60 bg-[#0b1f38] overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 font-bold text-white text-sm sm:text-base cursor-pointer hover:bg-[#102d54] transition"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-blue-300 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-blue-100/90 leading-relaxed font-medium bg-[#08182b] border-t border-blue-900/50">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* ── BOTTOM CALL TO ACTION BANNER (Dark Blue Gradient) ── */}
      <section className="py-20 bg-gradient-to-br from-[#0c2340] via-[#103668] to-[#134287] border-t border-blue-900/60 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-bold uppercase tracking-wider border border-white/10">
            Ready to accelerate operations?
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            Streamline your organization's workflows today
          </h2>
          <p className="text-blue-100 text-base sm:text-lg max-w-xl mx-auto font-medium leading-relaxed">
            Join modern enterprises eliminating manual email chains and approval delays with NetFlow.
          </p>
          <div className="pt-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-[#0c2340] hover:bg-blue-50 active:bg-blue-100 font-extrabold text-sm shadow-2xl transition-all hover:scale-[1.03]"
            >
              <span>Access NetFlow Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROFESSIONAL MULTI-COLUMN ENTERPRISE DARK FOOTER ── */}
      <footer className="pt-16 pb-12 bg-[#050e1a] text-blue-200/70 text-xs font-medium border-t border-blue-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Footer Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-blue-900/50">
            
            {/* Column 1: Brand & Mission (Spans 2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition group cursor-pointer inline-flex">
                <NetFlowLogo size={36} className="w-9 h-9 shrink-0" />
                <span className="text-xl font-black tracking-tight text-white">
                  NetFlow
                </span>
              </Link>
              
              <p className="text-xs text-blue-200/80 leading-relaxed font-medium max-w-sm">
                Enterprise workflow orchestration, automated multi-tier approval routing, and cryptographic compliance governance. Built for high-velocity organizations.
              </p>

              {/* Status Indicator */}
              <div className="pt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11.5px] font-bold text-blue-200">
                  All Systems Operational · 99.98% SLA
                </span>
              </div>
            </div>

            {/* Column 2: Platform */}
            <div className="space-y-3.5">
              <div className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                Platform
              </div>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <a href="#workflows" className="hover:text-white transition-colors">
                    Workflow Engine
                  </a>
                </li>
                <li>
                  <a href="#forms" className="hover:text-white transition-colors">
                    Smart Form Studio
                  </a>
                </li>
                <li>
                  <a href="#sla" className="hover:text-white transition-colors">
                    SLA & Escalations
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-white transition-colors">
                    Audit Ledger
                  </a>
                </li>
                <li>
                  <a href="#forms" className="hover:text-white transition-colors">
                    Public Intake Links
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Security & Governance */}
            <div className="space-y-3.5">
              <div className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                Governance
              </div>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <a href="#compliance" className="hover:text-white transition-colors">
                    SOC 2 Type II
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-white transition-colors">
                    Microsoft Entra SSO
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-white transition-colors">
                    Role-Based Access (RBAC)
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-white transition-colors">
                    256-Bit Data Encryption
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-white transition-colors">
                    Multi-Tenant Isolation
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Access & Support */}
            <div className="space-y-3.5">
              <div className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                Workspace
              </div>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors flex items-center gap-1">
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    Frequently Asked Questions
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Enterprise Portal
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Administrator Console
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    System Analytics
                  </Link>
                </li>
              </ul>
            </div>

          </div>

          {/* Sub-Footer Row */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-blue-300/70 font-semibold">
            <p>© {new Date().getFullYear()} NetFlow Inc. All rights reserved. Enterprise Workflow & Governance Platform.</p>
            <div className="flex flex-wrap items-center gap-4 text-blue-300/80">
              <span>SOC 2 Type II Certified</span>
              <span>•</span>
              <span>GDPR Compliant</span>
              <span>•</span>
              <span>TLS 1.3 Encryption</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  )
}

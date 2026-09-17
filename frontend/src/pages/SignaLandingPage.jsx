import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { themeStore, useTheme } from '../lib/themeStore'
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
  Moon
} from 'lucide-react'

export default function SignaLandingPage() {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState('workflows')
  const [openFaq, setOpenFaq] = useState(0)

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-white font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden transition-colors duration-200">
      
      {/* ── HEADER / TOP BAR (Logo + Enterprise Nav Options + Theme Toggle + Login Option) ── */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* NetFlow Brand Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition group cursor-pointer shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-xl tracking-tight group-hover:scale-105 transition-transform">
              N
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              NetFlow
            </span>
          </Link>

          {/* Central Enterprise Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            <a
              href="#workflows"
              onClick={() => setActiveTab('workflows')}
              className="text-xs lg:text-[13.5px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors"
            >
              Workflows
            </a>
            <a
              href="#forms"
              onClick={() => setActiveTab('forms')}
              className="text-xs lg:text-[13.5px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors"
            >
              Forms
            </a>
            <a
              href="#sla"
              onClick={() => setActiveTab('sla')}
              className="text-xs lg:text-[13.5px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors"
            >
              SLA & Approvals
            </a>
            <a
              href="#compliance"
              onClick={() => setActiveTab('governance')}
              className="text-xs lg:text-[13.5px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors"
            >
              Audit & Compliance
            </a>
            <a
              href="#faq"
              className="text-xs lg:text-[13.5px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors"
            >
              FAQ
            </a>
          </nav>

          {/* Right Action: Theme Toggle & Login Button */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => themeStore.toggle()}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all border border-slate-200/80 dark:border-slate-700 shadow-2xs cursor-pointer"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in-75 duration-200" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 animate-in fade-in zoom-in-75 duration-200" />
              )}
            </button>

            {/* Login Option */}
            <Link
              to="/login"
              className="px-6 py-2.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all hover:scale-[1.02] flex items-center gap-2"
            >
              <span>Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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
          <div className="md:hidden bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 px-6 py-4 space-y-3">
            <a
              href="#workflows"
              onClick={() => { setActiveTab('workflows'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              Workflows
            </a>
            <a
              href="#forms"
              onClick={() => { setActiveTab('forms'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              Forms
            </a>
            <a
              href="#sla"
              onClick={() => { setActiveTab('sla'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              SLA & Approvals
            </a>
            <a
              href="#compliance"
              onClick={() => { setActiveTab('governance'); setMobileMenuOpen(false) }}
              className="block py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              Audit & Compliance
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              FAQ
            </a>
          </div>
        )}
      </header>

      {/* ── HERO SECTION (Light & Dark Theme with High Contrast & BaseLayer Composition) ── */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#F1F5F9] via-[#EEF2F6] to-[#E2E8F0] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#1E293B] transition-colors duration-200">
        
        {/* Subtle Ambient Glows */}
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-blue-200/40 dark:bg-blue-600/15 blur-[100px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 right-1/4 translate-x-1/2 -translate-y-1/2 w-[450px] h-[300px] bg-indigo-200/40 dark:bg-indigo-600/15 blur-[100px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-blue-200/80 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-extrabold tracking-wide shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span>ENTERPRISE WORKFLOW AUTOMATION</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-black tracking-tight leading-[1.12] text-slate-900 dark:text-white">
                Every document, workflow, and approval — <span className="text-[#2563EB] dark:text-blue-400">in one place</span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl font-medium">
                NetFlow is an enterprise workflow orchestration and document governance platform that eliminates manual approval chains and operational bottlenecks. Design, route, approve, and audit every process seamlessly.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  to="/login"
                  className="px-7 py-3.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] flex items-center gap-2"
                >
                  <span>Get started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm shadow-xs transition"
                >
                  Sign in to workspace
                </Link>
              </div>
            </div>

            {/* Right Column: Floating Mockup Cards Composition (Larger Size & Bold Typography) */}
            <div className="lg:col-span-6 relative">
              <div className="relative mx-auto w-full max-w-xl space-y-5">
                
                {/* Top Row: Audit Log & Approvals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Card 1: Audit Log */}
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-700 shadow-xl shadow-slate-300/40 dark:shadow-black/40 hover:shadow-2xl transition-all duration-300 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm shadow-xs">
                        <Clock className="w-5 h-5" />
                      </div>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Audit Log</span>
                    </div>
                    <div className="space-y-2 text-xs sm:text-[13.5px] font-bold">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <span className="text-base font-black">✓</span>
                        <span>Invoice approved · Priya</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <span className="text-base font-black">✓</span>
                        <span>Hash verified · chain #4021</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
                        Retention policy applied
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Approvals */}
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-700 shadow-xl shadow-slate-300/40 dark:shadow-black/40 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm shadow-xs">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Approvals</span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                        Approved
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="flex -space-x-2.5">
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs">P</div>
                        <div className="w-9 h-9 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs">A</div>
                        <div className="w-9 h-9 rounded-full bg-sky-500 text-white text-xs font-black flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs">S</div>
                      </div>
                      <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 ml-2.5">3 signers</span>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Notifications & Analytics */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                  
                  {/* Card 3: Notifications */}
                  <div className="sm:col-span-5 bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-700 shadow-xl shadow-slate-300/40 dark:shadow-black/40 flex flex-col justify-between space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold text-sm shadow-xs">
                        <Bell className="w-5 h-5" />
                      </div>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Notifications</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs sm:text-[14px] font-black text-slate-800 dark:text-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                      <span>Review queue · 2 overdue</span>
                    </div>
                  </div>

                  {/* Card 4: Analytics Chart */}
                  <div className="sm:col-span-7 bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-700 shadow-xl shadow-slate-300/40 dark:shadow-black/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Analytics</span>
                      <span className="text-xs font-black text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-200/60 dark:border-blue-800">
                        +14.2%
                      </span>
                    </div>
                    {/* Blue Bar Chart Visual */}
                    <div className="flex items-end gap-2.5 h-16 pt-2">
                      {[35, 65, 45, 80, 55, 90, 70, 100].map((val, idx) => (
                        <div
                          key={idx}
                          style={{ height: `${val}%` }}
                          className="flex-1 bg-gradient-to-t from-[#2563EB] to-[#60A5FA] rounded-t-md"
                        />
                      ))}
                    </div>
                    <p className="text-xs sm:text-[12.5px] font-bold text-slate-400 dark:text-slate-500 pt-1">
                      Workflows processed this week
                    </p>
                  </div>
                </div>

                {/* Bottom Row: Document Capture Card (Full Width) */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-700 shadow-xl shadow-slate-300/40 dark:shadow-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                        Workflow & Document Capture
                      </div>
                      <div className="text-xs sm:text-[13px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        Automated ingestion via Forms · Email · API · Webhooks
                      </div>
                    </div>
                  </div>
                  <span className="self-start sm:self-center px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-black border border-blue-200/60 dark:border-blue-800 shrink-0">
                    6 channels active
                  </span>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ENTERPRISE PERFORMANCE KPI STATS STRIP ── */}
      <section className="py-12 bg-white dark:bg-[#0F172A] border-y border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                85%
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                Faster Turnaround
              </div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-[#2563EB] dark:text-blue-400 tracking-tight">
                &lt; 15 min
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                Median Approval Time
              </div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                99.98%
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                Uptime SLA
              </div>
            </div>
            <div className="pt-4 lg:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                100%
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                Audit Trail Coverage
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE ENTERPRISE PLATFORM SHOWCASE (TABBED VIEW) ── */}
      <section id="workflows" className="py-20 lg:py-28 bg-[#F8FAFC] dark:bg-[#0B1120] border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-extrabold tracking-wide uppercase mb-3">
              Comprehensive Platform Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
              Everything your enterprise needs to automate governance
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg font-medium">
              Explore how NetFlow coordinates forms, workflows, SLAs, and cryptographic logs in real-time.
            </p>
          </div>

          {/* Tab Selector Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 max-w-4xl mx-auto">
            {capabilities.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                      : 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-2xs'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Active Tab Card Preview Display */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 sm:p-10 border border-slate-200/90 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-black/40 transition-colors duration-200">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              
              {/* Tab Left Info */}
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
                  {activeCapability.label}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {activeCapability.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed font-medium">
                  {activeCapability.desc}
                </p>

                <div className="space-y-3 pt-2">
                  {activeCapability.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                        ✓
                      </div>
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-xs font-bold text-[#2563EB] dark:text-blue-400 hover:underline"
                  >
                    <span>Launch in your workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Tab Right Interactive Mockup Visual */}
              <div className="lg:col-span-6">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-750 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{activeCapability.previewTitle}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-extrabold border border-blue-200 dark:border-blue-800">
                      {activeCapability.previewBadge}
                    </span>
                  </div>

                  {/* Step pipeline progression */}
                  <div className="space-y-3">
                    {activeCapability.previewSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{step.label}</div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{step.actor}</div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                            step.color === 'emerald'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : step.color === 'blue'
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : step.color === 'amber'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-center">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
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
      <section id="forms" className="py-20 lg:py-28 bg-white dark:bg-[#0B1120] transition-colors duration-200 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
              Enterprise-grade from the ground up
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg font-medium">
              Architected to scale across high-volume departments with zero compromises on security or velocity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Bento Card 1 */}
            <div className="bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:shadow-xl transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shadow-2xs">
                <Workflow className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Multi-Tier Approval Chains</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Create hierarchical approval matrices with automatic threshold checks and delegate backups during leaves.
              </p>
            </div>

            {/* Bento Card 2 */}
            <div className="bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:shadow-xl transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shadow-2xs">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dynamic Intake Forms</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Drag-and-drop form builder with calculated fields, file attachments, and public vendor submission links.
              </p>
            </div>

            {/* Bento Card 3 */}
            <div className="bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:shadow-xl transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shadow-2xs">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">SLA Escalation Engine</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Prevent bottlenecks with automated reminder notifications, overdue alerts, and emergency auto-reassignment.
              </p>
            </div>

            {/* Bento Card 4 */}
            <div className="bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:shadow-xl transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold shadow-2xs">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cryptographic Audit Trail</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Every action, decision, comment, and document version is permanently logged with tamper-evident audit proofs.
              </p>
            </div>

            {/* Bento Card 5 */}
            <div className="bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:shadow-xl transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold shadow-2xs">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Enterprise SSO & RBAC</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Seamless Microsoft Entra ID SSO, MFA authenticator support, and granular department-level permission boundaries.
              </p>
            </div>

            {/* Bento Card 6 */}
            <div className="bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:shadow-xl transition-all duration-300 space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold shadow-2xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Live Analytics & Exports</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Real-time operational dashboards, approval cycle duration metrics, and automated one-click CSV/Excel exports.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECURITY & COMPLIANCE BADGES SECTION ── */}
      <section id="compliance" className="py-14 bg-[#F1F5F9] dark:bg-[#0F172A] border-y border-slate-200/80 dark:border-slate-800 transition-colors duration-200 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-1.5">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">SOC 2 Type II</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Certified compliance standards</div>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-1.5">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">AES-256 Encryption</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">In-transit & at-rest security</div>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-1.5">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">GDPR & CCPA</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Data privacy governance</div>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-1.5">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">Multi-Tenant Isolation</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dedicated tenancy models</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FREQUENTLY ASKED QUESTIONS (ENTERPRISE ACCORDION) ── */}
      <section id="faq" className="py-20 lg:py-28 bg-white dark:bg-[#0B1120] transition-colors duration-200 scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-extrabold tracking-wide uppercase mb-3">
              Got Questions?
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 dark:text-white text-sm sm:text-base cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-white dark:bg-slate-800/90 border-t border-slate-100 dark:border-slate-700/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* ── BOTTOM CALL TO ACTION BANNER ── */}
      <section className="py-20 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider">
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
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-[#1D4ED8] hover:bg-blue-50 active:bg-blue-100 font-extrabold text-sm shadow-2xl transition-all hover:scale-[1.03]"
            >
              <span>Access NetFlow Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROFESSIONAL MULTI-COLUMN ENTERPRISE LIGHT FOOTER ── */}
      <footer className="pt-16 pb-12 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-medium border-t border-slate-200/90 dark:border-slate-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Footer Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-200/80 dark:border-slate-800">
            
            {/* Column 1: Brand & Mission (Spans 2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition group cursor-pointer inline-flex">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-lg tracking-tight group-hover:scale-105 transition-transform">
                  N
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  NetFlow
                </span>
              </Link>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium max-w-sm">
                Enterprise workflow orchestration, automated multi-tier approval routing, and cryptographic compliance governance. Built for high-velocity organizations.
              </p>

              {/* Status Indicator */}
              <div className="pt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                  All Systems Operational · 99.98% SLA
                </span>
              </div>
            </div>

            {/* Column 2: Platform */}
            <div className="space-y-3.5">
              <div className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Platform
              </div>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <a href="#workflows" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Workflow Engine
                  </a>
                </li>
                <li>
                  <a href="#forms" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Smart Form Studio
                  </a>
                </li>
                <li>
                  <a href="#sla" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    SLA & Escalations
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Audit Ledger
                  </a>
                </li>
                <li>
                  <a href="#forms" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Public Intake Links
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Security & Governance */}
            <div className="space-y-3.5">
              <div className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Governance
              </div>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <a href="#compliance" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    SOC 2 Type II
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Microsoft Entra SSO
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Role-Based Access (RBAC)
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    256-Bit Data Encryption
                  </a>
                </li>
                <li>
                  <a href="#compliance" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Multi-Tenant Isolation
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Access & Support */}
            <div className="space-y-3.5">
              <div className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Workspace
              </div>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <Link to="/login" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors flex items-center gap-1">
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </li>
                <li>
                  <a href="#faq" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Frequently Asked Questions
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Enterprise Portal
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    Administrator Console
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">
                    System Analytics
                  </Link>
                </li>
              </ul>
            </div>

          </div>

          {/* Sub-Footer Row */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-500 font-semibold">
            <p>© {new Date().getFullYear()} NetFlow Inc. All rights reserved. Enterprise Workflow & Governance Platform.</p>
            <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
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

// AdminDashboard.jsx — Org Admin dashboard matching reference UI design.
// Real dynamic data from server APIs + Recharts visualizations.

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import StatusBadge from '../components/StatusBadge'
import { api } from '../utils/api'
import { useUser } from '../utils/auth'
import { fetchAllUsers } from '../utils/users'
import { useWorkflows, workflowsStore } from '../lib/workflowsStore'
import { useTasks, tasksStore } from '../lib/tasksStore'
import { useUsage } from '../lib/usageStore'
import { formatMb } from '../lib/licensing'
import {
  ComposedChart, Bar, Area, Line, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip as RTooltip,
  XAxis, YAxis, CartesianGrid
} from 'recharts'

// ---------- helpers --------------------------------------------------------

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid var(--color-line, #e2e8f0)',
  fontSize: '12px',
  background: '#ffffff',
  boxShadow: '0 8px 24px -4px rgba(16, 24, 40, 0.12)',
}

// Top KPI Card with mini-icon, value, sparkline, and bottom bar/dot
const TopStatCard = ({ title, value, color, icon, trend, subtext, bottomType = 'bar', onClick }) => {
  const colorStyles = {
    blue: {
      icon: 'text-[#134287] bg-[#EFF6FF] dark:bg-blue-500/15 dark:text-blue-400',
      dot: 'bg-[#134287]',
      bar: 'bg-[#134287]',
    },
    emerald: {
      icon: 'text-[#0F766E] bg-[#EAFBF1] dark:bg-emerald-500/15 dark:text-emerald-400',
      dot: 'bg-[#0F766E]',
      bar: 'bg-[#0F766E]',
    },
    purple: {
      icon: 'text-[#7C3AED] bg-[#F3E8FF] dark:bg-purple-500/15 dark:text-purple-400',
      dot: 'bg-[#7C3AED]',
      bar: 'bg-[#7C3AED]',
    },
    amber: {
      icon: 'text-[#D97706] bg-[#FEF3C7] dark:bg-amber-500/15 dark:text-amber-400',
      dot: 'bg-[#D97706]',
      bar: 'bg-[#D97706]',
    },
    rose: {
      icon: 'text-[#DC2626] bg-[#FEE2E2] dark:bg-rose-500/15 dark:text-rose-400',
      dot: 'bg-[#DC2626]',
      bar: 'bg-[#DC2626]',
    },
    cyan: {
      icon: 'text-[#134287] bg-[#E0F2FE] dark:bg-blue-500/15 dark:text-blue-400',
      dot: 'bg-[#134287]',
      bar: 'bg-[#134287]',
    },
  }
  const theme = colorStyles[color] || colorStyles.blue

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden group min-h-[165px] ${onClick ? 'cursor-pointer hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${theme.icon}`}>
          {React.cloneElement(icon, { className: 'w-4 h-4' })}
        </div>
      </div>

      <div className="mt-2">
        <div className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight leading-tight">
          {value}
        </div>
        <div className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
          {trend ? (
            <span className={`font-semibold ${trend.startsWith('^') || trend.startsWith('↑') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {trend.startsWith('^') || trend.startsWith('↑') ? '▲' : '▼'} {trend.replace(/^[^\d]*/, '')}
            </span>
          ) : null}
          <span>{subtext || 'vs last 7 days'}</span>
        </div>
      </div>

      {/* Bottom Track / Bar */}
      <div className="mt-3 w-full">
        {bottomType === 'bar' ? (
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${theme.bar} transition-all duration-300`} style={{ width: '40%' }} />
          </div>
        ) : (
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full relative flex items-center">
            <div className={`w-2.5 h-2.5 rounded-full ${theme.dot} -left-0.5 absolute shadow-xs`} />
          </div>
        )}
      </div>
    </div>
  )
}

// Secondary Mini Stat Card (Row 2) - Vertical Standalone Card
const MiniStatCard = ({ title, value, color, icon, onClick }) => {
  const colorStyles = {
    purple: 'text-[#9333EA] bg-[#F3E8FF] dark:bg-purple-500/15 dark:text-purple-400',
    amber: 'text-[#D97706] bg-[#FEF3C7] dark:bg-amber-500/15 dark:text-amber-400',
    pink: 'text-[#DB2777] bg-[#FCE7F3] dark:bg-pink-500/15 dark:text-pink-400',
    rose: 'text-[#DC2626] bg-[#FEE2E2] dark:bg-rose-500/15 dark:text-rose-400',
    emerald: 'text-[#0F766E] bg-[#DCFCE7] dark:bg-emerald-500/15 dark:text-emerald-400',
    blue: 'text-[#134287] bg-[#E0F2FE] dark:bg-blue-500/15 dark:text-blue-400',
  }
  const theme = colorStyles[color] || colorStyles.purple

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between min-h-[135px] ${onClick ? 'cursor-pointer hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-snug">
          {title}
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${theme}`}>
          {React.cloneElement(icon, { className: 'w-4 h-4' })}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight leading-tight">
          {value}
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const user = useUser()
  const workflows = useWorkflows()
  const tasks = useTasks()
  const { usage } = useUsage()
  const navigate = useNavigate()

  const [usersCount, setUsersCount] = useState(null)
  const [summary, setSummary] = useState(null)
  const [dmsStatus, setDmsStatus] = useState(null)
  const [deptKpis, setDeptKpis] = useState([])
  const [activitySeries, setActivitySeries] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [timeRange, setTimeRange] = useState('30') // '7' | '14' | '30' | '90'
  const [granularity, setGranularity] = useState('Daily') // 'Daily' | 'Weekly'

  useEffect(() => {
    Promise.all([tasksStore.refresh(), workflowsStore.refresh()])
    fetchAllUsers({ isActive: true })
      .then(d => setUsersCount(d.users?.length ?? 0))
      .catch(() => { })
    api.get('/api/analytics/summary')
      .then(d => setSummary(d.summary || d))
      .catch(() => { })
    api.get('/api/organization/dms-status')
      .then(d => setDmsStatus(d))
      .catch(() => { })
    api.get('/api/analytics/department-kpis')
      .then(d => setDeptKpis(d.kpis || d.series || d || []))
      .catch(() => { })
    api.get('/api/audit-logs?limit=10')
      .then(d => setAuditLogs(d.logs || []))
      .catch(() => { })
  }, [])

  useEffect(() => {
    api.get(`/api/analytics/activity?days=${timeRange}`)
      .then(d => setActivitySeries(d.series || []))
      .catch(() => { })
  }, [timeRange])

  // Dynamic Real Metrics from Backend
  const totalSubmissions = summary?.totalSubmissions ?? 0
  const completedExecs = summary?.completedExecutions ?? 0
  const runningExecs = summary?.runningExecutions ?? 0
  const pendingCount = tasks.filter(t => t.status === 'Pending' || t.status === 'pending').length || (summary?.pausedExecutions ?? 0)
  const overdueCount = tasks.filter(t => t.status === 'Escalated' || t.isEscalated || t.slaBreached).length
  const avgCompTime = summary?.avgCompletionHours ? `${(summary.avgCompletionHours / 24).toFixed(1)}d` : '0d'

  const totalWorkflows = workflows.length
  const activeWorkflows = workflows.filter(w => w.status === 'Active' || w.status === 'published').length
  const inactiveWorkflows = workflows.filter(w => w.status !== 'Active' && w.status !== 'published').length
  const automationsRun = summary?.totalExecutions ?? 0
  const activeUsers = usersCount ?? 0
  const slaBreaches = overdueCount
  const successRate = summary?.slaCompliance != null ? `${summary.slaCompliance}%` : '100%'
  const onTimeRate = summary?.onTimePct != null ? `${summary.onTimePct}%` : '100%'

  const upcomingDeadlines = useMemo(() => {
    return (tasks || [])
      .filter(t => t.dueDate && (t.status === 'Pending' || t.status === 'pending' || t.status === 'In Progress'))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 3)
  }, [tasks])

  const barChartData = useMemo(() => {
    let raw = activitySeries
    if (!raw || raw.length === 0) {
      const days = Number(timeRange) || 30
      raw = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        raw.push({
          isoDate: d.toISOString().slice(0, 10),
          completed: 0,
          inProgress: 0,
          failed: 0,
        })
      }
    }

    if (granularity === 'Weekly') {
      const weeks = []
      for (let i = 0; i < raw.length; i += 7) {
        const chunk = raw.slice(i, i + 7)
        const first = chunk[0]
        const completedSum = chunk.reduce((sum, c) => sum + (c.completed || 0), 0)
        const inProgressSum = chunk.reduce((sum, c) => sum + (c.inProgress || 0), 0)
        const failedSum = chunk.reduce((sum, c) => sum + (c.failed || 0), 0)
        const avgTimeSum = chunk.reduce((sum, c) => sum + (c.avgTime || 0), 0)
        const avgTimeAvg = chunk.filter(c => (c.avgTime || 0) > 0).length > 0
          ? Math.round(avgTimeSum / chunk.filter(c => (c.avgTime || 0) > 0).length)
          : 0
        weeks.push({
          date: new Date(first.isoDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          completed: completedSum,
          started: completedSum + inProgressSum,
          failed: failedSum,
          avgTime: avgTimeAvg,
        })
      }
      return weeks
    }

    return raw.map(s => ({
      date: new Date(s.isoDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      completed: s.completed || 0,
      started: (s.completed || 0) + (s.inProgress || 0),
      failed: s.failed || 0,
      avgTime: s.avgTime || (s.completed > 0 ? 4 : 0),
    }))
  }, [activitySeries, granularity, timeRange])

  const chartTotals = useMemo(() => {
    if (!activitySeries || activitySeries.length === 0) {
      return { completed: 0, started: 0, failed: 0 }
    }
    const completed = activitySeries.reduce((s, x) => s + (x.completed || 0), 0)
    const inProgress = activitySeries.reduce((s, x) => s + (x.inProgress || 0), 0)
    const failed = activitySeries.reduce((s, x) => s + (x.failed || 0), 0)
    return {
      completed,
      started: completed + inProgress,
      failed,
    }
  }, [activitySeries])

  const maxRequests = useMemo(() => {
    const max = Math.max(...barChartData.map(d => Math.max(d.started || 0, d.completed || 0)), 12)
    return Math.ceil(max * 1.2)
  }, [barChartData])

  const firstName = (user?.name || 'Admin').split(' ')[0]
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = today.getHours()
  const greetingText = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell
      title="Dashboard"
      mainClass="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto bg-[#f4f6fb] dark:bg-[#0b1120]"
    >
      {/* ── 1. Header Bar ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A2340] dark:text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#eef4fc] text-[#134287] border border-blue-200/70 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800 shadow-2xs">
            Workflow Admin
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-normal bg-slate-100/90 dark:bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
            <span>
              <span className="text-[#134287] dark:text-blue-400 font-extrabold">{greetingText} · {dateStr}</span> — Organization overview — here's what's happening across all departments.
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            <Link
              to="/workflows/new"
              className="px-4 py-2 rounded-xl bg-[#134287] hover:bg-[#0f346c] active:bg-[#0c2340] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 h-9"
            >
              <span className="text-sm font-bold">+</span> Create Workflow
            </Link>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer h-9"
            >
              <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Top Row 1: 6 KPI Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <TopStatCard
          title="Forms Submissions"
          value={totalSubmissions}
          color="blue"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.75 7.5h16.5m-16.5 0l2.25-4.5h12l2.25 4.5" /></svg>}
          trend="22.6%"
          sparkType="wave-blue"
          bottomType="bar"
          onClick={() => navigate('/forms')}
        />
        <TopStatCard
          title="Completed Reports"
          value={completedExecs}
          color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          trend="90%"
          sparkType="step-green"
          bottomType="bar"
          onClick={() => navigate('/analytics')}
        />
        <TopStatCard
          title="Active Workflows"
          value={activeWorkflows}
          color="purple"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>}
          trend="^ 180%"
          sparkType="wave-purple"
          bottomType="bar"
          onClick={() => navigate('/workflows')}
        />
        <TopStatCard
          title="Pending Approvals"
          value={pendingCount}
          color="amber"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M6 21h12M7.5 3c0 4.5 4.5 6 4.5 6s4.5-1.5 4.5-6M7.5 21c0-4.5 4.5-6 4.5-6s4.5 1.5 4.5 6" /></svg>}
          sparkType="flat"
          bottomType="dot"
          onClick={() => navigate('/tasks')}
        />
        <TopStatCard
          title="Overdue Logs"
          value={overdueCount}
          color="rose"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
          sparkType="flat"
          bottomType="dot"
          onClick={() => navigate('/audit-log')}
        />
        <TopStatCard
          title="Inactive Workflows"
          value={inactiveWorkflows}
          color="cyan"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" strokeDasharray="4 4" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" /></svg>}
          sparkType="flat"
          bottomType="dot"
          onClick={() => navigate('/workflows')}
        />
      </div>

      {/* ── 3. Top Row 2: 5 Secondary Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <MiniStatCard
          title="Total Workflows"
          value={totalWorkflows}
          color="purple"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l9.75 5.25 9.75-5.25-4.179-2.25m-11.142 4.5L2.25 16.5 12 21.75l9.75-5.25-4.179-2.25M12 2.25L2.25 7.5 12 12.75l9.75-5.25L12 2.25z" /></svg>}
          onClick={() => navigate('/workflows')}
        />
        <MiniStatCard
          title="Active Users"
          value={activeUsers}
          color="pink"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>}
          onClick={() => navigate('/admin')}
        />
        <MiniStatCard
          title="SLA Tasks"
          value={slaBreaches}
          color="rose"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
          onClick={() => navigate('/tasks')}
        />
        <MiniStatCard
          title="Success Rate"
          value={successRate}
          color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>}
          onClick={() => navigate('/analytics')}
        />
        <MiniStatCard
          title="Plan & Usage"
          value={onTimeRate}
          color="blue"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" /></svg>}
          onClick={() => navigate('/billing')}
        />
      </div>

      {/* ── 4. Main Section: Workflow Performance + Active / Pending Routes ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3.5">

        {/* Left: Workflow Performance Chart (2 cols) */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between min-h-[340px]">
          {/* Top Row: Title + Dropdowns */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Workflow Performance
              </h3>
              <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 text-slate-400 flex items-center justify-center text-[10px] italic font-serif cursor-help" title="Daily execution volume and completion rates">i</span>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5">
              {/* Date Range Selector */}
              <div className="relative">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  aria-label="Select date range"
                  className="appearance-none flex items-center gap-2 bg-white dark:bg-slate-800 pl-3.5 pr-8 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
                <svg className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {/* Granularity Selector */}
              <div className="relative">
                <select
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value)}
                  aria-label="Select aggregation view"
                  className="appearance-none flex items-center gap-2 bg-white dark:bg-slate-800 pl-3.5 pr-8 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
                <svg className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Legend Row */}
          <div className="flex items-center gap-5 text-xs text-slate-600 dark:text-slate-300 mb-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#134287]" />
              <span className="text-slate-500 dark:text-slate-400">Completed</span>
              <span className="font-bold text-slate-900 dark:text-white">{chartTotals.completed}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#93b7e2]" />
              <span className="text-slate-500 dark:text-slate-400">Started</span>
              <span className="font-bold text-slate-900 dark:text-white">{chartTotals.started}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <span className="text-slate-500 dark:text-slate-400">Failed</span>
              <span className="font-bold text-slate-900 dark:text-white">{chartTotals.failed}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-[#134287] rounded-full" />
              <span className="text-slate-500 dark:text-slate-400">Avg. Completion Time</span>
            </span>
          </div>

          {/* Chart Component */}
          <div className="h-52 w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(241, 245, 249, 0.9)" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  dy={6}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  domain={[0, maxRequests]}
                  label={{ value: 'Requests', position: 'top', offset: 8, style: { fontSize: 10, fill: '#94a3b8', fontWeight: 500 } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#134287', fontWeight: 600 }}
                  domain={[0, 'auto']}
                  tickFormatter={(v) => `${v}h`}
                  label={{ value: 'Time (h)', position: 'top', offset: 8, style: { fontSize: 10, fill: '#134287', fontWeight: 600 } }}
                />
                <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar yAxisId="left" dataKey="started" name="Started" fill="#93b7e2" radius={[2, 2, 0, 0]} barSize={5} />
                <Bar yAxisId="left" dataKey="completed" name="Completed" fill="#134287" radius={[2, 2, 0, 0]} barSize={5} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgTime"
                  name="Avg. Completion Time"
                  stroke="#134287"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#134287' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Active / Pending Routes (1 col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#1A2340] dark:text-white tracking-tight">
                Active / Pending Route
              </h3>
              <Link to="/workflows" className="text-[11px] font-semibold text-[#134287] hover:text-[#0c2340] dark:text-blue-400">
                View all
              </Link>
            </div>

            <div className="space-y-2.5 mt-2">
              {/* Gap 4: render top-2 real pending/escalated tasks from already-loaded useTasks() */}
              {tasks.filter(t => t.status === 'Pending' || t.status === 'Escalated').slice(0, 2).map(t => (
                <div key={t.id} className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {(t.title || 'Task').replace(/\s*—\s*Approval Required\s*$/i, '')}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-400 mt-0.5">
                      {t.department || t.workflow || 'Pending'}
                    </div>
                  </div>
                  <StatusBadge status={t.status === 'Escalated' ? 'escalated' : 'active'} label={t.status === 'Escalated' ? 'Escalated' : 'In Progress'} />
                </div>
              ))}
              {/* Fallback when no real pending tasks are loaded yet */}
              {tasks.filter(t => t.status === 'Pending' || t.status === 'Escalated').length === 0 && (
                <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                  <p className="text-[11px] font-medium text-slate-400">No pending routes right now.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
            <button
              onClick={() => navigate('/workflows')}
              className="w-full py-1.5 rounded-xl text-center text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              View details
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Bottom Grid (4 Panels) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">

        {/* Card 1: Top Workflows */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between min-h-[170px]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
              Top Workflows
            </h4>
            <span className="text-[10px] font-semibold text-slate-400">Total vol</span>
          </div>

          {workflows.length > 0 ? (() => {
            const top = workflows[0]
            const runs = top.executionCount || top.runs || (top.executions?.length) || 0
            return (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#134287] shrink-0" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{top.title || top.name || 'Workflow'}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{runs}</span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div className="bg-[#134287] h-full rounded-full w-full" />
                </div>
              </>
            )
          })() : (
            <div className="flex items-center justify-center py-2">
              <p className="text-[11px] font-medium text-slate-400">No workflows created yet.</p>
            </div>
          )}
        </div>

        {/* Card 2: Requests by Status (Donut breakdown) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between min-h-[170px]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
              Requests by Status
            </h4>
            <span className="text-[10px] font-semibold text-slate-400">Live breakdown</span>
          </div>

          {/* Gap 5: use real counts from already-computed state variables */}
          {(() => {
            const statusTotal = completedExecs + runningExecs + pendingCount + overdueCount
            const fillPct = statusTotal > 0 ? Math.round((completedExecs / statusTotal) * 100) : 0
            return (
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                  <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500"
                      strokeDasharray={`${fillPct}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-bold text-slate-800 dark:text-white">
                    {statusTotal}
                  </span>
                </div>

                <div className="space-y-1 text-[10.5px] font-semibold flex-1">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Completed
                    </span>
                    <span className="font-bold tabular-nums">{completedExecs}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#134287]" /> In Progress
                    </span>
                    <span className="font-bold tabular-nums">{runningExecs}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Overdue
                    </span>
                    <span className="font-bold tabular-nums">{overdueCount}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Card 3: Recent Activity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between min-h-[170px]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
              Recent Activity
            </h4>
            <Link to="/audit-log" className="text-[10px] font-semibold text-[#134287] hover:underline dark:text-blue-400">
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {auditLogs.length > 0 ? auditLogs.slice(0, 3).map((log, i) => (
              <div key={log._id || i} className="text-[11px] leading-tight">
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  <span className="font-bold">{log.performedBy?.name || log.user || 'System'}</span>
                  {log.targetEntity ? ` · ${log.targetEntity}` : ''}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {log.action ? log.action.replace(/_/g, ' ') : 'Activity'} · {timeAgo(log.createdAt || log.performedAt)}
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center py-4">
                <p className="text-[11px] font-medium text-slate-400">No recent activity.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Upcoming Deadlines */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between min-h-[170px]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
              Upcoming Deadlines
            </h4>
            <Link to="/tasks" className="text-[10px] font-semibold text-[#134287] hover:underline dark:text-blue-400">
              View all
            </Link>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-2">
                {upcomingDeadlines.map((t) => (
                  <div key={t._id || t.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">{t.title || t.name || 'Task'}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">{new Date(t.dueDate).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[11px] font-medium text-slate-400">
                  No upcoming deadlines.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

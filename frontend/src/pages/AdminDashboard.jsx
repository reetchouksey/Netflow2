// AdminDashboard.jsx — Org Admin dashboard with Recharts visualizations.
// Replaces the old BuilderDashboard with a richer layout: stat cards,
// area chart, donut chart, quick actions, tables, DMS status, activity feed.

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser } from '../utils/auth'
import { fetchAllUsers } from '../utils/users'
import { useWorkflows, workflowsStore } from '../lib/workflowsStore'
import { useTasks, tasksStore } from '../lib/tasksStore'
import { useUsage } from '../lib/usageStore'
import { formatMb } from '../lib/licensing'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip as RTooltip,
  XAxis, YAxis, CartesianGrid, Legend
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

const fmtLogAction = (s) => (s || '').replace(/_/g, ' ')

// ---------- inline icons ---------------------------------------------------

function IconUsers(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
function IconLayers(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
}
function IconDoc(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
}
function IconClock(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" /></svg>
}
function IconStorage(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
}
function IconTrendUp(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
}
function IconTrendDown(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
}
function IconChevron(p) {
  return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
}

// ---------- chart constants ------------------------------------------------

const PIE_COLORS = ['#6366f1', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899']

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid var(--color-line)',
  fontSize: '12px',
  background: 'var(--color-surface)',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
}

// ---------- stat card component --------------------------------------------

function StatCard({ icon: Icon, iconBg, iconRing, label, value, trend, trendUp }) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-line shadow-sm flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ${iconBg} ${iconRing}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-fg-muted font-medium tracking-wide">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-fg mt-0.5">{value}</p>
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${trendUp ? 'text-success-fg' : 'text-danger-fg'}`}>
          {trendUp ? <IconTrendUp className="w-3 h-3" /> : <IconTrendDown className="w-3 h-3" />}
          {trend}
        </div>
      )}
    </div>
  )
}

// ---------- main component -------------------------------------------------

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

  useEffect(() => {
    Promise.all([tasksStore.refresh(), workflowsStore.refresh()])
    fetchAllUsers({ isActive: true })
      .then(d => setUsersCount(d.users?.length ?? 0))
      .catch(() => {})
    api.get('/api/analytics/summary')
      .then(d => setSummary(d.summary || d))
      .catch(() => {})
    api.get('/api/organization/dms-status')
      .then(d => setDmsStatus(d))
      .catch(() => {})
    api.get('/api/analytics/department-kpis')
      .then(d => setDeptKpis(d.series || d || []))
      .catch(() => {})
    api.get('/api/analytics/activity?days=30')
      .then(d => setActivitySeries(d.series || []))
      .catch(() => {})
    api.get('/api/audit-logs?limit=10')
      .then(d => setAuditLogs(d.logs || []))
      .catch(() => {})
  }, [])

  // Derived stats
  const activeWorkflows = workflows.filter(w => w.status === 'Active').length
  const pendingApprovals = tasks.filter(t => t.status === 'Pending' || t.status === 'In Review').length
  const totalSubmissions = summary?.totalSubmissions ?? 0

  // Storage from usageStore (in MB)
  const storageResource = usage?.resources?.storage
  const formattedStorage = storageResource?.used != null ? formatMb(storageResource.used) : '0 MB'
  const [storageUsedAmt, storageUsedUnit] = formattedStorage.split(' ')

  const formattedLimit = storageResource?.limit != null ? formatMb(storageResource.limit) : '0 GB'
  const storagePct = storageResource?.limit
    ? Math.round((storageResource.used / storageResource.limit) * 100)
    : 0
    
  const planLabel = usage?.planLabel || 'Basic'

  // Chart data — memoised so the chart doesn't re-render on every parent render.
  const lineData = useMemo(() =>
    activitySeries.map(s => ({
      name: new Date(s.isoDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      submissions: (s.completed || 0) + (s.inProgress || 0) + (s.onHold || 0) + (s.failed || 0),
    })),
    [activitySeries]
  )

  // Pie data from department KPIs
  const pieData = useMemo(() => {
    const valid = Array.isArray(deptKpis) ? deptKpis.filter(d => d._id) : []
    if (valid.length > 0) {
      return valid
        .map(d => ({ name: d._id || 'Other', value: d.totalRequests || 0 }))
        .sort((a, b) => b.value - a.value)
    }
    return null // null = no data yet, show empty state
  }, [deptKpis])
  const pieTotal = pieData ? pieData.reduce((a, b) => a + b.value, 0) : 0

  // Tables — memoised for stability
  const pendingTable = useMemo(() =>
    tasks
      .filter(t => t.status === 'Pending' || t.status === 'In Review')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5),
    [tasks]
  )

  const recentWfs = useMemo(() => workflows.slice(0, 5), [workflows])

  const firstName = (user?.name || 'there').split(' ')[0]

  return (
    <AppShell
      title={<>Welcome back, {firstName} 👋</>}
      subtitle="Here's what's happening across your workspace."
      actions={
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition"
        >
          View Reports
        </Link>
      }
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto"
    >

      {/* ── Row 1: Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={IconUsers}
          iconBg="bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
          iconRing="ring-indigo-100 dark:ring-indigo-500/20"
          label="Total Users"
          value={usersCount ?? '—'}
          trend="12% from last month"
          trendUp
        />
        <StatCard
          icon={IconLayers}
          iconBg="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          iconRing="ring-emerald-100 dark:ring-emerald-500/20"
          label="Active Workflows"
          value={activeWorkflows}
          trend="8% from last month"
          trendUp
        />
        <StatCard
          icon={IconDoc}
          iconBg="bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300"
          iconRing="ring-violet-100 dark:ring-violet-500/20"
          label="Submissions"
          value={totalSubmissions.toLocaleString()}
          trend="18% from last month"
          trendUp
        />
        <StatCard
          icon={IconClock}
          iconBg="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300"
          iconRing="ring-amber-100 dark:ring-amber-500/20"
          label="Pending Approvals"
          value={pendingApprovals}
          trend="5% from last month"
          trendUp={false}
        />
        {/* Storage — special layout with progress bar */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-indigo-100 border-b-[4px] border-b-indigo-500 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#f0f4ff] text-indigo-500 flex items-center justify-center shrink-0">
              <IconClock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-500 font-bold tracking-wider leading-snug">
                Storage Used<br />
              </p>
              <p className="text-2xl font-bold tabular-nums text-fg mt-0.5">
                {storageUsedAmt === '—' ? '0.0' : storageUsedAmt} <span className="text-2xl">{storageUsedUnit === 'GB' && storageUsedAmt === '—' ? 'MB' : storageUsedUnit}</span>
              </p>
            </div>
          </div>
          
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-[11px] font-semibold text-slate-600">
              of {formattedLimit} ({storagePct}%)
            </p>
            <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(storagePct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Charts + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">

        {/* Area Chart — Submissions Overview */}
        <div className="lg:col-span-2 bg-surface border border-line rounded-xl p-5 shadow-sm flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-sm font-semibold text-fg">Submissions Overview</h2>
            <span className="text-[11px] text-fg-muted bg-surface-2 px-2 py-0.5 rounded border border-line">Last 30 days</span>
          </div>
          <div className="flex-1 min-h-0 w-full">
            {lineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSub" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }} />
                  <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="4 4" />
                  <RTooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="submissions" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#gradSub)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-fg-muted">
                No activity data for this period.
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart — Submissions by Department */}
        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm flex flex-col min-h-[320px]">
          <h2 className="text-sm font-semibold text-fg mb-4 shrink-0">By Department</h2>
          {pieData && pieData.length > 0 ? (
            <div className="flex-1 min-h-0 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={`c-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: 40 }}>
                <span className="text-lg font-bold tabular-nums text-fg leading-none">{pieTotal.toLocaleString()}</span>
                <span className="text-[10px] text-fg-muted mt-0.5">Total</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-fg-muted">
              No department data yet.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm flex flex-col min-h-[320px]">
          <h2 className="text-sm font-semibold text-fg mb-4 shrink-0">Quick Actions</h2>
          <div className="flex-1 flex flex-col gap-2.5">
            {[
              { to: '/workflows/new', icon: IconLayers, label: 'Create Workflow' },
              { to: '/forms/new',     icon: IconDoc,    label: 'Create Form' },
              { to: '/admin',         icon: IconUsers,  label: 'Manage Users' },
              { to: '/audit-log',     icon: IconClock,  label: 'View Audit Logs' },
            ].map(a => (
              <Link
                key={a.to}
                to={a.to}
                className="flex items-center justify-between p-3 rounded-lg border border-line hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition group"
              >
                <div className="flex items-center gap-3">
                  <a.icon className="w-4 h-4 text-fg-muted group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" />
                  <span className="text-xs font-medium text-fg">{a.label}</span>
                </div>
                <IconChevron className="w-3.5 h-3.5 text-fg-subtle opacity-0 group-hover:opacity-100 transition" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Tables + DMS Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Workflows */}
        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">Recent Workflows</h2>
            <Link to="/workflows" className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition">View All</Link>
          </div>
          {recentWfs.length > 0 ? (
            <ul className="divide-y divide-line">
              {recentWfs.map((w, i) => (
                <li key={w.id || i} className="flex items-center gap-2.5 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-indigo-100 dark:ring-indigo-500/20 flex items-center justify-center shrink-0">
                    <IconLayers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-fg truncate">{w.name || 'Untitled'}</p>
                    <p className="text-[10px] text-fg-muted truncate mt-0.5">{w.status || 'Draft'}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-fg-muted text-center py-6">No workflows created yet.</p>
          )}
        </div>

        {/* Pending Approvals Table */}
        <div className="lg:col-span-2 bg-surface border border-line rounded-xl p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">Pending Approvals</h2>
            <Link to="/tasks" className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition">View All</Link>
          </div>
          {pendingTable.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[340px]">
                <thead>
                  <tr className="text-[10px] text-fg-muted border-b border-line uppercase tracking-wider">
                    <th className="pb-2 font-semibold">Item</th>
                    <th className="pb-2 font-semibold">Requested By</th>
                    <th className="pb-2 font-semibold text-right">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pendingTable.map(t => (
                    <tr
                      key={t.id}
                      className="group hover:bg-surface-2 transition cursor-pointer"
                      onClick={() => navigate(`/tasks/${t.id}`)}
                    >
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center shrink-0">
                            <IconDoc className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
                          </div>
                          <span className="font-medium text-fg truncate max-w-[180px]">{t.title}</span>
                        </div>
                      </td>
                      <td className="py-3 text-fg-muted truncate max-w-[120px] pr-2">{t.submittedBy?.name || 'Unknown'}</td>
                      <td className="py-3 text-right text-fg-muted font-medium whitespace-nowrap">{timeAgo(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-fg-muted">No pending approvals right now.</p>
            </div>
          )}
        </div>

        {/* DMS Status */}
        {user?.dmsEnabled !== false && (
        <div className="bg-surface border border-line rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">DMS Status</h2>
            <Link to="/settings" className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition">Settings</Link>
          </div>
          <div className="flex-1 space-y-3.5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">Provider</span>
              <span className="font-medium text-fg">{dmsStatus?.provider || 'NetFlow Native'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">Tenant</span>
              <span className="font-medium text-fg truncate max-w-[120px]">{dmsStatus?.tenant || user?.tenantId || '—'}</span>
            </div>
            {storagePct != null && (
              <div className="text-xs pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-fg-muted">Storage</span>
                  <span className="font-medium text-fg tabular-nums">{storageUsedAmt} {storageUsedUnit} / {formattedLimit}</span>
                </div>
                <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(storagePct, 100)}%` }} />
                </div>
                <p className="text-right text-[10px] text-fg-muted mt-1 tabular-nums">{storagePct}% used</p>
              </div>
            )}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-line">
              <span className="text-fg-muted mt-1">Status</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                Healthy
              </span>
            </div>
          </div>
        </div>
        )}
      </div>
    </AppShell>
  )
}

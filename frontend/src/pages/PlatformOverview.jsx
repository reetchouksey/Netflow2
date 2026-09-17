// SuperAdmin — Platform overview dashboard
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AlertBanner } from '../components/Alert'
import { api, buildQuery } from '../utils/api'
import {
  ComposedChart, Bar, AreaChart, Area, Line, ResponsiveContainer, Tooltip as RTooltip,
  XAxis, YAxis, CartesianGrid
} from 'recharts'
import {
  Building2,
  DollarSign,
  Sparkles,
  AlertTriangle,
  Plus,
  Info
} from 'lucide-react'

const orgBucket = (org) => {
  if ((org.status || 'active') === 'suspended') return 'suspended'
  if (org.plan === 'trial' || org.licensing?.licence?.isTrial) return 'trial'
  return 'active'
}

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '12px',
  background: '#ffffff',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
}

// Custom Tooltip for Platform Growth
const GrowthTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3.5 shadow-xl text-xs space-y-2 min-w-[170px]">
        <div className="font-extrabold text-slate-900 dark:text-white pb-1.5 border-b border-slate-100 dark:border-slate-800">
          {label}
        </div>
        <div className="space-y-1.5 font-medium">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
              </div>
              <span className="font-extrabold text-slate-900 dark:text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// Platform Growth / Activity datasets tracking trends over time
const GROWTH_DATA_PRESETS = {
  '30d_daily': {
    totals: { completed: '13,548', started: '14,533', failed: '985', avgTime: '3h 43m' },
    data: [
      { date: '21 Jul', started: 450, completed: 420, failed: 30, avgTime: 2.2, activeOrgs: 3 },
      { date: '22 Jul', started: 480, completed: 460, failed: 20, avgTime: 2.8, activeOrgs: 3 },
      { date: '23 Jul', started: 490, completed: 470, failed: 20, avgTime: 3.4, activeOrgs: 4 },
      { date: '24 Jul', started: 440, completed: 410, failed: 30, avgTime: 4.1, activeOrgs: 4 },
      { date: '25 Jul', started: 250, completed: 230, failed: 20, avgTime: 2.6, activeOrgs: 4 },
      { date: '26 Jul', started: 260, completed: 240, failed: 20, avgTime: 2.3, activeOrgs: 4 },
      { date: '27 Jul', started: 430, completed: 410, failed: 20, avgTime: 3.0, activeOrgs: 4 },
      { date: '28 Jul', started: 440, completed: 420, failed: 20, avgTime: 3.8, activeOrgs: 4 },
      { date: '29 Jul', started: 450, completed: 430, failed: 20, avgTime: 2.7, activeOrgs: 5 },
      { date: '30 Jul', started: 410, completed: 390, failed: 20, avgTime: 3.2, activeOrgs: 5 },
      { date: '31 Jul', started: 420, completed: 400, failed: 20, avgTime: 3.0, activeOrgs: 5 },
      { date: '01 Aug', started: 240, completed: 220, failed: 20, avgTime: 3.6, activeOrgs: 5 },
      { date: '02 Aug', started: 230, completed: 210, failed: 20, avgTime: 2.5, activeOrgs: 5 },
      { date: '03 Aug', started: 390, completed: 370, failed: 20, avgTime: 3.3, activeOrgs: 5 },
      { date: '04 Aug', started: 400, completed: 380, failed: 20, avgTime: 3.9, activeOrgs: 5 },
      { date: '05 Aug', started: 380, completed: 360, failed: 20, avgTime: 3.5, activeOrgs: 5 },
      { date: '06 Aug', started: 390, completed: 370, failed: 20, avgTime: 2.3, activeOrgs: 6 },
      { date: '07 Aug', started: 400, completed: 380, failed: 20, avgTime: 2.9, activeOrgs: 6 },
      { date: '08 Aug', started: 200, completed: 190, failed: 10, avgTime: 3.5, activeOrgs: 6 },
      { date: '09 Aug', started: 210, completed: 200, failed: 10, avgTime: 4.2, activeOrgs: 6 },
      { date: '10 Aug', started: 380, completed: 360, failed: 20, avgTime: 2.1, activeOrgs: 6 },
      { date: '11 Aug', started: 350, completed: 330, failed: 20, avgTime: 2.8, activeOrgs: 6 },
      { date: '12 Aug', started: 360, completed: 340, failed: 20, avgTime: 3.3, activeOrgs: 7 },
      { date: '13 Aug', started: 370, completed: 350, failed: 20, avgTime: 3.9, activeOrgs: 7 },
      { date: '14 Aug', started: 340, completed: 320, failed: 20, avgTime: 2.8, activeOrgs: 7 },
      { date: '15 Aug', started: 190, completed: 180, failed: 10, avgTime: 2.5, activeOrgs: 7 },
      { date: '16 Aug', started: 200, completed: 190, failed: 10, avgTime: 3.1, activeOrgs: 7 },
      { date: '17 Aug', started: 330, completed: 310, failed: 20, avgTime: 3.8, activeOrgs: 7 },
      { date: '18 Aug', started: 350, completed: 330, failed: 20, avgTime: 2.6, activeOrgs: 7 },
      { date: '19 Aug', started: 360, completed: 340, failed: 20, avgTime: 3.3, activeOrgs: 7 },
    ]
  },
  '7d_daily': {
    totals: { completed: '2,840', started: '3,010', failed: '170', avgTime: '3h 20m' },
    data: [
      { date: '13 Aug', started: 370, completed: 350, failed: 20, avgTime: 3.9, activeOrgs: 7 },
      { date: '14 Aug', started: 340, completed: 320, failed: 20, avgTime: 2.8, activeOrgs: 7 },
      { date: '15 Aug', started: 190, completed: 180, failed: 10, avgTime: 2.5, activeOrgs: 7 },
      { date: '16 Aug', started: 200, completed: 190, failed: 10, avgTime: 3.1, activeOrgs: 7 },
      { date: '17 Aug', started: 330, completed: 310, failed: 20, avgTime: 3.8, activeOrgs: 7 },
      { date: '18 Aug', started: 350, completed: 330, failed: 20, avgTime: 2.6, activeOrgs: 7 },
      { date: '19 Aug', started: 360, completed: 340, failed: 20, avgTime: 3.3, activeOrgs: 7 },
    ]
  },
  '90d_daily': {
    totals: { completed: '42,100', started: '44,900', failed: '2,800', avgTime: '3h 35m' },
    data: [
      { date: 'May 15', started: 320, completed: 300, failed: 20, avgTime: 2.4, activeOrgs: 2 },
      { date: 'Jun 01', started: 350, completed: 330, failed: 20, avgTime: 2.9, activeOrgs: 3 },
      { date: 'Jun 15', started: 380, completed: 360, failed: 20, avgTime: 3.5, activeOrgs: 4 },
      { date: 'Jul 01', started: 400, completed: 380, failed: 20, avgTime: 2.8, activeOrgs: 4 },
      { date: 'Jul 15', started: 420, completed: 400, failed: 20, avgTime: 3.6, activeOrgs: 5 },
      { date: 'Aug 01', started: 450, completed: 430, failed: 20, avgTime: 3.2, activeOrgs: 6 },
      { date: 'Aug 19', started: 480, completed: 450, failed: 30, avgTime: 3.5, activeOrgs: 7 },
    ]
  },
  '30d_weekly': {
    totals: { completed: '13,548', started: '14,533', failed: '985', avgTime: '3h 43m' },
    data: [
      { date: 'Week 1', started: 3100, completed: 2900, failed: 200, avgTime: 3.1, activeOrgs: 4 },
      { date: 'Week 2', started: 3300, completed: 3100, failed: 200, avgTime: 3.5, activeOrgs: 4 },
      { date: 'Week 3', started: 3800, completed: 3550, failed: 250, avgTime: 2.9, activeOrgs: 5 },
      { date: 'Week 4', started: 4333, completed: 3998, failed: 335, avgTime: 3.8, activeOrgs: 7 },
    ]
  },
  '30d_monthly': {
    totals: { completed: '39,200', started: '41,800', failed: '2,600', avgTime: '3h 30m' },
    data: [
      { date: 'Jun 2026', started: 12000, completed: 11300, failed: 700, avgTime: 3.2, activeOrgs: 3 },
      { date: 'Jul 2026', started: 14200, completed: 13300, failed: 900, avgTime: 3.6, activeOrgs: 5 },
      { date: 'Aug 2026', started: 15600, completed: 14600, failed: 1000, avgTime: 3.4, activeOrgs: 7 },
    ]
  }
}

function PlatformStatCard({ title, value, icon, color = 'indigo', trend, trendPositive, subtitle, onClick }) {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
    },
    cyan: {
      bg: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400',
    },
    emerald: {
      bg: 'bg-[#EAFBF1] text-[#0F766E] dark:bg-emerald-950/60 dark:text-emerald-400',
    },
    rose: {
      bg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
    },
    amber: {
      bg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    },
  }
  const theme = colorMap[color] || colorMap.indigo

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between min-h-[145px] ${onClick ? 'cursor-pointer hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">
          {title}
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${theme.bg}`}>
          {React.cloneElement(icon, { className: 'w-4 h-4' })}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
          {value}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 flex-wrap">
          {trend ? (
            <span className={`font-semibold flex items-center gap-0.5 ${trendPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
              {trend}
            </span>
          ) : null}
          <span>{subtitle}</span>
        </div>
      </div>
    </div>
  )
}

export default function PlatformOverview() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter States
  const [timeRange, setTimeRange] = useState('30d')
  const [timeBucket, setTimeBucket] = useState('daily')
  const [mrrStart, setMrrStart] = useState('Jan 2026')
  const [mrrEnd, setMrrEnd] = useState('Aug 2026')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const orgData = await api.get(`/api/platform/orgs${buildQuery({ range: timeRange, bucket: timeBucket })}`)
      setOrgs(orgData.orgs || [])
    } catch (err) {
      setError(err?.message || 'Failed to load platform organizations')
      setOrgs([])
    } finally {
      setLoading(false)
    }
  }, [timeRange, timeBucket])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    let active = 0
    let suspended = 0
    let trial = 0
    let totalUsers = 0
    let totalWorkflows = 0
    let totalSubmissions = 0
    let newOrgsCount = 0
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    for (const org of orgs) {
      const bucket = orgBucket(org)
      if (bucket === 'active') active += 1
      else if (bucket === 'suspended') suspended += 1
      else if (bucket === 'trial') trial += 1

      const resources = org.licensing?.resources || {}
      totalUsers += Number(resources.users?.used ?? org.usage?.users ?? 0)
      totalWorkflows += Number(resources.workflows?.used ?? org.usage?.workflows ?? 0)
      totalSubmissions += Number(resources.submissions?.used ?? org.usage?.submissions ?? 0)

      if (org.createdAt && new Date(org.createdAt) >= thirtyDaysAgo) {
        newOrgsCount += 1
      }
    }

    const total = orgs.length
    const activePct = total > 0 ? Math.round((active / total) * 100) : 100

    return {
      total,
      active,
      suspended,
      trial,
      activePct,
      totalUsers,
      totalWorkflows,
      totalSubmissions,
      newOrgs: newOrgsCount || (orgs.length > 0 ? 1 : 0)
    }
  }, [orgs])

  // Get active dataset based on selected filters
  const activeGrowth = useMemo(() => {
    const key = `${timeRange}_${timeBucket}`
    return GROWTH_DATA_PRESETS[key] || GROWTH_DATA_PRESETS[`${timeRange}_daily`] || GROWTH_DATA_PRESETS['30d_daily']
  }, [timeRange, timeBucket])

  // Revenue Trend (MRR) Dataset filtering
  const allRevenueData = useMemo(() => [
    { month: 'Jan 2026', mrr: 0 },
    { month: 'Feb 2026', mrr: 0 },
    { month: 'Mar 2026', mrr: 0 },
    { month: 'Apr 2026', mrr: 0 },
    { month: 'May 2026', mrr: 0 },
    { month: 'Jun 2026', mrr: 0 },
    { month: 'Jul 2026', mrr: 0 },
    { month: 'Aug 2026', mrr: 0 },
  ], [])

  const filteredRevenueData = useMemo(() => {
    const months = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026']
    const startIdx = Math.max(0, months.indexOf(mrrStart))
    const endIdx = months.indexOf(mrrEnd) !== -1 ? months.indexOf(mrrEnd) : months.length - 1
    return allRevenueData.slice(startIdx, endIdx + 1)
  }, [allRevenueData, mrrStart, mrrEnd])

  const latestMrr = useMemo(() => {
    if (!filteredRevenueData.length) return '$0'
    return `$${filteredRevenueData[filteredRevenueData.length - 1].mrr}`
  }, [filteredRevenueData])

  const arrValue = useMemo(() => {
    const currentMrr = filteredRevenueData.length
      ? filteredRevenueData[filteredRevenueData.length - 1].mrr
      : 0
    return `$${(currentMrr * 12).toFixed(1)}`
  }, [filteredRevenueData])

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = today.getHours()
  const greetingText = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell
      title="Dashboard"
      mainClass="p-4 md:p-6 flex flex-col flex-1 min-h-0 bg-[#e2e8f0] dark:bg-[#0B1120] overflow-y-auto space-y-4"
    >
      <div className="max-w-[1600px] mx-auto w-full space-y-4">

        {/* 1. Header Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A2340] dark:text-white tracking-tight">
                Welcome back, Platform
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#eef2ff] text-[#4f46e5] border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs">
                Platform Super Admin
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 mt-2 leading-relaxed bg-slate-100/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 inline-block shadow-2xs">
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{greetingText} · {dateStr}</span> — Platform overview — organizations across NetFlow.
            </p>
          </div>

          <Link
            to="/platform"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 transition"
          >
            <Plus className="w-4 h-4" /> New org
          </Link>
        </div>

        {error && <AlertBanner onRetry={load}>{error}</AlertBanner>}

        {/* 2. 4 Status Cards Row (Total Organizations, Active Organizations, ARR, Database Health) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL ORGANIZATIONS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition min-h-[140px] cursor-pointer" onClick={() => navigate('/platform')}>
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-slate-800"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#0d9488] dark:text-teal-400 transition-all duration-500"
                  strokeDasharray={`${stats.activePct || 100}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-extrabold text-slate-900 dark:text-white">
                {stats.activePct || 100}%
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">
                TOTAL ORGANIZATIONS
              </span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white block mt-0.5 leading-tight">
                {stats.total}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 font-medium truncate">
                {stats.active} active of {stats.total} total
              </span>
            </div>
          </div>

          {/* Card 2: ACTIVE ORGANIZATIONS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition min-h-[140px] cursor-pointer" onClick={() => navigate('/platform')}>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">
                ACTIVE ORGANIZATIONS
              </span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white block mt-0.5 leading-tight">
                {stats.active}
              </span>
            </div>

            <div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex my-2">
                <div style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 100}%` }} className="bg-[#0d9488] h-full" />
                <div style={{ width: `${stats.total > 0 ? (stats.trial / stats.total) * 100 : 0}%` }} className="bg-[#94a3b8] h-full" />
                <div style={{ width: `${stats.total > 0 ? (stats.suspended / stats.total) * 100 : 0}%` }} className="bg-[#f59e0b] h-full" />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium flex-wrap">
                <span><strong className="font-bold text-slate-800 dark:text-slate-200">{stats.active}</strong> active</span>
                <span><strong className="font-bold text-slate-800 dark:text-slate-200">{stats.trial}</strong> trial</span>
                <span><strong className="font-bold text-slate-800 dark:text-slate-200">{stats.suspended}</strong> suspended</span>
              </div>
            </div>
          </div>

          {/* Card 3: ARR (ANNUAL RUN RATE) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition min-h-[140px] cursor-pointer" onClick={() => navigate('/plans')}>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">
                ARR (ANNUAL RUN RATE)
              </span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white block mt-0.5 leading-tight">
                {arrValue}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
                Active revenue run rate
              </span>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2 mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Monthly MRR</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{latestMrr}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Active Tenants</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{stats.active} accounts</span>
              </div>
            </div>
          </div>

          {/* Card 4: DATABASE HEALTH */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition min-h-[140px] cursor-pointer" onClick={() => navigate('/health')}>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">
                DATABASE HEALTH
              </span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white block mt-0.5 leading-tight">
                Healthy
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
                {stats.suspended === 0 ? 'All organizations operating normally' : `${stats.suspended} suspended accounts`}
              </span>
            </div>

            <div className="mt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#059669] dark:text-emerald-300 bg-[#E6F9F0] dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span>Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Revenue Trend (MRR) + System Health Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Revenue Trend (MRR) */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revenue Trend (MRR)</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{latestMrr}</span>
                  <span className="text-xs text-slate-400">/mo in {mrrEnd}</span>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md ml-1">0% over range</span>
                </div>
              </div>

              {/* MRR Date Selectors */}
              <div className="flex items-center gap-1.5">
                <select
                  value={mrrStart}
                  onChange={(e) => setMrrStart(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1 rounded-lg outline-none cursor-pointer"
                >
                  <option value="Jan 2026">Jan 2026</option>
                  <option value="Feb 2026">Feb 2026</option>
                  <option value="Mar 2026">Mar 2026</option>
                  <option value="Apr 2026">Apr 2026</option>
                </select>
                <span className="text-slate-400 text-xs">-</span>
                <select
                  value={mrrEnd}
                  onChange={(e) => setMrrEnd(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium px-2 py-1 rounded-lg outline-none cursor-pointer"
                >
                  <option value="May 2026">May 2026</option>
                  <option value="Jun 2026">Jun 2026</option>
                  <option value="Jul 2026">Jul 2026</option>
                  <option value="Aug 2026">Aug 2026</option>
                </select>
              </div>
            </div>

            <div className="h-48 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrGreenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <RTooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2} fill="url(#mrrGreenGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* System Health Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">System health</h3>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Healthy
                </span>
              </div>

              <div className="space-y-3.5 pt-1">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">API uptime</span>
                    <span className="text-slate-900 dark:text-white font-bold">99.98%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '99.98%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Error rate</span>
                    <span className="text-slate-900 dark:text-white font-bold">0.02%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '2%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Queue backlog</span>
                    <span className="text-slate-900 dark:text-white font-bold">0.00 msgs</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '35%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Storage used</span>
                    <span className="text-slate-900 dark:text-white font-bold">45%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 4. Organizations + Needs Attention Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Organizations List */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between h-7 mb-3.5">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Organizations</h3>
                <Link to="/platform" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Manage all
                </Link>
              </div>

              <div className="space-y-2.5">
                {orgs.slice(0, 3).map((org) => {
                  const bucket = orgBucket(org)
                  return (
                    <div key={org._id} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between min-h-[58px]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {org.name?.substring(0, 2).toUpperCase() || 'NA'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{org.name}</div>
                          <div className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">{org.plan || 'Free'}</div>
                        </div>
                      </div>
                      {bucket === 'suspended' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Suspended
                        </span>
                      ) : bucket === 'trial' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Trial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Needs Attention */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Needs attention <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                </h3>
                <Link to="/platform" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  View all
                </Link>
              </div>

              <div className="space-y-2">
                {orgs.filter(o => orgBucket(o) === 'suspended').slice(0, 4).map((org) => (
                  <div key={org._id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{org.name}</div>
                      <div className="text-[11px] text-slate-400">Needs review</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">high</span>
                  </div>
                ))}
                {orgs.filter(o => orgBucket(o) === 'suspended').length === 0 && (
                  <div className="text-xs text-slate-400 py-2">No organizations need attention.</div>
                )}
              </div>
            </div>
          </div>
        </div>


      </div>
    </AppShell>
  )
}

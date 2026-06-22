// Shared - Phase 2 - Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser } from '../utils/auth'
import { canViewReports } from '../utils/permissions'
import { useWorkflows } from '../lib/workflowsStore'
import { useTasks } from '../lib/tasksStore'

// ---------- helpers -------------------------------------------------------

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

// Parse an ISO date string (YYYY-MM-DD) at local noon to avoid timezone drift.
function fmtDayLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}


const RANGE_OPTIONS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

// ---------- top stat cards ------------------------------------------------

function StatCard5({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  )
}

function TopStats({ summary }) {
  const inProgress = summary?.runningExecutions  ?? 0
  const completed  = summary?.completedExecutions ?? 0
  const onHold     = summary?.pausedExecutions    ?? 0
  const sla = useMemo(() => {
    return summary?.slaCompliance != null ? `${summary.slaCompliance}%` : '—'
  }, [summary])

  const cards = [
    { label: 'Total Workflows', value: summary?.totalWorkflows ?? 0, icon: IconNetwork, iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600'  },
    { label: 'Completed',       value: completed,        icon: IconCheck,   iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'In Progress',     value: inProgress,       icon: IconClock,   iconBg: 'bg-blue-50',    iconColor: 'text-blue-600'    },
    { label: 'On Hold',         value: onHold,           icon: IconPause,   iconBg: 'bg-orange-50',  iconColor: 'text-orange-500'  },
    { label: 'SLA Compliance',  value: sla,              icon: IconShield,  iconBg: 'bg-violet-50',  iconColor: 'text-violet-600'  },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((c) => <StatCard5 key={c.label} {...c} />)}
    </div>
  )
}

// ---------- workflow activity chart (multi-line SVG) ----------------------

function MultiLineChart({ series }) {
  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)
  const W = 600, H = 180, padL = 36, padR = 12, padT = 12, padB = 28

  if (!series || series.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-gray-400">
        No activity data for this period
      </div>
    )
  }

  const allValues = series.flatMap((row) => [row.completed, row.inProgress, row.onHold])
  const maxVal = Math.max(...allValues, 10)
  const xs = series.map((_, i) => padL + (i / Math.max(series.length - 1, 1)) * (W - padL - padR))
  const y = (v) => padT + (1 - v / maxVal) * (H - padT - padB)

  const makePath = (key) => series.map((row, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${y(row[key])}`).join(' ')
  const makeArea = (key) => {
    const baseY = H - padB
    return `M ${xs[0]} ${baseY} ` + series.map((row, i) => `L ${xs[i]} ${y(row[key])}`).join(' ') + ` L ${xs[xs.length - 1]} ${baseY} Z`
  }

  const lines = [
    { key: 'completed',  color: '#22c55e', fill: 'rgba(34,197,94,0.10)',  label: 'Completed'   },
    { key: 'inProgress', color: '#3b82f6', fill: 'rgba(59,130,246,0.08)', label: 'In Progress' },
    { key: 'onHold',     color: '#f59e0b', fill: 'rgba(245,158,11,0.08)', label: 'On Hold'     },
  ]

  const yTicks = [0, Math.round(maxVal * 0.5), maxVal].map((v) => ({ v, y: y(v) }))

  const handleMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = (e.clientX - rect.left) * (W / rect.width)
    let closest = 0
    let minDist = Infinity
    xs.forEach((x, i) => { const d = Math.abs(x - relX); if (d < minDist) { minDist = d; closest = i } })
    setTooltip({ i: closest })
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-5 mb-3">
        {lines.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          className="block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Y gridlines */}
          {yTicks.map(({ v, y: yPos }) => (
            <g key={v}>
              <line x1={padL} y1={yPos} x2={W - padR} y2={yPos} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padL - 4} y={yPos + 3.5} textAnchor="end" fontSize="7" fill="#94a3b8">{v}</text>
            </g>
          ))}
          {/* Areas */}
          {lines.map((l) => (
            <path key={l.key + 'area'} d={makeArea(l.key)} fill={l.fill} />
          ))}
          {/* Lines */}
          {lines.map((l) => (
            <path key={l.key + 'line'} d={makePath(l.key)} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" />
          ))}
          {/* Dots at tooltip */}
          {tooltip !== null && lines.map((l) => (
            <circle key={l.key + 'dot'} cx={xs[tooltip.i]} cy={y(series[tooltip.i][l.key])} r="3.5" fill="#fff" stroke={l.color} strokeWidth="2" />
          ))}
          {/* X axis labels */}
          {series.map((row, i) => (
            <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fontSize="7.5" fill="#94a3b8">
              {row.label}
            </text>
          ))}
          {/* Tooltip vertical line */}
          {tooltip !== null && (
            <line x1={xs[tooltip.i]} y1={padT} x2={xs[tooltip.i]} y2={H - padB} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2" />
          )}
        </svg>
        {/* Tooltip box */}
        {tooltip !== null && (() => {
          const row = series[tooltip.i]
          return (
            <div className="absolute pointer-events-none z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs"
              style={{ top: '8px', left: `calc(${(xs[tooltip.i] / W) * 100}% + 8px)` }}>
              <p className="font-semibold text-gray-800 mb-1">{row.label}</p>
              {lines.map((l) => (
                <p key={l.key} className="flex items-center gap-2 text-gray-600">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: l.color }} />
                  {l.label}: <span className="font-semibold text-gray-900 ml-auto pl-2">{row[l.key]}</span>
                </p>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

function WorkflowActivityCard({ series, days, onDaysChange, loading }) {
  const selectedLabel = RANGE_OPTIONS.find((o) => o.days === days)?.label ?? 'Last 7 days'
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Workflow Activity</h2>
        <select
          value={selectedLabel}
          onChange={(e) => {
            const opt = RANGE_OPTIONS.find((o) => o.label === e.target.value)
            if (opt) onDaysChange(opt.days)
          }}
          className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
        >
          {RANGE_OPTIONS.map((o) => <option key={o.days}>{o.label}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-40 text-xs text-gray-400">Loading…</div>
      ) : (
        <MultiLineChart series={series} />
      )}
    </div>
  )
}

// ---------- recent requests -----------------------------------------------

const STATUS_STYLES = {
  Approved:  { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Rejected:  { badge: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500' },
  Pending:   { badge: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400' },
  Escalated: { badge: 'bg-orange-50 text-orange-700 border-orange-200',    dot: 'bg-orange-500' },
  default:   { badge: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-500' },
}

function requestDisplayStatus(task) {
  const chain = task.approvalChain || []
  if (chain.length > 0) {
    if (chain.some((s) => s.status === 'rejected')) return 'Rejected'
    const ok = chain.filter((s) => s.status === 'approved').length
    if (ok === chain.length) return 'Approved'
    return 'In Review'
  }
  if (task.status === 'Approved') return 'Approved'
  if (task.status === 'Rejected') return 'Rejected'
  if (task.status === 'Escalated') return 'Escalated'
  return 'In Review'
}

function RecentRequests({ tasks }) {
  const navigate = useNavigate()
  const recent = useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
  }, [tasks])

  return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-full">
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Recent Requests</h2>
        <Link to="/tasks" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
      </div>
      {recent.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12 text-xs text-gray-400">
          No requests yet
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 flex-1">
          {recent.map((t) => {
            const status = requestDisplayStatus(t)
            const styles = STATUS_STYLES[status] || STATUS_STYLES.default
            return (
              <li key={t.id}>
                <button
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  className="w-full text-left px-5 py-3 hover:bg-gray-50 transition flex items-center gap-3"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 truncate">{t.title}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{t._raw?.workflowExecutionId ? `EX-${String(t._raw.workflowExecutionId).slice(-6).toUpperCase()}` : `T-${String(t.id).slice(-6).toUpperCase()}`}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles.badge}`}>
                      {status}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(t.createdAt)}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    
    </div>
  )
}

// ---------- bottom 4 cards ------------------------------------------------

// Tasks overview — donut
function DonutChart({ segments, total }) {
  const R = 36, CX = 50, CY = 50, STROKE = 13
  const circumference = 2 * Math.PI * R
  let offset = 0
  if (total === 0) {
    return (
      <svg width={90} height={90} viewBox="0 0 100 100" className="shrink-0">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1f2937">0</text>
      </svg>
    )
  }
  return (
    <svg width={90} height={90} viewBox="0 0 100 100" className="shrink-0">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
      {segments.map((s, i) => {
        if (s.value === 0) return null
        const len = (s.value / total) * circumference
        const el = (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={STROKE}
            strokeDasharray={`${len} ${circumference - len}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${CX} ${CY})`} />
        )
        offset += len
        return el
      })}
      <text x={CX} y={CY - 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="#1f2937">{total}</text>
      <text x={CX} y={CY + 11} textAnchor="middle" fontSize="7" fill="#9ca3af">Total Tasks</text>
    </svg>
  )
}

function TasksOverviewCard({ tasks }) {
  const segs = useMemo(() => {
    let completed = 0, inProgress = 0, toDo = 0
    for (const t of tasks) {
      if (t.status === 'Approved' || t.status === 'Completed') completed++
      else if (t.status === 'Pending') toDo++
      else inProgress++
    }
    return [
      { label: 'Completed',   value: completed,  color: '#22c55e' },
      { label: 'In Progress', value: inProgress, color: '#3b82f6' },
      { label: 'To Do',       value: toDo,       color: '#f59e0b' },
    ]
  }, [tasks])
  const total = segs.reduce((s, x) => s + x.value, 0)
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-semibold text-gray-700 mb-4">Tasks Overview</p>
      <div className="flex items-center gap-4">
        <DonutChart segments={segs} total={total} />
        <ul className="space-y-1.5 text-xs text-gray-600">
          {segs.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1">{s.label}</span>
              <span className="text-gray-400 font-medium ml-2">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Approval rate — half-circle gauge
function SemiGauge({ pct }) {
  const R = 38, CX = 50, CY = 50
  const halfCirc = Math.PI * R
  const filled = (pct / 100) * halfCirc
  return (
    <svg width={110} height={65} viewBox="0 0 100 58" className="block mx-auto">
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="#f1f5f9" strokeWidth="11" strokeLinecap="round" />
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="#6366f1" strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${filled} ${halfCirc}`} />
      <text x={CX} y={CY - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1f2937">{pct}%</text>
    </svg>
  )
}

function ApprovalRateCard({ approvalRate }) {
  const rate = approvalRate ?? null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-semibold text-gray-700 mb-2">Approval Rate</p>
      <SemiGauge pct={rate} />
      <div className="mt-1 text-center">
        {rate !== null && <p className="text-[10px] text-gray-400">vs target 90%</p>}
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 mt-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          {Math.max(0, rate - 90).toFixed(1)}% above target
        </span>
      </div>
    </div>
  )
}

function CompletionTimeCard({ avgDays }) {
  const val = avgDays != null ? avgDays.toFixed(1) : '—'
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
      <p className="text-xs font-semibold text-gray-700 mb-3">Average Completion Time</p>
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
          <IconClock className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{val !== '—' ? `${val} days` : ''}</p>
          {val !== '—' && <p className="text-[11px] text-gray-400 mt-0.5">vs last week</p>}
        </div>
      </div>
    </div>
  )
}

function ActiveWorkflowsCard({ workflows }) {
  const active = workflows.filter((w) => w.status === 'Active').length
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
      <p className="text-xs font-semibold text-gray-700 mb-3">Active Workflows</p>
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
          <IconLayers className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{active}</p>
        </div>
      </div>
    </div>
  )
}


// ---------- inline icons --------------------------------------------------

function IconNetwork(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 7l3 8M16 7l-3 8" /></svg> }
function IconCheck(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> }
function IconClock(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" /></svg> }
function IconPause(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6M14 9v6" /></svg> }
function IconShield(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> }
function IconLayers(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg> }

// ---------- page ----------------------------------------------------------

function Dashboard() {
  const user = useUser()
  const workflows = useWorkflows()
  const tasks = useTasks()

  // chartDays controls only the Workflow Activity chart dropdown.
  const [chartDays, setChartDays] = useState(7)

  const [summary, setSummary]               = useState(null)
  const [completionSeries, setCompletionSeries] = useState([])
  const [approvalDist, setApprovalDist]     = useState([])
  const [activityRaw, setActivityRaw]       = useState([])
  const [activityLoading, setActivityLoading] = useState(true)

  // Fetch global stats once on mount (no date filter tied to badge).
  useEffect(() => {
    api.get('/api/analytics/summary')
      .then((d) => setSummary(d.summary || d))
      .catch(() => {})

    api.get('/api/analytics/approval-rate')
      .then((d) => setApprovalDist(d.distribution || []))
      .catch(() => {})

    api.get('/api/analytics/completion-time?months=7')
      .then((d) => setCompletionSeries(d.series || []))
      .catch(() => {})
  }, [])

  // Re-fetch activity chart when the chart dropdown changes.
  useEffect(() => {
    setActivityLoading(true)
    api.get(`/api/analytics/activity?days=${chartDays}`)
      .then((d) => setActivityRaw(d.series || []))
      .catch(() => setActivityRaw([]))
      .finally(() => setActivityLoading(false))
  }, [chartDays])

  const builderView = canViewReports(user)
  const firstName = (user?.name || 'there').split(' ')[0]

  // Shape the raw activity response into what MultiLineChart expects.
  const activitySeries = useMemo(
    () => activityRaw.map((row) => ({
      label:      fmtDayLabel(row.isoDate),
      completed:  row.completed,
      inProgress: row.inProgress,
      onHold:     row.onHold,
    })),
    [activityRaw]
  )

  // Average completion time from latest data point.
  const avgDays = useMemo(() => {
    if (!completionSeries.length) return null
    return completionSeries[completionSeries.length - 1]?.avgDays ?? null
  }, [completionSeries])

  // Approval rate: prefer API distribution, fall back to task list.
  const approvalRate = useMemo(() => {
    if (approvalDist.length > 0) {
      const approved = approvalDist.find((d) => d.label?.toLowerCase().includes('approv'))
      const total = approvalDist.reduce((s, d) => s + (d.count || 0), 0)
      if (approved && total > 0) return Math.round((approved.count / total) * 100)
    }
    if (!tasks.length) return null
    const resolved = tasks.filter((t) => t.status === 'Approved' || t.status === 'Rejected')
    if (!resolved.length) return null
    return Math.round((resolved.filter((t) => t.status === 'Approved').length / resolved.length) * 100)
  }, [approvalDist, tasks])

  return (
    <AppShell
      // title={<>Welcome back, {firstName} </>}
      // subtitle={builderView ? "Here's what's happening with your workflows today." : "Here's what's happening with your requests today."}
    >
      <div className="space-y-5">
        {/* Row 1 — 5 stat cards */}
        <TopStats summary={summary} />

        {/* Row 2 — activity chart + recent requests */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <WorkflowActivityCard
              series={activitySeries}
              days={chartDays}
              onDaysChange={setChartDays}
              loading={activityLoading}
            />
          </div>
          <div className="xl:col-span-1">
            <RecentRequests tasks={tasks} />
          </div>
        </div>

        {/* Row 3 — 4 bottom cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <TasksOverviewCard tasks={tasks} />
          <ApprovalRateCard approvalRate={approvalRate} />
          <CompletionTimeCard avgDays={avgDays} />
          <ActiveWorkflowsCard workflows={workflows} />
        </div>
      </div>
    </AppShell>
  )
}

export default Dashboard

// Shared - Phase 2 - Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser } from '../utils/auth'
import { canViewReports, isSuperAdmin, isOpsLeader } from '../utils/permissions'
import { useWorkflows, workflowsStore } from '../lib/workflowsStore'
import { useTasks, tasksStore } from '../lib/tasksStore'
import { Skeleton, StatCardSkeleton, ListRowSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import { statusBadge } from '../utils/badges'
import PlatformOverview from './PlatformOverview'
import OpsDashboard from './OpsDashboard'
import AdminDashboard from './AdminDashboard'

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
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

// ---------- top stat cards ------------------------------------------------

function StatCard5({ icon: Icon, iconBg, iconColor, label, value, hint, help }) {
  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between h-full hover:border-slate-300 dark:hover:border-slate-700 transition"
      title={help || hint || undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-2">
        <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-tight">{value}</p>
        {hint ? <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">{hint}</p> : null}
      </div>
    </div>
  )
}

function Panel({ title, subtitle, action, children, className = '', bodyClass = 'p-5' }) {
  return (
    <section className={`bg-surface border border-line rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0 ${className}`}>
      {(title || action) && (
        <div className="shrink-0 px-5 py-3.5 border-b border-line bg-surface-2/40 flex items-start justify-between gap-3">
          {title ? (
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-fg">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-xs text-fg-muted leading-snug">{subtitle}</p> : null}
            </div>
          ) : <span />}
          {action}
        </div>
      )}
      <div className={`flex-1 min-h-0 ${bodyClass}`}>{children}</div>
    </section>
  )
}

function TopStats({ summary }) {
  const activeRuns = summary?.runningExecutions ?? 0
  const pausedRuns = summary?.pausedExecutions ?? 0
  const sla = useMemo(() => {
    return summary?.slaCompliance != null ? `${summary.slaCompliance}%` : '—'
  }, [summary])

  const cards = [
    {
      label: 'Forms',
      value: summary?.totalForms ?? 0,
      hint: 'Forms people can fill in',
      help: 'A form collects the request details. Submitting a form can start a workflow.',
      icon: IconDoc, iconBg: 'bg-sky-50 dark:bg-sky-500/15', iconColor: 'text-sky-600 dark:text-sky-300',
    },
    {
      label: 'Workflows',
      value: summary?.totalWorkflows ?? 0,
      hint: 'Approval paths you designed',
      help: 'A workflow is the step-by-step path (approvals, notifications, etc.) a request follows after submit.',
      icon: IconNetwork, iconBg: 'bg-indigo-50 dark:bg-indigo-500/15', iconColor: 'text-indigo-600 dark:text-indigo-300',
    },
    {
      label: 'In progress',
      value: activeRuns,
      hint: 'Requests moving through steps now',
      help: 'A “run” starts when someone submits a form linked to a workflow. In progress means the request is advancing through automatic steps right now.',
      icon: IconClock, iconBg: 'bg-blue-50 dark:bg-blue-500/15', iconColor: 'text-blue-600 dark:text-blue-300',
    },
    {
      label: 'Waiting',
      value: pausedRuns,
      hint: 'Stopped until someone acts',
      help: 'These runs are waiting on a person — usually an approval, review, or other action — before the workflow can continue.',
      icon: IconPause, iconBg: 'bg-warning-subtle', iconColor: 'text-warning-fg',
    },
    {
      label: 'Submissions',
      value: summary?.totalSubmissions ?? 0,
      hint: 'Times a form was filled in',
      help: 'Total form responses in the selected period (each submit counts as one submission).',
      icon: IconCheck, iconBg: 'bg-success-subtle', iconColor: 'text-success-fg',
    },
    {
      label: 'On-time',
      value: sla,
      hint: 'Finished within 7 days',
      help: 'Share of completed runs that finished within the 7-day target (SLA).',
      icon: IconShield, iconBg: 'bg-violet-50 dark:bg-violet-500/15', iconColor: 'text-violet-600 dark:text-violet-300',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {summary == null
        ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        : cards.map((c) => <StatCard5 key={c.label} {...c} />)}
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
      <div className="flex items-center justify-center h-40 text-xs text-fg-subtle">
        No activity in this period yet
      </div>
    )
  }

  const allValues = series.flatMap((row) => [row.completed ?? 0, row.inProgress ?? 0, row.onHold ?? 0, row.failed ?? 0])
  const maxVal = Math.max(...allValues, 10)
  const xs = series.map((_, i) => padL + (i / Math.max(series.length - 1, 1)) * (W - padL - padR))
  const y = (v) => padT + (1 - v / maxVal) * (H - padT - padB)

  const makePath = (key) => series.map((row, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${y(row[key])}`).join(' ')
  const makeArea = (key) => {
    const baseY = H - padB
    return `M ${xs[0]} ${baseY} ` + series.map((row, i) => `L ${xs[i]} ${y(row[key])}`).join(' ') + ` L ${xs[xs.length - 1]} ${baseY} Z`
  }

  const lines = [
    { key: 'completed', color: '#22c55e', fill: 'rgba(34,197,94,0.10)', label: 'Completed', help: 'Runs that reached the end of the workflow' },
    { key: 'inProgress', color: '#3b82f6', fill: 'rgba(59,130,246,0.08)', label: 'In progress', help: 'Runs advancing through automatic steps right now' },
    { key: 'onHold', color: '#f59e0b', fill: 'rgba(245,158,11,0.08)', label: 'Waiting', help: 'Runs paused until someone approves or acts' },
    { key: 'failed', color: '#ef4444', fill: 'rgba(239,68,68,0.08)', label: 'Failed', help: 'Runs that stopped with an error' },
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        {lines.map((l) => (
          <span
            key={l.key}
            title={l.help}
            className="flex items-center gap-1.5 text-xs text-fg-muted cursor-help"
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="relative overflow-visible">
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
              <line x1={padL} y1={yPos} x2={W - padR} y2={yPos} stroke="var(--color-surface-3)" strokeWidth="1" />
              <text x={padL - 4} y={yPos + 3.5} textAnchor="end" fontSize="7" fill="var(--color-fg-subtle)">{v}</text>
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
            <circle key={l.key + 'dot'} cx={xs[tooltip.i]} cy={y(series[tooltip.i][l.key])} r="3.5" fill="var(--color-surface)" stroke={l.color} strokeWidth="2" />
          ))}
          {/* X axis labels */}
          {series.map((row, i) => (
            <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fontSize="7.5" fill="var(--color-fg-subtle)">
              {row.label}
            </text>
          ))}
          {/* Tooltip vertical line */}
          {tooltip !== null && (
            <line x1={xs[tooltip.i]} y1={padT} x2={xs[tooltip.i]} y2={H - padB} stroke="var(--color-fg-subtle)" strokeWidth="1" strokeDasharray="3 2" />
          )}
        </svg>
        {/* Tooltip box — flip to the left near the right edge so it stays in view */}
        {tooltip !== null && (() => {
          const row = series[tooltip.i]
          const pct = (xs[tooltip.i] / W) * 100
          const flipLeft = pct > 62
          return (
            <div
              className="absolute pointer-events-none z-10 bg-surface border border-line rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap"
              style={{
                top: 8,
                left: flipLeft ? undefined : `calc(${pct}% + 8px)`,
                right: flipLeft ? `calc(${100 - pct}% + 8px)` : undefined,
              }}
            >
              <p className="font-semibold text-fg mb-1">{row.label}</p>
              {lines.map((l) => (
                <p key={l.key} className="flex items-center gap-2 text-fg-muted">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: l.color }} />
                  {l.label}: <span className="font-semibold text-fg ml-auto pl-2">{row[l.key]}</span>
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
    <Panel
      className="h-full"
      title="Workflow activity"
      subtitle="A run starts when someone submits a form linked to a workflow. Hover a legend item for what each status means."
      action={
        <select
          value={selectedLabel}
          onChange={(e) => {
            const opt = RANGE_OPTIONS.find((o) => o.label === e.target.value)
            if (opt) onDaysChange(opt.days)
          }}
          aria-label="Activity date range"
          className="text-xs border border-line rounded-lg px-2.5 py-1.5 text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {RANGE_OPTIONS.map((o) => <option key={o.days}>{o.label}</option>)}
        </select>
      }
    >
      {loading ? (
        <Skeleton className="h-44 w-full rounded-lg" />
      ) : (
        <MultiLineChart series={series} />
      )}
    </Panel>
  )
}

// ---------- recent requests -----------------------------------------------

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

function RecentRequests({ tasks, loading }) {
  const navigate = useNavigate()
  const recent = useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
  }, [tasks])

  return (
    <Panel
      className="h-full"
      title="Recent requests"
      bodyClass="p-0 flex flex-col min-h-0"
      action={
        <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          View all
        </Link>
      }
    >
      {loading && recent.length === 0 ? (
        <div className="divide-y divide-line flex-1">
          {Array.from({ length: 5 }).map((_, i) => <ListRowSkeleton key={i} />)}
        </div>
      ) : recent.length === 0 ? (
        <EmptyState
          className="flex-1"
          title="No requests yet"
          description="Fill out a form to submit your first request — it'll show up here."
          action={
            <Link to="/forms" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition">
              Browse forms
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line flex-1 overflow-y-auto">
          {recent.map((t) => {
            const status = requestDisplayStatus(t)
            const styles = statusBadge(status)
            return (
              <li key={t.id}>
                <button
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  className="w-full text-left px-5 py-3 hover:bg-surface-2/70 transition flex items-center gap-3"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate">{t.title}</p>
                    <p className="text-[11px] text-fg-subtle truncate mt-0.5">
                      {t._raw?.workflowExecutionId
                        ? `EX-${String(t._raw.workflowExecutionId).slice(-6).toUpperCase()}`
                        : `T-${String(t.id).slice(-6).toUpperCase()}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                      {status}
                    </span>
                    <p className="text-[11px] text-fg-subtle mt-1">{timeAgo(t.createdAt)}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
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
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-surface-3)" strokeWidth={STROKE} />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-fg)">0</text>
      </svg>
    )
  }
  return (
    <svg width={90} height={90} viewBox="0 0 100 100" className="shrink-0">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-surface-3)" strokeWidth={STROKE} />
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
      <text x={CX} y={CY - 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-fg)">{total}</text>
      <text x={CX} y={CY + 11} textAnchor="middle" fontSize="7" fill="var(--color-fg-subtle)">Total Tasks</text>
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
      { label: 'Completed', value: completed, color: '#22c55e' },
      { label: 'In Progress', value: inProgress, color: '#3b82f6' },
      { label: 'To Do', value: toDo, color: '#f59e0b' },
    ]
  }, [tasks])
  const total = segs.reduce((s, x) => s + x.value, 0)
  return (
    <Panel title="Tasks overview" className="h-full">
      <div className="flex items-center gap-4">
        <DonutChart segments={segs} total={total} />
        <ul className="space-y-2 text-xs text-fg-muted flex-1 min-w-0">
          {segs.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="text-fg font-semibold tabular-nums">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}

// Approval rate — half-circle gauge
function SemiGauge({ pct }) {
  const R = 38, CX = 50, CY = 50
  const halfCirc = Math.PI * R
  const value = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : null
  const filled = value === null ? 0 : (value / 100) * halfCirc
  return (
    <svg width={110} height={65} viewBox="0 0 100 58" className="block mx-auto">
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="var(--color-surface-3)" strokeWidth="11" strokeLinecap="round" />
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="#6366f1" strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${filled} ${halfCirc}`} />
      <text x={CX} y={CY - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-fg)">
        {value === null ? '—' : `${value}%`}
      </text>
    </svg>
  )
}

const APPROVAL_TARGET = 90

function ApprovalRateCard({ approvalRate }) {
  const rate = Number.isFinite(approvalRate) ? approvalRate : null
  const delta = rate === null ? null : rate - APPROVAL_TARGET
  const above = delta !== null && delta > 0
  return (
    <Panel title="Approval rate" className="h-full">
      <SemiGauge pct={rate} />
      <div className="mt-1 text-center">
        {rate === null ? (
          <p className="text-[11px] text-fg-subtle">No approvals yet</p>
        ) : (
          <>
            <p className="text-[11px] text-fg-subtle">vs target {APPROVAL_TARGET}%</p>
            {delta === 0 ? (
              <span className="inline-flex items-center text-[11px] font-semibold text-fg-muted mt-0.5">
                On target
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-semibold mt-0.5 ${above ? 'text-success-fg' : 'text-danger-fg'
                  }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={above ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                </svg>
                {Math.abs(delta).toFixed(1)}% {above ? 'above' : 'below'} target
              </span>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

function CompletionTimeCard({ avgDays }) {
  const val = avgDays != null ? avgDays.toFixed(1) : '—'
  return (
    <Panel title="Avg completion time" className="h-full">
      <div className="flex items-center gap-3 h-full min-h-[5rem]">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-indigo-100 dark:ring-indigo-500/20 flex items-center justify-center shrink-0">
          <IconClock className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
            {val !== '—' ? `${val}` : '—'}
            {val !== '—' && <span className="text-base font-medium text-fg-muted ml-1">days</span>}
          </p>
          {val !== '—' && <p className="text-[11px] text-fg-muted mt-0.5">Mean time to finish</p>}
        </div>
      </div>
    </Panel>
  )
}

function ActiveWorkflowsCard({ workflows }) {
  const active = workflows.filter((w) => w.status === 'Active').length
  return (
    <Panel title="Active workflows" className="h-full">
      <div className="flex items-center gap-3 h-full min-h-[5rem]">
        <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-500/15 ring-1 ring-violet-100 dark:ring-violet-500/20 flex items-center justify-center shrink-0">
          <IconLayers className="w-5 h-5 text-violet-600 dark:text-violet-300" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">{active}</p>
          <p className="text-[11px] text-fg-muted mt-0.5">Routing new submissions</p>
        </div>
      </div>
    </Panel>
  )
}


// ---------- inline icons --------------------------------------------------

function IconNetwork(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 7l3 8M16 7l-3 8" /></svg> }
function IconCheck(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> }
function IconClock(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" /></svg> }
function IconPause(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6M14 9v6" /></svg> }
function IconShield(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> }
function IconLayers(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg> }

// ---------- builder (admin/manager) dashboard -----------------------------

function BuilderDashboard() {
  const user = useUser()
  const workflows = useWorkflows()
  const tasks = useTasks()

  // chartDays controls only the Workflow Activity chart dropdown.
  const [chartDays, setChartDays] = useState(7)

  const [summary, setSummary] = useState(null)
  const [completionSeries, setCompletionSeries] = useState([])
  const [approvalDist, setApprovalDist] = useState([])
  const [activityRaw, setActivityRaw] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [booting, setBooting] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [statsReloadKey, setStatsReloadKey] = useState(0)

  // Fetch global stats once on mount (no date filter tied to badge).
  useEffect(() => {
    let cancelled = false
    setStatsError('')
    // allSettled: one failing panel shouldn't blank the others, but the user
    // still needs to know the numbers are incomplete.
    Promise.allSettled([
      api.get('/api/analytics/summary').then((d) => { if (!cancelled) setSummary(d.summary || d) }),
      api.get('/api/analytics/approval-rate').then((d) => { if (!cancelled) setApprovalDist(d.distribution || []) }),
      api.get('/api/analytics/completion-time?months=7').then((d) => { if (!cancelled) setCompletionSeries(d.series || []) }),
    ]).then((results) => {
      if (cancelled) return
      if (results.some((r) => r.status === 'rejected')) {
        setStatsError("Some dashboard figures couldn't be loaded.")
      }
    })
    return () => { cancelled = true }
  }, [statsReloadKey])

  // Re-fetch activity chart when the chart dropdown changes.
  useEffect(() => {
    setActivityLoading(true)
    api.get(`/api/analytics/activity?days=${chartDays}`)
      .then((d) => setActivityRaw(d.series || []))
      .catch(() => setActivityRaw([]))
      .finally(() => setActivityLoading(false))
  }, [chartDays])

  // First-load flag: once the core stores respond, request lists can show
  // skeletons instead of an empty state during the initial fetch.
  useEffect(() => {
    Promise.all([tasksStore.refresh(), workflowsStore.refresh()]).finally(() => setBooting(false))
  }, [])

  const builderView = canViewReports(user)
  const firstName = (user?.name || 'there').split(' ')[0]

  // Shape the raw activity response into what MultiLineChart expects.
  const activitySeries = useMemo(
    () => activityRaw.map((row) => ({
      label: fmtDayLabel(row.isoDate),
      completed: row.completed ?? 0,
      inProgress: row.inProgress ?? 0,
      onHold: row.onHold ?? 0,
      failed: row.failed ?? 0,
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

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = today.getHours()
  const greetingText = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell
      title="Dashboard"
      mainClass="flex-1 p-4 md:p-6 pb-24 md:pb-6 space-y-5 overflow-y-auto bg-[#e2e8f0] dark:bg-[#0b1120]"
    >
      <div className="space-y-5 w-full">
        <div className="bg-white dark:bg-[#111a2e] border border-slate-100/80 dark:border-white/10 rounded-[20px] px-7 py-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] font-extrabold text-[#0f172a] dark:text-white tracking-tight leading-none">
                Welcome back, {firstName}
              </h1>
              <span className="px-2.5 py-1 text-[10px] font-bold bg-[#eff4ff] text-[#2563eb] dark:bg-blue-500/10 dark:text-blue-400 rounded-full">
                Employee
              </span>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-2">
              {greetingText} · {dateStr} — {user?.department || 'Department'} overview — here's what's happening in your department.
            </p>
          </div>
        </div>
        {statsError && (
          <div className="shrink-0">
            <AlertBanner tone="warning" onRetry={() => setStatsReloadKey((k) => k + 1)}>
              {statsError}
            </AlertBanner>
          </div>
        )}

        <div className="shrink-0">
          <TopStats summary={summary} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-[18rem] mb-4">
            <div className="xl:col-span-2 min-h-[16rem] flex flex-col">
              <WorkflowActivityCard
                series={activitySeries}
                days={chartDays}
                onDaysChange={setChartDays}
                loading={activityLoading}
              />
            </div>
            <div className="xl:col-span-1 min-h-[16rem] flex flex-col">
              <RecentRequests tasks={tasks} loading={booting} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pb-1">
            <TasksOverviewCard tasks={tasks} />
            <ApprovalRateCard approvalRate={approvalRate} />
            <CompletionTimeCard avgDays={avgDays} />
            <ActiveWorkflowsCard workflows={workflows} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// ---------- employee dashboard --------------------------------------------

// A single workflow run (one "request") produces one Task per approval step,
// all sharing a workflowExecutionId. Group them so each request counts once and
// derives one overall status + progress.
function groupRequests(tasks, myId) {
  const mine = tasks.filter((t) => (myId ? t.submittedById === myId : true))
  const byExec = new Map()
  for (const t of mine) {
    const key = t._raw?.workflowExecutionId ? String(t._raw.workflowExecutionId) : t.id
    if (!byExec.has(key)) byExec.set(key, [])
    byExec.get(key).push(t)
  }

  const requests = []
  for (const [key, group] of byExec) {
    const sorted = [...group].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    // The /my-tasks endpoint attaches the same execution-wide approval chain to
    // every task in the group, so any non-empty one describes the whole request.
    const chain = sorted.find((t) => (t.approvalChain || []).length > 0)?.approvalChain || []

    let status
    let progress
    if (chain.length > 0) {
      const approved = chain.filter((s) => s.status === 'approved').length
      if (chain.some((s) => s.status === 'rejected')) { status = 'Rejected'; progress = 100 }
      else if (approved === chain.length) { status = 'Approved'; progress = 100 }
      else if (approved > 0) { status = 'In Review'; progress = Math.round((approved / chain.length) * 100) }
      else { status = 'Pending'; progress = 0 }
    } else {
      const statuses = sorted.map((t) => t.status)
      const approvedCount = statuses.filter((s) => s === 'Approved').length
      if (statuses.includes('Rejected')) status = 'Rejected'
      else if (statuses.includes('Pending') || statuses.includes('Escalated')) status = approvedCount > 0 ? 'In Review' : 'Pending'
      else if (approvedCount > 0) status = 'Approved'
      else status = 'Pending'
      progress = status === 'Approved' ? 100 : status === 'Rejected' ? 100 : status === 'In Review' ? 60 : 25
    }

    const isExec = !!first._raw?.workflowExecutionId
    const refId = `${isExec ? 'EX' : 'REQ'}-${String(key).slice(-6).toUpperCase()}`

    requests.push({
      key,
      title: (first.title || 'Request').replace(/\s*—\s*Approval Required\s*$/i, ''),
      category: first.department || first.workflow || 'Request',
      createdAt: first.createdAt,
      latestAt: last.createdAt || first.createdAt,
      status,
      progress,
      chain,
      refId,
      latestTaskId: last.id,
    })
  }
  return requests.sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0))
}

const barColor = (status) => ({
  Approved: 'bg-success-solid',
  'In Review': 'bg-info-solid',
  Pending: 'bg-warning-solid',
  Rejected: 'bg-danger-solid',
}[status] || 'bg-fg-subtle')

const ACTIVITY_VERB = {
  Approved: 'was approved',
  Rejected: 'was rejected',
  'In Review': 'is under review',
  Pending: 'was submitted',
}

const EmployeeStatCard = ({ title, value, subtitle, icon, tone = 'indigo', valueColor, onClick }) => {
  const toneMap = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100/80 dark:border-indigo-800/50',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100/80 dark:border-blue-800/50',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-100/80 dark:border-amber-800/50',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-800/50',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-100/80 dark:border-rose-800/50',
  }
  const toneClass = toneMap[tone] || toneMap.indigo

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`bg-white dark:bg-[#111a2e] rounded-3xl p-4 sm:p-5 shadow-2xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between transition w-full min-w-0 min-h-[145px] ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${toneClass}`}>
          {React.isValidElement(icon) ? React.cloneElement(icon, { className: 'w-5 h-5' }) : icon}
        </div>
      </div>
      <div className="mt-2.5">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">
          {title}
        </div>
        <div className={`text-2xl font-black tracking-tight mt-1 ${valueColor || 'text-slate-900 dark:text-white'}`}>
          {value}
        </div>
        <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 mt-1 leading-tight">
          {subtitle}
        </div>
      </div>
    </div>
  )
}

// Top 5 stat cards for an employee — all from their own requests.
function EmployeeStats({ requests, needsAttention, loading }) {
  const navigate = useNavigate()
  const now = new Date()
  const isThisMonth = (iso) => {
    if (!iso) return false
    const d = new Date(iso)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  const total = requests.length
  const submitted = requests.filter((r) => isThisMonth(r.createdAt)).length
  const pending = requests.filter((r) => r.status === 'Pending' || r.status === 'In Review').length
  const approved = requests.filter((r) => r.status === 'Approved').length

  const cards = [
    { title: 'My Requests', value: total, subtitle: 'Total submitted', icon: <IconDoc className="w-5 h-5" />, tone: 'indigo', onClick: () => navigate('/tasks?scope=submitted&filter=All tasks') },
    { title: 'Submitted (mo.)', value: submitted, subtitle: 'In current month', icon: <IconSend className="w-5 h-5" />, tone: 'blue', onClick: () => navigate('/tasks?scope=submitted&filter=All tasks') },
    { title: 'Pending', value: pending, subtitle: 'Awaiting action', icon: <IconClock className="w-5 h-5" />, tone: 'amber', onClick: () => navigate('/tasks?scope=submitted&filter=Pending') },
    { title: 'Approved', value: approved, subtitle: 'Approved vs decided', icon: <IconCheck className="w-5 h-5" />, tone: 'emerald', valueColor: 'text-emerald-700 dark:text-emerald-400', onClick: () => navigate('/tasks?scope=submitted&filter=Approved') },
    { title: 'Needs Attention', value: needsAttention, subtitle: 'In selected range', icon: <IconAlert className="w-5 h-5" />, tone: 'rose', valueColor: 'text-rose-600 dark:text-rose-400', onClick: () => navigate('/tasks?scope=submitted&filter=Pending') },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4 w-full">
      {loading && requests.length === 0
        ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        : cards.map((c) => <EmployeeStatCard key={c.title} {...c} />)}
    </div>
  )
}

function MyRequestsList({ requests, loading }) {
  const navigate = useNavigate()
  const rows = requests.slice(0, 6)
  return (
    <div className="bg-surface border border-line rounded-xl flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between border-b border-line">
        <h2 className="text-sm font-semibold text-fg">My Requests</h2>
        <Link to="/tasks" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
      </div>
      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => <li key={i}><ListRowSkeleton /></li>)}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          className="flex-1"
          title="No requests yet"
          description="Fill out a form to submit your first request — it'll show up here."
          action={
            <Link to="/forms" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition">
              Browse forms
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const styles = statusBadge(r.status)
            return (
              <li key={r.key}>
                <button onClick={() => navigate(`/tasks/${r.latestTaskId}`)}
                  className="w-full text-left px-5 py-3 hover:bg-surface-2 transition flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-fg truncate">{r.title}</p>
                    <p className="text-[10px] text-fg-subtle truncate mt-0.5">{r.refId} · {timeAgo(r.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles.badge}`}>{r.status}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function MyProgressCard({ requests, loading }) {
  const rows = requests.slice(0, 5)
  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <h2 className="text-sm font-semibold text-fg mb-4">My Request Progress</h2>
      {loading && rows.length === 0 ? (
        <div className="space-y-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-fg-subtle">Nothing in progress</div>
      ) : (
        <ul className="space-y-3.5">
          {rows.map((r) => {
            const styles = statusBadge(r.status)
            return (
              <li key={r.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-fg truncate pr-2">{r.title}</span>
                  <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles.badge}`}>{r.status}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(r.status)}`} style={{ width: `${r.progress}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Visual treatment for a single approval-chain node's status.
function statusVisual(s) {
  switch (s) {
    case 'approved': return { ring: 'bg-success-solid border-success-solid text-white', icon: 'check' }
    case 'rejected': return { ring: 'bg-danger-solid border-danger-solid text-white', icon: 'x' }
    case 'escalated': return { ring: 'bg-orange-500 border-orange-500 text-white', icon: 'up' }
    case 'pending': return { ring: 'bg-info-solid border-info-solid text-white', icon: 'dot' }
    default: return { ring: 'bg-surface border-line text-fg-subtle', icon: 'dot' }
  }
}

function StepIcon({ kind }) {
  const cls = 'w-2.5 h-2.5'
  if (kind === 'check') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
  if (kind === 'x') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
  if (kind === 'up') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" /></svg>
  return <span className="w-1.5 h-1.5 rounded-full bg-current" />
}

function TrackStatusSelect({ requests, active, onSelect }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return requests
    return requests.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.refId && r.refId.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q))
    )
  }, [requests, search])

  return (
    <div className="relative mb-4" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setSearch('')
        }}
        className="w-full flex items-center justify-between text-left text-xs border border-line rounded-lg px-3 py-2 text-fg bg-surface hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition cursor-pointer"
      >
        <span className="truncate font-medium">
          {active ? `${active.title} · ${active.refId}` : 'Select a request'}
        </span>
        <svg
          className={`w-4 h-4 text-fg-subtle shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Searchable Dropdown Popover */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-line rounded-xl shadow-xl overflow-hidden animate-fade-in">
          {/* Search Input Box */}
          <div className="p-2 border-b border-line bg-surface-2/60">
            <div className="relative flex items-center">
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 text-fg-subtle pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search requests by name or ID..."
                className="w-full pl-8 pr-6 py-1.5 text-xs rounded-lg border border-line bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-xs text-fg-subtle hover:text-fg cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto py-1 thin-scrollbar">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-xs text-fg-subtle">No matching requests</p>
            ) : (
              filtered.map((r) => {
                const isSelected = r.key === active?.key
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      onSelect(r.key)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer ${isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 font-semibold'
                        : 'text-fg hover:bg-surface-2'
                      }`}
                  >
                    <span className="truncate pr-2">{r.title} · {r.refId}</span>
                    {isSelected && (
                      <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Track Status — renders the live approval chain for a selected request.
function TrackStatusCard({ requests }) {
  const navigate = useNavigate()
  const [selectedKey, setSelectedKey] = useState(null)

  const defaultReq = useMemo(
    () => requests.find((r) => r.status === 'In Review' || r.status === 'Pending') || requests[0] || null,
    [requests]
  )
  const active = requests.find((r) => r.key === selectedKey) || defaultReq

  const steps = useMemo(() => {
    if (!active) return []
    const out = [{
      key: 'submitted',
      title: 'Request submitted',
      sub: timeAgo(active.createdAt),
      vis: { ring: 'bg-indigo-500 border-indigo-500 text-white', icon: 'check' },
    }]
    for (const s of active.chain || []) {
      const norm = s.isCurrent && s.status !== 'approved' && s.status !== 'rejected' ? 'pending' : s.status
      let sub
      if (s.status === 'approved') sub = s.decidedBy ? `Approved by ${s.decidedBy}` : 'Approved'
      else if (s.status === 'rejected') sub = s.decidedBy ? `Rejected by ${s.decidedBy}` : 'Rejected'
      else if (s.status === 'escalated') sub = 'Escalated'
      else if (norm === 'pending') sub = `Awaiting ${s.assignee || s.roleLabel || 'approval'}`
      else sub = s.roleLabel ? `${s.roleLabel} · upcoming` : 'Upcoming'
      out.push({ key: s.nodeId, title: s.title || s.roleLabel || 'Approval', sub, vis: statusVisual(norm), current: s.isCurrent })
    }
    if (active.status === 'Approved') {
      out.push({ key: 'done', title: 'Completed', sub: timeAgo(active.latestAt), vis: { ring: 'bg-success-solid border-success-solid text-white', icon: 'check' } })
    }
    return out
  }, [active])

  if (!active) {
    return (
      <div className="bg-surface border border-line rounded-xl p-5 flex flex-col">
        <h2 className="text-sm font-semibold text-fg mb-4">Track Status</h2>
        <EmptyState
          className="flex-1"
          title="Nothing to track yet"
          description="Submit a request to follow its approval progress here."
          action={
            <Link to="/forms" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition">
              Browse forms
            </Link>
          }
        />
      </div>
    )
  }

  const styles = statusBadge(active.status)

  return (
    <div className="bg-surface border border-line rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-fg">Track Status</h2>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${styles.badge}`}>{active.status}</span>
      </div>

      {requests.length > 1 && (
        <TrackStatusSelect
          requests={requests}
          active={active}
          onSelect={(key) => setSelectedKey(key)}
        />
      )}

      <ol className="flex-1">
        {steps.map((st, i) => (
          <li key={st.key} className="relative pl-7 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[8px] top-5 bottom-0 w-px bg-line" />}
            <span className={`absolute left-0 top-0.5 w-[18px] h-[18px] rounded-full border flex items-center justify-center ${st.vis.ring} ${st.current ? 'ring-2 ring-blue-100' : ''}`}>
              <StepIcon kind={st.vis.icon} />
            </span>
            <p className="text-xs font-medium text-fg leading-tight">{st.title}</p>
            <p className="text-[10px] text-fg-subtle mt-0.5">{st.sub}</p>
          </li>
        ))}
      </ol>

      <button onClick={() => navigate(`/tasks/${active.latestTaskId}`)}
        className="mt-2 w-full py-2 rounded-lg border border-line text-xs font-medium text-fg-muted hover:bg-surface-2 transition">
        View details
      </button>
    </div>
  )
}

function RecentActivityCard({ requests }) {
  const items = requests.slice(0, 5)
  return (
    <div className="bg-white dark:bg-[#111a2e] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between h-full">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h2>
        {items.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Your recent requests and approvals will appear here."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((r) => {
              const styles = statusBadge(r.status)
              return (
                <li key={r.key} className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${styles.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
                      <span className="font-semibold text-slate-900 dark:text-white">{r.title}</span> {ACTIVITY_VERB[r.status] || 'updated'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(r.latestAt)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function RequestSummaryCard({ requests }) {
  const navigate = useNavigate()
  const segs = useMemo(() => ([
    { label: 'Approved', value: requests.filter((r) => r.status === 'Approved').length, color: '#22c55e' },
    { label: 'In Review', value: requests.filter((r) => r.status === 'In Review').length, color: '#3b82f6' },
    { label: 'Pending', value: requests.filter((r) => r.status === 'Pending').length, color: '#f59e0b' },
    { label: 'Rejected', value: requests.filter((r) => r.status === 'Rejected').length, color: '#ef4444' },
  ]), [requests])
  const total = segs.reduce((s, x) => s + x.value, 0)
  const approvalRate = total > 0 ? Math.round((segs[0].value / total) * 100) : 0
  const inProgress = segs[1].value + segs[2].value

  return (
    <div className="bg-white dark:bg-[#111a2e] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Request Summary</h2>
          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-800/40">
            {total} Total
          </span>
        </div>

        {/* Donut Chart and Legend */}
        <div className="flex items-center gap-4 bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
          <DonutChart segments={segs} total={total} />
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 flex-1 min-w-0">
            {segs.map((s) => (
              <li key={s.label} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                </div>
                <span className="font-extrabold text-slate-900 dark:text-white shrink-0 ml-2">
                  {s.value} <span className="text-[10px] text-slate-400 font-semibold">{total > 0 ? `(${Math.round((s.value / total) * 100)}%)` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Operational Metrics — Fills the Card Systematically */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100/80 dark:border-emerald-900/40 rounded-2xl p-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Approval Rate
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              {approvalRate}%
            </span>
          </div>
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100/80 dark:border-blue-900/40 rounded-2xl p-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              In Progress
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              {inProgress} active
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/tasks')}
        className="mt-4 w-full py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
      >
        View all requests →
      </button>
    </div>
  )
}

function NeedsAttentionCard({ rejected, approvals }) {
  const navigate = useNavigate()
  const items = [
    ...rejected.map((r) => ({ key: `r-${r.key}`, title: r.title, note: 'Rejected — needs revisit', taskId: r.latestTaskId, tone: 'rose' })),
    ...approvals.map((t) => ({ key: `a-${t.id}`, title: (t.title || 'Task').replace(/\s*—\s*Approval Required\s*$/i, ''), note: 'Awaiting your approval', taskId: t.id, tone: 'amber' })),
  ]
  return (
    <div className="bg-white dark:bg-[#111a2e] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col justify-between h-full">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Needs Your Attention</h2>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <IconCheck className="w-6 h-6 text-emerald-500 mb-2" />
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">You're all caught up</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 5).map((it) => (
              <li key={it.key}>
                <button onClick={() => navigate(`/tasks/${it.taskId}`)}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${it.tone === 'rose' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{it.title}</p>
                    <p className={`text-[10px] font-medium mt-0.5 ${it.tone === 'rose' ? 'text-rose-500' : 'text-amber-500'}`}>{it.note}</p>
                  </div>
                  <span className="text-slate-400 text-xs">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function EmployeeDashboard({ user }) {
  const tasks = useTasks()
  const myId = user?._id || user?.id || null
  const firstName = (user?.name || 'there').split(' ')[0]

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = today.getHours()
  const greetingText = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const requests = useMemo(() => groupRequests(tasks, myId), [tasks, myId])
  const myApprovals = useMemo(
    () => tasks.filter((t) => myId && t.assignedToId === myId && (t.status === 'Pending' || t.status === 'Escalated')),
    [tasks, myId]
  )
  const rejected = useMemo(() => requests.filter((r) => r.status === 'Rejected'), [requests])
  const needsAttention = rejected.length + myApprovals.length

  const [booting, setBooting] = useState(true)
  useEffect(() => { tasksStore.refresh().finally(() => setBooting(false)) }, [])

  return (
    <AppShell
      title="Dashboard"
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 bg-[#e2e8f0] dark:bg-[#0b1120] overflow-hidden"
    >
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {/* ── 1. Header Bar ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A2340] dark:text-white tracking-tight">
                Welcome back, {firstName}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#eef2ff] text-[#4f46e5] border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs">
                Employee
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 mt-2 leading-relaxed bg-slate-100/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 inline-block shadow-2xs">
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{greetingText} · {dateStr}</span> — Personal dashboard — your requests and anything that needs attention.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <Link
              to="/forms"
              className="px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <span className="text-sm font-bold">+</span> Start a request
            </Link>
          </div>
        </div>

        <EmployeeStats requests={requests} needsAttention={needsAttention} loading={booting} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <MyRequestsList requests={requests} loading={booting} />
          <MyProgressCard requests={requests} loading={booting} />
          <TrackStatusCard requests={requests} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 pb-1">
          <RecentActivityCard requests={requests} />
          <RequestSummaryCard requests={requests} />
          <NeedsAttentionCard rejected={rejected} approvals={myApprovals} />
        </div>
      </div>
    </AppShell>
  )
}

// ---------- more inline icons ---------------------------------------------

function IconDoc(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l4 4v11a2 2 0 01-2 2z" /></svg> }
function IconSend(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg> }
function IconAlert(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg> }

// ---------- role-routed page ----------------------------------------------

// One page, four shells: the platform overview, the builder view an Org Admin
// needs, the approvals-first view a leader needs, and the employee's own
// requests.
function Dashboard() {
  const user = useUser()
  if (isSuperAdmin(user)) return <PlatformOverview />
  if (isOpsLeader(user)) return <OpsDashboard />
  return canViewReports(user) ? <AdminDashboard /> : <EmployeeDashboard user={user} />
}

export default Dashboard

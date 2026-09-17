// M3 - Phase 2 - Analytics.jsx - Live from /api/analytics/*

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useDepartmentNames } from '../lib/departmentsStore'
import { Skeleton } from '../components/Skeleton'
import { AlertBanner } from '../components/Alert'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// `days` drives the from/to window for the summary / approval / department
// endpoints; `months` and `weeks` set the granularity for the two time-series
// endpoints (which take their own params).
const RANGES = [
  { label: 'Last 7 days',  days: 7,   months: 1,  weeks: 1  },
  { label: 'Last 30 days', days: 30,  months: 1,  weeks: 4  },
  { label: 'Last 90 days', days: 90,  months: 3,  weeks: 13 },
  { label: 'This year',    days: 365, months: 12, weeks: 52 },
  { label: 'Custom date range', isCustom: true }
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PALETTE = [
  'bg-blue-500', 'bg-green-500', 'bg-orange-400', 'bg-red-500',
  'bg-purple-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500'
]

const OUTCOME_COLOURS = {
  approved:  '#22c55e',
  rejected:  '#ef4444',
  escalated: '#f97316',
  pending:   '#94a3b8',
  completed: '#0ea5e9'
}

const STATUS_ORDER = { approved: 0, completed: 1, pending: 2, escalated: 3, rejected: 4 }

const selectCls =
  'text-sm px-3 py-2 rounded-lg border border-line bg-surface text-fg hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition'

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`h-full bg-surface border border-line rounded-xl shadow-sm flex flex-col min-h-0 overflow-hidden ${className}`}>
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-line/80">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p> : null}
      </div>
      <div className="flex-1 min-h-0 p-5 overflow-auto">
        {children}
      </div>
    </section>
  )
}

function KpiCard({ label, value, hint, loading, icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400',
    success: 'bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400',
    danger: 'bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400',
  }
  const t = tones[tone] || tones.neutral
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t}`}>
        {icon ? React.cloneElement(icon, { className: 'w-4.5 h-4.5' }) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {loading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight tabular-nums">
              {value}
            </span>
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
            {label}
          </span>
        </div>
        {hint ? (
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ChartSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}

function EmptyChart({ message }) {
  return (
    <div className="h-full min-h-[8rem] flex flex-col items-center justify-center text-center px-4">
      <div className="w-10 h-10 rounded-full bg-surface-3 text-fg-subtle flex items-center justify-center mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 3 3 5-6" />
        </svg>
      </div>
      <p className="text-sm text-fg-muted max-w-xs">{message}</p>
    </div>
  )
}

function HorizontalBar({ label, value, suffix = '', pct, color, valueWidth = 'w-10' }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300 text-left truncate" title={label}>
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-[#E2E8F0] dark:bg-slate-700/90 overflow-hidden border border-slate-300/80 dark:border-slate-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
        <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className={`${valueWidth} shrink-0 text-xs font-bold text-slate-900 dark:text-white text-right tabular-nums`}>
        {value}{suffix}
      </span>
    </div>
  )
}

function CompletionTimeChart({ data, loading }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.hours)), [data])
  return (
    <Panel title="Avg completion time" subtitle="Hours to finish, by month">
      {loading ? (
        <ChartSkeleton />
      ) : data.length === 0 ? (
        <EmptyChart message="No completed workflows yet — timing appears once runs finish." />
      ) : (
        <div className="space-y-3.5">
          {data.map((d, i) => (
            <HorizontalBar
              key={d.month}
              label={d.month}
              value={d.hours.toFixed(1)}
              suffix="h"
              pct={(d.hours / max) * 100}
              color={PALETTE[i % PALETTE.length]}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

function OutcomeDonut({ outcomes }) {
  let offset = 0
  const total = outcomes.reduce((s, o) => s + o.pct, 0) || 1
  const lead = outcomes[0]?.pct?.toFixed(0) || 0
  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-surface-3)" strokeWidth="3.5" />
        {outcomes.map((o, i) => {
          const pct = (o.pct / total) * 100
          const dashArray = `${pct} ${100 - pct}`
          const dashOffset = -offset
          offset += pct
          return (
            <circle
              key={i}
              cx="18" cy="18" r="15.9155"
              fill="none" stroke={o.color} strokeWidth="3.5"
              strokeDasharray={dashArray} strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-fg tabular-nums leading-none">{lead}%</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          {outcomes[0]?.label || 'Lead'}
        </span>
      </div>
    </div>
  )
}

function OutcomeBreakdown({ outcomes, departments, loading }) {
  return (
    <Panel title="Approval outcomes" subtitle="How requests were decided">
      {loading ? (
        <ChartSkeleton rows={5} />
      ) : outcomes.length === 0 ? (
        <EmptyChart message="No outcome data yet — results appear once requests are decided." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-6">
            <OutcomeDonut outcomes={outcomes} />
            <ul className="space-y-2 text-sm min-w-[10rem]">
              {outcomes.map((o) => (
                <li key={o.label} className="flex items-center gap-2.5 text-fg">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                  <span className="text-fg-muted">{o.label}</span>
                  <span className="ml-auto font-semibold tabular-nums">{o.pct.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>

          {departments.length > 0 && (
            <div className="mt-6 pt-5 border-t border-line space-y-2.5">
              <p className="text-[11px] font-semibold tracking-wider text-fg-subtle uppercase mb-3">
                Approval rate by department
              </p>
              {departments.map((d, i) => (
                <HorizontalBar
                  key={d.name}
                  label={d.name}
                  value={d.pct.toFixed(0)}
                  suffix="%"
                  pct={d.pct}
                  color={PALETTE[i % PALETTE.length]}
                  valueWidth="w-10"
                />
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

function SlaBreachTrend({ data, loading }) {
  const max = useMemo(() => Math.max(1, ...data.map((s) => s.value)), [data])
  return (
    <Panel title="SLA breach trend" subtitle="Breaches by week in the selected range" className="min-h-[14rem]">
      {loading ? (
        <div className="flex items-end gap-3 h-28" aria-hidden="true">
          {[40, 70, 50, 90, 55, 65].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-md bg-surface-3 animate-pulse"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyChart message="No SLA breaches in this period — keep it that way." />
      ) : (
        <div className="grid gap-4 h-full min-h-[7rem] items-end" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((s) => {
            const opacity = 0.45 + (s.value / max) * 0.55
            const height = Math.max(6, (s.value / max) * 100)
            return (
              <div key={s.week} className="flex flex-col items-center justify-end h-full">
                <span className="text-xs font-semibold text-fg mb-2 tabular-nums">{s.value}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-md bg-danger-solid"
                    style={{ opacity, height: `${height}%`, minHeight: '6px' }}
                  />
                </div>
                <span className="text-[11px] text-fg-subtle mt-2">{s.week}</span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function ExportMenu({ onCsv, onXlsx, onPdf, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const pick = (fn) => () => { fn(); setOpen(false) }
  const item = 'w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 cursor-pointer transition'

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition disabled:opacity-50 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <span>Export</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label="Export format" className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-lg z-20 py-1.5 overflow-hidden">
          <button type="button" role="menuitem" className={item} onClick={pick(onCsv)}>CSV (.csv)</button>
          <button type="button" role="menuitem" className={item} onClick={pick(onXlsx)}>Excel (.xlsx)</button>
          <button type="button" role="menuitem" className={item} onClick={pick(onPdf)}>PDF (.pdf)</button>
        </div>
      )}
    </div>
  )
}

function IconClock(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}

function IconCheck(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconAlert(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm9-4.5a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function Analytics() {
  const [range, setRange] = useState(RANGES[1])
  const [department, setDepartment] = useState('')
  const orgDepartments = useDepartmentNames()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const thirtyDaysAgoStr = useMemo(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), [])
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr)
  const [endDate, setEndDate] = useState(todayStr)

  // What the API actually counted. A leader only ever sees their own people, so
  // saying "whole workspace" over their numbers would be a lie.
  const [scope, setScope] = useState(null)
  const [completion, setCompletion] = useState([])
  const [outcomes, setOutcomes] = useState([])
  const [departments, setDepartments] = useState([])
  const [slaTrend, setSlaTrend] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    const iso = (d) => d.toISOString().slice(0, 10)
    let fromStr = ''
    let toStr = ''
    let monthsParam = 1
    let weeksParam = 4

    if (range.isCustom) {
      fromStr = startDate || thirtyDaysAgoStr
      toStr = endDate || todayStr
      const startMs = new Date(fromStr).getTime()
      const endMs = new Date(toStr).getTime()
      const diffDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1)
      monthsParam = Math.min(24, Math.max(1, Math.ceil(diffDays / 30)))
      weeksParam = Math.min(52, Math.max(1, Math.ceil(diffDays / 7)))
    } else {
      const fromDate = new Date(Date.now() - Math.max(0, range.days - 1) * 86400000)
      fromStr = iso(fromDate)
      toStr = iso(new Date())
      monthsParam = range.months
      weeksParam = range.weeks
    }

    const dept = department ? `&department=${encodeURIComponent(department)}` : ''
    const win = `from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}${dept}`

    Promise.allSettled([
      api.get(`/api/analytics/summary?${win}`),
      api.get(`/api/analytics/completion-time?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&months=${monthsParam}${dept}`),
      api.get(`/api/analytics/approval-rate?${win}`),
      api.get(`/api/analytics/department-kpis?${win}`),
      api.get(`/api/analytics/sla-breaches?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&weeks=${weeksParam}${dept}`)
    ]).then((results) => {
      if (cancelled) return
      const [s, c, a, d, sla] = results

      if (s.status === 'fulfilled') {
        setSummary(s.value.summary || s.value)
        setScope(s.value.scope || null)
      }

      if (c.status === 'fulfilled') {
        const list = c.value.series || c.value.completionTime || c.value.data || []
        setCompletion(list.map((row) => ({
          month: (row.year && row.month) ? `${MONTHS[row.month - 1]} ${row.year}` : (row.label || row._id || 'n/a'),
          hours: row.avgDays != null ? row.avgDays * 24 : (row.avgHours ?? row.hours ?? 0)
        })))
      }

      if (a.status === 'fulfilled') {
        const breakdown = a.value.distribution || a.value.approvalRate || a.value.breakdown || a.value.data || []
        const totalCount = breakdown.reduce((sum, r) => sum + (r.count ?? 0), 0) || 1
        const mapped = breakdown.map((row) => {
          const key = (row.status || row._id || 'unknown').toLowerCase()
          return {
            label: row.label || key.replace(/\b\w/g, (ch) => ch.toUpperCase()),
            pct: row.percentage ?? row.pct ?? ((row.count ?? 0) / totalCount) * 100,
            color: row.color || OUTCOME_COLOURS[key] || '#94a3b8',
            order: STATUS_ORDER[key] ?? 99
          }
        })
        mapped.sort((x, y) => x.order - y.order)
        setOutcomes(mapped)
      }

      if (d.status === 'fulfilled') {
        const deptRows = d.value.kpis || d.value.departmentKpis || d.value.departments || d.value.data || []
        setDepartments(deptRows.map((row) => {
          const total = row.totalRequests ?? row.totalTasks ?? row.total ?? 0
          return {
            name: row.department || row._id || 'Other',
            pct: row.approvalRate ?? (total > 0 ? ((row.approved ?? 0) / total) * 100 : 0),
            totalTasks: total
          }
        }))
      }

      if (sla.status === 'fulfilled') {
        const list = sla.value.series || sla.value.slaBreaches || sla.value.data || []
        setSlaTrend(list.map((row) => (
          {
            week: row.week != null ? `W${row.week}` : (row.label ? row.label.split('-').pop() : (row._id || 'n/a')),
            value: row.breaches ?? row.count ?? row.value ?? 0
          }
        )))
      }

      const firstReject = results.find((r) => r.status === 'rejected')
      if (firstReject) {
        const e = firstReject.reason
        if (e?.status === 403) {
          setError('Analytics requires Manager role or higher.')
        } else {
          setError(e?.message || 'Failed to load analytics')
        }
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [range, startDate, endDate, department, reloadKey])

  const kpis = useMemo(() => {
    const completionAvg = completion.length
      ? (completion.reduce((s, c) => s + c.hours, 0) / completion.length).toFixed(1) + 'h'
      : '—'
    const approvalPct = summary?.approvalRate ?? outcomes.find((o) => o.label.toLowerCase() === 'approved')?.pct
    const slaTotal = slaTrend.reduce((s, x) => s + x.value, 0)
    return [
      {
        label: 'Avg completion',
        value: completionAvg,
        valueClass: 'text-fg',
        hint: 'Mean time to finish',
        icon: <IconClock className="w-5 h-5" />,
        tone: 'neutral',
      },
      {
        label: 'Approval rate',
        value: approvalPct != null ? `${Number(approvalPct).toFixed(0)}%` : '—',
        valueClass: 'text-success-fg',
        hint: 'Approved vs decided',
        icon: <IconCheck className="w-5 h-5" />,
        tone: 'success',
      },
      {
        label: 'SLA breaches',
        value: summary?.slaBreaches ?? slaTotal,
        valueClass: 'text-danger-fg',
        hint: 'In selected range',
        icon: <IconAlert className="w-5 h-5" />,
        tone: 'danger',
      },
    ]
  }, [completion, outcomes, slaTrend, summary])

  const rangeDisplay = range.isCustom ? `${startDate} to ${endDate}` : range.label

  const exportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ...kpis.map((k) => [k.label, k.value]),
      [],
      ['Month', 'Avg completion (h)'],
      ...completion.map((c) => [c.month, c.hours]),
      [],
      ['Outcome', 'Percentage'],
      ...outcomes.map((o) => [o.label, `${o.pct.toFixed(1)}%`]),
      [],
      ['Department', 'Approval rate'],
      ...departments.map((d) => [d.name, `${d.pct.toFixed(1)}%`]),
      [],
      ['Week', 'SLA breaches'],
      ...slaTrend.map((s) => [s.week, s.value])
    ]
    const csv = rows
      .map((r) =>
        r.map((cell) => {
          const str = String(cell ?? '')
          return str.includes(',') ? `"${str.replaceAll('"', '""')}"` : str
        }).join(',')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${rangeDisplay.toLowerCase().replaceAll(' ', '-')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const fileBase = `analytics-${rangeDisplay.toLowerCase().replaceAll(' ', '-')}`

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new()
    const add = (name, rows) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)

    add('Summary', [['Metric', 'Value'], ...kpis.map((k) => [k.label, k.value])])
    add('Completion', [['Month', 'Avg completion (h)'], ...completion.map((c) => [c.month, Number(c.hours.toFixed(1))])])
    add('Outcomes', [['Outcome', 'Percentage'], ...outcomes.map((o) => [o.label, Number(o.pct.toFixed(1))])])
    if (departments.length) {
      add('Departments', [['Department', 'Approval rate (%)'], ...departments.map((d) => [d.name, Number(d.pct.toFixed(1))])])
    }
    if (slaTrend.length) {
      add('SLA Breaches', [['Week', 'Breaches'], ...slaTrend.map((s) => [s.week, s.value])])
    }
    XLSX.writeFile(wb, `${fileBase}.xlsx`)
  }

  const exportPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('NetFlow — Analytics Report', 14, 18)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`Range: ${rangeDisplay}     Generated: ${new Date().toLocaleString()}`, 14, 25)
    doc.setTextColor(0)

    const section = (head, body, fillColor) => {
      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 30) + 8,
        head: [head],
        body,
        styles: { fontSize: 9 },
        headStyles: { fillColor },
      })
    }

    section(['Metric', 'Value'], kpis.map((k) => [k.label, String(k.value)]), [99, 102, 241])
    section(['Month', 'Avg completion (h)'], completion.map((c) => [c.month, c.hours.toFixed(1)]), [59, 130, 246])
    section(['Outcome', 'Percentage'], outcomes.map((o) => [o.label, `${o.pct.toFixed(1)}%`]), [34, 197, 94])
    if (departments.length) {
      section(['Department', 'Approval rate'], departments.map((d) => [d.name, `${d.pct.toFixed(1)}%`]), [139, 92, 246])
    }
    if (slaTrend.length) {
      section(['Week', 'SLA breaches'], slaTrend.map((s) => [s.week, String(s.value)]), [239, 68, 68])
    }
    doc.save(`${fileBase}.pdf`)
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
      {scope?.reach !== 'team' && (
        <div className="relative shrink-0">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Filter by department"
            className="appearance-none h-10 pl-4 pr-8.5 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition cursor-pointer"
          >
            <option value="">All departments</option>
            {orgDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <svg
            className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      )}

      <div className="relative shrink-0">
        <select
          value={range.label}
          onChange={(e) => setRange(RANGES.find((r) => r.label === e.target.value) || RANGES[1])}
          aria-label="Date range"
          className="appearance-none h-10 pl-4 pr-8.5 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition cursor-pointer"
        >
          {RANGES.map((r) => <option key={r.label}>{r.label}</option>)}
        </select>
        <svg
          className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {range.isCustom && (
        <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in duration-200">
          <input
            type="date"
            value={startDate}
            max={endDate || todayStr}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
            className="h-10 px-3 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition cursor-pointer"
          />
          <span className="text-xs text-slate-400 font-bold px-0.5">to</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayStr}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            className="h-10 px-3 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition cursor-pointer"
          />
        </div>
      )}

      <ExportMenu
        onCsv={exportCsv}
        onXlsx={exportXlsx}
        onPdf={exportPdf}
        disabled={loading}
      />
    </div>
  )

  const scopeNote = department
    ? `${department} · ${rangeDisplay}`
    : scope?.reach === 'team'
      ? `Your team · ${rangeDisplay}`
      : `Whole workspace · ${rangeDisplay}`

  return (
    <AppShell
      title="Analytics & reports"
      subtitle={scopeNote}
      actions={actions}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 bg-[#e2e8f0] dark:bg-[#0b1120] overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 w-full overflow-hidden">
        {error && (
          <div className="shrink-0">
            <AlertBanner onRetry={() => setReloadKey((k) => k + 1)}>{error}</AlertBanner>
          </div>
        )}

        {/* Top Summary Cards */}
        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} loading={loading} />
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 min-h-full">
            <div className="xl:col-span-3 min-h-[16rem] flex flex-col">
              <CompletionTimeChart data={completion} loading={loading} />
            </div>
            <div className="xl:col-span-2 min-h-[16rem] flex flex-col">
              <OutcomeBreakdown outcomes={outcomes} departments={departments} loading={loading} />
            </div>
            <div className="xl:col-span-5 min-h-[14rem] flex flex-col">
              <SlaBreachTrend data={slaTrend} loading={loading} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default Analytics

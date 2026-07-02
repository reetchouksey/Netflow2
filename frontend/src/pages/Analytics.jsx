// M3 - Phase 2 - Analytics.jsx - Live from /api/analytics/*

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
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
  { label: 'This year',    days: 365, months: 12, weeks: 52 }
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PALETTE = [
  'bg-blue-500', 'bg-green-500', 'bg-orange-400', 'bg-red-500',
  'bg-purple-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-pink-500'
]

const OUTCOME_COLOURS = {
  approved:  '#22c55e',
  rejected:  '#ef4444',
  escalated: '#f97316',
  pending:   '#94a3b8',
  completed: '#0ea5e9'
}

// Stable, sensible ordering for the outcome donut + legend.
const STATUS_ORDER = { approved: 0, completed: 1, pending: 2, escalated: 3, rejected: 4 }

function KpiCard({ label, value, valueClass, loading }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-5 py-4">
      <p className="text-[11px] font-semibold tracking-wider text-gray-400">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${valueClass}`}>
        {loading ? '...' : value}
      </p>
    </div>
  )
}

function HorizontalBar({ label, value, suffix = '', pct, color, valueWidth = 'w-12' }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-600 text-right truncate">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className={`${valueWidth} shrink-0 text-xs text-gray-500 text-right tabular-nums`}>
        {value}{suffix}
      </span>
    </div>
  )
}

function CompletionTimeChart({ data, loading }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.hours)), [data])
  return (
    <section className="bg-white border border-gray-200 rounded-lg px-5 py-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">Avg completion time by month</h2>
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400">No completed workflows yet.</p>
      ) : (
        <div className="space-y-3">
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
    </section>
  )
}

function OutcomeDonut({ outcomes }) {
  let offset = 0
  const total = outcomes.reduce((s, o) => s + o.pct, 0) || 1
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
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
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-semibold text-gray-800">
          {outcomes[0]?.pct?.toFixed(0) || 0}%
        </span>
      </div>
    </div>
  )
}

function OutcomeBreakdown({ outcomes, departments, loading }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg px-5 py-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">Approval outcome breakdown</h2>
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : outcomes.length === 0 ? (
        <p className="text-sm text-gray-400">No outcome data yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-6">
            <OutcomeDonut outcomes={outcomes} />
            <ul className="space-y-1.5 text-sm">
              {outcomes.map((o) => (
                <li key={o.label} className="flex items-center gap-2 text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                  <span>{o.label} — <span className="font-medium">{o.pct.toFixed(0)}%</span></span>
                </li>
              ))}
            </ul>
          </div>

          {departments.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Approval rate by department</p>
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
    </section>
  )
}

function SlaBreachTrend({ data, loading }) {
  const max = useMemo(() => Math.max(1, ...data.map((s) => s.value)), [data])
  return (
    <section className="bg-white border border-gray-200 rounded-lg px-5 py-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-6">SLA breach trend</h2>
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400">No SLA breach data.</p>
      ) : (
        <div className={`grid gap-6 grid-cols-${Math.min(data.length, 8)}`} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((s) => {
            const opacity = 0.45 + (s.value / max) * 0.55
            const height = Math.max(4, (s.value / max) * 80)
            return (
              <div key={s.week} className="flex flex-col items-center justify-end">
                <span className="text-xs font-medium text-gray-700 mb-2">{s.value}</span>
                <div
                  className="w-full rounded-md bg-red-500"
                  style={{ opacity, height: `${height}px` }}
                />
                <span className="text-xs text-gray-400 mt-2">{s.week}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// Small dropdown that groups the CSV / Excel / PDF export actions.
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
  const item = 'w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition disabled:opacity-50"
      >
        Export
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
          <button type="button" className={item} onClick={pick(onCsv)}>CSV (.csv)</button>
          <button type="button" className={item} onClick={pick(onXlsx)}>Excel (.xlsx)</button>
          <button type="button" className={item} onClick={pick(onPdf)}>PDF (.pdf)</button>
        </div>
      )}
    </div>
  )
}

function Analytics() {
  const [range, setRange] = useState(RANGES[1])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [completion, setCompletion] = useState([])
  const [outcomes, setOutcomes] = useState([])
  const [departments, setDepartments] = useState([])
  const [slaTrend, setSlaTrend] = useState([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    // Date window for the endpoints that accept from/to (createdAt-based).
    const iso = (d) => d.toISOString().slice(0, 10)
    const fromDate = new Date(Date.now() - Math.max(0, range.days - 1) * 86400000)
    const win = `from=${iso(fromDate)}&to=${iso(new Date())}`

    Promise.allSettled([
      api.get(`/api/analytics/summary?${win}`),
      api.get(`/api/analytics/completion-time?months=${range.months}`),
      api.get(`/api/analytics/approval-rate?${win}`),
      api.get(`/api/analytics/department-kpis?${win}`),
      api.get(`/api/analytics/sla-breaches?weeks=${range.weeks}`)
    ]).then((results) => {
      if (cancelled) return
      const [s, c, a, d, sla] = results

      if (s.status === 'fulfilled') setSummary(s.value.summary || s.value)

      // completion-time → { series: [{ year, month, label, avgDays, totalCompleted }] }
      if (c.status === 'fulfilled') {
        const list = c.value.series || c.value.completionTime || c.value.data || []
        setCompletion(list.map((row) => ({
          month: (row.year && row.month) ? `${MONTHS[row.month - 1]} ${row.year}` : (row.label || row._id || 'n/a'),
          hours: row.avgDays != null ? row.avgDays * 24 : (row.avgHours ?? row.hours ?? 0)
        })))
      }

      // approval-rate → { distribution: [{ status, label, count, color }] }; turn counts into %.
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

      // department-kpis → { kpis: [{ department, totalRequests, approved, ... }] }; derive approval rate.
      if (d.status === 'fulfilled') {
        const dept = d.value.kpis || d.value.departmentKpis || d.value.departments || d.value.data || []
        setDepartments(dept.map((row) => {
          const total = row.totalRequests ?? row.totalTasks ?? row.total ?? 0
          return {
            name: row.department || row._id || 'Other',
            pct: row.approvalRate ?? (total > 0 ? ((row.approved ?? 0) / total) * 100 : 0),
            totalTasks: total
          }
        }))
      }

      // sla-breaches → { series: [{ year, week, label, breaches, target }] }
      if (sla.status === 'fulfilled') {
        const list = sla.value.series || sla.value.slaBreaches || sla.value.data || []
        setSlaTrend(list.map((row) => ({
          week: row.week != null ? `W${row.week}` : (row.label ? row.label.split('-').pop() : (row._id || 'n/a')),
          value: row.breaches ?? row.count ?? row.value ?? 0
        })))
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
  }, [range])

  const kpis = useMemo(() => {
    const completionAvg = completion.length
      ? (completion.reduce((s, c) => s + c.hours, 0) / completion.length).toFixed(1) + 'h'
      : '—'
    // Prefer the canonical approved/(approved+rejected) rate from /summary.
    const approvalPct = summary?.approvalRate ?? outcomes.find((o) => o.label.toLowerCase() === 'approved')?.pct
    const slaTotal = slaTrend.reduce((s, x) => s + x.value, 0)
    return [
      { label: 'AVG COMPLETION TIME', value: completionAvg, valueClass: 'text-gray-800' },
      { label: 'APPROVAL RATE',       value: approvalPct != null ? `${Number(approvalPct).toFixed(0)}%` : '—', valueClass: 'text-green-600' },
      { label: 'SLA BREACHES',        value: summary?.slaBreaches ?? slaTotal, valueClass: 'text-red-500' }
    ]
  }, [completion, outcomes, slaTrend, summary])

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
    a.download = `analytics-${range.label.toLowerCase().replaceAll(' ', '-')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const fileBase = `analytics-${range.label.toLowerCase().replaceAll(' ', '-')}`

  // Real multi-sheet .xlsx — one sheet per section so it opens cleanly in Excel.
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

  // Tabular PDF report (jsPDF + autotable). autotable handles page breaks itself.
  const exportPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('NetFlow — Analytics Report', 14, 18)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`Range: ${range.label}     Generated: ${new Date().toLocaleString()}`, 14, 25)
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
    <>
      <select
        value={range.label}
        onChange={(e) => setRange(RANGES.find((r) => r.label === e.target.value) || RANGES[1])}
        className="text-sm px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
      >
        {RANGES.map((r) => <option key={r.label}>{r.label}</option>)}
      </select>
      <ExportMenu
        onCsv={exportCsv}
        onXlsx={exportXlsx}
        onPdf={exportPdf}
        disabled={loading}
      />
    </>
  )

  return (
    <AppShell title="Analytics & reports" actions={actions}>
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} loading={loading} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CompletionTimeChart data={completion} loading={loading} />
          <OutcomeBreakdown outcomes={outcomes} departments={departments} loading={loading} />
        </div>

        <SlaBreachTrend data={slaTrend} loading={loading} />
      </div>
    </AppShell>
  )
}

export default Analytics

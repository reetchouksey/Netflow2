// AI-01 - ApprovalRouting.jsx
// Visual preview for #01 Approval-Routing AI. Enter a request (submitter +
// category + amount) and see the approver chain the engine infers from the
// Delegation-of-Authority matrix + live org chart (POST /api/approval-routing/infer).
// Also shows the active DoA matrix so you can see policy and people side by side.

import React, { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser, initials } from '../utils/auth'
import { useDepartmentNames } from '../lib/departmentsStore'

const CATEGORIES = [
  { value: 'expense', label: 'Expense claim' },
  { value: 'po', label: 'Purchase Order / SOW' },
  { value: 'leave', label: 'Leave request' },
  { value: 'ANY', label: 'Other / generic' }
]

const SOURCE_BADGE = {
  llm: { label: 'AI inferred', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'llm+policy': { label: 'AI + policy floor', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  fallback: { label: 'Deterministic fallback', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  fallback_no_llm: { label: 'Deterministic (no LLM)', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
}

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700', 'bg-indigo-100 text-indigo-700'
]
const colourForName = (name) => {
  let hash = 0
  for (const c of String(name || '')) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

const money = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function ApprovalRouting() {
  const me = useUser()
  const departments = useDepartmentNames()

  const [users, setUsers] = useState([])
  const [status, setStatus] = useState(null)
  const [rules, setRules] = useState([])

  const [submitterId, setSubmitterId] = useState('')
  const [category, setCategory] = useState('expense')
  const [amount, setAmount] = useState(5000)
  const [department, setDepartment] = useState('')

  const [routing, setRouting] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/api/approval-routing/status').then((d) => { if (!cancelled) setStatus(d) }).catch(() => {})
    api.get('/api/approval-routing/doa?active=true').then((d) => { if (!cancelled) setRules(d.rules || []) }).catch(() => {})
    api.get('/api/users?limit=100').then((d) => {
      if (cancelled) return
      setUsers(d.users || [])
      if (me?._id) setSubmitterId((prev) => prev || String(me._id))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [me?._id])

  const infer = async () => {
    setLoading(true)
    setError('')
    try {
      const body = { category, amount: Number(amount) || 0 }
      if (submitterId) body.submitterId = submitterId
      if (department) body.department = department
      const data = await api.post('/api/approval-routing/infer', body)
      setRouting(data.routing)
    } catch (e) {
      setError(e.message || 'Failed to infer approver chain')
      setRouting(null)
    } finally {
      setLoading(false)
    }
  }

  const badge = routing ? (SOURCE_BADGE[routing.source] || SOURCE_BADGE.fallback) : null

  return (
    <AppShell
      title="AI Approval Routing"
      subtitle="Preview the approver chain inferred from the Delegation-of-Authority matrix + live org chart"
    >
  

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* request builder */}
        <div className="bg-surface border border-line rounded-lg p-5">
          <h2 className="text-sm font-semibold text-fg mb-4">Request</h2>

          <Field label="Submitter">
            <select value={submitterId} onChange={(e) => setSubmitterId(e.target.value)} className={inputCls}>
              <option value="">— Me ({me?.name || 'current user'}) —</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}{u.department ? ` · ${u.department}` : ''}{u.role?.name ? ` · ${u.role.name}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-fg-muted">The chain usually starts with this person's direct manager.</p>
          </Field>

          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Amount (USD)">
            <input
              type="number" min={0} value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[500, 5000, 50000].map((v) => (
                <button
                  key={v} type="button" onClick={() => setAmount(v)}
                  className={`px-2 py-1 text-[11px] rounded-md border transition ${
                    Number(amount) === v
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-line text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  {money(v)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Department (optional)">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls}>
              <option value="">Auto (from submitter)</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>

          <button
            type="button" onClick={infer} disabled={loading}
            className="mt-2 w-full py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            {loading ? 'Inferring…' : 'Infer approver chain'}
          </button>

          {error && (
            <div className="mt-3 p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
          )}
        </div>

        {/* result */}
        <div className="lg:col-span-2 bg-surface border border-line rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">Inferred approver chain</h2>
            {badge && (
              <span className={`text-[11px] font-medium px-2 py-1 rounded-full border ${badge.cls}`}>
                {badge.label}{routing.model ? ` · ${routing.model}` : ''}
              </span>
            )}
          </div>

          {!routing ? (
            <div className="py-16 text-center text-sm text-fg-subtle">
              Configure a request and click <span className="font-medium text-fg-muted">Infer approver chain</span>.
            </div>
          ) : (
            <>
              {routing.rule && (
                <div className="mb-4 text-xs text-fg-muted bg-surface-2 border border-line rounded-md px-3 py-2">
                  Matched policy: <span className="font-semibold text-fg">{routing.rule.name}</span>
                  {' · '}band {routing.rule.band}
                  {routing.rule.requiredRoles?.length ? <> · requires {routing.rule.requiredRoles.join(' → ')}</> : null}
                </div>
              )}
              {routing.summary && <p className="mb-4 text-sm text-fg">{routing.summary}</p>}

              <ol className="relative border-l-2 border-line ml-3">
                {routing.chain.map((step) => {
                  const escalated = step.requiredRole && step.role && step.requiredRole !== step.role
                  return (
                    <li key={step.order} className="mb-5 ml-5">
                      <span className="absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                        {step.order}
                      </span>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${colourForName(step.name)}`}>
                          {initials(step.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-fg">{step.name}</span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-3 text-fg-muted">{step.role}</span>
                            {step.department && <span className="text-[11px] text-fg-subtle">{step.department}</span>}
                            {escalated && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                escalated · needed {step.requiredRole}
                              </span>
                            )}
                          </div>
                          {step.email && <div className="text-[11px] text-fg-muted">{step.email}</div>}
                          {step.reason && <div className="text-xs text-fg-muted mt-0.5">{step.reason}</div>}
                          {step.slaHours != null && <div className="text-[11px] text-fg-subtle mt-0.5">SLA: {step.slaHours}h</div>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>
      </div>

      {/* DoA matrix reference */}
      <div className="mt-6 bg-surface border border-line rounded-lg">
        <div className="px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-fg">Delegation-of-Authority matrix</h2>
          
        </div>
        {rules.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-fg-subtle">No DoA rules found. Run <span className="font-mono">npm run seed:doa</span>.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle border-b border-line">
                  <th className="px-5 py-2 font-semibold">Rule</th>
                  <th className="px-5 py-2 font-semibold">Dept</th>
                  <th className="px-5 py-2 font-semibold">Category</th>
                  <th className="px-5 py-2 font-semibold">Amount band</th>
                  <th className="px-5 py-2 font-semibold">Approver chain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rules.map((r) => (
                  <tr key={r._id} className="hover:bg-surface-2">
                    <td className="px-5 py-2.5 font-medium text-fg">{r.name}</td>
                    <td className="px-5 py-2.5 text-fg-muted">{r.department}</td>
                    <td className="px-5 py-2.5 text-fg-muted">{r.category}</td>
                    <td className="px-5 py-2.5 text-fg-muted">
                      {money(r.minAmount)}{r.maxAmount == null ? '+' : ` – ${money(r.maxAmount)}`}
                    </td>
                    <td className="px-5 py-2.5 text-fg-muted">
                      {(r.approverChain || []).map((s) => s.role).join(' → ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}

const inputCls =
  'w-full px-3 py-2 text-sm bg-surface border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-fg mb-1.5">{label}</label>
      {children}
    </div>
  )
}

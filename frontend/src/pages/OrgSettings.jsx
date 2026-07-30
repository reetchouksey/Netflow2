// Shell 2 (Org Admin) — pages/OrgSettings.jsx
// The workspace's own settings. Two of them are editable — the display name and
// the billing contact — and the rest is shown read-only on purpose: the plan,
// the limits, the sign-in domain policy and the feature flags are set by the
// platform, and an admin who cannot see them ends up guessing why a save was
// refused. So the page states the rules and says who to ask to change them.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { toast } from '../lib/toastStore'
import { AlertBanner } from '../components/Alert'
import { Skeleton } from '../components/Skeleton'
import { formatDate } from '../utils/datetime'
import { useReadOnly } from '../lib/usageStore'

const fieldCls =
  'mt-1.5 w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface-2 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-surface transition disabled:opacity-60'

function Card({ title, description, icon, children, footer, className = '' }) {
  return (
    <section className={`bg-surface border border-line rounded-xl shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="shrink-0 px-5 py-4 border-b border-line bg-surface-2/40 flex items-start gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-surface-2 text-fg-muted ring-1 ring-line flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-1 px-5 py-4">{children}</div>
      {footer && (
        <div className="shrink-0 px-5 py-3 border-t border-line bg-surface-2/50 flex justify-end gap-2">
          {footer}
        </div>
      )}
    </section>
  )
}

function Row({ label, children, hint }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-3 border-b border-line last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        {hint && <p className="text-[11px] text-fg-subtle mt-0.5 max-w-sm">{hint}</p>}
      </div>
      <div className="text-sm text-fg text-right min-w-0">{children}</div>
    </div>
  )
}

function StatusCard({ label, value, hint, tone = 'neutral', icon, loading }) {
  const tones = {
    neutral: 'bg-surface-2 text-fg-muted ring-line',
    success: 'bg-success-subtle text-success-fg ring-success-line',
    danger: 'bg-danger-subtle text-danger-fg ring-danger-line',
    warning: 'bg-warning-subtle text-warning-fg ring-warning-line',
    info: 'bg-info-subtle text-info-fg ring-info-line',
  }
  const valueTone = {
    neutral: 'text-fg',
    success: 'text-success-fg',
    danger: 'text-danger-fg',
    warning: 'text-warning-fg',
    info: 'text-info-fg',
  }
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ${tones[tone] || tones.neutral}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-24 mt-1.5" />
        ) : (
          <p className={`mt-1 text-xl font-semibold tracking-tight truncate ${valueTone[tone] || valueTone.neutral}`}>
            {value}
          </p>
        )}
        {hint ? <p className="mt-0.5 text-[11px] text-fg-muted truncate">{hint}</p> : null}
      </div>
    </div>
  )
}

function FeaturePill({ on, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        on
          ? 'bg-success-subtle text-success-fg'
          : 'bg-surface-3 text-fg-muted'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-success-fg' : 'bg-fg-subtle'}`} />
      {label}: {on ? 'On' : 'Off'}
    </span>
  )
}

function IconBuilding(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}
function IconShield(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}
function IconPlan(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}
function IconAccess(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  )
}
function IconDomain(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  )
}

export default function OrgSettings() {
  const [org, setOrg] = useState(null)
  const [name, setName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const readOnly = useReadOnly()

  const apply = (o) => {
    setOrg(o)
    setName(o.name || '')
    setBillingEmail(o.billingEmail || '')
  }

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.get('/api/organization')
      apply(data.organization)
    } catch (err) {
      setError(err.message || 'Could not load the workspace settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const dirty = org && (name.trim() !== (org.name || '') || billingEmail.trim().toLowerCase() !== (org.billingEmail || ''))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await api.put('/api/organization', {
        name: name.trim(),
        billingEmail: billingEmail.trim().toLowerCase()
      })
      apply(data.organization)
      toast.success('Workspace settings saved')
    } catch (err) {
      toast.error(err.message || 'Could not save the settings')
    } finally {
      setSaving(false)
    }
  }

  const licence = org?.licence
  const statusTone = useMemo(() => {
    if (!licence) return 'neutral'
    if (licence.status === 'active') return 'success'
    if (licence.status === 'grace') return 'warning'
    return 'danger'
  }, [licence])

  const statusLabel = !licence
    ? '—'
    : licence.status === 'active'
      ? 'Active'
      : licence.status === 'grace'
        ? 'Grace period'
        : 'Expired'

  const featuresOn = useMemo(() => {
    if (!org?.features) return 0
    return ['externalUsers'].filter((k) => org.features[k]).length
  }, [org])

  const domainCount = org?.allowedDomains?.length || 0
  const deptCount = org?.departments?.length || 0

  return (
    <AppShell
      title="Organization settings"
      subtitle={loading ? 'Loading…' : `${org?.name || 'Workspace'} · ${org?.subdomain || ''}`}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 w-full overflow-hidden">
        {error && (
          <div className="shrink-0">
            <AlertBanner onRetry={load}>{error}</AlertBanner>
          </div>
        )}

        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusCard
            label="Plan"
            value={loading ? '—' : (licence?.planLabel || org?.plan || '—')}
            hint="Set by the platform team"
            loading={loading}
            tone="info"
            icon={<IconPlan className="w-5 h-5" />}
          />
          <StatusCard
            label="Licence"
            value={loading ? '—' : statusLabel}
            hint={
              loading
                ? ''
                : licence?.expiresAt
                  ? `${licence.isTrial ? 'Trial ends' : 'Renews'} ${formatDate(licence.expiresAt)}`
                  : 'Perpetual · no expiry'
            }
            loading={loading}
            tone={statusTone}
            icon={<IconShield className="w-5 h-5" />}
          />
          <StatusCard
            label="Sign-in domains"
            value={loading ? '—' : (domainCount ? `${domainCount} allowed` : 'Open')}
            hint={domainCount ? 'Invite restricted to listed domains' : 'Any email domain can be invited'}
            loading={loading}
            tone={domainCount ? 'neutral' : 'warning'}
            icon={<IconDomain className="w-5 h-5" />}
          />
          <StatusCard
            label="Optional features"
            value={loading ? '—' : `${featuresOn} of 1 on`}
            hint={`${deptCount} department${deptCount === 1 ? '' : 's'} configured`}
            loading={loading}
            tone="neutral"
            icon={<IconAccess className="w-5 h-5" />}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-3 rounded-xl border border-line bg-surface p-5 space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-2/3" />
              </div>
              <div className="xl:col-span-2 space-y-4">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            </div>
          ) : org && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 pb-2">
              <form onSubmit={save} className="xl:col-span-3 min-w-0">
                <Card
                  title="Profile"
                  description="How this workspace is named across the app and on notification emails."
                  icon={<IconBuilding className="w-[18px] h-[18px]" />}
                  className="h-full"
                  footer={
                    <>
                      <button
                        type="button"
                        onClick={() => apply(org)}
                        disabled={!dirty || saving}
                        className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-3 rounded-lg transition disabled:opacity-40"
                      >
                        Reset
                      </button>
                      <button
                        type="submit"
                        disabled={!dirty || saving || readOnly}
                        title={readOnly ? 'This workspace is read-only' : undefined}
                        className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition disabled:opacity-60"
                      >
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                    </>
                  }
                >
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-xs font-semibold text-fg-muted">Workspace name</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={80}
                        required
                        disabled={readOnly}
                        className={fieldCls}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-fg-muted">Billing contact</span>
                      <input
                        type="email"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        placeholder="finance@company.com"
                        disabled={readOnly}
                        className={fieldCls}
                      />
                      <span className="block text-[11px] text-fg-subtle mt-1.5">
                        Where renewal and usage warnings are sent.
                      </span>
                    </label>
                    <div>
                      <span className="text-xs font-semibold text-fg-muted">Workspace address</span>
                      <div className="mt-1.5 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-3 border border-line">
                        <span className="text-sm font-mono text-fg font-medium">{org.subdomain}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle ml-auto">
                          Locked
                        </span>
                      </div>
                      <span className="block text-[11px] text-fg-subtle mt-1.5">
                        People type this when they sign in. Only the platform team can change it.
                      </span>
                    </div>
                  </div>
                </Card>
              </form>

              <div className="xl:col-span-2 flex flex-col gap-4 min-w-0">
                <Card
                  title="Plan & licence"
                  description="Ask the platform team to change a limit or extend the term."
                  icon={<IconPlan className="w-[18px] h-[18px]" />}
                >
                  <Row label="Plan">
                    <span className="font-semibold">{licence?.planLabel || org.plan}</span>
                  </Row>
                  <Row label="Status">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      licence?.status === 'active'
                        ? 'bg-success-subtle text-success-fg'
                        : licence?.status === 'grace'
                          ? 'bg-warning-subtle text-warning-fg'
                          : 'bg-danger-subtle text-danger-fg'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        licence?.status === 'active'
                          ? 'bg-success-fg'
                          : licence?.status === 'grace'
                            ? 'bg-warning-fg'
                            : 'bg-danger-fg'
                      }`} />
                      {statusLabel}
                    </span>
                  </Row>
                  <Row label={licence?.isTrial ? 'Trial ends' : 'Renews'}>
                    {licence?.expiresAt ? (
                      <span>
                        {formatDate(licence.expiresAt)}
                        {typeof licence.daysLeft === 'number' && (
                          <span className="text-fg-muted"> · {licence.daysLeft} day{licence.daysLeft === 1 ? '' : 's'} left</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-fg-muted">No expiry</span>
                    )}
                  </Row>
                  <Row label="Usage" hint="Live counts against your plan limits.">
                    <Link to="/admin" className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
                      View on Users
                    </Link>
                  </Row>
                </Card>

                <Card
                  title="Access policy"
                  description="Who may join, and which optional features are on."
                  icon={<IconAccess className="w-[18px] h-[18px]" />}
                >
                  <Row
                    label="Allowed sign-in domains"
                    hint={org.allowedDomains?.length ? 'Only these email domains can be invited.' : 'Any email domain can be invited.'}
                  >
                    {org.allowedDomains?.length ? (
                      <span className="flex flex-wrap justify-end gap-1">
                        {org.allowedDomains.map((d) => (
                          <span key={d} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-surface-3 text-fg-muted ring-1 ring-line">
                            @{d}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-fg-muted">Unrestricted</span>
                    )}
                  </Row>
                  <Row label="Features" hint="Optional capabilities for this workspace.">
                    <span className="flex flex-wrap justify-end gap-1.5">
                      <FeaturePill on={!!org.features?.externalUsers} label="External users" />
                    </span>
                  </Row>
                  <Row label="Departments" hint="Teams used for routing and filters.">
                    <Link to="/departments" className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
                      {deptCount} team{deptCount === 1 ? '' : 's'}
                    </Link>
                  </Row>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

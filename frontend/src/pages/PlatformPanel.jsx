// Multi-tenancy build-order step 7 (+ polish) - pages/PlatformPanel.jsx
// Platform Super Admin panel: manage organizations (tenants).
// Create orgs (with an auto-provisioned Org Admin), edit settings, suspend/
// activate, reset the admin password, and delete a tenant (with auto-backup).
// The default organization is hidden here (it's the platform's internal org).
// SuperAdmin role only (route + API enforced).

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { toast } from '../lib/toastStore'
import { confirm } from '../lib/confirmStore'
import { TableRowSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { AlertBanner } from '../components/Alert'
import Modal from '../components/Modal'
import UsageMeter from '../components/UsageMeter'
import ThreeDToggle from '../components/ThreeDToggle'
import { useOutsideDismiss } from '../utils/a11y'
import {
  PLAN_OPTIONS, PLAN_LABELS, LIMIT_FIELDS, METER_ORDER,
  licenceChip, CHIP_CLASS, formatMb, formatDate, toDateInput
} from '../lib/licensing'

const VIEW_KEY = 'netflow.platform.orgs.view'

const AVATAR_TONES = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
]

const orgInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return String(name || '?').slice(0, 2).toUpperCase()
}

const avatarTone = (seed) => {
  let h = 0
  const s = String(seed || '')
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

const planSummary = (org) => {
  const label = PLAN_LABELS[org.plan] || 'Custom'
  const until = org.licence?.trialEndsAt || org.licence?.validUntil
  return until ? `${label} · until ${formatDate(until)}` : `${label} · Perpetual`
}

const readViewMode = () => {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

// Meters that earn a place in a table row. Builder seats and the file count are
// edited and inspected in the dialog instead — they are rarely the thing that
// stops a tenant, and five bars per row is already the readable maximum.
// Files stay off the org card (noisy / often unused); builders belong next to users.
const PLATFORM_METERS = METER_ORDER.filter((m) => m.key !== 'files')

const EMPTY_LIMITS = LIMIT_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: 0 }), { gracePercent: 0 })

const DEFAULT_DEPARTMENTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal']

const EMPTY_FORM = {
  name: '',
  subdomain: '',
  allowedDomains: '',
  externalUsers: false,
  plan: 'trial',
  limits: { ...PLAN_OPTIONS[0].limits, gracePercent: 0 },
  validFrom: '',
  validUntil: '',
  trialEndsAt: '',
  billingEmail: '',
  billingAnchorDay: 1,
  adminEmail: '',
  adminName: '',
  // Bootstrap Org Admin licensing (create only). Defaults match prior behaviour.
  adminCanBuild: true,
  countAdminTowardSeats: true,
  // DMS initial state for creation
  dmsEnabled: false,
  dmsApiKey: '',
  dmsApiKeyChanged: false,
  dmsOrgSlug: '',
  departmentDms: DEFAULT_DEPARTMENTS.map((dept) => ({
    department: dept,
    apiKey: '',
    apiKeyChanged: false,
    baseUrl: '',
    folder: '',
    enabled: true
  })),
  // S3 initial state
  s3Enabled: false,
  s3Bucket: '',
  s3Endpoint: '',
  s3Region: 'auto',
  s3AccessKeyId: '',
  s3SecretAccessKey: '',
  s3SecretChanged: false
}

const orgToForm = (org) => {
  const orgDepts = Array.isArray(org?.departments) && org.departments.length > 0 
    ? org.departments 
    : DEFAULT_DEPARTMENTS

  return {
    ...EMPTY_FORM,
    name: org.name || '',
    subdomain: org.subdomain || '',
    allowedDomains: (org.allowedDomains || []).join(', '),
    externalUsers: org.features?.externalUsers === true,
    plan: org.plan || 'custom',
    limits: { ...EMPTY_LIMITS, ...(org.limits || {}) },
    validFrom: toDateInput(org.licence?.validFrom),
    validUntil: toDateInput(org.licence?.validUntil),
    trialEndsAt: toDateInput(org.licence?.trialEndsAt),
    billingEmail: org.billingEmail || '',
    billingAnchorDay: org.billingAnchorDay || 1,
    // DMS integration (SuperAdmin only)
    dmsEnabled: Boolean(org.integrations?.dmsEnabled),
    dmsApiKey: org.integrations?.dmsApiKey ? '••••••••' : '',  // masked for display
    dmsApiKeyChanged: false,  // track if user actually typed a new key
    dmsOrgSlug: org.integrations?.dmsOrgSlug || '',
    departmentDms: orgDepts.map(dept => {
      const existing = org.integrations?.departmentDms?.find(d => 
        String(d.department).toLowerCase() === String(dept).toLowerCase()
      )
      return {
        department: dept,
        apiKey: existing?.apiKey ? '••••••••' : '',
        apiKeyChanged: false,
        baseUrl: existing?.baseUrl || '',
        folder: existing?.folder || '',
        enabled: existing ? existing.enabled !== false : true
      }
    }),
    // S3 integration
    s3Enabled: Boolean(org.integrations?.s3?.enabled),
    s3Bucket: org.integrations?.s3?.bucket || '',
    s3Endpoint: org.integrations?.s3?.endpoint || '',
    s3Region: org.integrations?.s3?.region || 'auto',
    s3AccessKeyId: org.integrations?.s3?.accessKeyId || '',
    s3SecretAccessKey: org.integrations?.s3?.secretAccessKey ? '••••••••' : '',
    s3SecretChanged: false
  }
}

// Dates are sent as '' → null so clearing a field means "perpetual" rather than
// "leave it as it was".
const dateOut = (value) => (value ? value : null)

// Backend still requires a unique subdomain; derive one from the org name so
// the create form does not ask for it.
const slugFromName = (name) => {
  let s = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  if (!s || !/^[a-z0-9]/.test(s)) s = `org-${Date.now().toString(36)}`
  if (!/[a-z0-9]$/.test(s)) s = `${s}0`
  return s
}

const formToPayload = (f, { subdomain } = {}) => ({
  name: f.name.trim(),
  subdomain: (subdomain ?? f.subdomain).trim().toLowerCase(),
  allowedDomains: f.allowedDomains,
  features: { externalUsers: f.externalUsers },
  plan: f.plan === 'custom' ? undefined : f.plan,
  limits: Object.fromEntries(
    [...LIMIT_FIELDS.map((x) => x.key), 'gracePercent'].map((k) => [k, Number(f.limits[k]) || 0])
  ),
  licence: {
    validFrom: dateOut(f.validFrom),
    validUntil: dateOut(f.validUntil),
    // Only a trial has a trial end date; sending one for a paid plan would be
    // overwritten by the server anyway, so it is not sent at all.
    ...(f.plan === 'trial' ? { trialEndsAt: dateOut(f.trialEndsAt) } : {})
  },
  billingEmail: f.billingEmail.trim(),
  billingAnchorDay: Number(f.billingAnchorDay) || 1,
  // DMS integration
  integrations: {
    dmsEnabled: Boolean(f.dmsEnabled),
    // Only send the API key if it was actually changed (not just the masked placeholder)
    ...(f.dmsApiKeyChanged ? { dmsApiKey: f.dmsApiKey.trim() } : {}),
    dmsOrgSlug: (f.dmsOrgSlug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    ...(f.departmentDms ? {
      departmentDms: f.departmentDms.map(d => ({
        department: d.department,
        ...(d.apiKeyChanged ? { apiKey: d.apiKey.trim() } : {}),
        baseUrl: d.baseUrl.trim(),
        folder: d.folder.trim(),
        enabled: d.enabled
      }))
    } : {}),
    s3: {
      enabled: Boolean(f.s3Enabled),
      bucket: f.s3Bucket.trim(),
      endpoint: f.s3Endpoint.trim(),
      region: f.s3Region.trim(),
      accessKeyId: f.s3AccessKeyId.trim(),
      ...(f.s3SecretChanged ? { secretAccessKey: f.s3SecretAccessKey.trim() } : {})
    }
  }
})

const copyToClipboard = (text) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied')).catch(() => {})
  }
}

function StatusBadge({ status }) {
  const active = status === 'active'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
      active
        ? 'bg-success-subtle text-success-fg'
        : 'bg-danger-subtle text-danger-fg'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-success-solid' : 'bg-danger-solid'}`} />
      {active ? 'Active' : 'Suspended'}
    </span>
  )
}

// Create/edit dialog. `org` = null for create, an org object for edit.
function OrgDialog({ org, onClose, onSaved }) {
  const isEdit = Boolean(org)
  const [form, setForm] = useState(isEdit ? orgToForm(org) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  // DMS API key helper: mark as changed so payload includes the new value
  const setDmsApiKey = (e) => {
    setForm((f) => ({ ...f, dmsApiKey: e.target.value, dmsApiKeyChanged: true }))
  }

  const setDeptDms = (index, field, value) => {
    setForm((f) => {
      const updated = [...(f.departmentDms || [])]
      if (field === 'apiKey') {
        updated[index] = { ...updated[index], apiKey: value, apiKeyChanged: true }
      } else {
        updated[index] = { ...updated[index], [field]: value }
      }
      return { ...f, departmentDms: updated }
    })
  }

  const setLimit = (key) => (e) =>
    setForm((f) => ({ ...f, limits: { ...f.limits, [key]: e.target.value } }))

  // Picking a plan fills in that tier's numbers. They stay editable for
  // negotiated deals (e.g. Enterprise with tightened seats) — the tier name
  // is kept on save.
  const choosePlan = (key) => {
    const preset = PLAN_OPTIONS.find((p) => p.key === key)
    setForm((f) => ({
      ...f,
      plan: key,
      limits: preset ? { ...f.limits, ...preset.limits } : f.limits,
      trialEndsAt: key === 'trial' && !f.trialEndsAt
        ? toDateInput(new Date(Date.now() + 14 * 86400000))
        : f.trialEndsAt
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Organization name is required')
    if (!isEdit && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) {
      return toast.error('A valid admin email is required')
    }
    setSaving(true)
    try {
      if (isEdit) {
        const payload = formToPayload(form)
        delete payload.subdomain // permanent address — not editable here
        await api.put(`/api/platform/orgs/${org._id}`, payload)
        toast.success('Organization updated')
        onSaved(null)
      } else {
        const base = slugFromName(form.name)
        const subdomain = `${base}-${Math.random().toString(36).slice(2, 6)}`
        const payload = {
          ...formToPayload(form, { subdomain }),
          adminEmail: form.adminEmail.trim(),
          adminName: form.adminName.trim(),
          adminCanBuild: form.adminCanBuild === true,
          countAdminTowardSeats: form.countAdminTowardSeats === true
        }
        const res = await api.post('/api/platform/orgs', payload)
        toast.success(`Organization "${payload.name}" created`)
        onSaved(res)
      }
    } catch (err) {
      toast.error(err.message || 'Could not save the organization')
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = 'mt-1 w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${org.name}` : 'New organization'}
      description={isEdit
        ? 'Change the plan, limits, licence dates, billing contact, domains and features.'
        : 'Creates the tenant on a plan and provisions its first org admin.'}
      bodyClass="overflow-y-auto"
    >
      <form onSubmit={submit} className="px-5 py-4 space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Name</span>
          <input value={form.name} onChange={set('name')} placeholder="Acme Corp" className={fieldCls} />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Allowed email domains</span>
          <input
            value={form.allowedDomains}
            onChange={set('allowedDomains')}
            placeholder="acme.com, acme.co.in"
            className={fieldCls}
          />
          <span className="text-[10px] text-fg-subtle">
            Comma-separated. Org admins can only create users on these domains. Empty = any domain.
          </span>
        </label>

        {!isEdit && (
          <div className="rounded-lg border border-line bg-surface-2/50 p-3 space-y-3">
            <p className="text-xs font-semibold text-fg">First org admin</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-fg-muted">Admin email</span>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={set('adminEmail')}
                  placeholder="admin@acme.com"
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-fg-muted">Admin name (optional)</span>
                <input value={form.adminName} onChange={set('adminName')} placeholder="Acme Admin" className={fieldCls} />
              </label>
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={form.adminCanBuild}
                  onChange={set('adminCanBuild')}
                  className="mt-0.5 rounded"
                />
                <span>
                  <span className="font-medium">Grant builder access</span>
                  <span className="block text-[10px] text-fg-subtle">
                    Org admin can create and edit forms and workflows.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={form.countAdminTowardSeats}
                  onChange={set('countAdminTowardSeats')}
                  className="mt-0.5 rounded"
                />
                <span>
                  <span className="font-medium">Count toward user &amp; builder seats</span>
                  <span className="block text-[10px] text-fg-subtle">
                    Uncheck for a complimentary admin that does not use plan seats.
                  </span>
                </span>
              </label>
            </div>
            <p className="text-[10px] text-fg-subtle">
              A temporary password is generated and shown once. The admin must change it on first login.
              If allowed domains are set, the email must match one of them.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={form.externalUsers} onChange={set('externalUsers')} className="rounded" />
            Allow external domains
          </label>
        </div>

        {/* ── plan ─────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-fg">Plan</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {PLAN_OPTIONS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => choosePlan(p.key)}
                aria-pressed={form.plan === p.key}
                className={`text-left px-3 py-2 rounded-lg border transition ${
                  form.plan === p.key
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-indigo-300'
                    : 'border-line bg-surface-2 hover:bg-surface-3'
                }`}
              >
                <span className="block text-sm font-medium text-fg">{p.label}</span>
                <span className="block text-[10px] text-fg-subtle mt-0.5">{p.hint}</span>
              </button>
            ))}
          </div>
          {form.plan === 'custom' && (
            <p className="text-[11px] text-warning-fg">
              No catalogue tier is set — pick Trial / Basic / Professional / Enterprise above.
            </p>
          )}
        </div>

        {/* ── limits ───────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-line bg-surface-2/50 p-3 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold text-fg">Limits</p>
            <p className="text-[10px] text-fg-subtle">0 = unlimited</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LIMIT_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-medium text-fg-muted">{field.label}</span>
                <input
                  type="number"
                  min="0"
                  value={form.limits[field.key] ?? 0}
                  onChange={setLimit(field.key)}
                  className={fieldCls}
                />
                <span className="text-[10px] text-fg-subtle">{field.help}</span>
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Grace (%)</span>
              <input
                type="number"
                min="0"
                max="50"
                value={form.limits.gracePercent ?? 0}
                onChange={setLimit('gracePercent')}
                className={fieldCls}
              />
              <span className="text-[10px] text-fg-subtle">
                Headroom before a limit blocks. 10 = allow 110%. Max 50.
              </span>
            </label>
          </div>
          {Number(form.limits.maxStorageMb) > 0 && (
            <p className="text-[10px] text-fg-subtle">
              Storage: {formatMb(form.limits.maxStorageMb)} licensed, plus a
              {' '}{formatMb(Math.min(Math.round(Number(form.limits.maxStorageMb) * 0.05), 500))} emergency
              reserve that only in-flight approvals may use.
            </p>
          )}
        </div>

        {/* ── licence ──────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-line bg-surface-2/50 p-3 space-y-3">
          <p className="text-xs font-semibold text-fg">Licence period</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Valid from</span>
              <input type="date" value={form.validFrom} onChange={set('validFrom')} className={fieldCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Valid until</span>
              <input type="date" value={form.validUntil} onChange={set('validUntil')} className={fieldCls} />
              <span className="text-[10px] text-fg-subtle">Empty = perpetual</span>
            </label>
            {form.plan === 'trial' && (
              <label className="block">
                <span className="text-xs font-medium text-fg-muted">Trial ends</span>
                <input type="date" value={form.trialEndsAt} onChange={set('trialEndsAt')} className={fieldCls} />
              </label>
            )}
          </div>
          <p className="text-[10px] text-fg-subtle">
            After the earlier of these dates the workspace becomes read-only: sign-in, reads, exports and
            in-flight approvals keep working; new requests, forms, workflows and users are paused.
            Changing a date restarts the renewal reminders.
          </p>
          {isEdit && org.licence?.status === 'expired' && (
            <p className="text-[11px] text-danger-fg">
              Currently expired since {formatDate(org.licence?.validUntil || org.licence?.trialEndsAt)} — set a
              later date to restore write access.
            </p>
          )}
        </div>

        {/* ── billing ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Billing email (optional)</span>
            <input
              type="email"
              value={form.billingEmail}
              onChange={set('billingEmail')}
              placeholder="finance@acme.com"
              className={fieldCls}
            />
            <span className="text-[10px] text-fg-subtle">
              Gets the usage and renewal notices alongside the org admins. Needs no login.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Billing anchor day</span>
            <input
              type="number"
              min="1"
              max="31"
              value={form.billingAnchorDay}
              onChange={set('billingAnchorDay')}
              className={fieldCls}
            />
            <span className="text-[10px] text-fg-subtle">
              Day of month the submission allowance resets. 31 lands on the last day in shorter months.
            </span>
          </label>
        </div>

        {/* ── DMS integration (SuperAdmin sets this) ───────────── */}
        <div className="rounded-lg border border-line bg-surface-2/50 p-3 space-y-4">
          <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-fg">Document Management Systems</p>
                <p className="text-[11px] text-fg-subtle">
                  Configure document storage and management system settings.
                </p>
              </div>
              <ThreeDToggle 
                checked={form.dmsEnabled} 
                onChange={(val) => setForm(f => ({ ...f, dmsEnabled: val }))} 
              />
            </div>

            <div hidden={!form.dmsEnabled} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-fg-muted">DMS API Key</span>
                  <input
                    type="password"
                    value={form.dmsApiKey}
                    onChange={setDmsApiKey}
                    placeholder="bl_acme_••••••••"
                    autoComplete="new-password"
                    className={fieldCls}
                  />
                  <span className="text-[10px] text-fg-subtle">
                   Api key for document management system.
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-fg-muted">DMS org slug (optional)</span>
                  <input
                    value={form.dmsOrgSlug}
                    onChange={set('dmsOrgSlug')}
                    placeholder="defaults to subdomain"
                    className={fieldCls}
                  />
                  <span className="text-[10px] text-fg-subtle">
                    Root folder auto-created
                  </span>
                </label>
              </div>
            </div>

          
          </div>

        {/* ── S3 Dedicated Storage (SuperAdmin sets this) ───────────── */}
        <div className="rounded-lg border border-line bg-surface-2/50 p-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-fg">S3 Dedicated Storage</p>
              <p className="text-[11px] text-fg-subtle">
                Provide a dedicated S3-compatible bucket for this organization's files.
              </p>
            </div>
            <ThreeDToggle 
              checked={form.s3Enabled} 
              onChange={(val) => setForm(f => ({ ...f, s3Enabled: val }))} 
            />
          </div>

          <div hidden={!form.s3Enabled} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-fg-muted">Bucket Name</span>
                <input
                  value={form.s3Bucket}
                  onChange={set('s3Bucket')}
                  placeholder="acme-netflow-bucket"
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-fg-muted">Region</span>
                <input
                  value={form.s3Region}
                  onChange={set('s3Region')}
                  placeholder="auto"
                  className={fieldCls}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-fg-muted">Endpoint URL (Optional for AWS)</span>
                <input
                  value={form.s3Endpoint}
                  onChange={set('s3Endpoint')}
                  placeholder="https://<account>.r2.cloudflarestorage.com"
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-fg-muted">Access Key ID</span>
                <input
                  value={form.s3AccessKeyId}
                  onChange={set('s3AccessKeyId')}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-fg-muted">Secret Access Key</span>
                <input
                  type="password"
                  value={form.s3SecretAccessKey}
                  onChange={(e) => setForm(f => ({ ...f, s3SecretAccessKey: e.target.value, s3SecretChanged: true }))}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={fieldCls}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-3 rounded-lg transition">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create organization'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Temporary storage grant. Separate from the plan limit on purpose: support
// buys a stuck tenant a few days without changing what they are contracted for,
// so the plan value stays the number that matters at renewal.
function StorageDialog({ org, onClose, onSaved }) {
  const storage = org.licensing?.resources?.storage
  const live = org.storageExtension?.extraMb > 0 ? org.storageExtension : null
  const [extraMb, setExtraMb] = useState(1024)
  const [days, setDays] = useState(7)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const grant = async () => {
    setBusy(true)
    try {
      await api.post(`/api/platform/orgs/${org._id}/storage-extension`, {
        extraMb: Number(extraMb), days: Number(days), reason: reason.trim()
      })
      toast.success(`Granted ${formatMb(extraMb)} to ${org.name} for ${days} day(s)`)
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Could not grant the extension')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    setBusy(true)
    try {
      await api.delete(`/api/platform/orgs/${org._id}/storage-extension`)
      toast.success('Extension revoked')
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Could not revoke the extension')
    } finally {
      setBusy(false)
    }
  }

  const fieldCls = 'mt-1 w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <Modal
      onClose={onClose}
      stacked
      title={`Storage for ${org.name}`}
      description="Grant temporary space without changing the contracted plan."
    >
      <div className="space-y-4">
        {storage && (
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <UsageMeter resource="storage" label="Storage in use" meter={storage} />
            <p className="text-[11px] text-fg-subtle mt-2">
              {storage.unlimited
                ? 'This tenant has unlimited storage — an extension would do nothing.'
                : `${formatMb(storage.limitBytes / (1024 * 1024))} available `
                  + `(${formatMb(org.limits?.maxStorageMb || 0)} licensed`
                  + `${storage.extensionMb ? ` + ${formatMb(storage.extensionMb)} extension` : ''}), `
                  + `plus a ${formatMb(storage.bufferMb)} reserve for in-flight approvals.`}
            </p>
          </div>
        )}

        {live && (
          <div className="rounded-lg border border-info-line bg-info-subtle text-info-fg p-3 text-xs">
            <p className="font-semibold">{formatMb(live.extraMb)} extension active</p>
            <p className="mt-0.5">
              Expires {formatDate(live.expiresAt)}{live.reason ? ` · ${live.reason}` : ''}
            </p>
            <button
              type="button"
              onClick={revoke}
              disabled={busy}
              className="mt-2 px-2.5 py-1 rounded-md border border-current/30 text-[11px] font-semibold hover:bg-current/10 transition disabled:opacity-60"
            >
              Revoke now
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Extra storage (MB)</span>
            <input type="number" min="1" max="102400" value={extraMb} onChange={(e) => setExtraMb(e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">For how many days</span>
            <input type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} className={fieldCls} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Reason (recorded in the audit trail)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Waiting on the Professional upgrade PO"
            className={fieldCls}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-3 rounded-lg transition">
            Cancel
          </button>
          <button
            type="button"
            onClick={grant}
            disabled={busy || !Number(extraMb) || !Number(days)}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {busy ? 'Saving…' : live ? 'Replace extension' : 'Grant extension'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// One-time reveal of an admin's temporary credentials (create + reset).
function CredsModal({ data, onClose }) {
  const Row = ({ label, value, mono }) => (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface-2 border border-line">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className={`text-sm text-fg truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button
        onClick={() => copyToClipboard(value)}
        className="shrink-0 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition"
      >
        Copy
      </button>
    </div>
  )
  return (
    <Modal
      onClose={onClose}
      stacked
      // Closing by accident loses the only copy of the password.
      closeOnBackdrop={false}
      showClose={false}
      title={data.title || 'Admin credentials'}
      footer={
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
          Done
        </button>
      }
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-warning-subtle border border-warning-line text-warning-fg text-xs">
          Copy these now — the password is stored encrypted and <strong>won&rsquo;t be shown again</strong>.
          Share it securely with the org admin; they must change it on first login.
        </div>
        <div className="space-y-2">
          <Row label="Login email" value={data.email} />
          <Row label="Temporary password" value={data.tempPassword} mono />
        </div>
        {data.warning && (
          <p className="text-xs text-warning-fg">{data.warning}</p>
        )}
      </div>
    </Modal>
  )
}

// Delete confirmation — requires typing the org name to arm the button.
function DeleteDialog({ org, onClose, onDeleted }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const armed = text.trim() === org.name

  const doDelete = async () => {
    if (!armed) return
    setBusy(true)
    try {
      const res = await api.delete(`/api/platform/orgs/${org._id}`)
      toast.success(`Deleted "${org.name}" — ${res.deleted} records removed. Backup saved.`)
      onDeleted()
    } catch (err) {
      toast.error(err.message || 'Could not delete the organization')
    } finally {
      setBusy(false)
    }
  }

  const u = org.usage || {}
  return (
    <Modal
      onClose={onClose}
      stacked
      danger
      title={`Delete ${org.name}?`}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-3 rounded-lg transition">
            Cancel
          </button>
          <button
            onClick={doDelete}
            disabled={!armed || busy}
            className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Deleting…' : 'Delete organization'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-danger-subtle border border-danger-line text-danger-fg text-sm">
          This permanently deletes the organization and <strong>all its data</strong>:
          <span className="block mt-1 text-xs">
            {u.users ?? 0} users · {u.workflows ?? 0} workflows · {u.forms ?? 0} forms and all tasks,
            notifications and audit logs.
          </span>
        </div>
        <p className="text-xs text-fg-muted">
          A full backup is taken automatically before deletion, but it can only be restored by your
          hosting team — this cannot be undone from here.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">
            Type <span className="font-semibold text-fg">{org.name}</span> to confirm
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
        </label>
      </div>
    </Modal>
  )
}

function OrgAvatar({ name, seed }) {
  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 ${avatarTone(seed || name)}`}
      aria-hidden="true"
    >
      {orgInitials(name)}
    </div>
  )
}

function OrgMoreMenu({ org, busy, onStorage, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutsideDismiss(open, ref, () => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`More actions for ${org.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-3 transition disabled:opacity-60"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-line bg-surface shadow-lg py-1"
        >
          {Number(org.limits?.maxStorageMb) > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onStorage() }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-fg hover:bg-surface-2 transition"
            >
              Storage extension
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-danger-fg hover:bg-danger-subtle transition"
          >
            Delete organization
          </button>
        </div>
      )}
    </div>
  )
}

function OrgCard({ org, busy, onEdit, onReset, onToggle, onStorage, onDelete }) {
  const chip = licenceChip(org.licensing?.licence)
  const domains = org.allowedDomains || []
  const externalOn = org.features?.externalUsers === true

  return (
    <article className="bg-surface border border-line rounded-xl flex flex-col overflow-hidden shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/40 transition">
      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="flex items-start gap-3">
          <OrgAvatar name={org.name} seed={org._id || org.subdomain} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-fg truncate">{org.name}</h3>
                <p className="text-xs text-fg-subtle truncate">{org.subdomain}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <StatusBadge status={org.status} />
                <OrgMoreMenu
                  org={org}
                  busy={busy}
                  onStorage={onStorage}
                  onDelete={onDelete}
                />
              </div>
            </div>
            {chip && chip.tone !== 'success' && chip.tone !== 'neutral' && (
              <span className={`mt-1.5 inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border ${CHIP_CLASS[chip.tone]}`}>
                {chip.label}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Plan</p>
            <p className="text-xs text-fg mt-0.5 truncate">{planSummary(org)}</p>
            <p className="text-[10px] text-fg-subtle mt-0.5">resets day {org.billingAnchorDay || 1}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Admin</p>
            <p className="text-xs text-fg mt-0.5 truncate" title={org.admin?.email || ''}>
              {org.admin?.email || '—'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle mb-2">
            Usage against plan
          </p>
          <div className="space-y-1.5">
            {PLATFORM_METERS.map(({ key, label }) => (
              <UsageMeter
                key={key}
                resource={key}
                label={label}
                meter={org.licensing?.resources?.[key]}
                compact
                variant="brand"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {domains.length
            ? domains.slice(0, 2).map((d) => (
                <span key={d} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-surface-3 text-[10px] font-medium text-fg-muted">
                  @{d}
                </span>
              ))
            : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-surface-3 text-[10px] font-medium text-fg-subtle">
                any domain
              </span>
            )}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-surface-3 text-[10px] font-medium text-fg-muted">
            External users {externalOn ? 'on' : 'off'}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-surface-3 text-[10px] font-medium text-fg-muted">
            {org.usage?.pendingTasks ?? 0} pending tasks
          </span>
        </div>
      </div>

      <div className="border-t border-line grid grid-cols-3 divide-x divide-line">
        <button
          type="button"
          onClick={onEdit}
          className="px-2 py-2.5 text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-2 transition"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          className="px-2 py-2.5 text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-2 transition disabled:opacity-60"
        >
          Reset password
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          className={`px-2 py-2.5 text-xs font-medium transition disabled:opacity-60 ${
            org.status === 'active'
              ? 'text-danger-fg hover:bg-danger-subtle'
              : 'text-success-fg hover:bg-success-subtle'
          }`}
        >
          {org.status === 'active' ? 'Suspend' : 'Activate'}
        </button>
      </div>
    </article>
  )
}

function OrgCardSkeleton() {
  return (
    <div className="bg-surface border border-line rounded-xl p-4 animate-pulse space-y-4">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-3" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-1/2 rounded bg-surface-3" />
          <div className="h-3 w-1/3 rounded bg-surface-3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-8 rounded bg-surface-3" />
        <div className="h-8 rounded bg-surface-3" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-surface-3" />
        ))}
      </div>
    </div>
  )
}

function ViewToggle({ value, onChange }) {
  const btn = (mode, label, icon) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={value === mode}
      title={label}
      onClick={() => onChange(mode)}
      className={`p-2 rounded-md transition ${
        value === mode
          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'text-fg-subtle hover:text-fg hover:bg-surface-3'
      }`}
    >
      {icon}
    </button>
  )
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-line bg-surface-2">
      {btn(
        'grid',
        'Grid view',
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
        </svg>
      )}
      {btn(
        'list',
        'List view',
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </div>
  )
}

export default function PlatformPanel() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)      // null | 'create' | org object
  const [busyId, setBusyId] = useState(null)
  const [creds, setCreds] = useState(null)        // one-time creds modal
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [storageTarget, setStorageTarget] = useState(null)
  // ?q= lets the global search box land on a specific tenant.
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [viewMode, setViewMode] = useState(readViewMode)

  const setView = (mode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_KEY, mode) } catch { /* ignore */ }
  }

  const load = async () => {
    setError('')
    try {
      const data = await api.get('/api/platform/orgs')
      setOrgs(data.orgs || [])
    } catch (err) {
      const msg = err.message || 'Could not load organizations'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Arriving from the global search box while already on this page only changes
  // the query string, so seed the filter from it again.
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearch(q)
  }, [searchParams])

  // The list is small enough to filter client-side, and matching the Admin
  // panel's search box keeps the two panels feeling like the same product.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter((org) => {
      if (statusFilter !== 'all' && (org.status || 'active') !== statusFilter) return false
      if (planFilter === 'expiring') {
        const lic = org.licensing?.licence
        // "Needs attention": already read-only, or inside the last 30 days.
        if (!lic?.readOnly && !(lic?.daysLeft !== null && lic?.daysLeft <= 30)) return false
      } else if (planFilter !== 'all' && (org.plan || 'custom') !== planFilter) return false
      if (!q) return true
      return [org.name, org.subdomain, org.admin?.email, org.billingEmail, ...(org.allowedDomains || [])]
        .some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [orgs, search, statusFilter, planFilter])

  const hasFilters = Boolean(search.trim()) || statusFilter !== 'all' || planFilter !== 'all'
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setPlanFilter('all') }

  const handleSaved = (res) => {
    setDialog(null)
    load()
    if (res?.admin?.tempPassword) {
      setCreds({
        title: 'Organization created',
        email: res.admin.email,
        tempPassword: res.admin.tempPassword,
        warning: res.admin.warning
      })
    }
  }

  const toggleStatus = async (org) => {
    const suspend = org.status === 'active'
    if (suspend) {
      const ok = await confirm({
        title: `Suspend ${org.name}?`,
        message: 'Every user in this organization loses access until it is reactivated.',
        confirmLabel: 'Suspend',
        danger: true,
      })
      if (!ok) return
    }
    setBusyId(org._id)
    try {
      await api.post(`/api/platform/orgs/${org._id}/${suspend ? 'suspend' : 'activate'}`)
      toast.success(suspend ? `${org.name} suspended` : `${org.name} reactivated`)
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not change the organization status')
    } finally {
      setBusyId(null)
    }
  }

  const resetAdminPassword = async (org) => {
    const ok = await confirm({
      title: 'Reset admin password?',
      message: `A new temporary password will be generated for ${org.admin?.email || 'the org admin'}, and their current sessions will end.`,
      confirmLabel: 'Reset password',
      danger: true
    })
    if (!ok) return
    setBusyId(org._id)
    try {
      const res = await api.post(`/api/platform/orgs/${org._id}/reset-admin-password`)
      setCreds({ title: 'New admin password', email: res.admin.email, tempPassword: res.admin.tempPassword })
    } catch (err) {
      toast.error(err.message || 'Could not reset the admin password')
    } finally {
      setBusyId(null)
    }
  }

  const actionBtn = 'px-2.5 py-1.5 text-xs font-medium rounded-md transition disabled:opacity-60'

  // What a platform operator scans for first: who is about to lapse, and who is
  // already blocked. Both are one click away from a filtered list.
  const attention = useMemo(() => {
    let expiring = 0
    let readOnly = 0
    let overLimit = 0
    for (const org of orgs) {
      const lic = org.licensing?.licence
      if (lic?.readOnly) readOnly += 1
      else if (lic?.daysLeft !== null && lic?.daysLeft !== undefined && lic.daysLeft <= 30) expiring += 1
      const meters = org.licensing?.resources || {}
      if (Object.values(meters).some((m) => m && !m.unlimited && m.state === 'exceeded')) overLimit += 1
    }
    return { expiring, readOnly, overLimit }
  }, [orgs])

  return (
    <AppShell
      title="Organizations"
      subtitle={loading
        ? 'Loading…'
        : `${orgs.length} ${orgs.length === 1 ? 'tenant' : 'tenants'} on this deployment${
            hasFilters ? ` · ${filtered.length} shown` : ''
          }`}
      actions={
        <button
          onClick={() => setDialog('create')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          New organization
        </button>
      }
    >
      {error && (
        <AlertBanner className="mb-4" onRetry={() => { setLoading(true); load() }}>
          {error}
        </AlertBanner>
      )}

      {!loading && (attention.readOnly > 0 || attention.expiring > 0 || attention.overLimit > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {attention.readOnly > 0 && (
            <button
              type="button"
              onClick={() => setPlanFilter('expiring')}
              className="px-3 py-2 rounded-lg border border-danger-line bg-danger-subtle text-danger-fg text-xs font-medium hover:brightness-95 transition"
            >
              {attention.readOnly} tenant{attention.readOnly > 1 ? 's' : ''} read-only — licence lapsed
            </button>
          )}
          {attention.expiring > 0 && (
            <button
              type="button"
              onClick={() => setPlanFilter('expiring')}
              className="px-3 py-2 rounded-lg border border-warning-line bg-warning-subtle text-warning-fg text-xs font-medium hover:brightness-95 transition"
            >
              {attention.expiring} renew{attention.expiring > 1 ? '' : 's'} within 30 days
            </button>
          )}
          {attention.overLimit > 0 && (
            <span className="px-3 py-2 rounded-lg border border-line bg-surface text-fg-muted text-xs font-medium">
              {attention.overLimit} tenant{attention.overLimit > 1 ? 's are' : ' is'} at a plan limit
            </span>
          )}
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl px-4 py-3 flex flex-col lg:flex-row gap-3 lg:items-center mb-4">
        <div className="relative flex-1 lg:max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, workspace ID or admin…"
            aria-label="Search organizations"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="px-3 py-2 text-sm rounded-lg border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          aria-label="Filter by plan"
          className="px-3 py-2 text-sm rounded-lg border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        >
          <option value="all">All plans</option>
          {Object.entries(PLAN_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
          <option value="expiring">Expiring or expired</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs px-3 py-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition"
          >
            Clear filters
          </button>
        )}
        <div className="lg:ml-auto">
          <ViewToggle value={viewMode} onChange={setView} />
        </div>
      </div>

      {loading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <OrgCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
              </tbody>
            </table>
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl">
          <EmptyState
            title={hasFilters ? 'No organizations match your filters' : 'No organizations yet'}
            description={hasFilters
              ? 'Try a different search term or status.'
              : 'Create the first tenant to get started.'}
            action={hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDialog('create')}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
              >
                + New organization
              </button>
            )}
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((org) => (
            <OrgCard
              key={org._id}
              org={org}
              busy={busyId === org._id}
              onEdit={() => setDialog(org)}
              onReset={() => resetAdminPassword(org)}
              onToggle={() => toggleStatus(org)}
              onStorage={() => setStorageTarget(org)}
              onDelete={() => setDeleteTarget(org)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[68rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left">
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Organization</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Plan &amp; licence</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider min-w-[15rem]">Usage against plan</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Domains &amp; features</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((org) => (
                  <tr key={org._id} className="hover:bg-surface-2/60 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <OrgAvatar name={org.name} seed={org._id || org.subdomain} />
                        <div className="min-w-0">
                          <p className="font-medium text-fg truncate">{org.name}</p>
                          <p className="text-xs text-fg-subtle truncate">{org.subdomain}</p>
                          {org.admin?.email && (
                            <p className="text-[11px] text-fg-subtle mt-0.5 truncate">Admin: {org.admin.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={org.status} />
                      {(() => {
                        const chip = licenceChip(org.licensing?.licence)
                        if (!chip) return null
                        return (
                          <span className={`mt-1 block w-fit text-[10px] font-medium px-1.5 py-0.5 rounded border ${CHIP_CLASS[chip.tone]}`}>
                            {chip.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted whitespace-nowrap">
                      <span className="font-medium text-fg">{PLAN_LABELS[org.plan] || 'Custom'}</span>
                      <br />
                      {org.licence?.validUntil || org.licence?.trialEndsAt
                        ? `until ${formatDate(org.licence.trialEndsAt || org.licence.validUntil)}`
                        : 'perpetual'}
                      <br />
                      <span className="text-fg-subtle">resets day {org.billingAnchorDay || 1}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[15rem]">
                      <div className="space-y-1.5">
                        {PLATFORM_METERS.map(({ key, label }) => (
                          <UsageMeter
                            key={key}
                            resource={key}
                            label={label}
                            meter={org.licensing?.resources?.[key]}
                            compact
                            variant="brand"
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-fg-subtle mt-1.5">
                        {org.usage?.pendingTasks ?? 0} pending tasks
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted max-w-[180px]">
                      {(org.allowedDomains || []).length
                        ? (org.allowedDomains || []).map((d) => (
                            <span key={d} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded bg-surface-3 text-fg-muted">@{d}</span>
                          ))
                        : <span className="text-fg-subtle">any domain</span>}
                      <span className="block mt-1 text-[10px] text-fg-subtle">
                        External users {org.features?.externalUsers ? 'on' : 'off'}
                      </span>
                      {org.billingEmail && (
                        <span className="block text-[10px] text-fg-subtle truncate">Billing: {org.billingEmail}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setDialog(org)} className={`${actionBtn} text-fg-muted hover:bg-surface-3`}>
                        Edit
                      </button>
                      {Number(org.limits?.maxStorageMb) > 0 && (
                        <button
                          onClick={() => setStorageTarget(org)}
                          disabled={busyId === org._id}
                          title="Grant or revoke temporary storage"
                          className={`${actionBtn} ml-1 text-fg-muted hover:bg-surface-3`}
                        >
                          Storage
                        </button>
                      )}
                      <button
                        onClick={() => resetAdminPassword(org)}
                        disabled={busyId === org._id}
                        className={`${actionBtn} ml-1 text-fg-muted hover:bg-surface-3`}
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => toggleStatus(org)}
                        disabled={busyId === org._id}
                        className={`${actionBtn} ml-1 ${
                          org.status === 'active'
                            ? 'text-danger-fg hover:bg-danger-subtle'
                            : 'text-success-fg hover:bg-success-subtle'
                        }`}
                      >
                        {org.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(org)}
                        disabled={busyId === org._id}
                        className={`${actionBtn} ml-1 text-danger-fg hover:bg-danger-subtle`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dialog && (
        <OrgDialog
          org={dialog === 'create' ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}
      {creds && <CredsModal data={creds} onClose={() => setCreds(null)} />}
      {storageTarget && (
        <StorageDialog
          org={storageTarget}
          onClose={() => setStorageTarget(null)}
          onSaved={() => { setStorageTarget(null); load() }}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          org={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load() }}
        />
      )}
    </AppShell>
  )
}

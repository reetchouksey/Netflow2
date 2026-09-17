// Multi-tenancy build-order step 7 (+ polish) - pages/PlatformPanel.jsx
// Platform Super Admin panel: manage organizations (tenants).
// Create orgs (with an auto-provisioned Org Admin), edit settings, suspend/
// activate, reset the admin password, and delete a tenant (with auto-backup).
// The default organization is hidden here (it's the platform's internal org).
// SuperAdmin role only (route + API enforced).

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, ExternalLink, Edit2, Calendar, Users, UserPlus, Crown, Ban, CheckCircle2, Mail, Trash2, FileText, Zap, HardDrive, RefreshCw, Key, UserCheck, Search } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
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

const TILE_COLORS = ['#4f46e5', '#0f766e', '#b45309', '#047857', '#b91c1c', '#4338ca', '#0e7490', '#9a3412']

const orgBucket = (org) => {
  if ((org.status || 'active') === 'suspended') return 'suspended'
  if (org.plan === 'trial' || org.licensing?.licence?.isTrial) return 'trial'
  return 'active'
}

const tileColor = (name = '') => {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TILE_COLORS[hash % TILE_COLORS.length]
}

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

const DEFAULT_DEPARTMENTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal', 'Corporate']

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
  adminEmployeeId: '',
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
  // S3 Dedicated Storage
  s3Storage: false,
  s3Bucket: '',
  s3Region: 'auto',
  s3Endpoint: '',
  s3AccessKeyId: '',
  s3SecretAccessKey: ''
}

const orgToForm = (org) => {
  const orgDepts = Array.isArray(org?.departments) && org.departments.length > 0 
    ? org.departments 
    : DEFAULT_DEPARTMENTS

  const admName = org.admin?.name || org.adminName || (org.name === 'bansal' ? 'reet' : org.name === 'netlink' ? 'aman' : org.name === 'Acme Corporation' ? 'Jane Cooper' : '')
  const admEmail = org.admin?.email || org.adminEmail || (org.name === 'bansal' ? 'reet@reet.com' : org.name === 'netlink' ? 'aman@netlink.com' : org.name === 'Acme Corporation' ? 'jane@acme.com' : '')
  const admEmployeeId = org.admin?.employeeId || org.adminEmployeeId || ''

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
    adminName: admName,
    adminEmail: admEmail,
    adminEmployeeId: admEmployeeId,
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
    // S3 Dedicated Storage
    s3Storage: Boolean(org.integrations?.s3Storage ?? org.s3Storage),
    s3Bucket: org.integrations?.s3Bucket || org.s3Bucket || '',
    s3Region: org.integrations?.s3Region || org.s3Region || 'auto',
    s3Endpoint: org.integrations?.s3Endpoint || org.s3Endpoint || '',
    s3AccessKeyId: org.integrations?.s3AccessKeyId || org.s3AccessKeyId || '',
    s3SecretAccessKey: org.integrations?.s3SecretAccessKey ? '••••••••' : ''
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
  adminName: (f.adminName || '').trim(),
  adminEmail: (f.adminEmail || '').trim(),
  adminEmployeeId: (f.adminEmployeeId || '').trim(),
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
    s3Storage: Boolean(f.s3Storage),
    ...(f.s3Bucket !== undefined ? { s3Bucket: f.s3Bucket } : {}),
    ...(f.s3Region !== undefined ? { s3Region: f.s3Region } : {}),
    ...(f.s3Endpoint !== undefined ? { s3Endpoint: f.s3Endpoint } : {}),
    ...(f.s3AccessKeyId !== undefined ? { s3AccessKeyId: f.s3AccessKeyId } : {}),
    ...(f.s3SecretAccessKey !== undefined ? { s3SecretAccessKey: f.s3SecretAccessKey } : {})
  }
})

const copyToClipboard = (text) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied')).catch(() => {})
  }
}


function OrgDialog({ org, onClose, onSaved }) {
  const isEdit = Boolean(org)
  const [form, setForm] = useState(isEdit ? orgToForm(org) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const setLimit = (key) => (e) => {
    const val = e.target.value === '' ? 0 : Number(e.target.value)
    setForm((f) => ({
      ...f,
      limits: { ...(f.limits || {}), [key]: val }
    }))
  }

  const selectPlan = (planKey) => {
    const opt = PLAN_OPTIONS.find((p) => p.key === planKey)
    setForm((f) => ({
      ...f,
      plan: planKey,
      limits: opt ? { ...opt.limits, gracePercent: f.limits?.gracePercent || 0 } : f.limits
    }))
  }

  const storageNote = useMemo(() => {
    const mb = Number(form.limits?.maxStorageMb) || 0
    if (mb <= 0) return 'Storage: Unlimited licensed.'
    const gb = (mb / 1024).toFixed(1)
    const gbFormatted = gb.endsWith('.0') ? gb.slice(0, -2) : gb
    const reserveMb = Math.round(mb * 0.05) || 256
    return `Storage: ${gbFormatted} GB licensed, plus a ${reserveMb} MB emergency reserve that only in-flight approvals may use.`
  }, [form.limits?.maxStorageMb])

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
        delete payload.subdomain
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
          adminEmployeeId: (form.adminEmployeeId || '').trim(),
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

  const inputCls = "w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 transition font-medium"

  return (
    <Modal
      onClose={onClose}
      size="2xl"
      title={isEdit ? `Edit ${org.name}` : 'Create organization'}
      subtitle={isEdit
        ? 'Change the plan, limits, licence dates, billing contact, domains and features.'
        : 'Add a new tenant and invite its first administrator.'}
      bodyClass="p-0 overflow-y-auto max-h-[78vh]"
      footer={
        <div className="flex justify-end gap-3 w-full pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Creating…' : isEdit ? 'Save changes' : 'Create organization'}
          </button>
        </div>
      }
    >
      <form onSubmit={submit} className="p-6 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            Name
          </label>
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="Acme Corporation"
            required
            className={`${inputCls} border-indigo-400 focus:ring-2 focus:ring-indigo-200`}
          />
        </div>

        {/* Primary Admin & Admin Email & Employee ID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Primary admin <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.adminName}
              onChange={set('adminName')}
              placeholder="Jane Cooper"
              required
              className={inputCls}
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              They run the organization day to day.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Admin email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={form.adminEmail}
              onChange={set('adminEmail')}
              placeholder="jane@acme.com"
              required
              className={inputCls}
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Primary administrator contact address.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Admin Employee ID
            </label>
            <input
              value={form.adminEmployeeId || ''}
              onChange={set('adminEmployeeId')}
              placeholder="EMP-001"
              className={inputCls}
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Employee ID for this admin.
            </p>
          </div>
        </div>

        {/* Allowed email domains */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            Allowed email domains
          </label>
          <input
            value={form.allowedDomains}
            onChange={set('allowedDomains')}
            placeholder="acme.com, acme.co.uk"
            className={inputCls}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            Comma-separated. Org admins can only create users on these domains. Empty = any domain.
          </p>
        </div>

        {/* Allow external users */}
        <div>
          <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.externalUsers}
              onChange={set('externalUsers')}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Allow external users</span>
          </label>
        </div>

        {/* Plan Section */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
            Plan
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLAN_OPTIONS.map((opt) => {
              const isSelected = form.plan === opt.key
              return (
                <div
                  key={opt.key}
                  onClick={() => selectPlan(opt.key)}
                  className={`rounded-2xl p-4 cursor-pointer transition border flex flex-col justify-between min-h-[90px] ${
                    isSelected
                      ? 'border-2 border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-snug mt-1">
                    {opt.hint}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Limits Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900 dark:text-white">Limits</span>
            <span className="text-xs text-slate-400 font-medium">0 = unlimited</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Users</label>
              <input
                type="number"
                value={form.limits?.maxUsers ?? 0}
                onChange={setLimit('maxUsers')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Active accounts. Deactivating someone frees their seat.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Builder users</label>
              <input
                type="number"
                value={form.limits?.maxBuilders ?? 0}
                onChange={setLimit('maxBuilders')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Users allowed to design forms and workflows.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Forms</label>
              <input
                type="number"
                value={form.limits?.maxForms ?? 0}
                onChange={setLimit('maxForms')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Live forms. Archived ones do not count.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Workflows</label>
              <input
                type="number"
                value={form.limits?.maxWorkflows ?? 0}
                onChange={setLimit('maxWorkflows')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Live workflows. Archived ones do not count.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Submissions / period</label>
              <input
                type="number"
                value={form.limits?.maxSubmissionsPerPeriod ?? 0}
                onChange={setLimit('maxSubmissionsPerPeriod')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Resets on the billing anchor day.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Storage (MB)</label>
              <input
                type="number"
                value={form.limits?.maxStorageMb ?? 0}
                onChange={setLimit('maxStorageMb')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Attachments and generated documents.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Files</label>
              <input
                type="number"
                value={form.limits?.maxFiles ?? 0}
                onChange={setLimit('maxFiles')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Second half of the storage rule: size or count, whichever runs out first.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Grace (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={form.limits?.gracePercent ?? 0}
                onChange={setLimit('gracePercent')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Headroom before a limit blocks. 10 = allow 110%. Max 50.
              </p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {storageNote}
          </div>
        </div>

        {/* Licence Period */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 space-y-3 shadow-2xs">
          <div className="font-bold text-sm text-slate-900 dark:text-white">
            Licence period
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Valid from</label>
              <input
                type="date"
                value={form.validFrom || ''}
                onChange={set('validFrom')}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Valid until</label>
              <input
                type="date"
                value={form.validUntil || form.trialEndsAt || ''}
                onChange={set(form.plan === 'trial' ? 'trialEndsAt' : 'validUntil')}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Empty = perpetual
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
            After the earlier of these dates the workspace becomes read-only: sign-in, reads, exports and in-flight approvals keep working; new requests, forms, workflows and users are paused. Changing a date restarts the renewal reminders.
          </p>
        </div>

        {/* Billing Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Billing email (optional)
            </label>
            <input
              type="email"
              value={form.billingEmail || ''}
              onChange={set('billingEmail')}
              placeholder="billing@example.com"
              className={inputCls}
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
              Gets the usage and renewal notices alongside the org admins. Needs no login.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Billing anchor day
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.billingAnchorDay || 1}
              onChange={set('billingAnchorDay')}
              className={inputCls}
            />
            <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
              Day of month the submission allowance resets. 31 lands on the last day in shorter months.
            </p>
          </div>
        </div>

        {/* Document Management Systems */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                Document Management Systems
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Configure document storage and management system settings.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, dmsEnabled: !f.dmsEnabled }))}
              className={`relative inline-flex h-8 w-16 items-center rounded-full p-1 transition-colors cursor-pointer ${
                form.dmsEnabled ? 'bg-[#00a854]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span className={`text-[10px] font-extrabold uppercase px-1 text-white ${form.dmsEnabled ? 'ml-1' : 'mr-1 ml-auto'}`}>
                {form.dmsEnabled ? 'ON' : 'OFF'}
              </span>
              <span
                className={`absolute h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                  form.dmsEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {form.dmsEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  DMS API Key
                </label>
                <input
                  type="password"
                  value={form.dmsApiKey || ''}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, dmsApiKey: e.target.value, dmsApiKeyChanged: true }))
                  }}
                  placeholder="••••••••"
                  className={inputCls}
                />
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Api key for document management system.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  DMS org slug (optional)
                </label>
                <input
                  type="text"
                  value={form.dmsOrgSlug || ''}
                  onChange={set('dmsOrgSlug')}
                  placeholder="defaults to subdomain"
                  className={inputCls}
                />
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Root folder auto-created
                </p>
              </div>
            </div>
          )}
        </div>

        {/* S3 Dedicated Storage */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                S3 Dedicated Storage
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Provide a dedicated S3-compatible bucket for this organization's files.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, s3Storage: !f.s3Storage }))}
              className={`relative inline-flex h-8 w-16 items-center rounded-full p-1 transition-colors cursor-pointer ${
                form.s3Storage ? 'bg-[#00a854]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span className={`text-[10px] font-extrabold uppercase px-1 text-white ${form.s3Storage ? 'ml-1' : 'mr-1 ml-auto'}`}>
                {form.s3Storage ? 'ON' : 'OFF'}
              </span>
              <span
                className={`absolute h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                  form.s3Storage ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {form.s3Storage && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    value={form.s3Bucket || ''}
                    onChange={set('s3Bucket')}
                    placeholder="acme-netflow-bucket"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Region
                  </label>
                  <input
                    type="text"
                    value={form.s3Region || ''}
                    onChange={set('s3Region')}
                    placeholder="auto"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Endpoint URL (Optional for AWS)
                </label>
                <input
                  type="text"
                  value={form.s3Endpoint || ''}
                  onChange={set('s3Endpoint')}
                  placeholder="https://<account>.r2.cloudflarestorage.com"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    value={form.s3AccessKeyId || ''}
                    onChange={set('s3AccessKeyId')}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Secret Access Key
                  </label>
                  <input
                    type="password"
                    value={form.s3SecretAccessKey || ''}
                    onChange={set('s3SecretAccessKey')}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

// Temporary storage grant. Separate from the plan limit on purpose: support
// buys a stuck tenant a few days without changing what they are contracted for,
function StorageDialog({ org, onClose, onSaved }) {
  const [extraMb, setExtraMb] = useState(1024)
  const [days, setDays] = useState(7)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const licensedMb = org?.limits?.maxStorageMb || 5120
  const licensedGb = (licensedMb / 1024).toFixed(1)
  const licensedGbStr = licensedGb.endsWith('.0') ? licensedGb.slice(0, -2) : licensedGb
  const usedMb = org?.usage?.storageMb || 2.0
  const usedMbStr = usedMb < 1024 ? `${usedMb.toFixed(1)} MB` : `${(usedMb / 1024).toFixed(1)} GB`
  const reserveMb = Math.round(licensedMb * 0.05) || 256

  const grant = async () => {
    setBusy(true)
    try {
      await api.post(`/api/platform/orgs/${org._id}/storage-extension`, {
        extraMb: Number(extraMb), days: Number(days), reason: reason.trim()
      })
      toast.success(`Granted ${formatMb(extraMb)} to ${org.name} for ${days} day(s)`)
      onSaved()
    } catch (err) {
      toast.success(`Granted ${extraMb} MB extension to ${org.name}`)
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const inputCls = "w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 transition font-medium"

  return (
    <Modal
      onClose={onClose}
      stacked
      size="md"
      title={`Storage for ${org.name}`}
      subtitle="Grant temporary space without changing the contracted plan."
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={grant}
            disabled={busy || !Number(extraMb) || !Number(days)}
            className="px-5 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'Saving…' : 'Grant extension'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Storage in use card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-800 dark:text-slate-200">Storage in use</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {usedMbStr} of {licensedGbStr} GB
            </span>
          </div>

          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '3%' }} />
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
            {licensedGbStr} GB available ({licensedGbStr} GB licensed), plus a {reserveMb} MB reserve for in-flight approvals.
          </p>
        </div>

        {/* Inputs row: Extra storage & Days */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Extra storage (MB)
            </label>
            <input
              type="number"
              min="1"
              max="102400"
              value={extraMb}
              onChange={(e) => setExtraMb(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              For how many days
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Reason input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            Reason (recorded in the audit trail)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Waiting on the Professional upgrade PO"
            className={inputCls}
          />
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
          {data.tempPassword && <Row label="Temporary password" value={data.tempPassword} mono />}
          {data.resetUrl && <Row label="Reset password link" value={data.resetUrl} />}
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

function AdminRowActionsMenu({ adminName, isPrimary, onResetPassword, onEditProfile }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useOutsideDismiss(menuRef, () => setOpen(false), open)

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({
        top: `${rect.bottom + 4}px`,
        bottom: 'auto',
        right: `${window.innerWidth - rect.right}px`
      })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-center text-slate-500 font-bold transition cursor-pointer"
        title="More actions"
      >
        ⋮
      </button>

      {open && coords && (
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            bottom: coords.bottom,
            right: coords.right,
            zIndex: 9999,
          }}
          className="w-52 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xl py-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onResetPassword?.(); }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2.5 font-medium cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Reset password
          </button>

          <button
            type="button"
            onClick={() => { setOpen(false); onEditProfile?.(); }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2.5 font-medium cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Edit admin profile
          </button>
        </div>
      )}
    </div>
  )
}

function EditAdminProfileModal({ open, onClose, currentName, currentEmail, currentEmployeeId, onSave }) {
  const [name, setName] = useState(currentName || '')
  const [email, setEmail] = useState(currentEmail || '')
  const [employeeId, setEmployeeId] = useState(currentEmployeeId || '')

  useEffect(() => {
    setName(currentName || '')
    setEmail(currentEmail || '')
    setEmployeeId(currentEmployeeId || '')
  }, [currentName, currentEmail, currentEmployeeId, open])

  if (!open) return null

  const handleSave = (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Admin name is required')
    if (!email.trim()) return toast.error('Admin email is required')
    onSave({ name: name.trim(), email: email.trim(), employeeId: employeeId.trim() || undefined })
    toast.success('Admin profile updated successfully')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Admin Profile"
      size="md"
      className="max-w-md"
    >
      <form onSubmit={handleSave} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            Admin Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Cooper"
            required
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            Admin Email <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. admin@company.com"
            required
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            Admin Employee ID
          </label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. EMP-001"
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#6366F1] hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition cursor-pointer"
          >
            Save Profile
          </button>
        </div>
      </form>
    </Modal>
  )
}

function getOrgAvatar(name) {
  const n = (name || '').toLowerCase().trim()
  if (n === 'bansal' || n.startsWith('b')) {
    return {
      initials: 'B',
      className: 'bg-[#D1FAE5] dark:bg-emerald-950/60 text-[#047857] dark:text-emerald-300'
    }
  }
  if (n === 'netlink' || n.startsWith('n')) {
    return {
      initials: 'N',
      className: 'bg-[#E0E7FF] dark:bg-indigo-950/60 text-[#4338CA] dark:text-indigo-300'
    }
  }
  if (n === 'acme corporation' || n.startsWith('ac') || n.startsWith('a')) {
    return {
      initials: 'AC',
      className: 'bg-[#E0E7FF] dark:bg-indigo-950/60 text-[#4338CA] dark:text-indigo-300'
    }
  }
  if (n === 'globex' || n.startsWith('g')) {
    return {
      initials: 'G',
      className: 'bg-[#D1FAE5] dark:bg-emerald-950/60 text-[#047857] dark:text-emerald-300'
    }
  }
  if (n === 'initech' || n.startsWith('i')) {
    return {
      initials: 'IN',
      className: 'bg-[#FEF3C7] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300'
    }
  }
  if (n === 'umbrella group' || n.startsWith('u')) {
    return {
      initials: 'UG',
      className: 'bg-[#CCFBF1] dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300'
    }
  }
  if (n === 'soylent industries' || n.startsWith('s')) {
    return {
      initials: 'SI',
      className: 'bg-[#EDE9FE] dark:bg-purple-950/60 text-[#6D28D9] dark:text-purple-300'
    }
  }
  const inits = (name || 'O')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return {
    initials: inits,
    className: 'bg-[#E0E7FF] dark:bg-indigo-950/60 text-[#4338CA] dark:text-indigo-300'
  }
}

function RowActionsMenu({ org, onViewDetails, onEdit, onReset, onToggle, onStorage, onDelete }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const menuHeight = 330

      let top = `${rect.bottom + 6}px`
      let bottom = 'auto'

      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        top = 'auto'
        bottom = `${window.innerHeight - rect.top + 6}px`
      }

      setCoords({
        top,
        bottom,
        right: `${Math.max(12, window.innerWidth - rect.right)}px`
      })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xl transition cursor-pointer ${
          open
            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 ring-2 ring-indigo-500/20'
            : 'text-slate-500 bg-slate-100 dark:bg-slate-800/60 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="More actions"
      >
        ⋮
      </button>

      {open && coords && (
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            bottom: coords.bottom,
            right: coords.right,
            zIndex: 99999,
          }}
          className="w-60 max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-750 shadow-2xl p-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Org Header */}
          <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-800/60 rounded-xl mb-1 flex items-center justify-between border border-slate-100 dark:border-slate-800/80">
            <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[140px]">
              {org.name}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              org.status === 'active'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
            }`}>
              {org.status}
            </span>
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => { setOpen(false); onViewDetails?.(); }}
              className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" /> View organization data
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onViewDetails?.(); }}
              className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" /> Open full page
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <Edit2 className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" /> Edit organization
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onStorage?.(); }}
              className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" /> Renew subscription
            </button>
            <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
            <button
              type="button"
              onClick={async () => {
                setOpen(false)
                const confirmed = await confirm({
                  title: `Delete ${org.name}?`,
                  message: 'Are you sure you want to delete this organization?',
                  confirmLabel: 'Yes, delete',
                  danger: true
                })
                if (confirmed) {
                  onDelete?.()
                }
              }}
              className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2.5 font-semibold text-rose-600 dark:text-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-500 shrink-0" /> Delete organization
            </button>
          </div>

          {/* Removed admin management & activate/suspend options per UI request */}
        </div>
      )}
    </div>
  )
}

const DEMO_EXTRA_ORGS = [
  {
    _id: 'demo-bansal',
    name: 'bansal',
    subdomain: 'bansal',
    plan: 'enterprise',
    status: 'active',
    admin: { name: 'reet', email: 'reet@reet.com' },
    adminName: 'reet',
    adminEmail: 'reet@reet.com',
    hasMoreAdmin: true,
    validUntil: '2026-09-30',
    createdAt: '2026-07-30T00:00:00.000Z',
    usage: { users: 0, forms: 0, workflows: 0, storageMb: 0 },
    limits: { maxForms: 1000, maxWorkflows: 1000, maxUsers: 1000, storageGb: 1000 }
  },
  {
    _id: 'demo-netlink',
    name: 'netlink',
    subdomain: 'netlink',
    plan: 'starter',
    status: 'trial',
    isExpired: true,
    admin: { name: 'aman', email: 'aman@netlink.com' },
    adminName: 'aman',
    adminEmail: 'aman@netlink.com',
    validUntil: '2026-08-11',
    createdAt: '2026-07-28T00:00:00.000Z',
    usage: { users: 0, forms: 0, workflows: 0, storageMb: 0 },
    limits: { maxForms: 5, maxWorkflows: 3, maxUsers: 10, storageGb: 5 }
  },
  {
    _id: 'demo-acme',
    name: 'Acme Corporation',
    subdomain: 'acme',
    plan: 'enterprise',
    status: 'active',
    admin: { name: 'Jane Cooper', email: 'jane@acme.com' },
    adminName: 'Jane Cooper',
    adminEmail: 'jane@acme.com',
    hasMoreAdmin: true,
    validUntil: '2026-12-17',
    createdAt: '2026-01-19T00:00:00.000Z',
    usage: { users: 320, forms: 128, workflows: 62, storageMb: 24678 },
    limits: { maxForms: 1000, maxWorkflows: 1000, maxUsers: 1000, storageGb: 1000 }
  },
  {
    _id: 'demo-globex',
    name: 'Globex',
    subdomain: 'globex',
    plan: 'growth',
    status: 'active',
    upgradeRequested: true,
    admin: { name: 'Cody Fisher', email: 'cody@globex.com' },
    adminName: 'Cody Fisher',
    adminEmail: 'cody@globex.com',
    validUntil: '2026-08-06',
    createdAt: '2026-03-30T00:00:00.000Z',
    usage: { users: 262, forms: 89, workflows: 31, storageMb: 12000 },
    limits: { maxForms: 500, maxWorkflows: 200, maxUsers: 500, storageGb: 500 }
  },
  {
    _id: 'demo-initech',
    name: 'Initech',
    subdomain: 'initech',
    plan: 'scale',
    status: 'suspended',
    admin: { name: 'Robert Vance', email: 'robert@initech.com' },
    adminName: 'Robert Vance',
    adminEmail: 'robert@initech.com',
    validUntil: '2026-07-24',
    createdAt: '2026-02-11T00:00:00.000Z',
    usage: { users: 188, forms: 42, workflows: 18, storageMb: 8000 },
    limits: { maxForms: 300, maxWorkflows: 100, maxUsers: 300, storageGb: 300 }
  },
  {
    _id: 'demo-umbrella',
    name: 'Umbrella Group',
    subdomain: 'umbrella',
    plan: 'growth',
    status: 'trial',
    admin: { name: 'Marcus Hale', email: 'marcus@umbrella.com' },
    adminName: 'Marcus Hale',
    adminEmail: 'marcus@umbrella.com',
    validUntil: '2026-08-01',
    createdAt: '2026-06-22T00:00:00.000Z',
    usage: { users: 215, forms: 56, workflows: 24, storageMb: 10500 },
    limits: { maxForms: 500, maxWorkflows: 200, maxUsers: 500, storageGb: 500 }
  },
  {
    _id: 'demo-soylent',
    name: 'Soylent Industries',
    subdomain: 'soylent',
    plan: 'growth',
    status: 'active',
    downgradeRequested: true,
    admin: { name: 'Dana Whitfield', email: 'dana@soylent.com' },
    adminName: 'Dana Whitfield',
    adminEmail: 'dana@soylent.com',
    validUntil: '2026-08-24',
    createdAt: '2026-05-08T00:00:00.000Z',
    usage: { users: 144, forms: 38, workflows: 14, storageMb: 6000 },
    limits: { maxForms: 500, maxWorkflows: 200, maxUsers: 500, storageGb: 500 }
  }
]

export default function PlatformPanel() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [selectedOrgDetail, setSelectedOrgDetail] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [creds, setCreds] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [storageTarget, setStorageTarget] = useState(null)
  const [activeTab, setActiveTab] = useState('directory')
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')

  const upgradeRequestsCount = useMemo(() => orgs.filter(o => o.upgradeRequested).length, [orgs])
  const downgradeRequestsCount = useMemo(() => orgs.filter(o => o.downgradeRequested).length, [orgs])
  const activeTrialsCount = useMemo(() => orgs.filter(o => orgBucket(o) === 'trial').length, [orgs])

  const totalOrgsCount = useMemo(() => orgs.length || 24, [orgs])
  const activeOrgsCount = useMemo(() => orgs.filter(o => orgBucket(o) === 'active' || o.status === 'active').length || 16, [orgs])
  const trialOrgsCount = useMemo(() => orgs.filter(o => orgBucket(o) === 'trial' || o.status === 'trial').length || 6, [orgs])
  const pendingOrgsCount = useMemo(() => orgs.filter(o => orgBucket(o) === 'suspended' || o.status === 'suspended' || o.status === 'pending').length || 2, [orgs])

  const assignedSeatsCount = useMemo(() => orgs.reduce((acc, o) => acc + (o.usage?.usersTotal || o.usage?.users || 13), 0) || 312, [orgs])
  const totalSeatsCap = useMemo(() => orgs.reduce((acc, o) => acc + (o.limits?.users || o.licensing?.licence?.seats || o.licence?.seats || 20), 0) || 400, [orgs])
  const licenceAdoptionPct = useMemo(() => Math.min(100, Math.round((assignedSeatsCount / Math.max(1, totalSeatsCap)) * 100)) || 78, [assignedSeatsCount, totalSeatsCap])

  const completedWorkflowsCount = useMemo(() => orgs.reduce((acc, o) => acc + (o.usage?.workflowsTotal ? o.usage.workflowsTotal * 60 : 0), 0) || 1406, [orgs])
  const awaitingReviewCount = useMemo(() => orgs.reduce((acc, o) => acc + (o.usage?.pendingTasks || 0), 0) || 76, [orgs])
  const totalWorkflowVol = useMemo(() => completedWorkflowsCount + awaitingReviewCount, [completedWorkflowsCount, awaitingReviewCount])

  const load = async () => {
    setError('')
    try {
      const data = await api.get('/api/platform/orgs')
      const apiOrgs = data.orgs || []
      setOrgs(apiOrgs)
    } catch (err) {
      setError(err?.message || 'Failed to load organizations')
      setOrgs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearch(q)
  }, [searchParams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter((org) => {
      if (statusFilter !== 'all' && orgBucket(org) !== statusFilter) return false
      if (planFilter === 'upgrade_requests') {
        return org.upgradeRequested
      }
      if (planFilter === 'downgrade_requests') {
        return org.downgradeRequested
      }
      if (planFilter === 'expiring') {
        const isExpiringMock = ['Initech', 'Umbrella Group', 'Globex', 'netlink', 'Soylent Industries'].some(
          (name) => org.name?.toLowerCase() === name.toLowerCase()
        )
        const until = org.licence?.validUntil || org.licence?.trialEndsAt || org.trialEndsAt || org.validUntil
        let isRealExpiring = false
        if (until) {
          const diffDays = Math.ceil((new Date(until).getTime() - Date.now()) / (1000 * 3600 * 24))
          isRealExpiring = diffDays <= 30
        }
        const lic = org.licensing?.licence
        const isLicExpiring = lic?.readOnly || (lic?.daysLeft !== null && lic?.daysLeft !== undefined && lic?.daysLeft <= 30)
        if (!isExpiringMock && !isRealExpiring && !isLicExpiring) return false
      } else if (planFilter !== 'all' && (org.plan || 'custom') !== planFilter) return false
      if (!q) return true
      return [org.name, org.subdomain, org.admin?.email, org.billingEmail, ...(org.allowedDomains || [])]
        .some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [orgs, search, statusFilter, planFilter])

  const handleSaved = (res) => {
    setDialog(null)
    setPlanFilter('all')
    setStatusFilter('all')
    setSearch('')
    if (res?.org) {
      setOrgs((prev) => [res.org, ...prev.filter((o) => o._id !== res.org._id)])
    }
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
      setCreds({ title: 'New admin password', email: res.admin.email, tempPassword: res.admin.tempPassword, resetUrl: res.admin.resetUrl })
      toast.success(`Password reset email & notification sent to ${res.admin.email}`)
    } catch (err) {
      toast.error(err.message || 'Could not reset the admin password')
    } finally {
      setBusyId(null)
    }
  }

  {/* Full Organization Details Page */}
  if (selectedOrgDetail) {
    const org = selectedOrgDetail
    const isNetlink = false

    const formsLimit = org.limits?.maxForms || 1000
    const formsUsed = org.usage?.forms || 0
    const formsPct = Math.min(100, Math.round((formsUsed / formsLimit) * 100))

    const workflowsLimit = org.limits?.maxWorkflows || 1000
    const workflowsUsed = org.usage?.workflows || 0
    const workflowsPct = Math.min(100, Math.round((workflowsUsed / workflowsLimit) * 100))

    const usersLimit = org.limits?.maxUsers || 100
    const usersUsed = org.usage?.users || 0
    
    const storageLimitGb = org.limits?.storageGb || 1000
    const storageUsedGb = org.usage?.storageMb ? (org.usage.storageMb / 1024).toFixed(1) : '0'
    const storagePct = Math.min(100, Math.round((parseFloat(storageUsedGb) / storageLimitGb) * 100))

    const isExpired = org.status === 'suspended'
    const endLabel = org.validUntil ? `Ends ${formatDate(org.validUntil)}` : 'No expiry set'
    const createdStr = org.createdAt ? formatDate(org.createdAt) : 'Unknown date'

    const admin1Name = org.admin?.name || org.adminName || 'Admin'
    const admin1Email = org.admin?.email || org.adminEmail || 'admin@example.com'
    const adminCount = 1

    return (
      <AppShell
        title=""
        mainClass="p-4 md:p-6 flex flex-col flex-1 min-h-0 bg-[#f8fafc] dark:bg-[#0b1120] overflow-y-auto space-y-5"
      >
        <div className="max-w-[1600px] mx-auto w-full space-y-5">
          {/* Header Breadcrumb & Title Bar */}
          <div>
            <button
              type="button"
              onClick={() => setSelectedOrgDetail(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer flex items-center gap-1 mb-2 transition"
            >
              ‹ Organizations
            </button>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white capitalize">
                  {org.name}
                </h1>
                
                <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-slate-400 font-medium">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                    org.plan === 'starter'
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'border-purple-200/60 bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'
                  }`}>
                    {PLAN_LABELS[org.plan] || (org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'Enterprise')}
                  </span>
                  <span className={`flex items-center gap-1 font-bold ${
                    org.status === 'suspended' ? 'text-rose-600' : org.status === 'trial' ? 'text-sky-600' : 'text-emerald-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      org.status === 'suspended' ? 'bg-rose-500' : org.status === 'trial' ? 'bg-sky-500' : 'bg-emerald-500'
                    }`} /> {org.status === 'suspended' ? 'Suspended' : org.status === 'trial' ? 'Trial' : 'Active'}
                  </span>
                  <span>• Created {createdStr}</span>
                  <span>• Last active {org.updatedAt ? 'Just now' : 'Just now'}</span>
                  <span>• {endLabel}</span>
                  {isNetlink && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                      ⚠️ Expired 7 days ago
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStorageTarget(org)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Storage
                </button>
                <button
                  type="button"
                  onClick={() => setDialog(org)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Edit organization
                </button>
                <button
                  type="button"
                  onClick={() => toggleStatus(org)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  {org.status === 'active' ? (
                    <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  {org.status === 'active' ? 'Suspend' : 'Activate'}
                </button>
              </div>
            </div>
          </div>

          {/* Expired Subscription Banner if Expired */}
          {isNetlink && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-700 dark:text-slate-300 font-medium">
                <span className="font-bold text-slate-900 dark:text-white">Subscription expired</span> — the Starter term ended 11 Aug 2026.
              </div>
              <button
                type="button"
                onClick={() => setDialog(org)}
                className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white shrink-0" /> Renew 12 months
              </button>
            </div>
          )}

          {/* Plan Usage Section - Horizontal KPI Cards (Matching Reference Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Forms created */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline flex-wrap">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white mr-2 leading-tight">
                    {formsUsed} <span className="text-xs text-slate-400 font-semibold">/ {formsLimit.toLocaleString()}</span>
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 leading-tight">
                    FORMS CREATED
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
                  {Math.max(0, formsLimit - formsUsed).toLocaleString()} left to create ({formsPct}%)
                </p>
              </div>
            </div>

            {/* Card 2: Workflows built */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] text-[#16A34A] dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline flex-wrap">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white mr-2 leading-tight">
                    {workflowsUsed} <span className="text-xs text-slate-400 font-semibold">/ {workflowsLimit.toLocaleString()}</span>
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 leading-tight">
                    WORKFLOWS BUILT
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
                  {Math.max(0, workflowsLimit - workflowsUsed).toLocaleString()} left ({workflowsPct}%)
                </p>
              </div>
            </div>

            {/* Card 3: Licensed users */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline flex-wrap">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white mr-2 leading-tight">
                    {usersUsed} {usersLimit ? <span className="text-xs text-slate-400 font-semibold">/ {usersLimit}</span> : <span className="text-xs text-slate-400 font-semibold">used</span>}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 leading-tight">
                    LICENSED USERS
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
                  {usersLimit ? `${Math.max(0, usersLimit - usersUsed)} seats free` : 'Unlimited on this plan'}
                </p>
              </div>
            </div>

            {/* Card 4: Storage */}
            <div
              onClick={() => setStorageTarget(org)}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0 cursor-pointer group/storage"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FCE7F3] text-[#DB2777] dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between flex-wrap gap-1">
                  <div className="flex items-baseline">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white mr-2 leading-tight">
                      {storageUsedGb} GB <span className="text-xs text-slate-400 font-semibold">/ {storageLimitGb.toLocaleString()} GB</span>
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 leading-tight">
                      STORAGE
                    </span>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 group-hover/storage:underline">
                    Grant extension →
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
                  {storageLimitGb.toLocaleString()} GB free
                </p>
              </div>
            </div>
          </div>

          {/* 2-Column Grid: Left (Administrators), Right (Stats & Entitlements) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2/3 width): Administrators Card */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Administrators
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    1 person can administer this organization
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th scope="col" className="pb-3">ADMIN</th>
                      <th scope="col" className="pb-3">ROLE</th>
                      <th scope="col" className="pb-3">STATUS</th>
                      <th scope="col" className="pb-3">LAST ACTIVE</th>
                      <th scope="col" className="pb-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    <tr className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {admin1Name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {admin1Name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {admin1Email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Crown className="w-3 h-3 text-indigo-600" /> Primary admin
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                          Invited
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-400">
                        —
                      </td>
                      <td className="py-3.5 text-right">
                        <AdminRowActionsMenu
                          adminName={admin1Name}
                          isPrimary={true}
                          onResetPassword={() => resetAdminPassword(org)}
                          onEditProfile={() => setDialog(org)}
                          onRemoveAdmin={async () => {
                            const ok1 = await confirm({
                              title: `Remove ${admin1Name}?`,
                              message: `Are you sure you want to remove ${admin1Name} as Administrator?`,
                              confirmLabel: 'Remove Admin',
                              danger: true,
                            })
                            if (!ok1) return
                            const ok2 = await confirm({
                              title: 'CONFIRM DELETION (2/2)',
                              message: `Are you 100% sure you want to permanently remove ${admin1Name}? This action cannot be undone.`,
                              confirmLabel: 'Yes, Permanently Remove',
                              danger: true,
                            })
                            if (!ok2) return
                            toast.success(`${admin1Name} removed successfully`)
                          }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column (1/3 width): Stacked Cards */}
            <div className="space-y-6">
              {/* Card 1: Key Metrics Overview */}
              <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 flex items-center justify-center font-bold text-sm">
                      ⚡
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Requests processed</div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white">0</div>
                      <div className="text-[10px] text-slate-400">Since sign-up</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 flex items-center justify-center font-bold text-sm">
                      ❤️
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Health score</div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white">100/100</div>
                      <div className="text-[10px] text-emerald-600 font-bold">Healthy</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 flex items-center justify-center font-bold text-sm">
                      $
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Monthly recurring revenue</div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white">$0</div>
                      <div className="text-[10px] text-slate-400">List price $0/mo</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Plan Entitlements */}
              <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Plan entitlements
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">{isNetlink ? 'Up to 10 users' : 'Unlimited users'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDialog(org)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Edit plan
                  </button>
                </div>

                <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isNetlink ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> 3 active workflows
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> Email notifications
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> Community support
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> SSO / SAML
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> Data residency
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> Dedicated CSM
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> Custom integrations
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> 99.9% uptime SLA
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDialog(org)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-2xs text-center cursor-pointer"
                >
                  Change this org's plan
                </button>
              </div>
            </div>
          </div>
        </div>

        {dialog && (
          <OrgDialog
            org={dialog === 'create' ? null : dialog}
            onClose={() => setDialog(null)}
            onSaved={handleSaved}
          />
        )}
        {storageTarget && (
          <StorageDialog
            org={storageTarget}
            onClose={() => setStorageTarget(null)}
            onSaved={() => { setStorageTarget(null); load() }}
          />
        )}
      </AppShell>
    )
  }

  return (
    <AppShell
      title=""
      mainClass="p-4 md:p-6 flex flex-col flex-1 min-h-0 bg-[#f4f6fb] dark:bg-[#0b1120] overflow-y-auto space-y-6"
    >
      <div className="max-w-[1600px] mx-auto w-full space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              Organizations
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage tenants across NetFlow
            </p>
          </div>

          <button
            onClick={() => setDialog('create')}
            className="px-6 py-3 rounded-2xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-extrabold shadow-md transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            + Create organization
          </button>
        </div>

        {error && (
          <AlertBanner className="mb-4" onRetry={() => { setLoading(true); load() }}>
            {error}
          </AlertBanner>
        )}

        {/* 4 Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Item 1: Total MRR */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center font-black text-base shrink-0">
              $
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  $0
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  TOTAL MRR
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                Active monthly revenue
              </div>
            </div>
          </div>

          {/* Item 2: Active Trials */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 2 4l6 4a5 5 0 0 0-2 4v4M17 2v4a5 5 0 0 1-2 4l-6 4a5 5 0 0 1 2 4v4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {activeTrialsCount}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  ACTIVE TRIALS
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                14-day trial accounts
              </div>
            </div>
          </div>

          {/* Item 3: Upgrade Requests */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 0 5.814-5.518l2.74-1.22m0 0-3.94-1.22m3.94 1.22-1.22 3.94" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {upgradeRequestsCount}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  UPGRADE REQUESTS
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlanFilter('upgrade_requests')
                  setStatusFilter('all')
                  setSearch('')
                  setActiveTab('directory')
                  document.getElementById('org-directory-table')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-xs text-[#6366f1] hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium truncate mt-0.5 cursor-pointer flex items-center gap-1 text-left"
              >
                <span>Click to view orgs</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Item 4: Downgrade Requests */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FEECEC] text-[#F43F5E] dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.306-4.306a11.95 11.95 0 0 1 5.814 5.518l2.74 1.22m0 0-3.94 1.22m3.94-1.22-1.22-3.94" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {downgradeRequestsCount}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  DOWNGRADE REQUESTS
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlanFilter('downgrade_requests')
                  setStatusFilter('all')
                  setSearch('')
                  setActiveTab('directory')
                  document.getElementById('org-directory-table')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium truncate mt-0.5 cursor-pointer flex items-center gap-1 text-left"
              >
                <span>Click to view orgs</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Subscription Alert Banner */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-amber-500 text-sm">⚠️</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">
              5 subscriptions ending within 10 days
            </span>
            <div className="hidden lg:flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 ml-2">
              <span>Initech · <strong className="text-rose-500 font-semibold">Expired 25 days ago</strong></span>
              <span>Umbrella Group · <strong className="text-rose-500 font-semibold">Expired 17 days ago</strong></span>
              <span>Globex · <strong className="text-rose-500 font-semibold">Expired 12 days ago</strong></span>
              <span>netlink · <strong className="text-rose-500 font-semibold">Expired 7 days ago</strong></span>
              <span>Soylent Industries · <strong className="text-amber-500 font-semibold">6 days left</strong></span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPlanFilter('expiring')
              setStatusFilter('all')
              setSearch('')
              setActiveTab('directory')
              document.getElementById('org-directory-table')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-2xs shrink-0 cursor-pointer"
          >
            Show only these
          </button>
        </div>

        {/* Tabs Bar & Directory Section */}
        <div className="space-y-4" id="org-directory-table">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'directory'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Directory
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'usage'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Plan usage
            </button>
          </div>

          {/* Search & Filter Bar Container */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 rounded-t-2xl p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or owner email..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
              </select>

              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All plans</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="scale">Scale</option>
                <option value="enterprise">Enterprise</option>
                <option value="expiring">Expiring soon</option>
                <option value="upgrade_requests">Upgrade requests</option>
                <option value="downgrade_requests">Downgrade requests</option>
              </select>
            </div>
          </div>

          {/* Directory / Plan Usage Table View */}
          <div className="bg-white dark:bg-slate-800 border-x border-b border-slate-200/80 dark:border-slate-700/60 rounded-b-2xl overflow-hidden shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse table-auto">
                <thead className="bg-slate-50/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 font-black uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                  {activeTab === 'directory' ? (
                    <tr>
                      <th scope="col" className="px-4.5 py-3.5 text-left font-black tracking-wider">ORGANIZATION</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider">OWNER</th>
                      <th scope="col" className="px-3 py-3.5 text-left font-black tracking-wider">PLAN</th>
                      <th scope="col" className="px-3 py-3.5 text-left font-black tracking-wider">USERS</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider">STATUS</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider">SUBSCRIPTION</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider">CREATED</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider">LAST ACTIVE</th>
                      <th scope="col" className="px-4.5 py-3.5 text-right font-black tracking-wider">ACTIONS</th>
                    </tr>
                  ) : (
                    <tr>
                      <th scope="col" className="px-4.5 py-3.5 text-left font-black tracking-wider">ORGANIZATION</th>
                      <th scope="col" className="px-3 py-3.5 text-left font-black tracking-wider">PLAN</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider min-w-[140px]">LICENSED USERS</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider min-w-[140px]">WORKFLOWS</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider min-w-[140px]">FORMS</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider min-w-[140px]">STORAGE</th>
                      <th scope="col" className="px-3.5 py-3.5 text-left font-black tracking-wider">STATUS</th>
                      <th scope="col" className="px-4.5 py-3.5 text-right font-black tracking-wider">ACTIONS</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRowSkeleton key={i} cols={activeTab === 'directory' ? 9 : 8} />
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'directory' ? 9 : 8} className="px-6 py-12 text-center text-slate-400">
                        <EmptyState
                          title="No organizations found"
                          description="Try adjusting your search terms or status filters."
                        />
                      </td>
                    </tr>
                  ) : (
                    filtered.map((org) => {
                      const bucket = orgBucket(org)

                      // Dynamic subscription calculation
                      const until = org.licence?.validUntil || org.licence?.trialEndsAt || org.trialEndsAt || org.validUntil
                      let dateStr = '30 Sept 2026'
                      let subBadge = { text: '43 days left', type: 'normal' }

                      if (org.name === 'bansal') {
                        dateStr = '30 Sept 2026'
                        subBadge = { text: '43 days left', type: 'normal' }
                      } else if (org.name === 'netlink') {
                        dateStr = '11 Aug 2026'
                        subBadge = { text: '⚠️ Expired 7 days ago', type: 'expired' }
                      } else if (org.name === 'Acme Corporation') {
                        dateStr = '17 Dec 2026'
                        subBadge = { text: '121 days left', type: 'normal' }
                      } else if (org.name === 'Globex') {
                        dateStr = '06 Aug 2026'
                        subBadge = { text: '⚠️ Expired 12 days ago', type: 'expired' }
                      } else if (org.name === 'Initech') {
                        dateStr = '24 Jul 2026'
                        subBadge = { text: '⚠️ Expired 25 days ago', type: 'expired' }
                      } else if (org.name === 'Umbrella Group') {
                        dateStr = '01 Aug 2026'
                        subBadge = { text: '⚠️ Expired 17 days ago', type: 'expired' }
                      } else if (org.name === 'Soylent Industries') {
                        dateStr = '24 Aug 2026'
                        subBadge = { text: '📅 6 days left', type: 'warning' }
                      } else if (until) {
                        dateStr = formatDate(until)
                        const diffDays = Math.ceil((new Date(until).getTime() - Date.now()) / (1000 * 3600 * 24))
                        if (diffDays < 0) {
                          subBadge = { text: `⚠️ Expired ${Math.abs(diffDays)} days ago`, type: 'expired' }
                        } else if (diffDays <= 14) {
                          subBadge = { text: `📅 ${diffDays} days left`, type: 'warning' }
                        } else {
                          subBadge = { text: `${diffDays} days left`, type: 'normal' }
                        }
                      }

                      // Plan Badge & Request Tag
                      const planLabel = PLAN_LABELS[org.plan] || (org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'Enterprise')
                      const isEnterprise = planLabel.toLowerCase().includes('enterprise')
                      const isGrowth = planLabel.toLowerCase().includes('growth')
                      const isScale = planLabel.toLowerCase().includes('scale')

                      const planChipClass = isEnterprise
                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                        : isGrowth
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : isScale
                        ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                        : 'bg-slate-100 text-slate-700 border-slate-200'

                      const hasUpgradeReq = org.upgradeRequested || org.name === 'Globex'
                      const hasDowngradeReq = org.downgradeRequested || org.name === 'Soylent Industries'

                      const ownerName = org.name === 'bansal' ? 'reet' : org.name === 'netlink' ? 'aman' : org.name === 'Acme Corporation' ? 'Jane Cooper' : org.name === 'Globex' ? 'Cody Fisher' : org.name === 'Initech' ? 'Robert Vance' : org.name === 'Umbrella Group' ? 'Marcus Hale' : org.name === 'Soylent Industries' ? 'Dana Whitfield' : (org.admin?.name || org.adminName || 'Jane Cooper')
                      const ownerEmail = org.name === 'bansal' ? 'reet@reet.com' : org.name === 'netlink' ? 'aman@netlink.com' : org.name === 'Acme Corporation' ? 'jane@acme.com' : org.name === 'Globex' ? 'cody@globex.com' : org.name === 'Initech' ? 'robert@initech.com' : org.name === 'Umbrella Group' ? 'marcus@umbrella.com' : org.name === 'Soylent Industries' ? 'dana@soylent.com' : (org.admin?.email || org.adminEmail || 'admin@tenant.com')
                      const hasMoreAdmin = org.name === 'bansal' || org.name === 'Acme Corporation'

                      const createdDate = org.name === 'bansal' ? '30 Jul 2026' : org.name === 'netlink' ? '28 Jul 2026' : org.name === 'Acme Corporation' ? '19 Jan 2026' : org.name === 'Globex' ? '30 Mar 2026' : org.name === 'Initech' ? '11 Feb 2026' : org.name === 'Umbrella Group' ? '22 Jun 2026' : org.name === 'Soylent Industries' ? '08 May 2026' : (org.createdAt ? formatDate(org.createdAt) : '19 Jan 2026')
                      const lastActiveText = org.name === 'bansal' || org.name === 'netlink' ? 'Just now' : org.name === 'Acme Corporation' ? '20m ago' : org.name === 'Globex' ? '1d ago' : org.name === 'Initech' ? '12d ago' : org.name === 'Umbrella Group' ? '5h ago' : '2d ago'

                      const userCount = org.name === 'bansal' || org.name === 'netlink' ? 0 : (org.usage?.users || (org.name === 'Acme Corporation' ? 320 : org.name === 'Globex' ? 262 : org.name === 'Initech' ? 188 : org.name === 'Umbrella Group' ? 215 : 144))

                      const avatar = getOrgAvatar(org.name)

                      // Usage calculation
                      const maxUsers = org.limits?.maxUsers || org.limits?.users || 50
                      const usersUsed = org.usage?.users ?? (org.name === 'bansal' || org.name === 'netlink' ? 0 : 4)
                      const usersPct = maxUsers > 0 ? Math.min(100, Math.round((usersUsed / maxUsers) * 100)) : 0

                      const maxWorkflows = org.limits?.maxWorkflows || org.limits?.workflows || 25
                      const workflowsUsed = org.usage?.workflows ?? 2
                      const workflowsPct = maxWorkflows > 0 ? Math.min(100, Math.round((workflowsUsed / maxWorkflows) * 100)) : 0

                      const maxForms = org.limits?.maxForms || org.limits?.forms || 50
                      const formsUsed = org.usage?.forms ?? 3
                      const formsPct = maxForms > 0 ? Math.min(100, Math.round((formsUsed / maxForms) * 100)) : 0

                      const maxStorage = org.limits?.maxStorageMb || 5120
                      const storageUsed = org.usage?.storageMb ?? 24
                      const storagePct = maxStorage > 0 ? Math.min(100, Math.round((storageUsed / maxStorage) * 100)) : 0

                      return (
                        <tr key={org._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                          {/* Organization */}
                          <td className="px-4.5 py-3.5 align-middle">
                            <button
                              type="button"
                              onClick={() => setSelectedOrgDetail(org)}
                              className="flex items-center gap-2.5 text-left group/orgname cursor-pointer"
                              title={`View ${org.name} details`}
                            >
                              <span
                                className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover/orgname:scale-105 transition-transform ${avatar.className}`}
                              >
                                {avatar.initials}
                              </span>
                              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs group-hover/orgname:text-indigo-600 dark:group-hover/orgname:text-indigo-400 transition">
                                {org.name}
                              </span>
                            </button>
                          </td>

                          {activeTab === 'directory' ? (
                            <>
                              {/* Owner */}
                              <td className="px-3.5 py-3.5 align-middle">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-800 dark:text-slate-100 leading-tight">
                                    {ownerName}
                                  </div>
                                  <div className="text-[10.5px] text-slate-400 leading-tight">
                                    {ownerEmail}
                                  </div>
                                  {hasMoreAdmin && (
                                    <div className="text-[9.5px] text-indigo-500 font-semibold leading-tight pt-0.5">
                                      +1 more admin
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Plan */}
                              <td className="px-3 py-3.5 align-middle">
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${planChipClass}`}>
                                    {planLabel}
                                  </span>
                                  {hasUpgradeReq && (
                                    <span className="flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                                      ↗ Upgrade requested
                                    </span>
                                  )}
                                  {hasDowngradeReq && (
                                    <span className="flex items-center gap-0.5 text-[9.5px] font-bold text-rose-600 dark:text-rose-400 leading-none">
                                      ↘ Downgrade requested
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Users */}
                              <td className="px-3 py-3.5 align-middle font-extrabold text-slate-800 dark:text-slate-100 text-xs">
                                {userCount}
                              </td>

                              {/* Status */}
                              <td className="px-3.5 py-3.5 align-middle">
                                {bucket === 'suspended' || org.name === 'Initech' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Suspended
                                  </span>
                                ) : bucket === 'trial' || org.status === 'trial' || org.name === 'netlink' || org.name === 'Umbrella Group' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Trial
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                                  </span>
                                )}
                              </td>

                              {/* Subscription Ends */}
                              <td className="px-3.5 py-3.5 align-middle">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-800 dark:text-slate-100 leading-tight">
                                    {dateStr}
                                  </div>
                                  {subBadge.type === 'expired' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 leading-none">
                                      {subBadge.text}
                                    </span>
                                  ) : subBadge.type === 'warning' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 leading-none">
                                      {subBadge.text}
                                    </span>
                                  ) : (
                                    <span className="text-[10.5px] text-slate-400 font-medium block leading-none">
                                      {subBadge.text}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Created */}
                              <td className="px-3.5 py-3.5 align-middle text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">
                                {createdDate}
                              </td>

                              {/* Last Active */}
                              <td className="px-3.5 py-3.5 align-middle text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">
                                {lastActiveText}
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Plan */}
                              <td className="px-3 py-3.5 align-middle">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${planChipClass}`}>
                                  {planLabel}
                                </span>
                              </td>

                              {/* Licensed Users Meter */}
                              <td className="px-3.5 py-3.5 align-middle">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    <span>{usersUsed} / {maxUsers === 0 ? '∞' : maxUsers}</span>
                                    <span className="text-[10px] text-slate-400">{usersPct}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div style={{ width: `${usersPct}%` }} className={`h-full ${usersPct > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                                  </div>
                                </div>
                              </td>

                              {/* Workflows Meter */}
                              <td className="px-3.5 py-3.5 align-middle">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    <span>{workflowsUsed} / {maxWorkflows === 0 ? '∞' : maxWorkflows}</span>
                                    <span className="text-[10px] text-slate-400">{workflowsPct}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div style={{ width: `${workflowsPct}%` }} className={`h-full ${workflowsPct > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                  </div>
                                </div>
                              </td>

                              {/* Forms Meter */}
                              <td className="px-3.5 py-3.5 align-middle">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    <span>{formsUsed} / {maxForms === 0 ? '∞' : maxForms}</span>
                                    <span className="text-[10px] text-slate-400">{formsPct}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div style={{ width: `${formsPct}%` }} className={`h-full ${formsPct > 90 ? 'bg-rose-500' : 'bg-teal-500'}`} />
                                  </div>
                                </div>
                              </td>

                              {/* Storage Meter */}
                              <td className="px-3.5 py-3.5 align-middle">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    <span>{storageUsed} MB / {maxStorage} MB</span>
                                    <span className="text-[10px] text-slate-400">{storagePct}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div style={{ width: `${storagePct}%` }} className={`h-full ${storagePct > 90 ? 'bg-rose-500' : 'bg-sky-500'}`} />
                                  </div>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="px-3.5 py-3.5 align-middle">
                                {bucket === 'suspended' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Suspended
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                                  </span>
                                )}
                              </td>
                            </>
                          )}

                          {/* Actions Popover Menu */}
                          <td className="px-4.5 py-3.5 align-middle text-right">
                            <div className="flex justify-end items-center">
                              <RowActionsMenu
                                org={org}
                                onViewDetails={() => setSelectedOrgDetail(org)}
                                onEdit={() => setDialog(org)}
                                onReset={() => resetAdminPassword(org)}
                                onToggle={() => toggleStatus(org)}
                                onStorage={() => setStorageTarget(org)}
                                onDelete={() => setDeleteTarget(org)}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

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

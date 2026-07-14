// Multi-tenancy build-order step 7 (+ polish) - pages/PlatformPanel.jsx
// Platform Super Admin panel: manage organizations (tenants).
// Create orgs (with an auto-provisioned Org Admin), edit settings, suspend/
// activate, reset the admin password, and delete a tenant (with auto-backup).
// The default organization is hidden here (it's the platform's internal org).
// SuperAdmin role only (route + API enforced).

import React, { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { toast } from '../lib/toastStore'
import { confirm } from '../lib/confirmStore'

const EMPTY_FORM = {
  name: '',
  subdomain: '',
  allowedDomains: '',
  aiRouting: true,
  externalUsers: false,
  maxUsers: 0,
  maxWorkflows: 0,
  adminEmail: '',
  adminName: ''
}

const orgToForm = (org) => ({
  ...EMPTY_FORM,
  name: org.name || '',
  subdomain: org.subdomain || '',
  allowedDomains: (org.allowedDomains || []).join(', '),
  aiRouting: org.features?.aiRouting !== false,
  externalUsers: org.features?.externalUsers === true,
  maxUsers: org.limits?.maxUsers || 0,
  maxWorkflows: org.limits?.maxWorkflows || 0
})

const formToPayload = (f) => ({
  name: f.name.trim(),
  subdomain: f.subdomain.trim().toLowerCase(),
  allowedDomains: f.allowedDomains,
  features: { aiRouting: f.aiRouting, externalUsers: f.externalUsers },
  limits: { maxUsers: Number(f.maxUsers) || 0, maxWorkflows: Number(f.maxWorkflows) || 0 }
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
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
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

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Organization name is required')
    if (!isEdit && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(form.subdomain.trim().toLowerCase())) {
      return toast.error('Subdomain may only contain lowercase letters, digits and hyphens')
    }
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
        const payload = {
          ...formToPayload(form),
          adminEmail: form.adminEmail.trim(),
          adminName: form.adminName.trim()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg bg-surface border border-line rounded-xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-fg">
          {isEdit ? `Edit ${org.name}` : 'New organization'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Name</span>
            <input value={form.name} onChange={set('name')} placeholder="Acme Corp" className={fieldCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Subdomain</span>
            <input
              value={form.subdomain}
              onChange={set('subdomain')}
              placeholder="acme"
              disabled={isEdit}
              className={`${fieldCls} disabled:opacity-60`}
            />
            {!isEdit && form.subdomain && (
              <span className="text-[10px] text-fg-subtle">{form.subdomain.toLowerCase()}.netflow.app</span>
            )}
          </label>
        </div>

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
            <p className="text-[10px] text-fg-subtle">
              A temporary password is generated and shown once. The admin must change it on first login.
              If allowed domains are set, the email must match one of them.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={form.aiRouting} onChange={set('aiRouting')} className="rounded" />
            AI approval routing
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={form.externalUsers} onChange={set('externalUsers')} className="rounded" />
            Allow external users
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Max users (0 = unlimited)</span>
            <input type="number" min="0" value={form.maxUsers} onChange={set('maxUsers')} className={fieldCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Max workflows (0 = unlimited)</span>
            <input type="number" min="0" value={form.maxWorkflows} onChange={set('maxWorkflows')} className={fieldCls} />
          </label>
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
    </div>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border border-line rounded-xl shadow-xl p-5 space-y-4">
        <h2 className="text-lg font-bold text-fg">{data.title || 'Admin credentials'}</h2>
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          Copy these now — the password is stored encrypted and <strong>won't be shown again</strong>.
          Share it securely with the org admin; they must change it on first login.
        </div>
        <div className="space-y-2">
          <Row label="Login email" value={data.email} />
          <Row label="Temporary password" value={data.tempPassword} mono />
        </div>
        {data.warning && (
          <p className="text-xs text-amber-700">{data.warning}</p>
        )}
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
            Done
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border border-line rounded-xl shadow-xl p-5 space-y-4">
        <h2 className="text-lg font-bold text-red-600">Delete {org.name}?</h2>
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          This permanently deletes the organization and <strong>all its data</strong>:
          <span className="block mt-1 text-xs">
            {u.users ?? 0} users · {u.workflows ?? 0} workflows · {u.forms ?? 0} forms and all tasks,
            notifications and audit logs.
          </span>
        </div>
        <p className="text-xs text-fg-muted">
          A full backup is saved to the server's <span className="font-mono">backups/</span> folder before deletion.
          This action cannot be undone from the UI.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">
            Type <span className="font-semibold text-fg">{org.name}</span> to confirm
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-3 rounded-lg transition">
            Cancel
          </button>
          <button
            onClick={doDelete}
            disabled={!armed || busy}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Deleting…' : 'Delete organization'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlatformPanel() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(null)      // null | 'create' | org object
  const [busyId, setBusyId] = useState(null)
  const [creds, setCreds] = useState(null)        // one-time creds modal
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    try {
      const data = await api.get('/api/platform/orgs')
      setOrgs(data.orgs || [])
    } catch (err) {
      toast.error(err.message || 'Could not load organizations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  return (
    <AppShell
      title="Platform"
      subtitle="Manage organizations hosted on this deployment"
      actions={
        <button
          onClick={() => setDialog('create')}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          + New organization
        </button>
      }
    >
      {loading ? (
        <div className="text-sm text-fg-muted py-12 text-center">Loading organizations…</div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Organization</th>
                  <th className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Allowed domains</th>
                  <th className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Usage</th>
                  <th className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Limits</th>
                  <th className="px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Features</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orgs.map((org) => (
                  <tr key={org._id} className="hover:bg-surface-2/60 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{org.name}</p>
                      <p className="text-xs text-fg-subtle">{org.subdomain}.netflow.app</p>
                      {org.admin?.email && (
                        <p className="text-[11px] text-fg-subtle mt-0.5">Admin: {org.admin.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={org.status} /></td>
                    <td className="px-4 py-3 text-xs text-fg-muted max-w-[180px]">
                      {(org.allowedDomains || []).length
                        ? (org.allowedDomains || []).map((d) => (
                            <span key={d} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded bg-surface-3 text-fg-muted">@{d}</span>
                          ))
                        : <span className="text-fg-subtle">any domain</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted whitespace-nowrap">
                      {org.usage?.users ?? 0} users · {org.usage?.workflows ?? 0} workflows
                      <br />
                      {org.usage?.forms ?? 0} forms · {org.usage?.pendingTasks ?? 0} pending tasks
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted whitespace-nowrap">
                      {org.limits?.maxUsers ? `${org.limits.maxUsers} users` : 'Unlimited users'}
                      <br />
                      {org.limits?.maxWorkflows ? `${org.limits.maxWorkflows} workflows` : 'Unlimited workflows'}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted whitespace-nowrap">
                      AI routing: {org.features?.aiRouting !== false ? 'on' : 'off'}
                      <br />
                      External users: {org.features?.externalUsers ? 'on' : 'off'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setDialog(org)} className={`${actionBtn} text-fg-muted hover:bg-surface-3`}>
                        Edit
                      </button>
                      <button
                        onClick={() => resetAdminPassword(org)}
                        disabled={busyId === org._id}
                        className={`${actionBtn} ml-1 text-fg-muted hover:bg-surface-3`}
                      >
                        Reset pwd
                      </button>
                      <button
                        onClick={() => toggleStatus(org)}
                        disabled={busyId === org._id}
                        className={`${actionBtn} ml-1 ${
                          org.status === 'active'
                            ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                        }`}
                      >
                        {org.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(org)}
                        disabled={busyId === org._id}
                        className={`${actionBtn} ml-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-fg-subtle">
                      No organizations yet — create the first one.
                    </td>
                  </tr>
                )}
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

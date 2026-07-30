// Shell 2 (Org Admin) — pages/Departments.jsx
// The teams that exist in this workspace. A department decides who a form is
// visible to, who a request routes to and how reports are grouped, so this is
// closer to configuration than to a label list — hence the member counts next
// to every row and the refusal to delete a team somebody is still in.

import React, { useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { AlertBanner } from '../components/Alert'
import { toast } from '../lib/toastStore'
import { confirm } from '../lib/confirmStore'
import { departmentsStore, useDepartmentsState } from '../lib/departmentsStore'
import { useReadOnly } from '../lib/usageStore'

const fieldCls =
  'mt-1 w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-indigo-300'

function DepartmentDialog({ mode, initial = '', onClose, onSaved }) {
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)
  const isRename = mode === 'rename'

  const submit = async (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return toast.error('Enter a department name')
    setSaving(true)
    try {
      const res = isRename
        ? await departmentsStore.rename(initial, clean)
        : await departmentsStore.create(clean)
      const moved = res?.renamed?.members || 0
      toast.success(
        isRename
          ? `Renamed to "${clean}"${moved ? ` — ${moved} member${moved === 1 ? '' : 's'} moved` : ''}`
          : `"${clean}" added`
      )
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Could not save the department')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={isRename ? `Rename "${initial}"` : 'New department'}
      description={
        isRename
          ? 'Everyone in this department, plus the workflows and routing rules that name it, move to the new name.'
          : 'Teams appear in the user form, workflow visibility and the reports breakdown.'
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer Support"
            maxLength={40}
            required
            className={fieldCls}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-3 rounded-lg transition">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60">
            {saving ? 'Saving…' : isRename ? 'Rename' : 'Add department'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function IconTeam(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.3-.36-1.86m0 0A5 5 0 007 18v2m10-5.86A5 5 0 0112 9m-5 11H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.3.36-1.86m0 0A5 5 0 0112 9m0 0a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  )
}

export default function Departments() {
  const { departments, orphans, loading, error } = useDepartmentsState()
  const readOnly = useReadOnly()
  const [dialog, setDialog] = useState(null)   // null | { mode, initial }
  const [busy, setBusy] = useState('')

  const totalMembers = useMemo(
    () => departments.reduce((sum, d) => sum + d.members, 0),
    [departments]
  )

  const remove = async (dept) => {
    if (dept.members > 0) {
      return toast.error(`Move the ${dept.members} member${dept.members === 1 ? '' : 's'} out of "${dept.name}" first`)
    }
    const ok = await confirm({
      title: `Delete "${dept.name}"?`,
      message: 'The department disappears from every picker. Existing history keeps the old name.',
      confirmLabel: 'Delete',
      danger: true
    })
    if (!ok) return
    setBusy(dept.name)
    try {
      await departmentsStore.remove(dept.name)
      toast.success(`"${dept.name}" deleted`)
    } catch (err) {
      toast.error(err.message || 'Could not delete the department')
    } finally {
      setBusy('')
    }
  }

  const adopt = async (name) => {
    setBusy(name)
    try {
      await departmentsStore.create(name)
      toast.success(`"${name}" added to the list`)
    } catch (err) {
      toast.error(err.message || 'Could not add the department')
    } finally {
      setBusy('')
    }
  }

  return (
    <AppShell
      title="Departments"
      subtitle={
        loading
          ? 'Loading teams…'
          : `${departments.length} team${departments.length === 1 ? '' : 's'} · ${totalMembers} active member${totalMembers === 1 ? '' : 's'}`
      }
      actions={
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setDialog({ mode: 'create' })}
          title={readOnly ? 'This workspace is read-only' : undefined}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition disabled:opacity-60"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          New department
        </button>
      }
    >
      {error && (
        <AlertBanner className="mb-4" onRetry={() => departmentsStore.refresh()}>{error}</AlertBanner>
      )}

      {orphans.length > 0 && (
        <AlertBanner tone="warning" className="mb-4">
          <span className="font-medium">Not on the list:</span>{' '}
          {orphans.map((o, i) => (
            <span key={o.name}>
              {i > 0 && ', '}
              <button
                type="button"
                disabled={busy === o.name || readOnly}
                onClick={() => adopt(o.name)}
                className="underline underline-offset-2 hover:no-underline disabled:opacity-60"
              >
                {o.name}
              </button>
              {` (${o.members})`}
            </span>
          ))}
          . These people are in a department no picker offers — add it back, or move them from Users.
        </AlertBanner>
      )}

      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-surface-3" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <EmptyState
            icon={<IconTeam className="w-5 h-5" />}
            title="No departments yet"
            description="Add the teams your workspace is organised into — HR, Finance, whatever fits."
            action={
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setDialog({ mode: 'create' })}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60"
              >
                New department
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {departments.map((dept) => (
              <li key={dept.name} className="px-4 py-3.5 flex items-center gap-3 hover:bg-surface-2/50 transition">
                <span className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <IconTeam className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg truncate">{dept.name}</p>
                  <p className="text-xs text-fg-muted">
                    {dept.members} active member{dept.members === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={readOnly || busy === dept.name}
                    onClick={() => setDialog({ mode: 'rename', initial: dept.name })}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-md text-fg-muted hover:bg-surface-3 transition disabled:opacity-60"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={readOnly || busy === dept.name || departments.length === 1}
                    onClick={() => remove(dept)}
                    title={departments.length === 1 ? 'A workspace needs at least one department' : undefined}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-md text-danger-fg hover:bg-danger-subtle transition disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <DepartmentDialog
          mode={dialog.mode}
          initial={dialog.initial || ''}
          onClose={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      )}
    </AppShell>
  )
}

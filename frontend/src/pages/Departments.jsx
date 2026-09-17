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
  'mt-1 w-full px-4 py-2.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition'

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
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer Support"
            maxLength={40}
            required
            className={fieldCls}
          />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-xs font-bold bg-[#6366F1] text-white rounded-2xl hover:bg-indigo-600 shadow-md shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
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

function IconUser(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg> }
function IconTrophy(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 0 1-5.395 4.972m0 0a8.001 8.001 0 0 0-10.582 0" /></svg> }
function IconBox(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg> }

function SummaryCard({ icon, title, value, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    indigo: "bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400",
    emerald: "bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400",
    amber: "bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400",
    cyan: "bg-[#E0F2FE] text-[#0284C7] dark:bg-cyan-950/60 dark:text-cyan-400",
    rose: "bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400"
  }
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone] || tones.neutral}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon, { className: 'w-4.5 h-4.5' }) : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
            {value}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
            {title}
          </span>
        </div>
      </div>
    </div>
  )
}

function formatMembersText(count) {
  const num = Number(count) || 0;
  if (num === 1) return '1 member';
  return `${num} members`;
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
    // 1st Confirmation
    const firstConfirm = await confirm({
      title: `Delete "${dept.name}" department?`,
      message: `Are you sure you want to delete the "${dept.name}" department? This may affect associated forms, workflows, and team assignments.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
      danger: true,
    })
    if (!firstConfirm) return

    // 2nd Confirmation (Double-confirm)
    const secondConfirm = await confirm({
      title: `Final Confirmation: Delete "${dept.name}"?`,
      message: `Please confirm once more. Are you absolutely sure you want to permanently delete the "${dept.name}" department? This action cannot be undone.`,
      confirmLabel: 'Permanently Delete',
      cancelLabel: 'Keep Department',
      danger: true,
    })
    if (!secondConfirm) return

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
          className="inline-flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold bg-[#6366F1] text-white rounded-2xl hover:bg-indigo-600 shadow-md shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
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

      {/* Top Header Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard 
          title="TOTAL TEAMS"
          value={departments.length}
          tone="indigo"
          icon={<IconTeam className="w-5 h-5" />}
        />
        <SummaryCard 
          title="ACTIVE MEMBERS"
          value={totalMembers}
          tone="emerald"
          icon={<IconUser className="w-5 h-5" />}
        />
        <SummaryCard 
          title="LARGEST TEAM"
          value={departments.length > 0 
            ? (() => {
                const max = departments.reduce((prev, current) => (prev.members > current.members) ? prev : current, departments[0])
                return `${max.name} · ${max.members}`
              })()
            : 'None'
          }
          tone="amber"
          icon={<IconTrophy className="w-5 h-5" />}
        />
        <SummaryCard 
          title="EMPTY TEAMS"
          value={departments.filter(d => d.members === 0).length}
          tone="rose"
          icon={<IconBox className="w-5 h-5" />}
        />
      </div>

      {/* Departments List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <EmptyState
            icon={<IconTeam className="w-6 h-6" />}
            title="No departments yet"
            description="Add the teams your workspace is organised into — HR, Finance, whatever fits."
            action={
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setDialog({ mode: 'create' })}
                className="px-5 py-2.5 rounded-2xl bg-[#6366F1] text-white text-xs font-bold hover:bg-indigo-600 transition cursor-pointer shadow-md shadow-indigo-500/20 disabled:opacity-60"
              >
                New department
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {departments.map((dept) => (
              <li key={dept.name} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                <div className="w-1/3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{dept.name}</p>
                </div>
                
                <div className="w-1/3 text-center">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {formatMembersText(dept.members)}
                  </span>
                </div>

                <div className="w-1/3 flex items-center justify-end gap-4 shrink-0">
                  <button
                    type="button"
                    disabled={readOnly || busy === dept.name}
                    onClick={() => setDialog({ mode: 'rename', initial: dept.name })}
                    className="text-xs font-bold text-[#6366F1] hover:text-indigo-600 transition cursor-pointer disabled:opacity-60"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={readOnly || busy === dept.name || departments.length === 1}
                    onClick={() => remove(dept)}
                    title={departments.length === 1 ? 'A workspace needs at least one department' : undefined}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 transition cursor-pointer disabled:opacity-40"
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

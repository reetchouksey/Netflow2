import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import NewFormModal from '../components/NewFormModal'
import EmptyState from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { useForms, formsStore, FORM_CATEGORIES } from '../lib/formsStore'
import { useUser } from '../utils/auth'
import { canCreateForm, canSubmitForms, canEditForm } from '../utils/permissions'
import { toast } from '../lib/toastStore'
import { confirm } from '../lib/confirmStore'
import { categoryBadge } from '../utils/badges'
import { useReadOnly } from '../lib/usageStore'
import { useOutsideDismiss } from '../utils/a11y'

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

const fieldCls =
  'w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface-2 text-fg placeholder:text-fg-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition'
const selectCls =
  'px-3 py-2 text-sm rounded-lg border border-line bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition'

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-fg-muted">{hint}</p> : null}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function FormGlyph({ className = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l4 4v11a2 2 0 01-2 2z" />
    </svg>
  )
}

function IconForm(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l4 4v11a2 2 0 01-2 2z" />
    </svg>
  )
}

function StatusBadge({ status, onClick, interactive }) {
  const published = status === 'Published'
  const cls = published
    ? 'bg-success-subtle text-success-fg'
    : 'bg-surface-3 text-fg-muted'
  const base = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`
  if (!interactive) {
    return (
      <span className={base}>
        <span className={`w-1.5 h-1.5 rounded-full ${published ? 'bg-success-fg' : 'bg-fg-subtle'}`} />
        {status}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title="Toggle status"
      className={`${base} hover:brightness-95 transition`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${published ? 'bg-success-fg' : 'bg-fg-subtle'}`} />
      {status}
    </button>
  )
}

function RowMenu({ form, canCreate, canEdit, canSubmit, readOnly, onFill, onResponses, onShare, onCopyLink, onStopSharing, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutsideDismiss(open, ref, () => setOpen(false))

  const item =
    'w-full text-left px-3 py-2 text-sm text-fg hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2'
  const danger = 'w-full text-left px-3 py-2 text-sm text-danger-fg hover:bg-danger-subtle flex items-center gap-2'
  const close = (fn) => () => { setOpen(false); fn?.() }

  const canFill = canSubmit && form.status === 'Published' && form.fields > 0
  const showShare = canCreate && form.status === 'Published'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${form.name}`}
        className="w-8 h-8 rounded-lg border border-line text-fg-muted hover:text-fg hover:bg-surface-2 flex items-center justify-center transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 bg-surface border border-line rounded-xl shadow-lg z-30 py-1 overflow-hidden"
        >
          {canFill && (
            <button type="button" role="menuitem" className={item} disabled={readOnly} onClick={close(onFill)}>
              Fill form
            </button>
          )}
          {canCreate && (
            <button type="button" role="menuitem" className={item} onClick={close(onResponses)}>
              View responses
            </button>
          )}
          {showShare && !form.isPublic && (
            <button type="button" role="menuitem" className={item} onClick={close(onShare)}>
              Share public link
            </button>
          )}
          {showShare && form.isPublic && (
            <>
              <button type="button" role="menuitem" className={item} onClick={close(onCopyLink)}>
                Copy public link
              </button>
              <button type="button" role="menuitem" className={item} onClick={close(onStopSharing)}>
                Stop sharing
              </button>
            </>
          )}
          {canEdit && (
            <button type="button" role="menuitem" className={item} onClick={close(onEdit)}>
              Edit form
            </button>
          )}
          {canCreate && (
            <>
              <div className="my-1 border-t border-line" />
              <button type="button" role="menuitem" className={danger} onClick={close(onDelete)}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Shell 4 — what Forms means to someone who only ever starts requests.
function RequestCatalogue() {
  const navigate = useNavigate()
  const forms = useForms()
  const readOnly = useReadOnly()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [booting, setBooting] = useState(true)
  useEffect(() => { formsStore.refresh().finally(() => setBooting(false)) }, [])

  const startable = useMemo(
    () => forms.filter((f) => f.status === 'Published' && f.fields > 0),
    [forms]
  )

  const categories = useMemo(
    () => [...new Set(startable.map((f) => f.category).filter(Boolean))].sort(),
    [startable]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return startable.filter((f) => {
      const matchesSearch = !q
        || f.name.toLowerCase().includes(q)
        || (f.description || '').toLowerCase().includes(q)
      return matchesSearch && (!category || f.category === category)
    })
  }, [startable, search, category])

  const subtitle = booting
    ? 'Loading…'
    : `${startable.length} available to start`

  return (
    <AppShell
      title="Forms"
      subtitle={subtitle}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col w-full">
        <div data-tour="forms-list" className="flex-1 min-h-0 flex flex-col bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-line bg-surface-2/40">
            <div className="relative flex-1 min-w-0">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search requests…"
                aria-label="Search requests"
                className={fieldCls}
              />
            </div>
            {categories.length > 1 && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by category"
                className={`${selectCls} shrink-0`}
              >
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {booting && !startable.length ? (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border border-line rounded-xl p-4 space-y-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-7 w-28" />
                  </div>
                ))}
              </div>
            ) : !filtered.length ? (
              <div className="h-full min-h-[16rem] flex items-center justify-center">
                <EmptyState
                  title={startable.length ? 'Nothing matches that' : 'No requests available yet'}
                  description={startable.length
                    ? 'Try a different word, or clear the category filter.'
                    : 'When an admin publishes a form for your team, it shows up here.'}
                  icon={<IconForm className="w-5 h-5" />}
                />
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((f) => (
                  <div
                    key={f.id}
                    className="group border border-line rounded-xl p-4 flex flex-col bg-surface hover:border-indigo-200 hover:shadow-md transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0">
                        <FormGlyph />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-fg leading-snug truncate">{f.name}</p>
                          {f.category && (
                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${categoryBadge(f.category)}`}>
                              {f.category}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-fg-muted line-clamp-2 min-h-[2rem]">
                          {f.description || 'No description.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                      <span className="text-[11px] text-fg-subtle">
                        {f.fields} {f.fields === 1 ? 'question' : 'questions'}
                      </span>
                      <button
                        onClick={() => navigate(`/forms/${f.id}/fill`)}
                        disabled={readOnly}
                        title={readOnly ? 'The workspace licence has expired — new requests are paused.' : undefined}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition"
                      >
                        Start request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function FormsLibrary() {
  const navigate = useNavigate()
  const forms = useForms()
  const me = useUser()
  const canCreate = canCreateForm(me)
  const canSubmit = canSubmitForms(me)
  const canEdit = canEditForm(me)
  const readOnly = useReadOnly()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [booting, setBooting] = useState(true)
  useEffect(() => { formsStore.refresh().finally(() => setBooting(false)) }, [])

  const buildUrl = (token) => `${window.location.origin}/f/${token}`
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }
  const shareForm = async (f) => {
    try {
      const target = f.isPublic && f.publicToken ? f : await formsStore.setPublic(f.id, true)
      const url = buildUrl(target.publicToken)
      const ok = await copyText(url)
      if (ok) toast.success('Public link copied to clipboard')
      else window.prompt('Public link — copy it:', url)
    } catch (err) {
      toast.error(err.message || 'Could not create a public link.')
    }
  }
  const copyLink = async (f) => {
    const url = buildUrl(f.publicToken)
    const ok = await copyText(url)
    if (ok) toast.success('Public link copied to clipboard')
    else window.prompt('Public link — copy it:', url)
  }
  const stopSharing = async (f) => {
    const ok = await confirm({
      title: 'Stop sharing?',
      message: 'The public link will stop working until you share again.',
      confirmLabel: 'Stop sharing',
      danger: false,
    })
    if (!ok) return
    try {
      await formsStore.setPublic(f.id, false)
      toast.success('Sharing stopped')
    } catch (err) {
      toast.error(err.message || 'Failed to update sharing.')
    }
  }
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [statusFilter, setStatusFilter] = useState('All status')

  const filtered = useMemo(() => {
    return forms.filter((f) => {
      const matchesSearch =
        !search.trim() ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.description || '').toLowerCase().includes(search.toLowerCase())
      const matchesCat = categoryFilter === 'All categories' || f.category === categoryFilter
      const matchesStatus = statusFilter === 'All status' || f.status === statusFilter
      return matchesSearch && matchesCat && matchesStatus
    })
  }, [forms, search, categoryFilter, statusFilter])

  const published = forms.filter((f) => f.status === 'Published').length
  const drafts = forms.filter((f) => f.status === 'Draft').length
  const totalSubmissions = forms.reduce((sum, f) => sum + (f.submissions || 0), 0)

  const actions = canCreate ? (
    <button
      data-tour="forms-create"
      onClick={() => setNewOpen(true)}
      disabled={readOnly}
      title={readOnly ? 'The workspace licence has expired — new forms are paused.' : undefined}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      New form
    </button>
  ) : null

  return (
    <AppShell
      title="Forms"
      subtitle="Build, publish, and collect responses"
      actions={actions}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 w-full">
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total forms" value={booting && !forms.length ? '—' : forms.length} hint="In this workspace" />
          <StatCard label="Published" value={booting && !forms.length ? '—' : published} hint="Ready to collect responses" />
          <StatCard label="Drafts" value={booting && !forms.length ? '—' : drafts} hint="Not published yet" />
          <StatCard label="Submissions" value={booting && !forms.length ? '—' : totalSubmissions} hint="All time" />
        </div>

        <div data-tour="forms-list" className="flex-1 min-h-0 flex flex-col bg-surface border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="shrink-0 px-5 py-4 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-line bg-surface-2/40">
            <div className="relative flex-1 min-w-0">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description…"
                aria-label="Search forms"
                className={fieldCls}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className={selectCls}
              >
                <option>All categories</option>
                {FORM_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className={selectCls}
              >
                <option>All status</option>
                <option>Published</option>
                <option>Draft</option>
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {booting && forms.length === 0 ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-72 max-w-full" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full hidden sm:block" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full min-h-[16rem] flex items-center justify-center">
                <EmptyState
                  icon={<IconForm className="w-5 h-5" />}
                  title={forms.length === 0 ? 'No forms yet' : 'No forms match'}
                  description={
                    forms.length === 0
                      ? canCreate
                        ? 'Create a form to start collecting requests and routing approvals.'
                        : 'No forms have been published yet. Ask an Admin or Manager to create one.'
                      : 'Try a different search or clear the filters.'
                  }
                  action={
                    forms.length === 0 && canCreate ? (
                      <button
                        onClick={() => setNewOpen(true)}
                        className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition"
                      >
                        Create form
                      </button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <>
                <div className="hidden md:block w-full">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-[7.5rem]" />
                      <col className="w-[5.5rem]" />
                      <col className="w-[7.5rem]" />
                      <col className="w-[7.5rem]" />
                      <col className="w-[6.5rem]" />
                      <col className="w-[12.5rem]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="text-left text-[11px] font-semibold tracking-wider text-fg-subtle uppercase border-b border-line bg-surface-2/95 backdrop-blur-sm">
                        <th scope="col" className="px-5 py-3 font-semibold">Form</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">Fields</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">Submissions</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Created</th>
                        <th scope="col" className="px-5 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filtered.map((f) => {
                        const primaryHref = canEdit
                          ? `/forms/${f.id}/edit`
                          : canCreate
                            ? `/forms/${f.id}/responses`
                            : canSubmit && f.status === 'Published' && f.fields > 0
                              ? `/forms/${f.id}/fill`
                              : null
                        return (
                          <tr key={f.id} className="group hover:bg-surface-2/50 transition">
                            <td className="px-5 py-3.5">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0 ring-1 ring-indigo-100 dark:ring-indigo-500/20">
                                  <FormGlyph className="w-[18px] h-[18px]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    disabled={!primaryHref}
                                    onClick={() => primaryHref && navigate(primaryHref)}
                                    className="text-left font-semibold text-fg hover:text-indigo-600 disabled:hover:text-fg transition truncate w-full block"
                                  >
                                    {f.name}
                                  </button>
                                  <div className="mt-0.5 flex items-center gap-2 min-w-0">
                                    {f.description ? (
                                      <p className="text-xs text-fg-muted truncate min-w-0">{f.description}</p>
                                    ) : (
                                      <p className="text-xs text-fg-subtle">No description</p>
                                    )}
                                    {f.isPublic && (
                                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success-subtle text-success-fg">
                                        Public
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${categoryBadge(f.category)}`}>
                                {f.category || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-fg font-medium">{f.fields}</td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-fg font-medium">{f.submissions ?? 0}</td>
                            <td className="px-4 py-3.5">
                              <StatusBadge
                                status={f.status}
                                interactive={canCreate}
                                onClick={() => formsStore.togglePublished(f.id)}
                              />
                            </td>
                            <td className="px-4 py-3.5 text-xs text-fg-muted whitespace-nowrap">{formatDate(f.createdAt)}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/forms/${f.id}/edit`)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition"
                                  >
                                    Edit
                                  </button>
                                )}
                                {canCreate && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/forms/${f.id}/responses`)}
                                    title="View responses"
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-line text-fg-muted hover:text-fg hover:bg-surface-2 transition"
                                  >
                                    Responses
                                  </button>
                                )}
                                <RowMenu
                                  form={f}
                                  canCreate={canCreate}
                                  canEdit={canEdit}
                                  canSubmit={canSubmit}
                                  readOnly={readOnly}
                                  onFill={() => navigate(`/forms/${f.id}/fill`)}
                                  onResponses={() => navigate(`/forms/${f.id}/responses`)}
                                  onShare={() => shareForm(f)}
                                  onCopyLink={() => copyLink(f)}
                                  onStopSharing={() => stopSharing(f)}
                                  onEdit={() => navigate(`/forms/${f.id}/edit`)}
                                  onDelete={async () => {
                                    if (await confirm({
                                      title: 'Delete form?',
                                      message: 'This permanently deletes the form and all its submissions. This cannot be undone.',
                                      confirmLabel: 'Delete',
                                      danger: true,
                                    })) formsStore.remove(f.id)
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="md:hidden divide-y divide-line">
                  {filtered.map((f) => (
                    <li key={f.id} className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0">
                          <FormGlyph className="w-[18px] h-[18px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-fg truncate">{f.name}</p>
                              <p className="text-xs text-fg-muted line-clamp-2 mt-0.5">
                                {f.description || 'No description'}
                              </p>
                            </div>
                            <RowMenu
                              form={f}
                              canCreate={canCreate}
                              canEdit={canEdit}
                              canSubmit={canSubmit}
                              readOnly={readOnly}
                              onFill={() => navigate(`/forms/${f.id}/fill`)}
                              onResponses={() => navigate(`/forms/${f.id}/responses`)}
                              onShare={() => shareForm(f)}
                              onCopyLink={() => copyLink(f)}
                              onStopSharing={() => stopSharing(f)}
                              onEdit={() => navigate(`/forms/${f.id}/edit`)}
                              onDelete={async () => {
                                if (await confirm({
                                  title: 'Delete form?',
                                  message: 'This permanently deletes the form and all its submissions. This cannot be undone.',
                                  confirmLabel: 'Delete',
                                  danger: true,
                                })) formsStore.remove(f.id)
                              }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {f.category && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${categoryBadge(f.category)}`}>
                                {f.category}
                              </span>
                            )}
                            <StatusBadge
                              status={f.status}
                              interactive={canCreate}
                              onClick={() => formsStore.togglePublished(f.id)}
                            />
                            <span className="text-[11px] text-fg-subtle">
                              {f.fields} fields · {f.submissions ?? 0} submissions
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => navigate(`/forms/${f.id}/edit`)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white"
                              >
                                Edit
                              </button>
                            )}
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => navigate(`/forms/${f.id}/responses`)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line"
                              >
                                Responses
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
      <NewFormModal open={newOpen} onClose={() => setNewOpen(false)} />
    </AppShell>
  )
}

function Forms() {
  const me = useUser()
  return canCreateForm(me) ? <FormsLibrary /> : <RequestCatalogue />
}

export default Forms

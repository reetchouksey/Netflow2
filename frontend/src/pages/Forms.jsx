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
import { useReadOnly, useUsage } from '../lib/usageStore'
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

  const canFill = canSubmit && form.fields > 0
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
  const me = useUser()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [booting, setBooting] = useState(true)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  useEffect(() => { formsStore.refresh().finally(() => setBooting(false)) }, [])

  // Check if user is from a specific department (e.g., Legal, IT, Accounts)
  // For safety, we assume if they have a specific department, we restrict them.
  const restrictedDept = me?.department && !['Admin', 'All', 'Management', 'HR'].includes(me.department) ? me.department : null

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
      
      const effectiveCategory = restrictedDept || category
      // If restricted, they see their department's forms + General forms
      return matchesSearch && (!effectiveCategory || f.category === effectiveCategory || (restrictedDept && f.category === 'General'))
    })
  }, [startable, search, category, restrictedDept])

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, category, restrictedDept])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filtered.length)
  const paginatedForms = useMemo(() => {
    return filtered.slice(startIndex, endIndex)
  }, [filtered, startIndex, endIndex])

  const totalSubmissions = startable.reduce((sum, f) => sum + (f.submissions || 0), 0)
  const subtitle = booting
    ? 'Loading…'
    : `${startable.length} total · ${startable.length} published · ${totalSubmissions} submissions`

  return (
    <AppShell
      title="Forms"
      subtitle={subtitle}
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden bg-[#e2e8f0] dark:bg-slate-900"
    >
      <div className="flex-1 min-h-0 flex flex-col w-full">
        <div data-tour="forms-list" className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Header Controls */}
          <div className="shrink-0 px-5 py-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-line bg-surface-2/40">
            <div className="relative w-full md:w-64">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search forms..."
                aria-label="Search forms"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
              />
            </div>
            
            {/* Category dropdown is hidden if restricted to department */}
            {!restrictedDept && categories.length > 1 && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by category"
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
              >
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {!restrictedDept && (
              <select
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
              >
                <option>All status</option>
                <option>Published</option>
              </select>
            )}
          </div>

          {/* Table List View */}
          <div className="flex-1 min-h-0 overflow-y-auto relative">
            {booting && !startable.length ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="w-9 h-4 rounded" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-7 w-20 rounded-lg" />
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
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-[11px] font-black tracking-wider text-slate-700 dark:text-slate-200 uppercase border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/90">
                    <th scope="col" className="px-5 py-3.5 font-black text-left">FORM</th>
                    <th scope="col" className="px-4 py-3.5 font-black text-left">CATEGORY</th>
                    <th scope="col" className="px-4 py-3.5 font-black text-center">FIELDS</th>
                    <th scope="col" className="px-4 py-3.5 font-black text-center">SUBMISSIONS</th>
                    <th scope="col" className="px-4 py-3.5 font-black text-left">STATUS</th>
                    <th scope="col" className="px-4 py-3.5 font-black text-left">CREATED</th>
                    <th scope="col" className="px-6 py-3.5 font-black text-left">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {paginatedForms.map((f) => (
                    <tr key={f.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100 block max-w-[280px] truncate">{f.name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[280px] mt-0.5">{f.fields} field form</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {f.category ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${categoryBadge(f.category)}`}>{f.category}</span> : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600 dark:text-slate-300 font-medium">
                        {f.fields}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600 dark:text-slate-300 font-medium">
                        {f.submissions || 0}
                      </td>
                      <td className="px-4 py-3.5">
                        <RefStatusBadge status={f.status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap font-medium">
                        {formatDate(f.createdAt || Date.now())}
                      </td>
                      <td className="px-6 py-3.5 text-left">
                        <div className="flex items-center justify-start">
                          <button
                            onClick={() => navigate(`/forms/${f.id}/fill`)}
                            disabled={readOnly}
                            className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[13px] font-bold shadow-sm transition disabled:opacity-50"
                          >
                            Fill
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination Footer */}
          {!booting && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-700 dark:text-slate-300">{startIndex + 1}-{endIndex}</span> of {filtered.length}
              </span>
              {totalPages > 1 && (
                <div className="flex justify-end items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                  >
                    Prev
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        acc.push('ellipsis-' + p)
                      }
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item) => {
                      if (typeof item === 'string') {
                        return <span key={item} className="px-1 text-slate-400">...</span>
                      }
                      const isCurrent = item === currentPage
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    })}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}


/* ─── Reference-matched stat card (Matching Enterprise Card UI) ──────── */
function RefStatCard({ label, value, hint, icon, tone = 'neutral' }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    indigo: "bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400",
    emerald: "bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400",
    amber: "bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400",
    violet: "bg-[#F5F3FF] text-[#8B5CF6] dark:bg-purple-950/60 dark:text-purple-400",
    rose: "bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400"
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone] || tones.neutral}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon, { className: 'w-4.5 h-4.5' }) : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight tabular-nums">
            {value ?? '—'}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
            {label}
          </span>
        </div>
        {hint && <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">{hint}</div>}
      </div>
    </div>
  )
}

/* ─── Reference-matched status badge ──────────────────────────────────── */
function RefStatusBadge({ status, onClick, interactive }) {
  const published = status === 'Published'
  const cls = published
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
  const base = `inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${cls}`
  if (!interactive) return <span className={base}>{status?.toUpperCase()}</span>
  return (
    <button type="button" onClick={onClick} title="Toggle status" className={`${base} hover:brightness-95 transition`}>
      {status?.toUpperCase()}
    </button>
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
  const { usage } = useUsage()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [booting, setBooting] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'published' | 'drafts'
  const [categoryFilter, setCategoryFilter] = useState('All categories')
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
    } catch (err) { toast.error(err.message || 'Could not create a public link.') }
  }
  const copyLink = async (f) => {
    const url = buildUrl(f.publicToken)
    const ok = await copyText(url)
    if (ok) toast.success('Public link copied to clipboard')
    else window.prompt('Public link — copy it:', url)
  }
  const stopSharing = async (f) => {
    const ok = await confirm({ title: 'Stop sharing?', message: 'The public link will stop working until you share again.', confirmLabel: 'Stop sharing', danger: false })
    if (!ok) return
    try { await formsStore.setPublic(f.id, false); toast.success('Sharing stopped') }
    catch (err) { toast.error(err.message || 'Failed to update sharing.') }
  }

  const handleDeleteForm = async (f) => {
    const ok = await confirm({
      title: 'Delete form?',
      message: `Are you sure you want to delete "${f.name}"? This permanently deletes the form and all its responses. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await formsStore.remove(f.id)
      toast.success(`Form "${f.name}" deleted successfully`)
    } catch (err) {
      toast.error(err.message || 'Failed to delete form')
    }
  }


  const published = forms.filter((f) => f.status === 'Published').length
  const drafts = forms.filter((f) => f.status === 'Draft').length
  const totalSubmissions = forms.reduce((sum, f) => sum + (f.submissions || 0), 0)

  // Plan usage calculation from live organization usage
  const planUsed = usage?.resources?.forms?.used ?? forms.length
  const planLimit = usage?.licence?.limits?.maxForms || usage?.resources?.forms?.limit || 100
  const planPct = usage?.resources?.forms?.percent != null ? usage.resources.forms.percent : (planLimit > 0 ? Math.round((planUsed / planLimit) * 100) : 0)

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  const tabFiltered = useMemo(() => {
    if (activeTab === 'published') return forms.filter(f => f.status === 'Published')
    if (activeTab === 'drafts') return forms.filter(f => f.status === 'Draft')
    return forms
  }, [forms, activeTab])

  const filtered = useMemo(() => {
    return tabFiltered.filter((f) => {
      const q = search.trim().toLowerCase()
      const matchesSearch = !q || f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q)
      const matchesCat = categoryFilter === 'All categories' || f.category === categoryFilter
      return matchesSearch && matchesCat
    })
  }, [tabFiltered, search, categoryFilter])

  // Reset pagination on filter/tab changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter, activeTab])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filtered.length)
  const paginatedForms = useMemo(() => {
    return filtered.slice(startIndex, endIndex)
  }, [filtered, startIndex, endIndex])

  const tabs = [
    { key: 'all',       label: 'All forms' },
    { key: 'published', label: 'Published' },
    { key: 'drafts',    label: 'Drafts' },
  ]


  return (
    <AppShell
      title="Forms"
      mainClass="p-4 md:p-6 pb-24 md:pb-6 bg-[#e2e8f0] dark:bg-[#0b1120]"
    >
      <div className="flex flex-col gap-5 w-full">

        {/* Header row */}
        <div className="flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Forms</h1>
          {canCreate && (
            <button
              data-tour="forms-create"
              onClick={() => setNewOpen(true)}
              disabled={readOnly}
              title={readOnly ? 'The workspace licence has expired — new forms are paused.' : undefined}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-sm transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              New form
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-slate-200 dark:border-slate-700 shrink-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 pb-2.5 pt-0.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Stat cards */}
        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <RefStatCard
            label="Total Forms"
            value={booting && !forms.length ? '—' : forms.length}
            hint={`${drafts} drafts`}
            tone="indigo"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l4 4v11a2 2 0 01-2 2z"/></svg>}
          />
          <RefStatCard
            label="Published"
            value={booting && !forms.length ? '—' : published}
            hint={`${forms.length ? Math.round((published/forms.length)*100) : 0}% of all forms`}
            tone="emerald"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          />
          <RefStatCard
            label="Submissions"
            value={booting && !forms.length ? '—' : totalSubmissions}
            hint={`across ${forms.length} forms`}
            tone="violet"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
          />
          <RefStatCard
            label="Plan Usage"
            value={booting && !forms.length ? '—' : planUsed}
            hint={`${planUsed} of ${planLimit} used`}
            tone="amber"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
          />
        </div>

        {/* Search + filter bar */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="relative w-56">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms..."
              aria-label="Search forms"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
          >
            <option>All categories</option>
            {FORM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Table */}
        <div data-tour="forms-list" className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm overflow-hidden">
          <div>
            {booting && forms.length === 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="w-9 h-4 rounded" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-7 w-56 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full min-h-[16rem] flex items-center justify-center">
                <EmptyState
                  icon={<IconForm className="w-5 h-5" />}
                  title={forms.length === 0 ? 'No forms yet' : 'No forms match'}
                  description={forms.length === 0
                    ? canCreate ? 'Create a form to start collecting requests and routing approvals.' : 'No forms have been published yet.'
                    : 'Try a different search or clear the filters.'}
                  action={forms.length === 0 && canCreate
                    ? <button onClick={() => setNewOpen(true)} className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition">Create form</button>
                    : null}
                />
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block w-full">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-left text-[11px] font-black tracking-wider text-slate-700 dark:text-slate-200 uppercase border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/90">
                        <th scope="col" className="px-6 py-3.5 font-black text-left">FORM</th>
                        <th scope="col" className="px-4 py-3.5 font-black text-left">CATEGORY</th>
                        <th scope="col" className="px-4 py-3.5 font-black text-center">FIELDS</th>
                        <th scope="col" className="px-4 py-3.5 font-black text-center">SUBMISSIONS</th>
                        <th scope="col" className="px-4 py-3.5 font-black text-left">STATUS</th>
                        <th scope="col" className="px-4 py-3.5 font-black text-left">CREATED</th>
                        <th scope="col" className="px-6 py-3.5 font-black text-left">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                      {paginatedForms.map((f) => {
                        const primaryHref = canEdit
                          ? `/forms/${f.id}/edit`
                          : canCreate ? `/forms/${f.id}/responses`
                          : canSubmit && f.status === 'Published' && f.fields > 0 ? `/forms/${f.id}/fill` : null
                        return (
                          <tr key={f.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                            <td className="px-6 py-3.5">
                              <button
                                type="button"
                                disabled={!primaryHref}
                                onClick={() => primaryHref && navigate(primaryHref)}
                                className="text-left font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:text-slate-700 disabled:dark:text-slate-200 disabled:no-underline truncate block max-w-xs"
                              >
                                {f.name}
                              </button>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{f.fields} field form</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${categoryBadge(f.category)}`}>
                                {f.category || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{f.fields}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{f.submissions ?? 0}</td>
                            <td className="px-4 py-3.5">
                              <RefStatusBadge status={f.status} interactive={canCreate} onClick={() => formsStore.togglePublished(f.id)} />
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              {new Date(f.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-3.5 text-left">
                              <div className="flex items-center justify-start gap-1.5 flex-nowrap">
                                {canSubmit && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/forms/${f.id}/fill`)}
                                    disabled={readOnly || f.fields === 0}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  >Fill</button>
                                )}
                                {canCreate && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/forms/${f.id}/responses`)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 transition"
                                  >Responses</button>
                                )}
                                {canCreate && (
                                  <button
                                    type="button"
                                    onClick={() => f.isPublic ? copyLink(f) : shareForm(f)}
                                    disabled={f.status !== 'Published'}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  >Share</button>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/forms/${f.id}/edit`)}
                                    title="Edit form"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 transition"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                  </button>
                                )}
                                {canCreate && (
                                  <button
                                    type="button"
                                    title="Delete form"
                                    onClick={() => handleDeleteForm(f)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-slate-200 dark:border-slate-600 hover:border-rose-200 dark:hover:border-rose-500/30 transition"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/40">
                  {paginatedForms.map((f) => (
                    <li key={f.id} className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
                          <IconForm className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">{f.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{f.fields} field form</p>
                            </div>
                            <RowMenu form={f} canCreate={canCreate} canEdit={canEdit} canSubmit={canSubmit} readOnly={readOnly}
                              onFill={() => navigate(`/forms/${f.id}/fill`)}
                              onResponses={() => navigate(`/forms/${f.id}/responses`)}
                              onShare={() => shareForm(f)} onCopyLink={() => copyLink(f)} onStopSharing={() => stopSharing(f)}
                              onEdit={() => navigate(`/forms/${f.id}/edit`)}
                              onDelete={() => handleDeleteForm(f)}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {f.category && <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${categoryBadge(f.category)}`}>{f.category}</span>}
                            <RefStatusBadge status={f.status} interactive={canCreate} onClick={() => formsStore.togglePublished(f.id)} />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Pagination Footer */}
                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40 rounded-b-2xl">
                  <div>
                    Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length > 0 ? startIndex + 1 : 0}-{endIndex}</span> of <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-end items-center gap-1">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition"
                      >
                        Prev
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1) {
                            acc.push('ellipsis-' + p)
                          }
                          acc.push(p)
                          return acc
                        }, [])
                        .map((item) => {
                          if (typeof item === 'string') {
                            return <span key={item} className="px-1 text-slate-400">...</span>
                          }
                          const isCurrent = item === currentPage
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setCurrentPage(item)}
                              className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition ${
                                isCurrent
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700'
                              }`}
                            >
                              {item}
                            </button>
                          )
                        })}

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="px-2.5 py-1 rounded-lg font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
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




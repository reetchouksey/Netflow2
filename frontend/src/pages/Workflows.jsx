import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useWorkflows, workflowsStore, WORKFLOW_CATEGORIES } from '../lib/workflowsStore'
import { TableRowSkeleton } from '../components/Skeleton'
import { useUser } from '../utils/auth'
import { canCreateWorkflow, canEditWorkflow } from '../utils/permissions'
import { confirm } from '../lib/confirmStore'

const categoryStyles = {
  HR: 'bg-pink-50 text-pink-700',
  Finance: 'bg-amber-50 text-amber-700',
  Procurement: 'bg-blue-50 text-blue-700',
  IT: 'bg-indigo-50 text-indigo-700',
  Operations: 'bg-emerald-50 text-emerald-700',
  Marketing: 'bg-purple-50 text-purple-700',
  Sales: 'bg-rose-50 text-rose-700',
  Legal: 'bg-slate-100 text-slate-700',
}

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

function Workflows() {
  const navigate = useNavigate()
  const workflows = useWorkflows()
  const me = useUser()
  const canCreate = canCreateWorkflow(me)
  const canEdit = canEditWorkflow(me)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [statusFilter, setStatusFilter] = useState('All status')
  const [booting, setBooting] = useState(true)
  useEffect(() => { workflowsStore.refresh().finally(() => setBooting(false)) }, [])

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      const matchesSearch =
        !search.trim() ||
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.description || '').toLowerCase().includes(search.toLowerCase())
      const matchesCat = categoryFilter === 'All categories' || w.category === categoryFilter
      const matchesStatus = statusFilter === 'All status' || w.status === statusFilter
      return matchesSearch && matchesCat && matchesStatus
    })
  }, [workflows, search, categoryFilter, statusFilter])

  const subtitle = `${workflows.length} total · ${workflows.filter((w) => w.status === 'Active').length} active`
  const actions = canCreate ? (
    <button
      onClick={() => navigate('/workflows/new')}
      className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
    >
      New workflow
    </button>
  ) : null

  return (
    <AppShell title="Workflows" subtitle={subtitle} actions={actions}>
      <div className="bg-surface border border-line rounded-lg">
            <div className="px-5 py-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-line">
              <div className="relative flex-1 max-w-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workflows..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-line bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
              >
                <option>All categories</option>
                {WORKFLOW_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
              >
                <option>All status</option>
                <option>Active</option>
                <option>Draft</option>
              </select>
            </div>

            {booting && workflows.length === 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
                  </tbody>
                </table>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="text-sm text-fg-muted">
                  {workflows.length === 0
                    ? canCreate
                      ? 'No workflows yet. Create your first one to get started.'
                      : 'No workflows have been published yet. Ask an Admin or Manager to create one.'
                    : 'No workflows match your filters.'}
                </p>
                {workflows.length === 0 && canCreate && (
                  <button
                    onClick={() => navigate('/workflows/new')}
                    className="mt-4 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
                  >
                    Create workflow
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold tracking-wider text-fg-subtle uppercase border-b border-line">
                      <th className="px-5 py-3">Workflow</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Steps</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((w) => (
                      <tr key={w.id} className="hover:bg-surface-2/60 transition">
                        <td className="px-5 py-4">
                          <p className="font-medium text-fg">{w.name}</p>
                          {w.description && (
                            <p className="text-xs text-fg-muted mt-0.5">{w.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              categoryStyles[w.category] || 'bg-surface-3 text-fg-muted'
                            }`}
                          >
                            {w.category}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-fg">{w.steps}</td>
                        <td className="px-5 py-4">
                          {canCreate ? (
                            <button
                              onClick={() => workflowsStore.toggleStatus(w.id)}
                              title="Toggle status"
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition ${
                                w.status === 'Active'
                                  ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                  : 'bg-surface-3 text-fg-muted hover:bg-line'
                              }`}
                            >
                              {w.status}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                                w.status === 'Active'
                                  ? 'bg-green-50 text-green-600'
                                  : 'bg-surface-3 text-fg-muted'
                              }`}
                            >
                              {w.status}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-fg-muted">{formatDate(w.createdAt)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => navigate(`/workflows/${w.id}/edit`)}
                                title="Edit workflow"
                                className="w-9 h-7 rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center text-indigo-500 transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                                </svg>
                              </button>
                            )}
                            {canCreate && (
                              <button
                                onClick={async () => { if (await confirm({ title: 'Delete workflow?', message: 'This permanently deletes the workflow and its runs and tasks. This cannot be undone.', confirmLabel: 'Delete', danger: true })) workflowsStore.remove(w.id) }}
                                title="Delete workflow permanently"
                                className="w-9 h-7 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                </svg>
                              </button>
                            )}
                            {!canEdit && !canCreate && <span className="text-xs text-fg-subtle">—</span>}
                          </div>
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

export default Workflows

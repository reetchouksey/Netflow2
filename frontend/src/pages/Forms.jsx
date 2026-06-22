import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useForms, formsStore, FORM_CATEGORIES } from '../lib/formsStore'
import { useUser } from '../utils/auth'
import { canCreateForm, canSubmitForms, canEditForm } from '../utils/permissions'

const categoryStyles = {
  'Company-wide': 'bg-sky-50 text-sky-700',
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

function Forms() {
  const navigate = useNavigate()
  const forms = useForms()
  const me = useUser()
  const canCreate = canCreateForm(me)
  const canSubmit = canSubmitForms(me)
  const canEdit = canEditForm(me)
  const [search, setSearch] = useState('')
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
  const totalSubmissions = forms.reduce((sum, f) => sum + (f.submissions || 0), 0)

  const subtitle = `${forms.length} total · ${published} published · ${totalSubmissions} submissions`
  const actions = canCreate ? (
    <button
      onClick={() => navigate('/forms/new')}
      className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
    >
      New form
    </button>
  ) : null

  return (
    <AppShell title="Forms" subtitle={subtitle} actions={actions}>
      <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-gray-100">
              <div className="relative flex-1 max-w-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search forms..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
              >
                <option>All categories</option>
                {FORM_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
              >
                <option>All status</option>
                <option>Published</option>
                <option>Draft</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="text-sm text-gray-500">
                  {forms.length === 0
                    ? canCreate
                      ? 'No forms yet. Create your first one to get started.'
                      : 'No forms have been published yet. Ask an Admin or Manager to create one.'
                    : 'No forms match your filters.'}
                </p>
                {forms.length === 0 && canCreate && (
                  <button
                    onClick={() => navigate('/forms/new')}
                    className="mt-4 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
                  >
                    Create form
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold tracking-wider text-gray-400 uppercase border-b border-gray-100">
                      <th className="px-5 py-3">Form</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Fields</th>
                      <th className="px-5 py-3">Submissions</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50/60 transition">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-800">{f.name}</p>
                          {f.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              categoryStyles[f.category] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {f.category}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-700">{f.fields}</td>
                        <td className="px-5 py-4 text-gray-700">{f.submissions ?? 0}</td>
                        <td className="px-5 py-4">
                          {canCreate ? (
                            <button
                              onClick={() => formsStore.togglePublished(f.id)}
                              title="Toggle status"
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition ${
                                f.status === 'Published'
                                  ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {f.status}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                                f.status === 'Published'
                                  ? 'bg-green-50 text-green-600'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {f.status}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">{formatDate(f.createdAt)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {canSubmit && f.status === 'Published' && f.fields > 0 && (
                              <button
                                onClick={() => navigate(`/forms/${f.id}/fill`)}
                                title="Fill this form"
                                className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition"
                              >
                                Fill
                              </button>
                            )}
                            {canSubmit && f.status === 'Published' && f.fields === 0 && (
                              <span
                                title="Form has no fields"
                                className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                              >
                                Fill
                              </span>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => navigate(`/forms/${f.id}/edit`)}
                                title="Edit form"
                                className="w-9 h-7 rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center text-indigo-500 transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                                </svg>
                              </button>
                            )}
                            {canCreate && (
                              <button
                                onClick={() => { if (window.confirm('Permanently delete this form and all its submissions? This cannot be undone.')) formsStore.remove(f.id) }}
                                title="Delete form permanently"
                                className="w-9 h-7 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                </svg>
                              </button>
                            )}
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

export default Forms

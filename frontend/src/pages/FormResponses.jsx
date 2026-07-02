// Builder-only viewer for a form's submissions (internal + public).
// Lists every FormResponse for one form in a table and exports to CSV.

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { formsStore } from '../lib/formsStore'
import { toAbsoluteUrl } from '../utils/api'

const formatDateTime = (iso) => {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return '' }
}

const submitterName = (r) =>
  r.submittedBy?.name || r.submittedByExternal?.name || ''
const submitterEmail = (r) =>
  r.submittedBy?.email || r.submittedByExternal?.email || ''

// ---------- value rendering ----------
function CellValue({ field, value }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-gray-300">—</span>
  }
  switch (field.type) {
    case 'file':
      return typeof value === 'object' && value.url ? (
        <a href={toAbsoluteUrl(value.url)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 underline">
          {value.name || 'Attachment'}
        </a>
      ) : <span className="text-gray-300">—</span>
    case 'checkbox':
      return <span className="text-gray-800">{value ? 'Yes' : 'No'}</span>
    case 'grid': {
      const rows = Array.isArray(value) ? value : []
      const cols = field.columns || []
      if (rows.length === 0) return <span className="text-gray-300">—</span>
      return (
        <table className="text-xs border border-gray-200 rounded">
          <thead>
            <tr className="bg-gray-50">
              {cols.map((c) => (
                <th key={c.id} className="px-2 py-1 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.id} className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">{r[c.id] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    default:
      return <span className="text-gray-800 whitespace-pre-wrap">{String(value)}</span>
  }
}

// ---------- CSV ----------
const csvValue = (field, value) => {
  if (value === undefined || value === null) return ''
  if (field.type === 'file') return typeof value === 'object' ? `${value.name || ''} ${value.url ? toAbsoluteUrl(value.url) : ''}`.trim() : ''
  if (field.type === 'checkbox') return value ? 'Yes' : 'No'
  if (field.type === 'grid') {
    const rows = Array.isArray(value) ? value : []
    const cols = field.columns || []
    return rows.map((r) => cols.map((c) => `${c.label}: ${r[c.id] ?? ''}`).join('; ')).join(' | ')
  }
  return String(value)
}

function FormResponses() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    formsStore.responses(id)
      .then((d) => { setData(d); setError('') })
      .catch((err) => setError(err.message || 'Failed to load responses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  const fields = useMemo(
    () => (data?.form?.fields || []).filter((f) => f.type !== 'repeater'),
    [data]
  )
  const responses = data?.responses || []

  const exportCsv = () => {
    const esc = (s) => `"${String(s ?? '').replaceAll('"', '""')}"`
    const headers = ['#', 'Submitted at', 'Submitted by', 'Email', 'Source', ...fields.map((f) => f.label)]
    const lines = [headers.map(esc).join(',')]
    responses.forEach((r, i) => {
      const cells = [
        i + 1,
        formatDateTime(r.createdAt),
        submitterName(r) || 'Anonymous',
        submitterEmail(r),
        r.source || 'internal',
        ...fields.map((f) => csvValue(f, r.formData?.[f.id]))
      ]
      lines.push(cells.map(esc).join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safe = (data?.form?.title || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    a.href = url
    a.download = `${safe || 'form'}-responses.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const title = data?.form?.title ? `${data.form.title} — Responses` : 'Responses'
  const subtitle = loading ? 'Loading…' : `${responses.length} ${responses.length === 1 ? 'response' : 'responses'}`

  return (
    <AppShell
      title={title}
      subtitle={subtitle}
      back={{ to: '/forms', label: 'Back to forms' }}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || responses.length === 0}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm transition"
          >
            Export CSV
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-gray-500">Loading responses…</p>
        ) : responses.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-gray-500">No responses yet.</p>
            <p className="text-xs text-gray-400 mt-1">Share the form&apos;s public link to start collecting submissions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold tracking-wider text-gray-400 uppercase border-b border-gray-100">
                  <th className="px-4 py-3 whitespace-nowrap">Submitted</th>
                  <th className="px-4 py-3 whitespace-nowrap">By</th>
                  <th className="px-4 py-3 whitespace-nowrap">Source</th>
                  {fields.map((f) => (
                    <th key={f.id} className="px-4 py-3 whitespace-nowrap">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {responses.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/60 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-800">{submitterName(r) || <span className="text-gray-400">Anonymous</span>}</p>
                      {submitterEmail(r) && <p className="text-xs text-gray-400">{submitterEmail(r)}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.source === 'public' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.source === 'public' ? 'Public' : 'Internal'}
                      </span>
                    </td>
                    {fields.map((f) => (
                      <td key={f.id} className="px-4 py-3 max-w-xs">
                        <CellValue field={f} value={r.formData?.[f.id]} />
                      </td>
                    ))}
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

export default FormResponses

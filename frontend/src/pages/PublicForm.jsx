// Standalone, unauthenticated public form page (like a Google Form).
// Reached at /f/:token — renders a published+public form, lets anyone fill and
// submit it. No AppShell, no auth, no workflow. Self-contained renderers so it
// never depends on the authenticated `api` wrapper (which redirects on 401).

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE, toAbsoluteUrl } from '../utils/api'
import { fieldMaxMb } from '../utils/uploads'
import { isFieldVisible, stripHiddenValues, validateField } from '../components/FormFields'

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'
const inputErrorCls = 'border-red-400 focus:ring-red-200 focus:border-red-400'

// --- tiny fetch helpers (no auth headers, no redirect-on-401) ---------------
async function readJson(res) {
  const text = await res.text()
  let data = {}
  if (text) { try { data = JSON.parse(text) } catch { data = { error: text } } }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

async function publicUpload(token, file, maxMb) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(
    `${API_BASE}/api/public/forms/${token}/upload?maxMb=${maxMb}`,
    { method: 'POST', body: fd }
  )
  const data = await readJson(res)
  return data.file
}

// --- field renderers (mirrors FillForm, but uploads via the public route) ---
function FileField({ token, value, onChange, maxMb }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`File is too large. Max ${maxMb} MB.`)
      onChange('')
      e.target.value = ''
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const saved = await publicUpload(token, file, maxMb)
      onChange(saved)
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
      onChange('')
    } finally {
      setUploading(false)
    }
  }

  const current = value && typeof value === 'object' && value.url ? value : null

  return (
    <div>
      <input
        type="file"
        onChange={handleFile}
        disabled={uploading}
        className="block w-full text-sm text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60"
      />
      {!uploading && !uploadError && <p className="mt-1 text-xs text-fg-subtle">Max {maxMb} MB</p>}
      {uploading && <p className="mt-1 text-xs text-fg-muted">Uploading…</p>}
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
      {current && !uploading && (
        <p className="mt-1 text-xs text-green-700">
          Uploaded:{' '}
          <a href={toAbsoluteUrl(current.url)} target="_blank" rel="noreferrer" className="underline hover:text-green-800">
            {current.name}
          </a>
        </p>
      )}
    </div>
  )
}

function GridCell({ col, value, onChange }) {
  const cls =
    'w-full px-2 py-1 text-sm rounded border border-line bg-surface focus:outline-none focus:ring-1 focus:ring-indigo-300'
  switch (col.type) {
    case 'number':
      return <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'date':
      return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'dropdown':
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">—</option>
          {(col.options || []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )
    default:
      return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls} />
  }
}

function GridField({ field, value, onChange }) {
  const cols = field.columns || []
  const rows = Array.isArray(value) ? value : []

  const addRow = () => onChange([...rows, {}])
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i))
  const setCell = (i, colId, v) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [colId]: v } : r)))

  return (
    <div>
      <div className="overflow-x-auto border border-line rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2">
              {cols.map((c) => (
                <th key={c.id} className="px-2 py-1.5 text-left font-medium text-fg-muted border-b border-line whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th className="w-8 border-b border-line" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="px-2 py-3 text-center text-xs text-fg-subtle">
                  No rows yet — click “Add row”.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.id} className="px-2 py-1 border-b border-line align-top">
                    <GridCell col={c} value={row[c.id]} onChange={(v) => setCell(i, c.id, v)} />
                  </td>
                ))}
                <td className="px-1 py-1 border-b border-line text-center align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    title="Remove row"
                    className="text-fg-subtle hover:text-red-500 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 px-3 py-1.5 rounded-md border border-dashed border-line text-sm text-fg-muted hover:border-indigo-300 hover:text-indigo-700 transition"
      >
        + Add row
      </button>
    </div>
  )
}

function FieldRow({ token, field, value, onChange, error }) {
  const cls = `${inputCls} ${error ? inputErrorCls : ''}`

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return <textarea rows={4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''} className={`${cls} resize-y`} />
      case 'number':
        return <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''} className={cls} />
      case 'date':
        return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls} />
      case 'dropdown':
        return (
          <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls}>
            <option value="">— Select —</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400" />
            <span>{field.placeholder || 'Yes'}</span>
          </label>
        )
      case 'signature':
        return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Type your full name to sign" className={cls} />
      case 'file':
        return <FileField token={token} value={value} onChange={onChange} maxMb={fieldMaxMb(field)} />
      case 'radio':
        return (
          <div className="space-y-1.5">
            {(field.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-fg">
                <input type="radio" name={field.id} value={opt} checked={value === opt} onChange={(e) => onChange(e.target.value)} className="w-4 h-4 border-line text-indigo-600 focus:ring-indigo-400" />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        )
      case 'grid':
        return <GridField field={field} value={value} onChange={onChange} />
      case 'repeater':
        return <div className="text-xs text-fg-muted italic">This field type isn&apos;t supported here.</div>
      case 'text':
      default:
        return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''} className={cls} />
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-fg mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {renderInput()}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function PublicForm() {
  const { token } = useParams()

  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [values, setValues] = useState({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}/api/public/forms/${token}`)
      .then(readJson)
      .then((data) => { if (!cancelled) setForm(data.form) })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Failed to load form') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  // Recomputes on value change so conditional show/hide rules resolve live.
  const visibleFields = useMemo(
    () => (form?.fields || []).filter((f) => f.type !== 'repeater' && isFieldVisible(f, values)),
    [form, values]
  )

  const setFieldValue = (fieldId, v) => {
    setValues((prev) => ({ ...prev, [fieldId]: v }))
    setFieldErrors((prev) => (prev[fieldId] ? { ...prev, [fieldId]: '' } : prev))
    setSubmitError('')
  }

  const validate = () => {
    const errs = {}
    for (const f of visibleFields) {
      const v = values[f.id]
      if (f.required) {
        if (f.type === 'grid') {
          const rows = Array.isArray(v) ? v : []
          const cols = f.columns || []
          const cellEmpty = (cell) => cell === undefined || cell === null || String(cell).trim() === ''
          if (rows.length === 0) errs[f.id] = `${f.label} needs at least one row`
          else if (rows.some((r) => cols.some((c) => cellEmpty(r[c.id])))) errs[f.id] = `Fill every cell in ${f.label}`
          continue
        }
        const isEmpty = v === undefined || v === null || v === '' || (f.type === 'checkbox' && v === false)
        if (isEmpty) {
          errs[f.id] = `${f.label} is required`
          continue
        }
      }
      // Advanced rules (length/range/pattern) apply to filled fields, required or not.
      const adv = validateField(f, v)
      if (adv) errs[f.id] = adv
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      // Only send currently-visible fields (a value entered then hidden by a
      // rule change must not leak into the response).
      const payload = stripHiddenValues(visibleFields, values)
      const res = await fetch(`${API_BASE}/api/public/forms/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: payload, submitter: { name, email } })
      })
      await readJson(res)
      setDone(true)
    } catch (err) {
      setSubmitError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForAnother = () => {
    setValues({})
    setName('')
    setEmail('')
    setFieldErrors({})
    setSubmitError('')
    setDone(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---------- shells ----------
  const Page = ({ children }) => (
    <div className="min-h-screen bg-surface-2">
      <header className="bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">N</div>
          <span className="font-semibold text-fg">NetFlow</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      <footer className="max-w-2xl mx-auto px-4 pb-8 text-center text-xs text-fg-subtle">
        Powered by NetFlow · Never submit passwords through this form.
      </footer>
    </div>
  )

  if (loading) {
    return <Page><div className="bg-surface border border-line rounded-lg p-8 text-center text-sm text-fg-muted">Loading form…</div></Page>
  }

  if (loadError || !form) {
    return (
      <Page>
        <div className="bg-surface border border-line rounded-lg p-8 text-center">
          <h1 className="text-lg font-semibold text-fg">Form unavailable</h1>
          <p className="text-sm text-fg-muted mt-1">{loadError || 'This form is not available.'}</p>
        </div>
      </Page>
    )
  }

  if (done) {
    return (
      <Page>
        <div className="bg-surface border border-line rounded-lg p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-fg">Thanks — your response was recorded</h1>
          <p className="text-sm text-fg-muted mt-1">You can safely close this page.</p>
          <button
            type="button"
            onClick={resetForAnother}
            className="mt-5 px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
          >
            Submit another response
          </button>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="border-t-4 border-indigo-600 px-6 pt-5 pb-4 border-b border-line">
          <h1 className="text-xl font-semibold text-fg">{form.title}</h1>
          {form.description && <p className="text-sm text-fg-muted mt-1 whitespace-pre-wrap">{form.description}</p>}
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
          {visibleFields.length === 0 ? (
            <p className="text-sm text-fg-muted text-center py-4">This form has no fields to fill.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-line">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Your name <span className="text-fg-subtle font-normal">(optional)</span></label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Acme Supplies Ltd." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Your email <span className="text-fg-subtle font-normal">(optional)</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@company.com" />
                </div>
              </div>

              {visibleFields.map((f) => (
                <FieldRow
                  key={f.id}
                  token={token}
                  field={f}
                  value={values[f.id]}
                  onChange={(v) => setFieldValue(f.id, v)}
                  error={fieldErrors[f.id]}
                />
              ))}
            </>
          )}

          {submitError && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{submitError}</div>
          )}

          {visibleFields.length > 0 && (
            <div className="flex items-center justify-end pt-2 border-t border-line">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          )}
        </form>
      </div>
    </Page>
  )
}

export default PublicForm

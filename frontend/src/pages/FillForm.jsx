// M1 - Phase 2 - FillForm.jsx
// Render a published form by id, validate required fields, POST to
// /api/forms/:id/submit, and surface whether the linked workflow fired.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api, toAbsoluteUrl } from '../utils/api'
import { useUser } from '../utils/auth'
import { formsStore } from '../lib/formsStore'
import { fieldMaxMb, MAX_UPLOAD_MB } from '../utils/uploads'
import { fieldDomId, focusFirstError, isFieldVisible, isSignatureEmpty, SignaturePad, stripHiddenValues, UploadProgress, validateField, CameraCapture, ReferenceUserSelect } from '../components/FormFields'
import { limitBanner } from '../lib/limitFeedback'
import { FilePreviewPane } from '../components/FilePreviewPane'

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'

const inputErrorCls =
  'border-red-400 focus:ring-red-200 focus:border-red-400'

// Heuristic prefill: match a text field's label to the signed-in user's own
// details so they don't retype their name/email/department every time. The
// exclude-list keeps it from grabbing "Manager name", "Company name", etc.
function buildUserPrefill(fields, me) {
  if (!me) return {}
  const role = me.role?.name
  const seed = {}
  for (const f of fields || []) {
    if (f.type !== 'text') continue
    const l = (f.label || '').toLowerCase()
    let v
    if (/e-?mail/.test(l)) v = me.email
    else if (l.includes('department') || l.includes('dept')) v = me.department
    else if (l.includes('designation') || l.includes('role')) v = role
    else if (
      l.includes('name') &&
      !/(company|manager|supervisor|project|product|brand|supplier|vendor|contact|father|spouse|guardian|account)/.test(l)
    ) v = me.name
    if (v) seed[f.id] = v
  }
  return seed
}

// Uploads the chosen file to /api/uploads and stores { name, url, mime, size }
// as the field value, so the approver can later open the actual attachment.
function FileField({ value, onChange, maxMb = MAX_UPLOAD_MB, onRequestPreview }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [useCamera, setUseCamera] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Block oversize files up front so the user gets instant feedback instead
    // of waiting for the server to reject the upload.
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`File is too large. Max ${maxMb} MB.`)
      onChange('')
      e.target.value = ''
      return
    }
    setUploading(true)
    setProgress(0)
    setUploadError('')
    try {
      const { file: saved } = await api.upload(file, maxMb, { onProgress: setProgress })
      onChange(saved)
    } catch (err) {
      // "Storage full" is not the same problem as "that file is too big".
      const limit = limitBanner(err)
      setUploadError(limit ? `${limit.title} — ${limit.message}` : (err.message || 'Upload failed'))
      onChange('')
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  const current = value && typeof value === 'object' && value.url ? value : null

  if (useCamera) {
    return (
      <div className="space-y-2">
        <CameraCapture
          value={value}
          onChange={(val) => {
            onChange(val)
            if (val) setUseCamera(false)
          }}
          autoStart={true}
          inlineMode={true}
          onCancel={() => setUseCamera(false)}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="file"
          onChange={handleFile}
          disabled={uploading}
          className="block w-full text-sm text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-info-subtle file:text-info-fg hover:file:brightness-95 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setUseCamera(true)}
          disabled={uploading}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-surface-2 text-fg hover:bg-surface-3 transition border border-line disabled:opacity-60"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          Camera
        </button>
      </div>
      {!uploading && !uploadError && <p className="mt-1 text-xs text-fg-subtle">Max {maxMb} MB</p>}
      {uploading && <UploadProgress percent={progress} />}
      {uploadError && <p className="mt-1 text-xs text-danger-fg">{uploadError}</p>}
      {current && !uploading && (
        <p className="mt-1 text-xs flex flex-wrap items-center gap-x-2 gap-y-1 text-success-fg">
          <span>
            Uploaded:{' '}
            <a href={toAbsoluteUrl(current.url)} target="_blank" rel="noreferrer" className="underline hover:brightness-110">
              {current.name}
            </a>
          </span>
          {onRequestPreview && (current.mime?.startsWith('image/') || current.mime === 'application/pdf' || current.name?.match(/\.(pdf|jpe?g|png|webp|gif)$/i)) && (
            <button
              type="button"
              onClick={() => onRequestPreview(current)}
              className="text-fg-muted hover:text-indigo-600 transition flex items-center gap-1 bg-surface-2 px-2 py-0.5 rounded border border-line"
              title="Preview file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
          )}
        </p>
      )}
    </div>
  )
}

// One editable cell inside a grid/table row, rendered per its column type.
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

// A table/grid field: fixed columns (set by the form designer), and the
// respondent adds/removes as many rows as needed. Value = array of row objects
// keyed by column id: [{ [colId]: cellValue }, ...].
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
                <th scope="col" key={c.id} className="px-2 py-1.5 text-left font-medium text-fg-muted border-b border-line whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th scope="col" className="w-8 border-b border-line"><span className="sr-only">Actions</span></th>
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
                    aria-label={`Remove row ${i + 1}`}
                    className="text-fg-subtle hover:text-danger-fg transition"
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

function FieldRow({ field, value, onChange, error, onRequestPreview }) {
  if (field.type === 'heading') {
    return (
      <div data-field-row={field.id} className="pt-4 pb-2 border-b border-line mb-4">
        <h3 className="text-lg font-semibold text-fg">{field.label}</h3>
        {field.placeholder && <p className="text-sm text-fg-muted mt-1">{field.placeholder}</p>}
      </div>
    )
  }

  const cls = `${inputCls} ${error ? inputErrorCls : ''}`
  // Same wiring as the shared FieldRow: the label points at the control and
  // focusFirstError finds it by this id after a failed submit.
  const inputId = fieldDomId(field.id)
  const labelId = `${inputId}-label`
  const errorId = error ? `${inputId}-error` : undefined
  const a11y = {
    id: inputId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': errorId,
  }

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...a11y}
            rows={4}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={`${cls} resize-y`}
          />
        )
      case 'number':
        return (
          <input
            {...a11y}
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={cls}
          />
        )
      case 'date':
        return (
          <input
            {...a11y}
            type={field.includeTime ? "datetime-local" : "date"}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={cls}
          />
        )
      case 'dropdown':
        return (
          <select
            {...a11y}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={cls}
          >
            <option value="">— Select —</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      case 'checkbox':
        if (field.options && field.options.length > 0) {
          const selectedValues = Array.isArray(value) ? value : []
          return (
            <div className={field.layout === 'horizontal' ? "flex flex-wrap gap-x-6 gap-y-2" : "space-y-1.5"} role="group" aria-labelledby={labelId}>
              {field.options.map((opt, i) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-fg">
                  <input
                    id={i === 0 ? inputId : undefined}
                    type="checkbox"
                    value={opt}
                    checked={selectedValues.includes(opt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...selectedValues, opt])
                      } else {
                        onChange(selectedValues.filter((v) => v !== opt))
                      }
                    }}
                    className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )
        }
        return (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              {...a11y}
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
            />
            <span>{field.placeholder || 'Yes'}</span>
          </label>
        )
      case 'signature':
        return (
          <SignaturePad
            id={inputId}
            onChange={onChange}
          />
        )
      case 'file':
        return <FileField value={value} onChange={onChange} maxMb={fieldMaxMb(field)} onRequestPreview={onRequestPreview} />

      case 'radio':
        return (
          <div className={field.layout === 'horizontal' ? "flex flex-wrap gap-x-6 gap-y-2" : "space-y-1.5"} role="radiogroup" aria-labelledby={labelId} aria-describedby={errorId}>
            {(field.options || []).map((opt, i) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-fg">
                <input
                  id={i === 0 ? inputId : undefined}
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-4 h-4 border-line text-indigo-600 focus:ring-indigo-400"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        )
      case 'camera':
        return <CameraCapture value={value} onChange={onChange} />
      case 'grid':
        return <GridField field={field} value={value} onChange={onChange} />

      case 'repeater':
        return (
          <div className="text-xs text-fg-muted italic">
            Repeater fields aren&apos;t supported in this view.
          </div>
        )
      case 'text':
      default:
        if (field.referenceUser) {
          return (
            <ReferenceUserSelect
              a11y={a11y}
              value={value ?? ''}
              onChange={(val) => onChange(val)}
              placeholder={field.placeholder || 'Search users...'}
              className={cls}
            />
          )
        }
        return (
          <input
            {...a11y}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={cls}
          />
        )
    }
  }

  return (
    <div data-field-row={field.id}>
      <label id={labelId} htmlFor={inputId} className="block text-sm font-medium text-fg mb-1">
        {field.label}
        {field.required && <span className="text-danger-fg ml-0.5" aria-hidden="true">*</span>}
        {field.required && <span className="sr-only"> (required)</span>}
      </label>
      {renderInput()}
      {error && <p id={errorId} className="mt-1 text-xs text-danger-fg">{error}</p>}
    </div>
  )
}

function FillForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [values, setValues] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)

  const [draftRestored, setDraftRestored] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [draftError, setDraftError] = useState('')

  const me = useUser()
  const prefilled = useRef(false)
  const draftLoaded = useRef(false)

  const availableDocs = useMemo(() => {
    const docs = []
    if (!form?.fields) return docs
    for (const f of form.fields) {
      const v = values[f.id]
      if (v && typeof v === 'object' && v.url && (v.mime?.startsWith('image/') || v.mime === 'application/pdf' || v.name?.match(/\.(pdf|jpe?g|png|webp|gif)$/i))) {
        docs.push({ ...v, fieldLabel: f.label })
      }
    }
    return docs
  }, [form, values])

  useEffect(() => {
    let cancelled = false
    api.get(`/api/forms/${id}`)
      .then((data) => {
        if (cancelled) return
        setForm(data.form)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message || 'Failed to load form')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  // Auto-fill fields that look like the signed-in user's own details. Runs once
  // when the form + user are ready, and never overwrites anything already typed.
  useEffect(() => {
    if (prefilled.current || !form || !me) return
    const seed = buildUserPrefill(form.fields || [], me)
    if (Object.keys(seed).length) {
      setValues((prev) => ({ ...seed, ...prev }))
    }
    prefilled.current = true
  }, [form, me])

  // Restore a previously saved draft once the form is loaded. Draft values are
  // merged OVER anything already present (prefill), so a saved draft wins. The
  // prefill effect above also keeps existing values ahead of its seed, so the
  // two effects can run in either order and the draft still takes precedence.
  useEffect(() => {
    if (draftLoaded.current || !form) return
    draftLoaded.current = true
    let cancelled = false
    formsStore.getDraft(id)
      .then((res) => {
        const data = res?.draft?.formData
        if (cancelled || !data || typeof data !== 'object' || Object.keys(data).length === 0) return
        setValues((prev) => ({ ...prev, ...data }))
        setDraftRestored(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [form, id])

  // Recomputes on every value change so conditional show/hide rules (and chained
  // rules) resolve live as the user answers dependent fields.
  const visibleFields = useMemo(() => {
    if (!form?.fields) return []
    return form.fields.filter((f) => f.type !== 'repeater' && isFieldVisible(f, values))
  }, [form, values])

  const pages = useMemo(() => {
    const maxPage = visibleFields.reduce((max, f) => Math.max(max, f.page || 1), 1)
    const p = []
    for (let i = 1; i <= maxPage; i++) {
      const pageFields = visibleFields.filter(f => (f.page || 1) === i)
      if (pageFields.length > 0) p.push(pageFields)
    }
    if (p.length === 0) p.push([])
    return p
  }, [visibleFields])

  const [currentPage, setCurrentPage] = useState(0)
  useEffect(() => {
    if (currentPage >= pages.length) {
      setCurrentPage(Math.max(0, pages.length - 1))
    }
  }, [pages.length, currentPage])

  const setFieldValue = (fieldId, v) => {
    setValues((prev) => ({ ...prev, [fieldId]: v }))
    setFieldErrors((prev) => (prev[fieldId] ? { ...prev, [fieldId]: '' } : prev))
    setSubmitError('')
    if (draftSavedAt) setDraftSavedAt(null)

    // Feature: File Preview Split Screen
    if (v && typeof v === 'object' && v.url && (v.mime?.startsWith('image/') || v.mime === 'application/pdf')) {
      setPreviewFile(v)
    }
  }

  const validate = (fieldsToValidate) => {
    const errs = {}
    for (const f of fieldsToValidate) {
      const v = values[f.id]
      if (f.required) {
        if (f.type === 'grid') {
          const rows = Array.isArray(v) ? v : []
          const cols = f.columns || []
          const cellEmpty = (cell) => cell === undefined || cell === null || String(cell).trim() === ''
          if (rows.length === 0) {
            errs[f.id] = `${f.label} needs at least one row`
          } else if (rows.some((r) => cols.some((c) => cellEmpty(r[c.id])))) {
            errs[f.id] = `Fill every cell in ${f.label}`
          }
          continue
        }
          const isEmpty = f.type === 'signature'
          ? isSignatureEmpty(v)
          : (
            v === undefined ||
            v === null ||
            v === '' ||
            (f.type === 'checkbox' && f.options && f.options.length > 0 && (!Array.isArray(v) || v.length === 0)) ||
            (f.type === 'checkbox' && (!f.options || f.options.length === 0) && v === false)
          )
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

  const handleNext = () => {
    setSubmitError('')
    const errs = validate(pages[currentPage])
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      focusFirstError(pages[currentPage], errs)
      return
    }
    setCurrentPage((p) => p + 1)
  }

  const handlePrev = () => {
    setSubmitError('')
    setCurrentPage((p) => Math.max(0, p - 1))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (currentPage < pages.length - 1) {
      handleNext()
      return
    }

    const errs = validate(visibleFields.filter(f => f.type !== 'page_break'))
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      const errPageIdx = pages.findIndex(p => p.some(f => errs[f.id]))
      if (errPageIdx !== -1 && errPageIdx !== currentPage) {
        setCurrentPage(errPageIdx)
        setTimeout(() => focusFirstError(pages[errPageIdx], errs), 0)
      } else {
        focusFirstError(pages[currentPage], errs)
      }
      return
    }

    setSubmitting(true)
    try {
      // Only submit currently-visible fields — a value entered then hidden by a
      // rule change must not leak into the response.
      const payload = stripHiddenValues(visibleFields, values)
      const uploadedPayload = await api.uploadPendingFiles(payload)
      const data = await formsStore.submit(id, uploadedPayload)
      // The server clears the draft on submit; reflect that locally too.
      setDraftRestored(false)
      setResult(data)
    } catch (err) {
      // A refused submission is usually the workspace being out of allowance or
      // read-only, not a bad form — say which, and keep the answers on screen.
      const limit = limitBanner(err)
      setSubmitError(limit ? `${limit.title} — ${limit.message}` : (err.message || 'Submission failed'))
    } finally {
      setSubmitting(false)
    }
  }

  // Save the raw current values (not stripped) so text typed into a field that
  // is temporarily hidden by a conditional rule isn't lost. No validation gate:
  // a draft is allowed to be incomplete.
  const handleSaveDraft = async () => {
    setDraftError('')
    setSavingDraft(true)
    try {
      await formsStore.saveDraft(id, values)
      setDraftSavedAt(Date.now())
      setDraftRestored(false)
    } catch (err) {
      setDraftError(err.message || 'Could not save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleDiscardDraft = async () => {
    try {
      await formsStore.discardDraft(id)
    } catch {
      // ignore — clearing the local form is what the user sees anyway
    }
    setValues({})
    setFieldErrors({})
    setDraftRestored(false)
    setDraftSavedAt(null)
  }

  // ---------- render states ----------

  if (loading) {
    return (
      <AppShell title="Loading form…">
        <p className="text-sm text-fg-muted">Please wait while we fetch this form.</p>
      </AppShell>
    )
  }

  if (loadError || !form) {
    return (
      <AppShell title="Form unavailable" back={{ to: '/forms', label: 'Back to forms' }}>
        <div className="bg-surface border border-line rounded-lg p-8 text-center max-w-md mx-auto">
          <p className="text-sm text-fg-muted">{loadError || 'Form not found.'}</p>
          <Link to="/forms" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Back to forms
          </Link>
        </div>
      </AppShell>
    )
  }

  if (form.status !== 'published') {
    return (
      <AppShell title={form.title} back={{ to: '/forms', label: 'Back to forms' }}>
        <div className="bg-surface border border-line rounded-lg p-8 text-center max-w-md mx-auto">
          <p className="text-base font-semibold text-fg">
            This form isn&apos;t published yet
          </p>
          <p className="text-sm text-fg-muted mt-1">
            An admin needs to publish &ldquo;{form.title}&rdquo; before it can accept submissions.
          </p>
          <Link to="/forms" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Back to forms
          </Link>
        </div>
      </AppShell>
    )
  }

  if (result) {
    return (
      <AppShell title={form.title} back={{ to: '/forms', label: 'Back to forms' }}>
        <div className="max-w-xl mx-auto bg-surface border border-line rounded-lg p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-success-subtle flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-success-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-fg">Submitted</h2>
          <p className="text-sm text-fg-muted mt-1">Your response was recorded.</p>

          {result.workflowTriggered ? (
            <div className="mt-4 p-3 rounded-md bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
              Approval workflow started. The first approver has been notified
              and the task is now in their inbox.
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-md bg-warning-subtle border border-warning-line text-sm text-warning-fg">
              No published workflow is linked to this form, so no approval
              task was created.
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2">
            <Link
              to="/forms"
              className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
            >
              Back to forms
            </Link>
            <Link
              to="/tasks"
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
            >
              View my tasks
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={form.title}
      subtitle={form.description || undefined}
      back={{ to: '/forms', label: 'Back to forms' }}
      actions={
        <button
          type="button"
          onClick={() => navigate('/forms')}
          className="px-3 py-1.5 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
        >
          Cancel
        </button>
      }
    >
      <div className="flex flex-col lg:flex-row gap-6 relative">
        {/* Form Container */}
        <div className="flex-1 transition-all duration-300">
          <form onSubmit={handleSubmit} noValidate className={`${previewFile ? 'w-full' : 'max-w-xl mx-auto'} bg-surface border border-line rounded-lg p-6 space-y-5`}>
        {draftRestored && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-warning-subtle border border-warning-line text-sm text-warning-fg">
            <span>We restored your saved draft. Pick up where you left off.</span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="shrink-0 text-warning-fg hover:brightness-110 font-medium underline"
            >
              Discard draft
            </button>
          </div>
        )}

        {visibleFields.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm font-medium text-fg">
              This form has no fields to fill.
            </p>
            <p className="text-xs text-fg-muted mt-1">
              An admin needs to add fields to &ldquo;{form.title}&rdquo; before it can accept submissions.
            </p>
            <Link
              to="/forms"
              className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Back to forms
            </Link>
          </div>
        )}

        {pages.length > 1 && (
          <div className="mb-4 flex items-center justify-between text-xs font-medium text-fg-subtle uppercase tracking-wider">
            <span>Page {currentPage + 1} of {pages.length}</span>
            <div className="flex gap-1">
              {pages.map((_, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i === currentPage ? 'bg-indigo-500' : i < currentPage ? 'bg-indigo-200 dark:bg-indigo-900/30' : 'bg-line'}`} />
              ))}
            </div>
          </div>
        )}

        {pages[currentPage]?.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            value={values[f.id]}
            onChange={(v) => setFieldValue(f.id, v)}
            error={fieldErrors[f.id]}
            onRequestPreview={(file) => setPreviewFile(file)}
          />
        ))}

        {submitError && (
          <div className="p-3 rounded-md bg-danger-subtle border border-danger-line text-sm text-danger-fg">
            {submitError}
          </div>
        )}

        {draftError && (
          <p className="text-right text-xs text-danger-fg">{draftError}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
          {draftSavedAt && !savingDraft && (
            <span className="mr-auto text-xs text-success-fg">Draft saved</span>
          )}
          {currentPage > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition mr-auto"
            >
              Previous
            </button>
          )}
          {currentPage === 0 && (
            <button
              type="button"
              onClick={() => navigate('/forms')}
              className="px-4 py-2 rounded-md border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || visibleFields.length === 0}
            className="px-4 py-2 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition"
          >
            {savingDraft ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="submit"
            disabled={submitting || visibleFields.length === 0}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition"
          >
            {currentPage < pages.length - 1 ? 'Next' : (submitting ? 'Submitting…' : 'Submit')}
          </button>
        </div>
        {savingDraft && (
          <p className="mt-4 text-center text-xs font-medium text-fg-subtle animate-pulse">
            Saving draft...
          </p>
        )}
          </form>
        </div>

        {/* File Preview Sidebar (Option B: Contextual Slide-out with Sticky positioning) */}
        {previewFile && (
          <div className="hidden lg:block w-[40%] xl:w-[45%] shrink-0 self-stretch">
            <FilePreviewPane 
              file={previewFile} 
              onClose={() => setPreviewFile(null)}
              availableDocs={availableDocs}
              onSelect={(file) => setPreviewFile(file)}
            />
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default FillForm

// Shared form-field primitives used by both the standalone form filler
// (FillForm) and Submit-node task forms (TaskDetail). Keeps a single source of
// truth for field rendering, file upload, e-signature capture, and validation.

import React, { useEffect, useState } from 'react'
import { api, toAbsoluteUrl } from '../utils/api'
import { fieldMaxMb, MAX_UPLOAD_MB } from '../utils/uploads'

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'
const inputErrorCls = 'border-red-400 focus:ring-red-200 focus:border-red-400'

// Field types a designer can drop into a Submit-node form.
export const FORM_FIELD_TYPES = [
  { type: 'text', label: 'Text' },
  { type: 'textarea', label: 'Text area' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'dropdown', label: 'Dropdown' },
  { type: 'file', label: 'File upload' },
  { type: 'signature', label: 'E-signature' },
]

let _fid = 0
export const newFieldId = () => `f${Date.now().toString(36)}${(_fid++).toString(36)}`

// Handwriting/signature fonts. These live on Adobe Fonts (Typekit), so they only
// render when an Adobe Fonts kit exposing these families is loaded (see
// index.html). Each falls back to the generic `cursive` so a script-like style
// still shows if the kit isn't present.
export const SIGNATURE_FONTS = [
  { label: 'Lindsey', value: "lindsey, 'Lindsey', cursive" },
  { label: 'Ernie', value: "adobe-handwriting-ernie, 'Ernie', cursive" },
  { label: 'Frank', value: "adobe-handwriting-frank, 'Frank', cursive" },
  { label: 'Tiffany', value: "adobe-handwriting-tiffany, 'Tiffany', cursive" },
  { label: 'Fertigo', value: "fertigo-pro, 'Fertigo', cursive" },
]

// Renders a stored signature: typed text in its chosen font, or an uploaded image.
export function SignatureMark({ signature, className = '' }) {
  if (!signature) return null
  if (signature.kind === 'uploaded' && signature.url) {
    return (
      <img
        src={toAbsoluteUrl(signature.url)}
        alt="e-signature"
        className={`max-h-12 rounded border border-line bg-surface p-0.5 ${className}`}
      />
    )
  }
  if (signature.kind === 'typed' && signature.text) {
    return (
      <span
        className={`block text-fg ${className}`}
        style={{ fontFamily: signature.font || 'cursive', fontSize: '20px', lineHeight: 1.3 }}
      >
        {signature.text}
      </span>
    )
  }
  return null
}

// E-signature capture. Two modes: type a name in a signature font, or upload an
// image. Lifts the chosen signature up via onChange —
// { kind:'typed', text, font } | { kind:'uploaded', url, name } | null.
export function SignaturePad({ onChange, disabled, label }) {
  const [mode, setMode] = useState('type')
  const [text, setText] = useState('')
  const [font, setFont] = useState(SIGNATURE_FONTS[0].value)
  const [uploaded, setUploaded] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let sig = null
    if (mode === 'type' && text.trim()) sig = { kind: 'typed', text: text.trim(), font }
    else if (mode === 'upload' && uploaded) sig = { kind: 'uploaded', url: uploaded.url, name: uploaded.name }
    onChange(sig)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, text, font, uploaded])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    if (!file.type.startsWith('image/')) {
      setErr('Please upload an image file.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErr(`File too large. Max ${MAX_UPLOAD_MB} MB.`)
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const { file: meta } = await api.upload(file, MAX_UPLOAD_MB)
      setUploaded({ url: meta.url, name: meta.name })
    } catch (e2) {
      setErr(e2.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const tabCls = (m) =>
    `px-2.5 py-1 transition ${mode === m ? 'bg-indigo-600 text-white' : 'bg-surface text-fg-muted hover:bg-surface-2'}`

  return (
    <div className="border border-line rounded-md p-3 bg-surface-2/60">
      <div className="flex items-center justify-between mb-2">
        {label ? <span className="text-xs font-semibold text-fg">{label}</span> : <span />}
        <div className="flex rounded-md border border-line overflow-hidden text-xs">
          <button type="button" onClick={() => setMode('type')} disabled={disabled} className={tabCls('type')}>
            Type
          </button>
          <button type="button" onClick={() => setMode('upload')} disabled={disabled} className={tabCls('upload')}>
            Upload
          </button>
        </div>
      </div>

      {mode === 'type' ? (
        <>
          <input
            type="text"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your full name"
            className={inputCls}
          />
          <select
            value={font}
            disabled={disabled}
            onChange={(e) => setFont(e.target.value)}
            className={`${inputCls} mt-2`}
          >
            {SIGNATURE_FONTS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          {text.trim() && (
            <div className="mt-2 px-3 py-2 bg-surface border border-dashed border-line rounded-md">
              <span style={{ fontFamily: font, fontSize: '26px', lineHeight: 1.2 }} className="text-fg">
                {text}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <label className="flex items-center gap-3">
            <span className="px-3 py-2 rounded-md border border-line bg-surface text-sm font-medium text-fg hover:bg-surface-2 cursor-pointer">
              {uploading ? 'Uploading…' : uploaded ? 'Replace image' : 'Choose image'}
            </span>
            <input type="file" accept="image/*" onChange={handleFile} disabled={disabled || uploading} className="hidden" />
            <span className="text-[11px] text-fg-subtle">Max {MAX_UPLOAD_MB} MB</span>
          </label>
          {uploaded && <SignatureMark signature={{ kind: 'uploaded', url: uploaded.url }} className="mt-2" />}
        </>
      )}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  )
}

// Uploads the chosen file to /api/uploads and stores { name, url, mime, size }
// as the field value, so it can later be opened as a real attachment.
export function FileField({ value, onChange, maxMb = MAX_UPLOAD_MB, disabled }) {
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
      const { file: saved } = await api.upload(file, maxMb)
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
        disabled={uploading || disabled}
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

// Renders a single labelled field. `richSignature` swaps the plain typed-name
// signature input for the full SignaturePad (typed-font / image upload).
export function FieldRow({ field, value, onChange, error, richSignature = false, disabled = false }) {
  const cls = `${inputCls} ${error ? inputErrorCls : ''}`

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            rows={4}
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={`${cls} resize-y`}
          />
        )
      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={cls}
          />
        )
      case 'date':
        return (
          <input type="date" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cls} />
        )
      case 'dropdown':
        return (
          <select value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cls}>
            <option value="">— Select —</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={!!value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
            />
            <span>{field.placeholder || 'Yes'}</span>
          </label>
        )
      case 'signature':
        return richSignature ? (
          <SignaturePad onChange={onChange} disabled={disabled} />
        ) : (
          <input
            type="text"
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your full name to sign"
            className={cls}
          />
        )
      case 'file':
        return <FileField value={value} onChange={onChange} maxMb={fieldMaxMb(field)} disabled={disabled} />
      case 'repeater':
        return <div className="text-xs text-fg-muted italic">Repeater fields aren&apos;t supported in this view.</div>
      case 'text':
      default:
        return (
          <input
            type="text"
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={cls}
          />
        )
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

// Conditional field logic: should a field be shown given the current answers?
// A field carries `conditionalLogic: { enabled, dependsOn, operator, showWhen }`.
// `dependsOn` is the id of an EARLIER field; when the rule doesn't match, the
// field is hidden. Legacy data may store `conditionalLogic` as a bare boolean
// (from the old builder) — that has no rule, so we treat it as always visible.
export function isFieldVisible(field, values) {
  const cl = field?.conditionalLogic
  if (!cl || typeof cl !== 'object' || !cl.enabled || !cl.dependsOn) return true

  const actual = values ? values[cl.dependsOn] : undefined
  const expected = cl.showWhen

  switch (cl.operator || 'eq') {
    case 'neq':
      return String(actual ?? '') !== String(expected ?? '')
    case 'contains':
      return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
    case 'nonempty':
      return !(actual === undefined || actual === null || actual === '' || actual === false)
    case 'eq':
    default:
      return String(actual ?? '') === String(expected ?? '')
  }
}

// Filter a field list down to the ones currently visible (conditional logic
// applied). Recomputes from scratch on every call so chained rules resolve.
export function visibleFields(fields, values) {
  return (fields || []).filter((f) => isFieldVisible(f, values))
}

// Build a submit payload containing ONLY visible fields, so a value that was
// entered and then hidden by a rule change doesn't leak into the response.
export function stripHiddenValues(fields, values) {
  const out = {}
  for (const f of visibleFields(fields, values)) {
    if (values[f.id] !== undefined) out[f.id] = values[f.id]
  }
  return out
}

// Ready-made format patterns exposed in the builder (plus a Custom option). The
// key is stored on the field via `validation.pattern` + `validation.patternLabel`.
export const PATTERN_PRESETS = {
  email: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', label: 'Please enter a valid email address' },
  phone: { pattern: '^[+]?[0-9\\s()-]{7,15}$', label: 'Please enter a valid phone number' },
  digits: { pattern: '^[0-9]+$', label: 'Only digits are allowed' },
  alnum: { pattern: '^[a-zA-Z0-9]+$', label: 'Only letters and numbers are allowed' },
}

// Advanced per-field validation (length limits, numeric range, format pattern).
// Reads the canonical nested `field.validation` object, falling back to legacy
// flat props (maxLength/min/max) written by older builder versions. Empty values
// are intentionally NOT validated here — the required-check owns emptiness — so
// optional fields with a rule stay optional. Returns an error string or null.
export function validateField(field, value) {
  if (!field) return null
  const v = field.validation || {}
  const minLength = v.minLength != null ? v.minLength : field.minLength
  const maxLength = v.maxLength != null ? v.maxLength : field.maxLength
  const min = v.min != null ? v.min : field.min
  const max = v.max != null ? v.max : field.max
  const pattern = v.pattern
  const patternLabel = v.patternLabel

  const empty = value === undefined || value === null || value === ''
  if (empty) return null

  if (field.type === 'text' || field.type === 'textarea') {
    const len = String(value).length
    if (minLength != null && len < minLength) return `${field.label} must be at least ${minLength} characters`
    if (maxLength != null && len > maxLength) return `${field.label} must be at most ${maxLength} characters`
  }

  if (field.type === 'number') {
    const n = Number(value)
    if (Number.isNaN(n)) return `${field.label} must be a number`
    if (min != null && n < min) return `${field.label} must be at least ${min}`
    if (max != null && n > max) return `${field.label} must be at most ${max}`
  }

  if (pattern && (field.type === 'text' || field.type === 'textarea')) {
    try {
      if (!new RegExp(pattern).test(String(value))) {
        return patternLabel || `${field.label} is not in the expected format`
      }
    } catch {
      // Malformed stored regex — never block submission on it.
    }
  }

  return null
}

// Required-field validation shared by FillForm + Submit-node tasks. Returns a
// map of { [fieldId]: errorMessage } for any empty required field, then layers
// advanced validation (length/range/pattern) on top for filled fields.
export function validateFields(fields, values) {
  const errs = {}
  for (const f of fields || []) {
    const v = values[f.id]
    if (f.required) {
      let empty = v === undefined || v === null || v === ''
      if (!empty && f.type === 'checkbox') empty = v === false
      if (!empty && f.type === 'signature' && typeof v === 'object') empty = !(v.text || v.url)
      if (empty) {
        errs[f.id] = `${f.label} is required`
        continue
      }
    }
    const advanced = validateField(f, v)
    if (advanced) errs[f.id] = advanced
  }
  return errs
}

// Read-only renderer for one submitted form value (shown to downstream viewers).
export function FieldValueView({ field, value }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-fg-subtle">—</span>
  }
  if (field.type === 'file' && typeof value === 'object' && value.url) {
    return (
      <a href={toAbsoluteUrl(value.url)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 underline">
        {value.name || 'Attachment'}
      </a>
    )
  }
  if (field.type === 'signature') {
    if (typeof value === 'object') return <SignatureMark signature={value} />
    return <span style={{ fontFamily: 'cursive' }}>{value}</span>
  }
  return <span className="text-fg whitespace-pre-wrap">{String(value)}</span>
}

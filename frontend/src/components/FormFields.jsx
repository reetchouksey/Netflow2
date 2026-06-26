// Shared form-field primitives used by both the standalone form filler
// (FillForm) and Submit-node task forms (TaskDetail). Keeps a single source of
// truth for field rendering, file upload, e-signature capture, and validation.

import React, { useEffect, useState } from 'react'
import { api, toAbsoluteUrl } from '../utils/api'
import { fieldMaxMb, MAX_UPLOAD_MB } from '../utils/uploads'

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'
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

export const SIGNATURE_FONTS = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: "Calibri, 'Segoe UI', sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
]

// Renders a stored signature: typed text in its chosen font, or an uploaded image.
export function SignatureMark({ signature, className = '' }) {
  if (!signature) return null
  if (signature.kind === 'uploaded' && signature.url) {
    return (
      <img
        src={toAbsoluteUrl(signature.url)}
        alt="e-signature"
        className={`max-h-12 rounded border border-gray-200 bg-white p-0.5 ${className}`}
      />
    )
  }
  if (signature.kind === 'typed' && signature.text) {
    return (
      <span
        className={`block text-gray-900 ${className}`}
        style={{ fontFamily: signature.font || 'cursive', fontSize: '20px', lineHeight: 1.3 }}
      >
        {signature.text}
      </span>
    )
  }
  return null
}

// E-signature capture. Two modes: type a name in a corporate font, or upload an
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
    `px-2.5 py-1 transition ${mode === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`

  return (
    <div className="border border-gray-200 rounded-md p-3 bg-gray-50/60">
      <div className="flex items-center justify-between mb-2">
        {label ? <span className="text-xs font-semibold text-gray-700">{label}</span> : <span />}
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
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
            <div className="mt-2 px-3 py-2 bg-white border border-dashed border-gray-300 rounded-md">
              <span style={{ fontFamily: font, fontSize: '26px', lineHeight: 1.2 }} className="text-gray-900">
                {text}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <label className="flex items-center gap-3">
            <span className="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
              {uploading ? 'Uploading…' : uploaded ? 'Replace image' : 'Choose image'}
            </span>
            <input type="file" accept="image/*" onChange={handleFile} disabled={disabled || uploading} className="hidden" />
            <span className="text-[11px] text-gray-400">Max {MAX_UPLOAD_MB} MB</span>
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
        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60"
      />
      {!uploading && !uploadError && <p className="mt-1 text-xs text-gray-400">Max {maxMb} MB</p>}
      {uploading && <p className="mt-1 text-xs text-gray-500">Uploading…</p>}
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
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
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
        return <div className="text-xs text-gray-500 italic">Repeater fields aren&apos;t supported in this view.</div>
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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {renderInput()}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// Required-field validation shared by FillForm + Submit-node tasks. Returns a
// map of { [fieldId]: errorMessage } for any empty required field.
export function validateFields(fields, values) {
  const errs = {}
  for (const f of fields || []) {
    if (!f.required) continue
    const v = values[f.id]
    let empty = v === undefined || v === null || v === ''
    if (!empty && f.type === 'checkbox') empty = v === false
    if (!empty && f.type === 'signature' && typeof v === 'object') empty = !(v.text || v.url)
    if (empty) errs[f.id] = `${f.label} is required`
  }
  return errs
}

// Read-only renderer for one submitted form value (shown to downstream viewers).
export function FieldValueView({ field, value }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-gray-400">—</span>
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
  return <span className="text-gray-800 whitespace-pre-wrap">{String(value)}</span>
}

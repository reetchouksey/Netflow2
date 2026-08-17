// Shared form-field primitives used by both the standalone form filler
// (FillForm) and Submit-node task forms (TaskDetail). Keeps a single source of
// truth for field rendering, file upload, e-signature capture, and validation.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api, toAbsoluteUrl } from '../utils/api'
import { fieldMaxMb, MAX_UPLOAD_MB } from '../utils/uploads'

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'
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

// Renders a stored signature: typed text, uploaded image, or drawn pad PNG.
export function SignatureMark({ signature, className = '' }) {
  if (!signature) return null
  if ((signature.kind === 'uploaded' || signature.kind === 'drawn') && signature.url) {
    return (
      <img
        src={toAbsoluteUrl(signature.url)}
        alt="e-signature"
        className={`max-h-12 rounded border border-line bg-surface p-0.5 ${className}`}
      />
    )
  }
  // Legacy uploads without kind still have a url.
  if (signature.url && !signature.text) {
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

// True when a signature field value is missing or incomplete.
// Accepts structured pads ({ text } / { url }) and legacy plain strings.
export function isSignatureEmpty(value) {
  if (value === undefined || value === null || value === '') return true
  if (typeof value === 'object') return !(value.text || value.url)
  return !String(value).trim()
}

const DRAW_H = 140

// E-signature capture: Type (font), Draw (canvas pen), or Upload image.
// Lifts via onChange —
// { kind:'typed', text, font } | { kind:'uploaded'|'drawn', url, name } | null.
// Optional `uploadFile(file) => Promise<{ url, name }>` for public forms.
export function SignaturePad({ onChange, disabled, label, id, uploadFile }) {
  const [mode, setMode] = useState('type')
  const [text, setText] = useState('')
  const [font, setFont] = useState(SIGNATURE_FONTS[0].value)
  const [uploaded, setUploaded] = useState(null)
  const [drawn, setDrawn] = useState(null)
  const [hasInk, setHasInk] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const drawingRef = useRef(false)
  const lastRef = useRef(null)
  const hasInkRef = useRef(false)
  const exportTimer = useRef(null)
  const exportGen = useRef(0)

  const clearExportTimer = () => {
    if (exportTimer.current) {
      clearTimeout(exportTimer.current)
      exportTimer.current = null
    }
  }

  const paintBlank = useCallback((ctx, w, h) => {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.2
  }, [])

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(wrap.clientWidth, 1)
    const h = DRAW_H
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintBlank(ctx, w, h)
    hasInkRef.current = false
    setHasInk(false)
  }, [paintBlank])

  useEffect(() => {
    if (mode !== 'draw') return undefined
    setupCanvas()
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      // Resizing wipes ink; avoid fighting an in-progress stroke.
      if (drawingRef.current) return
      const had = hasInkRef.current
      setupCanvas()
      if (had) {
        setDrawn(null)
        clearExportTimer()
      }
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [mode, setupCanvas])

  useEffect(() => () => clearExportTimer(), [])

  useEffect(() => {
    let sig = null
    if (mode === 'type' && text.trim()) sig = { kind: 'typed', text: text.trim(), font }
    else if (mode === 'upload' && uploaded) sig = { kind: 'uploaded', url: uploaded.url, name: uploaded.name }
    else if (mode === 'draw' && drawn) sig = { kind: 'drawn', url: drawn.url, name: drawn.name }
    onChange(sig)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, text, font, uploaded, drawn])

  const switchMode = (next) => {
    if (disabled || next === mode) return
    clearExportTimer()
    setErr('')
    if (mode === 'draw' || next === 'draw') {
      setDrawn(null)
      hasInkRef.current = false
      setHasInk(false)
    }
    setMode(next)
  }

  const persistDrawnBlob = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasInkRef.current || disabled) return
    const gen = ++exportGen.current
    setUploading(true)
    setErr('')
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob || gen !== exportGen.current) return
      const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' })
      const meta = uploadFile
        ? await uploadFile(file)
        : (await api.upload(file, MAX_UPLOAD_MB)).file
      if (gen !== exportGen.current) return
      setDrawn({ url: meta.url, name: meta.name || file.name })
    } catch (e2) {
      if (gen === exportGen.current) setErr(e2.message || 'Could not save signature')
    } finally {
      if (gen === exportGen.current) setUploading(false)
    }
  }, [disabled, uploadFile])

  const scheduleExport = useCallback(() => {
    clearExportTimer()
    exportTimer.current = setTimeout(() => {
      exportTimer.current = null
      persistDrawnBlob()
    }, 400)
  }, [persistDrawnBlob])

  const pointFromEvent = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e) => {
    if (disabled) return
    const canvas = canvasRef.current
    const pt = pointFromEvent(e)
    if (!canvas || !pt) return
    e.preventDefault()
    canvas.setPointerCapture?.(e.pointerId)
    drawingRef.current = true
    lastRef.current = pt
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
    ctx.lineTo(pt.x + 0.01, pt.y + 0.01)
    ctx.stroke()
    hasInkRef.current = true
    setHasInk(true)
    setDrawn(null)
    clearExportTimer()
  }

  const onPointerMove = (e) => {
    if (!drawingRef.current || disabled) return
    const canvas = canvasRef.current
    const pt = pointFromEvent(e)
    const last = lastRef.current
    if (!canvas || !pt || !last) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastRef.current = pt
  }

  const endStroke = (e) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    try { canvasRef.current?.releasePointerCapture?.(e.pointerId) } catch { /* noop */ }
    if (hasInkRef.current) scheduleExport()
  }

  const clearDraw = () => {
    if (disabled) return
    clearExportTimer()
    exportGen.current += 1
    setupCanvas()
    setDrawn(null)
    setErr('')
    setUploading(false)
  }

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
      const meta = uploadFile
        ? await uploadFile(file)
        : (await api.upload(file, MAX_UPLOAD_MB)).file
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
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      className="border border-line rounded-md p-3 bg-surface-2/60 focus:outline-none"
    >
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        {label ? <span className="text-xs font-semibold text-fg">{label}</span> : <span />}
        <div className="flex rounded-md border border-line overflow-hidden text-xs">
          <button type="button" onClick={() => switchMode('type')} disabled={disabled} className={tabCls('type')}>
            Type
          </button>
          <button type="button" onClick={() => switchMode('draw')} disabled={disabled} className={tabCls('draw')}>
            Draw
          </button>
          <button type="button" onClick={() => switchMode('upload')} disabled={disabled} className={tabCls('upload')}>
            Upload
          </button>
        </div>
      </div>

      {mode === 'type' && (
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
      )}

      {mode === 'draw' && (
        <div>
          <div
            ref={wrapRef}
            className={`relative w-full rounded-md border-2 border-dashed border-line bg-white overflow-hidden ${disabled ? 'opacity-60' : ''}`}
          >
            <canvas
              ref={canvasRef}
              className={`block w-full ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
              style={{ height: DRAW_H, touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-fg-subtle">
              {uploading
                ? 'Saving signature…'
                : hasInk
                  ? (drawn ? 'Signature saved' : 'Sign with mouse, finger, or stylus')
                  : 'Sign with mouse, finger, or stylus'}
            </p>
            <button
              type="button"
              onClick={clearDraw}
              disabled={disabled || (!hasInk && !drawn)}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-line text-fg-muted hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <>
          <label className="flex items-center gap-3">
            <span className={`px-3 py-2 rounded-md border border-line bg-surface text-sm font-medium text-fg ${disabled ? 'opacity-60' : 'hover:bg-surface-2 cursor-pointer'}`}>
              {uploading ? 'Uploading…' : uploaded ? 'Replace image' : 'Choose image'}
            </span>
            <input type="file" accept="image/*" onChange={handleFile} disabled={disabled || uploading} className="hidden" />
            <span className="text-[11px] text-fg-subtle">Max {MAX_UPLOAD_MB} MB</span>
          </label>
          {uploaded && <SignatureMark signature={{ kind: 'uploaded', url: uploaded.url }} className="mt-2" />}
        </>
      )}
      {err && <p className="mt-2 text-xs text-danger-fg">{err}</p>}
    </div>
  )
}

// Uploads the chosen file to /api/uploads and stores { name, url, mime, size }
// as the field value, so it can later be opened as a real attachment.
// Shared progress readout: a determinate bar when the browser reports totals,
// an indeterminate shimmer otherwise. Big attachments used to show nothing but
// the word "Uploading…" for a minute.
export function UploadProgress({ percent }) {
  const known = typeof percent === 'number'
  return (
    <div className="mt-1.5">
      <div
        className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden"
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? percent : undefined}
      >
        <div
          className={`h-full rounded-full bg-info-solid transition-[width] duration-150 ${known ? '' : 'animate-pulse w-1/3'}`}
          style={known ? { width: `${percent}%` } : undefined}
        />
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        {known ? `Uploading… ${percent}%` : 'Uploading…'}
      </p>
    </div>
  )
}

export function FileField({ value, onChange, maxMb = MAX_UPLOAD_MB, disabled }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null)
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
    setProgress(0)
    setUploadError('')
    try {
      const { file: saved } = await api.upload(file, maxMb, { onProgress: setProgress })
      onChange(saved)
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
      onChange('')
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  const current = value && typeof value === 'object' && value.url ? value : null

  return (
    <div>
      <input
        type="file"
        onChange={handleFile}
        disabled={uploading || disabled}
        className="block w-full text-sm text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-info-subtle file:text-info-fg hover:file:brightness-95 disabled:opacity-60"
      />
      {!uploading && !uploadError && <p className="mt-1 text-xs text-fg-subtle">Max {maxMb} MB</p>}
      {uploading && <UploadProgress percent={progress} />}
      {uploadError && <p className="mt-1 text-xs text-danger-fg">{uploadError}</p>}
      {current && !uploading && (
        <p className="mt-1 text-xs text-success-fg">
          Uploaded:{' '}
          <a href={toAbsoluteUrl(current.url)} target="_blank" rel="noreferrer" className="underline hover:brightness-110">
            {current.name}
          </a>
        </p>
      )}
    </div>
  )
}

export function ReferenceUserSelect({ value, onChange, disabled, placeholder, className, a11y }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (value !== query && !open) {
      setQuery(value || '')
    }
  }, [value, open])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setQuery(value || '')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  useEffect(() => {
    if (!open || query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get(`/api/users?search=${encodeURIComponent(query)}&limit=10`)
        setResults(res.users || [])
      } catch (err) {
        console.error('Failed to fetch reference users:', err)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, open])

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        {...a11y}
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange('') // Clear value while typing to enforce strict match
          setOpen(true)
        }}
        onFocus={() => {
          if (query.length >= 2) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && open) e.preventDefault()
        }}
        placeholder={placeholder || 'Search users...'}
        className={className}
        autoComplete="off"
      />
      {open && (loading || results.length > 0 || query.length >= 2) && (
        <ul className="absolute z-50 w-full mt-1 bg-surface border border-line rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <li className="px-3 py-2 text-sm text-fg-subtle">Searching...</li>
          ) : results.length > 0 ? (
            results.map((user) => (
              <li
                key={user._id}
                className="px-3 py-2 cursor-pointer hover:bg-surface-2 text-sm flex flex-col"
                onClick={() => {
                  const name = user.name || user.email
                  setQuery(name)
                  onChange(name)
                  setOpen(false)
                }}
              >
                <span className="font-medium text-fg">{user.name}</span>
                <span className="text-xs text-fg-muted">{user.email}</span>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-fg-subtle">No users found</li>
          )}
        </ul>
      )}
    </div>
  )
}

// Renders a single labelled field. `richSignature` swaps the plain typed-name
// signature input for the full SignaturePad (typed-font / image upload).
// `fieldDomId` keeps the label/input/error wiring and the scroll-to-first-error
// lookup in one place — callers only need the field id.
export const fieldDomId = (fieldId) => `ff-${fieldId}`

export function FieldRow({ field, value, onChange, error, richSignature = false, disabled = false }) {
  const cls = `${inputCls} ${error ? inputErrorCls : ''}`
  const inputId = fieldDomId(field.id)
  const labelId = `${inputId}-label`
  const errorId = error ? `${inputId}-error` : undefined
  // Inputs that carry the label/error wiring. Checkbox has its own inline
  // label, and the composite fields (file, grid, repeater, signature pad)
  // render their own controls.
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
            disabled={disabled}
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
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={cls}
          />
        )
      case 'date':
        return (
          <input {...a11y} type="date" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cls} />
        )
      case 'dropdown':
        return (
          <select {...a11y} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cls}>
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
              {...a11y}
              type="checkbox"
              checked={!!value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
            />
            <span>{field.placeholder || 'Yes'}</span>
          </label>
        )
      case 'radio':
        return (
          <div className="space-y-1.5" role="radiogroup" aria-labelledby={labelId} aria-describedby={errorId}>
            {(field.options || []).map((opt, i) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-fg">
                <input
                  id={i === 0 ? inputId : undefined}
                  type="radio"
                  name={inputId}
                  value={opt}
                  checked={value === opt}
                  disabled={disabled}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-4 h-4 border-line text-indigo-600 focus:ring-indigo-400"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        )
      case 'signature':
        // Always use the rich pad (typed font / image). `richSignature` is kept
        // for call-site compatibility; plain text is no longer offered.
        return (
          <SignaturePad
            id={inputId}
            onChange={onChange}
            disabled={disabled}
          />
        )
      case 'file':
        return <FileField value={value} onChange={onChange} maxMb={fieldMaxMb(field)} disabled={disabled} />
      case 'repeater':
        return <div className="text-xs text-fg-muted italic">Repeater fields aren&apos;t supported in this view.</div>
      case 'text':
      default:
        if (field.referenceUser) {
          return (
            <ReferenceUserSelect
              a11y={a11y}
              value={value ?? ''}
              disabled={disabled}
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
            disabled={disabled}
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
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  )
}

// After a failed submit, bring the first offending field into view and focus it
// — otherwise the errors can be several screens below the button.
export function focusFirstError(fields, errors) {
  const first = (fields || []).find((f) => errors?.[f.id])
  if (!first) return
  const row = document.querySelector(`[data-field-row="${first.id}"]`)
  const control = document.getElementById(fieldDomId(first.id))
  const target = control || row
  try {
    ;(row || target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    row?.scrollIntoView()
  }
  if (control && typeof control.focus === 'function') {
    control.focus({ preventScroll: true })
  }
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
      if (f.type === 'signature') empty = isSignatureEmpty(v)
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

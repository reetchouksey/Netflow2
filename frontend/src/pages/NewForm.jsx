import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formsStore } from '../lib/formsStore'
import { FORM_TEMPLATES } from '../lib/formTemplates'
import { api } from '../utils/api'
import { fieldMaxMb, MAX_UPLOAD_MB } from '../utils/uploads'
import { PATTERN_PRESETS } from '../components/FormFields'
import { toast } from '../lib/toastStore'
import { confirm } from '../lib/confirmStore'

const FIELD_TYPES = [
  {
    type: 'text',
    label: 'Text input',
    defaults: { label: 'Untitled field', placeholder: '', required: false, multiline: false, maxLength: null },
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    defaults: { label: 'Select an option', placeholder: 'Choose...', required: false, options: ['Option 1', 'Option 2'] },
  },
  {
    type: 'date',
    label: 'Date picker',
    defaults: { label: 'Pick a date', required: false },
  },
  {
    type: 'file',
    label: 'File upload',
    defaults: { label: 'Upload file', required: false, fileTypes: 'PDF / DOCX', maxSize: 5 },
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    defaults: { label: 'Check this box', required: false },
  },
  {
    type: 'signature',
    label: 'Signature',
    defaults: { label: 'Signature', required: false },
  },
  {
    type: 'number',
    label: 'Number',
    defaults: { label: 'Enter a number', placeholder: '', required: false, min: null, max: null },
  },
  {
    type: 'radio',
    label: 'Radio group',
    defaults: { label: 'Choose one', required: false, options: ['Option 1', 'Option 2'] },
  },
  {
    type: 'grid',
    label: 'Table / Grid',
    defaults: {
      label: 'Table',
      required: false,
      columns: [{ id: 'c1', label: 'Column 1', type: 'text' }],
    },
  },
]

const newFieldId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

// Clone grid columns with fresh ids so duplicated/added grids never share the
// same column objects (which would alias edits across separate fields).
const freshColumns = (cols) =>
  (Array.isArray(cols) ? cols : []).map((c) => ({
    ...c,
    id: newFieldId(),
    options: Array.isArray(c.options) ? [...c.options] : undefined,
  }))

const seededFields = () => [
  { id: newFieldId(), type: 'text', label: 'Employee name', placeholder: 'Jane Doe', required: true, multiline: false, maxLength: null },
  { id: newFieldId(), type: 'dropdown', label: 'Leave type', placeholder: 'Select leave type', required: true, options: ['Annual leave', 'Sick leave', 'Casual leave', 'Maternity/Paternity'] },
  { id: newFieldId(), type: 'date', label: 'Start date', required: true },
  { id: newFieldId(), type: 'date', label: 'End date', required: true },
  { id: newFieldId(), type: 'text', label: 'Reason', placeholder: 'Briefly explain', required: false, multiline: true, maxLength: 300 },
  { id: newFieldId(), type: 'file', label: 'Attach document', required: true, fileTypes: 'PDF / DOCX', maxSize: 5 },
]

const subtitleFor = (f) => {
  const req = f.required ? 'Required' : 'Optional'
  switch (f.type) {
    case 'text':
      return f.multiline
        ? `Text area · ${req}${f.maxLength ? ` — max ${f.maxLength} chars` : ''}`
        : `Text input · ${req}`
    case 'dropdown':
      return `Dropdown · ${(f.options || []).join(' / ') || 'no options'}`
    case 'date':
      return `Date picker · ${req}`
    case 'file':
      return `File upload · ${f.fileTypes || 'Any file'} up to ${fieldMaxMb(f)} MB`
    case 'checkbox':
      return `Checkbox · ${req}`
    case 'signature':
      return `Signature · ${req}`
    case 'number':
      return `Number · ${req}`
    case 'radio':
      return `Radio · ${(f.options || []).join(' / ') || 'no options'}`
    case 'grid': {
      const n = (f.columns || []).length
      return `Table · ${n} column${n === 1 ? '' : 's'}`
    }
    default:
      return f.type
  }
}

function FieldPalette({ onAdd }) {
  return (
    <aside className="w-44 shrink-0 border-r border-line bg-surface px-3 py-5">
      <p className="text-[11px] font-semibold tracking-wider text-fg-muted mb-3 px-1">FIELD TYPES</p>
      <ul className="space-y-2">
        {FIELD_TYPES.map((t) => (
          <li key={t.type}>
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-field-type', t.type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(t.type)}
              className="w-full px-3 py-2 text-sm font-medium rounded-md border border-line bg-surface text-fg hover:bg-surface-2 hover:border-line transition cursor-grab active:scale-[0.99] text-left"
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

// MIME type used to distinguish a "reorder existing field" drag from a
// "drop a new field type from the palette" drag.
const REORDER_MIME = 'application/x-field-id'

function FieldCard({
  field,
  index,
  total,
  selected,
  dropPosition, // null | 'before' | 'after' — shows the drop indicator line
  onSelect,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}) {
  return (
    <div
      onClick={() => onSelect(field.id)}
      onDragOver={(e) => onDragOver(e, field.id)}
      onDragLeave={() => onDragLeave(field.id)}
      onDrop={(e) => onDrop(e, field.id)}
      onDragEnd={onDragEnd}
      className={`group relative flex items-start gap-3 px-3 py-4 rounded-lg border bg-surface cursor-pointer transition ${
        selected
          ? 'border-indigo-400 ring-2 ring-indigo-200'
          : 'border-line hover:border-line'
      }`}
    >
      {/* drop-target indicator line */}
      {dropPosition === 'before' && (
        <span className="absolute -top-1 left-2 right-2 h-0.5 rounded-full bg-indigo-500" />
      )}
      {dropPosition === 'after' && (
        <span className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-indigo-500" />
      )}

      {/* drag handle — initiates the reorder drag */}
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, field.id)}
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        className="mt-0.5 w-5 h-6 rounded text-fg-subtle hover:text-fg-muted hover:bg-surface-3 flex items-center justify-center cursor-grab active:cursor-grabbing transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-fg">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
        <p className="text-xs text-fg-muted mt-0.5">{subtitleFor(field)}</p>
      </div>

      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
        {/* keyboard / no-drag fallback: up + down arrows */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveUp(field.id) }}
          disabled={index === 0}
          title="Move up"
          aria-label="Move field up"
          className="w-7 h-6 rounded-md border border-line bg-surface-2 hover:bg-surface-3 text-fg-muted disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveDown(field.id) }}
          disabled={index === total - 1}
          title="Move down"
          aria-label="Move field down"
          className="w-7 h-6 rounded-md border border-line bg-surface-2 hover:bg-surface-3 text-fg-muted disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate(field.id)
          }}
          title="Duplicate"
          className="w-7 h-6 rounded-md border border-line bg-surface-2 hover:bg-surface-3 text-fg-muted flex items-center justify-center transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10a2 2 0 002 2h7M16 5H8a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V9l-4-4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(field.id)
          }}
          title="Delete"
          className="w-7 h-6 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'

function FieldSettings({ field, fields = [], onChange, onDelete }) {
  if (!field) {
    return (
      <aside className="w-72 shrink-0 border-l border-line bg-surface px-5 py-6">
        <p className="text-[11px] font-semibold tracking-wider text-fg-muted mb-3">FIELD SETTINGS</p>
        <p className="text-sm text-fg-subtle mt-10 text-center">Select a field on the canvas to configure it.</p>
      </aside>
    )
  }

  const update = (patch) => onChange({ ...field, ...patch })
  const typeLabel = FIELD_TYPES.find((t) => t.type === field.type)?.label || field.type

  return (
    <aside className="w-72 shrink-0 border-l border-line bg-surface px-5 py-6 overflow-y-auto">
      <p className="text-[11px] font-semibold tracking-wider text-fg-muted mb-3">FIELD SETTINGS</p>

      <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5 mb-4">
        <p className="text-sm font-semibold text-fg">{field.label}</p>
        <p className="text-xs text-fg-muted">{typeLabel} field selected</p>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-fg mb-1">Field label</label>
        <input type="text" value={field.label} onChange={(e) => update({ label: e.target.value })} className={inputCls} />
      </div>

      {(field.type === 'text' || field.type === 'dropdown' || field.type === 'number') && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-fg mb-1">Placeholder</label>
          <input type="text" value={field.placeholder || ''} onChange={(e) => update({ placeholder: e.target.value })} className={inputCls} />
        </div>
      )}

      {field.type === 'text' && (
        <>
          <label className="flex items-center gap-2 mb-3 text-sm text-fg">
            <input
              type="checkbox"
              checked={!!field.multiline}
              onChange={(e) => update({ multiline: e.target.checked })}
              className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
            />
            Multiline (text area)
          </label>
        </>
      )}

      {(field.type === 'dropdown' || field.type === 'radio') && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-fg mb-1">Options</label>
          <div className="space-y-1.5">
            {(field.options || []).map((opt, idx) => (
              <div key={idx} className="flex gap-1.5">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...field.options]
                    next[idx] = e.target.value
                    update({ options: next })
                  }}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => update({ options: field.options.filter((_, i) => i !== idx) })}
                  title="Remove option"
                  className="w-8 shrink-0 rounded-md border border-line text-fg-subtle hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => update({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
            className="mt-2 w-full px-3 py-1.5 rounded-md border border-line text-sm text-fg hover:bg-surface-2 transition"
          >
            Add option
          </button>
        </div>
      )}

      {field.type === 'grid' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-fg mb-1">Columns</label>
          <div className="space-y-2">
            {(field.columns || []).map((col, idx) => {
              const setCol = (patch) =>
                update({ columns: field.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)) })
              return (
                <div key={col.id} className="rounded-md border border-line p-2 space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) => setCol({ label: e.target.value })}
                      placeholder="Column name"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => update({ columns: field.columns.filter((_, i) => i !== idx) })}
                      title="Remove column"
                      className="w-8 shrink-0 rounded-md border border-line text-fg-subtle hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <select
                    value={col.type}
                    onChange={(e) => {
                      const t = e.target.value
                      setCol({ type: t, options: t === 'dropdown' ? (col.options || ['Option 1']) : undefined })
                    }}
                    className={inputCls}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="date">Date</option>
                  </select>
                  {col.type === 'dropdown' && (
                    <input
                      type="text"
                      value={(col.options || []).join(', ')}
                      onChange={(e) =>
                        setCol({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                      }
                      placeholder="Option 1, Option 2"
                      className={inputCls}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              update({
                columns: [
                  ...(field.columns || []),
                  { id: newFieldId(), label: `Column ${(field.columns?.length || 0) + 1}`, type: 'text' },
                ],
              })
            }
            className="mt-2 w-full px-3 py-1.5 rounded-md border border-line text-sm text-fg hover:bg-surface-2 transition"
          >
            Add column
          </button>
        </div>
      )}

      {field.type === 'file' && (
        <>
          <div className="mb-3">
            <label className="block text-xs font-medium text-fg mb-1">Allowed file types</label>
            <input
              type="text"
              value={field.fileTypes || ''}
              placeholder="e.g. PDF / DOCX"
              onChange={(e) => update({ fileTypes: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-fg mb-1">Max size (MB)</label>
            <input
              type="number"
              min={1}
              max={MAX_UPLOAD_MB}
              value={field.maxSize ?? ''}
              placeholder="e.g. 25"
              onChange={(e) => update({ maxSize: Number(e.target.value) || '' })}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-fg-subtle">Up to {MAX_UPLOAD_MB} MB per file.</p>
          </div>
        </>
      )}

      <ValidationEditor field={field} update={update} />

      <label className="flex items-center gap-2 mb-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={!!field.required}
          onChange={(e) => update({ required: e.target.checked })}
          className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
        />
        Required field
      </label>
      <ConditionalLogicEditor field={field} fields={fields} update={update} />

      <button
        type="button"
        onClick={() => onDelete(field.id)}
        className="w-full px-3 py-2 rounded-md border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition"
      >
        Delete field
      </button>
    </aside>
  )
}

// Length / range / format-pattern rules for text and number fields. Writes into
// the canonical nested `validation` object; reads legacy flat props (maxLength/
// min/max) as an initial fallback so older forms show their existing rule.
function ValidationEditor({ field, update }) {
  const isText = field.type === 'text' || field.type === 'textarea'
  const isNum = field.type === 'number'
  if (!isText && !isNum) return null

  const v = field.validation && typeof field.validation === 'object' ? field.validation : {}
  const setV = (patch) => {
    const next = { ...v, ...patch }
    Object.keys(next).forEach((k) => {
      if (next[k] === null || next[k] === '' || next[k] === undefined) delete next[k]
    })
    update({ validation: next })
  }
  const numOrNull = (s) => (s === '' ? null : Number(s))

  const minLength = v.minLength ?? field.minLength ?? ''
  const maxLength = v.maxLength ?? field.maxLength ?? ''
  const min = v.min ?? field.min ?? ''
  const max = v.max ?? field.max ?? ''

  const currentPreset = (() => {
    if (!v.pattern) return 'none'
    for (const [key, p] of Object.entries(PATTERN_PRESETS)) if (p.pattern === v.pattern) return key
    return 'custom'
  })()

  const onPresetChange = (key) => {
    if (key === 'none') return setV({ pattern: null, patternLabel: null })
    if (key === 'custom') return setV({ pattern: currentPreset === 'custom' ? v.pattern : ' ', patternLabel: null })
    const p = PATTERN_PRESETS[key]
    setV({ pattern: p.pattern, patternLabel: p.label })
  }

  return (
    <div className="mb-3 rounded-md border border-line p-3">
      <p className="text-[11px] font-semibold tracking-wider text-fg-muted mb-2">VALIDATION</p>

      {isText && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs font-medium text-fg mb-1">Min length</label>
              <input
                type="number"
                min="0"
                value={minLength}
                onChange={(e) => setV({ minLength: numOrNull(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg mb-1">Max length</label>
              <input
                type="number"
                min="1"
                value={maxLength}
                onChange={(e) => setV({ maxLength: numOrNull(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-xs font-medium text-fg mb-1">Format</label>
            <select value={currentPreset} onChange={(e) => onPresetChange(e.target.value)} className={inputCls}>
              <option value="none">No pattern</option>
              <option value="email">Email</option>
              <option value="phone">Phone number</option>
              <option value="digits">Digits only</option>
              <option value="alnum">Letters &amp; numbers</option>
              <option value="custom">Custom regex…</option>
            </select>
          </div>
          {currentPreset === 'custom' && (
            <>
              <input
                type="text"
                value={v.pattern ?? ''}
                onChange={(e) => setV({ pattern: e.target.value })}
                placeholder="e.g. ^[A-Z]{2}[0-9]{4}$"
                className={`${inputCls} mb-2 font-mono text-xs`}
              />
              <input
                type="text"
                value={v.patternLabel ?? ''}
                onChange={(e) => setV({ patternLabel: e.target.value })}
                placeholder="Error message (optional)"
                className={`${inputCls}`}
              />
            </>
          )}
        </>
      )}

      {isNum && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-fg mb-1">Min</label>
            <input
              type="number"
              value={min}
              onChange={(e) => setV({ min: numOrNull(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg mb-1">Max</label>
            <input
              type="number"
              value={max}
              onChange={(e) => setV({ max: numOrNull(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Operators offered for a show/hide rule. `nonempty` needs no comparison value.
const CONDITION_OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'nonempty', label: 'is filled in' },
]

// Per-field "show this field only when …" editor. `dependsOn` can only point at
// an EARLIER field (prevents circular rules). Stores the object shape the model
// + renderers expect: { enabled, dependsOn, operator, showWhen }.
function ConditionalLogicEditor({ field, fields = [], update }) {
  // Tolerate the legacy boolean value from the old builder.
  const cl = field.conditionalLogic && typeof field.conditionalLogic === 'object' ? field.conditionalLogic : {}
  const enabled = !!cl.enabled
  const operator = cl.operator || 'eq'

  const idx = fields.findIndex((f) => f.id === field.id)
  const earlier = idx > 0 ? fields.slice(0, idx) : []
  const source = fields.find((f) => f.id === cl.dependsOn) || null

  const setCL = (patch) => update({ conditionalLogic: { enabled: true, operator: 'eq', ...cl, ...patch } })

  const needsValue = operator !== 'nonempty'
  const sourceOptions =
    source && (source.type === 'dropdown' || source.type === 'radio') ? source.options || [] : null

  return (
    <div className="mb-4 rounded-md border border-line p-3">
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => update({ conditionalLogic: { ...cl, operator, enabled: e.target.checked } })}
          className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400"
        />
        Conditional logic
      </label>

      {enabled && (
        <div className="mt-3 space-y-2">
          {earlier.length === 0 ? (
            <p className="text-[11px] text-amber-700">
              Add at least one field above this one to use as the trigger.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-medium text-fg-muted mb-1">Show this field when</label>
                <select
                  value={cl.dependsOn || ''}
                  onChange={(e) => setCL({ dependsOn: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— Select a field —</option>
                  {earlier.map((f) => (
                    <option key={f.id} value={f.id}>{f.label || f.id}</option>
                  ))}
                </select>
              </div>

              <select
                value={operator}
                onChange={(e) => setCL({ operator: e.target.value })}
                className={inputCls}
              >
                {CONDITION_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {needsValue && (
                sourceOptions ? (
                  <select
                    value={cl.showWhen || ''}
                    onChange={(e) => setCL({ showWhen: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">— Select a value —</option>
                    {sourceOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : source && source.type === 'checkbox' ? (
                  <select
                    value={cl.showWhen || 'true'}
                    onChange={(e) => setCL({ showWhen: e.target.value })}
                    className={inputCls}
                  >
                    <option value="true">is checked</option>
                    <option value="false">is unchecked</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={cl.showWhen || ''}
                    onChange={(e) => setCL({ showWhen: e.target.value })}
                    placeholder="value to match"
                    className={inputCls}
                  />
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PreviewModal({ open, onClose, name, fields }) {
  useEffect(() => {
    if (!open) return
    const onEsc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-xl border border-line max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-line flex items-center justify-between sticky top-0 bg-surface">
          <div>
            <p className="text-xs text-fg-muted">Preview</p>
            <h2 className="text-base font-semibold text-fg">{name || 'Untitled form'}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg-muted flex items-center justify-center transition"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="px-6 py-5 space-y-4" onSubmit={(e) => e.preventDefault()}>
          {fields.length === 0 ? (
            <p className="text-sm text-fg-subtle text-center py-8">No fields yet.</p>
          ) : (
            fields.map((f) => <PreviewField key={f.id} field={f} />)
          )}

          {fields.length > 0 && (
            <button type="submit" className="w-full mt-2 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition">
              Submit
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

function PreviewField({ field }) {
  const label = (
    <label className="block text-sm font-medium text-fg mb-1">
      {field.label}
      {field.required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  switch (field.type) {
    case 'text':
      return (
        <div>
          {label}
          {field.multiline ? (
            <textarea
              rows={3}
              maxLength={field.validation?.maxLength ?? field.maxLength ?? undefined}
              placeholder={field.placeholder}
              className={`${inputCls} resize-none`}
            />
          ) : (
            <input type="text" placeholder={field.placeholder} className={inputCls} />
          )}
        </div>
      )
    case 'dropdown':
      return (
        <div>
          {label}
          <select className={inputCls} defaultValue="">
            <option value="" disabled>{field.placeholder || 'Choose...'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )
    case 'date':
      return (
        <div>
          {label}
          <input type="date" className={inputCls} />
        </div>
      )
    case 'file':
      return (
        <div>
          {label}
          <input type="file" className="block w-full text-sm text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
          <p className="mt-1 text-xs text-fg-subtle">{field.fileTypes || 'Any file'} up to {fieldMaxMb(field)} MB</p>
        </div>
      )
    case 'number':
      return (
        <div>
          {label}
          <input
            type="number"
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            placeholder={field.placeholder}
            className={inputCls}
          />
        </div>
      )
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" className="w-4 h-4 rounded border-line text-indigo-600 focus:ring-indigo-400" />
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )
    case 'signature':
      return (
        <div>
          {label}
          <div className="h-24 rounded-md border-2 border-dashed border-line bg-surface-2 flex items-center justify-center text-xs text-fg-subtle">
            Sign here
          </div>
        </div>
      )
    case 'radio':
      return (
        <div>
          {label}
          <div className="space-y-1.5">
            {(field.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-fg">
                <input type="radio" name={`preview-${field.id}`} className="w-4 h-4 border-line text-indigo-600 focus:ring-indigo-400" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )
    case 'grid':
      return (
        <div>
          {label}
          <div className="overflow-x-auto border border-line rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2">
                  {(field.columns || []).map((c) => (
                    <th key={c.id} className="px-2 py-1.5 text-left font-medium text-fg-muted border-b border-line whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(field.columns || []).map((c) => (
                    <td key={c.id} className="px-2 py-2 border-b border-line text-fg-subtle">—</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-fg-subtle">Respondents can add rows when filling.</p>
        </div>
      )
    default:
      return null
  }
}

function NewForm() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = !!editId

  // How the builder was opened from the "New form" chooser:
  //   ?template=<id> → seed a ready-made template
  //   ?ai=1          → start blank and focus the AI prompt box
  //   ?blank=1       → start with no fields
  // (no param keeps the legacy default: a seeded Leave Request form)
  const templateId = searchParams.get('template')
  const aiMode = searchParams.get('ai') === '1'
  const blankMode = searchParams.get('blank') === '1'
  const template = !isEditMode && templateId
    ? FORM_TEMPLATES.find((t) => t.id === templateId) || null
    : null

  const [name, setName] = useState(() => {
    if (isEditMode) return ''
    if (template) return template.name
    if (aiMode || blankMode) return ''
    return 'Leave Request Form'
  })
  const [fields, setFields] = useState(() => {
    if (isEditMode || aiMode || blankMode) return []
    if (template) {
      return template.fields.map((f) => ({
        ...f,
        id: newFieldId(),
        options: Array.isArray(f.options) ? [...f.options] : f.options,
        columns: f.type === 'grid' ? freshColumns(f.columns) : f.columns,
      }))
    }
    return seededFields()
  })
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // AI Form Builder
  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiPrompt, setAiPrompt] = useState(() => searchParams.get('prompt') || '')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const aiInputRef = useRef(null)
  // Ghost-text inline suggestion for the AI prompt box.
  const [aiSuggestion, setAiSuggestion] = useState('')
  const suggestTimer = useRef(null)
  const latestSuggestBase = useRef('')

  // In edit mode, fetch the existing form and populate state.
  useEffect(() => {
    if (!editId) return
    ;(async () => {
      try {
        const { form } = await api.get(`/api/forms/${editId}`)
        setName(form.title || '')
        setFields(Array.isArray(form.fields) ? form.fields : [])
      } catch (err) {
        setLoadError(err.message || 'Could not load form')
      }
    })()
  }, [editId])

  // Is the AI form-builder available? (server has an LLM key configured)
  useEffect(() => {
    let cancelled = false
    api.get('/api/forms/ai-status')
      .then((d) => { if (!cancelled) setAiAvailable(!!d.aiConfigured) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Opened via the chooser's AI option → bring the prompt box into focus.
  useEffect(() => {
    if (aiMode && aiAvailable && aiInputRef.current) {
      aiInputRef.current.focus()
      try { aiInputRef.current.scrollIntoView({ block: 'center' }) } catch { /* noop */ }
    }
  }, [aiMode, aiAvailable])

  // Reorder drag state. `draggingId` is the field being moved, `dropTarget`
  // is `{ id, position: 'before' | 'after' }` for the indicator line.
  const [draggingId, setDraggingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  const selectedField = useMemo(() => fields.find((f) => f.id === selectedId) || null, [fields, selectedId])

  const addField = (type, atEnd = true) => {
    const def = FIELD_TYPES.find((t) => t.type === type)
    if (!def) return
    const id = newFieldId()
    const newField = { id, type, ...def.defaults, label: def.defaults.label }
    if (Array.isArray(def.defaults.options)) newField.options = [...def.defaults.options]
    if (type === 'grid') newField.columns = freshColumns(def.defaults.columns)
    setFields((prev) => (atEnd ? [...prev, newField] : [newField, ...prev]))
    setSelectedId(id)
  }

  // Turn a plain-English description into fields via the server's Gemini client,
  // then merge them into the builder (assigning fresh ids on the client).
  const generateWithAI = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt || aiBusy) return
    setAiBusy(true)
    setAiError('')
    try {
      const res = await api.post('/api/forms/ai-draft', { prompt })
      const incoming = (res.fields || []).map((f) => ({
        ...f,
        id: newFieldId(),
        columns: f.type === 'grid' ? freshColumns(f.columns) : f.columns,
      }))
      if (!incoming.length) {
        setAiError('No fields were generated. Try rephrasing.')
        return
      }
      const replace =
        fields.length === 0 ||
        await confirm({
          title: 'Replace existing fields?',
          message: 'Replace your current fields with the AI-generated ones, or add them below?',
          confirmLabel: 'Replace',
          cancelLabel: 'Add below',
          danger: false,
        })
      setFields((prev) => (replace ? incoming : [...prev, ...incoming]))
      setSelectedId(incoming[0].id)
      if (res.title && (!name.trim() || name === 'Leave Request Form')) setName(res.title)
      setAiPrompt('')
    } catch (err) {
      setAiError(err.message || 'AI generation failed. Please try again.')
    } finally {
      setAiBusy(false)
    }
  }

  // Ask the server for a short continuation of what the user has typed. Stale
  // responses (user kept typing / caret moved) are dropped so the ghost text
  // always matches the current input.
  const fetchSuggestion = async (base) => {
    latestSuggestBase.current = base
    try {
      const res = await api.post('/api/forms/ai-suggest', { prompt: base })
      if (latestSuggestBase.current !== base) return
      const el = aiInputRef.current
      if (!el || el.value !== base || el.selectionStart !== base.length) return
      setAiSuggestion(res?.completion || '')
    } catch {
      setAiSuggestion('')
    }
  }

  const onAiPromptChange = (e) => {
    const val = e.target.value
    setAiPrompt(val)
    setAiSuggestion('')
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (!aiAvailable || aiBusy || val.trim().length < 3) return
    suggestTimer.current = setTimeout(() => fetchSuggestion(val), 350)
  }

  const acceptSuggestion = () => {
    const next = aiPrompt + aiSuggestion
    setAiPrompt(next)
    setAiSuggestion('')
    requestAnimationFrame(() => {
      const el = aiInputRef.current
      if (el) { el.focus(); el.setSelectionRange(next.length, next.length) }
    })
  }

  const onAiKeyDown = (e) => {
    const el = e.target
    const caretAtEnd = el.selectionStart === aiPrompt.length && el.selectionStart === el.selectionEnd
    if (aiSuggestion && (e.key === 'Tab' || (e.key === 'ArrowRight' && caretAtEnd))) {
      e.preventDefault()
      acceptSuggestion()
      return
    }
    if (e.key === 'Escape') { setAiSuggestion(''); return }
    if (e.key === 'Enter') { setAiSuggestion(''); generateWithAI() }
  }

  // Cancel any pending suggestion fetch on unmount.
  useEffect(() => () => { if (suggestTimer.current) clearTimeout(suggestTimer.current) }, [])

  const updateField = (updated) =>
    setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))

  const duplicateField = (id) => {
    const idx = fields.findIndex((f) => f.id === id)
    if (idx === -1) return
    const src = fields[idx]
    const newField = { ...src, id: newFieldId(), label: `${src.label} (copy)` }
    if (Array.isArray(src.options)) newField.options = [...src.options]
    if (src.type === 'grid') newField.columns = freshColumns(src.columns)
    const next = [...fields]
    next.splice(idx + 1, 0, newField)
    setFields(next)
    setSelectedId(newField.id)
  }

  const deleteField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // ---------- reorder via drag handle ----------
  const moveField = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return
    setFields((prev) => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }

  const moveUp = (id) => {
    const idx = fields.findIndex((f) => f.id === id)
    if (idx > 0) moveField(idx, idx - 1)
  }
  const moveDown = (id) => {
    const idx = fields.findIndex((f) => f.id === id)
    if (idx >= 0 && idx < fields.length - 1) moveField(idx, idx + 1)
  }

  const handleReorderStart = (e, id) => {
    e.dataTransfer.setData(REORDER_MIME, id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(id)
  }

  const handleReorderOver = (e, overId) => {
    // Only react to OUR drag, not the "drop a new palette field" drag.
    if (!draggingId || draggingId === overId) return
    if (!e.dataTransfer.types.includes(REORDER_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const isAbove = (e.clientY - rect.top) < rect.height / 2
    setDropTarget({ id: overId, position: isAbove ? 'before' : 'after' })
  }

  const handleReorderLeave = (overId) => {
    setDropTarget((dt) => (dt?.id === overId ? null : dt))
  }

  const handleReorderDrop = (e, overId) => {
    if (!draggingId || draggingId === overId) {
      setDraggingId(null)
      setDropTarget(null)
      return
    }
    e.preventDefault()
    e.stopPropagation()

    const fromIdx = fields.findIndex((f) => f.id === draggingId)
    let toIdx = fields.findIndex((f) => f.id === overId)
    if (fromIdx === -1 || toIdx === -1) {
      setDraggingId(null)
      setDropTarget(null)
      return
    }
    const position = dropTarget?.id === overId ? dropTarget.position : 'after'
    if (position === 'after') toIdx += 1
    // Removing the source first shifts later indices down by one.
    if (fromIdx < toIdx) toIdx -= 1
    moveField(fromIdx, toIdx)

    setDraggingId(null)
    setDropTarget(null)
  }

  const handleReorderEnd = () => {
    setDraggingId(null)
    setDropTarget(null)
  }

  const handleDiscard = async () => {
    if (await confirm({ title: 'Discard form?', message: 'Unsaved changes will be lost.', confirmLabel: 'Discard', danger: false })) {
      navigate('/forms')
    }
  }

  const [saving, setSaving] = useState(false)

  const persist = async (status) => {
    if (!name.trim()) {
      toast.error('Give the form a name first.')
      return
    }
    if (fields.length === 0) {
      toast.error('Add at least one field before saving.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: `${fields.length} field form`,
        fields,
      }
      let saved
      if (isEditMode) {
        saved = await formsStore.update(editId, payload)
      } else {
        saved = await formsStore.add(payload)
      }
      // Only call publish when explicitly requested AND the form isn't already
      // published (avoids a redundant round-trip when editing a live form).
      if (status === 'Published' && saved.status !== 'Published') {
        await formsStore.publish(saved.id)
      }
      toast.success(status === 'Published' ? 'Form published' : 'Form saved')
      navigate('/forms')
    } catch (err) {
      toast.error(err.message || 'Failed to save the form')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="p-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm max-w-md text-center">
          <p className="font-semibold mb-1">Could not load form</p>
          <p>{loadError}</p>
          <button onClick={() => navigate('/forms')} className="mt-4 px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition">Back to forms</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-2 text-fg">
      <header className="h-16 bg-surface border-b border-line px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
          <img src="/netflow-icon.png" alt="NetFlow" className="w-8 h-8" />
          </div>
          <span className="font-semibold text-fg shrink-0">NetFlow</span>
          <span className="text-fg-subtle shrink-0">|</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form name"
            className="text-sm font-medium text-fg bg-transparent border border-transparent hover:border-line focus:border-indigo-300 focus:bg-surface px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 transition min-w-0 max-w-xs"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDiscard}
            disabled={saving}
            className="px-3 py-1.5 rounded-md border border-line hover:bg-surface-2 disabled:opacity-50 text-sm font-medium text-fg transition"
          >
            Discard
          </button>
          <button
            onClick={() => persist('Draft')}
            disabled={saving}
            className="px-3 py-1.5 rounded-md border border-line hover:bg-surface-2 disabled:opacity-50 text-sm font-medium text-fg transition"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            disabled={saving}
            className="px-3 py-1.5 rounded-md border border-line hover:bg-surface-2 disabled:opacity-50 text-sm font-medium text-fg transition"
          >
            Preview
          </button>
          <button
            onClick={() => persist('Published')}
            disabled={saving}
            className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition"
          >
            {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <FieldPalette onAdd={(type) => addField(type, true)} />

        <main className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
          {aiAvailable && (
            <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 2.5a.6.6 0 0 1 1.13 0l1.32 3.43a3 3 0 0 0 1.72 1.72l3.43 1.32a.6.6 0 0 1 0 1.13l-3.43 1.32a3 3 0 0 0-1.72 1.72l-1.32 3.43a.6.6 0 0 1-1.13 0l-1.32-3.43a3 3 0 0 0-1.72-1.72L4.26 11.2a.6.6 0 0 1 0-1.13l3.43-1.32a3 3 0 0 0 1.72-1.72L11 2.5Z" />
                </svg>
                <span className="text-sm font-semibold text-indigo-800">Generate with AI</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  {/* Ghost text: an invisible copy of the typed text positions the grey suggestion right after the caret. */}
                  {aiSuggestion && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-10 px-3 py-2 text-sm whitespace-pre overflow-hidden rounded-md border border-transparent"
                    >
                      <span className="invisible">{aiPrompt}</span>
                      <span className="text-fg-subtle">{aiSuggestion}</span>
                    </div>
                  )}
                  <input
                    ref={aiInputRef}
                    type="text"
                    value={aiPrompt}
                    onChange={onAiPromptChange}
                    onKeyDown={onAiKeyDown}
                    onBlur={() => setAiSuggestion('')}
                    placeholder='e.g. "Leave request form with dates, reason, and manager"'
                    disabled={aiBusy}
                    className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition disabled:opacity-60"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateWithAI}
                  disabled={aiBusy || !aiPrompt.trim()}
                  className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition whitespace-nowrap"
                >
                  {aiBusy ? 'Generating…' : 'Generate'}
                </button>
              </div>
              {aiError && <p className="mt-2 text-xs text-red-600">{aiError}</p>}
              <p className="mt-1.5 text-[11px] text-indigo-700/70">
               AI generates the form fields based on the description.{aiSuggestion ? ' Press Tab to accept the suggestion.' : ''}
              </p>
            </div>
          )}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const type = e.dataTransfer.getData('application/x-field-type')
              if (type) addField(type, false)
            }}
            className={`mb-3 px-5 py-4 rounded-lg border-2 border-dashed text-center text-sm transition ${
              dragOver ? 'border-indigo-400 bg-indigo-50/40 text-indigo-700' : 'border-line text-fg-subtle'
            }`}
          >
            Drag fields here from the left panel
          </div>

          <div className="space-y-2">
            {fields.map((f, idx) => (
              <FieldCard
                key={f.id}
                field={f}
                index={idx}
                total={fields.length}
                selected={selectedId === f.id}
                dropPosition={dropTarget?.id === f.id ? dropTarget.position : null}
                onSelect={setSelectedId}
                onDuplicate={duplicateField}
                onDelete={deleteField}
                onDragStart={handleReorderStart}
                onDragOver={handleReorderOver}
                onDragLeave={handleReorderLeave}
                onDrop={handleReorderDrop}
                onDragEnd={handleReorderEnd}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
              />
            ))}
            {fields.length === 0 && (
              <p className="text-sm text-fg-subtle text-center py-12">No fields yet — add some from the palette.</p>
            )}
          </div>
        </main>

        <FieldSettings field={selectedField} fields={fields} onChange={updateField} onDelete={deleteField} />
      </div>

      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} name={name} fields={fields} />
    </div>
  )
}

export default NewForm

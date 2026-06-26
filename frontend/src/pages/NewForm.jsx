import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formsStore, FORM_CATEGORIES } from '../lib/formsStore'
import { api } from '../utils/api'
import { fieldMaxMb, MAX_UPLOAD_MB } from '../utils/uploads'

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
    <aside className="w-44 shrink-0 border-r border-gray-200 bg-white px-3 py-5">
      <p className="text-[11px] font-semibold tracking-wider text-gray-500 mb-3 px-1">FIELD TYPES</p>
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
              className="w-full px-3 py-2 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition cursor-grab active:scale-[0.99] text-left"
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
      className={`group relative flex items-start gap-3 px-3 py-4 rounded-lg border bg-white cursor-pointer transition ${
        selected
          ? 'border-indigo-400 ring-2 ring-indigo-200'
          : 'border-gray-200 hover:border-gray-300'
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
        className="mt-0.5 w-5 h-6 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 flex items-center justify-center cursor-grab active:cursor-grabbing transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitleFor(field)}</p>
      </div>

      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
        {/* keyboard / no-drag fallback: up + down arrows */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveUp(field.id) }}
          disabled={index === 0}
          title="Move up"
          aria-label="Move field up"
          className="w-7 h-6 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
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
          className="w-7 h-6 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
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
          className="w-7 h-6 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center transition"
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
  'w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'

function FieldSettings({ field, onChange, onDelete }) {
  if (!field) {
    return (
      <aside className="w-72 shrink-0 border-l border-gray-200 bg-white px-5 py-6">
        <p className="text-[11px] font-semibold tracking-wider text-gray-500 mb-3">FIELD SETTINGS</p>
        <p className="text-sm text-gray-400 mt-10 text-center">Select a field on the canvas to configure it.</p>
      </aside>
    )
  }

  const update = (patch) => onChange({ ...field, ...patch })
  const typeLabel = FIELD_TYPES.find((t) => t.type === field.type)?.label || field.type

  return (
    <aside className="w-72 shrink-0 border-l border-gray-200 bg-white px-5 py-6 overflow-y-auto">
      <p className="text-[11px] font-semibold tracking-wider text-gray-500 mb-3">FIELD SETTINGS</p>

      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 mb-4">
        <p className="text-sm font-semibold text-gray-800">{field.label}</p>
        <p className="text-xs text-gray-500">{typeLabel} field selected</p>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">Field label</label>
        <input type="text" value={field.label} onChange={(e) => update({ label: e.target.value })} className={inputCls} />
      </div>

      {(field.type === 'text' || field.type === 'dropdown' || field.type === 'number') && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Placeholder</label>
          <input type="text" value={field.placeholder || ''} onChange={(e) => update({ placeholder: e.target.value })} className={inputCls} />
        </div>
      )}

      {field.type === 'text' && (
        <>
          <label className="flex items-center gap-2 mb-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!field.multiline}
              onChange={(e) => update({ multiline: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
            />
            Multiline (text area)
          </label>
          {field.multiline && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Max length (characters)</label>
              <input
                type="number"
                min="1"
                value={field.maxLength ?? ''}
                onChange={(e) => update({ maxLength: e.target.value ? Number(e.target.value) : null })}
                className={inputCls}
              />
            </div>
          )}
        </>
      )}

      {(field.type === 'dropdown' || field.type === 'radio') && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Options</label>
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
                  className="w-8 shrink-0 rounded-md border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition flex items-center justify-center"
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
            className="mt-2 w-full px-3 py-1.5 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            Add option
          </button>
        </div>
      )}

      {field.type === 'grid' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Columns</label>
          <div className="space-y-2">
            {(field.columns || []).map((col, idx) => {
              const setCol = (patch) =>
                update({ columns: field.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)) })
              return (
                <div key={col.id} className="rounded-md border border-gray-200 p-2 space-y-1.5">
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
                      className="w-8 shrink-0 rounded-md border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition flex items-center justify-center"
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
            className="mt-2 w-full px-3 py-1.5 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            Add column
          </button>
        </div>
      )}

      {field.type === 'file' && (
        <>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Allowed file types</label>
            <input
              type="text"
              value={field.fileTypes || ''}
              placeholder="e.g. PDF / DOCX"
              onChange={(e) => update({ fileTypes: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Max size (MB)</label>
            <input
              type="number"
              min={1}
              max={MAX_UPLOAD_MB}
              value={field.maxSize ?? ''}
              placeholder="e.g. 25"
              onChange={(e) => update({ maxSize: Number(e.target.value) || '' })}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-gray-400">Up to {MAX_UPLOAD_MB} MB per file.</p>
          </div>
        </>
      )}

      {field.type === 'number' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min</label>
            <input
              type="number"
              value={field.min ?? ''}
              onChange={(e) => update({ min: e.target.value === '' ? null : Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max</label>
            <input
              type="number"
              value={field.max ?? ''}
              onChange={(e) => update({ max: e.target.value === '' ? null : Number(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!field.required}
          onChange={(e) => update({ required: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
        />
        Required field
      </label>
      <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!field.conditionalLogic}
          onChange={(e) => update({ conditionalLogic: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
        />
        Conditional logic
      </label>

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
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <p className="text-xs text-gray-500">Preview</p>
            <h2 className="text-base font-semibold text-gray-900">{name || 'Untitled form'}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="px-6 py-5 space-y-4" onSubmit={(e) => e.preventDefault()}>
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No fields yet.</p>
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
    <label className="block text-sm font-medium text-gray-700 mb-1">
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
              maxLength={field.maxLength || undefined}
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
          <input type="file" className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
          <p className="mt-1 text-xs text-gray-400">{field.fileTypes || 'Any file'} up to {fieldMaxMb(field)} MB</p>
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
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400" />
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )
    case 'signature':
      return (
        <div>
          {label}
          <div className="h-24 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
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
              <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" name={`preview-${field.id}`} className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-400" />
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
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {(field.columns || []).map((c) => (
                    <th key={c.id} className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(field.columns || []).map((c) => (
                    <td key={c.id} className="px-2 py-2 border-b border-gray-100 text-gray-300">—</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-gray-400">Respondents can add rows when filling.</p>
        </div>
      )
    default:
      return null
  }
}

function NewForm() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEditMode = !!editId
  const [name, setName] = useState(isEditMode ? '' : 'Leave Request Form')
  const [category, setCategory] = useState('Company-wide')
  const [fields, setFields] = useState(isEditMode ? [] : seededFields)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // In edit mode, fetch the existing form and populate state.
  useEffect(() => {
    if (!editId) return
    ;(async () => {
      try {
        const { form } = await api.get(`/api/forms/${editId}`)
        setName(form.title || '')
        setCategory(form.department || 'Company-wide')
        setFields(Array.isArray(form.fields) ? form.fields : [])
      } catch (err) {
        setLoadError(err.message || 'Could not load form')
      }
    })()
  }, [editId])

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

  const handleDiscard = () => {
    if (window.confirm('Discard this form? Unsaved changes will be lost.')) {
      navigate('/forms')
    }
  }

  const [saving, setSaving] = useState(false)

  const persist = async (status) => {
    if (!name.trim()) {
      window.alert('Give the form a name first.')
      return
    }
    if (fields.length === 0) {
      window.alert('Add at least one field before saving.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: `${fields.length} field form`,
        category,
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
      navigate('/forms')
    } catch (err) {
      window.alert(err.message || 'Failed to save the form')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm max-w-md text-center">
          <p className="font-semibold mb-1">Could not load form</p>
          <p>{loadError}</p>
          <button onClick={() => navigate('/forms')} className="mt-4 px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition">Back to forms</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 shrink-0">NetFlow</span>
          <span className="text-gray-300 shrink-0">|</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form name"
            className="text-sm font-medium text-gray-800 bg-transparent border border-transparent hover:border-gray-200 focus:border-indigo-300 focus:bg-white px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 transition min-w-0 max-w-xs"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            title="Category only — it does not restrict who can submit. Approvals always route to each submitter's own manager/HR. Use 'Company-wide' for forms everyone uses."
            className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
          >
            {FORM_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDiscard}
            disabled={saving}
            className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700 transition"
          >
            Discard
          </button>
          <button
            onClick={() => persist('Draft')}
            disabled={saving}
            className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700 transition"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            disabled={saving}
            className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700 transition"
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
              dragOver ? 'border-indigo-400 bg-indigo-50/40 text-indigo-700' : 'border-gray-300 text-gray-400'
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
              <p className="text-sm text-gray-400 text-center py-12">No fields yet — add some from the palette.</p>
            )}
          </div>
        </main>

        <FieldSettings field={selectedField} onChange={updateField} onDelete={deleteField} />
      </div>

      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} name={name} fields={fields} />
    </div>
  )
}

export default NewForm

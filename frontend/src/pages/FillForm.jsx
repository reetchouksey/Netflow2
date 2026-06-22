// M1 - Phase 2 - FillForm.jsx
// Render a published form by id, validate required fields, POST to
// /api/forms/:id/submit, and surface whether the linked workflow fired.

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api, toAbsoluteUrl } from '../utils/api'
import { formsStore } from '../lib/formsStore'

const inputCls =
  'w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition'

const inputErrorCls =
  'border-red-400 focus:ring-red-200 focus:border-red-400'

// Uploads the chosen file to /api/uploads and stores { name, url, mime, size }
// as the field value, so the approver can later open the actual attachment.
function FileField({ value, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const { file: saved } = await api.upload(file)
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
        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60"
      />
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

function FieldRow({ field, value, onChange, error }) {
  const cls = `${inputCls} ${error ? inputErrorCls : ''}`

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            rows={4}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className={`${cls} resize-y`}
          />
        )
      case 'date':
        return (
          <input
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={cls}
          />
        )
      case 'dropdown':
        return (
          <select
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
        return (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
            />
            <span>{field.placeholder || 'Yes'}</span>
          </label>
        )
      case 'signature':
        return (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your full name to sign"
            className={cls}
          />
        )
      case 'file':
        return <FileField value={value} onChange={onChange} />

      case 'repeater':
        return (
          <div className="text-xs text-gray-500 italic">
            Repeater fields aren&apos;t supported in this view.
          </div>
        )
      case 'text':
      default:
        return (
          <input
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

  const visibleFields = useMemo(() => {
    if (!form?.fields) return []
    return form.fields.filter((f) => f.type !== 'repeater')
  }, [form])

  const setFieldValue = (fieldId, v) => {
    setValues((prev) => ({ ...prev, [fieldId]: v }))
    setFieldErrors((prev) => (prev[fieldId] ? { ...prev, [fieldId]: '' } : prev))
    setSubmitError('')
  }

  const validate = () => {
    const errs = {}
    for (const f of visibleFields) {
      if (!f.required) continue
      const v = values[f.id]
      const isEmpty =
        v === undefined ||
        v === null ||
        v === '' ||
        (f.type === 'checkbox' && v === false)
      if (isEmpty) errs[f.id] = `${f.label} is required`
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
      const data = await formsStore.submit(id, values)
      setResult(data)
    } catch (err) {
      setSubmitError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- render states ----------

  if (loading) {
    return (
      <AppShell title="Loading form…">
        <p className="text-sm text-gray-500">Please wait while we fetch this form.</p>
      </AppShell>
    )
  }

  if (loadError || !form) {
    return (
      <AppShell title="Form unavailable" back={{ to: '/forms', label: 'Back to forms' }}>
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center max-w-md mx-auto">
          <p className="text-sm text-gray-500">{loadError || 'Form not found.'}</p>
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
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center max-w-md mx-auto">
          <p className="text-base font-semibold text-gray-800">
            This form isn&apos;t published yet
          </p>
          <p className="text-sm text-gray-500 mt-1">
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
        <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Submitted</h2>
          <p className="text-sm text-gray-500 mt-1">Your response was recorded.</p>

          {result.workflowTriggered ? (
            <div className="mt-4 p-3 rounded-md bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
              Approval workflow started. The first approver has been notified
              and the task is now in their inbox.
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
              No published workflow is linked to this form, so no approval
              task was created.
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2">
            <Link
              to="/forms"
              className="px-4 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
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
          className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
        >
          Cancel
        </button>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        {visibleFields.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm font-medium text-gray-700">
              This form has no fields to fill.
            </p>
            <p className="text-xs text-gray-500 mt-1">
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

        {visibleFields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            value={values[f.id]}
            onChange={(v) => setFieldValue(f.id, v)}
            error={fieldErrors[f.id]}
          />
        ))}

        {submitError && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate('/forms')}
            className="px-4 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || visibleFields.length === 0}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </AppShell>
  )
}

export default FillForm

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { FORM_TEMPLATES } from '../lib/formTemplates'

const categoryStyles = {
  'Company-wide': 'bg-sky-50 text-sky-700',
  HR: 'bg-pink-50 text-pink-700',
  Finance: 'bg-amber-50 text-amber-700',
  IT: 'bg-indigo-50 text-indigo-700',
  Operations: 'bg-emerald-50 text-emerald-700',
  Sales: 'bg-rose-50 text-rose-700',
  Legal: 'bg-slate-100 text-slate-700',
}

const SUBTITLES = {
  home: 'How would you like to start?',
  templates: 'Pick a ready-made form, then customize it.',
}

// Chooser that appears when a user clicks "New form". Step 1 shows two boxes —
// "Pre-built template" and "Build with AI". Picking one drills into that path.
// Each final choice routes to the builder (/forms/new) with a query param.
export default function NewFormModal({ open, onClose }) {
  const navigate = useNavigate()
  const [aiAvailable, setAiAvailable] = useState(false)
  const [view, setView] = useState('home') // 'home' | 'templates'

  useEffect(() => {
    if (!open) return
    setView('home')
    let cancelled = false
    api
      .get('/api/forms/ai-status')
      .then((d) => { if (!cancelled) setAiAvailable(!!d.aiConfigured) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      // Esc steps back to the two boxes first, then closes.
      if (view === 'home') onClose()
      else setView('home')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, view])

  if (!open) return null

  const go = (path) => { onClose(); navigate(path) }
  const startBlank = () => go('/forms/new?blank=1')
  const startTemplate = (id) => go(`/forms/new?template=${encodeURIComponent(id)}`)
  const startAI = () => go('/forms/new?ai=1')

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-3xl rounded-xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {view !== 'home' && (
              <button
                onClick={() => setView('home')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-surface-3 hover:text-fg-muted"
                aria-label="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-fg">Create a new form</h2>
              <p className="mt-0.5 text-xs text-fg-muted">{SUBTITLES[view]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-surface-3 hover:text-fg-muted"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1 — the two boxes */}
        {view === 'home' && (
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                onClick={() => setView('templates')}
                className="group rounded-xl border border-line p-5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-sm"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v3H4V5zM4 10h7v9H5a1 1 0 01-1-1v-8zM13 10h7v8a1 1 0 01-1 1h-6v-9z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-fg group-hover:text-indigo-700">Pre-built template</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Start from a ready-made form like Leave Approval or Purchase Request.
                </p>
                <p className="mt-2 text-[11px] font-medium text-fg-subtle">{FORM_TEMPLATES.length} templates</p>
              </button>

              <button
                onClick={startAI}
                disabled={!aiAvailable}
                className="group rounded-xl border border-line p-5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:bg-surface disabled:hover:shadow-none"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 2.5a.6.6 0 0 1 1.13 0l1.32 3.43a3 3 0 0 0 1.72 1.72l3.43 1.32a.6.6 0 0 1 0 1.13l-3.43 1.32a3 3 0 0 0-1.72 1.72l-1.32 3.43a.6.6 0 0 1-1.13 0l-1.32-3.43a3 3 0 0 0-1.72-1.72L4.26 11.2a.6.6 0 0 1 0-1.13l3.43-1.32a3 3 0 0 0 1.72-1.72L11 2.5Z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-fg group-hover:text-indigo-700">Build with AI</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Describe the form requirements and AI generates the form fields.
                </p>
                <p className="mt-2 text-[11px] font-medium text-fg-subtle">
                  {aiAvailable ? 'Powered by your AI provider' : 'AI is not configured'}
                </p>
              </button>
            </div>

            <button
              onClick={startBlank}
              className="mt-4 text-xs font-medium text-indigo-600 transition hover:text-indigo-700"
            >
              Or start from a blank form
            </button>
          </div>
        )}

        {/* Step 2a — template library */}
        {view === 'templates' && (
          <div className="px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">Start from a template</h3>
              <button
                onClick={startBlank}
                className="text-xs font-medium text-indigo-600 transition hover:text-indigo-700"
              >
                Start blank instead
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FORM_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => startTemplate(t.id)}
                  className="group rounded-lg border border-line p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg group-hover:text-indigo-700">{t.name}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryStyles[t.category] || 'bg-surface-3 text-fg-muted'}`}>
                      {t.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">{t.description}</p>
                  <p className="mt-1 text-[11px] text-fg-subtle">{t.fields.length} fields</p>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { FORM_TEMPLATES } from '../lib/formTemplates'
import { categoryBadge } from '../utils/badges'
import { useFocusTrap, useScrollLock } from '../utils/a11y'

// Chooser that appears when a user clicks "New form". Step 1 shows two boxes —
// "Pre-built template" and "Build with AI". Picking one drills into that path.
// Each final choice routes to the builder (/forms/new) with a query param.
export default function NewFormModal({ open, onClose }) {
  const navigate = useNavigate()
  const [aiAvailable, setAiAvailable] = useState(false)
  const [view, setView] = useState('home') // 'home' | 'templates'
  const panelRef = useRef(null)

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

  // Esc steps back to the two boxes first, then closes.
  const onEscape = useCallback(() => {
    if (view === 'home') onClose()
    else setView('home')
  }, [view, onClose])

  useScrollLock(open)
  useFocusTrap(open, panelRef, { onEscape })

  if (!open) return null

  const go = (path) => { onClose(); navigate(path) }
  const startBlank = () => go('/forms/new?blank=1')
  const startTemplate = (id) => go(`/forms/new?template=${encodeURIComponent(id)}`)
  const startAI = () => go('/forms/new?ai=1')

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-form-modal-title"
        tabIndex={-1}
        className="my-6 w-full max-w-3xl rounded-xl bg-surface shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {view !== 'home' && (
              <button
                onClick={() => setView('home')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-surface-3 hover:text-fg-muted"
                aria-label="Back to start options"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="min-w-0">
              <h2 id="new-form-modal-title" className="text-lg font-semibold text-fg">
                {view === 'templates' ? 'Templates' : 'Create a new form'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-surface-3 hover:text-fg-muted"
            aria-label="Close dialog"
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
                className="group rounded-xl border border-line p-5 text-left transition hover:border-info-line hover:bg-info-subtle/40 hover:shadow-sm"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle text-info-fg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v3H4V5zM4 10h7v9H5a1 1 0 01-1-1v-8zM13 10h7v8a1 1 0 01-1 1h-6v-9z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-fg group-hover:text-indigo-700">Pre-built template</h3>
                <p className="mt-2 text-[11px] font-medium text-fg-subtle">{FORM_TEMPLATES.length} templates</p>
              </button>

              <button
                onClick={startAI}
                disabled={!aiAvailable}
                className="group rounded-xl border border-line p-5 text-left transition hover:border-info-line hover:bg-info-subtle/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:bg-surface disabled:hover:shadow-none"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle text-info-fg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 2.5a.6.6 0 0 1 1.13 0l1.32 3.43a3 3 0 0 0 1.72 1.72l3.43 1.32a.6.6 0 0 1 0 1.13l-3.43 1.32a3 3 0 0 0-1.72 1.72l-1.32 3.43a.6.6 0 0 1-1.13 0l-1.32-3.43a3 3 0 0 0-1.72-1.72L4.26 11.2a.6.6 0 0 1 0-1.13l3.43-1.32a3 3 0 0 0 1.72-1.72L11 2.5Z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-fg group-hover:text-indigo-700">Build with AI</h3>
                {!aiAvailable && (
                  <p className="mt-2 text-[11px] font-medium text-fg-subtle">Not configured</p>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 my-5">
              <hr className="flex-1 border-line" />
              <span className="text-xs font-medium uppercase tracking-wider text-fg-subtle">or</span>
              <hr className="flex-1 border-line" />
            </div>

            <button
              type="button"
              onClick={startBlank}
              className="w-full flex items-center gap-4 text-left px-5 py-4 rounded-xl border-2 border-dashed border-line bg-surface hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
            >
              <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-surface-3 text-fg-muted">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 font-semibold text-fg">Start blank</span>
              <span className="w-7 h-7 rounded-full border-2 border-line shrink-0" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Step 2a — template library */}
        {view === 'templates' && (
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FORM_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => startTemplate(t.id)}
                  className="group rounded-lg border border-line p-3 text-left transition hover:border-info-line hover:bg-info-subtle/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg group-hover:text-indigo-700">{t.name}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryBadge(t.category)}`}>
                      {t.category}
                    </span>
                  </div>
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

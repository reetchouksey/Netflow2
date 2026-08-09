import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { FORM_TEMPLATES } from '../lib/formTemplates'
import { categoryBadge } from '../utils/badges'
import { useFocusTrap, useScrollLock } from '../utils/a11y'
import { reportLimit } from '../lib/limitFeedback'
import { toast } from '../lib/toastStore'

const cardCls =
  'group rounded-xl border border-line p-5 text-left transition hover:border-info-line hover:bg-info-subtle/40 hover:shadow-sm'

// Chooser when a user clicks "New form".
// Top: prompt input (placeholder "Build with AI") + Generate Now
// Generate Now calls the AI API here, then opens the builder already seeded.
export default function NewFormModal({ open, onClose }) {
  const navigate = useNavigate()
  const [aiAvailable, setAiAvailable] = useState(false)
  const [view, setView] = useState('home') // 'home' | 'templates'
  const [quickPrompt, setQuickPrompt] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const panelRef = useRef(null)
  const promptInputRef = useRef(null)
  const suggestTimer = useRef(null)
  const latestSuggestBase = useRef('')

  useEffect(() => {
    if (!open) return
    setView('home')
    setQuickPrompt('')
    setSuggestion('')
    setGenError('')
    setGenerating(false)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    let cancelled = false
    api
      .get('/api/forms/ai-status')
      .then((d) => { if (!cancelled) setAiAvailable(!!d.aiConfigured) })
      .catch(() => {})
    return () => {
      cancelled = true
      if (suggestTimer.current) clearTimeout(suggestTimer.current)
    }
  }, [open])

  useEffect(() => {
    if (open && view === 'home' && aiAvailable && !generating) {
      requestAnimationFrame(() => promptInputRef.current?.focus())
    }
  }, [open, view, aiAvailable, generating])

  const onEscape = useCallback(() => {
    if (generating) return
    if (view === 'home') onClose()
    else setView('home')
  }, [view, onClose, generating])

  useScrollLock(open)
  useFocusTrap(open, panelRef, { onEscape })

  if (!open) return null

  const go = (path, opts) => { onClose(); navigate(path, opts) }
  const startBlank = () => go('/forms/new?blank=1')
  const startTemplate = (id) => go(`/forms/new?template=${encodeURIComponent(id)}`)

  const fetchSuggestion = async (base) => {
    latestSuggestBase.current = base
    try {
      const res = await api.post('/api/forms/ai-suggest', { prompt: base })
      if (latestSuggestBase.current !== base) return
      const el = promptInputRef.current
      if (!el || el.value !== base || el.selectionStart !== base.length) return
      setSuggestion(res?.completion || '')
    } catch {
      setSuggestion('')
    }
  }

  const onPromptChange = (e) => {
    const val = e.target.value
    setQuickPrompt(val)
    setGenError('')
    setSuggestion('')
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (!aiAvailable || generating || val.trim().length < 3) return
    suggestTimer.current = setTimeout(() => fetchSuggestion(val), 350)
  }

  const acceptSuggestion = () => {
    if (!suggestion) return
    const next = quickPrompt + suggestion
    setQuickPrompt(next)
    setSuggestion('')
    requestAnimationFrame(() => {
      const el = promptInputRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(next.length, next.length)
      }
    })
  }

  const onPromptKeyDown = (e) => {
    const el = e.target
    const caretAtEnd =
      el.selectionStart === quickPrompt.length && el.selectionStart === el.selectionEnd
    if (suggestion && (e.key === 'Tab' || (e.key === 'ArrowRight' && caretAtEnd))) {
      e.preventDefault()
      acceptSuggestion()
      return
    }
    if (e.key === 'Escape' && suggestion) {
      e.preventDefault()
      e.stopPropagation()
      setSuggestion('')
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      startQuickGenerate()
    }
  }

  const startQuickGenerate = async () => {
    const prompt = (quickPrompt + (suggestion || '')).trim()
    if (!prompt || !aiAvailable || generating) return
    setSuggestion('')
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    setGenerating(true)
    setGenError('')
    try {
      const res = await api.post('/api/forms/ai-draft', { prompt })
      const fields = Array.isArray(res.fields) ? res.fields : []
      if (!fields.length) {
        setGenError('No fields were generated. Try rephrasing.')
        return
      }
      onClose()
      navigate('/forms/new?ai=1', {
        state: {
          aiDraft: {
            title: res.title || '',
            description: res.description || '',
            fields,
            prompt,
          },
        },
      })
    } catch (err) {
      if (!reportLimit(err)) {
        const msg = err?.message || 'AI generation failed. Please try again.'
        setGenError(msg)
        toast.error(msg)
      }
    } finally {
      setGenerating(false)
    }
  }

  const canGenerate = aiAvailable && !!quickPrompt.trim() && !generating

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6"
      onClick={generating ? undefined : onClose}
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
                type="button"
                onClick={() => setView('home')}
                disabled={generating}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-surface-3 hover:text-fg-muted disabled:opacity-50"
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
            type="button"
            onClick={onClose}
            disabled={generating}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-surface-3 hover:text-fg-muted disabled:opacity-50"
            aria-label="Close dialog"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {view === 'home' && (
          <div className="px-6 py-6 space-y-4">
            <div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-stretch">
                <label className="sr-only" htmlFor="new-form-ai-prompt">Build with AI</label>
                <div className="relative min-w-0 flex-1 rounded-xl border border-line bg-surface-2 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-400">
                  {suggestion ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-0 px-4 py-3 text-sm whitespace-nowrap overflow-hidden rounded-xl"
                    >
                      <span className="invisible">{quickPrompt}</span>
                      <span className="text-fg-subtle">{suggestion}</span>
                    </div>
                  ) : null}
                  <input
                    id="new-form-ai-prompt"
                    ref={promptInputRef}
                    type="text"
                    value={quickPrompt}
                    onChange={onPromptChange}
                    onKeyDown={onPromptKeyDown}
                    onBlur={() => setSuggestion('')}
                    placeholder="Build with AI"
                    disabled={!aiAvailable || generating}
                    autoComplete="off"
                    className="relative z-10 w-full px-4 py-3 text-sm rounded-xl bg-transparent text-fg placeholder:text-fg-muted focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="button"
                  onClick={startQuickGenerate}
                  disabled={!canGenerate}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition min-w-[8.5rem]"
                >
                  {generating ? 'Generating…' : 'Generate Now'}
                </button>
              </div>
              {aiAvailable && !genError && (
                <p className="mt-2 text-[11px] text-fg-subtle">
                  Ghost text suggests the next few words as you type (like VS Code). Press Tab or → to accept.
                </p>
              )}
              {!aiAvailable && (
                <p className="mt-2 text-[11px] font-medium text-fg-subtle">Not configured</p>
              )}
              {genError && (
                <p className="mt-2 text-[11px] font-medium text-danger-fg">{genError}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setView('templates')}
                disabled={generating}
                className={`${cardCls} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle text-info-fg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v3H4V5zM4 10h7v9H5a1 1 0 01-1-1v-8zM13 10h7v8a1 1 0 01-1 1h-6v-9z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-fg group-hover:text-indigo-700">Pre-Built Template</h3>
                <p className="mt-1.5 text-[11px] font-medium text-fg-subtle">{FORM_TEMPLATES.length} templates</p>
              </button>

              <button
                type="button"
                onClick={startBlank}
                disabled={generating}
                className={`${cardCls} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-fg group-hover:text-indigo-700">Start from Scratch</h3>
                <p className="mt-1.5 text-[11px] text-fg-muted">Empty canvas, add your own fields</p>
              </button>
            </div>
          </div>
        )}

        {view === 'templates' && (
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FORM_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
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

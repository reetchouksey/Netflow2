// Shared - ConfirmDialog.jsx
// Branded replacement for window.confirm(). Mount once near the app root
// (App.jsx). Reads confirmStore; renders nothing when idle. Backdrop click and
// Esc cancel; Enter accepts; the confirm button turns rose for destructive
// (danger) actions.

import React, { useEffect } from 'react'
import { useConfirmState, confirmController } from '../lib/confirmStore'

export default function ConfirmDialog() {
  const state = useConfirmState()

  useEffect(() => {
    if (!state) return
    // Escape only. Enter is deliberately left to the focused button so a stray
    // keypress can't confirm a destructive action the user hasn't chosen.
    const onKey = (e) => {
      if (e.key === 'Escape') confirmController.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  if (!state) return null
  const { title, message, confirmLabel, cancelLabel, danger } = state

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      onClick={confirmController.cancel}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-message' : undefined}
      >
        <div className="px-7 pt-7 pb-4">
          <h2 id="confirm-dialog-title" className={`text-base font-bold tracking-tight ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{title}</h2>
          {message && (
            <p id="confirm-dialog-message" className="mt-2 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line leading-relaxed">
              {message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 px-7 py-4">
          {/* Destructive dialogs open with Cancel focused so Enter is a safe default. */}
          <button
            onClick={confirmController.cancel}
            autoFocus={danger}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            {cancelLabel}
          </button>
          <button
            onClick={confirmController.accept}
            autoFocus={!danger}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold text-white transition cursor-pointer shadow-md ${
              danger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25' : 'bg-[#6366F1] hover:bg-indigo-600 shadow-indigo-500/25'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

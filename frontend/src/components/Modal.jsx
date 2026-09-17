// Shared - Modal.jsx
// Every dialog in the app was hand-rolled: a fixed backdrop, a panel, and no
// role, no aria-modal, no Escape, no focus trap, and the page scrolling behind
// it. This is the one shell they all use now.
//
// Layering follows the scale documented in index.css: dialogs sit at z-[60],
// and a dialog opened from another dialog passes `stacked` to sit at z-[70].

import React, { useId, useRef } from 'react'
import { useFocusTrap, useScrollLock, preferFormControl } from '../utils/a11y'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-5xl',
}

export default function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  description,
  children,
  footer,
  size = 'md',
  stacked = false,
  closeOnBackdrop = true,
  showClose = true,
  danger = false,
  bodyClass = 'px-7 py-5 overflow-y-auto sidebar-scroll',
  className = '',
}) {
  const panelRef = useRef(null)
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  const subText = subtitle || description

  useScrollLock(open)
  useFocusTrap(open, panelRef, { onEscape: onClose, initialFocus: preferFormControl })

  if (!open) return null

  return (
    <div className={`fixed inset-0 ${stacked ? 'z-[70]' : 'z-[60]'} flex items-center justify-center p-4`}>
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role={danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subText ? descId : undefined}
        tabIndex={-1}
        className={`relative w-full ${SIZES[size] || SIZES.md} bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden focus:outline-none ${className}`}
      >
        {(title || showClose) && (
          <div className="px-7 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className={`text-base font-bold tracking-tight ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  {title}
                </h2>
              )}
              {subText && (
                <p id={descId} className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subText}</p>
              )}
            </div>
            {showClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 -mr-1 -mt-1 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className={bodyClass}>{children}</div>

        {footer && (
          <div className="px-7 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

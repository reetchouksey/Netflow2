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
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export default function Modal({
  open = true,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  stacked = false,
  closeOnBackdrop = true,
  showClose = true,
  danger = false,
  bodyClass = 'px-5 py-4 overflow-y-auto',
  className = '',
}) {
  const panelRef = useRef(null)
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`

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
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative w-full ${SIZES[size] || SIZES.md} bg-surface border border-line rounded-xl shadow-xl max-h-[90vh] flex flex-col focus:outline-none ${className}`}
      >
        {(title || showClose) && (
          <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className={`text-sm font-semibold ${danger ? 'text-danger-fg' : 'text-fg'}`}>
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-[11px] text-fg-muted mt-0.5">{description}</p>
              )}
            </div>
            {showClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 -mr-1 -mt-1 w-8 h-8 rounded-md flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-3 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className={bodyClass}>{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  )
}

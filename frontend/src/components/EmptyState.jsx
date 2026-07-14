// Shared - EmptyState.jsx
// Minimal, on-brand empty state: a warm heading, optional subtext, and an
// optional call-to-action. No illustration by design. Callers pass their own
// `action` element (a Link or button) so routing/permissions stay in the page.

import React from 'react'

export default function EmptyState({ title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 text-xs text-fg-muted max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

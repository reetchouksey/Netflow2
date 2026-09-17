import React from 'react'

/**
 * Standardized StatusBadge component matching the reference design tokens:
 * - Small filled dot (currentColor) + colored label, inline flex
 * - 11-12px font-weight 600
 * - Text + dot only (no background fill by default)
 */
export function getStatusStyle(status = '') {
  const s = String(status).toLowerCase().trim()

  // Success / Active
  if (['active', 'published', 'completed', 'approved', 'healthy', 'online', 'pass', 'passed', 'success'].includes(s)) {
    return {
      text: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      label: status || 'Active'
    }
  }

  // Danger / Suspended
  if (['suspended', 'rejected', 'failed', 'error', 'breached', 'critical', 'danger', 'offline'].includes(s)) {
    return {
      text: 'text-rose-600 dark:text-rose-400',
      dot: 'bg-rose-500',
      label: status || 'Suspended'
    }
  }

  // Warning / Degraded / Pending
  if (['degraded', 'warning', 'escalated', 'pending', 'paused', 'attention', 'overdue', 'trial'].includes(s)) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      dot: 'bg-amber-500',
      label: status || 'Pending'
    }
  }

  // Info / In Progress / Default
  return {
    text: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
    label: status || 'In Progress'
  }
}

export default function StatusBadge({ status, label, className = '', dotClassName = '' }) {
  const config = getStatusStyle(status)
  const displayLabel = label || config.label

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold tracking-normal leading-none ${config.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot} ${dotClassName}`} />
      <span>{displayLabel}</span>
    </span>
  )
}

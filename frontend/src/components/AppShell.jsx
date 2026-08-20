// Shared - AppShell.jsx
// One layout for every authenticated page.
// - Non-employees: left sidebar + top bar (search, bell, user)
// - Employees: top bar (logo + search, bell, user) + bottom tab bar

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authStore, useUser, initials, ROLE_LABELS } from '../utils/auth'
import { themeStore, useTheme } from '../lib/themeStore'
import { useTasks } from '../lib/tasksStore'
import { useForms } from '../lib/formsStore'
import { useWorkflows } from '../lib/workflowsStore'
import { canCreateWorkflow, canEditWorkflow, isSuperAdmin, isPlatformShell, getShell, SHELL } from '../utils/permissions'
import { api } from '../utils/api'
import { useFocusTrap, useOutsideDismiss, useScrollLock, modifierKeyLabel } from '../utils/a11y'
import AssistantWidget from './AssistantWidget'
import LicenceBanner from './LicenceBanner'
import NotificationsBell from './NotificationsBell'
import DmsProviderWidget from './DmsProviderWidget'

// ---------- left rail ----------------------------------------------------
// Four shells. Items without `visible` are always shown inside that shell.
// Never-show lists are enforced by simply omitting those routes from the shell.

const PLATFORM_NAV = [
  {
    label: 'MAIN',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
      { key: 'platform', label: 'Organizations', to: '/platform', icon: IconPlatform },
      { key: 'usage', label: 'Usage', to: '/usage', icon: IconAnalytics }
    ]
  },
  {
    label: 'REPORTS',
    items: [
      { key: 'activity', label: 'Activity Logs', to: '/activity', icon: IconAudit }
    ]
  },
  {
    label: 'SETTINGS',
    items: [
      { key: 'health', label: 'System Health', to: '/health', icon: IconHealth },
      { key: 'plans', label: 'Plans', to: '/plans', icon: IconPlans },
      { key: 'admins', label: 'Admins', to: '/admins', icon: IconAdmin }
    ]
  }
]

const ORG_ADMIN_NAV = [
  {
    label: null,
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
    ]
  },
  {
    label: 'MANAGEMENT',
    items: [
      { key: 'departments', label: 'Departments', to: '/departments', icon: IconBuilding, chevron: true },
      { key: 'users', label: 'Users', to: '/admin', icon: IconTeam, chevron: true },
      { key: 'roles', label: 'Roles & Permissions', to: '/roles', icon: IconRoles, chevron: true },
      { key: 'forms', label: 'Forms', to: '/forms', icon: IconForms, chevron: true },
      { key: 'workflows', label: 'Workflows', to: '/workflows', icon: IconWorkflows, chevron: true }
    ]
  },
  {
    label: 'Documents Management System',
    items: [
      { key: 'documents', label: 'DMS', to: '/documents', icon: IconFolder, chevron: true },
      { key: 's3-storage', label: 'S3 Storage', to: '/s3-storage', icon: IconFolder, chevron: true }
    ]
  },
  {
    label: 'MONITORING',
    items: [
      { key: 'reports', label: 'Reports', to: '/analytics', icon: IconAnalytics, chevron: true },
      { key: 'audit', label: 'Audit Logs', to: '/audit-log', icon: IconAudit, chevron: true }
    ]
  },
  {
    label: 'SETTINGS',
    items: [
      { key: 'org-settings', label: 'Organization Settings', to: '/settings', icon: IconSettings, chevron: true },
      { key: 'billing', label: 'Plan & Usage', to: '/billing', icon: IconBilling, chevron: true }
    ]
  }
]

const OPS_NAV = [
  {
    label: 'MAIN',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
      { key: 'tasks', label: 'Approvals', to: '/tasks', icon: IconTasks },
      { key: 'forms', label: 'Forms', to: '/forms', icon: IconForms },
      { key: 'team', label: 'My Team', to: '/team', icon: IconTeam }
    ]
  },
  {
    label: 'REPORTS',
    items: [
      { key: 'analytics', label: 'Analytics', to: '/analytics', icon: IconAnalytics },
      { key: 'audit', label: 'Audit Logs', to: '/audit-log', icon: IconAudit }
    ]
  }
]

const WORKSPACE_NAV = [
  {
    label: 'MAIN',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
      { key: 'tasks', label: 'My Requests', to: '/tasks', icon: IconTasks },
      { key: 'forms', label: 'Forms', to: '/forms', icon: IconForms },
      { key: 'profile', label: 'Profile', to: '/profile', icon: IconAdmin }
    ]
  }
]

function visibleSections(user) {
  const shell = getShell(user)
  let sections = []
  if (shell === SHELL.PLATFORM) sections = PLATFORM_NAV
  else if (shell === SHELL.ORG_ADMIN) sections = ORG_ADMIN_NAV
  else if (shell === SHELL.OPS) sections = OPS_NAV
  else sections = WORKSPACE_NAV

  if (user && user.dmsEnabled === false) {
    sections = sections.map(section => ({
      ...section,
      items: section.items.filter(item => item.key !== 'documents')
    })).filter(section => section.items.length > 0)
  }

  if (user && user.s3Enabled === false) {
    sections = sections.map(section => ({
      ...section,
      items: section.items.filter(item => item.key !== 's3-storage')
    })).filter(section => section.items.length > 0)
  }

  return sections
}

const SHELL_FOOTER = {
  [SHELL.PLATFORM]: 'Platform console',
  [SHELL.ORG_ADMIN]: 'Organization admin',
  [SHELL.OPS]: 'Business ops',
  [SHELL.WORKSPACE]: 'Workspace',
}

// Shared nav rendering — the permission-filtered sections + links. Used by both
// the desktop push-drawer Sidebar and the mobile overlay drawer. `onNavigate`
// (optional) fires when a link is tapped, letting the mobile drawer close.
function NavSections({ user, pendingCount, onNavigate }) {
  const { pathname } = useLocation()
  const sections = visibleSections(user)

  return (
    <>
      {sections.map((section, si) => (
        <div key={section.label || `sec-${si}`} className={si === 0 ? '' : 'mt-5 pt-5 border-t border-line/70'}>
          {section.label && (
            <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
              {section.label}
            </p>
          )}
          <ul className="space-y-1">
            {section.items.map((item) => {
              if (item.component) {
                const ItemComponent = item.component
                return (
                  <li key={item.key}>
                    <ItemComponent user={user} />
                  </li>
                )
              }
              const Icon = item.icon
              const label = item.labelFor ? item.labelFor(user) : item.label
              const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
              const showBadge = item.key === 'tasks' && pendingCount > 0
              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    data-tour={`nav-${item.key}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 pl-3 pr-2.5 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-500/5 dark:bg-indigo-500/15 dark:text-indigo-300 dark:shadow-none'
                        : 'text-fg-muted hover:bg-surface-3/80 hover:text-fg'
                    }`}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-600 dark:bg-indigo-400"
                      />
                    )}
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-indigo-100/80 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-300'
                          : 'bg-surface-2 text-fg-muted group-hover:bg-surface group-hover:text-fg ring-1 ring-line/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 whitespace-nowrap tracking-tight">{label}</span>
                    {showBadge && (
                      <span className="text-[10px] font-semibold rounded-full bg-indigo-600 text-white px-1.5 py-0.5 min-w-[18px] text-center shadow-sm">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

// Push drawer: a full labeled sidebar that occupies real layout width when
// `open` (so page content is pushed, not covered) and collapses to zero width
// when closed. Desktop only (md+); on phones the bottom tab bar + overlay
// drawer take over. The open/close toggle lives in the top bar.
function Sidebar({ user, pendingCount, open, onToggle }) {
  const shellLabel = SHELL_FOOTER[getShell(user)] || 'Workspace'

  return (
    <aside
      id="app-sidebar"
      // Collapsed, the rail is only 0px wide — but its links stayed in the tab
      // order, so keyboard users tabbed through invisible nav items. `inert`
      // removes them without unmounting (which would kill the width animation).
      inert={!open ? '' : undefined}
      aria-hidden={!open}
      className={`hidden md:flex flex-col shrink-0 overflow-hidden bg-surface-2/50 border-line text-fg sticky top-0 h-screen transition-[width] duration-200 ease-in-out ${open ? 'w-64 border-r' : 'w-0'}`}
    >
      {/* Fixed inner width keeps nav from reflowing while the rail animates */}
      <div className="w-64 h-full flex flex-col min-h-0">
        <div className="shrink-0 h-16 px-3 flex items-center gap-2 border-b border-line bg-surface/80 backdrop-blur-sm">
          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0 flex-1 rounded-lg hover:opacity-90 transition px-1 py-1">
            {getShell(user) === SHELL.ORG_ADMIN ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300 flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgb(0_0_0/0.05)] ring-1 ring-pink-100 dark:ring-pink-500/20">
                  <IconBuilding className="w-4 h-4" />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="font-bold text-fg text-[13px] tracking-tight truncate">{user?.tenantName }</p>
                  <div className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-bold tracking-wide bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20 mt-0.5">
                    Active
                  </div>
                </div>
              </>
            ) : (
              <>
                <img src="/netflow-icon.png" alt="" className="w-8 h-8 rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10" />
                <div className="min-w-0 leading-tight">
                  <p className="font-bold text-fg text-[15px] tracking-tight truncate">NetFlow</p>
                  <p className="text-[10px] font-medium text-fg-subtle truncate">{shellLabel}</p>
                </div>
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            aria-expanded={open}
            aria-controls="app-sidebar"
            title="Collapse sidebar"
            className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-3 border border-transparent hover:border-line transition"
          >
            {/* Panel-left / collapse control — clearer than a second hamburger */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H5.25A1.5 1.5 0 003.75 5.25v13.5a1.5 1.5 0 001.5 1.5H9m0-16.5v16.5m0-16.5h9.75a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5H9M8.25 9.75L5.25 12l3 2.25" />
            </svg>
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 min-h-0 px-3 py-4 overflow-y-auto">
          <NavSections user={user} pendingCount={pendingCount} />
        </nav>

        <div className="shrink-0 px-4 py-3 border-t border-line bg-surface/60">
          <p className="text-[11px] text-fg-subtle leading-snug">
            <span className="font-medium text-fg-muted">{shellLabel}</span>
            <span className="block mt-0.5">Navigation matches your role’s access.</span>
          </p>
        </div>
      </div>
    </aside>
  )
}

// Fixed bottom tab bar for phones (md:hidden). Shows the top destinations; when
// the role has more items than fit, a Menu tab opens the full nav in an overlay
// drawer. Reuses each item's icon + label and the Tasks pending badge.
function BottomTabBar({ user, pendingCount, menuOpen, onOpenMenu }) {
  const { pathname } = useLocation()
  const flat = visibleSections(user).flatMap((s) => s.items)
  const useMenu = flat.length > 5
  const primary = useMenu ? flat.slice(0, 4) : flat.slice(0, 5)
  const isActive = (to) => pathname === to || pathname.startsWith(to + '/')

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch">
        {primary.map((item) => {
          const Icon = item.icon
          const label = item.labelFor ? item.labelFor(user) : item.label
          const active = isActive(item.to)
          const showBadge = item.key === 'tasks' && pendingCount > 0
          return (
            <Link
              key={item.key}
              to={item.to}
              data-tour={`nav-${item.key}`}
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? 'text-indigo-600 dark:text-indigo-300' : 'text-fg-muted'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-success-solid text-white text-[10px] font-semibold flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </Link>
          )
        })}
        {useMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label="Open menu"
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
              menuOpen ? 'text-indigo-600 dark:text-indigo-300' : 'text-fg-muted'
            }`}
          >
            <IconMenu className="w-5 h-5" />
            <span>Menu</span>
          </button>
        )}
      </div>
    </nav>
  )
}

// Slide-in overlay that reveals the full nav on phones. Opened by the bottom
// bar's Menu tab; closes on backdrop click, Esc, or tapping a link.
//
// The drawer used to stay mounted off-screen, so its links were still tabbable
// and the page behind it still scrolled under your finger. It now mounts only
// while open (one frame ahead of the slide-in so the transition still plays)
// and traps focus for as long as it's up.
function MobileNavDrawer({ user, pendingCount, open, onClose }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)
  const panelRef = useRef(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 200)
    return () => clearTimeout(t)
  }, [open])

  useScrollLock(open)
  useFocusTrap(open, panelRef, { onEscape: onClose })

  if (!mounted) return null

  return (
    <div className="md:hidden">
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <aside
        ref={panelRef}
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[80%] bg-surface-2/95 border-r border-line text-fg shadow-xl transition-transform duration-200 ease-in-out backdrop-blur-sm ${shown ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-line bg-surface/80">
          <img src="/netflow-icon.png" alt="NetFlow" className="w-8 h-8 rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10" />
          <div className="min-w-0 leading-tight">
            <p className="font-bold text-fg text-[15px] tracking-tight">NetFlow</p>
            <p className="text-[10px] font-medium text-fg-subtle truncate">
              {SHELL_FOOTER[getShell(user)] || 'Workspace'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center text-fg-muted hover:bg-surface-3 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="px-3 py-4 overflow-y-auto h-[calc(100dvh-4rem)]">
          <NavSections user={user} pendingCount={pendingCount} onNavigate={onClose} />
        </nav>
      </aside>
    </div>
  )
}

// ---------- global search ------------------------------------------------

const TYPE_BADGE = {
  Request:  'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  Form:     'bg-success-subtle text-success-fg',
  Workflow: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  Org:      'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  Page:     'bg-surface-3 text-fg-muted',
}

// Tenant list behind the platform search box. Loaded the first time the box is
// opened and kept for the session — the console navigates a lot and the list
// only changes when the SuperAdmin themselves creates or deletes an org.
let platformOrgsCache = []

function usePlatformOrgs(enabled) {
  const [orgs, setOrgs] = useState(platformOrgsCache)

  useEffect(() => {
    if (!enabled || platformOrgsCache.length) return
    let cancelled = false
    api.get('/api/platform/orgs')
      .then((data) => {
        platformOrgsCache = data.orgs || []
        if (!cancelled) setOrgs(platformOrgsCache)
      })
      .catch(() => { /* search just falls back to page results */ })
    return () => { cancelled = true }
  }, [enabled])

  return orgs
}

// Navigable pages the current user is actually allowed to open.
function pageResults(user) {
  return visibleSections(user).flatMap((s) =>
    s.items.map((it) => ({
      type: 'Page',
      id: it.to,
      label: typeof it.labelFor === 'function' ? it.labelFor(user) : it.label,
      sub: 'Go to page',
      to: it.to,
    }))
  )
}

const cleanReqTitle = (s) => (s || '').replace(/\s*—\s*Approval Required\s*$/i, '')

// Works for every role: requests + forms come from endpoints all users can read;
// workflows are only surfaced to roles that can open the workflows page. In the
// platform shell there is no tenant data to search, so it searches tenants
// (organizations) and the console's own pages instead.
function GlobalSearch({ user }) {
  const navigate = useNavigate()
  const platform = isPlatformShell(user)
  const tasks = useTasks(!platform)
  const forms = useForms(!platform)
  const workflows = useWorkflows(!platform)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const orgs = usePlatformOrgs(platform && open)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)
  const boxRef = useRef(null)
  const modKey = useMemo(() => modifierKeyLabel(), [])

  // Ctrl/Cmd+K focuses the search from anywhere in the app.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useOutsideDismiss(open, boxRef, () => setOpen(false))

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out = []

    if (platform) {
      for (const o of orgs) {
        const hay = `${o.name || ''} ${o.subdomain || ''}`.toLowerCase()
        if (hay.includes(q)) {
          out.push({
            type: 'Org',
            id: o._id,
            label: o.name || o.subdomain || 'Organization',
            sub: [o.subdomain, o.plan, o.status].filter(Boolean).join(' · ') || 'Organization',
            to: `/platform?q=${encodeURIComponent(o.subdomain || o.name || '')}`
          })
        }
      }
      for (const p of pageResults(user)) {
        if (p.label.toLowerCase().includes(q)) out.push(p)
      }
      return out.slice(0, 12)
    }

    for (const t of tasks) {
      const title = cleanReqTitle(t.title)
      if (title.toLowerCase().includes(q) || (t.department || '').toLowerCase().includes(q)) {
        out.push({ type: 'Request', id: t.id, label: title || 'Request', sub: t.status || t.department || 'Request', to: `/tasks/${t.id}` })
      }
    }
    for (const f of forms) {
      const name = f.name || f.title || ''
      if (name.toLowerCase().includes(q) || (f.category || '').toLowerCase().includes(q)) {
        out.push({ type: 'Form', id: f.id, label: name || 'Form', sub: f.category || 'Form', to: `/forms/${f.id}/fill` })
      }
    }
    if (canCreateWorkflow(user)) {
      // Only Admins can open the editor; everyone else lands on the list.
      const canOpenEditor = canEditWorkflow(user)
      for (const w of workflows) {
        const name = w.name || w.title || ''
        if (name.toLowerCase().includes(q) || (w.category || '').toLowerCase().includes(q)) {
          out.push({
            type: 'Workflow',
            id: w.id,
            label: name || 'Workflow',
            sub: w.status || w.category || 'Workflow',
            to: canOpenEditor && w.id ? `/workflows/${w.id}/edit` : '/workflows',
          })
        }
      }
    }
    for (const p of pageResults(user)) {
      if (p.label.toLowerCase().includes(q)) out.push(p)
    }

    const seen = new Set()
    return out.filter((r) => {
      const k = `${r.type}:${r.id}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    }).slice(0, 12)
  }, [query, platform, orgs, tasks, forms, workflows, user])

  useEffect(() => { setActiveIdx(0) }, [query])

  const go = (r) => {
    if (!r) return
    setOpen(false)
    setQuery('')
    navigate(r.to)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setOpen(true); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter')     { if (results.length) go(results[activeIdx]) }
    else if (e.key === 'Escape')    { setOpen(false); inputRef.current?.blur() }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={boxRef} data-tour="search" className="flex-1 max-w-2xl relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={platform ? 'Search organizations, pages…' : 'Search requests, forms, workflows…'}
          aria-label={platform ? 'Search organizations and pages' : 'Search requests, forms and workflows'}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          className="w-full pl-9 pr-4 sm:pr-16 py-2 text-sm text-fg border border-line rounded-lg bg-surface-2 placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-surface transition"
        />
        <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-fg-subtle border border-line rounded px-1.5 py-0.5 bg-surface font-sans pointer-events-none">
          {modKey} K
        </kbd>
      </div>

      {showDropdown && (
        <div id="global-search-results" className="absolute left-0 right-0 mt-2 bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-30">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-fg-subtle">No matches for &ldquo;{query.trim()}&rdquo;</div>
          ) : (
            <ul role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.type}:${r.id}`} role="option" aria-selected={i === activeIdx}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => go(r)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${i === activeIdx ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'hover:bg-surface-2'}`}
                  >
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_BADGE[r.type] || TYPE_BADGE.Page}`}>{r.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-fg truncate">{r.label}</span>
                      <span className="block text-[10px] text-fg-subtle truncate">{r.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- top bar ------------------------------------------------------

function TopBar({ user, onToggleSidebar, sidebarOpen }) {
  const theme = useTheme()
  const displayName = user?.name || 'Guest'
  const roleLabel = user?.role?.name
    ? (ROLE_LABELS[user.role.name] || user.role.name)
    : 'Member'
  // Platform Super Admin chrome matches the design deck: role as the chip label.
  const chipPrimary = isSuperAdmin(user) ? roleLabel : displayName
  const chipSecondary = isSuperAdmin(user) ? '' : roleLabel

  return (
    <header className="h-16 bg-surface border-b border-line px-4 md:px-6 flex items-center gap-3 md:gap-4 sticky top-0 z-20">
      {/* Expand control — only when the rail is collapsed on desktop. Collapse
          lives in the sidebar header so we never stack hamburger + logo twice. */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Expand sidebar"
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        title="Expand sidebar"
        className={`w-9 h-9 rounded-lg items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-3 border border-line transition shrink-0 ${
          sidebarOpen ? 'hidden' : 'hidden md:inline-flex'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Logo in the top bar when the sidebar is closed (desktop) or on phones */}
      <Link
        to="/dashboard"
        className={`flex items-center gap-2 shrink-0 ${sidebarOpen ? 'md:hidden' : ''}`}
      >
        <img src="/netflow-icon.png" alt="NetFlow" className="w-8 h-8 rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10" />
        <span className="hidden sm:inline font-bold text-fg text-[15px] tracking-tight">NetFlow</span>
      </Link>

      {/* Global search — works for every role */}
      <GlobalSearch user={user} />

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          data-tour="theme"
          onClick={() => themeStore.toggle()}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="w-9 h-9 rounded-md flex items-center justify-center text-fg-muted hover:bg-surface-3 transition"
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>
        <NotificationsBell />

        <div className="hidden sm:block w-px h-8 bg-line mx-1" />

        <UserMenu
          user={user}
          displayName={displayName}
          chipPrimary={chipPrimary}
          chipSecondary={chipSecondary}
          avatarSeed={isSuperAdmin(user) ? roleLabel : displayName}
        />
      </div>
    </header>
  )
}

function UserMenu({ user, displayName, chipPrimary, chipSecondary, avatarSeed }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const primary = chipPrimary || displayName
  const secondary = chipSecondary
  const avatarLabel = avatarSeed || displayName

  // Previously this menu only closed on Escape or by moving the mouse out of
  // it — neither of which happens on a touch device, so it got stuck open.
  useOutsideDismiss(open, wrapRef, () => setOpen(false))

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])



  return (
    <div ref={wrapRef} data-tour="user-menu" className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-surface-3 transition"
      >
        <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-semibold ${
          isSuperAdmin(user)
            ? 'bg-gradient-to-br from-indigo-500 to-indigo-700'
            : 'bg-gradient-to-br from-slate-700 to-slate-900'
        }`}>
          {initials(avatarLabel)}
        </div>
        <div className="hidden sm:block text-left leading-tight">
          <p className="text-sm font-medium text-fg max-w-[12rem] truncate">{primary}</p>
          {secondary && secondary !== primary && (
            <p className="text-[11px] text-fg-muted truncate max-w-[12rem]">{secondary}</p>
          )}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-fg-subtle ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && user && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 mt-2 w-44 bg-surface border border-line rounded-md shadow-lg z-30 py-1"
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); navigate('/profile') }}
            className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
          >
            Your profile
          </button>
          <div className="my-1 h-px bg-surface-3" />
          <button
            role="menuitem"
            onClick={() => { setOpen(false); authStore.logout(false).then(() => navigate('/login')) }}
            className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-danger-subtle hover:text-danger-fg focus:bg-danger-subtle focus:text-danger-fg focus:outline-none"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- AppShell -----------------------------------------------------

export default function AppShell({
  title,
  subtitle,
  actions,
  back,
  children,
  mainClass = 'flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto'
}) {
  const user = useUser()
  const platform = isPlatformShell(user)
  const tasks = useTasks(!platform)
  const { pathname } = useLocation()

  // Mobile-only overlay nav (opened from the bottom bar's Menu tab). Not
  // persisted; auto-closes whenever the route changes.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  useEffect(() => { setMobileMenuOpen(false) }, [pathname])

  // Push-drawer open/closed state — user preference, persisted (default open).
  const [navOpen, setNavOpen] = useState(() => {
    try { return localStorage.getItem('fs.navOpen') !== '0' } catch { return true }
  })
  const toggleNav = () => setNavOpen((o) => {
    const next = !o
    try { localStorage.setItem('fs.navOpen', next ? '1' : '0') } catch { /* storage unavailable */ }
    return next
  })

  // Application demo asks the sidebar to open so nav highlights are visible.
  useEffect(() => {
    const openNav = () => {
      setNavOpen(true)
      try { localStorage.setItem('fs.navOpen', '1') } catch { /* ignore */ }
    }
    window.addEventListener('fs:nav-open', openNav)
    return () => window.removeEventListener('fs:nav-open', openNav)
  }, [])

  // Only count approvals genuinely waiting on me (assigned to me + pending),
  // not requests I submitted that happen to be pending on someone else.
  const pendingCount = useMemo(
    () => tasks.filter(
      (t) => t.status === 'Pending' && user && String(t.assignedToId) === String(user._id)
    ).length,
    [tasks, user]
  )

  const hasTitleRow = title || subtitle || actions || back

  return (
    <div className="min-h-screen flex bg-surface-2/80 text-fg">
      {/* Keyboard users had to tab past the whole nav and search on every page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[120] focus:px-4 focus:py-2 focus:rounded-md focus:bg-indigo-600 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Push-drawer sidebar — occupies width when open, pushing content */}
      <Sidebar user={user} pendingCount={pendingCount} open={navOpen} onToggle={toggleNav} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar user={user} onToggleSidebar={toggleNav} sidebarOpen={navOpen} />

        <main id="main-content" data-tour="main-content" tabIndex={-1} className={`${mainClass} focus:outline-none`}>
          {/* Above the page title: a read-only workspace is context for whatever
              the user is about to try, not a footnote. Not mounted in the
              platform shell — it would poll a workspace licence endpoint the
              console is not allowed to call. */}
          {!platform && <div className="shrink-0"><LicenceBanner /></div>}
          {hasTitleRow && (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5 shrink-0">
              <div className="min-w-0" data-tour="page-title">
                {back && (
                  <Link
                    to={back.to}
                    className="text-xs text-fg-muted hover:text-fg inline-flex items-center gap-1 mb-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {back.label}
                  </Link>
                )}
                {title && (
                  <h1 className="text-2xl font-bold text-fg leading-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <div className="text-sm text-fg-muted mt-1">{subtitle}</div>
                )}
              </div>
              {actions && (
                <div data-tour="page-actions" className="flex items-center gap-2 flex-wrap shrink-0">
                  {actions}
                </div>
              )}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile-only: fixed bottom tab bar + slide-in nav overlay (md:hidden) */}
      <BottomTabBar
        user={user}
        pendingCount={pendingCount}
        menuOpen={mobileMenuOpen}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />
      <MobileNavDrawer
        user={user}
        pendingCount={pendingCount}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Floating AI assistant — answers questions about a workspace's forms and
          requests, so it has nothing to say in the platform console */}
      {!platform && <AssistantWidget />}
    </div>
  )
}

// ---------- inline icons (used in the sidebar nav) ----------------------

function IconDashboard(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2 4 4 8-8 4 4" /><rect x="3" y="14" width="18" height="6" rx="1" /></svg>
)}
function IconForms(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" /></svg>
)}
function IconWorkflows(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 7.5l3 8M16 7.5l-3 8" /></svg>
)}
function IconTasks(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M5 7a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7z" /></svg>
)}
function IconAnalytics(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M9 15V9M14 15v-3M19 15V7" /></svg>
)}
function IconAudit(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" /></svg>
)}
function IconAdmin(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-3 4-5 8-5s8 2 8 5" /></svg>
)}
function IconProfile(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="9" r="2.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 16.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8" /></svg>
)}
function IconTeam(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 20c0-2.8 3.1-4.5 7-4.5s7 1.7 7 4.5M16 5.5a3 3 0 010 5.8M18 20c0-2 .8-3.3 4-4" /></svg>
)}
function IconRoles(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.4-2.9 8.4-7 10-4.1-1.6-7-5.6-7-10V6l7-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8L15 10" /></svg>
)}
function IconSettings(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5l1.6 2.2 2.7-.4.6 2.6 2.4 1.3-1.2 2.4 1.2 2.4-2.4 1.3-.6 2.6-2.7-.4L12 21.5l-1.6-2.2-2.7.4-.6-2.6-2.4-1.3L5.9 13l-1.2-2.4 2.4-1.3.6-2.6 2.7.4L12 2.5z" /></svg>
)}
function IconPlatform(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" /></svg>
)}
function IconHealth(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
)}
function IconPlans(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
)}
function IconMenu(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
)}
function IconDms(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" /></svg>
)}
function IconBuilding(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
)}
function IconFolder(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
)}
function IconTemplate(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
)}
function IconChart(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
)}
function IconIntegration(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
)}
function IconBilling(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
)}


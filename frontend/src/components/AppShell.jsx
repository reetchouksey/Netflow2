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
import { useUnreadCount } from '../lib/notificationsStore'
import { canManageUsers, canViewReports, canCreateWorkflow, isApprover, isSuperAdmin } from '../utils/permissions'
import AssistantWidget from './AssistantWidget'

// ---------- left rail ----------------------------------------------------

// Each item carries a `visible(user)` test. Items always-visible to logged-in
// users omit it. Sections that end up empty after filtering are hidden.
const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { key: 'dashboard', label: 'Dashboard',  to: '/dashboard',  icon: IconDashboard },
      { key: 'forms',     label: 'Forms',      to: '/forms',      icon: IconForms },
      { key: 'workflows', label: 'Workflows',  to: '/workflows',  icon: IconWorkflows, visible: canCreateWorkflow },
      // Hidden for now — re-enable to restore the AI Routing nav item.
      // { key: 'routing',   label: 'AI Routing', to: '/approval-routing', icon: IconRouting, visible: canViewReports },
      { key: 'tasks',     label: 'Tasks',      to: '/tasks',      icon: IconTasks, labelFor: (u) => (isApprover(u) ? 'Tasks' : 'Requests') }
    ]
  },
  {
    label: 'REPORTS',
    items: [
      { key: 'analytics', label: 'Analytics',  to: '/analytics',  icon: IconAnalytics, visible: canViewReports },
      { key: 'audit',     label: 'Audit log',  to: '/audit-log',  icon: IconAudit,     visible: canViewReports }
    ]
  },
  {
    label: 'SETTINGS',
    items: [
      { key: 'admin', label: 'Admin Panel', to: '/admin', icon: IconAdmin, chevron: true, visible: canManageUsers },
      { key: 'platform', label: 'Platform', to: '/platform', icon: IconPlatform, chevron: true, visible: isSuperAdmin }
    ]
  }
]

function visibleSections(user) {
  return NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.visible || item.visible(user))
    }))
    .filter((section) => section.items.length > 0)
}

// Shared nav rendering — the permission-filtered sections + links. Used by both
// the desktop push-drawer Sidebar and the mobile overlay drawer. `onNavigate`
// (optional) fires when a link is tapped, letting the mobile drawer close.
function NavSections({ user, pendingCount, onNavigate }) {
  const { pathname } = useLocation()
  const sections = visibleSections(user)

  return (
    <>
      {sections.map((section) => (
        <div key={section.label} className="mb-4">
          <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-fg-subtle uppercase">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon
              const label = item.labelFor ? item.labelFor(user) : item.label
              const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
              const showBadge = item.key === 'tasks' && pendingCount > 0
              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'text-fg-muted hover:bg-surface-3 hover:text-fg'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-fg-muted'}`} />
                    <span className="flex-1 whitespace-nowrap">{label}</span>
                    {showBadge && (
                      <span className="text-[10px] font-semibold rounded-full bg-emerald-500 text-white px-1.5 py-0.5 min-w-[18px] text-center">
                        {pendingCount}
                      </span>
                    )}
                    {item.chevron && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
function Sidebar({ user, pendingCount, open }) {
  return (
    <aside
      aria-hidden={!open}
      className={`hidden md:block shrink-0 overflow-hidden bg-surface border-line text-fg sticky top-0 h-screen transition-[width] duration-200 ease-in-out ${open ? 'w-60 border-r' : 'w-0'}`}
    >
      {/* Fixed inner width keeps nav from reflowing while the rail animates */}
      <nav className="w-60 h-full px-3 py-5 overflow-y-auto flex flex-col">
        <NavSections user={user} pendingCount={pendingCount} />
      </nav>
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
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? 'text-indigo-600 dark:text-indigo-300' : 'text-fg-muted'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold flex items-center justify-center">
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
function MobileNavDrawer({ user, pendingCount, open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className="md:hidden" aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <aside
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[80%] bg-surface border-r border-line text-fg shadow-xl transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-line">
          <img src="/netflow-icon.png" alt="NetFlow" className="w-8 h-8 rounded-xl" />
          <span className="font-bold text-fg text-[15px] tracking-tight">NetFlow</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto w-9 h-9 rounded-md flex items-center justify-center text-fg-muted hover:bg-surface-3 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="px-3 py-4 overflow-y-auto h-[calc(100dvh-4rem)] flex flex-col">
          <NavSections user={user} pendingCount={pendingCount} onNavigate={onClose} />
        </nav>
      </aside>
    </div>
  )
}

// ---------- global search ------------------------------------------------

const TYPE_BADGE = {
  Request:  'bg-blue-50 text-blue-600',
  Form:     'bg-emerald-50 text-emerald-600',
  Workflow: 'bg-violet-50 text-violet-600',
  Page:     'bg-surface-3 text-fg-muted',
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
// workflows are only surfaced to roles that can open the workflows page.
function GlobalSearch({ user }) {
  const navigate = useNavigate()
  const tasks = useTasks()
  const forms = useForms()
  const workflows = useWorkflows()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)
  const boxRef = useRef(null)

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

  // Close the dropdown when clicking outside the search box.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out = []

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
      for (const w of workflows) {
        const name = w.name || w.title || ''
        if (name.toLowerCase().includes(q) || (w.category || '').toLowerCase().includes(q)) {
          out.push({ type: 'Workflow', id: w.id, label: name || 'Workflow', sub: w.status || w.category || 'Workflow', to: '/workflows' })
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
  }, [query, tasks, forms, workflows, user])

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
    <div ref={boxRef} className="flex-1 max-w-2xl relative">
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
          placeholder="Search requests, forms, workflows…"
          className="w-full pl-9 pr-4 sm:pr-16 py-2 text-sm text-fg border border-line rounded-lg bg-surface-2 placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-surface transition"
        />
        <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-fg-subtle border border-line rounded px-1.5 py-0.5 bg-surface font-sans pointer-events-none">
          Ctrl K
        </kbd>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-30">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-fg-subtle">No matches for &ldquo;{query.trim()}&rdquo;</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.type}:${r.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => go(r)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${i === activeIdx ? 'bg-indigo-50' : 'hover:bg-surface-2'}`}
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

function TopBar({ user, unreadCount, onToggleSidebar }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const displayName = user?.name || 'Guest'
  const roleLabel = user?.role?.name
    ? (ROLE_LABELS[user.role.name] || user.role.name)
    : 'Member'

  return (
    <header className="h-16 bg-surface border-b border-line px-4 md:px-6 flex items-center gap-3 md:gap-4 sticky top-0 z-20">
      {/* Sidebar open/close toggle */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="w-9 h-9 -ml-1 rounded-md hidden md:flex items-center justify-center text-fg-muted hover:bg-surface-3 transition shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Logo — shown for all users in the top bar */}
      <Link to="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
        <img src="/netflow-icon.png" alt="NetFlow" className="w-8 h-8 rounded-xl" />
        <span className="hidden sm:inline font-bold text-fg text-[15px] tracking-tight">NetFlow</span>
      </Link>

      {/* Global search — works for every role */}
      <GlobalSearch user={user} />

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
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
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-md flex items-center justify-center text-fg-muted hover:bg-surface-3 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.17V11a6 6 0 10-12 0v3.17a2 2 0 01-.6 1.43L4 17h5m6 0a3 3 0 11-6 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="hidden sm:block w-px h-8 bg-line mx-1" />

        <UserMenu user={user} displayName={displayName} roleLabel={roleLabel} />
      </div>
    </header>
  )
}

function UserMenu({ user, displayName, roleLabel }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleLogout = async () => {
    await authStore.logout()
    navigate('/login')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-surface-3 transition"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-semibold">
          {initials(displayName)}
        </div>
        <div className="hidden sm:block text-left leading-tight">
          <p className="text-sm font-medium text-fg max-w-[10rem] truncate">{displayName}</p>
          <p className="text-[11px] text-fg-muted">{roleLabel}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-fg-subtle ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && user && (
        <div
          className="absolute right-0 mt-2 w-44 bg-surface border border-line rounded-md shadow-lg z-30 py-1"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            onClick={() => { setOpen(false); navigate('/profile') }}
            className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-surface-2"
          >
            Your profile
          </button>
          <div className="my-1 h-px bg-surface-3" />
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-red-50 hover:text-red-600"
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
  const tasks = useTasks()
  const unreadCount = useUnreadCount()
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
      {/* Push-drawer sidebar — occupies width when open, pushing content */}
      <Sidebar user={user} pendingCount={pendingCount} open={navOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={user} unreadCount={unreadCount} onToggleSidebar={toggleNav} />

        <main className={mainClass}>
          {hasTitleRow && (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
              <div className="min-w-0">
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
                <div className="flex items-center gap-2 flex-wrap shrink-0">
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

      {/* Floating AI assistant — hidden automatically when no LLM is configured */}
      <AssistantWidget />
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
function IconRouting(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 6H13a2.5 2.5 0 012.5 2.5M8.5 18H13a2.5 2.5 0 002.5-2.5" /></svg>
)}
function IconPlatform(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" /></svg>
)}
function IconMenu(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
)}

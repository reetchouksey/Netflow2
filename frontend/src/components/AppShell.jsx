// Shared - AppShell.jsx
// One layout for every authenticated page.
// - Non-employees: left sidebar + top bar (search, bell, user)
// - Employees: top bar (logo + search, bell, user) + bottom tab bar

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authStore, useUser, initials, ROLE_LABELS } from '../utils/auth'
import { useTasks } from '../lib/tasksStore'
import { useForms } from '../lib/formsStore'
import { useWorkflows } from '../lib/workflowsStore'
import { useUnreadCount } from '../lib/notificationsStore'
import { canManageUsers, canViewReports, canCreateWorkflow, isApprover } from '../utils/permissions'
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
      { key: 'admin', label: 'Admin Panel', to: '/admin', icon: IconAdmin, chevron: true, visible: canManageUsers }
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

function Sidebar({ user, pendingCount }) {
  const { pathname } = useLocation()
  const sections = visibleSections(user)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('fs.sidebarCollapsed') === '1' } catch { return false }
  })
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem('fs.sidebarCollapsed', next ? '1' : '0') } catch { /* storage unavailable */ }
    return next
  })

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} shrink-0 bg-white border-r border-gray-200 text-gray-700 flex flex-col min-h-screen sticky top-0 h-screen transition-[width] duration-200`}>
      {/* Logo */}
      <div className={`pt-5 pb-4 border-b border-gray-100 ${collapsed ? 'px-3' : 'px-5'}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <img src="/netflow-icon.png" alt="NetFlow" className="w-9 h-9 rounded-xl shrink-0" />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-gray-900 font-bold tracking-tight text-[15px]">NetFlow</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Automate. Orchestrate. Scale.</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-hidden">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                {section.label}
              </p>
            )}
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
                      title={collapsed ? label : undefined}
                      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} />
                      {!collapsed && <span className="flex-1">{label}</span>}
                      {!collapsed && showBadge && (
                        <span className="text-[10px] font-semibold rounded-full bg-emerald-500 text-white px-1.5 py-0.5 min-w-[18px] text-center">
                          {pendingCount}
                        </span>
                      )}
                      {collapsed && showBadge && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" title={`${pendingCount} pending`} />
                      )}
                      {!collapsed && item.chevron && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  )
}

// ---------- floating icon dock (non-employees) ----------------------------

function IconDock({ user, pendingCount }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const sections = visibleSections(user)
  const allItems = sections.flatMap((s) => s.items)

  const handleLogout = async () => {
    await authStore.logout()
    navigate('/login')
  }

  return (
    <div
      className={`fixed left-0 top-0 bottom-0 z-30 flex flex-col items-start gap-1 bg-white border-r border-gray-200 py-3 shadow-sm transition-all duration-200 overflow-hidden ${hovered ? 'w-44 px-2' : 'w-12 px-1.5'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Nav icons */}
      <div className="flex-1 flex flex-col gap-1 w-full">
        {allItems.map((item) => {
          const Icon = item.icon
          const label = item.labelFor ? item.labelFor(user) : item.label
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
          const showBadge = item.key === 'tasks' && pendingCount > 0
          return (
            <Link
              key={item.key}
              to={item.to}
              title={!hovered ? label : undefined}
              className={`relative flex items-center gap-2.5 rounded-xl transition-all w-full py-2 ${hovered ? 'px-2' : 'justify-center px-0'} ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} />
              {hovered && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
              {showBadge && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </Link>
          )
        })}
      </div>

      {/* Logout button — pinned to bottom */}
      <div className="w-full pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleLogout}
          title={!hovered ? 'Sign out' : undefined}
          className={`flex items-center gap-2.5 w-full py-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all ${hovered ? 'px-2' : 'justify-center px-0'}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
          {hovered && <span className="text-sm font-medium whitespace-nowrap">Sign out</span>}
        </button>
      </div>
    </div>
  )
}

// ---------- global search ------------------------------------------------

const TYPE_BADGE = {
  Request:  'bg-blue-50 text-blue-600',
  Form:     'bg-emerald-50 text-emerald-600',
  Workflow: 'bg-violet-50 text-violet-600',
  Page:     'bg-gray-100 text-gray-500',
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
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
          className="w-full pl-9 pr-16 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-white font-sans pointer-events-none">
          Ctrl K
        </kbd>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-30">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400">No matches for &ldquo;{query.trim()}&rdquo;</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.type}:${r.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => go(r)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${i === activeIdx ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_BADGE[r.type] || TYPE_BADGE.Page}`}>{r.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-gray-800 truncate">{r.label}</span>
                      <span className="block text-[10px] text-gray-400 truncate">{r.sub}</span>
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

function TopBar({ user, unreadCount }) {
  const navigate = useNavigate()
  const displayName = user?.name || 'Guest'
  const roleLabel = user?.role?.name
    ? (ROLE_LABELS[user.role.name] || user.role.name)
    : 'Member'

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center gap-4 sticky top-0 z-20">
      {/* Logo — shown for all users in the top bar */}
      <Link to="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
        <img src="/netflow-icon.png" alt="NetFlow" className="w-8 h-8 rounded-xl" />
        <span className="font-bold text-gray-900 text-[15px] tracking-tight">NetFlow</span>
      </Link>

      {/* Global search — works for every role */}
      <GlobalSearch user={user} />

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
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

        <div className="w-px h-8 bg-gray-200 mx-1" />

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
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-gray-100 transition"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-semibold">
          {initials(displayName)}
        </div>
        <div className="text-left leading-tight">
          <p className="text-sm font-medium text-gray-800 max-w-[10rem] truncate">{displayName}</p>
          <p className="text-[11px] text-gray-500">{roleLabel}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && user && (
        <div
          className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            onClick={() => { setOpen(false); navigate('/profile') }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Your profile
          </button>
          <div className="my-1 h-px bg-gray-100" />
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600"
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
  mainClass = 'flex-1 p-6 overflow-y-auto'
}) {
  const user = useUser()
  const tasks = useTasks()
  const unreadCount = useUnreadCount()

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
    <div className="min-h-screen flex bg-gray-50/80 text-gray-800">
      {/* Floating icon dock — shown for all roles */}
      <IconDock user={user} pendingCount={pendingCount} />

      <div className="flex-1 flex flex-col min-w-0 pl-14">
        <TopBar user={user} unreadCount={unreadCount} />

        <main className={mainClass}>
          {hasTitleRow && (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
              <div className="min-w-0">
                {back && (
                  <Link
                    to={back.to}
                    className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {back.label}
                  </Link>
                )}
                {title && (
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
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

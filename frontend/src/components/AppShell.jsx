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
import { toast } from '../lib/toastStore'
import AssistantWidget from './AssistantWidget'
import LicenceBanner from './LicenceBanner'
import NotificationsBell from './NotificationsBell'
import DmsProviderWidget from './DmsProviderWidget'
import NetFlowLogo from './NetFlowLogo'

// ---------- left rail ----------------------------------------------------
// Four shells. Items without `visible` are always shown inside that shell.
// Never-show lists are enforced by simply omitting those routes from the shell.

const PLATFORM_NAV = [
  {
    label: null,
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
      { key: 'platform', label: 'Organizations', to: '/platform', icon: IconPlatform },
      { key: 'usage', label: 'Usage', to: '/usage', icon: IconAnalytics },
      { key: 'activity', label: 'Activity Logs', to: '/activity', icon: IconAudit },
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
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: IconDashboard }
    ]
  },
  {
    label: 'MANAGEMENT',
    items: [
      { key: 'departments',  label: 'Departments',           to: '/departments', icon: IconBuilding },
      { key: 'users',        label: 'Users',                 to: '/admin',       icon: IconTeam },
      { key: 'roles',        label: 'Roles & Permissions',   to: '/roles',       icon: IconRoles },
      { key: 'org-settings', label: 'Organization Settings', to: '/settings',    icon: IconSettings },
      { key: 'billing',      label: 'Plan & Usage',          to: '/billing',     icon: IconBilling }
    ]
  },
  {
    label: 'MONITORING',
    items: [
      { key: 'forms',     label: 'Forms',      to: '/forms',     icon: IconForms },
      { key: 'workflows', label: 'Workflows',  to: '/workflows', icon: IconWorkflows },
      { key: 'reports',   label: 'Reports',    to: '/analytics', icon: IconAnalytics },
      { key: 'audit',     label: 'Audit Logs', to: '/audit-log', icon: IconAudit }
    ]
  }
]


const OPS_NAV = [
  {
    label: null,
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: IconDashboard },
      { key: 'tasks', label: 'Approvals', to: '/tasks', icon: IconTasks },
      { key: 'forms', label: 'Forms', to: '/forms', icon: IconForms },
      { key: 'analytics', label: 'Analytics', to: '/analytics', icon: IconAnalytics }
    ]
  }
]

const WORKSPACE_NAV = [
  {
    label: null,
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
  if (shell === SHELL.PLATFORM) sections = [...PLATFORM_NAV]
  else if (shell === SHELL.ORG_ADMIN) sections = [...ORG_ADMIN_NAV]
  else if (shell === SHELL.OPS) sections = [...OPS_NAV]
  else sections = [...WORKSPACE_NAV]

  if (shell !== SHELL.PLATFORM && shell === SHELL.ORG_ADMIN) {
    const platformItems = []
    
    if (user && (user.dmsEnabled === true || user.org?.integrations?.dmsEnabled === true)) {
      platformItems.push({
        key: 'documents',
        label: 'DMS',
        to: '/documents',
        icon: IconDms
      })
    }
    
    if (user && (user.s3Enabled === true || user.s3Storage === true || user.org?.integrations?.s3Storage === true)) {
      platformItems.push({
        key: 's3storage',
        label: 'S3 Storage',
        to: '/s3-storage',
        icon: IconFolder
      })
    }

    if (platformItems.length > 0) {
      sections.push({
        label: 'DOCUMENTS MANAGEMENT SYSTEM',
        items: platformItems
      })
    }
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
  const isPlatform = isPlatformShell(user)

  const [expanded, setExpanded] = useState(() => {
    const map = {}
    sections.forEach((s, i) => { map[s.label || i] = true })
    return map
  })

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <>
      {sections.map((section, si) => {
        const key = section.label || si
        const isOpen = expanded[key] !== false

        return (
          <div key={key} className={si === 0 ? '' : 'mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/60'}>
            {section.label ? (
              <button
                type="button"
                onClick={() => toggle(key)}
                className="w-full px-2.5 py-1.5 mb-1.5 flex items-center justify-between text-[12px] font-black tracking-[0.09em] text-slate-800 dark:text-slate-200 uppercase rounded-xl hover:bg-slate-100/90 dark:hover:bg-slate-800/70 transition group cursor-pointer"
              >
                <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#134287] shrink-0 shadow-xs" />
                  <span className="tracking-wider">{section.label}</span>
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : null}

            {isOpen && (
              <ul className={isPlatform ? "space-y-1.5" : "space-y-1"}>
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
                    <li key={item.key} className="relative mb-1">
                      <Link
                        to={item.to}
                        onClick={onNavigate}
                        data-tour={`nav-${item.key}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group flex items-center transition-all duration-200 ${
                          isPlatform
                            ? `gap-3.5 px-3.5 py-3 rounded-2xl text-[15px] font-bold tracking-tight ${
                                isActive
                                  ? 'bg-[#134287] text-white shadow-md shadow-blue-900/25 ring-1 ring-blue-700/30'
                                  : 'text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/90'
                              }`
                            : `gap-3 px-3 py-2.5 rounded-xl text-[13.5px] ${
                                item.key === 'dashboard' ? 'font-bold' : 'font-medium'
                              } ${
                                isActive
                                  ? 'bg-[#134287] text-white shadow-sm shadow-blue-900/20'
                                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800'
                              }`
                        }`}
                      >
                        <Icon className={`shrink-0 transition-colors duration-200 ${
                          isPlatform
                            ? `w-[22px] h-[22px] stroke-[2.3] ${
                                isActive
                                  ? 'text-white'
                                  : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white'
                              }`
                            : `w-5 h-5 stroke-[2] ${
                                isActive
                                  ? 'text-white'
                                  : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                              }`
                        }`} />
                        <span className={`flex-1 truncate ${isPlatform || item.key === 'dashboard' ? 'font-bold' : ''}`}>{label}</span>
                        {(showBadge || item.badgeCount) && (
                          <span className="shrink-0 flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-[#f43f5e] text-white text-[11px] font-bold leading-none shadow-xs">
                            {showBadge ? (pendingCount > 99 ? '99+' : pendingCount) : item.badgeCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </>
  )
}

// Push drawer: a full labeled sidebar that occupies real layout width when
// `open` (so page content is pushed, not covered) and collapses to zero width
// when closed. Desktop only (md+); on phones the bottom tab bar + overlay
// drawer take over. The open/close toggle lives in the top bar.
function Sidebar({ user, pendingCount, open, onToggle }) {
  const shellLabel = SHELL_FOOTER[getShell(user)] || 'Workspace'
  const isPlatform = isPlatformShell(user)
  const { pathname } = useLocation()
  const sections = visibleSections(user)
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections])

  return (
    <aside
      id="app-sidebar"
      className={`hidden md:flex flex-col shrink-0 ${
        open ? (isPlatform ? 'w-[260px]' : 'w-[250px]') : 'w-16'
      } overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 text-fg sticky top-0 h-screen transition-[width] duration-300 ease-in-out z-40`}
    >
      {open ? (
        <div className={`${isPlatform ? 'w-[260px]' : 'w-[250px]'} h-full flex flex-col min-h-0`}>
          <div className="shrink-0 py-5 px-5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
            <Link to="/dashboard" className="flex items-center min-w-0 flex-1 rounded-xl hover:opacity-90 transition gap-3.5">
              <NetFlowLogo size={42} className="w-[42px] h-[42px] shrink-0" />
              <div className="flex flex-col justify-center">
                <span className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  NetFlow
                </span>
                <span className="text-[12px] font-medium text-slate-400 mt-1 truncate leading-none">
                  Workflow Automation
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              aria-expanded={open}
              aria-controls="app-sidebar"
              title="Collapse sidebar"
              className="relative z-10 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <nav aria-label="Main" className="flex-1 min-h-0 px-3 py-6 overflow-y-auto sidebar-scroll">
            <NavSections user={user} pendingCount={pendingCount} />
          </nav>

          <div className="shrink-0 px-5 py-5 border-t border-slate-100 dark:border-slate-800/60">
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">
              <span className="block font-semibold text-slate-700 dark:text-slate-300">{shellLabel}</span>
              <span className="block mt-0.5 text-slate-400 dark:text-slate-500">Navigation matches your role's access.</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="w-16 h-full flex flex-col items-center justify-between py-3">
          {/* Top Logo Button - Shows Expand Arrow on Hover */}
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="relative group/logotip flex items-center justify-center">
              <button
                type="button"
                onClick={onToggle}
                aria-label="Expand sidebar"
                className="relative w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shadow-indigo-500/30 hover:scale-105 transition-all duration-200 cursor-pointer overflow-hidden group"
              >
                <NetFlowLogo size={40} className="w-10 h-10 shrink-0 transition-all duration-200 group-hover:scale-0 group-hover:opacity-0" />
                {/* Right Expand Arrow on Hover */}
                <svg
                  className="w-5 h-5 text-indigo-600 dark:text-indigo-400 absolute transition-all duration-200 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Instant Light Gray Flyout Tooltip with Arrow Indicator */}
              <div className="absolute left-full ml-3.5 px-3 py-1.5 bg-[#F1F5F9] dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl shadow-md border border-slate-300/80 dark:border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover/logotip:opacity-100 transition-opacity duration-75 z-50 flex items-center gap-1.5">
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#F1F5F9] dark:bg-slate-800 border-l border-b border-slate-300/80 dark:border-slate-700 rotate-45" />
                <span>Open sidebar</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">→</span>
              </div>
            </div>

            <div className="w-8 h-px bg-slate-100 dark:bg-slate-800 my-1" />

            {/* Collapsed Nav Icons with Instant Light Gray Hover Tooltip */}
            <div className="flex flex-col items-center gap-3 w-full px-2">
              {allItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
                const label = item.labelFor ? item.labelFor(user) : item.label
                const showBadge = item.key === 'tasks' && pendingCount > 0

                return (
                  <div key={item.key} className="relative group/navtip flex items-center justify-center">
                    <Link
                      to={item.to}
                      className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-[#134287] text-white shadow-md shadow-blue-900/30'
                          : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-5 h-5 stroke-[2]" />
                      {showBadge && (
                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900" />
                      )}
                    </Link>

                    {/* Instant Hover Light Gray Flyout Label Tooltip */}
                    <div className="absolute left-full ml-3.5 px-3 py-1.5 bg-[#F1F5F9] dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl shadow-md border border-slate-300/80 dark:border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover/navtip:opacity-100 transition-opacity duration-75 z-50 flex items-center gap-1.5">
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#F1F5F9] dark:bg-slate-800 border-l border-b border-slate-300/80 dark:border-slate-700 rotate-45" />
                      <span className="relative z-10">{label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Weather / Notification Widget */}
          <div className="flex flex-col items-center gap-2 pb-2">
            <div className="relative group/weathertip flex items-center justify-center">
              <button
                type="button"
                onClick={onToggle}
                className="relative w-10 h-10 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center hover:scale-105 transition border border-indigo-100/60 dark:border-indigo-900 shrink-0 cursor-pointer"
              >
                <span className="text-lg">☁️</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                  1
                </span>
              </button>
              <div className="absolute left-full ml-3.5 px-3 py-1.5 bg-[#F1F5F9] dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl shadow-md border border-slate-300/80 dark:border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover/weathertip:opacity-100 transition-opacity duration-75 z-50 flex items-center gap-1.5">
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#F1F5F9] dark:bg-slate-800 border-l border-b border-slate-300/80 dark:border-slate-700 rotate-45" />
                <span className="relative z-10">Notifications • Expand</span>
              </div>
            </div>
          </div>
        </div>
      )}
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
          <NetFlowLogo size={32} className="w-8 h-8 shrink-0 rounded-xl" />
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
    <div ref={boxRef} data-tour="search" className="flex-1 max-w-xl relative">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={platform ? 'Search organizations, pages…' : 'Search or ask AI...'}
          aria-label={platform ? 'Search organizations and pages' : 'Search requests, forms and workflows'}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          className="w-full pl-10 pr-20 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/80 placeholder-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white dark:focus:bg-slate-800 transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-700 font-mono shadow-sm pointer-events-none">
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

function TopBar({ user, pageTitle, onToggleSidebar, sidebarOpen }) {
  const { pathname } = useLocation()
  const theme = useTheme()
  const displayName = user?.name || 'Guest'
  const roleLabel = user?.role?.name
    ? (ROLE_LABELS[user.role.name] || user.role.name)
    : 'Member'
  const chipPrimary = isSuperAdmin(user) ? roleLabel : displayName
  const chipSecondary = isSuperAdmin(user) ? '' : roleLabel

  const getDynamicTitle = () => {
    if (pageTitle && typeof pageTitle === 'string' && pageTitle.trim()) return pageTitle
    if (pathname === '/dashboard') return 'Dashboard'
    if (pathname.startsWith('/platform')) return 'Organizations'
    if (pathname.startsWith('/plans')) return 'Plans'
    if (pathname.startsWith('/billing')) return 'Plan & Usage'
    if (pathname.startsWith('/usage')) return 'Usage'
    if (pathname.startsWith('/activity')) return 'Activity Logs'
    if (pathname.startsWith('/health')) return 'System Health'
    if (pathname.startsWith('/admins')) return 'Admins'
    if (pathname.startsWith('/departments')) return 'Departments'
    if (pathname.startsWith('/admin')) return 'Users'
    if (pathname.startsWith('/roles')) return 'Roles & Permissions'
    if (pathname.startsWith('/forms')) return 'Forms'
    if (pathname.startsWith('/workflows')) return 'Workflows'
    if (pathname.startsWith('/analytics')) return 'Analytics'
    if (pathname.startsWith('/audit-log')) return 'Audit Logs'
    if (pathname.startsWith('/settings')) return 'Organization Settings'
    if (pathname.startsWith('/tasks')) return 'Approvals'
    if (pathname.startsWith('/team')) return 'My Team'
    if (pathname.startsWith('/profile')) return 'Profile'
    
    // Capitalize fallback route
    const part = pathname.split('/').filter(Boolean)[0]
    return part ? part.charAt(0).toUpperCase() + part.slice(1) : 'Dashboard'
  }

  const activeTitle = getDynamicTitle()

  return (
    <header className="h-16 px-6 md:px-8 bg-white/80 dark:bg-[#111a2e]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between sticky top-0 z-20 gap-4">

      {/* Left: Page Title + Search */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        {/* Page title */}
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white shrink-0 tracking-tight">
          {activeTitle}
        </h2>

        {/* Pill-style search trigger */}
        <GlobalSearch user={user} />
      </div>

      {/* Right: Raise Ticket + Theme + Bell + User */}
      <div className="flex items-center gap-2.5 shrink-0">


        {/* Theme toggle */}
        <button
          type="button"
          data-tour="theme"
          onClick={() => themeStore.toggle()}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>

        {/* Notifications bell */}
        <NotificationsBell />

        {/* User avatar + name */}
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
  const [showSignOutPrompt, setShowSignOutPrompt] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const primary = chipPrimary || displayName
  const secondary = chipSecondary
  const avatarLabel = avatarSeed || displayName

  useOutsideDismiss(open, wrapRef, () => {
    setOpen(false)
    setShowSignOutPrompt(false)
  })

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setShowSignOutPrompt(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    await authStore.logout()
    navigate('/login')
  }

  return (
    <div ref={wrapRef} data-tour="user-menu" className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-brand-500 text-white text-xs font-extrabold flex items-center justify-center shadow-sm">
          {initials(avatarLabel)}
        </div>
        <div className="hidden sm:block text-left leading-tight">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[12rem] truncate leading-tight">{primary}</p>
          {secondary && secondary !== primary && (
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[12rem]">{secondary}</p>
          )}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && user && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); navigate('/profile') }}
            className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-between cursor-pointer"
          >
            <span>Your profile</span>
            <span className="text-slate-400 text-xs">👤</span>
          </button>

          <div className="my-1.5 h-px bg-slate-100 dark:bg-slate-800" />

          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center justify-between cursor-pointer"
          >
            <span>Sign out</span>
            <span className="text-rose-400 text-xs">🚪</span>
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
  fullscreen = false,
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

  // Title is now shown in the TopBar — only keep the in-page row when there
  // are supplementary elements (back link, subtitle, or action buttons).
  const hasTitleRow = subtitle || actions || back

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] h-screen w-screen flex flex-col bg-[#eaedf4] dark:bg-[#111a2e] text-fg overflow-hidden">
        <main id="main-content" tabIndex={-1} className={`${mainClass} focus:outline-none h-full w-full`}>
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen max-h-screen flex bg-[#eaedf4] dark:bg-[#111a2e] text-fg overflow-hidden">
      {/* Keyboard users had to tab past the whole nav and search on every page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[120] focus:px-4 focus:py-2 focus:rounded-md focus:bg-indigo-600 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Push-drawer sidebar — occupies width when open, pushing content */}
      <Sidebar user={user} pendingCount={pendingCount} open={navOpen} onToggle={toggleNav} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TopBar user={user} onToggleSidebar={toggleNav} sidebarOpen={navOpen} pageTitle={typeof title === 'string' ? title : undefined} />


        <main id="main-content" data-tour="main-content" tabIndex={-1} className={`${mainClass} focus:outline-none`}>
          {/* Above the page title: a read-only workspace is context for whatever
              the user is about to try, not a footnote. Not mounted in the
              platform shell — it would poll a workspace licence endpoint the
              console is not allowed to call. */}
          {!platform && <div className="shrink-0"><LicenceBanner /></div>}
          {hasTitleRow && (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between flex-wrap gap-4 mb-5 shrink-0">
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
function IconNotifications(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
)}
function IconNetwork(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v4M12 11l-5.5 6M12 11l5.5 6" /></svg>
)}
function IconTicket(p) { return (
  <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
)}


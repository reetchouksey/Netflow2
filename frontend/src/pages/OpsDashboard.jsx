// Shell 3 (Business Ops) - OpsDashboard.jsx
// The home screen for CEO / VP / Manager / HR.
//
// These roles used to land on the builder dashboard, which opens with "Total
// Workflows" and an execution chart — a designer's view of the workspace. A
// leader's first question is narrower and more urgent: what is waiting on my
// signature, and who on my side is stuck? So the page opens with the decision
// queue, oldest first, and the team's load sits next to it.

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser } from '../utils/auth'
import { useTasks, tasksStore } from '../lib/tasksStore'
import { adaptTask } from '../utils/adapters'
import { StatCardSkeleton, ListRowSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { statusBadge } from '../utils/badges'
import { relativeTime } from '../utils/datetime'

const OPEN = ['Pending', 'Escalated']

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// How long a decision has been sitting with someone. Leaders act on the oldest
// item, so this reads as an age rather than a timestamp.
const waitingFor = (task) => relativeTime(task.createdAt) || 'just now'

function StatCard({ icon: Icon, tone, label, value, hint, onClick }) {
  const colorStyles = {
    indigo: 'text-[#6366F1] bg-[#EEF2FF] dark:bg-indigo-500/15 dark:text-indigo-400',
    danger: 'text-[#DC2626] bg-[#FEE2E2] dark:bg-rose-500/15 dark:text-rose-400',
    warning: 'text-[#D97706] bg-[#FEF3C7] dark:bg-amber-500/15 dark:text-amber-400',
    success: 'text-[#0F766E] bg-[#EAFBF1] dark:bg-emerald-500/15 dark:text-emerald-400',
    sky: 'text-[#0284C7] bg-[#E0F2FE] dark:bg-cyan-500/15 dark:text-cyan-400',
    purple: 'text-[#7C3AED] bg-[#F3E8FF] dark:bg-purple-500/15 dark:text-purple-400',
  }
  const iconTheme = colorStyles[tone] || colorStyles.indigo

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between transition min-w-0 ${onClick ? 'cursor-pointer hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconTheme}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-2">
        <div className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight leading-tight">
          {value}
        </div>
        {hint && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {hint}
          </div>
        )}
      </div>
    </div>
  )
}

// The queue. One row per decision, oldest at the top, overdue called out.
function DecisionQueue({ tasks, loading }) {
  const rows = tasks.slice(0, 7)
  return (
    <div className="bg-surface border border-line rounded-xl flex flex-col xl:col-span-2">
      <div className="px-5 py-4 flex items-center justify-between border-b border-line">
        <div>
          <h2 className="text-sm font-semibold text-fg">Needs your decision</h2>
          <p className="text-xs text-fg-muted mt-0.5">Oldest first — {tasks.length} waiting</p>
        </div>
        <Link to="/tasks" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Open inbox</Link>
      </div>

      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-line">
          {Array.from({ length: 4 }).map((_, i) => <li key={i}><ListRowSkeleton /></li>)}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          className="flex-1"
          title="Nothing waiting on you"
          description="Your approval queue is clear. New requests will land here as they reach your step."
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((t) => {
            const badge = statusBadge(t.slaBreached ? 'Escalated' : t.status)
            return (
              <li key={t.id}>
                <Link to={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition">
                  <span className={`w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ${t.avatarColor}`}>
                    {t.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate">{t.title}</p>
                    <p className="text-xs text-fg-muted truncate">
                      {t.requester} · waiting {waitingFor(t)}
                    </p>
                  </div>
                  {t.slaBreached ? (
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge.badge}`}>Overdue</span>
                  ) : (
                    <span className="text-[11px] text-fg-subtle">{t.department}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Who on the team is carrying the load. Sorted by trouble: overdue first, then
// the biggest queue — the people a leader should unblock today.
function TeamLoad({ team, loading }) {
  const rows = useMemo(() => {
    const members = team?.members || []
    return [...members]
      .filter((m) => m.pendingApprovals > 0 || m.openRequests > 0 || m.outOfOffice)
      .sort((a, b) => (b.overdue - a.overdue) || (b.pendingApprovals - a.pendingApprovals))
      .slice(0, 6)
  }, [team])

  return (
    <div className="bg-surface border border-line rounded-xl flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between border-b border-line">
        <div>
          <h2 className="text-sm font-semibold text-fg">Team load</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            {team?.totals?.members || 0} {team?.totals?.members === 1 ? 'person' : 'people'}
          </p>
        </div>
        <Link to="/team" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View team</Link>
      </div>

      {loading ? (
        <ul className="divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => <li key={i}><ListRowSkeleton /></li>)}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          className="flex-1"
          title={team?.totals?.members ? 'Team is clear' : 'No one reports to you yet'}
          description={
            team?.totals?.members
              ? 'Nobody on your team has anything pending right now.'
              : 'Once reporting lines are set in Users, your people show up here.'
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((m) => (
            <li key={m._id} className="px-5 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg truncate">
                  {m.name}
                  {m.outOfOffice ? <span className="ml-2 text-[11px] text-fg-subtle">away</span> : null}
                </p>
                <p className="text-xs text-fg-muted truncate">{m.role || m.department}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-fg">{m.pendingApprovals}</p>
                <p className="text-[11px] text-fg-subtle">
                  {m.overdue > 0 ? <span className="text-danger-fg">{m.overdue} overdue</span> : 'in queue'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// What the team has raised that is still moving — the leader's early warning on
// work that has not reached them yet.
function TeamRequests({ tasks, loading }) {
  const rows = tasks.slice(0, 6)
  return (
    <div className="bg-surface border border-line rounded-xl flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between border-b border-line">
        <h2 className="text-sm font-semibold text-fg">Team requests in flight</h2>
        <Link to="/tasks?scope=team" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">See all</Link>
      </div>
      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => <li key={i}><ListRowSkeleton /></li>)}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          className="flex-1"
          title="Nothing in flight"
          description="Requests raised by your team appear here while they move through approvals."
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((t) => {
            const badge = statusBadge(t.status)
            return (
              <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg truncate">{t.title}</p>
                  <p className="text-xs text-fg-muted truncate">
                    {t.requester} · with {t.approver || 'unassigned'}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0 ${badge.badge}`}>
                  {t.status}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// A leader's own decisions, most recent first — useful when someone asks "did
// you already sign this off?".
function RecentDecisions({ tasks }) {
  const rows = tasks.slice(0, 6)
  return (
    <div className="bg-surface border border-line rounded-xl flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between border-b border-line">
        <h2 className="text-sm font-semibold text-fg">Your recent decisions</h2>
        <Link to="/analytics" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Reports</Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          className="flex-1"
          title="No decisions yet"
          description="Approvals and rejections you make will be listed here."
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((t) => {
            const badge = statusBadge(t.status)
            return (
              <li key={t.id}>
                <Link to={`/tasks/${t.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-surface-2 transition">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate">{t.title}</p>
                    <p className="text-xs text-fg-muted truncate">{t.requester} · {relativeTime(t.createdAt)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0 ${badge.badge}`}>
                    {t.status}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function OpsDashboard() {
  const navigate = useNavigate()
  const user = useUser()
  const myTasks = useTasks()
  const myId = user?._id || user?.id || null
  const firstName = (user?.name || 'there').split(' ')[0]

  const [team, setTeam] = useState(null)
  const [teamTasks, setTeamTasks] = useState([])
  const [booting, setBooting] = useState(true)
  const [teamLoading, setTeamLoading] = useState(true)

  useEffect(() => {
    tasksStore.refresh().finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      api.get('/api/team').catch(() => null),
      api.get('/api/tasks/my-tasks?scope=team').catch(() => null)
    ])
      .then(([teamRes, taskRes]) => {
        if (!alive) return
        setTeam(teamRes || { members: [], totals: {} })
        setTeamTasks((taskRes?.tasks || []).map(adaptTask).filter(Boolean))
      })
      .finally(() => { if (alive) setTeamLoading(false) })
    return () => { alive = false }
  }, [])

  // Waiting on me: assigned to me, or a committee vote I am one of, and not yet
  // decided. Committee tasks name a single representative in `assignedTo`, so
  // matching on that alone would hide them from every other voter.
  const queue = useMemo(() => {
    const isMine = (t) =>
      t.assignedToId === myId ||
      (t.isMultiApproval && (t.parallelApprovers || []).some((p) => p.id === myId))
    return myTasks
      .filter((t) => OPEN.includes(t.status) && isMine(t))
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  }, [myTasks, myId])

  const overdue = useMemo(() => queue.filter((t) => t.slaBreached), [queue])

  const myOpenRequests = useMemo(
    () => myTasks.filter((t) => t.submittedById === myId && OPEN.includes(t.status)),
    [myTasks, myId]
  )

  const decided = useMemo(
    () => myTasks
      .filter((t) => t.assignedToId === myId && ['Approved', 'Rejected'].includes(t.status))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [myTasks, myId]
  )

  const teamOpen = useMemo(() => teamTasks.filter((t) => OPEN.includes(t.status)), [teamTasks])

  const oldest = queue[0]

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = today.getHours()
  const greetingText = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell
      title="Dashboard"
      mainClass="flex-1 p-4 md:p-6 pb-24 md:pb-6 space-y-5 overflow-y-auto bg-[#e2e8f0] dark:bg-slate-900"
    >
      <div className="space-y-5">
        {/* ── 1. Header Bar ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A2340] dark:text-white tracking-tight">
                Welcome back, {firstName}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#eef2ff] text-[#4f46e5] border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs">
                Manager
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 mt-2 leading-relaxed bg-slate-100/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 inline-block shadow-2xs">
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{greetingText} · {dateStr}</span> — {user?.department || 'Department'} overview — here's what's happening in your department.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {booting && myTasks.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                icon={IconInbox}
                tone="indigo"
                label="Waiting on you"
                value={queue.length}
                hint={oldest ? `oldest ${waitingFor(oldest)}` : 'queue is clear'}
                onClick={() => navigate('/tasks?scope=assigned&filter=Pending')}
              />
              <StatCard
                icon={IconAlert}
                tone="danger"
                label="Overdue"
                value={overdue.length}
                onClick={() => navigate('/tasks?scope=assigned&filter=SLA breached')}
              />
              <StatCard
                icon={IconCheck}
                tone="success"
                label="You decided"
                value={decided.length}
                onClick={() => navigate('/tasks?scope=assigned&filter=Approved')}
              />
              <StatCard
                icon={IconTeam}
                tone="sky"
                label="Team requests"
                value={team?.totals?.openRequests ?? 0}
                hint={`${team?.totals?.members || 0} people`}
                onClick={() => navigate('/tasks?scope=team&filter=All tasks')}
              />
              <StatCard
                icon={IconClock}
                tone="warning"
                label="Team overdue"
                value={team?.totals?.overdue ?? 0}
                onClick={() => navigate('/tasks?scope=team&filter=SLA breached')}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <DecisionQueue tasks={queue} loading={booting} />
          <TeamLoad team={team} loading={teamLoading} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <TeamRequests tasks={teamOpen} loading={teamLoading} />
          <RecentDecisions tasks={decided} />
        </div>
      </div>
    </AppShell>
  )
}

function IconInbox(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6l3.5-7z" /></svg> }
function IconAlert(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg> }
function IconCheck(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function IconClock(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function IconTeam(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 20c0-2.8 3.1-4.5 7-4.5s7 1.7 7 4.5M16 5.5a3 3 0 010 5.8M18 20c0-2 .8-3.3 4-4" /></svg> }

export default OpsDashboard

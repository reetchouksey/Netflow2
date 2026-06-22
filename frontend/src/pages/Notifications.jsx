// M3 - Phase 2 - Notifications.jsx - Full notifications inbox

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useNotifications, notificationsStore } from '../lib/notificationsStore'

const FILTERS = [
  { value: 'all',    label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read',   label: 'Read' }
]

function Notifications() {
  const navigate = useNavigate()
  const items = useNotifications()
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.read)
    if (filter === 'read')   return items.filter((n) => n.read)
    return items
  }, [items, filter])

  const unreadCount = items.filter((n) => !n.read).length

  const handleClick = async (n) => {
    if (!n.read) await notificationsStore.markRead(n.id).catch(() => {})
    if (n.taskId) navigate(`/tasks/${n.taskId}`)
  }

  const handleMarkAll = async () => {
    setBusy(true)
    await notificationsStore.markAllRead().catch(() => {})
    setBusy(false)
  }

  const subtitle = (
    <span className="flex items-center gap-2">
      <span>{items.length} {items.length === 1 ? 'notification' : 'notifications'}</span>
      {unreadCount > 0 && (
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
          {unreadCount} unread
        </span>
      )}
    </span>
  )

  const actions = (
    <>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="text-sm px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
      >
        {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <button
        onClick={handleMarkAll}
        disabled={busy || unreadCount === 0}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition"
      >
        {busy ? 'Marking...' : 'Mark all read'}
      </button>
    </>
  )

  return (
    <AppShell title="Notifications" subtitle={subtitle} actions={actions}>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-gray-400">
                No notifications to show.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filtered.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`px-5 py-4 flex items-start gap-3 cursor-pointer transition ${
                      n.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full shrink-0 ${n.dotColor}`} />
                    <div className="flex-1 min-w-0">
                      {n.title && (
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${n.read ? 'text-gray-400' : 'text-gray-600'}`}>
                          {n.title}
                        </p>
                      )}
                      <p className={`text-sm ${n.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0" />}
                  </li>
                ))}
              </ul>
            )}
      </div>
    </AppShell>
  )
}

export default Notifications

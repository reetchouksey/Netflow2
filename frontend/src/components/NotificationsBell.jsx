// M3 - Phase 2 - NotificationsBell.jsx - Live API + 30s polling

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsStore, useNotifications } from '../lib/notificationsStore'

function NotificationsBell() {
  const navigate = useNavigate()
  const items = useNotifications()
  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const wrapRef = useRef(null)

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onNotificationClick = async (n) => {
    if (!n.read) {
      try { await notificationsStore.markRead(n.id) } catch { /* ignore */ }
    }
    if (n.taskId) {
      setOpen(false)
      navigate(`/tasks/${n.taskId}`)
    }
  }

  const onMarkAll = async () => {
    setMarking(true)
    try { await notificationsStore.markAllRead() } catch { /* ignore */ }
    setMarking(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative w-9 h-9 rounded-md flex items-center justify-center text-gray-500 transition ${
          open ? 'bg-gray-100' : 'hover:bg-gray-100'
        }`}
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

      {open && (
        <div className="absolute right-0 mt-2 w-[26rem] max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-xl z-40 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">All notifications</h3>
            {unreadCount > 0 ? (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {unreadCount} unread
              </span>
            ) : (
              <span className="text-xs font-medium text-gray-400">All caught up</span>
            )}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">
                You have no notifications.
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => onNotificationClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer transition ${
                    n.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full shrink-0 mt-0.5 ${n.dotColor}`} />
                  <div className="flex-1 min-w-0">
                    {n.title && (
                      <p className={`text-xs font-semibold uppercase tracking-wide ${n.read ? 'text-gray-400' : 'text-gray-600'}`}>
                        {n.title}
                      </p>
                    )}
                    <p className={`text-sm leading-snug ${n.read ? 'text-gray-600' : 'text-gray-800 font-medium'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </li>
              ))
            )}
          </ul>

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <button
                onClick={onMarkAll}
                disabled={unreadCount === 0 || marking}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:text-gray-300 disabled:cursor-not-allowed transition"
              >
                {marking ? 'Marking...' : 'Mark all as read'}
              </button>
              <button
                onClick={() => { setOpen(false); navigate('/notifications') }}
                className="text-xs font-medium text-gray-500 hover:text-indigo-600 transition"
              >
                View all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationsBell

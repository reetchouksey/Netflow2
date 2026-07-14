// M3 - Phase 2 - notificationsStore.js
// API-backed notifications with 30s polling. Same hook surface as Phase 1.

import { useEffect, useSyncExternalStore } from 'react'
import { api } from '../utils/api'
import { adaptNotification } from '../utils/adapters'

let cache = []
let unreadCount = 0
let lastFetchedAt = 0
let inflight = null
const listeners = new Set()
const emit = () => { for (const l of listeners) l() }

const fetchAll = async () => {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const data = await api.get('/api/notifications')
      cache = (data.notifications || []).map(adaptNotification)
      unreadCount = data.unreadCount ?? cache.filter((n) => !n.read).length
      lastFetchedAt = Date.now()
      emit()
      return cache
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export const notificationsStore = {
  subscribe(listener) {
    listeners.add(listener)
    if (Date.now() - lastFetchedAt > 30000) fetchAll().catch(() => {})
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return cache
  },
  getUnreadCount() {
    return unreadCount
  },
  async refresh() {
    return fetchAll()
  },
  async markRead(id) {
    await api.patch(`/api/notifications/${id}/read`)
    cache = cache.map((n) => (n.id === id ? { ...n, read: true } : n))
    unreadCount = cache.filter((n) => !n.read).length
    emit()
  },
  async markAllRead() {
    await api.patch('/api/notifications/mark-all-read')
    cache = cache.map((n) => ({ ...n, read: true }))
    unreadCount = 0
    emit()
  },
  async remove(id) {
    await api.delete(`/api/notifications/${id}`)
    cache = cache.filter((n) => n.id !== id)
    unreadCount = cache.filter((n) => !n.read).length
    emit()
  },
  clear() {
    cache = []
    unreadCount = 0
    lastFetchedAt = 0
    emit()
  }
}

export function useNotifications() {
  const snapshot = useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.getSnapshot,
    notificationsStore.getSnapshot
  )
  useEffect(() => {
    if (Date.now() - lastFetchedAt > 5000) fetchAll().catch(() => {})
    const id = setInterval(() => fetchAll().catch(() => {}), 30000)
    return () => clearInterval(id)
  }, [])
  return snapshot
}

export function useUnreadCount() {
  useNotifications()
  return unreadCount
}

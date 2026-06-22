// M1 - Phase 2 - utils/auth.js
// Auth state: who's logged in. Subscribed by Sidebar + route guards.

import { useSyncExternalStore } from 'react'
import {
  api,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser
} from './api'

let currentUser = getStoredUser()
const listeners = new Set()
const emit = () => { for (const l of listeners) l() }

export const authStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return currentUser
  },
  async login(email, password) {
    const data = await api.post('/api/auth/login', { email, password }, { skipAuthRedirect: true })
    setToken(data.token)
    setStoredUser(data.user)
    currentUser = data.user
    emit()
    return data.user
  },
  async register(payload) {
    const data = await api.post('/api/auth/register', payload, { skipAuthRedirect: true })
    setToken(data.token)
    setStoredUser(data.user)
    currentUser = data.user
    emit()
    return data.user
  },
  async logout() {
    try { await api.post('/api/auth/logout') } catch { /* ignore */ }
    clearToken()
    currentUser = null
    emit()
  },
  async refresh() {
    try {
      const data = await api.get('/api/auth/me', { skipAuthRedirect: true })
      setStoredUser(data.user)
      currentUser = data.user
      emit()
      return data.user
    } catch {
      clearToken()
      currentUser = null
      emit()
      return null
    }
  }
}

export function useUser() {
  return useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getSnapshot
  )
}

export const initials = (name) => {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const ROLE_LABELS = {
  Admin: 'Workflow Admin',
  Manager: 'Manager',
  HR: 'HR',
  VP: 'VP',
  CEO: 'CEO',
  Employee: 'Employee',
  Viewer: 'Viewer',
  'Receiving Staff':   'Receiving Staff',
  'Warehouse Manager': 'Warehouse Manager',
  'Accounts Officer':  'Accounts Officer',
  'Brand Rep':         'Brand Rep',
  'Finance Approver':  'Finance Approver',
}

export const DEPARTMENTS = ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Legal', 'Warehouse', 'Accounts']

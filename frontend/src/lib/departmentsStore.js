// Shell 2 - lib/departmentsStore.js
// The tenant's department list, shared by every picker and filter in the app.
//
// It used to be a hard-coded array in utils/auth.js, which quietly drifted from
// the server's list — the UI offered "Warehouse" and the API rejected it. One
// fetch, one cache, one source of truth: whatever /api/departments returns.

import { useEffect, useSyncExternalStore } from 'react'
import { api, getToken } from '../utils/api'

const STORAGE_KEY = 'netflow_departments_cache'
let state = { departments: [], orphans: [], loading: false, error: '' }
try {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored)
    if (parsed && Array.isArray(parsed.departments)) {
      state = { ...state, ...parsed, loading: false }
    }
  }
} catch (_) {}

let lastFetchedAt = 0
let inflight = null
let cacheToken = null

const listeners = new Set()
const emit = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      departments: state.departments,
      orphans: state.orphans
    }))
  } catch (_) {}
  for (const l of listeners) l()
}
const setState = (patch) => { state = { ...state, ...patch }; emit() }

const STALE_MS = 5 * 60 * 1000
const isStale = () => cacheToken !== getToken() || Date.now() - lastFetchedAt > STALE_MS

const fetchAll = async () => {
  if (inflight) return inflight
  if (!getToken()) {
    setState({ loading: false })
    return null
  }
  inflight = (async () => {
    try {
      const data = await api.get('/api/departments')
      lastFetchedAt = Date.now()
      cacheToken = getToken()
      setState({
        departments: data.departments || [],
        orphans: data.orphans || [],
        loading: false,
        error: ''
      })
      return state
    } catch (err) {
      setState({ loading: false, error: err?.message || 'Could not load departments' })
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export const departmentsStore = {
  subscribe(listener) {
    listeners.add(listener)
    if (isStale()) fetchAll().catch(() => {})
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },
  refresh() {
    lastFetchedAt = 0
    return fetchAll()
  },
  async create(name) {
    const data = await api.post('/api/departments', { name })
    applyList(data)
    return data
  },
  async rename(from, to) {
    const data = await api.put(`/api/departments/${encodeURIComponent(from)}`, { name: to })
    applyList(data)
    return data
  },
  async remove(name) {
    const data = await api.delete(`/api/departments/${encodeURIComponent(name)}`)
    applyList(data)
    return data
  },
  clear() {
    state = { departments: [], orphans: [], loading: true, error: '' }
    lastFetchedAt = 0
    cacheToken = null
    emit()
  }
}

const applyList = (data) => {
  if (!data?.departments) return
  lastFetchedAt = Date.now()
  cacheToken = getToken()
  setState({ departments: data.departments, orphans: data.orphans || [], loading: false, error: '' })
}

// `{ departments: [{ name, members }], orphans, loading, error }`
export function useDepartmentsState() {
  const snapshot = useSyncExternalStore(
    departmentsStore.subscribe,
    departmentsStore.getSnapshot,
    departmentsStore.getSnapshot
  )
  useEffect(() => { if (isStale()) fetchAll().catch(() => {}) }, [])
  return snapshot
}

// Just the names, for a <select>. Includes any department people are already in
// but that is no longer on the list, so editing such a user does not silently
// move them somewhere else.
export function useDepartmentNames() {
  const { departments, orphans } = useDepartmentsState()
  return [...departments.map((d) => d.name), ...orphans.map((o) => o.name)]
}

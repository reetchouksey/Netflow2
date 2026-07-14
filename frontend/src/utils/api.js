// M3 - Phase 2 - utils/api.js
// Shared fetch wrapper. Injects the JWT, parses { success, error, code }
// envelopes, and on 401 clears the token + bounces to /login.

const BASE = import.meta.env.VITE_API_URL ;

// Exposed so components can turn a relative attachment URL ("/uploads/x.pdf")
// returned by the API into an absolute, openable link.
export const API_BASE = BASE
export const toAbsoluteUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

const TOKEN_KEY = 'flowsphere_token'
const USER_KEY = 'flowsphere_user'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (token) => {
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* noop */ }
}
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch { /* noop */ }
}

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
export const setStoredUser = (user) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch { /* noop */ }
}

export class ApiError extends Error {
  constructor(message, code, status, data) {
    super(message)
    this.code = code
    this.status = status
    this.data = data || {}
    this.name = 'ApiError'
  }
}

const request = async (method, endpoint, body, opts = {}) => {
  const token = getToken()
  const headers = { ...(opts.headers || {}) }
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const fetchOpts = { method, headers }
  if (body !== undefined) {
    fetchOpts.body = body instanceof FormData ? body : JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${BASE}${endpoint}`, fetchOpts)
  } catch (err) {
    throw new ApiError('Network error - is the API server running?', 'NETWORK', 0)
  }

  let data = {}
  const text = await response.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = { error: text } }
  }

  if (!response.ok) {
    const code = data.code || `HTTP_${response.status}`
    const message = data.error || `Request failed: ${response.status}`

    // Token expired / missing - kick to /login (unless we're already there)
    if (response.status === 401 && code !== 'INVALID_CREDENTIALS' && !opts.skipAuthRedirect) {
      clearToken()
      if (typeof window !== 'undefined') {
        const p = window.location.pathname
        if (p !== '/login' && p !== '/register') {
          window.location.href = '/login'
        }
      }
    }
    throw new ApiError(message, code, response.status, data)
  }

  return data
}

export const api = {
  get:    (e, opts)      => request('GET', e, undefined, opts),
  post:   (e, body, opts) => request('POST', e, body, opts),
  put:    (e, body, opts) => request('PUT', e, body, opts),
  patch:  (e, body, opts) => request('PATCH', e, body, opts),
  delete: (e, opts)      => request('DELETE', e, undefined, opts),
  // Multipart upload. Returns { file: { name, url, mime, size } }.
  // `maxMb` (optional) is forwarded so the server can enforce the field's
  // per-field size limit (capped server-side at the global ceiling).
  upload: (file, maxMb, opts) => {
    const fd = new FormData()
    fd.append('file', file)
    const q = maxMb ? `?maxMb=${encodeURIComponent(maxMb)}` : ''
    return request('POST', `/api/uploads${q}`, fd, opts)
  }
}

export const buildQuery = (params = {}) => {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

// M3 - Phase 2 - utils/api.js
// Shared fetch wrapper. Injects the JWT, parses { success, error, code }
// envelopes, and on 401 clears the token + bounces to /login.

// Base URL of the NetFlow API. Defaults to the deployed Render backend so the
// production build (Vercel) works without a dashboard env var. Override with
// VITE_API_URL (e.g. http://localhost:5000) for local development.
const BASE = String(import.meta.env.VITE_API_URL || 'http://localhost:5000').trim().replace(/\/+$/, '')

// Exposed so components can turn a relative attachment URL ("/uploads/x.pdf")
// returned by the API into an absolute, openable link.
export const API_BASE = BASE

export const buildUrl = (endpoint) => {
  const cleanEp = String(endpoint || '').startsWith('/') ? endpoint : `/${endpoint}`
  return `${BASE}${cleanEp}`.replace(/([^:])\/{2,}/g, '$1/')
}

export const toAbsoluteUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return buildUrl(url)
}

/** BaseLayer DMS web UI (optional). Used for "Open in DMS" links. */
export const DMS_WEB_URL = String(import.meta.env.VITE_DMS_WEB_URL || 'https://base-layer.systems').replace(/\/$/, '')

export const dmsWebUrl = (dmsDocId) =>
  (DMS_WEB_URL && dmsDocId) ? `${DMS_WEB_URL}/documents/${encodeURIComponent(dmsDocId)}` : ''

/**
 * Resolve a viewable href for an attachment. When `dmsDocId` is present, asks
 * NetFlow for a fresh signed URL (R2 TTL ~5 min). Falls back to stored url.
 */
export const resolveAttachmentHref = async (file, { mode = 'view' } = {}) => {
  if (!file) return ''
  if (file.dmsDocId) {
    try {
      const q = mode === 'download' ? '?mode=download' : ''
      const res = await request('GET', `/api/uploads/${encodeURIComponent(file.dmsDocId)}/url${q}`)
      if (res?.url) return toAbsoluteUrl(res.url)
    } catch {
      /* fall through */
    }
  }
  return toAbsoluteUrl(file.url || '')
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

// In-memory cache and promise deduplication for instant zero-latency page transitions
const responseCache = new Map()
const inflightGetRequests = new Map()
const DEFAULT_CACHE_TTL = 15000 // 15 seconds

export const clearApiCache = () => {
  responseCache.clear()
  inflightGetRequests.clear()
}

export const invalidateApiCache = (pattern) => {
  if (!pattern) {
    responseCache.clear()
    return
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) responseCache.delete(key)
  }
}

const request = async (method, endpoint, body, opts = {}) => {
  const token = getToken()
  const headers = { ...(opts.headers || {}) }
  if (body instanceof FormData) {
    // When sending FormData, delete manual Content-Type for browser boundary
    delete headers['Content-Type']
    delete headers['content-type']
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const fetchOpts = { method, headers }
  if (body !== undefined) {
    fetchOpts.body = body instanceof FormData ? body : JSON.stringify(body)
  }

  const executeFetch = async () => {
    let response
    try {
      response = await fetch(buildUrl(endpoint), fetchOpts)
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
      if (response.status === 401 && code !== 'INVALID_CREDENTIALS' && code !== 'DMS_UNAUTHORIZED' && !opts.skipAuthRedirect) {
        clearToken()
        clearApiCache()
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

  // Instant In-Memory Cache & In-Flight Deduplication for GET requests
  if (method === 'GET' && !opts.noCache) {
    const cacheKey = `${token || 'anon'}:${endpoint}`
    const cached = responseCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp < (opts.ttl || DEFAULT_CACHE_TTL))) {
      return cached.data
    }

    if (inflightGetRequests.has(cacheKey)) {
      return inflightGetRequests.get(cacheKey)
    }

    const getPromise = (async () => {
      try {
        const resData = await executeFetch()
        responseCache.set(cacheKey, { data: resData, timestamp: Date.now() })
        return resData
      } finally {
        inflightGetRequests.delete(cacheKey)
      }
    })()

    inflightGetRequests.set(cacheKey, getPromise)
    return getPromise
  }

  // Invalidate cache on mutations
  if (method !== 'GET') {
    responseCache.clear()
  }

  return executeFetch()
}

// fetch() can't report upload progress, so multipart uploads go through XHR
// when the caller wants a percentage. `onProgress` receives 0-100, or null when
// the browser can't compute a total (chunked / unknown length).
export const uploadWithProgress = (endpoint, formData, { onProgress, headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl(endpoint))
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return
      onProgress(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : null)
    }
    xhr.onerror = () => reject(new ApiError('Network error - is the API server running?', 'NETWORK', 0))
    xhr.onabort = () => reject(new ApiError('Upload cancelled', 'ABORTED', 0))
    xhr.onload = () => {
      let data = {}
      if (xhr.responseText) {
        try { data = JSON.parse(xhr.responseText) } catch { data = { error: xhr.responseText } }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
        return
      }
      reject(new ApiError(
        data.error || `Upload failed: ${xhr.status}`,
        data.code || `HTTP_${xhr.status}`,
        xhr.status,
        data
      ))
    }
    xhr.send(formData)
  })

export const api = {
  get:    (e, opts)      => request('GET', e, undefined, opts),
  post:   (e, body, opts) => request('POST', e, body, opts),
  put:    (e, body, opts) => request('PUT', e, body, opts),
  patch:  (e, body, opts) => request('PATCH', e, body, opts),
  delete: (e, opts)      => request('DELETE', e, undefined, opts),
  // Multipart upload. Returns { file: { name, url, mime, size } }.
  // `maxMb` (optional) is forwarded so the server can enforce the field's
  // per-field size limit (capped server-side at the global ceiling).
  // Pass `onProgress` to get a 0-100 percentage while the bytes go up.
  upload: (file, maxMb, opts = {}) => {
    const fd = new FormData()
    fd.append('file', file)
    const q = maxMb ? `?maxMb=${encodeURIComponent(maxMb)}` : ''
    if (opts.onProgress) {
      return uploadWithProgress(`/api/uploads${q}`, fd, opts)
    }
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

// utils/webhook.js
// Outbound HTTP for the workflow "api" (integration/webhook) node. Uses the
// global fetch shipped with Node 18+ (no extra dependency). Three concerns:
//   1. interpolate() - fill {{formData.x}} placeholders from execution variables
//   2. isSafeUrl()   - block SSRF (private/loopback targets) unless explicitly allowed
//   3. callWebhook()  - do the request with retries, timeout, normalised result

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Resolve a dotted path ("submitter.email") against a plain object.
const getPath = (obj, path) => {
  if (!obj || !path) return undefined
  return String(path).split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return acc[key]
  }, obj)
}

const interpolate = (template, variables) => {
  if (template === null || template === undefined) return ''
  return String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const value = getPath(variables || {}, path)
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      try { return JSON.stringify(value) } catch { return '' }
    }
    return String(value)
  })
}

const allowPrivate = () => String(process.env.WEBHOOK_ALLOW_PRIVATE || '').toLowerCase() === 'true'

const isPrivateHost = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 127 || a === 0 || a === 10) return true
    if (a === 169 && b === 254) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
  }
  return false
}

const isSafeUrl = (rawUrl) => {
  let url
  try {
    url = new URL(String(rawUrl))
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }
  const dev = allowPrivate()
  if (url.protocol !== 'https:' && !(dev && url.protocol === 'http:')) {
    return { ok: false, reason: 'Only https:// URLs are allowed' }
  }
  if (!dev && isPrivateHost(url.hostname)) {
    return { ok: false, reason: 'URL points to a private or loopback address' }
  }
  return { ok: true }
}

const normaliseHeaders = (headers) => {
  const out = {}
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && h.key) out[String(h.key)] = String(h.value ?? '')
    }
  } else if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) out[k] = String(v ?? '')
  }
  return out
}

const { resolveSecret, resolveHeadersSecrets } = require('./secrets')

const applyAuth = (headers, auth) => {
  if (!auth || !auth.mode || auth.mode === 'none') return headers
  if (auth.mode === 'bearer' && auth.token) {
    headers.Authorization = `Bearer ${resolveSecret(auth.token)}`
  } else if (auth.mode === 'basic' && (auth.username || auth.password)) {
    const user = resolveSecret(auth.username || '')
    const pass = resolveSecret(auth.password || '')
    const encoded = Buffer.from(`${user}:${pass}`).toString('base64')
    headers.Authorization = `Basic ${encoded}`
  }
  return headers
}

const shouldRetryStatus = (status, attempt, maxAttempts) => {
  if (status === 429 && attempt < maxAttempts) return true
  return status === 502 || status === 503 || status === 504
}

const once = async ({ url, method, headers, body, timeoutMs }) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    })
    const text = await res.text()
    let data = text
    try { data = text ? JSON.parse(text) : null } catch { /* keep raw text */ }
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Perform the request with retries. Returns { ok, status, data, attempts }.
// Throws only when every attempt fails with a network/timeout error.
const callWebhook = async ({
  url,
  method = 'POST',
  headers,
  body,
  auth,
  timeoutMs = 10000,
  retries = 3
}) => {
  const finalHeaders = applyAuth(resolveHeadersSecrets(normaliseHeaders(headers)), auth)
  const verb = String(method || 'POST').toUpperCase()
  const sendsBody = !['GET', 'HEAD'].includes(verb) && body !== undefined && body !== null && body !== ''

  if (sendsBody && !Object.keys(finalHeaders).some((h) => h.toLowerCase() === 'content-type')) {
    finalHeaders['Content-Type'] = 'application/json'
  }

  const maxAttempts = Math.max(1, Number(retries) || 1)
  let lastNetworkErr = null
  let lastResult = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await once({
        url,
        method: verb,
        headers: finalHeaders,
        body: sendsBody ? body : undefined,
        timeoutMs
      })
      lastResult = { ...result, attempts: attempt }
      if (result.ok || !shouldRetryStatus(result.status, attempt, maxAttempts)) {
        return lastResult
      }
      await sleep(300 * (3 ** (attempt - 1)))
    } catch (err) {
      lastNetworkErr = err
      if (attempt >= maxAttempts) break
      await sleep(300 * (3 ** (attempt - 1)))
    }
  }

  if (lastResult) return lastResult

  const e = new Error(lastNetworkErr?.message || 'Request error')
  e.attempts = maxAttempts
  throw e
}

module.exports = { interpolate, isSafeUrl, callWebhook, normaliseHeaders }

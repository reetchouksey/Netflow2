// utils/webhook.js
// Outbound HTTP for the workflow "api" (integration/webhook) node. Uses the
// global fetch shipped with Node 18+ (no extra dependency). Three concerns:
//   1. interpolate() - fill {{formData.x}} placeholders from execution variables
//   2. isSafeUrl()   - block SSRF (private/loopback targets) unless explicitly allowed
//   3. callWebhook()  - do the request with a hard timeout and normalised result
//
// Kept dependency-free and side-effect-free so the engine handler stays thin and
// this file is easy to unit-test.

// Resolve a dotted path ("submitter.email") against a plain object.
const getPath = (obj, path) => {
  if (!obj || !path) return undefined
  return String(path).split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return acc[key]
  }, obj)
}

// Replace {{ path }} tokens in a template string with values pulled from
// `variables` (e.g. execution.variables). Missing values become ''. Objects are
// JSON-stringified so a whole `{{formData}}` can be embedded if desired.
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

// True when private/loopback/link-local targets are permitted (local dev). Off
// by default so production can only reach public HTTPS endpoints.
const allowPrivate = () => String(process.env.WEBHOOK_ALLOW_PRIVATE || '').toLowerCase() === 'true'

// Blocklist of hostnames / IP literals that could reach internal infrastructure.
const isPrivateHost = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true          // IPv6 loopback
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true // IPv6 ULA / link-local

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 127 || a === 0 || a === 10) return true                    // loopback / "this" / 10.0.0.0/8
    if (a === 169 && b === 254) return true                              // link-local 169.254.0.0/16
    if (a === 192 && b === 168) return true                              // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true                     // 172.16.0.0/12
  }
  return false
}

// Validate a webhook target. Returns { ok: true } or { ok: false, reason }.
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

// Normalise headers: accept either a plain object or an array of {key,value}.
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

const applyAuth = (headers, auth) => {
  if (!auth || !auth.mode || auth.mode === 'none') return headers
  if (auth.mode === 'bearer' && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`
  } else if (auth.mode === 'basic' && (auth.username || auth.password)) {
    const encoded = Buffer.from(`${auth.username || ''}:${auth.password || ''}`).toString('base64')
    headers.Authorization = `Basic ${encoded}`
  }
  return headers
}

// Perform the request. Never throws for HTTP errors — returns { ok, status, data }.
// Throws only for network/timeout failures so the caller can branch on
// continueOnError. `data` is parsed JSON when possible, otherwise raw text.
const callWebhook = async ({ url, method = 'POST', headers, body, auth, timeoutMs = 10000 }) => {
  const finalHeaders = applyAuth(normaliseHeaders(headers), auth)
  const verb = String(method || 'POST').toUpperCase()
  const sendsBody = !['GET', 'HEAD'].includes(verb) && body !== undefined && body !== null && body !== ''

  if (sendsBody && !Object.keys(finalHeaders).some((h) => h.toLowerCase() === 'content-type')) {
    finalHeaders['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: verb,
      headers: finalHeaders,
      body: sendsBody ? body : undefined,
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

module.exports = { interpolate, isSafeUrl, callWebhook, normaliseHeaders }

// AI - utils/llm.js
// Provider-aware LLM client. Supports:
//   • NVIDIA NIM    (OpenAI-compatible chat completions, integrate.api.nvidia.com)
//   • Google Gemini (Generative Language API)
// Call sites only ever use isConfigured / getModel / listModels / generateText /
// generateJSON, so the provider or model can change via env (LLM_PROVIDER,
// NVIDIA_MODEL, GEMINI_MODEL) without touching business logic. API keys are read
// from the environment — never hard-coded.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'

// Which provider to use. An explicit LLM_PROVIDER wins; otherwise auto-detect by
// whichever key is present (NVIDIA preferred).
const getProvider = () => {
  const p = (process.env.LLM_PROVIDER || '').toLowerCase()
  if (p === 'nvidia' || p === 'gemini') return p
  if (process.env.NVIDIA_API_KEY) return 'nvidia'
  return 'gemini'
}

const getApiKey = () =>
  getProvider() === 'nvidia'
    ? (process.env.NVIDIA_API_KEY || '')
    : (process.env.GEMINI_API_KEY || '')

const getModel = () =>
  getProvider() === 'nvidia'
    ? (process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct')
    : (process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite')

const isConfigured = () => Boolean(getApiKey())

// fetch with a hard timeout. Throws a descriptive Error on non-2xx so callers
// can decide whether to fall back to deterministic logic.
const httpJson = async (url, options, timeoutMs = 20000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const text = await res.text()
    let json
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = { raw: text }
    }
    if (!res.ok) {
      const err = new Error(json?.error?.message || json?.detail || json?.title || `LLM HTTP ${res.status}`)
      err.status = res.status
      err.body = json
      throw err
    }
    return json
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`LLM request timed out after ${timeoutMs}ms`)
      e.status = 504
      throw e
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ---- provider calls: each returns the raw assistant text ----
const callGemini = async ({ prompt, system, temperature, json, timeoutMs }) => {
  const key = process.env.GEMINI_API_KEY || ''
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) }
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  const url = `${GEMINI_BASE}/models/${getModel()}:generateContent?key=${encodeURIComponent(key)}`
  const out = await httpJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, timeoutMs)
  const parts = out?.candidates?.[0]?.content?.parts || []
  return parts.map((p) => p.text || '').join('').trim()
}

const callNvidia = async ({ prompt, system, temperature, json, timeoutMs }) => {
  const key = process.env.NVIDIA_API_KEY || ''
  if (!key) throw new Error('NVIDIA_API_KEY is not set')
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })
  const body = { model: getModel(), messages, temperature, max_tokens: 2048 }
  if (json) body.response_format = { type: 'json_object' }

  // Hosted NIM endpoints can cold-start and return transient 429/5xx; retry a
  // couple of times with backoff before giving up.
  const attempts = 3
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const out = await httpJson(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body)
      }, timeoutMs)
      return (out?.choices?.[0]?.message?.content || '').trim()
    } catch (err) {
      lastErr = err
      const transient = !err.status || [429, 500, 502, 503, 504].includes(err.status)
      if (!transient || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw lastErr
}

const call = (args) => (getProvider() === 'nvidia' ? callNvidia(args) : callGemini(args))

// Lists models the key can access. Doubles as a cheap key-validity check.
const listModels = async () => {
  if (getProvider() === 'nvidia') {
    const key = process.env.NVIDIA_API_KEY || ''
    if (!key) throw new Error('NVIDIA_API_KEY is not set')
    const out = await httpJson(`${NVIDIA_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}` }
    }, 15000)
    return (out.data || []).map((m) => ({ name: m.id, displayName: m.id, methods: ['chat'] }))
  }
  const key = process.env.GEMINI_API_KEY || ''
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  const out = await httpJson(`${GEMINI_BASE}/models?key=${encodeURIComponent(key)}`, {}, 15000)
  return (out.models || []).map((m) => ({
    name: m.name,
    displayName: m.displayName,
    methods: m.supportedGenerationMethods || []
  }))
}

const generateText = async (prompt, { system, temperature = 0.2, timeoutMs } = {}) =>
  call({ prompt, system, temperature, json: false, timeoutMs })

// Robust JSON extraction: handles clean JSON, ```json fences, and prose-wrapped
// JSON from any model/provider.
const parseJsonLoose = (raw) => {
  if (!raw) throw new Error('LLM returned an empty response')
  const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(stripped)
  } catch {
    // fall through to substring extraction
  }
  const start = stripped.search(/[[{]/)
  const end = Math.max(stripped.lastIndexOf('}'), stripped.lastIndexOf(']'))
  if (start !== -1 && end > start) {
    return JSON.parse(stripped.slice(start, end + 1))
  }
  throw new Error('LLM did not return valid JSON')
}

const generateJSON = async (prompt, { system, temperature = 0.1, timeoutMs } = {}) => {
  const raw = await call({ prompt, system, temperature, json: true, timeoutMs })
  return parseJsonLoose(raw)
}

module.exports = { isConfigured, getModel, listModels, generateText, generateJSON }

// AI-01 - utils/llm.js
// Thin Google Gemini (Generative Language API) client used by #01
// Approval-Routing. The call site only ever uses generateJSON / generateText,
// so the provider or model can change via env (GEMINI_MODEL) without touching
// business logic. Reads GEMINI_API_KEY from the environment — never hard-coded.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const getApiKey = () => process.env.GEMINI_API_KEY || ''
const getModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
const isConfigured = () => Boolean(getApiKey())

// Low-level request with a hard timeout. Throws a descriptive Error on non-2xx
// so callers can decide whether to fall back to deterministic logic.
const request = async (path, body, { timeoutMs = 20000 } = {}) => {
  const key = getApiKey()
  if (!key) throw new Error('GEMINI_API_KEY is not set')

  const sep = path.includes('?') ? '&' : '?'
  const url = `${GEMINI_BASE}${path}${sep}key=${encodeURIComponent(key)}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
    const text = await res.text()
    let json
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = { raw: text }
    }
    if (!res.ok) {
      const err = new Error(json?.error?.message || `Gemini HTTP ${res.status}`)
      err.status = res.status
      err.body = json
      throw err
    }
    return json
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`Gemini request timed out after ${timeoutMs}ms`)
      e.status = 504
      throw e
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Lists models the key can access. Doubles as a cheap key-validity check.
const listModels = async () => {
  const json = await request('/models', null, { timeoutMs: 15000 })
  return (json.models || []).map((m) => ({
    name: m.name,
    displayName: m.displayName,
    methods: m.supportedGenerationMethods || []
  }))
}

const extractText = (json) => {
  const parts = json?.candidates?.[0]?.content?.parts || []
  return parts.map((p) => p.text || '').join('').trim()
}

const generateText = async (prompt, { system, temperature = 0.2, timeoutMs } = {}) => {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature }
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  const json = await request(`/models/${getModel()}:generateContent`, body, { timeoutMs })
  return extractText(json)
}

// Generates JSON. responseMimeType forces a JSON body from Gemini 1.5+, but we
// still strip stray markdown fences before parsing to be safe.
const generateJSON = async (prompt, { system, temperature = 0.1, timeoutMs } = {}) => {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, responseMimeType: 'application/json' }
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  const json = await request(`/models/${getModel()}:generateContent`, body, { timeoutMs })
  let raw = extractText(json)
  raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  if (!raw) throw new Error('Gemini returned an empty response')
  return JSON.parse(raw)
}

module.exports = { isConfigured, getModel, listModels, generateText, generateJSON }

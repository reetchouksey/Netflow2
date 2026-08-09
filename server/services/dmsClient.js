// BaseLayer DMS client — NetFlow → DMS document pipeline.
// When DMS_ENABLED !== 'true', every method no-ops (returns null) so local
// /uploads behaviour stays unchanged for pure local development.

const fs = require('fs')
const path = require('path')

const isEnabled = () => String(process.env.DMS_ENABLED || '').toLowerCase() === 'true'

const baseUrl = () => String(process.env.DMS_API_URL || '').replace(/\/$/, '')

// Finds the per-department DMS config entry for a given department name.
// Returns null when no entry exists or the department is disabled.
const resolveDeptConfig = (org, department) => {
  if (!department || !org?.integrations?.departmentDms?.length) return null
  const wanted = String(department).toLowerCase().trim()
  const entry = org.integrations.departmentDms.find(
    (d) => String(d.department || '').toLowerCase().trim() === wanted
  )
  // disabled entries are treated as non-existent for routing purposes
  if (!entry || entry.enabled === false) return null
  return entry
}

// Resolves the DMS API key for a given org + department.
// Priority: department key → org key → platform env key.
const resolveApiKey = (org, department) => {
  // 1. Department-level key
  if (department) {
    const deptCfg = resolveDeptConfig(org, department)
    if (deptCfg?.apiKey && String(deptCfg.apiKey).trim()) return String(deptCfg.apiKey).trim()
  }
  // 2. Org-level key
  const fromOrg = org?.integrations?.dmsApiKey || org?.dmsApiKey
  if (fromOrg && String(fromOrg).trim()) return String(fromOrg).trim()
  // 3. Platform env key
  return String(process.env.DMS_API_KEY || '').trim()
}

// Resolves the DMS base URL for a given org + department.
// A department may point to a completely different DMS server.
// Priority: department baseUrl → global DMS_API_URL env var.
const resolveBaseUrl = (org, department) => {
  if (department) {
    const deptCfg = resolveDeptConfig(org, department)
    if (deptCfg?.baseUrl && String(deptCfg.baseUrl).trim()) {
      return String(deptCfg.baseUrl).trim().replace(/\/$/, '')
    }
  }
  return baseUrl()
}

// Builds the DMS folder path: "<orgSlug>/<department>"
// orgSlug = org.integrations.dmsOrgSlug if set, else org.subdomain
// department is lowercased and sanitised to a safe folder name.
const buildDmsFolder = (orgSlug, department) => {
  if (!orgSlug) return null
  const slug = String(orgSlug).toLowerCase().trim()
  if (!department) return slug
  const dept = String(department).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-')
  return `${slug}/${dept}`
}

class DmsError extends Error {
  constructor(message, { status = 0, code = 'DMS_ERROR', body = null } = {}) {
    super(message)
    this.name = 'DmsError'
    this.status = status
    this.code = code
    this.body = body
  }
}

const withTimeout = async (ms, fn) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fn(controller.signal)
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new DmsError(`DMS request timed out after ${ms}ms`, { status: 504, code: 'DMS_TIMEOUT' })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const parseJsonSafe = async (res) => {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

async function dmsFetch(pathname, {
  method = 'GET',
  headers = {},
  body,
  apiKey,
  rootUrl,   // department-specific DMS server URL override
  user,
  timeoutMs = 5000,
  formData = false,
  quiet = false,
} = {}) {
  if (!isEnabled()) return null

  const root = rootUrl || baseUrl()
  if (!root) throw new DmsError('DMS_API_URL is not configured', { code: 'DMS_MISCONFIGURED' })
  const key = apiKey || resolveApiKey()
  if (!key) throw new DmsError('DMS_API_KEY is not configured', { code: 'DMS_MISCONFIGURED' })

  const url = `${root}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  const hdrs = { ...headers, 'X-Api-Key': key }
  if (process.env.DMS_JWT) hdrs['Authorization'] = `Bearer ${process.env.DMS_JWT}`
  if (user?.name) hdrs['X-On-Behalf-Of'] = String(user.name)
  if (user?.email) hdrs['X-On-Behalf-Of-Email'] = String(user.email)

  const started = Date.now()
  const res = await withTimeout(timeoutMs, (signal) =>
    fetch(url, { method, headers: hdrs, body, signal })
  )
  const json = await parseJsonSafe(res)
  const ms = Date.now() - started

  if (process.env.DMS_DEBUG === '1') {
    console.debug(`[dms] ${method} ${pathname} → ${res.status} (${ms}ms)`)
  }

  if (!res.ok) {
    const code = json.code || json.error?.code || `DMS_HTTP_${res.status}`
    const message = json.error || json.message || json.detail || `DMS HTTP ${res.status}`
    if (!quiet) console.warn(`[dms] ${method} ${pathname} failed`, res.status, code, message)
    throw new DmsError(message, { status: res.status, code, body: json })
  }

  return json
}

/**
 * Lightweight connectivity check — calls GET /health on the DMS API.
 * Returns true on 2xx, false on any error. Never throws.
 * @param {object} [opts]
 * @param {object} [opts.org] - for per-org API key
 */
async function ping({ org } = {}) {
  if (!isEnabled()) return false
  try {
    await dmsFetch('/health', { apiKey: resolveApiKey(org), timeoutMs: 3000, quiet: true })
    return true
  } catch {
    return false
  }
}

/**
 * @param {object} opts
 * @param {string} opts.filePath
 * @param {string} opts.filename
 * @param {string} [opts.mime]
 * @param {object} [opts.user]
 * @param {object} [opts.ref] - taskId, formResponseId, workflowId, id
 * @param {object} [opts.org] - for per-org API key
 * @param {string} [opts.department] - user's department (e.g. 'hr', 'finance')
 * @param {string} [opts.orgSubdomain] - org subdomain used as DMS folder root
 */
async function uploadFile({ filePath, filename, mime, user, ref = {}, org, department, orgSubdomain } = {}) {
  if (!isEnabled()) return null

  // Resolve department-specific DMS credentials first, then fall back to org/env.
  const deptApiKey  = resolveApiKey(org, department)
  const deptRootUrl = resolveBaseUrl(org, department)

  const buf = await fs.promises.readFile(filePath)
  const blob = new Blob([buf], { type: mime || 'application/octet-stream' })
  const fd = new FormData()
  fd.append('file', blob, filename || path.basename(filePath))
  // Department-based folder routing: tells DMS which sub-folder to store the
  // file in, e.g. "acme/hr". The folder is also embedded in sourceRef so the
  // DMS side can enforce the same layout independently.
  const dmsOrgSlug = org?.integrations?.dmsOrgSlug || orgSubdomain || null
  const dmsFolder = buildDmsFolder(dmsOrgSlug, department)

  fd.append('sourceRef', JSON.stringify({
    app: 'netflow',
    ...(department ? { department: String(department).toLowerCase().trim() } : {}),
    ...(dmsOrgSlug ? { orgSlug: dmsOrgSlug } : {}),
    ...(ref.taskId ? { taskId: String(ref.taskId) } : {}),
    ...(ref.formResponseId ? { formResponseId: String(ref.formResponseId) } : {}),
    ...(ref.workflowId ? { workflowId: String(ref.workflowId) } : {}),
    ...(ref.id ? { id: String(ref.id) } : {}),
  }))

  // Some DMS implementations route by a top-level "folder" field.
  if (dmsFolder) fd.append('folder', dmsFolder)

  const json = await dmsFetch('/documents/upload', {
    method: 'POST',
    body: fd,
    formData: true,
    apiKey: deptApiKey,       // department-specific or org fallback
    rootUrl: deptRootUrl,     // department-specific server or global URL
    user,
    timeoutMs: 10000,
  })

  const doc = json.document || json.data?.document || json
  const id = doc.id || doc._id || doc.dmsDocId
  if (!id) {
    throw new DmsError('DMS upload returned no document id', { code: 'DMS_EMPTY', body: json })
  }

  let viewUrl = null
  try {
    viewUrl = await signedUrl(id, { mode: 'view', org, user })
  } catch {
    viewUrl = null
  }

  return {
    id: String(id),
    name: doc.name || filename,
    mime: doc.mime || mime || 'application/octet-stream',
    size: doc.size != null ? Number(doc.size) : buf.length,
    type: doc.type || null,
    channel: doc.channel || null,
    externalRef: doc.externalRef || null,
    folder: doc.folder || dmsFolder || null,  // ← department-based folder path
    url: viewUrl,
    duplicateOf: json.duplicateOf || null,
    extraction: json.extraction || null,
  }
}

async function signedUrl(dmsDocId, { mode = 'view', org, user } = {}) {
  if (!isEnabled() || !dmsDocId) return null

  const q = mode === 'download' ? 'mode=download' : 'mode=view'
  const json = await dmsFetch(`/documents/${encodeURIComponent(dmsDocId)}/url?${q}`, {
    apiKey: resolveApiKey(org),
    user,
    timeoutMs: 5000,
  })

  const url = json.url || json.data?.url || null
  const signed = json.signed !== false
  if (url && signed) return String(url)

  const root = baseUrl()
  const suffix = mode === 'download' ? '?download=1' : ''
  return `${root}/documents/${encodeURIComponent(dmsDocId)}/file${suffix}`
}

async function getDoc(dmsDocId, { org, user } = {}) {
  if (!isEnabled() || !dmsDocId) return null
  return dmsFetch(`/documents/${encodeURIComponent(dmsDocId)}`, {
    apiKey: resolveApiKey(org),
    user,
  })
}

async function findByRef({ taskId, formResponseId, workflowId, id } = {}, { org, user } = {}) {
  if (!isEnabled()) return null
  const usp = new URLSearchParams({ app: 'netflow' })
  if (taskId) usp.set('taskId', String(taskId))
  if (formResponseId) usp.set('formResponseId', String(formResponseId))
  if (workflowId) usp.set('workflowId', String(workflowId))
  if (id) usp.set('id', String(id))
  if ([...usp.keys()].length <= 1) return null

  try {
    const json = await dmsFetch(`/documents/by-external-ref?${usp}`, {
      apiKey: resolveApiKey(org),
      user,
    })
    return json.document || json.data?.document || json || null
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

async function postEvent(dmsDocId, { type, actor, detail, meta } = {}, { org } = {}) {
  if (!isEnabled() || !dmsDocId || !type) return null

  const actorPayload = actor && typeof actor === 'object'
    ? {
        id: actor._id ? String(actor._id) : actor.id || undefined,
        name: actor.name || undefined,
        email: actor.email || undefined,
      }
    : actor

  return dmsFetch(`/documents/${encodeURIComponent(dmsDocId)}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      actor: actorPayload,
      detail: detail || undefined,
      meta: meta || undefined,
    }),
    apiKey: resolveApiKey(org),
    user: typeof actor === 'object' ? actor : undefined,
    timeoutMs: 5000,
  })
}

const MB = 1024 * 1024

/** Normalize assorted DMS usage/quota payloads into bytes. */
const parseUsagePayload = (json) => {
  if (!json || typeof json !== 'object') return null
  const root = json.data || json.usage || json.stats || json
  const storage =
    root.storage ||
    root.Storage ||
    (root.resource === 'storage' ? root : null) ||
    root.resources?.storage ||
    null

  const pickBytes = (...candidates) => {
    for (const c of candidates) {
      if (c == null || c === '') continue
      const n = Number(c)
      if (Number.isFinite(n) && n >= 0) return n
    }
    return null
  }

  // Prefer explicit byte fields; fall back to MB fields.
  let usedBytes = pickBytes(
    storage?.usedBytes, storage?.bytes, storage?.usageBytes,
    root.storageBytes, root.usedBytes, root.bytes,
    storage?.usage, root.usage
  )
  let limitBytes = pickBytes(
    storage?.limitBytes, storage?.quotaBytes,
    root.storageLimitBytes, root.limitBytes, root.quotaBytes,
    storage?.limit, root.limit
  )

  if (usedBytes == null) {
    const usedMb = pickBytes(storage?.usedMb, storage?.used, root.usedMb, root.storageMb)
    if (usedMb != null) usedBytes = usedMb * MB
  }
  if (limitBytes == null) {
    const limitMb = pickBytes(storage?.limitMb, root.limitMb, root.storageLimitMb)
    if (limitMb != null) limitBytes = limitMb * MB
  }

  // If "usage"/"limit" look like MB (small integers) vs bytes, prefer treating
  // values < 10_000 without a unit as MB only when a sibling *Mb field exists —
  // otherwise leave as bytes when already set above.
  if (usedBytes == null && limitBytes == null) return null

  return {
    usedBytes: usedBytes != null ? usedBytes : 0,
    limitBytes: limitBytes != null ? limitBytes : null,
    documentCount: pickBytes(root.documentCount, root.documents, root.count, storage?.documents),
    organizationId: root.organizationId || storage?.organizationId || null,
    raw: json,
  }
}

/**
 * List documents visible to the configured API key (paginated).
 * @returns {{ documents: object[], total: number|null }}
 */
async function listDocuments({ org, user, limit = 100, offset = 0, page } = {}) {
  if (!isEnabled()) return null
  const usp = new URLSearchParams()
  usp.set('limit', String(Math.min(Math.max(Number(limit) || 100, 1), 200)))
  if (page != null) usp.set('page', String(page))
  else usp.set('offset', String(Math.max(0, Number(offset) || 0)))

  const json = await dmsFetch(`/documents?${usp}`, {
    apiKey: resolveApiKey(org),
    user,
    timeoutMs: 10000,
  })
  const documents = json.documents || json.data?.documents || json.items || []
  const total = json.total ?? json.count ?? json.data?.total ?? null
  return { documents: Array.isArray(documents) ? documents : [], total: total != null ? Number(total) : null, raw: json }
}

/**
 * Real storage used in BaseLayer DMS for the API key's organization.
 * Prefers GET /usage|/stats when the key is accepted; otherwise sums document.size.
 */
async function getStorageUsage({ org, user } = {}) {
  if (!isEnabled()) return null

  // DMS /usage + /stats currently require a user JWT, not X-Api-Key. Opt in if
  // BaseLayer later opens them to service keys (avoids two failed round-trips).
  if (String(process.env.DMS_USAGE_ENDPOINT || '').toLowerCase() === 'true') {
    const key = resolveApiKey(org)
    for (const path of ['/usage', '/stats']) {
      try {
        const json = await dmsFetch(path, { apiKey: key, user, timeoutMs: 5000, quiet: true })
        const parsed = parseUsagePayload(json)
        if (parsed) {
          return {
            enabled: true,
            source: path.slice(1),
            usedBytes: parsed.usedBytes,
            usedMb: parsed.usedBytes / MB,
            limitBytes: parsed.limitBytes,
            limitMb: parsed.limitBytes != null ? parsed.limitBytes / MB : null,
            documentCount: parsed.documentCount,
            organizationId: parsed.organizationId,
          }
        }
      } catch (err) {
        if (process.env.DMS_DEBUG === '1') {
          console.debug(`[dms] getStorageUsage ${path} skipped:`, err.status || err.message)
        }
      }
    }
  }

  let offset = 0
  let page = 1
  let usedBytes = 0
  let documentCount = 0
  let organizationId = null
  const seen = new Set()
  const maxPages = 50

  for (let i = 0; i < maxPages; i += 1) {
    const batch = await listDocuments({ org, user, limit: 100, offset, page })
    if (!batch) break
    const docs = batch.documents
    if (!docs.length) break

    for (const doc of docs) {
      const id = doc.id || doc._id
      if (id && seen.has(String(id))) continue
      if (id) seen.add(String(id))
      usedBytes += Number(doc.size || doc.fileSize || doc.bytes || 0) || 0
      documentCount += 1
      if (!organizationId && doc.organizationId) organizationId = String(doc.organizationId)
    }

    if (docs.length < 100) break
    // Prefer offset when the API honours it; also bump page for page-based APIs.
    offset += docs.length
    page += 1
  }

  const customLimit = Number(process.env.DMS_QUOTA_MB)
  const limitBytes = (customLimit && !Number.isNaN(customLimit) && customLimit > 0) ? customLimit * MB : null

  return {
    enabled: true,
    source: 'documents_sum',
    usedBytes,
    usedMb: usedBytes / MB,
    limitBytes,
    limitMb: limitBytes ? customLimit : null,
    documentCount,
    organizationId,
  }
}

/**
 * Fetch the real folder tree from BaseLayer DMS using DMS_JWT if available.
 */
async function getFoldersTree({ org, user } = {}) {
  if (!isEnabled()) return null

  const jwt = process.env.DMS_JWT
  if (!jwt) {
    if (process.env.DMS_DEBUG === '1') console.debug('[dms] getFoldersTree skipped: no DMS_JWT provided')
    return null
  }

  try {
    // The /folders endpoint requires the JWT token for authentication
    const json = await dmsFetch('/folders', { 
      headers: { 'Authorization': `Bearer ${jwt}` },
      timeoutMs: 5000, 
      quiet: true 
    })
    
    // Convert the tree response structure to match what NetFlow expects
    if (json && json.tree) {
      return json.tree
    }
    return null
  } catch (err) {
    console.warn(`[dms] getFoldersTree failed:`, err.status || err.message)
    return null
  }
}

async function deleteDoc(dmsDocId, { org, user } = {}) {
  if (!isEnabled() || !dmsDocId) return null
  return dmsFetch(`/documents/${encodeURIComponent(dmsDocId)}`, {
    method: 'DELETE',
    apiKey: resolveApiKey(org),
    user,
    timeoutMs: 10000,
  })
}

module.exports = {
  isEnabled,
  resolveApiKey,
  resolveBaseUrl,
  resolveDeptConfig,
  buildDmsFolder,
  ping,
  uploadFile,
  signedUrl,
  getDoc,
  deleteDoc,
  findByRef,
  postEvent,
  listDocuments,
  getStorageUsage,
  getFoldersTree,
  DmsError,
}

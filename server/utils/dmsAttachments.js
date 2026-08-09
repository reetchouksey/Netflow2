// Helpers for refreshing DMS signed URLs and emitting workflow lifecycle events.

const dms = require('../services/dmsClient')

const EVENT_TYPES = new Set([
  'workflow.submitted',
  'workflow.approved',
  'workflow.rejected',
  'workflow.escalated',
  'workflow.reassigned',
])

/** Collect dmsDocId values from task.attachments, formData file objects, signatures. */
function collectDmsDocIds(task, formResponse) {
  const ids = new Set()

  const take = (obj) => {
    if (!obj || typeof obj !== 'object') return
    if (obj.dmsDocId) ids.add(String(obj.dmsDocId))
  }

  for (const a of task?.attachments || []) take(a)
  for (const h of task?.approvalHistory || []) take(h?.signature)

  const walk = (val) => {
    if (!val || typeof val !== 'object') return
    if (Array.isArray(val)) {
      val.forEach(walk)
      return
    }
    if (val.dmsDocId && (val.url || val.name || val.mime)) take(val)
    else Object.values(val).forEach(walk)
  }

  if (task?.formData) walk(task.formData)
  if (formResponse?.formData) walk(formResponse.formData)
  for (const a of formResponse?.attachments || []) {
    if (a.dmsDocId) ids.add(String(a.dmsDocId))
  }

  return [...ids]
}

async function refreshFileObject(file, { org, user, mode = 'view' } = {}) {
  if (!file || typeof file !== 'object' || !file.dmsDocId || !dms.isEnabled()) return file
  try {
    const url = await dms.signedUrl(file.dmsDocId, { mode, org, user })
    if (url) return { ...file, url }
  } catch (err) {
    console.warn('[dms] signedUrl refresh failed', file.dmsDocId, err.message)
  }
  return file
}

async function refreshFormDataUrls(formData, ctx) {
  if (!formData || typeof formData !== 'object' || !dms.isEnabled()) return formData

  const out = Array.isArray(formData) ? [...formData] : { ...formData }
  const entries = Array.isArray(out) ? out.entries() : Object.entries(out)

  await Promise.all([...entries].map(async ([key, val]) => {
    if (val && typeof val === 'object' && val.dmsDocId && (val.url || val.name || val.mime)) {
      const refreshed = await refreshFileObject(val, ctx)
      if (Array.isArray(out)) out[key] = refreshed
      else out[key] = refreshed
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      // Nested grids / repeaters
      const nested = await refreshFormDataUrls(val, ctx)
      if (Array.isArray(out)) out[key] = nested
      else out[key] = nested
    } else if (Array.isArray(val)) {
      const nested = await refreshFormDataUrls(val, ctx)
      if (Array.isArray(out)) out[key] = nested
      else out[key] = nested
    }
  }))

  return out
}

async function refreshTaskAttachments(taskObj, ctx) {
  if (!taskObj || !dms.isEnabled()) return taskObj
  const attachments = Array.isArray(taskObj.attachments)
    ? await Promise.all(taskObj.attachments.map((a) => refreshFileObject(a, ctx)))
    : taskObj.attachments

  let formData = taskObj.formData
  if (formData) formData = await refreshFormDataUrls(formData, ctx)

  return { ...taskObj, attachments, formData }
}

/** Best-effort DMS audit events — never throws to callers. */
async function emitWorkflowEvents(dmsDocIds, { type, actor, detail, meta, org } = {}) {
  if (!dms.isEnabled() || !EVENT_TYPES.has(type) || !dmsDocIds?.length) return
  await Promise.allSettled(
    dmsDocIds.map((id) =>
      dms.postEvent(id, { type, actor, detail, meta }, { org }).catch((err) => {
        console.warn('[dms] postEvent failed', id, type, err.message)
      })
    )
  )
}

async function emitForTask(task, { type, actor, detail, meta, org, formResponse } = {}) {
  const ids = collectDmsDocIds(task, formResponse)
  await emitWorkflowEvents(ids, { type, actor, detail, meta, org })
}

module.exports = {
  collectDmsDocIds,
  refreshFileObject,
  refreshFormDataUrls,
  refreshTaskAttachments,
  emitWorkflowEvents,
  emitForTask,
}

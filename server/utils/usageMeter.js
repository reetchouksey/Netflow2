// Licensing Phase 2 - utils/usageMeter.js
// Writes to the stored meters on Organization. Kept apart from utils/licensing
// (which only reads and calculates) because these are the only functions in the
// codebase allowed to move a counter, which makes drift easy to audit.
//
// Counters use $inc so concurrent requests cannot lose an update, and the
// nightly reconciliation job (jobs/usageCron.js) repairs any drift from crashes
// or deletes that bypassed the API.

const Organization = require('../models/Organization')
const { periodFor, isStale } = require('./billingPeriod')

const SUB_FLAGS = ['usage.notified.sub80', 'usage.notified.sub90', 'usage.notified.sub100']

// Warn the admin from here rather than from each route, so a counter can never
// move without the thresholds being reconsidered. Fire-and-forget and required
// lazily: warning somebody must not slow down or break the write that caused it.
const considerWarnings = (org) => {
  try {
    const { evaluateWarnings } = require('./usageWarnings')
    Promise.resolve(evaluateWarnings(org)).catch(() => { /* logged inside */ })
  } catch { /* never block the meter */ }
}

// Moves the submission window forward when the stored one has elapsed, resetting
// the count and the "already warned" flags. Returns the live window.
//
// The elapsed case is guarded on periodEnd so two simultaneous submissions can
// never both roll (and zero each other's increment); the other staleness cases
// (never initialised, anchor day changed) cannot race in the same way.
const ensurePeriod = async (orgId, now = new Date()) => {
  const org = await Organization.findById(orgId)
    .select('billingAnchorDay usage.submissions')
    .lean()
  if (!org) return null

  const current = org.usage?.submissions || {}
  if (!isStale(current, org.billingAnchorDay, now)) return current

  const { start, end } = periodFor(org.billingAnchorDay, now)
  const reset = {
    'usage.submissions.periodStart': start,
    'usage.submissions.periodEnd': end,
    'usage.submissions.count': 0
  }
  SUB_FLAGS.forEach((f) => { reset[f] = false })

  const elapsed = current.periodEnd && new Date(current.periodEnd).getTime() <= new Date(now).getTime()
  const filter = elapsed
    ? { _id: orgId, 'usage.submissions.periodEnd': current.periodEnd }
    : { _id: orgId }

  const res = await Organization.updateOne(filter, { $set: reset })
  if (elapsed && res.matchedCount === 0) {
    // Another request rolled it first — read back rather than assume zero.
    const fresh = await Organization.findById(orgId).select('usage.submissions').lean()
    return fresh?.usage?.submissions || { periodStart: start, periodEnd: end, count: 0 }
  }
  return { periodStart: start, periodEnd: end, count: 0 }
}

// Records one submission against the current window. Returns the window with the
// new count, or null when the org is gone.
const meterSubmission = async (orgId) => {
  if (!orgId) return null
  const period = await ensurePeriod(orgId)
  if (!period) return null
  const updated = await Organization.findByIdAndUpdate(
    orgId,
    { $inc: { 'usage.submissions.count': 1 } },
    { new: true, select: 'name plan limits usage billingEmail' }
  ).lean()
  if (updated) considerWarnings(updated)
  return updated?.usage?.submissions || null
}

// Records stored bytes. `bufferBytes` is the slice of this upload that came out
// of the completion buffer rather than the licensed allowance, tracked separately
// so the admin can be told the difference.
const addStorage = async (orgId, bytes, { files = 1, bufferBytes = 0 } = {}) => {
  if (!orgId || !bytes) return null
  const inc = {
    'usage.storageBytes': Number(bytes),
    'usage.fileCount': Number(files)
  }
  if (bufferBytes > 0) inc['usage.bufferBytesUsed'] = Number(bufferBytes)
  const updated = await Organization.findByIdAndUpdate(
    orgId,
    { $inc: inc },
    { new: true, select: 'name plan limits usage billingEmail storageExtension' }
  ).lean()
  if (updated) considerWarnings(updated)
  return updated?.usage || null
}

// Gives storage back when files are deleted. Clamped at zero so a legacy
// attachment with no recorded size can never push a counter negative.
const releaseStorage = async (orgId, bytes, { files = 1 } = {}) => {
  if (!orgId) return null
  const org = await Organization.findById(orgId).select('usage.storageBytes usage.fileCount usage.bufferBytesUsed').lean()
  if (!org) return null

  const nextBytes = Math.max(0, Number(org.usage?.storageBytes || 0) - Number(bytes || 0))
  const nextFiles = Math.max(0, Number(org.usage?.fileCount || 0) - Number(files || 0))
  // Freeing space repays the buffer first — it is emergency headroom, not quota.
  const nextBuffer = Math.max(0, Math.min(Number(org.usage?.bufferBytesUsed || 0), nextBytes))

  await Organization.updateOne({ _id: orgId }, {
    $set: {
      'usage.storageBytes': nextBytes,
      'usage.fileCount': nextFiles,
      'usage.bufferBytesUsed': nextBuffer
    }
  })
  return { storageBytes: nextBytes, fileCount: nextFiles, bufferBytesUsed: nextBuffer }
}

module.exports = { ensurePeriod, meterSubmission, addStorage, releaseStorage }

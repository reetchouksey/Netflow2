// AI-01 - utils/approverInference.js
// The brain of #01 Approval-Routing AI (Delegation-of-Authority).
//
// Given a request (department + category + amount + submitter), it:
//   1. picks the matching DoA rule (the policy: which approver ROLES, in order),
//   2. loads the live org chart (the people),
//   3. asks Gemini to map policy -> people, preferring the submitter's direct
//      manager and escalating to the nearest higher authority when a required
//      role has no holder,
//   4. validates every userId against the org chart, and
//   5. falls back to a fully deterministic resolver if the LLM is unavailable or
//      returns anything unusable — so this function NEVER hard-fails.
//
// Public surface: inferApproverChain, resolveDynamicApprover, extractAmount.

const User = require('../models/User')
require('../models/Role') // ensure the Role schema is registered for populate('role')
const DoA = require('../models/DelegationOfAuthority')
const llm = require('./llm')

// Seniority ladder (low -> high). Used to escalate to the "nearest higher
// authority" when a DoA-required role has no active user.
const SENIORITY = ['Viewer', 'Employee', 'Manager', 'HR', 'VP', 'CEO', 'Admin']
const rank = (roleName) => {
  const i = SENIORITY.indexOf(roleName)
  return i === -1 ? 0 : i
}

const SYSTEM_PROMPT =
  "You are NetFlow's Delegation-of-Authority approval-routing engine. You map " +
  'an approval policy to real people from a provided org chart. You never invent ' +
  'people and you output strict JSON only.'

// ---------- org chart ----------

const loadOrgChart = async () => {
  const users = await User.find({ isActive: true })
    .populate('role', 'name')
    .select('name email department role managerId')
    .limit(500)
    .lean()

  const list = users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role?.name || 'Employee',
    department: u.department,
    managerId: u.managerId ? String(u.managerId) : null
  }))
  const byId = new Map(list.map((u) => [u.id, u]))
  return { list, byId }
}

// ---------- DoA rule selection ----------

const ruleMatches = (r, { department, category, amount }) => {
  if (r.department && r.department !== 'ANY' && department && r.department !== department) return false
  if (
    r.category && r.category !== 'ANY' && category &&
    r.category.toLowerCase() !== String(category).toLowerCase()
  ) return false
  const amt = Number(amount) || 0
  if (r.minAmount != null && amt < r.minAmount) return false
  if (r.maxAmount != null && amt > r.maxAmount) return false
  return true
}

const specificity = (r) => (r.department !== 'ANY' ? 2 : 0) + (r.category !== 'ANY' ? 1 : 0)

const selectRule = (rules, ctx) => {
  const matches = rules.filter((r) => ruleMatches(r, ctx))
  matches.sort((a, b) =>
    (b.priority - a.priority) ||
    (specificity(b) - specificity(a)) ||
    ((a.maxAmount ?? Infinity) - (b.maxAmount ?? Infinity))
  )
  return matches[0] || null
}

const ruleSummary = (rule) => {
  if (!rule) return null
  return {
    name: rule.name,
    department: rule.department,
    category: rule.category,
    band: `${rule.minAmount ?? 0} - ${rule.maxAmount == null ? '∞' : rule.maxAmount}`,
    requiredRoles: (rule.approverChain || []).map((s) => s.role)
  }
}

// ---------- deterministic resolution (fallback + validation backbone) ----------

const pickUser = (org, predicate, dept, usedIds) => {
  const candidates = org.list.filter(predicate)
  candidates.sort((a, b) => {
    const ad = a.department === dept ? 0 : 1
    const bd = b.department === dept ? 0 : 1
    if (ad !== bd) return ad - bd
    const au = usedIds.has(a.id) ? 1 : 0
    const bu = usedIds.has(b.id) ? 1 : 0
    if (au !== bu) return au - bu
    return a.name.localeCompare(b.name)
  })
  return candidates[0] || null
}

// Find a user for a required role; if none hold it, climb to the nearest higher
// authority that exists.
const resolveUserForRole = (org, roleName, dept, usedIds) => {
  let u = pickUser(org, (x) => x.role === roleName, dept, usedIds)
  if (u) return { user: u, escalated: false }
  for (const higher of SENIORITY.slice(rank(roleName) + 1)) {
    u = pickUser(org, (x) => x.role === higher, dept, usedIds)
    if (u) return { user: u, escalated: true }
  }
  return { user: null, escalated: false }
}

const buildDeterministicChain = (org, rule, submitter) => {
  const chain = []
  const used = new Set()
  const dept = submitter?.department || (rule && rule.department !== 'ANY' ? rule.department : null)
  const directManager =
    submitter?.managerId && org.byId.has(submitter.managerId)
      ? org.byId.get(submitter.managerId)
      : null

  const steps = rule?.approverChain?.length
    ? [...rule.approverChain].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [{ role: 'Manager', slaHours: 48 }]

  let usedDirectManager = false
  for (const s of steps) {
    // The submitter's direct manager fulfils the first Manager-level step,
    // rather than adding a second, unrelated manager.
    if (s.role === 'Manager' && directManager && !usedDirectManager && !used.has(directManager.id)) {
      used.add(directManager.id)
      usedDirectManager = true
      chain.push({
        order: chain.length + 1, role: directManager.role, requiredRole: s.role,
        userId: directManager.id, name: directManager.name, email: directManager.email,
        department: directManager.department, slaHours: s.slaHours || 48,
        reason: 'Direct manager of the submitter (org chart).'
      })
      continue
    }

    const { user, escalated } = resolveUserForRole(org, s.role, dept, used)
    if (!user || used.has(user.id)) continue
    used.add(user.id)
    chain.push({
      order: chain.length + 1, role: user.role, requiredRole: s.role,
      userId: user.id, name: user.name, email: user.email, department: user.department,
      slaHours: s.slaHours || 48,
      reason: escalated
        ? `No active ${s.role}; escalated to nearest higher authority (${user.role}).`
        : `Holds the required role ${s.role}.`
    })
  }

  if (chain.length === 0) {
    const fallback =
      directManager ||
      pickUser(org, (x) => rank(x.role) >= rank('Manager'), dept, used) ||
      org.list[0]
    if (fallback) {
      chain.push({
        order: 1, role: fallback.role, requiredRole: 'Manager',
        userId: fallback.id, name: fallback.name, email: fallback.email,
        department: fallback.department, slaHours: 48,
        reason: 'Default approver (no DoA rule matched / no role holders found).'
      })
    }
  }
  return chain
}

const fallbackSummary = (rule, chain) => {
  const who = chain.map((c) => `${c.name} (${c.role})`).join(' -> ') || 'no eligible approver'
  return rule
    ? `Deterministic routing per "${rule.name}": ${who}.`
    : `Deterministic routing (no DoA rule matched): ${who}.`
}

// ---------- LLM resolution ----------

const buildPrompt = ({ rule, submitter, org, ctx }) => {
  const orgCompact = org.list.map((u) => ({
    id: u.id, name: u.name, role: u.role, department: u.department, managerId: u.managerId
  }))
  const ruleText = rule
    ? {
        name: rule.name,
        department: rule.department,
        category: rule.category,
        amountBand: `${rule.minAmount ?? 0} - ${rule.maxAmount == null ? 'no upper bound' : rule.maxAmount} ${rule.currency || ''}`.trim(),
        approverChain: (rule.approverChain || []).map((s) => ({ order: s.order, role: s.role, slaHours: s.slaHours }))
      }
    : null

  return `Determine the ordered approver chain for the request below.

REQUEST:
${JSON.stringify({ department: ctx.department, category: ctx.category, amount: ctx.amount, currency: ctx.currency, description: ctx.description }, null, 2)}

SUBMITTER:
${JSON.stringify(submitter ? { id: submitter.id, name: submitter.name, role: submitter.role, department: submitter.department, managerId: submitter.managerId } : null, null, 2)}

APPLICABLE DELEGATION-OF-AUTHORITY RULE (the policy to follow; null = use sensible defaults):
${JSON.stringify(ruleText, null, 2)}

ORG CHART (the ONLY people you may route to — use their exact "id"):
${JSON.stringify(orgCompact, null, 2)}

RULES:
- Produce an ORDERED chain that satisfies the DoA rule's roles in sequence.
- Step 1 should normally be the submitter's direct manager (the "managerId") when one exists.
- For every required role, choose a real person from the ORG CHART who holds that role; prefer the submitter's department, then org-wide.
- If NO active user holds a required role, escalate that step to the nearest higher authority that exists (seniority low->high: Manager, HR, VP, CEO, Admin) and say so in "reason".
- Never invent people. Every "userId" MUST equal an "id" from the ORG CHART. Do not place the same person in two consecutive steps. Do not route a request back to the submitter.
- Output STRICT JSON ONLY in exactly this shape:
{"summary": "one short plain-English sentence", "chain": [{"order": 1, "role": "Manager", "userId": "<org chart id>", "reason": "why this person"}]}`
}

// Keep only steps that point at a real, active org-chart user; renumber; drop
// consecutive duplicates. Returns [] if nothing usable survives.
const validateChain = (raw, org) => {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const step of raw) {
    const uid = step && step.userId != null ? String(step.userId) : ''
    const u = org.byId.get(uid)
    if (!u) continue
    if (out.length && out[out.length - 1].userId === u.id) continue
    out.push({
      order: out.length + 1,
      role: u.role,
      requiredRole: step.role || u.role,
      userId: u.id,
      name: u.name,
      email: u.email,
      department: u.department,
      slaHours: Number(step.slaHours) || 48,
      reason: String(step.reason || '').slice(0, 500)
    })
  }
  return out
}

// The DoA policy is the floor. When the model returns fewer distinct approvers
// than the policy requires, rebuild from the deterministic chain (guaranteed
// coverage + escalation) while keeping the model's wording for any person it
// also chose.
const reconcileFromDeterministic = (llmChain, deterministic) => {
  const byUser = new Map(llmChain.map((s) => [s.userId, s]))
  return deterministic.map((s, i) => ({
    ...s,
    order: i + 1,
    reason: byUser.get(s.userId)?.reason || s.reason
  }))
}

// ---------- public API ----------

const inferApproverChain = async (input = {}) => {
  const ctx = {
    department: input.department || null,
    category: input.category || null,
    amount: Number(input.amount) || 0,
    currency: input.currency || 'USD',
    description: input.description || ''
  }

  let submitter = input.submitter || null
  if (!submitter && input.submitterId) {
    const s = await User.findById(input.submitterId)
      .populate('role', 'name')
      .select('name email department role managerId')
      .lean()
    if (s) {
      submitter = {
        id: String(s._id),
        name: s.name,
        email: s.email,
        role: s.role?.name || 'Employee',
        department: s.department,
        managerId: s.managerId ? String(s.managerId) : null
      }
    }
  }
  if (!ctx.department && submitter?.department) ctx.department = submitter.department

  const [org, rules] = await Promise.all([
    loadOrgChart(),
    DoA.find({ isActive: true }).lean()
  ])
  const rule = selectRule(rules, ctx)

  // Deterministic resolution is always computed: it is both the safety net and
  // the policy floor used to reconcile the LLM's output.
  const deterministic = buildDeterministicChain(org, rule, submitter)

  // Preferred path: LLM-inferred chain, validated against the org chart.
  if (llm.isConfigured()) {
    try {
      const out = await llm.generateJSON(
        buildPrompt({ rule, submitter, org, ctx }),
        { system: SYSTEM_PROMPT, temperature: 0.1 }
      )
      const llmChain = validateChain(out?.chain, org)
      if (llmChain.length) {
        const llmSummary = String(out.summary || '').slice(0, 500)
        const distinct = new Set(llmChain.map((s) => s.userId)).size
        if (distinct >= deterministic.length) {
          return {
            source: 'llm',
            model: llm.getModel(),
            summary: llmSummary || fallbackSummary(rule, llmChain),
            rule: ruleSummary(rule),
            chain: llmChain
          }
        }
        // Model dropped required approvers — backfill from policy so we never
        // under-approve.
        const merged = reconcileFromDeterministic(llmChain, deterministic)
        return {
          source: 'llm+policy',
          model: llm.getModel(),
          summary: llmSummary || fallbackSummary(rule, merged),
          rule: ruleSummary(rule),
          chain: merged
        }
      }
      console.warn('approverInference: LLM chain failed validation; using deterministic fallback')
    } catch (err) {
      console.error('approverInference LLM error:', err.message)
    }
  }

  return {
    source: llm.isConfigured() ? 'fallback' : 'fallback_no_llm',
    model: null,
    summary: fallbackSummary(rule, deterministic),
    rule: ruleSummary(rule),
    chain: deterministic
  }
}

// Pull a best-guess monetary amount out of a form submission.
const extractAmount = (formData) => {
  if (!formData || typeof formData !== 'object') return 0
  const toNum = (v) => {
    if (v == null) return null
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  const moneyKey = /amount|total|cost|price|value|salary|budget/i
  for (const k of Object.keys(formData)) {
    if (moneyKey.test(k)) {
      const n = toNum(formData[k])
      if (n != null) return n
    }
  }
  return 0
}

// Runtime helper for the workflow engine. Infers the chain once per execution,
// caches it on execution.variables, and hands back the next approver each time
// an LLM-routed approval node runs. Returns null when the chain is exhausted so
// the engine can fall back to a node's static config.
const resolveDynamicApprover = async (execution, node, workflow) => {
  execution.variables = execution.variables || {}
  const vars = execution.variables

  let chain = Array.isArray(vars.approverChain) ? vars.approverChain : null
  if (!chain || chain.length === 0) {
    const ctx = {
      department: vars.department || vars.submitter?.department || workflow.department || null,
      category: vars.category || node.config?.category || null,
      amount: extractAmount(vars.formData),
      currency: vars.currency || 'USD',
      description:
        vars.formData && typeof vars.formData === 'object'
          ? JSON.stringify(vars.formData)
          : String(vars.formData || ''),
      submitterId: vars.submitter?.id || execution.triggeredBy
    }
    const result = await inferApproverChain(ctx)
    chain = result.chain || []
    vars.approverChain = chain
    vars.approverChainSource = result.source
    vars.approverChainSummary = result.summary
    vars.approverChainPos = 0
    execution.markModified('variables')
  }

  const pos = vars.approverChainPos || 0
  if (pos >= chain.length) return null

  const step = chain[pos]
  vars.approverChainPos = pos + 1
  execution.markModified('variables')

  return {
    userId: step.userId,
    reason: step.reason || `Routed to ${step.name} (${step.role}) per Delegation-of-Authority.`,
    source: vars.approverChainSource,
    slaHours: step.slaHours,
    chainPreview: chain.map((c) => ({ order: c.order, name: c.name, role: c.role }))
  }
}

module.exports = { inferApproverChain, resolveDynamicApprover, extractAmount }

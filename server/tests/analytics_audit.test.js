// ANA — Analytics (summary + reports vs DB truth, access gate) and Audit log
// (events created, filter, pagination). CSV/PDF export (ANA-008/009) is
// generated client-side → Pending.

const h = require('./lib/harness')
const { runWithOrgId, Task, Workflow, WorkflowExecution } = h
const { escalateTask } = require('../jobs/escalationCron')

const publishWorkflow = async (token, title, nodes) => {
  const created = await h.api('POST', '/workflows', token, { title, nodes })
  const id = created.body?.workflow?._id
  await h.api('POST', `/workflows/${id}/publish`, token)
  return id
}

h.runSuite('analytics_audit', async () => {
  const org = await h.createOrg('ana')

  const manager = await h.createUser(org, { name: 'ANA Manager', email: h.emailIn(org, 'ana-mgr'), roleName: 'Admin', department: 'IT' })
  const submitter = await h.createUser(org, { name: 'ANA Submitter', email: h.emailIn(org, 'ana-sub'), roleName: 'Employee', department: 'IT', managerId: manager._id })
  const employee = await h.createUser(org, { name: 'ANA Employee', email: h.emailIn(org, 'ana-emp'), roleName: 'Employee' })

  const mgrTok = await h.getToken({ email: manager.email })
  const subTok = await h.getToken({ email: submitter.email })
  const empTok = await h.getToken({ email: employee.email })

  // Both exports are built in the browser and never hit the API; the downloads
  // are captured and opened in ui_analytics.test.js, which upgrades these.
  h.note('ANA-008', 'Pending', 'Frontend: covered by ui_analytics.test.js')
  h.note('ANA-009', 'Pending', 'Frontend: covered by ui_analytics.test.js')

  // ── Static, controlled dataset (created directly so counts are deterministic) ──
  const wfDoc = await runWithOrgId(org._id, () => Workflow.create({ title: 'ANA seed wf', status: 'published', createdBy: manager._id, nodes: [] }))
  const mkTask = (status) => runWithOrgId(org._id, () => Task.create({ title: `ANA ${status}`, type: 'IT', status, assignedTo: manager._id, submittedBy: submitter._id }))
  await mkTask('approved'); await mkTask('approved'); await mkTask('rejected'); await mkTask('pending')
  await runWithOrgId(org._id, () => WorkflowExecution.create({ workflowId: wfDoc._id, triggeredBy: submitter._id, status: 'completed', startedAt: new Date(Date.now() - 3600000), completedAt: new Date() }))
  await runWithOrgId(org._id, () => WorkflowExecution.create({ workflowId: wfDoc._id, triggeredBy: submitter._id, status: 'running', startedAt: new Date() }))

  // ANA-001 analytics endpoints load.
  const summary = await h.api('GET', '/analytics/summary', mgrTok)
  const approvalRate = await h.api('GET', '/analytics/approval-rate', mgrTok)
  const completion = await h.api('GET', '/analytics/completion-time', mgrTok)
  const activity = await h.api('GET', '/analytics/activity', mgrTok)
  h.check('ANA-001', 'Analytics page endpoints load (summary/charts)', [summary, approvalRate, completion, activity].every((r) => r.status === 200), `statuses ${[summary, approvalRate, completion, activity].map((r) => r.status).join(',')}`)

  // ANA-002 summary counts match DB truth (org-scoped).
  const truth = await runWithOrgId(org._id, () => Promise.all([
    Task.countDocuments({ status: 'approved' }),
    Task.countDocuments({ status: 'rejected' }),
    Task.countDocuments({ status: 'pending' }),
    WorkflowExecution.countDocuments({})
  ]))
  const s = summary.body?.summary || {}
  h.check('ANA-002', 'Summary stats match actual data', s.approvedTasks === truth[0] && s.rejectedTasks === truth[1] && s.pendingTasks === truth[2] && s.totalExecutions === truth[3], `summary ${s.approvedTasks}/${s.rejectedTasks}/${s.pendingTasks}/${s.totalExecutions} vs db ${truth.join('/')}`)

  // ANA-003 completion-time report renders a series.
  h.check('ANA-003', 'Completion-time report returns a series', completion.status === 200 && Array.isArray(completion.body?.series) && completion.body.series.length >= 1, `series ${completion.body?.series?.length}`)

  // ANA-004 approval-rate distribution matches counts.
  const dist = approvalRate.body?.distribution || []
  const approvedRow = dist.find((d) => d.status === 'approved')
  const rejectedRow = dist.find((d) => d.status === 'rejected')
  h.check('ANA-004', 'Approval-rate distribution matches counts', (approvedRow?.count || 0) === truth[0] && (rejectedRow?.count || 0) === truth[1], `dist approved ${approvedRow?.count}, rejected ${rejectedRow?.count} vs ${truth[0]}/${truth[1]}`)

  // ANA-005 department KPI report.
  const kpis = await h.api('GET', '/analytics/department-kpis', mgrTok)
  const itRow = (kpis.body?.kpis || []).find((k) => k.department === 'IT')
  h.check('ANA-005', 'Department KPI report has correct IT figures', kpis.status === 200 && !!itRow && itRow.totalRequests >= 4 && itRow.approved >= 2 && itRow.rejected >= 1, `itRow ${JSON.stringify(itRow)}`)

  // ANA-006 SLA breach report renders.
  const sla = await h.api('GET', '/analytics/sla-breaches', mgrTok)
  h.check('ANA-006', 'SLA breach report returns a series', sla.status === 200 && Array.isArray(sla.body?.series), `status ${sla.status}`)

  // ANA-007 date-range filter changes results (future window → zero).
  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const filtered = await h.api('GET', `/analytics/summary?from=${future}`, mgrTok)
  h.check('ANA-007', 'Date-range filter is applied', filtered.status === 200 && (filtered.body?.summary?.totalExecutions || 0) === 0 && (filtered.body?.summary?.approvedTasks || 0) === 0, `future totals exec ${filtered.body?.summary?.totalExecutions}, approved ${filtered.body?.summary?.approvedTasks}`)

  // ANA-010 empty-data org does not crash.
  const emptyOrg = await h.createOrg('ana-empty')
  const emptyMgr = await h.createUser(emptyOrg, { name: 'Empty Mgr', email: h.emailIn(emptyOrg, 'ana-empty-mgr'), roleName: 'Manager' })
  const emptyTok = await h.getToken({ email: emptyMgr.email })
  const emptySummary = await h.api('GET', '/analytics/summary', emptyTok)
  h.check('ANA-010', 'Empty-data analytics returns zeros, no crash', emptySummary.status === 200 && (emptySummary.body?.summary?.totalExecutions || 0) === 0, `status ${emptySummary.status}`)

  // ANA-011 employee blocked from restricted reports.
  const empKpis = await h.api('GET', '/analytics/department-kpis', empTok)
  const empSla = await h.api('GET', '/analytics/sla-breaches', empTok)
  h.check('ANA-011', 'Employee blocked from restricted analytics (403)', empKpis.status === 403 && empSla.status === 403, `kpis ${empKpis.status}, sla ${empSla.status}`)

  // ── Audit log ───────────────────────────────────────────────────────────────
  // ANA-012 audit log loads.
  const auditLoad = await h.api('GET', '/audit-logs', mgrTok)
  h.check('ANA-012', 'Audit log page loads events with timestamps', auditLoad.status === 200 && Array.isArray(auditLoad.body?.logs), `status ${auditLoad.status}`)

  // Trigger real audit events.
  const startedWf = await publishWorkflow(mgrTok, 'ANA started wf', [
    { id: 'start', type: 'start', nextNode: 'a' },
    { id: 'a', type: 'approval', config: { approverId: manager._id }, nextNode: 'end' },
    { id: 'end', type: 'end' }
  ])
  const startExec = await h.api('POST', `/workflows/${startedWf}/execute`, subTok, {})
  const startTask = await h.waitUntil(() => runWithOrgId(org._id, () => Task.findOne({ workflowExecutionId: startExec.body?.executionId, status: 'pending' }).lean()))
  await h.api('POST', `/tasks/${startTask._id}/approve`, mgrTok, {}) // → workflow_completed

  // approver_inferred via direct_manager routing.
  const inferWf = await publishWorkflow(mgrTok, 'ANA infer wf', [
    { id: 'start', type: 'start', nextNode: 'a' },
    { id: 'a', type: 'approval', config: { approverRole: 'direct_manager' }, nextNode: 'end' },
    { id: 'end', type: 'end' }
  ])
  await h.api('POST', `/workflows/${inferWf}/execute`, subTok, {})

  // task_escalated via the real escalation code path.
  const overdue = await runWithOrgId(org._id, () => Task.create({ title: 'ANA overdue', type: 'IT', status: 'pending', assignedTo: submitter._id, submittedBy: submitter._id, dueDate: new Date(Date.now() - 3 * 3600000), isEscalated: false }))
  const populated = await runWithOrgId(org._id, () => Task.findById(overdue._id).populate('assignedTo submittedBy').lean())
  await runWithOrgId(org._id, () => escalateTask(populated, new Date()))

  const hasAction = (action) => h.waitUntil(async () => {
    const r = await h.api('GET', `/audit-logs?action=${action}`, mgrTok)
    return (r.body?.logs || []).length >= 1 ? r : null
  })
  const started = await hasAction('workflow_started')
  const completed = await hasAction('workflow_completed')
  const escalated = await hasAction('task_escalated')
  const inferred = await hasAction('approver_inferred')

  h.check('ANA-013', 'workflow_started audit event is written', !!started)
  h.check('ANA-014', 'workflow_completed audit event is written', !!completed)
  h.check('ANA-015', 'task_escalated audit event is written', !!escalated)
  h.check('ANA-016', 'approver_inferred audit event is written', !!inferred)

  // ANA-017 filter by action returns only that action.
  h.check('ANA-017', 'Audit log filter narrows to the chosen action', !!started && (started.body?.logs || []).every((l) => l.action === 'workflow_started'), 'filter returned other actions')

  // ANA-018 pagination.
  const paged = await h.api('GET', '/audit-logs?page=1&limit=5', mgrTok)
  h.check('ANA-018', 'Audit log pagination works', paged.status === 200 && (paged.body?.logs || []).length <= 5 && typeof paged.body?.total === 'number' && (paged.body?.totalPages || 0) >= 1, `count ${paged.body?.logs?.length}, total ${paged.body?.total}, pages ${paged.body?.totalPages}`)
})

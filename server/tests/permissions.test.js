// PERM — API guards + role matrix (Roles & Permissions sheet).
// Frontend-only cases (sidebar nav visibility, client-side route redirects) are
// marked Pending with a reason; everything enforced at the API is asserted.

const h = require('./lib/harness')
const { runWithOrgId, Form, Workflow } = h

h.runSuite('permissions', async () => {
  const org = await h.createOrg('perm')

  const employee = await h.createUser(org, { name: 'Perm Employee', email: h.emailIn(org, 'perm-emp'), roleName: 'Employee', department: 'IT' })
  const empFinance = await h.createUser(org, { name: 'Perm Finance', email: h.emailIn(org, 'perm-fin'), roleName: 'Employee', department: 'Finance' })
  const manager = await h.createUser(org, { name: 'Perm Manager', email: h.emailIn(org, 'perm-mgr'), roleName: 'Manager' })
  const hr = await h.createUser(org, { name: 'Perm HR', email: h.emailIn(org, 'perm-hr'), roleName: 'HR' })
  const vp = await h.createUser(org, { name: 'Perm VP', email: h.emailIn(org, 'perm-vp'), roleName: 'VP' })
  const ceo = await h.createUser(org, { name: 'Perm CEO', email: h.emailIn(org, 'perm-ceo'), roleName: 'CEO' })

  const empTok = await h.getToken({ email: employee.email })
  const empFinTok = await h.getToken({ email: empFinance.email })
  const mgrTok = await h.getToken({ email: manager.email })
  const hrTok = await h.getToken({ email: hr.email })
  const vpTok = await h.getToken({ email: vp.email })
  const ceoTok = await h.getToken({ email: ceo.email })

  // Frontend-only nav / client route redirects.
  // Sidebar visibility and the client-side route guards are asserted in
  // ui_permissions.test.js, which upgrades these to Pass.
  for (const tc of ['PERM-001', 'PERM-002', 'PERM-004', 'PERM-005', 'PERM-006', 'PERM-008']) {
    h.note(tc, 'Pending', 'Frontend: covered by ui_permissions.test.js')
  }

  // PERM-003 — Viewer was the read-only seat that could sign in but not submit.
  // Shell 4 retired it: nobody held one, and a workspace whose only page is a
  // form you cannot fill in is not a product. The case is now that the seat
  // cannot be handed out at all.
  const catalogue = await h.api('GET', '/roles', empTok)
  const offered = (catalogue.body?.roles || []).map((r) => r.name)
  h.check('PERM-003', 'The read-only Viewer seat is no longer offered',
    !offered.includes('Viewer'), `got ${offered.join(',')}`)

  // PERM-007 — Employee cannot read a form's responses (builder-only).
  const empResp = await h.api('GET', '/forms/000000000000000000000000/responses', empTok)
  h.check('PERM-007', 'Employee blocked from /forms/:id/responses (403)', empResp.status === 403, `got ${empResp.status}`)

  // PERM-009 — Admin-only user management rejects an Employee token.
  const empCreateUser = await h.api('POST', '/users', empTok, { name: 'x', email: h.emailIn(org, 'x'), department: 'IT', roleId: '000000000000000000000000' })
  h.check('PERM-009', 'Employee token blocked from POST /users (403)', empCreateUser.status === 403, `got ${empCreateUser.status}`)

  // PERM-010 — no token → 401.
  const noTok = await h.api('GET', '/forms', null)
  h.check('PERM-010', 'No token → 401 on /forms', noTok.status === 401, `got ${noTok.status}`)

  // PERM-011 — Employee cannot create a workflow.
  const empWf = await h.api('POST', '/workflows', empTok, { title: 'nope' })
  h.check('PERM-011', 'Employee token blocked from POST /workflows (403)', empWf.status === 403, `got ${empWf.status}`)

  // PERM-012 — Manager (ops shell) cannot design forms/workflows; Org Admin can.
  const mgrForm = await h.api('POST', '/forms', mgrTok, { title: 'Mgr Form', fields: [] })
  const mgrWf = await h.api('POST', '/workflows', mgrTok, { title: 'Mgr WF', nodes: [] })
  h.check('PERM-012', 'Manager blocked from creating form + workflow (403)', mgrForm.status === 403 && mgrWf.status === 403, `form ${mgrForm.status}, wf ${mgrWf.status}`)

  const admin = await h.createUser(org, { name: 'Perm Admin', email: h.emailIn(org, 'perm-admin'), roleName: 'Admin' })
  const adminTok = await h.getToken({ email: admin.email })
  const adminForm = await h.api('POST', '/forms', adminTok, { title: 'Admin Form', fields: [] })
  const adminWf = await h.api('POST', '/workflows', adminTok, { title: 'Admin WF', nodes: [] })
  h.check('PERM-012', 'Org Admin can create form + workflow (201)', adminForm.status === 201 && adminWf.status === 201, `form ${adminForm.status}, wf ${adminWf.status}`)

  // PERM-013 — HR / VP / CEO are ops leaders: reports yes, builder no.
  const hrWf = await h.api('POST', '/workflows', hrTok, { title: 'HR WF', nodes: [] })
  const vpWf = await h.api('POST', '/workflows', vpTok, { title: 'VP WF', nodes: [] })
  const ceoWf = await h.api('POST', '/workflows', ceoTok, { title: 'CEO WF', nodes: [] })
  const hrKpis = await h.api('GET', '/analytics/department-kpis', hrTok)
  const vpKpis = await h.api('GET', '/analytics/department-kpis', vpTok)
  const ceoKpis = await h.api('GET', '/analytics/department-kpis', ceoTok)
  h.check('PERM-013', 'HR/VP/CEO cannot build workflows but can read reports',
    hrWf.status === 403 && vpWf.status === 403 && ceoWf.status === 403 &&
    hrKpis.status === 200 && vpKpis.status === 200 && ceoKpis.status === 200,
    `wf ${hrWf.status}/${vpWf.status}/${ceoWf.status}, kpis ${hrKpis.status}/${vpKpis.status}/${ceoKpis.status}`)
  // Employee is blocked from the detailed report (used again for ANA-011).
  const empKpis = await h.api('GET', '/analytics/department-kpis', empTok)
  h.check('PERM-013', 'Employee blocked from department-kpis (403)', empKpis.status === 403, `got ${empKpis.status}`)

  // PERM-014 — a non-assignee Employee cannot approve a task.
  const stray = await runWithOrgId(org._id, () => h.Task.create({
    title: 'Perm stray task', type: 'IT', status: 'pending',
    assignedTo: manager._id, submittedBy: manager._id
  }))
  const empApprove = await h.api('POST', `/tasks/${stray._id}/approve`, empTok, { comment: 'x' })
  h.check('PERM-014', 'Employee (non-approver) blocked from approve (403)', empApprove.status === 403, `got ${empApprove.status}`)

  // PERM-015 — department-scoped form visibility.
  const deptForm = await runWithOrgId(org._id, () => Form.create({
    title: 'Finance-only form', status: 'published', createdBy: manager._id,
    fields: [{ id: 'f1', type: 'text', label: 'F1' }]
  }))
  await runWithOrgId(org._id, () => Workflow.create({
    title: 'Finance visibility wf', status: 'published', createdBy: manager._id,
    linkedFormId: deptForm._id, nodes: [],
    access: { visibility: 'departments', departments: ['Finance'] }
  }))
  const itList = await h.api('GET', '/forms', empTok)
  const finList = await h.api('GET', '/forms', empFinTok)
  const itSees = (itList.body?.forms || []).some((f) => String(f._id) === String(deptForm._id))
  const finSees = (finList.body?.forms || []).some((f) => String(f._id) === String(deptForm._id))
  h.check('PERM-015', 'Dept-scoped form hidden from other dept, shown to owning dept', !itSees && finSees, `IT sees=${itSees}, Finance sees=${finSees}`)
})

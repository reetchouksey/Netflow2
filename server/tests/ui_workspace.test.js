// WS (UI) — Shell 4 chrome: what an employee actually lands on.
//
// workspace.test.js proves the API refuses what this shell hides. This proves
// the hiding: a four-item rail, a Forms page that reads as a catalogue of things
// you can ask for rather than a builder's table, requests you can track, and
// four URLs that bounce even when typed by hand.

const h = require('./lib/harness')
const u = require('./lib/uiHarness')

const TCS = ['WS-040', 'WS-041', 'WS-042', 'WS-043']

const WORKSPACE_HREFS = ['/dashboard', '/tasks', '/forms', '/profile']
const NOT_FOR_EMPLOYEES = ['/workflows', '/admin', '/analytics', '/audit-log', '/team', '/departments', '/roles', '/settings']

h.runSuite('ui_workspace', async () => {
  if (!(await u.frontendUp())) return u.skipAll(TCS, u.unavailableReason())

  const org = await h.createOrg('uiws')
  const admin = await h.createUser(org, {
    name: 'UI WS Admin', email: h.emailIn(org, 'uiws-admin'), roleName: 'Admin', department: 'IT'
  })
  const manager = await h.createUser(org, {
    name: 'UI WS Manager', email: h.emailIn(org, 'uiws-mgr'), roleName: 'Manager', department: 'Finance'
  })
  const employee = await h.createUser(org, {
    name: 'UI WS Employee', email: h.emailIn(org, 'uiws-emp'), roleName: 'Employee',
    department: 'Finance', managerId: manager._id
  })

  const empTok = await h.getToken({ email: employee.email })
  const adminTok = await h.getToken({ email: admin.email })

  // One form they can start, one draft they must not see.
  await h.runWithOrgId(org._id, () => h.Form.create({
    title: 'Expense reimbursement',
    description: 'Claim back something you paid for',
    status: 'published',
    department: 'Finance',
    fields: [{ id: 'amount', label: 'Amount', type: 'number', required: true }],
    createdBy: admin._id
  }))
  await h.runWithOrgId(org._id, () => h.Form.create({
    title: 'Half written policy form',
    status: 'draft',
    fields: [{ id: 'x', label: 'X', type: 'text' }],
    createdBy: admin._id
  }))

  // One request of their own, in flight with their manager.
  await h.runWithOrgId(org._id, () => h.Task.create({
    title: 'New laptop', type: 'Finance', status: 'pending',
    assignedTo: manager._id, submittedBy: employee._id
  }))
  // And one that belongs to somebody else entirely.
  await h.runWithOrgId(org._id, () => h.Task.create({
    title: 'Manager travel advance', type: 'Finance', status: 'pending',
    assignedTo: admin._id, submittedBy: manager._id
  }))

  const browser = await u.launch()
  try {
    const emp = await u.session(browser, { token: empTok, workspace: org.subdomain })

    // ── WS-040 — the workspace rail ──────────────────────────────────────────
    await u.goto(emp.page, '/dashboard')
    const links = await u.sidebarLinks(emp.page)
    const missing = WORKSPACE_HREFS.filter((href) => !u.hasLink(links, href))
    const leaked = NOT_FOR_EMPLOYEES.filter((href) => u.hasLink(links, href))

    h.check('WS-040', 'An employee\'s sidebar carries their dashboard, requests, forms and profile',
      missing.length === 0, `missing ${missing.join(', ')} — saw ${u.linkHrefs(links)}`)
    h.check('WS-040', 'An employee\'s sidebar hides everything they cannot use',
      leaked.length === 0, `leaked ${leaked.join(', ')}`)

    // ── WS-041 — the dashboard is about their own requests ───────────────────
    const dashText = await emp.page.locator('main').innerText().catch(() => '')
    h.check('WS-041', 'The dashboard opens on their own requests',
      /My Requests/i.test(dashText) && /New laptop/.test(dashText),
      `body: ${dashText.slice(0, 200).replace(/\s+/g, ' ')}`)

    h.check('WS-041', 'Starting a request is one click from home',
      await u.isVisible(emp.page, 'a[href="/forms"]:has-text("Start a request")'),
      'the header CTA never rendered')

    h.check('WS-041', 'None of the builder or leader panels leak in',
      !/Total Workflows/i.test(dashText) && !/Waiting on you/i.test(dashText),
      'a dashboard from another shell rendered')

    // ── WS-042 — Forms reads as a catalogue, not a builder's table ───────────
    await u.goto(emp.page, '/forms')
    await emp.page.waitForTimeout(800)
    const formsText = await emp.page.locator('main').innerText().catch(() => '')

    h.check('WS-042', 'The forms page offers requests they can start',
      /Expense reimbursement/.test(formsText) && /Start request/i.test(formsText),
      `body: ${formsText.slice(0, 240).replace(/\s+/g, ' ')}`)

    h.check('WS-042', 'A draft form is not offered to an employee',
      !/Half written policy form/.test(formsText), 'an unpublished form was listed')

    h.check('WS-042', 'The builder\'s controls are absent',
      !/New form/i.test(formsText) && !/Responses/i.test(formsText) && !/Submissions/i.test(formsText),
      `body: ${formsText.slice(0, 240).replace(/\s+/g, ' ')}`)

    // Their inbox opens on what they raised, and carries no team tab.
    await u.goto(emp.page, '/tasks')
    await emp.page.waitForTimeout(1000)
    const inboxText = await emp.page.locator('main').innerText().catch(() => '')
    h.check('WS-042', 'The inbox opens on the requests they raised',
      /New laptop/.test(inboxText) && !/Manager travel advance/.test(inboxText),
      `body: ${inboxText.slice(0, 240).replace(/\s+/g, ' ')}`)
    h.check('WS-042', 'There is no team tab for someone who leads nobody',
      !/My team/i.test(inboxText), 'the team scope was offered to an employee')

    // ── WS-043 — typing the URL gets you nowhere ─────────────────────────────
    for (const href of ['/analytics', '/audit-log', '/admin', '/workflows', '/forms/new']) {
      await u.goto(emp.page, href)
      h.check('WS-043', `An employee typing ${href} is sent back to the dashboard`,
        await u.landsOn(emp.page, '/dashboard'), `landed on ${await u.pathOf(emp.page)}`)
    }
    await emp.context.close()

    // The same pages must still open for the shell that owns them, or the guard
    // has simply been set too wide.
    const adm = await u.session(browser, { token: adminTok, workspace: org.subdomain })
    for (const href of ['/analytics', '/audit-log', '/admin']) {
      await u.goto(adm.page, href)
      h.check('WS-043', `An admin still reaches ${href}`,
        await u.landsOn(adm.page, href), `landed on ${await u.pathOf(adm.page)}`)
    }
    await adm.context.close()
  } finally {
    await browser.close()
  }
})

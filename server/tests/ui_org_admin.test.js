// OADMIN (UI) — Shell 2 chrome: the Org Admin sidebar, the configuration pages
// it leads to, and the fact that nobody else can open them.
//
// The API suite (org_admin.test.js) proves the rules; this proves the shell —
// that an admin can reach Departments, Roles and Organization from the rail, and
// that a Manager or Employee typing those URLs lands back on their dashboard.

const h = require('./lib/harness')
const u = require('./lib/uiHarness')

const TCS = ['OADMIN-030', 'OADMIN-031', 'OADMIN-032']

const ADMIN_HREFS = ['/dashboard', '/forms', '/workflows', '/analytics', '/audit-log', '/admin', '/departments', '/roles', '/settings']
const PLATFORM_HREFS = ['/platform', '/usage', '/activity', '/health', '/plans', '/admins']

h.runSuite('ui_org_admin', async () => {
  if (!(await u.frontendUp())) return u.skipAll(TCS, u.unavailableReason())

  const org = await h.createOrg('uioadm')
  const admin = await h.createUser(org, {
    name: 'UI Org Admin', email: h.emailIn(org, 'uioadm-admin'), roleName: 'Admin'
  })
  const employee = await h.createUser(org, {
    name: 'UI Org Employee', email: h.emailIn(org, 'uioadm-emp'), roleName: 'Employee', department: 'Sales'
  })
  const adminTok = await h.getToken({ email: admin.email })
  const empTok = await h.getToken({ email: employee.email })

  const browser = await u.launch()
  try {
    // ── OADMIN-030 — the Org Admin rail ──────────────────────────────────────
    const adm = await u.session(browser, { token: adminTok, workspace: org.subdomain })
    await u.goto(adm.page, '/dashboard')
    const links = await u.sidebarLinks(adm.page)
    const missing = ADMIN_HREFS.filter((href) => !u.hasLink(links, href))
    const leaked = PLATFORM_HREFS.filter((href) => u.hasLink(links, href))

    h.check('OADMIN-030', 'The Org Admin sidebar carries every workspace destination',
      missing.length === 0, `missing ${missing.join(', ')} — saw ${u.linkHrefs(links)}`)
    h.check('OADMIN-030', 'The Org Admin sidebar hides the platform console',
      leaked.length === 0, `leaked ${leaked.join(', ')}`)

    // ── OADMIN-031 — the three new pages actually render ─────────────────────
    await u.goto(adm.page, '/departments')
    const deptRow = adm.page.getByRole('listitem').filter({ hasText: 'Sales' }).first()
    await deptRow.waitFor({ timeout: 10000 }).catch(() => { /* asserted below */ })
    h.check('OADMIN-031', 'Departments lists the tenant\'s teams with their member counts',
      (await deptRow.count()) > 0 && /member/i.test(await deptRow.innerText().catch(() => '')),
      `row text: ${(await deptRow.innerText().catch(() => '(none)')).replace(/\s+/g, ' ')}`)

    // Adding a team from the dialog is the one write this suite performs; the
    // list it lands in is what every picker in the app reads.
    await adm.page.getByRole('button', { name: /new department/i }).first().click()
    await adm.page.waitForSelector('[role="dialog"]', { timeout: 10000 })
    await adm.page.locator('[role="dialog"] input').first().fill('Studio')
    await adm.page.getByRole('button', { name: /add department/i }).click()
    const added = await adm.page.getByRole('listitem').filter({ hasText: 'Studio' }).first()
      .waitFor({ timeout: 10000 }).then(() => true).catch(() => false)
    h.check('OADMIN-031', 'A department added in the dialog appears in the list',
      added, 'the new row never rendered')

    await u.goto(adm.page, '/roles')
    const matrix = adm.page.locator('table').first()
    await matrix.waitFor({ timeout: 10000 }).catch(() => { /* asserted below */ })
    const matrixText = await matrix.innerText().catch(() => '')
    h.check('OADMIN-031', 'Roles & permissions renders the capability matrix',
      /Admin/.test(matrixText) && /Employee/.test(matrixText) && !/SuperAdmin/.test(matrixText),
      `matrix: ${matrixText.slice(0, 160).replace(/\s+/g, ' ')}`)

    await u.goto(adm.page, '/settings')
    const nameField = adm.page.locator('input[value]').first()
    const settingsText = await adm.page.locator('body').innerText().catch(() => '')
    h.check('OADMIN-031', 'Organization settings shows the editable profile and the read-only plan',
      (await nameField.count()) > 0 && /Plan/.test(settingsText) && settingsText.includes(org.subdomain),
      `body: ${settingsText.slice(0, 160).replace(/\s+/g, ' ')}`)
    await adm.context.close()

    // ── OADMIN-032 — configuration is Admin-only in the browser too ──────────
    const emp = await u.session(browser, { token: empTok, workspace: org.subdomain })
    await u.goto(emp.page, '/dashboard')
    const empLinks = await u.sidebarLinks(emp.page)
    const empLeaked = ['/departments', '/roles', '/settings', '/admin'].filter((href) => u.hasLink(empLinks, href))
    h.check('OADMIN-032', 'An employee never sees the configuration section',
      empLeaked.length === 0, `leaked ${empLeaked.join(', ')} — saw ${u.linkHrefs(empLinks)}`)

    for (const href of ['/departments', '/roles', '/settings']) {
      await u.goto(emp.page, href)
      h.check('OADMIN-032', `An employee typing ${href} is sent back to the dashboard`,
        await u.landsOn(emp.page, '/dashboard'), `landed on ${await u.pathOf(emp.page)}`)
    }
    await emp.context.close()
  } finally {
    await browser.close()
  }
})

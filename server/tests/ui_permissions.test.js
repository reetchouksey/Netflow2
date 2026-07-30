// PERM (UI) — sidebar visibility + client-side route guards.
//
// The API-side role matrix lives in permissions.test.js; these are the cases
// that only exist in the browser. Nav filtering happens in AppShell's
// visibleSections(), and the route guards are <RequireRole> wrappers in
// App.jsx that redirect with <Navigate replace>.

const h = require('./lib/harness')
const u = require('./lib/uiHarness')

const TCS = ['PERM-001', 'PERM-002', 'PERM-004', 'PERM-005', 'PERM-006', 'PERM-008']

h.runSuite('ui_permissions', async () => {
  if (!(await u.frontendUp())) return u.skipAll(TCS, u.unavailableReason())

  const org = await h.createOrg('uiperm')
  const admin = await h.createUser(org, {
    name: 'UI Perm Admin', email: h.emailIn(org, 'uiperm-admin'), roleName: 'Admin'
  })
  const employee = await h.createUser(org, {
    name: 'UI Perm Employee', email: h.emailIn(org, 'uiperm-emp'), roleName: 'Employee'
  })

  const adminTok = await h.getToken({ email: admin.email })
  const empTok = await h.getToken({ email: employee.email })

  const browser = await u.launch()
  try {
    // ── PERM-001 — Admin sees every nav item ────────────────────────────────
    {
      const { context, page } = await u.session(browser, { token: adminTok, workspace: org.subdomain })
      await u.goto(page, '/dashboard')
      const links = await u.sidebarLinks(page)
      const expected = ['/dashboard', '/forms', '/workflows', '/analytics', '/audit-log', '/admin']
      const missing = expected.filter((href) => !u.hasLink(links, href))
      h.check('PERM-001', 'Admin sidebar shows Dashboard, Forms, Workflows, Analytics, Audit, Users',
        missing.length === 0, `missing ${missing.join(', ')} — saw ${u.linkHrefs(links)}`)

      h.check('PERM-001', 'Admin sidebar hides Tasks (ops shell only) and Platform',
        !u.hasLink(links, '/tasks') && !u.hasLink(links, '/platform'),
        `saw ${u.linkHrefs(links)}`)
      await context.close()
    }

    // ── PERM-002 — Employee nav is limited ──────────────────────────────────
    {
      const { context, page } = await u.session(browser, { token: empTok, workspace: org.subdomain })
      await u.goto(page, '/dashboard')
      const links = await u.sidebarLinks(page)

      const hidden = ['/workflows', '/analytics', '/audit-log', '/admin']
      const leaked = hidden.filter((href) => u.hasLink(links, href))
      h.check('PERM-002', 'Employee sidebar hides Workflows, Analytics, Audit log, Admin Panel',
        leaked.length === 0, `leaked ${leaked.join(', ')} — saw ${u.linkHrefs(links)}`)

      const shown = ['/dashboard', '/forms', '/tasks', '/profile']
      const absent = shown.filter((href) => !u.hasLink(links, href))
      h.check('PERM-002', 'Employee still sees Dashboard, Forms, request queue and Profile',
        absent.length === 0, `missing ${absent.join(', ')} — saw ${u.linkHrefs(links)}`)

      // Workspace shell labels the queue "My Requests".
      const tasks = links.find((l) => l.href === '/tasks')
      h.check('PERM-002', 'Task queue is labelled "My Requests" for an Employee',
        /my requests/i.test(tasks?.label || ''), `label was "${tasks?.label}"`)
      await context.close()
    }

    // ── PERM-004 / 005 / 008 — guarded routes bounce to the dashboard ───────
    {
      const { context, page } = await u.session(browser, { token: empTok, workspace: org.subdomain })

      const guarded = [
        ['PERM-004', '/workflows', 'canCreateWorkflow'],
        ['PERM-005', '/workflows/new', 'canCreateWorkflow'],
        ['PERM-008', '/admin', 'canManageUsers']
      ]
      for (const [tc, route, guard] of guarded) {
        await u.goto(page, route)
        const landed = await u.landsOn(page, '/dashboard')
        h.check(tc, `Employee opening ${route} directly is redirected to the dashboard (${guard})`,
          landed, `landed on ${await u.pathOf(page)}`)
      }
      await context.close()
    }

    // ── PERM-006 — /admin is blocked for a non-admin ────────────────────────
    // /admin is only wrapped in <RequireAuth>; AdminPanel does the role check
    // itself and renders an "Admins only" card, so the check is "blocked",
    // not "redirected".
    {
      const { context, page } = await u.session(browser, { token: empTok, workspace: org.subdomain })
      await u.goto(page, '/admin')

      const denied = await page.locator('text=Admins only').first().isVisible().catch(() => false)
      const noUserTable = !(await u.isVisible(page, 'table'))
      h.check('PERM-006', 'Employee opening /admin directly is blocked by the "Admins only" gate',
        denied, `page showed: ${(await page.locator('body').innerText()).slice(0, 120).replace(/\s+/g, ' ')}`)
      h.check('PERM-006', 'Blocked admin page does not render the user table',
        noUserTable, 'a table was rendered for a non-admin')
      await context.close()
    }
  } finally {
    await browser.close()
  }
})

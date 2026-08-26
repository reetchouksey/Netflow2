// PLAT (UI) — the Super Admin platform panel: nav visibility, the client route
// guard, the new-organization dialog, the one-time credentials copy, and the
// type-the-name delete confirmation.
//
// The API side (403s, cascade delete, backups, usage counters) is covered by
// platform_orgs.test.js. Everything here is browser-only.

const h = require('./lib/harness')
const u = require('./lib/uiHarness')
const { Organization, User } = h

const TCS = ['PLAT-001', 'PLAT-002', 'PLAT-008', 'PLAT-014', 'PLAT-023', 'PLAT-024', 'PLAT-030', 'PDASH-013', 'PDASH-014']

// The platform shell owns exactly these destinations — anything workspace-side
// (forms, workflows, requests, reports, user admin) belongs to a tenant.
const PLATFORM_HREFS = ['/dashboard', '/platform', '/usage', '/activity', '/health', '/plans', '/admins']
const WORKSPACE_HREFS = ['/forms', '/workflows', '/tasks', '/analytics', '/audit-log', '/admin']

const SA_EMAIL = (process.env.SUPERADMIN_EMAIL || 'superadmin@netflow.app').toLowerCase()
const SA_PASS = process.env.SUPERADMIN_PASSWORD || 'Super@12345'

const openDeleteDialog = async (page, orgName) => {
  // Grid view (default): delete lives in the card's ⋯ menu.
  const card = page.locator('article', { hasText: orgName }).first()
  if (await card.count()) {
    await card.getByRole('button', { name: /more actions/i }).click()
    await page.getByRole('menuitem', { name: /delete organization/i }).click()
  } else {
    const row = page.locator('tr', { hasText: orgName }).first()
    await row.getByRole('button', { name: /^delete$/i }).click()
  }
  await page.waitForSelector(`text=Delete ${orgName}?`, { timeout: 10000 })
}

h.runSuite('ui_platform', async () => {
  if (!(await u.frontendUp())) return u.skipAll(TCS, u.unavailableReason())

  const saTok = await h.getToken({ email: SA_EMAIL, password: SA_PASS })
  if (!saTok) {
    h.check('PLAT-001', 'SuperAdmin token obtained (seed the superadmin first)', false, 'no token')
    return
  }

  const org = await h.createOrg('uiplat')
  const manager = await h.createUser(org, {
    name: 'UI Plat Manager', email: h.emailIn(org, 'uiplat-mgr'), roleName: 'Manager'
  })
  const mgrTok = await h.getToken({ email: manager.email })

  // Created through the UI below, then deleted through the UI again.
  const newOrgName = `QA UI Plat ${Date.now().toString(36)}`
  const newOrgSub = `${h.QA_SUB_PREFIX}uiplat-${Date.now().toString(36)}`
  const newOrgAdmin = `uiplat-admin-${Date.now().toString(36)}@${h.QA_EMAIL_DOMAIN}`
  let createdOrgId = null
  const findCreated = () => Organization.findOne({ name: newOrgName })
    .setOptions({ skipOrgScope: true }).lean()

  const browser = await u.launch()
  try {
    // ── PLAT-001 / PLAT-002 — who can see and reach the panel ───────────────
    {
      const sa = await u.session(browser, { token: saTok })
      await u.goto(sa.page, '/dashboard')
      const saLinks = await u.sidebarLinks(sa.page)
      h.check('PLAT-001', 'A Super Admin sees the Platform item in the sidebar',
        u.hasLink(saLinks, '/platform'), `sidebar: ${u.linkHrefs(saLinks)}`)
      await sa.page.getByRole('heading', { name: /platform dashboard/i }).waitFor({ timeout: 10000 })
      h.check('PDASH-013', 'Real-data dashboard renders its analytics and adoption controls',
        (await sa.page.getByLabel('Lifecycle metric').count()) === 1 &&
        (await sa.page.getByText('Product adoption', { exact: true }).count()) === 1)

      const newOrgLink = sa.page.getByRole('link', { name: /new org/i })
      const newOrgHref = await newOrgLink.getAttribute('href')
      await u.goto(sa.page, '/platform?new=1')
      const createName = sa.page.getByPlaceholder('Acme Corp')
      await createName.waitFor({ timeout: 10000 })
      h.check('PDASH-014', 'Dashboard New org action opens the existing creation dialog',
        newOrgHref === '/platform?new=1' && (await createName.count()) === 1)
      await sa.page.keyboard.press('Escape')

      const landedSa = await u.goto(sa.page, '/platform')
      h.check('PLAT-002', 'A Super Admin can open /platform',
        landedSa === '/platform', `landed on ${landedSa}`)

      // ── PLAT-030 — the platform shell never shows or opens workspace pages ──
      await u.goto(sa.page, '/dashboard')
      const shellLinks = await u.sidebarLinks(sa.page)
      const missingPlatform = PLATFORM_HREFS.filter((href) => !u.hasLink(shellLinks, href))
      const leakedWorkspace = WORKSPACE_HREFS.filter((href) => u.hasLink(shellLinks, href))
      h.check('PLAT-030', 'The platform sidebar carries every console destination',
        missingPlatform.length === 0, `missing ${missingPlatform.join(', ')} — saw ${u.linkHrefs(shellLinks)}`)
      h.check('PLAT-030', 'The platform sidebar hides every workspace destination',
        leakedWorkspace.length === 0, `leaked ${leakedWorkspace.join(', ')}`)

      for (const href of ['/forms', '/tasks', '/admin', '/analytics']) {
        await u.goto(sa.page, href)
        h.check('PLAT-030', `A Super Admin typing ${href} is sent back to the console`,
          await u.landsOn(sa.page, '/dashboard'), `landed on ${await u.pathOf(sa.page)}`)
      }

      // Global search has no requests or forms to offer here, so it looks up
      // tenants and lands on the organizations list filtered to the match.
      await u.goto(sa.page, '/dashboard')
      const searchBox = sa.page.getByRole('combobox', { name: /search organizations/i })
      await searchBox.fill(org.subdomain)
      const orgResult = sa.page.getByRole('option').filter({ hasText: org.name }).first()
      await orgResult.waitFor({ timeout: 10000 }).catch(() => { /* asserted below */ })
      h.check('PLAT-030', 'Global search offers the matching tenant',
        (await orgResult.count()) > 0, `no result for ${org.subdomain}`)

      if (await orgResult.count()) {
        await orgResult.click()
        await sa.page.waitForTimeout(800)
        const landedSearch = await sa.page.evaluate(() => location.pathname + location.search)
        h.check('PLAT-030', 'Choosing a tenant opens the organizations list filtered to it',
          landedSearch.startsWith('/platform?q='), `landed on ${landedSearch}`)
      }

      await sa.context.close()

      const mgr = await u.session(browser, { token: mgrTok, workspace: org.subdomain })
      await u.goto(mgr.page, '/dashboard')
      const mgrLinks = await u.sidebarLinks(mgr.page)
      h.check('PLAT-001', 'A non-Super-Admin does not see the Platform item',
        !u.hasLink(mgrLinks, '/platform'), `sidebar: ${u.linkHrefs(mgrLinks)}`)

      await u.goto(mgr.page, '/platform')
      const landedMgr = await u.landsOn(mgr.page, '/dashboard')
      h.check('PLAT-002', 'A non-Super-Admin typing /platform is sent back to the dashboard',
        landedMgr, `landed on ${await u.pathOf(mgr.page)}`)
      await mgr.context.close()
    }

    // ── PLAT-008 / PLAT-014 — create an org, then copy its one-time password ─
    {
      // Clipboard reads need explicit permission in Chromium.
      const { context, page } = await u.session(browser, {
        token: saTok,
        permissions: ['clipboard-read', 'clipboard-write']
      })
      await u.goto(page, '/platform')
      await page.getByRole('button', { name: /new organization/i }).click()
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 })

      const dialog = page.locator('[role="dialog"]').first()
      const body = await dialog.innerText()
      const fields = ['Name', 'Subdomain', 'Allowed email domains', 'First org admin', 'Admin email']
      const missing = fields.filter((f) => !body.includes(f))
      h.check('PLAT-008', 'The new-organization dialog opens with every field it needs',
        (await dialog.count()) > 0 && missing.length === 0, `missing: ${missing.join(', ')}`)
      h.check('PLAT-008', 'The dialog offers to create rather than save an existing org',
        /Create organization/.test(body), 'no "Create organization" action in the dialog')

      await dialog.locator('input[placeholder="Acme Corp"]').fill(newOrgName)
      await dialog.locator('input[placeholder="acme"]').fill(newOrgSub)
      await dialog.locator('input[placeholder="admin@acme.com"]').fill(newOrgAdmin)
      // Wait on the request, not on modal text: the form itself mentions the
      // temporary password, so a text match would resolve before submitting.
      await Promise.all([
        page.waitForResponse(
          (r) => /\/api\/platform\/orgs$/.test(r.url()) && r.request().method() === 'POST',
          { timeout: 30000 }
        ),
        dialog.getByRole('button', { name: /create organization/i }).click()
      ])
      await page.waitForSelector('text=Organization created', { timeout: 20000 })
      const created = await Organization.findOne({ name: newOrgName })
        .setOptions({ skipOrgScope: true }).lean()
      createdOrgId = created?._id || null
      h.check('PLAT-008', 'Submitting the dialog actually creates the tenant',
        !!created && created.subdomain === newOrgSub,
        `db org: ${created ? `${created.name} @ ${created.subdomain}` : 'not found'} (sent ${newOrgSub})`)

      const shown = await page.locator('p.font-mono').first().innerText()
      await page.getByRole('button', { name: /^copy$/i }).nth(1).click()
      await page.waitForTimeout(500)
      const clip = await page.evaluate(() => navigator.clipboard.readText())
      h.check('PLAT-014', 'Copy puts the one-time temporary password on the clipboard',
        clip.length > 0 && clip === shown.trim(), `clipboard "${clip}" vs shown "${shown.trim()}"`)

      await page.getByRole('button', { name: /^done$/i }).click()
      await page.waitForTimeout(500)
      await context.close()
    }

    // ── PLAT-023 / PLAT-024 — deleting a tenant is deliberately hard ─────────
    {
      const { context, page } = await u.session(browser, { token: saTok })
      await u.goto(page, '/platform')
      await page.waitForSelector(`text=${newOrgName}`, { timeout: 20000 })

      // PLAT-024 — cancel leaves everything alone.
      await openDeleteDialog(page, newOrgName)
      await page.getByRole('button', { name: /^cancel$/i }).click()
      await page.waitForTimeout(600)
      const afterCancel = await findCreated()
      h.check('PLAT-024', 'Cancelling the delete dialog closes it and deletes nothing',
        (await page.locator(`text=Delete ${newOrgName}?`).count()) === 0 && !!afterCancel,
        `dialog still open or org gone (${!!afterCancel})`)

      // PLAT-023 — the button only arms on an exact name match.
      await openDeleteDialog(page, newOrgName)
      const confirmBtn = page.getByRole('button', { name: /delete organization/i })
      h.check('PLAT-023', 'Delete is disabled until the org name is typed',
        await confirmBtn.isDisabled(), 'the delete button was armed with an empty confirmation')

      // The delete modal is a `danger` one, so its role is alertdialog.
      const nameInput = page.locator('[role="alertdialog"] input').last()
      await nameInput.fill(`${newOrgName} wrong`)
      await page.waitForTimeout(300)
      h.check('PLAT-023', 'A near-miss name does not arm the delete button',
        await confirmBtn.isDisabled(), 'the delete button armed on a name that does not match')

      await nameInput.fill(newOrgName)
      await page.waitForTimeout(300)
      h.check('PLAT-023', 'The exact org name arms the delete button',
        !(await confirmBtn.isDisabled()), 'the delete button stayed disabled on an exact match')

      await confirmBtn.click()
      await page.waitForTimeout(2500)
      const gone = await findCreated()
      const strays = await User.find({ orgId: createdOrgId }).setOptions({ skipOrgScope: true }).lean()
      h.check('PLAT-023', 'Confirming deletes the tenant and cascades to its users',
        !gone && strays.length === 0,
        `org ${gone ? 'still present' : 'deleted'}, ${strays.length} users left behind`)

      await context.close()
    }
  } finally {
    await browser.close()
  }
})

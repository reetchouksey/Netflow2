// TSK (UI) — inbox search, attachment links, the approve button's busy state
// and the escalated badge colour.
//
// The approve/reject engine itself is covered by tasks_approvals.test.js; what
// is left here is what the API can't answer: my-tasks has no name filter (the
// search is client-side), and the rest is rendering.

const h = require('./lib/harness')
const u = require('./lib/uiHarness')
const { runWithOrgId, Task, Form, FormResponse } = h

const TCS = ['TSK-004', 'TSK-009', 'TSK-013', 'TSK-023']

h.runSuite('ui_tasks', async () => {
  if (!(await u.frontendUp())) return u.skipAll(TCS, u.unavailableReason())

  const org = await h.createOrg('uitsk')
  const approver = await h.createUser(org, {
    name: 'UI Tsk Approver', email: h.emailIn(org, 'uitsk-appr'), roleName: 'Manager'
  })
  const submitter = await h.createUser(org, {
    name: 'UI Tsk Submitter', email: h.emailIn(org, 'uitsk-sub'), roleName: 'Employee'
  })
  const apprTok = await h.getToken({ email: approver.email })

  const mkTask = (extra) => runWithOrgId(org._id, () => Task.create({
    title: 'UI task', type: 'IT', status: 'pending',
    assignedTo: approver._id, submittedBy: submitter._id, ...extra
  }))

  await mkTask({ title: 'Laptop refresh request' })
  await mkTask({ title: 'Travel reimbursement' })
  await mkTask({ title: 'Overdue budget sign-off', status: 'escalated' })

  // A real upload so the attachment link resolves to a real file rather than a
  // 404 — "downloads/previews" is only proven if the bytes come back.
  const uploaded = await u.uploadFile(apprTok, { name: 'invoice.png', buf: u.PNG_1PX })
  const form = await runWithOrgId(org._id, () => Form.create({
    title: 'UI Tsk form', status: 'published', createdBy: approver._id,
    fields: [{ id: 'invoice', type: 'file', label: 'Invoice scan' }]
  }))
  const response = await runWithOrgId(org._id, () => FormResponse.create({
    formId: form._id, submittedBy: submitter._id, status: 'submitted',
    formData: { invoice: { name: uploaded.name, url: uploaded.url } }
  }))
  const fileTask = await mkTask({ title: 'Invoice approval', formResponseId: response._id })
  const approveTask = await mkTask({ title: 'Busy state check' })

  const browser = await u.launch()
  try {
    // ── TSK-004 — the inbox search filters by task name ─────────────────────
    {
      const { context, page } = await u.session(browser, { token: apprTok, workspace: org.subdomain })
      await u.goto(page, '/tasks')
      await page.waitForSelector('#task-search', { timeout: 20000 })
      await page.waitForTimeout(800)

      const visibleTitles = async () => {
        const body = await page.locator('main').innerText().catch(async () => page.locator('body').innerText())
        return body
      }

      const before = await visibleTitles()
      h.check('TSK-004', 'Both tasks are listed before searching',
        before.includes('Laptop refresh request') && before.includes('Travel reimbursement'),
        'inbox did not list the seeded tasks')

      await page.fill('#task-search', 'Laptop')
      await page.waitForTimeout(700)
      const after = await visibleTitles()
      h.check('TSK-004', 'Searching a task name keeps the match and drops the rest',
        after.includes('Laptop refresh request') && !after.includes('Travel reimbursement'),
        'search did not narrow the list')

      // A term nothing matches should say so rather than silently showing all.
      await page.fill('#task-search', 'zzzz-no-such-task')
      await page.waitForTimeout(700)
      const empty = await visibleTitles()
      h.check('TSK-004', 'A search with no matches shows the empty state',
        /nothing matches/i.test(empty), 'no empty state for an unmatched search')

      await context.close()
    }

    // ── TSK-023 — an escalated task wears the orange badge ──────────────────
    {
      const { context, page } = await u.session(browser, { token: apprTok, workspace: org.subdomain })
      await u.goto(page, '/tasks')
      await page.waitForSelector('#task-search', { timeout: 20000 })
      await page.fill('#task-search', 'Overdue budget')
      await page.waitForTimeout(700)

      const badge = page.locator('span', { hasText: /^Escalated$/ }).first()
      const shown = (await badge.count()) > 0
      const cls = shown ? await badge.getAttribute('class') : ''
      h.check('TSK-023', 'An escalated task shows an "Escalated" badge',
        shown, 'no Escalated badge in the inbox')
      h.check('TSK-023', 'The escalated badge is styled orange',
        /orange/.test(cls || ''), `badge classes: ${cls}`)

      await context.close()
    }

    // ── TSK-009 — submitted attachments open ────────────────────────────────
    {
      const { context, page } = await u.session(browser, { token: apprTok, workspace: org.subdomain })
      await u.goto(page, `/tasks/${fileTask._id}`)
      await page.waitForSelector('text=Invoice approval', { timeout: 20000 })

      const link = page.locator(`a[href*="${uploaded.url}"]`).first()
      const hasLink = (await link.count()) > 0
      h.check('TSK-009', 'A submitted file renders as an openable link on the task detail',
        hasLink, `no link pointing at ${uploaded.url}`)

      if (hasLink) {
        const label = (await link.innerText()).trim()
        h.check('TSK-009', 'The attachment link is labelled with the uploaded file name',
          label.includes('invoice.png'), `link read "${label}"`)

        // Fetch it the way the browser would, from inside the page's origin.
        const href = await link.getAttribute('href')
        const fetched = await page.evaluate(async (url) => {
          const r = await fetch(url)
          const b = await r.arrayBuffer()
          return { status: r.status, bytes: b.byteLength, type: r.headers.get('content-type') || '' }
        }, href)
        h.check('TSK-009', 'Opening the attachment serves the real file',
          fetched.status === 200 && fetched.bytes === u.PNG_1PX.length,
          `status ${fetched.status}, ${fetched.bytes} bytes (expected ${u.PNG_1PX.length}), type ${fetched.type}`)
      }

      await context.close()
    }

    // ── TSK-013 — the approve button shows progress and blocks double-submit ─
    {
      const { context, page } = await u.session(browser, { token: apprTok, workspace: org.subdomain })

      // Hold the approve response open so the busy state is observable instead
      // of a sub-100ms flicker.
      let approveCalls = 0
      await page.route('**/api/tasks/*/approve', async (route) => {
        approveCalls++
        await new Promise((r) => setTimeout(r, 2000))
        await route.continue()
      })

      await u.goto(page, '/tasks')
      await page.waitForSelector('#task-search', { timeout: 20000 })
      await page.fill('#task-search', 'Busy state check')
      await page.waitForTimeout(700)

      // Pin the DOM node before clicking: a by-name locator stops matching the
      // moment the label flips to "Approving…", and would silently re-resolve
      // to some other button.
      const approveBtn = await page.getByRole('button', { name: /^approve$/i }).first().elementHandle()
      await approveBtn.click()
      await page.waitForTimeout(500)

      const label = (await approveBtn.innerText()).trim()
      const disabled = await approveBtn.isDisabled()
      h.check('TSK-013', 'The approve button switches to "Approving…" while the request is in flight',
        /approving/i.test(label), `button read "${label}"`)
      h.check('TSK-013', 'The approve button is disabled while busy, so it cannot double-submit',
        disabled, 'button stayed clickable during the request')

      // Clicking again while busy must not fire a second approve.
      await approveBtn.click({ force: true, timeout: 2000 }).catch(() => { /* disabled */ })
      await page.waitForTimeout(300)
      h.check('TSK-013', 'A second click while busy sends no extra approve request',
        approveCalls === 1, `${approveCalls} approve requests were sent`)

      // And it settles: the task ends up approved.
      const settled = await h.waitUntil(async () => {
        const t = await runWithOrgId(org._id, () => Task.findById(approveTask._id).lean())
        return t?.status === 'approved' ? t : null
      })
      h.check('TSK-013', 'The approval completes once the request returns',
        Boolean(settled), 'task never reached approved')

      await context.close()
    }
  } finally {
    await browser.close()
  }
})

// ANA (UI) — the analytics CSV and PDF exports.
//
// Both files are built in the browser (a Blob for CSV, jsPDF for PDF) and never
// touch the server, so analytics_audit.test.js cannot see them. Here the export
// is actually triggered, the download captured and the file opened.

const fs = require('fs')
const h = require('./lib/harness')
const u = require('./lib/uiHarness')
const { runWithOrgId, Task } = h

const TCS = ['ANA-008', 'ANA-009']

const openExportMenu = async (page) => {
  await page.getByRole('button', { name: /^export$/i }).click()
  await page.waitForSelector('[role="menu"][aria-label="Export format"]', { timeout: 10000 })
}

h.runSuite('ui_analytics', async () => {
  if (!(await u.frontendUp())) return u.skipAll(TCS, u.unavailableReason())

  const org = await h.createOrg('uiana')
  const manager = await h.createUser(org, {
    name: 'UI Ana Manager', email: h.emailIn(org, 'uiana-mgr'), roleName: 'Manager'
  })
  const employee = await h.createUser(org, {
    name: 'UI Ana Employee', email: h.emailIn(org, 'uiana-emp'), roleName: 'Employee'
  })
  const token = await h.getToken({ email: manager.email })

  // A little resolved history so the export has rows rather than only headers.
  const mk = (extra) => runWithOrgId(org._id, () => Task.create({
    title: 'Ana task', type: 'IT', assignedTo: manager._id, submittedBy: employee._id, ...extra
  }))
  await mk({ status: 'approved', completedAt: new Date() })
  await mk({ status: 'approved', completedAt: new Date() })
  await mk({ status: 'rejected', completedAt: new Date() })
  await mk({ status: 'pending' })

  const browser = await u.launch()
  try {
    const { context, page } = await u.session(browser, { token, workspace: org.subdomain })
    await u.goto(page, '/analytics')
    await page.waitForSelector('button:has-text("Export")', { timeout: 20000 })
    // The menu is disabled until the summary endpoints resolve.
    await page.waitForFunction(
      () => ![...document.querySelectorAll('button')]
        .find((b) => b.textContent.trim() === 'Export')?.disabled,
      null,
      { timeout: 20000 }
    )

    // ── ANA-008 — CSV export ────────────────────────────────────────────────
    {
      await openExportMenu(page)
      const dl = await u.captureDownload(page, () =>
        page.getByRole('menuitem', { name: /CSV/i }).click())

      h.check('ANA-008', 'The CSV export downloads a .csv named after the selected range',
        /^analytics-.*\.csv$/.test(dl.name), `filename "${dl.name}"`)

      const text = fs.readFileSync(dl.path, 'utf8')
      const headers = ['Metric,Value', 'Month,Avg completion (h)', 'Outcome,Percentage',
        'Department,Approval rate', 'Week,SLA breaches']
      const missing = headers.filter((sec) => !text.includes(sec))
      h.check('ANA-008', 'The CSV contains every analytics section',
        missing.length === 0, `missing sections: ${missing.join(' | ')}`)
      h.check('ANA-008', 'The CSV carries the KPI values, not just headings',
        /APPROVAL RATE,/.test(text) && /SLA BREACHES,/.test(text),
        `first rows: ${text.split('\n').slice(0, 4).join(' / ')}`)

      fs.unlinkSync(dl.path)
    }

    // ── ANA-009 — PDF export ────────────────────────────────────────────────
    {
      await openExportMenu(page)
      const dl = await u.captureDownload(page, () =>
        page.getByRole('menuitem', { name: /PDF/i }).click())

      h.check('ANA-009', 'The PDF export downloads a .pdf named after the selected range',
        /^analytics-.*\.pdf$/.test(dl.name), `filename "${dl.name}"`)

      const buf = fs.readFileSync(dl.path)
      h.check('ANA-009', 'The downloaded file is a real PDF, not an empty or broken blob',
        buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 1000,
        `${buf.length} bytes, header "${buf.subarray(0, 5).toString()}"`)

      // The report title is written as plain text, so it survives in the raw
      // stream — enough to prove content was rendered, not a blank page.
      const raw = buf.toString('latin1')
      h.check('ANA-009', 'The PDF carries the report heading',
        /Analytics Report/.test(raw), 'report title not found in the PDF stream')

      fs.unlinkSync(dl.path)
    }

    await context.close()
  } finally {
    await browser.close()
  }
})

/**
 * Capture NetFlow UI screenshots into docs/public/screenshots/guide/
 * Prerequisites: API :5000, frontend :5174
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'public', 'screenshots', 'guide')
const BASE = process.env.APP_URL || 'http://localhost:5174'
const VIEW = { width: 1440, height: 900 }

const SA = {
  email: process.env.SA_EMAIL || 'superadmin@netflow.app',
  password: process.env.SA_PASSWORD || 'Super@12345'
}
const MGR = {
  email: process.env.MGR_EMAIL || 'docs.manager@netlink.com',
  password: process.env.MGR_PASSWORD || 'Demo@12345',
  org: process.env.MGR_ORG || 'netlink'
}

fs.mkdirSync(OUT, { recursive: true })

async function shot(page, name) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
  console.log('✓', name, '←', page.url())
}

async function uiLogin(page, { email, password, org }) {
  const url = org ? `${BASE}/login?org=${encodeURIComponent(org)}` : `${BASE}/login`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    // Drop any remembered workspace unless this login set ?org=
    if (!location.search.includes('org=')) localStorage.removeItem('netflow_workspace')
  })
  if (!org) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  }
  await page.fill('#email', email)
  await page.fill('#password', password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }),
    page.click('button[type="submit"]')
  ])
  await page.waitForTimeout(1000)
  if (page.url().includes('/login')) {
    const err = await page.locator('text=/invalid|error|locked|suspended/i').first().textContent().catch(() => '')
    throw new Error(`Still on login for ${email}: ${err}`)
  }
}

async function safeGoto(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(800)
  if (page.url().includes('/login')) {
    throw new Error(`Redirected to login while opening ${route}`)
  }
}

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first()
    if ((await loc.count()) > 0 && await loc.isVisible().catch(() => false)) {
      await loc.click()
      return true
    }
  }
  return false
}

async function capturePublic(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await shot(page, 'login')

  await page.goto(`${BASE}/login?org=netlink`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot(page, 'login-workspace')

  await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' })
  await shot(page, 'forgot-password')

  await page.goto(`${BASE}/reset-password?token=invalid`, { waitUntil: 'networkidle' })
  await shot(page, 'reset-password')
}

async function captureSuperAdmin(page) {
  await uiLogin(page, SA)
  await shot(page, 'dashboard-superadmin')

  await safeGoto(page, '/platform')
  await shot(page, 'organizations')
  fs.copyFileSync(path.join(OUT, 'organizations.png'), path.join(OUT, 'platform-orgs.png'))

  await safeGoto(page, '/activity')
  await shot(page, 'activity')

  await safeGoto(page, '/health')
  await shot(page, 'health')

  await safeGoto(page, '/change-password')
  await shot(page, 'change-password')

  await safeGoto(page, '/profile')
  await shot(page, 'profile')

  await safeGoto(page, '/usage')
  await shot(page, 'usage')

  await safeGoto(page, '/plans')
  await shot(page, 'plans')

  await safeGoto(page, '/admins')
  await shot(page, 'admins')

  await safeGoto(page, '/dms')
  await shot(page, 'dms')
}

async function captureManager(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await uiLogin(page, MGR)
  await shot(page, 'dashboard-builder')
  fs.copyFileSync(path.join(OUT, 'dashboard-builder.png'), path.join(OUT, 'dashboard-employee.png'))

  await safeGoto(page, '/forms')
  await shot(page, 'forms-list')

  await safeGoto(page, '/forms/new')
  await shot(page, 'forms-new')
  await shot(page, 'forms-builder')

  await safeGoto(page, '/forms')
  await clickFirst(page, ['a[href*="/fill"]', 'a:has-text("Fill")', 'button:has-text("Fill")'])
  await page.waitForTimeout(800)
  await shot(page, 'forms-fill')

  await safeGoto(page, '/forms')
  await clickFirst(page, ['a[href*="/responses"]', 'a:has-text("Responses")'])
  await page.waitForTimeout(800)
  await shot(page, 'forms-responses')

  await safeGoto(page, '/forms')
  await clickFirst(page, ['button:has-text("Share")', 'a:has-text("Share")'])
  await page.waitForTimeout(600)
  await shot(page, 'forms-share')

  await safeGoto(page, '/workflows')
  await shot(page, 'workflows-list')

  await safeGoto(page, '/workflows/new')
  await shot(page, 'workflows-wizard')
  await shot(page, 'workflows-canvas')
  await shot(page, 'workflows-settings')
  await shot(page, 'workflows-publish')

  await safeGoto(page, '/workflows')
  await clickFirst(page, ['a:has-text("Executions")', 'button:has-text("Executions")'])
  await page.waitForTimeout(700)
  await shot(page, 'workflows-executions')

  await safeGoto(page, '/tasks')
  await shot(page, 'tasks-inbox')

  await clickFirst(page, ['a[href^="/tasks/"]'])
  await page.waitForTimeout(900)
  await shot(page, 'tasks-detail')
  await shot(page, 'tasks-approve')
  await shot(page, 'tasks-committee')

  await safeGoto(page, '/notifications')
  await shot(page, 'notifications-list')
  await shot(page, 'notifications-bell')

  await safeGoto(page, '/analytics')
  await shot(page, 'analytics-overview')

  await safeGoto(page, '/audit-log')
  await shot(page, 'audit-log')

  await safeGoto(page, '/billing')
  await shot(page, 'billing')

  await safeGoto(page, '/documents')
  await shot(page, 'documents')

  await safeGoto(page, '/s3-storage')
  await shot(page, 's3-storage')

  await safeGoto(page, '/departments')
  await shot(page, 'departments')

  await safeGoto(page, '/roles')
  await shot(page, 'roles')

  await safeGoto(page, '/settings')
  await shot(page, 'settings')

  await safeGoto(page, '/team')
  await shot(page, 'team')
}

async function main() {
  console.log('App:', BASE, '→', OUT)
  const browser = await chromium.launch({ headless: true })
  try {
    const pub = await browser.newContext({ viewport: VIEW })
    await capturePublic(await pub.newPage())
    await pub.close()

    const sa = await browser.newContext({ viewport: VIEW })
    await captureSuperAdmin(await sa.newPage())
    await sa.close()

    const mgr = await browser.newContext({ viewport: VIEW })
    await captureManager(await mgr.newPage())
    await mgr.close()

    console.log('\nDone.')
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

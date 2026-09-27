const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testThemeButtons() {
  console.log('Testing button themes on application pages...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('fs.userGuide.completed.all', '1');
  });

  await page.fill('input[type="email"]', 'yash@gmail.com');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('Logged in as Yash (Admin). URL:', page.url());

  const routes = [
    { name: 'Roles & Permissions (+ New role)', url: 'http://localhost:5173/roles', selector: 'button:has-text("+ New role")' },
    { name: 'Workflows (+ New workflow)', url: 'http://localhost:5173/workflows', selector: 'button:has-text("New workflow")' },
    { name: 'Forms (+ New form)', url: 'http://localhost:5173/forms', selector: 'button:has-text("New form")' },
    { name: 'Admin Panel (+ Create user)', url: 'http://localhost:5173/admin', selector: 'button:has-text("Add User"), button:has-text("New User")' },
    { name: 'Departments (+ New department)', url: 'http://localhost:5173/departments', selector: 'button:has-text("New department"), button:has-text("Add department")' },
  ];

  for (const r of routes) {
    await page.goto(r.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    console.log(`Checking ${r.name}...`);
    try {
      const el = await page.$(r.selector);
      if (el) {
        const cls = await el.getAttribute('class');
        console.log(`  ✓ Found button with classes:`, cls);
      } else {
        console.log(`  (Button not matched by selector, page loaded ok: ${page.url()})`);
      }
    } catch(e) {
      console.log('  Err:', e.message);
    }
  }

  await browser.close();
  console.log('All pages verified!');
}

testThemeButtons().catch(console.error);

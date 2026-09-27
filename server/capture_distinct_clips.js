const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR_1 = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'demo-clips');
const OUT_DIR_2 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'assets', 'demo-clips');

[OUT_DIR_1, OUT_DIR_2].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function capture() {
  console.log('Launching browser with admin@netflow.app...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 820 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  
  await page.evaluate(() => {
    localStorage.setItem('has_seen_guide', 'true');
    localStorage.setItem('onboarding_dismissed', 'true');
    localStorage.setItem('netflow_tour_completed', 'true');
  });

  await page.fill('input[type="email"]', 'admin@netflow.app');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  
  // Wait until URL changes away from /login
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log('Successfully Logged in! Current URL:', page.url());

  const targets = [
    {
      title: 'Workspace Dashboard',
      route: '/dashboard',
      filename: 'clip-dashboard.png',
    },
    {
      title: 'Workflow Canvas Builder',
      route: '/workflows',
      filename: 'clip-workflows.png',
    },
    {
      title: 'Dynamic Form Designer',
      route: '/forms',
      filename: 'clip-forms.png',
    },
    {
      title: 'User Management & Team',
      route: '/admin',
      filename: 'clip-users.png',
    },
    {
      title: 'Task Inbox & Approvals',
      route: '/tasks',
      filename: 'clip-tasks.png',
    },
  ];

  for (const t of targets) {
    console.log(`\nNavigating to ${t.title} (${t.route})...`);
    try {
      await page.goto(`http://localhost:5173${t.route}`, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(2000);

      // Dismiss any popups
      try {
        const closeBtns = await page.$$('button:has-text("Skip"), button:has-text("Got it"), button:has-text("Close"), button[aria-label="Close"]');
        for (const btn of closeBtns) {
          if (await btn.isVisible()) await btn.click();
        }
      } catch (e) {}

      console.log(`Captured URL for ${t.title}:`, page.url());

      const file1 = path.join(OUT_DIR_1, t.filename);
      const file2 = path.join(OUT_DIR_2, t.filename);

      await page.screenshot({ path: file1, fullPage: false });
      if (fs.existsSync(path.dirname(file2))) {
        fs.copyFileSync(file1, file2);
      }
      console.log(`✓ Saved ${t.filename} (${fs.statSync(file1).size} bytes)`);
    } catch(e) {
      console.error(`Failed ${t.route}:`, e.message);
    }
  }

  await browser.close();
  console.log('\nAll distinct application clips captured successfully!');
}

capture().catch(console.error);

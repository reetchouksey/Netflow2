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
  console.log('Launching installed system browser (chrome/msedge)...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    try {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    } catch (e2) {
      console.error('Launch failed:', e2);
      return;
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 820 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  
  // Try login
  try {
    await page.fill('input[type="email"]', 'superadmin@netflow.app');
    await page.fill('input[type="password"]', 'Super@12345');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Login attempt 1 err:', e.message);
  }

  if (page.url().includes('/login')) {
    try {
      await page.fill('input[type="email"]', 'admin@netflow.app');
      await page.fill('input[type="password"]', 'Admin@12345');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    } catch(e) {
      console.log('Login attempt 2 err:', e.message);
    }
  }

  console.log('Current URL after login:', page.url());

  const targets = [
    { title: 'Interactive Dashboard', route: '/dashboard', filename: 'clip-dashboard.png' },
    { title: 'Visual Workflow Builder', route: '/workflows', filename: 'clip-workflows.png' },
    { title: 'Dynamic Form Designer', route: '/forms', filename: 'clip-forms.png' },
    { title: 'User & Role Management', route: '/roles', filename: 'clip-users.png' },
    { title: 'Task Approvals Inbox', route: '/tasks', filename: 'clip-tasks.png' },
    { title: 'Audit & Compliance Logs', route: '/audit-log', filename: 'clip-audit.png' },
    { title: 'Document & S3 Storage', route: '/s3-storage', filename: 'clip-storage.png' },
  ];

  for (const t of targets) {
    console.log(`Capturing ${t.title} at ${t.route}...`);
    try {
      await page.goto(`http://localhost:5173${t.route}`, { waitUntil: 'networkidle', timeout: 8000 });
      await page.waitForTimeout(1500);
      
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
  console.log('All clips captured successfully!');
}

capture().catch(console.error);

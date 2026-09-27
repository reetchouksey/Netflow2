const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR_1 = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'demo-clips');
const OUT_DIR_2 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'assets', 'demo-clips');

async function debugCapture() {
  console.log('Launching browser for debug capture...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 820 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  console.log('1. Go to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  
  await page.evaluate(() => {
    localStorage.setItem('has_seen_guide', 'true');
    localStorage.setItem('onboarding_dismissed', 'true');
    localStorage.setItem('netflow_tour_completed', 'true');
  });

  await page.fill('input[type="email"]', 'admin@netflow.app');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(4000);
  console.log('Current URL after submit:', page.url());

  // Check if we are logged in
  if (page.url().includes('/login')) {
    console.log('Login failed or pending. Page text:', await page.innerText('body'));
  }

  // 1. Dashboard
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('Dashboard URL:', page.url());
  await page.screenshot({ path: path.join(OUT_DIR_1, 'clip-dashboard.png') });

  // 2. Click on "+ New workflow" from /workflows or navigate to /workflows/new
  await page.goto('http://localhost:5173/workflows', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('Workflows list URL:', page.url());
  // Click on "New workflow" or "+ New workflow" button
  try {
    const newWfBtn = await page.$('a[href*="/workflows/new"], button:has-text("New workflow"), a:has-text("New workflow")');
    if (newWfBtn) {
      console.log('Found New Workflow button, clicking...');
      await newWfBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('New workflow click err:', e.message);
  }
  console.log('Workflow builder URL:', page.url());
  await page.screenshot({ path: path.join(OUT_DIR_1, 'clip-workflows.png') });

  // 3. Click on "+ New form" from /forms or navigate to /forms/new
  await page.goto('http://localhost:5173/forms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('Forms list URL:', page.url());
  try {
    const newFormBtn = await page.$('a[href*="/forms/new"], button:has-text("New form"), a:has-text("New form")');
    if (newFormBtn) {
      console.log('Found New Form button, clicking...');
      await newFormBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('New form click err:', e.message);
  }
  console.log('Form builder URL:', page.url());
  await page.screenshot({ path: path.join(OUT_DIR_1, 'clip-forms.png') });

  // 4. Admin / Team -> User Creation modal
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('Admin URL:', page.url());
  try {
    const addUserBtn = await page.$('button:has-text("New User"), button:has-text("Add User"), button:has-text("Add member"), button:has-text("Invite")');
    if (addUserBtn) {
      console.log('Found Add User button, clicking...');
      await addUserBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {}
  console.log('Admin user modal URL:', page.url());
  await page.screenshot({ path: path.join(OUT_DIR_1, 'clip-users.png') });

  // 5. Tasks
  await page.goto('http://localhost:5173/tasks', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('Tasks URL:', page.url());
  await page.screenshot({ path: path.join(OUT_DIR_1, 'clip-tasks.png') });

  // Copy all to OUT_DIR_2
  fs.readdirSync(OUT_DIR_1).forEach(f => {
    fs.copyFileSync(path.join(OUT_DIR_1, f), path.join(OUT_DIR_2, f));
  });

  await browser.close();
  console.log('Debug capture finished!');
}

debugCapture().catch(console.error);

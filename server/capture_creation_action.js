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
  console.log('Launching browser to capture creation in-action screens...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 820 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  
  // Set all tour completion keys
  await page.evaluate(() => {
    localStorage.setItem('fs.userGuide.completed.6ab5232a86bcbac10798a654', '1');
    localStorage.setItem('fs.userGuide.completed.all', '1');
    for (let i = 0; i < 100; i++) {
      localStorage.setItem(`fs.userGuide.completed.${i}`, '1');
    }
  });

  await page.fill('input[type="email"]', 'admin@netflow.app');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Set tour completion again for current user
  await page.evaluate(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u._id) localStorage.setItem(`fs.userGuide.completed.${u._id}`, '1');
      if (u.id) localStorage.setItem(`fs.userGuide.completed.${u.id}`, '1');
    } catch(e) {}
  });

  const saveClip = async (filename) => {
    const file1 = path.join(OUT_DIR_1, filename);
    const file2 = path.join(OUT_DIR_2, filename);
    await page.screenshot({ path: file1, fullPage: false });
    if (fs.existsSync(path.dirname(file2))) fs.copyFileSync(file1, file2);
    console.log(`✓ Captured ${filename} (${fs.statSync(file1).size} bytes) from ${page.url()}`);
  };

  // 1. DASHBOARD
  console.log('\n1. Capturing Dashboard...');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await saveClip('clip-dashboard.png');

  // 2. WORKFLOW BUILDER CANVAS IN ACTION
  console.log('\n2. Capturing Workflow Canvas Builder...');
  await page.goto('http://localhost:5173/workflows/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await saveClip('clip-workflows.png');

  // 3. FORM DESIGNER STUDIO IN ACTION
  console.log('\n3. Capturing Form Designer Studio...');
  await page.goto('http://localhost:5173/forms/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await saveClip('clip-forms.png');

  // 4. USER MANAGEMENT / ADD USER MODAL IN ACTION
  console.log('\n4. Capturing User Creation in Action...');
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  try {
    const addBtn = await page.$('button:has-text("Add User"), button:has-text("New User"), button:has-text("Add member"), button:has-text("Invite")');
    if (addBtn) {
      console.log('Opening Add User Modal...');
      await addBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch(e) {
    console.log('Add button err:', e.message);
  }
  await saveClip('clip-users.png');

  // 5. APPROVALS INBOX IN ACTION
  console.log('\n5. Capturing Approvals Inbox...');
  await page.goto('http://localhost:5173/tasks', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await saveClip('clip-tasks.png');

  await browser.close();
  console.log('\nDone capturing all creation in-action clips!');
}

capture().catch(console.error);

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.resolve(__dirname, '../../screenshots');
const ARTIFACT_DIR = 'C:\\Users\\rchouksey\\.gemini\\antigravity-ide\\brain\\08af7a7f-2a2c-432f-9da8-bbd6fc5bd8e5';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function loginApi(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runVisualQA() {
  console.log('🚀 Starting Comprehensive Live UI Browser QA Testing...');
  const loginRes = await loginApi('superadmin@netflow.com', 'password123');
  const token = loginRes.token || (loginRes.data && loginRes.data.token);
  const user = loginRes.user || (loginRes.data && loginRes.data.user);

  console.log('Admin token obtained successfully for user:', user?.name || user?.email);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  async function saveScreenshot(filename) {
    const localPath = path.join(OUTPUT_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    fs.copyFileSync(localPath, artifactPath);
    console.log(`📸 Captured: ${filename}`);
  }

  try {
    // 1. Landing & Login Page
    console.log('Step 1: Navigating to Login page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.type('input[type="email"], input[name="email"]', 'superadmin@netflow.com');
    await page.type('input[type="password"], input[name="password"]', 'password123');
    await saveScreenshot('qa_01_login_credentials.png');

    // Set authenticated state in localStorage
    await page.evaluate((tok, usr) => {
      localStorage.setItem('flowsphere_token', tok);
      localStorage.setItem('flowsphere_user', JSON.stringify(usr));
    }, token, user);

    // 2. Dashboard / Overview
    console.log('Step 2: Navigating to Live Dashboard Overview...');
    await page.goto('http://localhost:5173/overview', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await saveScreenshot('qa_02_dashboard_overview.png');

    // 3. Admin User Management & Builder Seats
    console.log('Step 3: Navigating to Admin User Management...');
    await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await saveScreenshot('qa_03_admin_user_management.png');

    // Click on Create/Add User Modal
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt && (txt.includes('Add User') || txt.includes('Create User') || txt.includes('New User'))) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1200));
    await saveScreenshot('qa_04_admin_user_modal_with_builder_seat.png');

    // 4. Workflows Listing Page
    console.log('Step 4: Navigating to Workflows...');
    await page.goto('http://localhost:5173/workflows', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await saveScreenshot('qa_05_workflows_listing.png');

    // 5. Workflow Builder Canvas & Step 3 Access Controls
    console.log('Step 5: Navigating to Workflow Builder...');
    await page.goto('http://localhost:5173/workflows/new', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await saveScreenshot('qa_06_workflow_builder_canvas.png');

    // Navigate to Step 3 (Settings & Triggers)
    const stepBtns = await page.$$('button');
    for (const b of stepBtns) {
      const txt = await page.evaluate(el => el.textContent, b);
      if (txt && (txt.includes('Settings & Triggers') || txt.includes('Settings'))) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await saveScreenshot('qa_07_workflow_access_settings_step3.png');

    // Click "Specific roles"
    const radioInputs = await page.$$('input[type="radio"]');
    if (radioInputs.length >= 2) {
      await radioInputs[1].click();
      await new Promise(r => setTimeout(r, 800));
      await saveScreenshot('qa_08_workflow_access_specific_roles.png');
    }

    // Click "Specific people"
    if (radioInputs.length >= 4) {
      await radioInputs[3].click();
      await new Promise(r => setTimeout(r, 800));
      await saveScreenshot('qa_09_workflow_access_specific_people_dropdown.png');
    }

    // 6. Forms Listing Page
    console.log('Step 6: Navigating to Forms Listing...');
    await page.goto('http://localhost:5173/forms', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await saveScreenshot('qa_10_forms_listing.png');

    console.log('🎉 ALL LIVE BROWSER QA SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error during visual QA testing:', err);
  } finally {
    await browser.close();
  }
}

runVisualQA();

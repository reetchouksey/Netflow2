const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const dashboardPath = path.resolve('C:\\Users\\rchouksey\\.gemini\\antigravity-ide\\brain\\08af7a7f-2a2c-432f-9da8-bbd6fc5bd8e5', 'verified_superadmin_dashboard.png');
const orgsPath = path.resolve('C:\\Users\\rchouksey\\.gemini\\antigravity-ide\\brain\\08af7a7f-2a2c-432f-9da8-bbd6fc5bd8e5', 'verified_superadmin_organizations.png');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'patilabhay717@gmail.com');
  await page.type('input[type="password"]', 'Super@12345');
  
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click();
  
  await new Promise(r => setTimeout(r, 2000));
  
  // 1. Super Admin Dashboard (/dashboard)
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Dismiss tour modal if open
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const skip = btns.find(b => b.textContent && (b.textContent.includes('Skip') || b.textContent.includes('Close') || b.textContent.includes('Done')));
    if (skip) skip.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: dashboardPath });
  console.log('✅ Captured Dashboard to:', dashboardPath);

  // 2. Organizations page (/platform)
  await page.goto('http://localhost:5173/platform', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: orgsPath });
  console.log('✅ Captured Organizations page to:', orgsPath);

  await browser.close();
})();

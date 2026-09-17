const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outPath = path.resolve('C:\\Users\\rchouksey\\.gemini\\antigravity-ide\\brain\\08af7a7f-2a2c-432f-9da8-bbd6fc5bd8e5', 'plan_usage_cards_verified.png');

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
  
  // Navigate to /platform
  await page.goto('http://localhost:5173/platform', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Click on the first organization row to open detail view
  const orgRow = await page.$('table tbody tr');
  if (orgRow) {
    await orgRow.click();
    await new Promise(r => setTimeout(r, 1500));
  }

  await page.screenshot({ path: outPath });
  console.log('✅ Captured Plan Usage cards screenshot to:', outPath);
  await browser.close();
})();

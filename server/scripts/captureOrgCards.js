const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outPath = path.resolve('C:\\Users\\rchouksey\\.gemini\\antigravity-ide\\brain\\08af7a7f-2a2c-432f-9da8-bbd6fc5bd8e5', 'superadmin_organizations_tab_verified.png');

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
  
  // Navigate to /platform (Organizations)
  await page.goto('http://localhost:5173/platform', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // Dismiss product tour if open
  const skipBtn = await page.$('button');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const txt = await page.evaluate(el => el.textContent, b);
    if (txt && (txt.includes('Skip') || txt.includes('Close') || txt.includes('Done'))) {
      await b.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: outPath });
  console.log('✅ Captured organizations tab screenshot to:', outPath);
  await browser.close();
})();

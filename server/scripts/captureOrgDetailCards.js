const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outPath = path.resolve('C:\\Users\\rchouksey\\.gemini\\antigravity-ide\\brain\\08af7a7f-2a2c-432f-9da8-bbd6fc5bd8e5', 'particular_org_kpi_cards_verified.png');

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
  
  // Click on the sidebar Organizations link specifically
  await page.waitForSelector('a[href="/platform"]', { timeout: 5000 });
  await page.click('a[href="/platform"]');
  await new Promise(r => setTimeout(r, 2000));

  // Dismiss product tour modal if present
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const skip = btns.find(b => b.textContent && (b.textContent.includes('Skip') || b.textContent.includes('Close') || b.textContent.includes('Done')));
    if (skip) skip.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click on the first org name in the table
  const clicked = await page.evaluate(() => {
    const orgBtn = document.querySelector('tbody tr button');
    if (orgBtn) {
      orgBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked org button:', clicked);
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: outPath });
  console.log('✅ Captured particular organization KPI cards screenshot to:', outPath);
  await browser.close();
})();

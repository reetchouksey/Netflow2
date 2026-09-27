const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'yash@gmail.com');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('Login result URL:', page.url());
  await browser.close();
}
test().catch(console.error);

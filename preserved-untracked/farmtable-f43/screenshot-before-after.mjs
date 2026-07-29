import { chromium } from 'playwright';

const outputPath = process.argv[2] || '/tmp/tree-screenshot.png';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:9093', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Click into the default collection
const collLink = page.locator('a, sl-card').filter({ hasText: 'default' }).first();
if (await collLink.count() > 0) {
  await collLink.click();
  await page.waitForTimeout(2000);
}

// Switch to Tree view
const treeBtn = page.locator('sl-radio-button[value="tree"]');
if (await treeBtn.count() > 0) {
  await treeBtn.first().click();
  await page.waitForTimeout(3000);
}

// Expand all tasks if there's a toggle - click parent to expand children
await page.waitForTimeout(1000);

await page.screenshot({ path: outputPath, fullPage: false });
await browser.close();
console.log('Screenshot saved to ' + outputPath);

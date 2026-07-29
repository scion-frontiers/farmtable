import { chromium } from 'playwright';

const outputPath = process.argv[2] || '/tmp/tree-screenshot.png';

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:9092', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Click on the default collection to enter it
const collectionLink = page.locator('text=default').first();
if (await collectionLink.count() > 0) {
  await collectionLink.click();
  await page.waitForTimeout(3000);
}

// Take a debug screenshot to see the page structure
await page.screenshot({ path: '/tmp/debug-after-collection.png' });

// Try clicking the Tree button - look for it in different ways
// The Shoelace radio button for Tree view
const treeSelectors = [
  'sl-radio-button[value="tree"]',
  '[value="tree"]',
  'sl-radio-button:has-text("Tree")',
];

let clicked = false;
for (const sel of treeSelectors) {
  try {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0) {
      await btn.click({ timeout: 5000 });
      clicked = true;
      console.log(`Clicked tree button via: ${sel}`);
      break;
    }
  } catch (e) {
    console.log(`Selector ${sel} failed: ${e.message}`);
  }
}

if (!clicked) {
  // Fallback: use JavaScript to find and click the tree button
  await page.evaluate(() => {
    const radios = document.querySelectorAll('sl-radio-button');
    for (const r of radios) {
      if (r.textContent?.trim() === 'Tree' || r.getAttribute('value') === 'tree') {
        r.click();
        return;
      }
    }
    // Also check within shadow DOMs
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        const btns = el.shadowRoot.querySelectorAll('sl-radio-button, [value="tree"]');
        for (const b of btns) {
          b.click();
          return;
        }
      }
    }
  });
  console.log('Used JS fallback to click tree button');
}

await page.waitForTimeout(2000);

await page.screenshot({ path: outputPath, fullPage: false });
console.log(`Screenshot saved to ${outputPath}`);

await browser.close();

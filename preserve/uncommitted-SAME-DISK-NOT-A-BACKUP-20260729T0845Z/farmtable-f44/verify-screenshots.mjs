import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://localhost:9090';
const COLLECTION = '8ef64de9-cc3e-47ed-aae2-02e83f26dc5d';
const DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view';

// (a) Multi-layer dependencies view
console.log('Navigating to dependencies view...');
await page.goto(`${BASE}/?collection=${COLLECTION}&view=dependencies`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${DIR}/multi-layer-deps.png`, fullPage: false });
console.log('Screenshot (a): multi-layer-deps.png');

// (b) Same view shows multiple blockers (different angle/zoom or note)
await page.screenshot({ path: `${DIR}/multiple-blockers.png`, fullPage: false });
console.log('Screenshot (b): multiple-blockers.png');

// (c) View switcher icon - show the toolbar with the rotated icon
console.log('Navigating to kanban to show toolbar...');
await page.goto(`${BASE}/?collection=${COLLECTION}&view=kanban`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${DIR}/view-switcher-icon.png`, fullPage: false });
console.log('Screenshot (c): view-switcher-icon.png');

// (d) Animated centering - click a task node in dependencies view
console.log('Navigating to dependencies view for centering test...');
await page.goto(`${BASE}/?collection=${COLLECTION}&view=dependencies`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Try clicking on an SVG foreignObject node
const nodes = page.locator('ft-dependency-view foreignObject');
const count = await nodes.count();
console.log(`Found ${count} nodes in dependency view`);
if (count > 0) {
  // Click the second node if possible (to trigger centering animation)
  const target = count > 2 ? nodes.nth(2) : nodes.first();
  await target.click({ force: true });
  await page.waitForTimeout(1000); // Wait for 750ms animation
}
await page.screenshot({ path: `${DIR}/animated-centering.png`, fullPage: false });
console.log('Screenshot (d): animated-centering.png');

await browser.close();
console.log('All screenshots captured successfully.');

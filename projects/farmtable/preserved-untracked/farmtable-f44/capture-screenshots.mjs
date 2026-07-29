import { chromium } from 'playwright';

const COLL1 = '1772d078-0a7a-4dda-9fbc-86bc35abda8b'; // 4-layer chain
const COLL2 = '6719b202-703d-42b3-b1fe-12aa6c7babc4'; // fan-in multiple blockers
const OUTPUT_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

// Screenshot 1: Multi-layer chain (D→C→B→A = 4 layers)
console.log('Taking screenshot 1: multi-layer dependency chain...');
const page1 = await context.newPage();
await page1.goto(`http://localhost:9090/?collection=${COLL1}&view=dependencies`, { waitUntil: 'domcontentloaded' });
await page1.waitForTimeout(8000); // Wait for SSE data + dagre layout
await page1.screenshot({ path: `${OUTPUT_DIR}/multi-layer-deps.png`, fullPage: false });
console.log('Screenshot 1 saved');
await page1.close();

// Screenshot 2: Multiple blockers in same layer → target in max+1
console.log('Taking screenshot 2: multiple blockers same layer...');
const page2 = await context.newPage();
await page2.goto(`http://localhost:9090/?collection=${COLL2}&view=dependencies`, { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(8000);
await page2.screenshot({ path: `${OUTPUT_DIR}/multiple-blockers.png`, fullPage: false });
console.log('Screenshot 2 saved');
await page2.close();

await browser.close();
console.log('Done!');

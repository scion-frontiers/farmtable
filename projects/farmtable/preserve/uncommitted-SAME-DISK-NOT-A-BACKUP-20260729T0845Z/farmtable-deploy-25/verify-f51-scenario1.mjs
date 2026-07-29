import { chromium } from 'playwright';
import { execSync } from 'child_process';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_AUDIENCE = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-25';

const token = execSync(`gcloud auth print-identity-token --audiences=${IAP_AUDIENCE}`)
  .toString().trim();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { Authorization: `Bearer ${token}` },
});
const page = await context.newPage();

// Navigate to Scenario 1: 4-Layer Chain
await page.goto(SERVICE_URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  const list = app?.shadowRoot?.querySelector('ft-collection-list');
  const buttons = list?.shadowRoot?.querySelectorAll('button.collection');
  for (const btn of buttons || []) {
    if (btn.querySelector('.name')?.textContent?.trim()?.includes('Scenario 1')) {
      btn.click();
      break;
    }
  }
});
await page.waitForTimeout(4000);

// Switch to dep view
await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  const toolbar = app?.shadowRoot?.querySelector('ft-toolbar');
  const group = toolbar?.shadowRoot?.querySelector('sl-radio-group');
  if (group) {
    group.value = 'dependencies';
    group.dispatchEvent(new Event('sl-change', { bubbles: true }));
  }
});
await page.waitForTimeout(3000);

await page.screenshot({ path: `${SCREENSHOT_DIR}/f51-04-scenario1-all-unblocked.png`, fullPage: false });
console.log('Screenshot 4: Scenario 1 — all unblocked tasks in single leftmost column');

await browser.close();

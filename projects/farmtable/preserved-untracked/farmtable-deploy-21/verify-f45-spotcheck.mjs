// Feature 45 spot-check: Beads JSONL Import dialog still works after deploy-21
import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-21';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('=== Step 1: Load app and select default collection ===');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await sleep(3000);

  // Click the "default" collection
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const collList = app?.shadowRoot?.querySelector('ft-collection-list');
    const items = collList?.shadowRoot?.querySelectorAll('.collection-item, .item, [class*="collection"]');
    for (const item of (items || [])) {
      if (item.textContent?.trim()?.startsWith('default')) { item.click(); break; }
    }
  });
  await sleep(4000);

  console.log('=== Step 2: Open import dialog ===');
  // Click the import button (download icon) in the toolbar
  const importClicked = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return 'no toolbar';
    // Find the import button - it's a download icon button
    const buttons = toolbar.shadowRoot.querySelectorAll('sl-icon-button');
    for (const btn of buttons) {
      const name = btn.getAttribute('name');
      if (name === 'download' || name === 'upload' || name === 'cloud-download' || name === 'box-arrow-in-down') {
        btn.click();
        return `clicked: ${name}`;
      }
    }
    // List all button names
    const names = Array.from(buttons).map(b => b.getAttribute('name'));
    return `no import button found. Buttons: ${names.join(', ')}`;
  });
  console.log('Import button:', importClicked);
  await sleep(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f45-spotcheck-import-dialog.png`, fullPage: false });

  // Check the import dialog text — dialog lives inside ft-toolbar's shadow DOM
  const dialogText = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return 'no toolbar';
    const dialog = toolbar.shadowRoot.querySelector('ft-import-collection-dialog');
    if (!dialog?.shadowRoot) return 'no import dialog in toolbar';

    function walkText(n) {
      let t = '';
      if (n.shadowRoot) t += walkText(n.shadowRoot);
      for (const c of n.childNodes) {
        if (c.nodeType === 3) t += c.textContent;
        else if (c.nodeType === 1) t += walkText(c);
      }
      return t;
    }
    return walkText(dialog);
  });
  console.log('Dialog text:', dialogText?.substring(0, 500));

  const hasBeadsFormat = dialogText?.includes('Beads issue export (.jsonl)');
  const hasFarmtableFormat = dialogText?.includes('Farmtable export (.json)');
  console.log(`Feature 45 spot-check:`);
  console.log(`  Beads JSONL format listed: ${hasBeadsFormat}`);
  console.log(`  Farmtable JSON format listed: ${hasFarmtableFormat}`);
  console.log(`  VERDICT: ${hasBeadsFormat && hasFarmtableFormat ? 'PASS' : 'FAIL'}`);

  await browser.close();
})();

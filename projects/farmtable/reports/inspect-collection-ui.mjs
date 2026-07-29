/**
 * Playwright script to inspect the Farm Table Cloud Run dashboard for collection behavior.
 * - Captures ListCollections and WatchTasks gRPC-Web network requests
 * - Checks if there is a collection picker/selector UI element
 * - Takes a screenshot of the dashboard
 */

import { chromium } from '/scion-volumes/scratchpad/web-test/node_modules/playwright/index.mjs';

const DASHBOARD_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/reports';

const networkCalls = [];
const consoleMessages = [];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Capture all network requests
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('FarmTableService')) {
      networkCalls.push({
        type: 'request',
        url,
        method: req.method(),
        postData: req.postData()?.substring(0, 200) || null,
      });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('FarmTableService')) {
      networkCalls.push({
        type: 'response',
        url,
        status: res.status(),
        headers: Object.fromEntries(
          Object.entries(res.headers()).filter(([k]) => k.startsWith('content-type') || k.startsWith('grpc'))
        ),
      });
    }
  });

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  console.log('Loading dashboard...');
  const response = await page.goto(DASHBOARD_URL, { waitUntil: 'load', timeout: 30000 });
  console.log(`Page loaded: HTTP ${response.status()}`);

  // Wait for the app to render and data to load
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: `${SCREENSHOT_DIR}/collection-investigation-dashboard.png`, fullPage: false });
  console.log('Screenshot saved.');

  // Look for any collection-related UI elements
  const collectionUIElements = await page.evaluate(() => {
    const results = [];

    // Check for any select/dropdown containing "collection"
    const allElements = document.querySelectorAll('select, sl-select, [role="listbox"], [role="combobox"]');
    allElements.forEach(el => {
      results.push({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.substring(0, 100),
        id: el.id,
        class: el.className?.substring?.(0, 100) || '',
      });
    });

    // Check shadow DOMs of custom elements
    const customElements = document.querySelectorAll('ft-app, ft-toolbar, ft-kanban-view');
    customElements.forEach(el => {
      if (el.shadowRoot) {
        const selects = el.shadowRoot.querySelectorAll('select, sl-select, [role="listbox"], [role="combobox"]');
        selects.forEach(sel => {
          results.push({
            tag: sel.tagName.toLowerCase(),
            text: sel.textContent?.substring(0, 100),
            context: `inside ${el.tagName.toLowerCase()} shadow`,
          });
        });

        // Also look for any text mentioning "collection"
        const allText = el.shadowRoot.textContent || '';
        if (allText.toLowerCase().includes('collection')) {
          results.push({ note: `"collection" found in ${el.tagName} shadow text` });
        }
      }
    });

    // Check if there's any visible text with "collection" in the entire page
    const bodyText = document.body.textContent || '';
    const bodyHasCollection = bodyText.toLowerCase().includes('collection');

    // Check page title
    const title = document.title;

    return { elements: results, bodyHasCollection, title };
  });

  console.log('\n=== Collection UI Elements ===');
  console.log(JSON.stringify(collectionUIElements, null, 2));

  // Check what tasks are visible (to identify which collection they belong to)
  const visibleTasks = await page.evaluate(() => {
    const tasks = [];
    // Look for task cards in shadow DOMs
    const app = document.querySelector('ft-app');
    if (app?.shadowRoot) {
      const kanban = app.shadowRoot.querySelector('ft-kanban-view');
      if (kanban?.shadowRoot) {
        const columns = kanban.shadowRoot.querySelectorAll('ft-kanban-column');
        columns.forEach(col => {
          if (col.shadowRoot) {
            const cards = col.shadowRoot.querySelectorAll('ft-task-card');
            cards.forEach(card => {
              if (card.shadowRoot) {
                const nameEl = card.shadowRoot.querySelector('.task-name, .name, h3, h4, [class*="name"], [class*="title"]');
                tasks.push(nameEl?.textContent?.trim() || card.shadowRoot.textContent?.substring(0, 80)?.trim());
              }
            });
          }
        });
      }
    }
    return tasks;
  });

  console.log('\n=== Visible Tasks ===');
  visibleTasks.forEach(t => console.log(`  - ${t}`));

  // Check the toolbar content
  const toolbarContent = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app shadow';
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return 'no toolbar shadow';
    return toolbar.shadowRoot.textContent?.substring(0, 500);
  });
  console.log('\n=== Toolbar Text ===');
  console.log(toolbarContent);

  console.log('\n=== gRPC Network Calls ===');
  networkCalls.forEach(call => {
    console.log(JSON.stringify(call));
  });

  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(msg => {
    if (msg.type !== 'log') console.log(`[${msg.type}] ${msg.text}`);
  });

  await browser.close();
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

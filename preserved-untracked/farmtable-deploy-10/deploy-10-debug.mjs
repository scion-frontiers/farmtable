import { chromium } from 'playwright';

const LIVE_URL = 'https://farmtable-486315127503.us-central1.run.app';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('text=default').first().click();
  await page.waitForTimeout(3000);

  // Click the add-task-button on Ready column
  await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    const col = columns[2]; // Ready
    const addBtn = col.shadowRoot.querySelector('.add-task-button');
    addBtn.click();
  });
  await page.waitForTimeout(1000);

  // Take screenshot to see what dialog/form appeared
  await page.screenshot({ path: '/tmp/debug-after-add-click.png' });

  // Deep inspect for any new UI elements
  const uiState = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const results = [];

    const search = (root, path, depth = 0) => {
      if (depth > 6) return;
      for (const el of root.querySelectorAll('*')) {
        // Look for dialogs, forms, inputs
        if (['DIALOG', 'FORM', 'INPUT', 'TEXTAREA', 'FT-TASK-DIALOG', 'FT-ADD-TASK',
             'SL-DIALOG', 'SL-INPUT', 'SL-TEXTAREA'].includes(el.tagName) ||
            el.getAttribute('role') === 'dialog' ||
            el.classList?.contains('dialog') || el.classList?.contains('modal')) {
          results.push({
            path: `${path}>${el.tagName}.${el.className}`,
            visible: el.offsetParent !== null,
            text: el.textContent?.substring(0, 100),
          });
        }
        if (el.shadowRoot) {
          search(el.shadowRoot, `${path}>${el.tagName}(shadow)`, depth + 1);
        }
      }
    };

    search(ftApp.shadowRoot, 'ft-app');
    search(document, 'document');
    return results;
  });
  console.log('UI elements found:', JSON.stringify(uiState, null, 2));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });

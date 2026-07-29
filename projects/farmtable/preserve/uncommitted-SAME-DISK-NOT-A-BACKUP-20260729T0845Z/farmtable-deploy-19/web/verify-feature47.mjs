import { chromium } from 'playwright';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-19';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Navigate to the app
  console.log('Navigating to', SERVICE_URL);
  await page.goto(SERVICE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Step 1: Select the "default" collection by clicking on visible text
  console.log('Selecting default collection...');
  try {
    await page.locator('text=default').first().click({ timeout: 5000 });
    console.log('Clicked default collection');
  } catch (e) {
    console.log('Could not click default, trying shadow DOM...');
    await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app || !app.shadowRoot) return;
      const els = app.shadowRoot.querySelectorAll('*');
      for (const el of els) {
        if (el.textContent?.trim() === 'default' ||
            (el.textContent?.includes('default') && el.children.length < 3)) {
          el.click();
          break;
        }
      }
    });
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f47-02-collection-loaded.png` });
  console.log('Collection loaded screenshot saved');

  // Step 2: Find and switch to Ready Queue view
  console.log('Looking for view selector...');
  const viewResult = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return 'no app';

    // Look for view selector in the app's shadow DOM
    const viewSelector = app.shadowRoot.querySelector('ft-view-selector');
    if (!viewSelector) {
      const customEls = [];
      app.shadowRoot.querySelectorAll('*').forEach(el => {
        if (el.tagName.includes('-')) customEls.push(el.tagName.toLowerCase());
      });
      return 'no view selector, custom elements: ' + [...new Set(customEls)].join(', ');
    }

    const vsShadow = viewSelector.shadowRoot;
    if (!vsShadow) return 'view selector has no shadow root';

    const buttons = vsShadow.querySelectorAll('sl-radio-button');
    const values = [];
    buttons.forEach(b => values.push(b.getAttribute('value') + '=' + b.textContent?.trim()));

    // Click ready-queue
    const readyBtn = vsShadow.querySelector('sl-radio-button[value="ready-queue"]');
    if (readyBtn) {
      readyBtn.click();
      return 'clicked ready-queue, all values: ' + values.join(', ');
    }

    // Try any button containing "ready"
    for (const btn of buttons) {
      const val = btn.getAttribute('value') || '';
      if (val.includes('ready') || btn.textContent?.toLowerCase().includes('ready')) {
        btn.click();
        return 'clicked ' + val + ', all values: ' + values.join(', ');
      }
    }

    return 'no ready button, values: ' + values.join(', ');
  });
  console.log('View switch result:', viewResult);

  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f47-03-ready-queue-view.png` });
  console.log('Ready queue screenshot saved');

  // Step 3: Verify the CSS fix
  const verification = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return { error: 'no app' };

    const readyQueue = app.shadowRoot.querySelector('ft-ready-queue-view');
    if (!readyQueue || !readyQueue.shadowRoot) return { error: 'no ready-queue-view' };

    const cells = readyQueue.shadowRoot.querySelectorAll('.priority-cell');
    if (cells.length === 0) return { error: 'no .priority-cell elements' };

    const cellData = [];
    cells.forEach(cell => {
      const badge = cell.querySelector('sl-badge');
      const cs = window.getComputedStyle(cell);
      cellData.push({
        badgeText: badge?.textContent?.trim() || 'N/A',
        minWidth: cs.minWidth,
        display: cs.display,
        flexShrink: cs.flexShrink,
        actualWidth: Math.round(cell.getBoundingClientRect().width * 10) / 10
      });
    });

    const widths = cellData.map(c => c.actualWidth);
    const allAligned = widths.every(w => Math.abs(w - widths[0]) < 1);

    return {
      cellCount: cells.length,
      cells: cellData,
      allAligned,
      widthRange: [Math.min(...widths), Math.max(...widths)]
    };
  });

  console.log('Feature 47 verification:', JSON.stringify(verification, null, 2));

  // Step 4: Detail screenshot
  const rqRect = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return null;
    const rq = app.shadowRoot.querySelector('ft-ready-queue-view');
    if (!rq) return null;
    const rect = rq.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      width: Math.min(rect.width, 1440 - Math.max(0, rect.x)),
      height: Math.min(rect.height, 900 - Math.max(0, rect.y))
    };
  });

  if (rqRect && rqRect.width > 0 && rqRect.height > 0) {
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/f47-04-alignment-detail.png`,
      clip: rqRect
    });
    console.log('Alignment detail screenshot saved');
  }

  await browser.close();
  console.log('Done');
})();

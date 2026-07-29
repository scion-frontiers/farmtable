import { chromium } from 'playwright';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-19';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to', SERVICE_URL);
  await page.goto(SERVICE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Select the farmtable-deploy4-web collection (likely to have varied priorities)
  console.log('Selecting farmtable-deploy4-web collection...');
  try {
    await page.locator('text=farmtable-deploy4-web').first().click({ timeout: 5000 });
    console.log('Clicked farmtable-deploy4-web');
  } catch (e) {
    console.log('Could not find farmtable-deploy4-web, trying External Store Passthrough...');
    try {
      await page.locator('text=External Store Passthrough').first().click({ timeout: 5000 });
      console.log('Clicked External Store Passthrough');
    } catch (e2) {
      console.log('Trying farmtable-deploy4-cli...');
      try {
        await page.locator('text=farmtable-deploy4-cli').first().click({ timeout: 5000 });
      } catch (e3) {
        console.log('Falling back to default');
        await page.locator('text=default').first().click({ timeout: 5000 });
      }
    }
  }
  await page.waitForTimeout(5000);

  // Check what priorities this collection has
  const priorities = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return 'no app';
    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (!kanban || !kanban.shadowRoot) return 'no kanban';
    const badges = kanban.shadowRoot.querySelectorAll('sl-badge');
    const prioSet = new Set();
    badges.forEach(b => prioSet.add(b.textContent?.trim()));
    return [...prioSet];
  });
  console.log('Priorities in this collection:', priorities);

  // Switch to ready queue view
  console.log('Switching to ready-queue view...');
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return;
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar || !toolbar.shadowRoot) return;
    const readyBtn = toolbar.shadowRoot.querySelector('sl-radio-button[value="ready-queue"]');
    if (readyBtn) readyBtn.click();
  });
  await page.waitForTimeout(3000);

  // Verify ready queue and take screenshot
  const rqState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return { error: 'no app' };
    const rq = app.shadowRoot.querySelector('ft-ready-queue-view');
    if (!rq || !rq.shadowRoot) return { error: 'no rq' };

    const cells = rq.shadowRoot.querySelectorAll('.priority-cell');
    const cellData = [];
    cells.forEach(cell => {
      const badge = cell.querySelector('sl-badge');
      const cs = window.getComputedStyle(cell);
      cellData.push({
        badgeText: badge?.textContent?.trim(),
        minWidth: cs.minWidth,
        actualWidth: Math.round(cell.getBoundingClientRect().width * 10) / 10
      });
    });

    const rows = rq.shadowRoot.querySelectorAll('.queue-row');
    const rowInfo = [];
    rows.forEach(row => {
      const badge = row.querySelector('sl-badge');
      const title = row.querySelector('.task-title');
      if (badge && title) {
        rowInfo.push({
          priority: badge.textContent?.trim(),
          titleLeft: Math.round(title.getBoundingClientRect().left),
          badgeWidth: Math.round(badge.getBoundingClientRect().width)
        });
      }
    });

    const widths = cellData.map(c => c.actualWidth);
    const allAligned = widths.length > 0 && widths.every(w => Math.abs(w - widths[0]) < 1);
    const titleLefts = rowInfo.map(r => r.titleLeft);
    const titlesAligned = titleLefts.length > 0 && titleLefts.every(l => Math.abs(l - titleLefts[0]) < 1);
    const uniquePriorities = [...new Set(rowInfo.map(r => r.priority))];

    return {
      cellCount: cells.length,
      allCellsAligned: allAligned,
      allTitlesAligned: titlesAligned,
      uniquePriorities,
      sampleRows: rowInfo.slice(0, 10)
    };
  });
  console.log('Ready queue state:', JSON.stringify(rqState, null, 2));

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f47-05-collection2-ready-queue.png` });
  console.log('Second collection ready queue screenshot saved');

  await browser.close();
  console.log('Done');
})();

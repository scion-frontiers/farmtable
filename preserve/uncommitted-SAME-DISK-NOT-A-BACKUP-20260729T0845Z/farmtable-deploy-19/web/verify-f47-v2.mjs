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

  // Step 1: Select "default" collection
  console.log('Selecting default collection...');
  try {
    await page.locator('text=default').first().click({ timeout: 5000 });
    console.log('Clicked default collection');
  } catch (e) {
    console.log('Fallback click attempt...');
  }
  await page.waitForTimeout(5000);

  // Step 2: First, let's set some tasks to different priorities so we can test alignment
  // Check what priorities exist currently
  const taskInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return 'no app';
    // Get current tasks and their priorities from the kanban view
    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (!kanban || !kanban.shadowRoot) return 'no kanban';
    const cards = kanban.shadowRoot.querySelectorAll('.kanban-card');
    const info = [];
    cards.forEach(c => {
      const badge = c.querySelector('sl-badge');
      info.push({
        title: c.querySelector('.card-title')?.textContent?.trim(),
        priority: badge?.textContent?.trim()
      });
    });
    return info;
  });
  console.log('Current tasks (first 10):', JSON.stringify(taskInfo?.slice?.(0, 10), null, 2));

  // Step 3: Switch to Ready Queue view via ft-toolbar
  console.log('Switching to ready-queue view...');
  const switchResult = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return 'no app';

    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar || !toolbar.shadowRoot) return 'no toolbar';

    // Find the radio group and the ready-queue button
    const radioGroup = toolbar.shadowRoot.querySelector('sl-radio-group');
    const readyBtn = toolbar.shadowRoot.querySelector('sl-radio-button[value="ready-queue"]');
    if (!readyBtn) {
      const allBtns = toolbar.shadowRoot.querySelectorAll('sl-radio-button');
      const vals = [];
      allBtns.forEach(b => vals.push(b.getAttribute('value')));
      return 'no ready-queue button, found: ' + vals.join(', ');
    }

    readyBtn.click();

    // Also dispatch the change event on the radio group
    if (radioGroup) {
      radioGroup.value = 'ready-queue';
      radioGroup.dispatchEvent(new Event('sl-change', { bubbles: true }));
    }

    return 'clicked ready-queue';
  });
  console.log('Switch result:', switchResult);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f47-03-after-switch-attempt.png` });

  // Check if the view actually switched
  const currentState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return 'no app';
    const rq = app.shadowRoot.querySelector('ft-ready-queue-view');
    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    const currentView = toolbar?.currentView;

    // List all top-level custom elements
    const els = [];
    app.shadowRoot.querySelectorAll('*').forEach(el => {
      if (el.tagName.includes('-')) els.push(el.tagName.toLowerCase());
    });

    return {
      hasReadyQueue: !!rq,
      hasKanban: !!kanban,
      currentView: currentView,
      customElements: [...new Set(els)]
    };
  });
  console.log('Current state:', JSON.stringify(currentState, null, 2));

  // If view didn't switch, try setting the property directly
  if (!currentState.hasReadyQueue) {
    console.log('Trying direct property assignment...');
    await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (app) {
        app.currentView = 'ready-queue';
        app.requestUpdate?.();
      }
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/f47-03b-direct-switch.png` });

    const state2 = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app || !app.shadowRoot) return { error: 'no app' };
      return {
        currentView: app.currentView,
        hasReadyQueue: !!app.shadowRoot.querySelector('ft-ready-queue-view'),
        hasKanban: !!app.shadowRoot.querySelector('ft-kanban-view')
      };
    });
    console.log('State after direct switch:', JSON.stringify(state2));
  }

  // Final attempt: take screenshot of whatever is showing
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f47-04-final-state.png` });

  // Step 4: Verify the CSS
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

    // Also get the task title positions
    const rows = readyQueue.shadowRoot.querySelectorAll('.queue-row');
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

    return {
      cellCount: cells.length,
      cells: cellData,
      allAligned,
      widthRange: [Math.min(...widths), Math.max(...widths)],
      rows: rowInfo
    };
  });

  console.log('Feature 47 verification:', JSON.stringify(verification, null, 2));

  await browser.close();
  console.log('Done');
})();

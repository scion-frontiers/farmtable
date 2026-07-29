/**
 * Playwright script to investigate drag-and-drop issues in the Triage column
 * of the Kanban view for collection f7351b20-3c44-41b1-a253-e8dd6128b250.
 */
import { chromium } from 'playwright';

const URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=f7351b20-3c44-41b1-a253-e8dd6128b250&view=kanban';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  // Collect network errors
  const networkErrors = [];
  page.on('requestfailed', request => {
    networkErrors.push({ url: request.url(), failure: request.failure()?.errorText });
  });

  // Collect gRPC responses
  const grpcResponses = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('FarmTableService')) {
      grpcResponses.push({ url, status: response.status() });
    }
  });

  console.log('Navigating to URL...');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for the kanban board to load
  console.log('Waiting for kanban board...');
  await page.waitForTimeout(3000);

  // Take initial screenshot
  await page.screenshot({ path: '/workspace/farmtable-inv-triage/screenshot-initial.png', fullPage: true });
  console.log('Initial screenshot saved.');

  // Check the collection's readOnly state by evaluating in the page
  const appState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'ft-app not found' };

    // Access shadow DOM
    const kanban = app.shadowRoot?.querySelector('ft-kanban-view');
    const readOnlyState = {
      appCurrentCollection: app.currentCollection,
      appIsReadOnly: app.isReadOnly,
      kanbanReadOnly: kanban?.readOnly,
    };
    return readOnlyState;
  });
  console.log('\n=== App State ===');
  console.log(JSON.stringify(appState, null, 2));

  // Check what columns exist and how many tasks are in each
  const columnInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'ft-app not found' };

    const kanban = app.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban) return { error: 'ft-kanban-view not found' };

    const columns = kanban.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return { error: 'no columns found' };

    return Array.from(columns).map(col => {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      const cardDetails = Array.from(cards || []).map(card => ({
        draggable: card.getAttribute('draggable'),
        readOnly: card.readOnly,
        taskName: card.task?.name,
      }));
      return {
        stage: col.stage,
        label: col.label,
        taskCount: cards?.length ?? 0,
        readOnly: col.readOnly,
        cardDetails: cardDetails.slice(0, 3), // first 3 for brevity
      };
    });
  });
  console.log('\n=== Column Info ===');
  console.log(JSON.stringify(columnInfo, null, 2));

  // Try to drag a card from Triage column
  // First find the Triage cards
  const triageCardInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'ft-app not found' };

    const kanban = app.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban) return { error: 'ft-kanban-view not found' };

    const columns = kanban.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return { error: 'no columns found' };

    // Find Triage column (stage 1 = TRIAGE)
    const triageCol = Array.from(columns).find(col => col.stage === 1);
    if (!triageCol) return { error: 'Triage column not found' };

    const cards = triageCol.shadowRoot?.querySelectorAll('ft-task-card');
    return {
      triageColumnStage: triageCol.stage,
      triageColumnReadOnly: triageCol.readOnly,
      cardCount: cards?.length ?? 0,
      cards: Array.from(cards || []).slice(0, 5).map((card, i) => {
        const cardEl = card.shadowRoot?.querySelector('.task-card');
        return {
          index: i,
          taskId: card.task?.id,
          taskName: card.task?.name,
          draggable: cardEl?.getAttribute('draggable'),
          readOnly: card.readOnly,
        };
      }),
    };
  });
  console.log('\n=== Triage Card Info ===');
  console.log(JSON.stringify(triageCardInfo, null, 2));

  // Attempt drag-and-drop via native events
  console.log('\n=== Attempting Drag ===');

  // Use page.evaluate to programmatically fire drag events and see what happens
  const dragResult = await page.evaluate(() => {
    const results = [];

    const app = document.querySelector('ft-app');
    if (!app) return [{ error: 'ft-app not found' }];

    const kanban = app.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban) return [{ error: 'ft-kanban-view not found' }];

    const columns = kanban.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return [{ error: 'no columns found' }];

    // Find Triage column
    const triageCol = Array.from(columns).find(col => col.stage === 1);
    if (!triageCol) return [{ error: 'Triage column not found' }];

    const cards = triageCol.shadowRoot?.querySelectorAll('ft-task-card');
    if (!cards || cards.length === 0) return [{ error: 'No cards in Triage' }];

    const firstCard = cards[0];
    const cardEl = firstCard.shadowRoot?.querySelector('.task-card');
    if (!cardEl) return [{ error: 'No .task-card element found' }];

    results.push({
      step: 'card-found',
      taskName: firstCard.task?.name,
      draggable: cardEl.getAttribute('draggable'),
      computedDraggable: cardEl.draggable,
    });

    // Check if dragstart event would fire
    const dragStartEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    });
    const dragStartResult = cardEl.dispatchEvent(dragStartEvent);
    results.push({
      step: 'dragstart-dispatched',
      wasNotPrevented: dragStartResult,
      defaultPrevented: dragStartEvent.defaultPrevented,
    });

    return results;
  });
  console.log(JSON.stringify(dragResult, null, 2));

  // Check if there are any CSS issues preventing drag
  const cssInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'ft-app not found' };

    const kanban = app.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban) return { error: 'ft-kanban-view not found' };

    const columns = kanban.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return { error: 'no columns found' };

    const triageCol = Array.from(columns).find(col => col.stage === 1);
    if (!triageCol) return { error: 'Triage column not found' };

    const cards = triageCol.shadowRoot?.querySelectorAll('ft-task-card');
    if (!cards || cards.length === 0) return { error: 'No cards in Triage' };

    const firstCard = cards[0];
    const cardEl = firstCard.shadowRoot?.querySelector('.task-card');
    if (!cardEl) return { error: 'No .task-card element found' };

    const computedStyle = getComputedStyle(cardEl);
    return {
      pointerEvents: computedStyle.pointerEvents,
      cursor: computedStyle.cursor,
      userSelect: computedStyle.userSelect,
      display: computedStyle.display,
      position: computedStyle.position,
      overflow: computedStyle.overflow,
    };
  });
  console.log('\n=== CSS Info ===');
  console.log(JSON.stringify(cssInfo, null, 2));

  // Print console logs
  console.log('\n=== Console Logs ===');
  for (const log of consoleLogs) {
    console.log(`[${log.type}] ${log.text}`);
  }

  // Print network errors
  console.log('\n=== Network Errors ===');
  for (const err of networkErrors) {
    console.log(`${err.url}: ${err.failure}`);
  }

  // Print gRPC responses
  console.log('\n=== gRPC Responses ===');
  for (const resp of grpcResponses) {
    console.log(`${resp.url}: ${resp.status}`);
  }

  await browser.close();
})();

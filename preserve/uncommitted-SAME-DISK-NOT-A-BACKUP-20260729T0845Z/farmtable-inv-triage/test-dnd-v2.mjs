/**
 * Targeted drag-and-drop investigation for Triage column.
 */
import { chromium } from 'playwright';

const URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=f7351b20-3c44-41b1-a253-e8dd6128b250&view=kanban';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));

  console.log('Navigating...');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // 1. Check the actual draggable attribute on .card-shell elements
  const cardState = await page.evaluate(() => {
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

    return Array.from(cards).slice(0, 5).map((card, i) => {
      const cardShell = card.shadowRoot?.querySelector('.card-shell');
      return {
        index: i,
        taskId: card.task?.id,
        taskName: card.task?.name?.substring(0, 40),
        readOnly: card.readOnly,
        isEditingTitle: card.isEditingTitle,
        isEditingPriority: card.isEditingPriority,
        cardShellExists: !!cardShell,
        draggableAttr: cardShell?.getAttribute('draggable'),
        draggableProp: cardShell?.draggable,
        computedCursor: cardShell ? getComputedStyle(cardShell).cursor : null,
      };
    });
  });
  console.log('\n=== Card Shell State ===');
  console.log(JSON.stringify(cardState, null, 2));

  // 2. Get bounding boxes of the first Triage card and the Backlog column drop zone
  const boxes = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'ft-app not found' };

    const kanban = app.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban) return { error: 'ft-kanban-view not found' };

    const columns = kanban.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return { error: 'no columns found' };

    const triageCol = Array.from(columns).find(col => col.stage === 1);
    const backlogCol = Array.from(columns).find(col => col.stage === 2);

    if (!triageCol || !backlogCol) return { error: 'Column not found' };

    const firstCard = triageCol.shadowRoot?.querySelector('ft-task-card');
    const cardShell = firstCard?.shadowRoot?.querySelector('.card-shell');
    const dropZone = backlogCol.shadowRoot?.querySelector('.cards');

    return {
      cardShellRect: cardShell?.getBoundingClientRect()?.toJSON(),
      dropZoneRect: dropZone?.getBoundingClientRect()?.toJSON(),
      taskName: firstCard?.task?.name,
    };
  });
  console.log('\n=== Bounding Boxes ===');
  console.log(JSON.stringify(boxes, null, 2));

  // 3. Attempt programmatic drag-and-drop using dispatchEvent
  const dragTest = await page.evaluate(() => {
    const results = [];

    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

    const triageCol = Array.from(columns || []).find(col => col.stage === 1);
    const backlogCol = Array.from(columns || []).find(col => col.stage === 2);

    if (!triageCol || !backlogCol) return [{ error: 'columns not found' }];

    const firstCard = triageCol.shadowRoot?.querySelector('ft-task-card');
    const cardShell = firstCard?.shadowRoot?.querySelector('.card-shell');
    const dropZone = backlogCol.shadowRoot?.querySelector('.cards');

    if (!cardShell || !dropZone) return [{ error: 'elements not found' }];

    // Test dragstart
    const dt = new DataTransfer();
    const dragStart = new DragEvent('dragstart', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
    });
    const startResult = cardShell.dispatchEvent(dragStart);
    results.push({
      event: 'dragstart', dispatched: true,
      returnedTrue: startResult,
      defaultPrevented: dragStart.defaultPrevented,
      dataTransferData: dt.getData('text/plain'),
    });

    // Test dragenter on backlog
    const dragEnter = new DragEvent('dragenter', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
    });
    dropZone.dispatchEvent(dragEnter);
    results.push({ event: 'dragenter', isDragOver: backlogCol.isDragOver });

    // Test dragover on backlog
    const dragOver = new DragEvent('dragover', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
    });
    const overResult = dropZone.dispatchEvent(dragOver);
    results.push({
      event: 'dragover',
      returnedTrue: overResult,
      defaultPrevented: dragOver.defaultPrevented,
    });

    // Test drop on backlog
    const drop = new DragEvent('drop', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
    });
    const dropResult = dropZone.dispatchEvent(drop);
    results.push({
      event: 'drop', returnedTrue: dropResult,
      defaultPrevented: drop.defaultPrevented,
    });

    return results;
  });
  console.log('\n=== Drag Test Results ===');
  console.log(JSON.stringify(dragTest, null, 2));

  // 4. Actually try with Playwright's mouse-based drag
  if (boxes.cardShellRect && boxes.dropZoneRect) {
    console.log('\n=== Mouse-based Drag Test ===');
    const srcX = boxes.cardShellRect.x + boxes.cardShellRect.width / 2;
    const srcY = boxes.cardShellRect.y + boxes.cardShellRect.height / 2;
    const tgtX = boxes.dropZoneRect.x + boxes.dropZoneRect.width / 2;
    const tgtY = boxes.dropZoneRect.y + boxes.dropZoneRect.height / 2;

    console.log(`Dragging from (${srcX}, ${srcY}) to (${tgtX}, ${tgtY})`);

    // Perform drag using Playwright's page.mouse
    await page.mouse.move(srcX, srcY);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(tgtX, tgtY, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Check if the task moved
    const afterDrag = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
      const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

      return Array.from(columns || []).map(col => ({
        stage: col.stage,
        label: col.label,
        taskCount: col.shadowRoot?.querySelectorAll('ft-task-card')?.length ?? 0,
      }));
    });
    console.log('After drag column counts:');
    console.log(JSON.stringify(afterDrag, null, 2));

    await page.screenshot({ path: '/workspace/farmtable-inv-triage/screenshot-after-drag.png', fullPage: true });
  }

  // 5. Check console for any errors during drag
  console.log('\n=== Console Logs ===');
  for (const log of consoleLogs) {
    if (log.type === 'error' || log.type === 'warning') {
      console.log(`[${log.type}] ${log.text}`);
    }
  }

  await browser.close();
})();

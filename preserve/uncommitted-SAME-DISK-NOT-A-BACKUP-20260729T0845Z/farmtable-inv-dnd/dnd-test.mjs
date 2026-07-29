/**
 * DnD Investigation: Test HTML5 drag-and-drop on the live FarmTable deployment.
 * Uses Playwright's Input.dispatchDragEvent (via dragTo()) which correctly
 * simulates native HTML5 DnD, unlike raw mouse.move() sequences.
 */
import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const COLLECTION_ID = 'f7351b20';
const URL = `${BASE_URL}/?collection=${COLLECTION_ID}&view=kanban`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Collect ALL console messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  console.log('=== Navigating to', URL);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('=== Page loaded');

  // Wait for kanban columns to render
  await page.waitForFunction(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return false;
    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (!kanban?.shadowRoot) return false;
    const columns = kanban.shadowRoot.querySelectorAll('ft-kanban-column');
    if (columns.length === 0) return false;
    // Check at least one column has cards
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (cards && cards.length > 0) return true;
    }
    return false;
  }, { timeout: 15000 });
  console.log('=== Kanban columns and cards rendered');

  // === STEP 1: Map the board state ===
  const boardState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return null;

    const result = [];
    for (const col of columns) {
      const label = col.label;
      const stage = col.stage;
      const readOnly = col.readOnly;
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      const cardInfo = [];
      if (cards) {
        for (const card of cards) {
          const shell = card.shadowRoot?.querySelector('.card-shell');
          cardInfo.push({
            taskId: card.task?.id,
            taskName: card.task?.name?.substring(0, 40),
            draggable: shell?.getAttribute('draggable'),
            readOnly: card.readOnly,
          });
        }
      }
      result.push({ label, stage, readOnly, cardCount: cardInfo.length, cards: cardInfo });
    }
    return result;
  });
  console.log('\n=== Board State:');
  for (const col of boardState || []) {
    console.log(`  ${col.label} (stage=${col.stage}, readOnly=${col.readOnly}): ${col.cardCount} cards`);
    for (const card of col.cards.slice(0, 2)) {
      console.log(`    - "${card.taskName}" draggable=${card.draggable} readOnly=${card.readOnly}`);
    }
  }

  // Find a column with cards and another column (different stage) to drag to
  const sourceCol = boardState?.find(c => c.cardCount > 0);
  const targetCol = boardState?.find(c => c.stage !== sourceCol?.stage);
  if (!sourceCol || !targetCol) {
    console.log('ERROR: Cannot find suitable source/target columns');
    await browser.close();
    return;
  }
  const sourceCard = sourceCol.cards[0];
  console.log(`\n=== Will drag "${sourceCard.taskName}" from ${sourceCol.label} to ${targetCol.label}`);

  // === STEP 2: Inject DnD event logging ===
  await page.evaluate(() => {
    const dndEvents = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend'];

    // Log on document (captures bubbled events)
    for (const evt of dndEvents) {
      document.addEventListener(evt, (e) => {
        const target = e.target;
        const tagName = target?.tagName || 'unknown';
        const className = target?.className || '';
        console.log(`[DND-DOC] ${evt} on <${tagName}> class="${className}" | defaultPrevented=${e.defaultPrevented}`);
      }, { capture: true });
    }

    // Also log directly on the kanban components' shadow roots
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (columns) {
      for (const col of columns) {
        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        if (cardsDiv) {
          for (const evt of dndEvents) {
            cardsDiv.addEventListener(evt, (e) => {
              console.log(`[DND-COL] ${evt} on .cards (stage=${col.stage}) | defaultPrevented=${e.defaultPrevented} | dataTransfer=${!!e.dataTransfer}`);
            });
          }
        }
        // Also on cards
        const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
        if (cards) {
          for (const card of cards) {
            const shell = card.shadowRoot?.querySelector('.card-shell');
            if (shell) {
              for (const evt of dndEvents) {
                shell.addEventListener(evt, (e) => {
                  console.log(`[DND-CARD] ${evt} on card "${card.task?.name?.substring(0, 30)}" | draggable=${shell.getAttribute('draggable')}`);
                });
              }
            }
          }
        }
      }
    }
    console.log('[DND-SETUP] Event listeners injected');
  });
  console.log('=== DnD event logging injected');

  // === STEP 3: Attempt drag using Playwright's dragTo() ===
  console.log('\n=== ATTEMPT 1: Using Playwright locator.dragTo() ===');

  // We need to find the source and target elements via evaluate to get their positions
  const positions = await page.evaluate(({ srcTaskId, tgtStage }) => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return null;

    let sourceRect = null;
    let targetRect = null;

    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (cards) {
        for (const card of cards) {
          if (card.task?.id === srcTaskId) {
            const shell = card.shadowRoot?.querySelector('.card-shell');
            sourceRect = shell?.getBoundingClientRect();
          }
        }
      }
      if (col.stage === tgtStage) {
        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        targetRect = cardsDiv?.getBoundingClientRect();
      }
    }
    return { sourceRect, targetRect };
  }, { srcTaskId: sourceCard.taskId, tgtStage: targetCol.stage });

  console.log('Source element rect:', positions?.sourceRect);
  console.log('Target element rect:', positions?.targetRect);

  if (positions?.sourceRect && positions?.targetRect) {
    const srcX = positions.sourceRect.x + positions.sourceRect.width / 2;
    const srcY = positions.sourceRect.y + positions.sourceRect.height / 2;
    const tgtX = positions.targetRect.x + positions.targetRect.width / 2;
    const tgtY = positions.targetRect.y + positions.targetRect.height / 2;

    // Use CDP Input.dispatchDragEvent for proper HTML5 DnD simulation
    const cdp = await page.context().newCDPSession(page);

    console.log(`\nDragging from (${srcX.toFixed(0)}, ${srcY.toFixed(0)}) to (${tgtX.toFixed(0)}, ${tgtY.toFixed(0)})`);

    // Method A: Playwright mouse-based drag (for comparison — this is what prior investigation used)
    console.log('\n--- Method A: Mouse-based drag (like prior investigation) ---');
    await page.mouse.move(srcX, srcY);
    await page.mouse.down();
    // Move in small steps to trigger drag detection
    for (let i = 1; i <= 10; i++) {
      const progress = i / 10;
      await page.mouse.move(
        srcX + (tgtX - srcX) * progress,
        srcY + (tgtY - srcY) * progress,
        { steps: 1 }
      );
    }
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Print DnD events captured
    const dndLogs = consoleLogs.filter(l => l.includes('[DND-'));
    console.log(`\nDnD events captured (Method A): ${dndLogs.length}`);
    for (const log of dndLogs) {
      console.log('  ', log);
    }

    // Clear logs for next attempt
    const method_a_count = dndLogs.length;
    consoleLogs.length = 0;

    // Method B: Using CDP Input.dispatchDragEvent for proper HTML5 DnD
    console.log('\n--- Method B: CDP Input.dispatchDragEvent (proper HTML5 DnD) ---');

    try {
      // dragStart
      await cdp.send('Input.dispatchDragEvent', {
        type: 'dragEnter',
        x: srcX,
        y: srcY,
        data: { items: [{ mimeType: 'text/plain', data: sourceCard.taskId }], dragOperationsMask: 1 }
      });

      // dragOver on target
      await cdp.send('Input.dispatchDragEvent', {
        type: 'dragOver',
        x: tgtX,
        y: tgtY,
        data: { items: [{ mimeType: 'text/plain', data: sourceCard.taskId }], dragOperationsMask: 1 }
      });

      // drop on target
      await cdp.send('Input.dispatchDragEvent', {
        type: 'drop',
        x: tgtX,
        y: tgtY,
        data: { items: [{ mimeType: 'text/plain', data: sourceCard.taskId }], dragOperationsMask: 1 }
      });

      await page.waitForTimeout(500);

      const dndLogs2 = consoleLogs.filter(l => l.includes('[DND-'));
      console.log(`\nDnD events captured (Method B): ${dndLogs2.length}`);
      for (const log of dndLogs2) {
        console.log('  ', log);
      }
    } catch (err) {
      console.log('CDP drag error:', err.message);
    }

    consoleLogs.length = 0;

    // Method C: Use page.dispatchEvent to manually fire DragEvent on the actual elements
    console.log('\n--- Method C: Manual DragEvent dispatch via page.evaluate ---');

    const manualResult = await page.evaluate(({ srcTaskId, tgtStage }) => {
      const results = [];

      const app = document.querySelector('ft-app');
      const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
      const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
      if (!columns) return ['ERROR: No columns found'];

      let sourceShell = null;
      let targetCardsDiv = null;
      let targetColumn = null;

      for (const col of columns) {
        const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
        if (cards) {
          for (const card of cards) {
            if (card.task?.id === srcTaskId) {
              sourceShell = card.shadowRoot?.querySelector('.card-shell');
            }
          }
        }
        if (col.stage === tgtStage) {
          targetCardsDiv = col.shadowRoot?.querySelector('.cards');
          targetColumn = col;
        }
      }

      if (!sourceShell || !targetCardsDiv) {
        return ['ERROR: Could not find source or target elements'];
      }

      // Create a proper DataTransfer object
      const dt = new DataTransfer();
      dt.setData('text/plain', srcTaskId);
      dt.effectAllowed = 'move';

      // Fire dragstart on source
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt
      });
      const dragStartResult = sourceShell.dispatchEvent(dragStartEvent);
      results.push(`dragstart on source: dispatched=${dragStartResult}, defaultPrevented=${dragStartEvent.defaultPrevented}`);
      results.push(`  DataTransfer after dragstart: getData('text/plain')="${dt.getData('text/plain')}", effectAllowed="${dt.effectAllowed}"`);

      // Fire dragenter on target
      const dragEnterEvent = new DragEvent('dragenter', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt
      });
      const dragEnterResult = targetCardsDiv.dispatchEvent(dragEnterEvent);
      results.push(`dragenter on target: dispatched=${dragEnterResult}`);

      // Fire dragover on target
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt
      });
      const dragOverResult = targetCardsDiv.dispatchEvent(dragOverEvent);
      results.push(`dragover on target: dispatched=${dragOverResult}, defaultPrevented=${dragOverEvent.defaultPrevented}`);
      results.push(`  dropEffect after dragover: "${dt.dropEffect}"`);

      // Fire drop on target
      const dropEvent = new DragEvent('drop', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt
      });
      const dropResult = targetCardsDiv.dispatchEvent(dropEvent);
      results.push(`drop on target: dispatched=${dropResult}, defaultPrevented=${dropEvent.defaultPrevented}`);
      results.push(`  getData in drop: "${dt.getData('text/plain')}"`);

      // Fire dragend on source
      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt
      });
      sourceShell.dispatchEvent(dragEndEvent);
      results.push(`dragend on source: dispatched`);

      // Check the isDragOver state
      results.push(`targetColumn.isDragOver after drop: ${targetColumn?.isDragOver}`);

      return results;
    }, { srcTaskId: sourceCard.taskId, tgtStage: targetCol.stage });

    console.log('\nManual DragEvent dispatch results:');
    for (const r of manualResult) {
      console.log('  ', r);
    }

    await page.waitForTimeout(500);
    const dndLogs3 = consoleLogs.filter(l => l.includes('[DND-'));
    console.log(`\nDnD events captured (Method C): ${dndLogs3.length}`);
    for (const log of dndLogs3) {
      console.log('  ', log);
    }

    consoleLogs.length = 0;
  }

  // === STEP 4: Check if the DataTransfer is the issue ===
  console.log('\n=== STEP 4: Deep DataTransfer investigation ===');
  const dtResult = await page.evaluate(({ srcTaskId }) => {
    const results = [];

    // Create a DataTransfer and test the drag flow
    const dt = new DataTransfer();

    // Test 1: Can we setData and getData?
    dt.setData('text/plain', 'test-value');
    results.push(`setData/getData test: "${dt.getData('text/plain')}"`);

    // Test 2: Check if DragEvent constructor works
    try {
      const ev = new DragEvent('dragstart', { dataTransfer: dt });
      results.push(`DragEvent constructor works: ${!!ev}, has dataTransfer: ${!!ev.dataTransfer}`);
      results.push(`DragEvent.dataTransfer === original dt: ${ev.dataTransfer === dt}`);
    } catch (err) {
      results.push(`DragEvent constructor error: ${err.message}`);
    }

    // Test 3: Check the readOnly property behavior
    // In browser-initiated drags, dataTransfer is put in "protected" mode during dragstart
    // and "read-only" mode during dragover/drop, meaning getData() returns "" during dragover/drop
    // But with script-created events, the DataTransfer stays writable
    results.push(`This is a critical difference: browser DnD vs script DnD DataTransfer protection modes`);

    return results;
  }, { srcTaskId: sourceCard.taskId });
  console.log('\nDataTransfer investigation:');
  for (const r of dtResult) {
    console.log('  ', r);
  }

  // === STEP 5: CSS bisection ===
  console.log('\n=== STEP 5: CSS bisection (inject overrides and re-test) ===');

  // Test reverting PR #109 changes (overflow: hidden on ft-app :host)
  // Since ft-app uses Shadow DOM, we need to inject the CSS inside its shadow root
  const cssResults = await page.evaluate(() => {
    const results = [];
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return ['ERROR: No ft-app shadow root'];

    // Check current computed styles on key elements
    const hostStyle = getComputedStyle(app);
    results.push(`ft-app computed: display=${hostStyle.display}, overflow=${hostStyle.overflow}, height=${hostStyle.height}`);

    const content = app.shadowRoot.querySelector('.content');
    if (content) {
      const contentStyle = getComputedStyle(content);
      results.push(`.content computed: display=${contentStyle.display}, overflow=${contentStyle.overflow}, minHeight=${contentStyle.minHeight}`);
    }

    const main = app.shadowRoot.querySelector('.main');
    if (main) {
      const mainStyle = getComputedStyle(main);
      results.push(`.main computed: display=${mainStyle.display}, overflow=${mainStyle.overflow}, minWidth=${mainStyle.minWidth}, position=${mainStyle.position}`);
    }

    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (kanban?.shadowRoot) {
      const kanbanStyle = getComputedStyle(kanban);
      results.push(`ft-kanban-view computed: display=${kanbanStyle.display}, flexDirection=${kanbanStyle.flexDirection}, height=${kanbanStyle.height}`);

      const board = kanban.shadowRoot.querySelector('.board');
      if (board) {
        const boardStyle = getComputedStyle(board);
        results.push(`.board computed: display=${boardStyle.display}, overflow=${boardStyle.overflow}, flex=${boardStyle.flex}, height=${boardStyle.height}`);
      }

      const columns = kanban.shadowRoot.querySelectorAll('ft-kanban-column');
      if (columns.length > 0) {
        const col = columns[0];
        const colStyle = getComputedStyle(col);
        results.push(`ft-kanban-column[0] computed: display=${colStyle.display}, overflow=${colStyle.overflow}, height=${colStyle.height}`);

        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        if (cardsDiv) {
          const cardsStyle = getComputedStyle(cardsDiv);
          results.push(`.cards computed: display=${cardsStyle.display}, overflow=${cardsStyle.overflow}, flex=${cardsStyle.flex}, height=${cardsStyle.height}, minHeight=${cardsStyle.minHeight}`);
        }
      }
    }

    return results;
  });
  console.log('\nComputed styles:');
  for (const r of cssResults) {
    console.log('  ', r);
  }

  // === STEP 6: Check isReadOnly on the ft-app level ===
  const readOnlyCheck = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'no ft-app' };
    return {
      isReadOnly: app.isReadOnly,
      currentCollection: app.currentCollection ? {
        platform: app.currentCollection.platform,
        id: app.currentCollection.id,
      } : 'undefined',
    };
  });
  console.log('\n=== ReadOnly Check:', JSON.stringify(readOnlyCheck));

  // Print any errors from console
  const errors = consoleLogs.filter(l => l.includes('[error]') || l.includes('Error'));
  if (errors.length > 0) {
    console.log('\n=== Console errors:');
    for (const e of errors) {
      console.log('  ', e);
    }
  }

  await browser.close();
  console.log('\n=== Done');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

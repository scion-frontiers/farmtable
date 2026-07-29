/**
 * DnD Investigation v2: Test HTML5 drag-and-drop on the live FarmTable deployment.
 */
import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
// Use the default collection which should have tasks
const COLLECTION_ID = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const URL = `${BASE_URL}/?collection=${COLLECTION_ID}&view=kanban`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  console.log('=== Navigating to', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('=== Page loaded');

  // Wait for kanban columns to render
  try {
    await page.waitForFunction(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return false;
      const kanban = app.shadowRoot.querySelector('ft-kanban-view');
      if (!kanban?.shadowRoot) return false;
      const columns = kanban.shadowRoot.querySelectorAll('ft-kanban-column');
      if (columns.length === 0) return false;
      for (const col of columns) {
        const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
        if (cards && cards.length > 0) return true;
      }
      return false;
    }, { timeout: 15000 });
  } catch (e) {
    // Maybe no cards, check state
    const state = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      return {
        routeView: app?.routeView,
        currentView: app?.currentView,
        hasKanban: !!app?.shadowRoot?.querySelector('ft-kanban-view'),
        isLoading: app?.taskStore?.isLoading,
      };
    });
    console.log('Wait failed, state:', JSON.stringify(state));
    // Try the decomposer collection
    console.log('\nTrying decomposer collection...');
    await page.goto(`${BASE_URL}/?collection=f7351b20-3c44-41b1-a253-e8dd6128b250&view=kanban`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForFunction(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return false;
      const kanban = app.shadowRoot.querySelector('ft-kanban-view');
      if (!kanban?.shadowRoot) return false;
      const columns = kanban.shadowRoot.querySelectorAll('ft-kanban-column');
      return columns.length > 0;
    }, { timeout: 15000 });
  }
  console.log('=== Kanban rendered');

  // === Map the board state ===
  const boardState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return null;

    const result = [];
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      const cardInfo = [];
      if (cards) {
        for (const card of cards) {
          const shell = card.shadowRoot?.querySelector('.card-shell');
          cardInfo.push({
            taskId: card.task?.id,
            taskName: card.task?.name?.substring(0, 50),
            draggable: shell?.getAttribute('draggable'),
            readOnly: card.readOnly,
            shellRect: shell?.getBoundingClientRect(),
          });
        }
      }
      const cardsDiv = col.shadowRoot?.querySelector('.cards');
      result.push({
        label: col.label,
        stage: col.stage,
        readOnly: col.readOnly,
        cardCount: cardInfo.length,
        cards: cardInfo,
        cardsDivRect: cardsDiv?.getBoundingClientRect(),
      });
    }
    return result;
  });

  console.log('\n=== Board State:');
  let sourceCard = null;
  let sourceCol = null;
  let targetCol = null;
  for (const col of boardState || []) {
    console.log(`  ${col.label} (stage=${col.stage}, readOnly=${col.readOnly}): ${col.cardCount} cards, rect=${JSON.stringify(col.cardsDivRect)}`);
    for (const card of col.cards.slice(0, 3)) {
      console.log(`    - "${card.taskName}" draggable=${card.draggable} readOnly=${card.readOnly}`);
    }
    if (!sourceCard && col.cardCount > 0) {
      sourceCard = col.cards[0];
      sourceCol = col;
    }
    if (sourceCol && col.stage !== sourceCol.stage && !targetCol) {
      targetCol = col;
    }
  }

  if (!sourceCard || !targetCol) {
    console.log('ERROR: Cannot find suitable source/target. Source:', !!sourceCard, 'Target:', !!targetCol);
    await browser.close();
    return;
  }

  console.log(`\n=== Source: "${sourceCard.taskName}" in ${sourceCol.label}, draggable=${sourceCard.draggable}`);
  console.log(`=== Target: ${targetCol.label} column`);

  // === Inject DnD event logging ===
  await page.evaluate(() => {
    window.__dndLog = [];
    const dndEvents = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend'];

    document.addEventListener('dragstart', (e) => {
      const log = `dragstart: target=<${e.target?.tagName}> defaultPrevented=${e.defaultPrevented}`;
      window.__dndLog.push(log);
      console.log('[DND] ' + log);
    }, { capture: true });

    for (const evt of dndEvents) {
      document.addEventListener(evt, (e) => {
        const log = `${evt}: composedPath=[${e.composedPath().slice(0, 3).map(n => n?.tagName || n?.constructor?.name).join(',')}] defaultPrevented=${e.defaultPrevented}`;
        window.__dndLog.push(log);
      }, { capture: true });
    }
  });

  // === METHOD 1: Manual DragEvent dispatch (simulates what browser HTML5 DnD does) ===
  console.log('\n=== METHOD 1: Manual DragEvent dispatch ===');

  const result1 = await page.evaluate(({ srcTaskId, tgtStage }) => {
    const results = [];

    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns) return ['ERROR: No columns found'];

    let sourceShell = null;
    let sourceCard = null;
    let targetCardsDiv = null;
    let targetColumn = null;

    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (cards) {
        for (const card of cards) {
          if (card.task?.id === srcTaskId) {
            sourceShell = card.shadowRoot?.querySelector('.card-shell');
            sourceCard = card;
          }
        }
      }
      if (col.stage === tgtStage) {
        targetCardsDiv = col.shadowRoot?.querySelector('.cards');
        targetColumn = col;
      }
    }

    if (!sourceShell) return ['ERROR: Source card shell not found'];
    if (!targetCardsDiv) return ['ERROR: Target cards div not found'];

    results.push(`Source draggable="${sourceShell.getAttribute('draggable')}"`);
    results.push(`Source readOnly=${sourceCard.readOnly}`);
    results.push(`Target column readOnly=${targetColumn.readOnly}`);

    // === Critical test: simulate EXACTLY what a browser does ===
    const dt = new DataTransfer();

    // 1. dragstart on source
    const dragStart = new DragEvent('dragstart', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt
    });
    sourceShell.dispatchEvent(dragStart);
    results.push(`1. dragstart dispatched, defaultPrevented=${dragStart.defaultPrevented}`);
    results.push(`   After dragstart: getData='${dt.getData('text/plain')}', effectAllowed='${dt.effectAllowed}'`);

    if (dragStart.defaultPrevented) {
      results.push('⚠️ dragstart was PREVENTED — this means DnD is blocked at the source!');
      // Check why
      results.push(`   readOnly=${sourceCard.readOnly}, isEditingTitle=${sourceCard.isEditingTitle}, isEditingPriority=${sourceCard.isEditingPriority}`);
      return results;
    }

    // 2. dragenter on target
    const dragEnter = new DragEvent('dragenter', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt
    });
    targetCardsDiv.dispatchEvent(dragEnter);
    results.push(`2. dragenter dispatched, isDragOver=${targetColumn.isDragOver}`);

    // 3. dragover on target (MUST call preventDefault to allow drop!)
    const dragOver = new DragEvent('dragover', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt
    });
    targetCardsDiv.dispatchEvent(dragOver);
    results.push(`3. dragover dispatched, defaultPrevented=${dragOver.defaultPrevented}, dropEffect='${dt.dropEffect}'`);

    if (!dragOver.defaultPrevented) {
      results.push('⚠️ dragover was NOT prevented — browser would show "no drop" cursor and block the drop!');
    }

    // 4. drop on target
    const drop = new DragEvent('drop', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt
    });
    targetCardsDiv.dispatchEvent(drop);
    results.push(`4. drop dispatched, defaultPrevented=${drop.defaultPrevented}`);
    results.push(`   getData in drop handler: '${dt.getData('text/plain')}'`);

    // 5. dragend on source
    const dragEnd = new DragEvent('dragend', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt
    });
    sourceShell.dispatchEvent(dragEnd);
    results.push('5. dragend dispatched');

    return results;
  }, { srcTaskId: sourceCard.taskId, tgtStage: targetCol.stage });

  console.log('\nManual DragEvent results:');
  for (const r of result1) {
    console.log('  ', r);
  }

  // Check console for stage-change events
  await page.waitForTimeout(1000);
  const stageChangeLogs = consoleLogs.filter(l => l.includes('stage') || l.includes('update'));
  if (stageChangeLogs.length > 0) {
    console.log('\nStage change logs:', stageChangeLogs);
  }

  // === METHOD 2: Playwright's mouse-based drag (for comparison) ===
  console.log('\n=== METHOD 2: Playwright mouse drag ===');
  consoleLogs.length = 0;

  // Reload to reset state
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Re-inject logging
  await page.evaluate(() => {
    window.__dndLog = [];
    const dndEvents = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend'];
    for (const evt of dndEvents) {
      document.addEventListener(evt, (e) => {
        window.__dndLog.push(`${evt}: target=<${e.target?.tagName}> defaultPrevented=${e.defaultPrevented}`);
        console.log(`[DND] ${evt}: target=<${e.target?.tagName}> path0=<${e.composedPath()[0]?.tagName}>`);
      }, { capture: true });
    }
  });

  const pos2 = await page.evaluate(({ srcTaskId, tgtStage }) => {
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

  if (pos2?.sourceRect && pos2?.targetRect) {
    const srcX = pos2.sourceRect.x + pos2.sourceRect.width / 2;
    const srcY = pos2.sourceRect.y + pos2.sourceRect.height / 2;
    const tgtX = pos2.targetRect.x + pos2.targetRect.width / 2;
    const tgtY = pos2.targetRect.y + pos2.targetRect.height / 2;

    console.log(`Dragging from (${srcX.toFixed(0)}, ${srcY.toFixed(0)}) to (${tgtX.toFixed(0)}, ${tgtY.toFixed(0)})`);

    await page.mouse.move(srcX, srcY);
    await page.mouse.down();
    // Slow drag to trigger native DnD
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(
        srcX + (tgtX - srcX) * (i / 20),
        srcY + (tgtY - srcY) * (i / 20),
        { steps: 1 }
      );
      await page.waitForTimeout(20);
    }
    await page.mouse.up();

    await page.waitForTimeout(1000);

    const dndEvents = await page.evaluate(() => window.__dndLog);
    console.log(`\nDnD events captured: ${dndEvents.length}`);
    for (const log of dndEvents) {
      console.log('  ', log);
    }

    if (dndEvents.length === 0) {
      console.log('  ⚠️ NO DnD events fired at all — mouse drag does NOT trigger HTML5 DnD in headless Chromium CDP!');
    }
  }

  // === Computed styles check ===
  console.log('\n=== Computed styles on DnD-relevant elements ===');
  const styles = await page.evaluate(() => {
    const results = {};
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app' };

    results.app = {
      overflow: getComputedStyle(app).overflow,
      display: getComputedStyle(app).display,
      height: getComputedStyle(app).height,
      pointerEvents: getComputedStyle(app).pointerEvents,
    };

    const content = app.shadowRoot.querySelector('.content');
    if (content) {
      results.content = {
        overflow: getComputedStyle(content).overflow,
        pointerEvents: getComputedStyle(content).pointerEvents,
      };
    }

    const main = app.shadowRoot.querySelector('.main');
    if (main) {
      results.main = {
        overflow: getComputedStyle(main).overflow,
        pointerEvents: getComputedStyle(main).pointerEvents,
        position: getComputedStyle(main).position,
      };
    }

    // Check for dim overlay
    const dimOverlay = app.shadowRoot.querySelector('.dim-overlay');
    results.dimOverlay = dimOverlay ? {
      exists: true,
      pointerEvents: getComputedStyle(dimOverlay).pointerEvents,
      zIndex: getComputedStyle(dimOverlay).zIndex,
    } : { exists: false };

    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (kanban?.shadowRoot) {
      results.kanbanView = {
        overflow: getComputedStyle(kanban).overflow,
        pointerEvents: getComputedStyle(kanban).pointerEvents,
      };

      const board = kanban.shadowRoot.querySelector('.board');
      if (board) {
        results.board = {
          overflow: getComputedStyle(board).overflow,
          pointerEvents: getComputedStyle(board).pointerEvents,
        };
      }

      const col = kanban.shadowRoot.querySelector('ft-kanban-column');
      if (col?.shadowRoot) {
        results.column = {
          overflow: getComputedStyle(col).overflow,
          pointerEvents: getComputedStyle(col).pointerEvents,
        };

        const cards = col.shadowRoot.querySelector('.cards');
        if (cards) {
          results.cardsDiv = {
            overflow: getComputedStyle(cards).overflow,
            pointerEvents: getComputedStyle(cards).pointerEvents,
          };
        }

        const card = col.shadowRoot.querySelector('ft-task-card');
        if (card?.shadowRoot) {
          const shell = card.shadowRoot.querySelector('.card-shell');
          results.cardShell = {
            draggable: shell?.getAttribute('draggable'),
            pointerEvents: getComputedStyle(shell).pointerEvents,
            userSelect: getComputedStyle(shell).userSelect,
            webkitUserDrag: getComputedStyle(shell).webkitUserDrag,
          };
        }
      }
    }

    return results;
  });
  console.log(JSON.stringify(styles, null, 2));

  await browser.close();
  console.log('\n=== Done');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

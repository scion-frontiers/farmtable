/**
 * DnD Investigation v3: Focused test — fresh page, correct source/target, deep shadow DOM tracing.
 */
import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const COLLECTION_ID = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const URL = `${BASE_URL}/?collection=${COLLECTION_ID}&view=kanban`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('=== Navigating to', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for cards
  await page.waitForFunction(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (!columns || columns.length === 0) return false;
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (cards && cards.length > 0) return true;
    }
    return false;
  }, { timeout: 15000 });
  console.log('=== Board loaded');

  // Find source (first card in first column with cards) and target (a DIFFERENT column)
  const setup = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

    let source = null;
    let target = null;

    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (!source && cards?.length > 0) {
        const card = cards[0];
        const shell = card.shadowRoot?.querySelector('.card-shell');
        const rect = shell?.getBoundingClientRect();
        source = {
          taskId: card.task.id,
          taskName: card.task.name?.substring(0, 40),
          stage: col.stage,
          label: col.label,
          draggable: shell?.getAttribute('draggable'),
          readOnly: card.readOnly,
          columnReadOnly: col.readOnly,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        };
      } else if (source && !target) {
        // Pick a different column as target
        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        const rect = cardsDiv?.getBoundingClientRect();
        target = {
          stage: col.stage,
          label: col.label,
          readOnly: col.readOnly,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        };
      }
    }
    return { source, target };
  });

  console.log('Source:', JSON.stringify(setup.source));
  console.log('Target:', JSON.stringify(setup.target));

  if (!setup.source || !setup.target) {
    console.log('ERROR: No source/target');
    await browser.close();
    return;
  }

  // === Inject deep DnD event tracing INSIDE shadow roots ===
  await page.evaluate(() => {
    window.__dndTrace = [];
    const EVENTS = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend'];

    // Helper to add traced listeners
    function traceElement(el, label) {
      for (const evt of EVENTS) {
        el.addEventListener(evt, (e) => {
          const entry = {
            event: evt,
            label,
            target: e.target?.tagName || e.target?.nodeName || 'unknown',
            defaultPrevented: e.defaultPrevented,
            timestamp: Date.now(),
          };
          if (evt === 'dragstart' || evt === 'drop') {
            entry.dataTransferData = e.dataTransfer?.getData?.('text/plain') || '(none)';
          }
          if (evt === 'dragover') {
            entry.dropEffect = e.dataTransfer?.dropEffect;
          }
          window.__dndTrace.push(entry);
        });
      }
    }

    // Trace at multiple levels
    traceElement(document, 'document');

    const app = document.querySelector('ft-app');
    if (app?.shadowRoot) {
      const main = app.shadowRoot.querySelector('.main');
      if (main) traceElement(main, 'ft-app .main');
    }

    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    if (kanban?.shadowRoot) {
      const board = kanban.shadowRoot.querySelector('.board');
      if (board) traceElement(board, 'kanban .board');
    }

    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    if (columns) {
      for (const col of columns) {
        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        if (cardsDiv) {
          traceElement(cardsDiv, `col[${col.stage}] .cards`);
        }
      }
    }
  });

  const srcX = setup.source.rect.x + setup.source.rect.w / 2;
  const srcY = setup.source.rect.y + setup.source.rect.h / 2;
  const tgtX = setup.target.rect.x + setup.target.rect.w / 2;
  const tgtY = setup.target.rect.y + setup.target.rect.h / 2;

  console.log(`\n=== Mouse drag from (${srcX.toFixed(0)}, ${srcY.toFixed(0)}) [${setup.source.label}] to (${tgtX.toFixed(0)}, ${tgtY.toFixed(0)}) [${setup.target.label}]`);

  // Perform the drag
  await page.mouse.move(srcX, srcY);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(50);

  // Move in steps to trigger drag detection
  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      srcX + (tgtX - srcX) * (i / steps),
      srcY + (tgtY - srcY) * (i / steps),
      { steps: 1 }
    );
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Get trace
  const trace = await page.evaluate(() => window.__dndTrace);
  console.log(`\n=== DnD Event Trace (${trace.length} events):`);

  // Group by event type
  const byType = {};
  for (const t of trace) {
    if (!byType[t.event]) byType[t.event] = [];
    byType[t.event].push(t);
  }

  for (const [evt, entries] of Object.entries(byType)) {
    const labels = [...new Set(entries.map(e => e.label))];
    const prevented = entries.some(e => e.defaultPrevented);
    const sample = entries[0];
    console.log(`  ${evt}: ${entries.length} events, labels=[${labels.join(', ')}], prevented=${prevented}`);
    if (evt === 'dragstart' || evt === 'drop') {
      console.log(`    dataTransfer: "${sample.dataTransferData}"`);
    }
  }

  // Check if dragover reached any column
  const dragoverInColumn = trace.filter(t => t.event === 'dragover' && t.label.startsWith('col['));
  console.log(`\n=== Key finding: dragover events reaching column .cards: ${dragoverInColumn.length}`);
  if (dragoverInColumn.length > 0) {
    console.log('  dragover DID reach column handlers — DnD should work');
    for (const e of dragoverInColumn.slice(0, 3)) {
      console.log(`    ${e.label} defaultPrevented=${e.defaultPrevented}`);
    }
  } else {
    console.log('  ⚠️ dragover NEVER reached any column .cards handler!');
    console.log('  This means events are being intercepted before reaching the drop target.');

    // Check what DID get dragover
    const dragoverLabels = [...new Set(trace.filter(t => t.event === 'dragover').map(t => t.label))];
    console.log(`  dragover events were captured at: [${dragoverLabels.join(', ')}]`);
  }

  // Check drop
  const dropInColumn = trace.filter(t => t.event === 'drop' && t.label.startsWith('col['));
  console.log(`\n=== Drop events reaching column .cards: ${dropInColumn.length}`);

  // === Now test with MANUAL dispatch (for comparison) ===
  console.log('\n\n=== COMPARISON: Manual DragEvent dispatch (simulating browser) ===');

  const manualResult = await page.evaluate(({ srcTaskId, tgtStage }) => {
    const results = [];
    window.__dndTrace = []; // Reset trace

    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

    let sourceShell = null;
    let targetCardsDiv = null;

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
      }
    }

    if (!sourceShell || !targetCardsDiv) {
      return ['ERROR: Elements not found'];
    }

    const dt = new DataTransfer();

    // dragstart
    const ds = new DragEvent('dragstart', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt });
    sourceShell.dispatchEvent(ds);
    results.push(`dragstart: prevented=${ds.defaultPrevented}, data="${dt.getData('text/plain')}"`);

    // dragenter
    const de = new DragEvent('dragenter', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt });
    targetCardsDiv.dispatchEvent(de);

    // dragover
    const dov = new DragEvent('dragover', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt });
    targetCardsDiv.dispatchEvent(dov);
    results.push(`dragover: prevented=${dov.defaultPrevented}`);

    // drop
    const dr = new DragEvent('drop', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt });
    targetCardsDiv.dispatchEvent(dr);
    results.push(`drop: prevented=${dr.defaultPrevented}, data="${dt.getData('text/plain')}"`);

    // dragend
    const dend = new DragEvent('dragend', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt });
    sourceShell.dispatchEvent(dend);

    return results;
  }, { srcTaskId: setup.source.taskId, tgtStage: setup.target.stage });

  console.log('Manual dispatch results:');
  for (const r of manualResult) {
    console.log('  ', r);
  }

  const manualTrace = await page.evaluate(() => window.__dndTrace);
  const manualDragoverInCol = manualTrace.filter(t => t.event === 'dragover' && t.label.startsWith('col['));
  console.log(`Manual: dragover in column .cards: ${manualDragoverInCol.length}`);
  if (manualDragoverInCol.length > 0) {
    for (const e of manualDragoverInCol.slice(0, 3)) {
      console.log(`  ${e.label} defaultPrevented=${e.defaultPrevented}`);
    }
  }

  // === Check what the user-select, -webkit-user-drag styles are ===
  console.log('\n=== CSS Properties that could affect DnD ===');
  const cssCheck = await page.evaluate(() => {
    const results = {};
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

    if (columns?.length > 0) {
      const col = columns[0];
      const card = col.shadowRoot?.querySelector('ft-task-card');
      if (card?.shadowRoot) {
        const shell = card.shadowRoot.querySelector('.card-shell');
        const slCard = card.shadowRoot.querySelector('sl-card');
        const cs = getComputedStyle(shell);
        results.cardShell = {
          userSelect: cs.userSelect,
          webkitUserDrag: cs.webkitUserDrag,
          draggable: shell.getAttribute('draggable'),
          pointerEvents: cs.pointerEvents,
          cursor: cs.cursor,
          zIndex: cs.zIndex,
          position: cs.position,
          transform: cs.transform,
        };
        if (slCard) {
          const scs = getComputedStyle(slCard);
          results.slCard = {
            pointerEvents: scs.pointerEvents,
            overflow: scs.overflow,
          };
        }
      }
    }

    // Check all ancestors from ft-app down for anything that could intercept
    const main = app?.shadowRoot?.querySelector('.main');
    if (main) {
      results.main = {
        overflow: getComputedStyle(main).overflow,
        position: getComputedStyle(main).position,
        transform: getComputedStyle(main).transform,
      };
    }

    // Theme CSS
    const themeLink = document.querySelector('link[href*="index-"]');
    results.themeHref = themeLink?.href || 'not found';

    return results;
  });
  console.log(JSON.stringify(cssCheck, null, 2));

  // === Key check: element at the target coordinates ===
  console.log('\n=== Hit test: what element is at target coordinates? ===');
  const hitTest = await page.evaluate(({ x, y }) => {
    const elements = document.elementsFromPoint(x, y);
    return elements.map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className?.toString?.()?.substring(0, 50) || '',
      draggable: el.getAttribute?.('draggable'),
    }));
  }, { x: tgtX, y: tgtY });
  console.log(`Elements at (${tgtX.toFixed(0)}, ${tgtY.toFixed(0)}):`);
  for (const el of hitTest) {
    console.log(`  <${el.tag}> class="${el.class}" draggable=${el.draggable}`);
  }

  // Also check with elementsFromPoint inside shadow roots
  const deepHitTest = await page.evaluate(({ x, y }) => {
    const results = [];
    let current = document.elementFromPoint(x, y);

    while (current) {
      results.push({
        tag: current.tagName,
        class: current.className?.toString?.()?.substring(0, 50) || '',
      });
      if (current.shadowRoot) {
        current = current.shadowRoot.elementFromPoint(x, y);
      } else {
        break;
      }
    }
    return results;
  }, { x: tgtX, y: tgtY });
  console.log('\nDeep hit test (piercing shadow DOMs):');
  for (const el of deepHitTest) {
    console.log(`  <${el.tag}> class="${el.class}"`);
  }

  await browser.close();
  console.log('\n=== Done');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

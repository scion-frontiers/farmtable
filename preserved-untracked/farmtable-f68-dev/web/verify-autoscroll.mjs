/**
 * Playwright verification script for Feature 68 — Kanban auto-scroll during drag.
 *
 * Tests:
 *   1. Right-edge auto-scroll: scrollLeft increases when dragover fires near right edge
 *   2. Left-edge auto-scroll: scrollLeft decreases when dragover fires near left edge
 *   3. Scroll stops when pointer moves away from edge (dragover in center)
 *   4. Scroll stops on dragend
 *   5. Speed scaling: closer to edge → faster scroll
 *
 * Strategy: dispatch synthetic DragEvent/dragover events on the .board container
 * and measure scrollLeft changes over multiple rAF frames. This directly tests the
 * event listeners and rAF scroll loop without needing full HTML5 DnD simulation.
 */

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/reports/f68-autoscroll-evidence';
const VITE_PORT = 5199;  // non-default port to avoid conflicts
const DEV_URL = `http://localhost:${VITE_PORT}/test-autoscroll.html`;

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const results = [];

function record(check, action, pass, detail) {
  results.push({ check, action, pass, detail, timestamp: new Date().toISOString() });
  console.log(`  [${check}] ${pass ? 'PASS' : 'FAIL'}: ${action}`);
  if (detail) console.log(`    ${detail}`);
}

// Assumes Vite dev server is already running on VITE_PORT.
// Start it beforehand:  npx vite --port 5199 --strictPort &

async function waitForVite(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Vite did not respond at ${url} within ${timeoutMs}ms — start it first with: npx vite --port ${VITE_PORT} --strictPort`);
}

// ── Main ───────────────────────────────────────────────────────────

async function run() {
  await waitForVite(`http://localhost:${VITE_PORT}/`);
  console.log('Vite is ready.\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 900, height: 700 },  // narrow viewport to force horizontal overflow
    });
    const page = await context.newPage();

    // ── Load test page ──
    console.log('Loading test page...');
    await page.goto(DEV_URL, { waitUntil: 'load', timeout: 20000 });

    // Wait for components to render
    await page.waitForFunction(() => window.__TEST_READY__ === true, { timeout: 15000 });
    await page.waitForTimeout(1000);  // extra buffer for Lit rendering

    // ── Verify the board is scrollable ──
    console.log('\n=== Verifying board setup ===');
    const boardInfo = await page.evaluate(() => {
      const kanban = document.querySelector('ft-kanban-view');
      if (!kanban?.shadowRoot) return { error: 'no kanban shadow root' };
      const board = kanban.shadowRoot.querySelector('.board');
      if (!board) return { error: 'no .board element' };
      const columns = board.querySelectorAll('ft-kanban-column');
      const rect = board.getBoundingClientRect();
      return {
        scrollWidth: board.scrollWidth,
        clientWidth: board.clientWidth,
        scrollLeft: board.scrollLeft,
        isOverflowing: board.scrollWidth > board.clientWidth,
        columnCount: columns.length,
        boardRect: { left: rect.left, right: rect.right, width: rect.width },
      };
    });
    console.log(`Board info: ${JSON.stringify(boardInfo, null, 2)}`);

    record('setup', 'Board has horizontal overflow',
      boardInfo.isOverflowing,
      `scrollWidth=${boardInfo.scrollWidth}, clientWidth=${boardInfo.clientWidth}, ` +
      `columns=${boardInfo.columnCount}, overflow=${boardInfo.isOverflowing}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/01-initial-board.png`, fullPage: false });

    // ═══════════════════════════════════════════════════════════════
    // TEST 1: Right-edge auto-scroll
    // Dispatch dragstart on a card, then dragover events near the right
    // edge of .board, and measure scrollLeft increasing over time.
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== TEST 1: Right-edge auto-scroll ===');

    const rightScrollLog = await page.evaluate(async () => {
      const kanban = document.querySelector('ft-kanban-view');
      const board = kanban.shadowRoot.querySelector('.board');
      const firstColumn = board.querySelector('ft-kanban-column');
      const firstCard = firstColumn?.shadowRoot?.querySelector('ft-task-card');
      const cardShell = firstCard?.shadowRoot?.querySelector('.card-shell');

      if (!board || !cardShell) return { error: 'elements not found' };

      const boardRect = board.getBoundingClientRect();

      // 1. Dispatch dragstart on a card to begin the drag
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true, composed: true, cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      cardShell.dispatchEvent(dragStartEvent);

      // 2. Dispatch dragover events near the RIGHT edge (20px from right)
      const log = [];
      const clientX = boardRect.right - 20;
      const clientY = boardRect.top + boardRect.height / 2;

      log.push({ step: 'initial', scrollLeft: board.scrollLeft });

      // Dispatch dragover then wait for multiple rAF cycles
      for (let i = 0; i < 8; i++) {
        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true, composed: true, cancelable: true,
          clientX, clientY,
        });
        board.dispatchEvent(dragOverEvent);

        // Wait ~50ms (≈3 rAF frames at 60fps) for scroll to happen
        await new Promise(r => setTimeout(r, 50));
        log.push({ step: `dragover-right-${i}`, scrollLeft: board.scrollLeft });
      }

      // 3. End the drag
      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true, composed: true, cancelable: true,
      });
      cardShell.dispatchEvent(dragEndEvent);

      await new Promise(r => setTimeout(r, 100));
      log.push({ step: 'after-dragend', scrollLeft: board.scrollLeft });

      return { log, boardWidth: boardRect.width, scrollWidth: board.scrollWidth };
    });

    console.log('Right-scroll log:');
    for (const entry of rightScrollLog.log) {
      console.log(`  ${entry.step}: scrollLeft = ${entry.scrollLeft.toFixed(1)}`);
    }

    const rightEntries = rightScrollLog.log.filter(e => e.step.startsWith('dragover-right'));
    const rightStart = rightScrollLog.log[0].scrollLeft;
    const rightEnd = rightEntries[rightEntries.length - 1].scrollLeft;
    const rightDelta = rightEnd - rightStart;
    const rightIncreasing = rightDelta > 10;  // expect meaningful scroll

    record('right-scroll', 'Right-edge dragover increases scrollLeft',
      rightIncreasing,
      `scrollLeft went from ${rightStart.toFixed(1)} to ${rightEnd.toFixed(1)} ` +
      `(delta = +${rightDelta.toFixed(1)}px over ${rightEntries.length} dragover steps)`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/02-after-right-scroll.png`, fullPage: false });

    // ═══════════════════════════════════════════════════════════════
    // TEST 2: Left-edge auto-scroll
    // Now board is scrolled right. Dispatch dragover near left edge.
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== TEST 2: Left-edge auto-scroll ===');

    const leftScrollLog = await page.evaluate(async () => {
      const kanban = document.querySelector('ft-kanban-view');
      const board = kanban.shadowRoot.querySelector('.board');
      const firstColumn = board.querySelector('ft-kanban-column');
      const firstCard = firstColumn?.shadowRoot?.querySelector('ft-task-card');
      const cardShell = firstCard?.shadowRoot?.querySelector('.card-shell');

      if (!board || !cardShell) return { error: 'elements not found' };

      const boardRect = board.getBoundingClientRect();

      // Ensure we're scrolled right first
      if (board.scrollLeft < 50) {
        board.scrollLeft = 200;
        await new Promise(r => setTimeout(r, 50));
      }

      // 1. Dispatch dragstart
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true, composed: true, cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      cardShell.dispatchEvent(dragStartEvent);

      // 2. Dispatch dragover events near the LEFT edge (20px from left)
      const log = [];
      const clientX = boardRect.left + 20;
      const clientY = boardRect.top + boardRect.height / 2;

      log.push({ step: 'initial', scrollLeft: board.scrollLeft });

      for (let i = 0; i < 8; i++) {
        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true, composed: true, cancelable: true,
          clientX, clientY,
        });
        board.dispatchEvent(dragOverEvent);

        await new Promise(r => setTimeout(r, 50));
        log.push({ step: `dragover-left-${i}`, scrollLeft: board.scrollLeft });
      }

      // 3. End the drag
      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true, composed: true, cancelable: true,
      });
      cardShell.dispatchEvent(dragEndEvent);

      await new Promise(r => setTimeout(r, 100));
      log.push({ step: 'after-dragend', scrollLeft: board.scrollLeft });

      return { log };
    });

    console.log('Left-scroll log:');
    for (const entry of leftScrollLog.log) {
      console.log(`  ${entry.step}: scrollLeft = ${entry.scrollLeft.toFixed(1)}`);
    }

    const leftEntries = leftScrollLog.log.filter(e => e.step.startsWith('dragover-left'));
    const leftStart = leftScrollLog.log[0].scrollLeft;
    const leftEnd = leftEntries[leftEntries.length - 1].scrollLeft;
    const leftDelta = leftStart - leftEnd;
    const leftDecreasing = leftDelta > 10;

    record('left-scroll', 'Left-edge dragover decreases scrollLeft',
      leftDecreasing,
      `scrollLeft went from ${leftStart.toFixed(1)} to ${leftEnd.toFixed(1)} ` +
      `(delta = -${leftDelta.toFixed(1)}px over ${leftEntries.length} dragover steps)`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/03-after-left-scroll.png`, fullPage: false });

    // ═══════════════════════════════════════════════════════════════
    // TEST 3: Scroll stops when pointer moves to center
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== TEST 3: Scroll stops when pointer moves to center ===');

    const stopOnCenterLog = await page.evaluate(async () => {
      const kanban = document.querySelector('ft-kanban-view');
      const board = kanban.shadowRoot.querySelector('.board');
      const firstColumn = board.querySelector('ft-kanban-column');
      const firstCard = firstColumn?.shadowRoot?.querySelector('ft-task-card');
      const cardShell = firstCard?.shadowRoot?.querySelector('.card-shell');

      if (!board || !cardShell) return { error: 'elements not found' };

      const boardRect = board.getBoundingClientRect();

      // Reset scroll position
      board.scrollLeft = 0;
      await new Promise(r => setTimeout(r, 50));

      // 1. Start drag
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true, composed: true, cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      cardShell.dispatchEvent(dragStartEvent);

      const log = [];

      // 2. Dragover near right edge to start scrolling
      for (let i = 0; i < 4; i++) {
        board.dispatchEvent(new DragEvent('dragover', {
          bubbles: true, composed: true, cancelable: true,
          clientX: boardRect.right - 20,
          clientY: boardRect.top + boardRect.height / 2,
        }));
        await new Promise(r => setTimeout(r, 50));
      }
      log.push({ step: 'after-edge-dragover', scrollLeft: board.scrollLeft });

      // 3. Move pointer to center (outside threshold)
      board.dispatchEvent(new DragEvent('dragover', {
        bubbles: true, composed: true, cancelable: true,
        clientX: boardRect.left + boardRect.width / 2,
        clientY: boardRect.top + boardRect.height / 2,
      }));

      // 4. Wait and check that scroll stops
      const scrollAfterCenter = board.scrollLeft;
      await new Promise(r => setTimeout(r, 200));  // wait extra frames
      const scrollAfterWait = board.scrollLeft;

      log.push({ step: 'after-center-dragover', scrollLeft: scrollAfterCenter });
      log.push({ step: 'after-200ms-wait', scrollLeft: scrollAfterWait });

      // Cleanup
      cardShell.dispatchEvent(new DragEvent('dragend', {
        bubbles: true, composed: true, cancelable: true,
      }));

      return { log, scrollStopped: Math.abs(scrollAfterWait - scrollAfterCenter) < 1 };
    });

    console.log('Stop-on-center log:');
    for (const entry of stopOnCenterLog.log) {
      console.log(`  ${entry.step}: scrollLeft = ${entry.scrollLeft.toFixed(1)}`);
    }

    record('stop-on-center', 'Scroll stops when pointer moves away from edge',
      stopOnCenterLog.scrollStopped,
      `After moving to center: scrollLeft=${stopOnCenterLog.log[1]?.scrollLeft.toFixed(1)}, ` +
      `after 200ms wait: scrollLeft=${stopOnCenterLog.log[2]?.scrollLeft.toFixed(1)} ` +
      `(stopped=${stopOnCenterLog.scrollStopped})`);

    // ═══════════════════════════════════════════════════════════════
    // TEST 4: Scroll stops on dragend
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== TEST 4: Scroll stops on dragend ===');

    const stopOnDragendLog = await page.evaluate(async () => {
      const kanban = document.querySelector('ft-kanban-view');
      const board = kanban.shadowRoot.querySelector('.board');
      const firstColumn = board.querySelector('ft-kanban-column');
      const firstCard = firstColumn?.shadowRoot?.querySelector('ft-task-card');
      const cardShell = firstCard?.shadowRoot?.querySelector('.card-shell');

      if (!board || !cardShell) return { error: 'elements not found' };

      const boardRect = board.getBoundingClientRect();

      // Reset scroll
      board.scrollLeft = 0;
      await new Promise(r => setTimeout(r, 50));

      // 1. Start drag
      cardShell.dispatchEvent(new DragEvent('dragstart', {
        bubbles: true, composed: true, cancelable: true,
        dataTransfer: new DataTransfer(),
      }));

      const log = [];

      // 2. Dragover near right edge
      for (let i = 0; i < 4; i++) {
        board.dispatchEvent(new DragEvent('dragover', {
          bubbles: true, composed: true, cancelable: true,
          clientX: boardRect.right - 20,
          clientY: boardRect.top + boardRect.height / 2,
        }));
        await new Promise(r => setTimeout(r, 50));
      }
      const scrollBeforeDragEnd = board.scrollLeft;
      log.push({ step: 'before-dragend', scrollLeft: scrollBeforeDragEnd });

      // 3. Dispatch dragend (bubbles from card through board)
      cardShell.dispatchEvent(new DragEvent('dragend', {
        bubbles: true, composed: true, cancelable: true,
      }));

      // 4. Wait and check scroll stays put
      await new Promise(r => setTimeout(r, 200));
      const scrollAfterDragEnd = board.scrollLeft;
      log.push({ step: 'after-dragend-200ms', scrollLeft: scrollAfterDragEnd });

      return { log, scrollStopped: Math.abs(scrollAfterDragEnd - scrollBeforeDragEnd) < 2 };
    });

    console.log('Stop-on-dragend log:');
    for (const entry of stopOnDragendLog.log) {
      console.log(`  ${entry.step}: scrollLeft = ${entry.scrollLeft.toFixed(1)}`);
    }

    record('stop-on-dragend', 'Scroll stops after dragend event',
      stopOnDragendLog.scrollStopped,
      `Before dragend: scrollLeft=${stopOnDragendLog.log[0]?.scrollLeft.toFixed(1)}, ` +
      `200ms after dragend: scrollLeft=${stopOnDragendLog.log[1]?.scrollLeft.toFixed(1)} ` +
      `(stopped=${stopOnDragendLog.scrollStopped})`);

    // ═══════════════════════════════════════════════════════════════
    // TEST 5: Speed scaling (closer to edge = faster)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== TEST 5: Speed scaling ===');

    const speedLog = await page.evaluate(async () => {
      const kanban = document.querySelector('ft-kanban-view');
      const board = kanban.shadowRoot.querySelector('.board');
      const firstColumn = board.querySelector('ft-kanban-column');
      const firstCard = firstColumn?.shadowRoot?.querySelector('ft-task-card');
      const cardShell = firstCard?.shadowRoot?.querySelector('.card-shell');

      if (!board || !cardShell) return { error: 'elements not found' };

      const boardRect = board.getBoundingClientRect();

      async function measureScrollRate(clientX, label) {
        board.scrollLeft = 0;
        await new Promise(r => setTimeout(r, 50));

        cardShell.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true, composed: true, cancelable: true,
          dataTransfer: new DataTransfer(),
        }));

        const startScroll = board.scrollLeft;

        // Dispatch several dragover events and let rAF run
        for (let i = 0; i < 6; i++) {
          board.dispatchEvent(new DragEvent('dragover', {
            bubbles: true, composed: true, cancelable: true,
            clientX,
            clientY: boardRect.top + boardRect.height / 2,
          }));
          await new Promise(r => setTimeout(r, 50));
        }

        const endScroll = board.scrollLeft;

        cardShell.dispatchEvent(new DragEvent('dragend', {
          bubbles: true, composed: true, cancelable: true,
        }));
        await new Promise(r => setTimeout(r, 50));

        return { label, clientX, delta: endScroll - startScroll };
      }

      // Test at edge (5px from right) — should be fast
      const atEdge = await measureScrollRate(boardRect.right - 5, 'at-edge-5px');

      // Test at threshold boundary (45px from right, near the 50px threshold) — should be slow
      const atThreshold = await measureScrollRate(boardRect.right - 45, 'near-threshold-45px');

      // Test outside threshold (60px from right) — should be zero
      const outside = await measureScrollRate(boardRect.right - 60, 'outside-60px');

      return { atEdge, atThreshold, outside };
    });

    console.log('Speed scaling results:');
    console.log(`  At edge (5px):        delta = ${speedLog.atEdge.delta.toFixed(1)}px`);
    console.log(`  Near threshold (45px): delta = ${speedLog.atThreshold.delta.toFixed(1)}px`);
    console.log(`  Outside (60px):        delta = ${speedLog.outside.delta.toFixed(1)}px`);

    const edgeFasterThanThreshold = speedLog.atEdge.delta > speedLog.atThreshold.delta;
    const outsideNoScroll = Math.abs(speedLog.outside.delta) < 1;

    record('speed-scaling', 'Closer to edge scrolls faster than near threshold',
      edgeFasterThanThreshold,
      `Edge(5px) delta=${speedLog.atEdge.delta.toFixed(1)}px > ` +
      `Threshold(45px) delta=${speedLog.atThreshold.delta.toFixed(1)}px`);

    record('no-scroll-outside-threshold', 'No scroll when pointer is outside 50px threshold',
      outsideNoScroll,
      `Outside(60px) delta=${speedLog.outside.delta.toFixed(1)}px (expected ≈0)`);

    // ═══════════════════════════════════════════════════════════════
    // TEST 6: Drop still works (stage-change event fires)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== TEST 6: Drop event still works (regression) ===');

    const dropTest = await page.evaluate(async () => {
      const kanban = document.querySelector('ft-kanban-view');
      const board = kanban.shadowRoot.querySelector('.board');
      const columns = board.querySelectorAll('ft-kanban-column');

      if (columns.length < 2) return { error: 'need at least 2 columns' };

      let stageChangeReceived = false;
      let stageChangeDetail = null;

      // Listen for stage-change event on the board
      const handler = (e) => {
        stageChangeReceived = true;
        stageChangeDetail = e.detail;
      };
      board.addEventListener('stage-change', handler);

      // Get the second column's drop zone
      const targetColumn = columns[1];
      const targetCards = targetColumn.shadowRoot.querySelector('.cards');
      const targetStage = targetColumn.stage;

      // Simulate a drop with task ID
      const dropEvent = new DragEvent('drop', {
        bubbles: true, composed: true, cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      // Set dataTransfer data before dispatch
      dropEvent.dataTransfer.setData('text/plain', 'task-1');
      // Dispatch dragenter + dragover first to set up the column state
      targetCards.dispatchEvent(new DragEvent('dragenter', {
        bubbles: true, composed: true, cancelable: true,
      }));
      targetCards.dispatchEvent(new DragEvent('dragover', {
        bubbles: true, composed: true, cancelable: true,
      }));
      targetCards.dispatchEvent(dropEvent);

      board.removeEventListener('stage-change', handler);

      return {
        stageChangeReceived,
        stageChangeDetail,
        targetStage,
      };
    });

    console.log(`Drop test: ${JSON.stringify(dropTest, null, 2)}`);

    record('drop-regression', 'Drop on column fires stage-change event (no regression)',
      dropTest.stageChangeReceived,
      `stageChangeReceived=${dropTest.stageChangeReceived}, ` +
      `detail=${JSON.stringify(dropTest.stageChangeDetail)}`);

    // ── Final screenshot ──
    await page.screenshot({ path: `${EVIDENCE_DIR}/04-final-state.png`, fullPage: false });

    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════');
    console.log('  F68 AUTO-SCROLL VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════');

    let allPass = true;
    for (const r of results) {
      const status = r.pass ? 'PASS' : 'FAIL';
      if (!r.pass) allPass = false;
      console.log(`  [${status}] ${r.check}: ${r.action}`);
    }

    console.log(`\n  Overall: ${allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
    console.log(`  Total: ${results.length}, Passed: ${results.filter(r => r.pass).length}, Failed: ${results.filter(r => !r.pass).length}`);
    console.log('═══════════════════════════════════════════\n');

    // Save structured results
    fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`,
      JSON.stringify({
        feature: 'F68 — Kanban Auto-Scroll During Drag',
        timestamp: new Date().toISOString(),
        checks: results,
        rawData: {
          boardSetup: boardInfo,
          rightScroll: rightScrollLog,
          leftScroll: leftScrollLog,
          stopOnCenter: stopOnCenterLog,
          stopOnDragend: stopOnDragendLog,
          speedScaling: speedLog,
          dropRegression: dropTest,
        },
        summary: {
          total: results.length,
          passed: results.filter(r => r.pass).length,
          failed: results.filter(r => !r.pass).length,
          allPass,
        },
      }, null, 2));

    console.log(`Evidence saved to ${EVIDENCE_DIR}/`);

  } catch (err) {
    console.error('FATAL ERROR:', err);
    record('fatal', 'Script execution', false, err.message);
    fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`,
      JSON.stringify({ checks: results, error: err.message }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

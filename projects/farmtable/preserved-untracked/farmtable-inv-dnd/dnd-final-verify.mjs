/**
 * Final verification: drag to the EXACT same dead-zone coordinates before and after fix.
 */
import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const COLLECTION_ID = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const URL = `${BASE_URL}/?collection=${COLLECTION_ID}&view=kanban`;

async function waitForBoard(page) {
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
}

async function performDrag(page, srcX, srcY, tgtX, tgtY) {
  await page.evaluate(() => {
    window.__dragResult = { dragoverPrevented: false, dropped: false, events: [] };
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      const cardsDiv = col.shadowRoot?.querySelector('.cards');
      if (cardsDiv) {
        cardsDiv.addEventListener('dragover', () => { window.__dragResult.dragoverPrevented = true; });
        cardsDiv.addEventListener('drop', () => { window.__dragResult.dropped = true; });
      }
    }
    // Also trace at document level
    document.addEventListener('dragover', (e) => {
      window.__dragResult.events.push(`dragover:prevented=${e.defaultPrevented}`);
    }, { capture: true });
    document.addEventListener('drop', (e) => {
      window.__dragResult.events.push(`drop:prevented=${e.defaultPrevented}`);
    }, { capture: true });
  });

  await page.mouse.move(srcX, srcY);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(50);
  for (let i = 1; i <= 25; i++) {
    await page.mouse.move(
      srcX + (tgtX - srcX) * (i / 25),
      srcY + (tgtY - srcY) * (i / 25),
      { steps: 1 }
    );
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(500);

  return await page.evaluate(() => window.__dragResult);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoard(page);

  // Get fixed target coordinates (middle of an empty column, below where .cards ends)
  const coords = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

    // Source: first card
    let srcCenter = null;
    let srcTaskId = null;
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (cards?.length > 0 && !srcCenter) {
        const shell = cards[0].shadowRoot?.querySelector('.card-shell');
        const r = shell.getBoundingClientRect();
        srcCenter = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        srcTaskId = cards[0].task.id;
      }
    }

    // Target: Working column (stage 4, typically empty), dead zone at y=500
    for (const col of columns) {
      if (col.stage === 4) { // Working
        const hostRect = col.getBoundingClientRect();
        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        const cardsRect = cardsDiv.getBoundingClientRect();
        return {
          srcCenter,
          srcTaskId,
          // Target in the middle of the visible column area (well below .cards)
          tgtCenter: { x: hostRect.x + hostRect.width / 2, y: 500 },
          cardsBottom: cardsRect.bottom,
          columnLabel: col.label,
          deadZoneStart: cardsRect.bottom,
        };
      }
    }
    return null;
  });

  if (!coords) {
    console.log('ERROR: Could not get coordinates');
    await browser.close();
    return;
  }

  console.log(`Source: card at (${coords.srcCenter.x.toFixed(0)}, ${coords.srcCenter.y.toFixed(0)})`);
  console.log(`Target: "${coords.columnLabel}" column dead zone at (${coords.tgtCenter.x.toFixed(0)}, ${coords.tgtCenter.y.toFixed(0)})`);
  console.log(`  .cards bottom: ${coords.cardsBottom.toFixed(0)}px, target y: ${coords.tgtCenter.y}px`);
  console.log(`  Target is ${(coords.tgtCenter.y - coords.cardsBottom).toFixed(0)}px below .cards bottom\n`);

  // === TEST 1: Without fix ===
  console.log('--- TEST 1: BEFORE fix ---');
  const result1 = await performDrag(page, coords.srcCenter.x, coords.srcCenter.y, coords.tgtCenter.x, coords.tgtCenter.y);
  console.log(`  dragover reached .cards: ${result1.dragoverPrevented}`);
  console.log(`  drop occurred: ${result1.dropped}`);
  console.log(`  Result: ${result1.dropped ? '✓ SUCCESS' : '❌ FAILED — drag to dead zone silently fails'}\n`);

  // === TEST 2: With fix ===
  console.log('--- TEST 2: AFTER fix (flex:1 on .cards) ---');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoard(page);

  // Apply fix: add flex:1 to .cards in ALL columns
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      const cardsDiv = col.shadowRoot?.querySelector('.cards');
      if (cardsDiv) cardsDiv.style.flex = '1';
    }
  });

  // Verify .cards now covers the target area
  const afterFixCards = await page.evaluate(({ tgtY }) => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      if (col.stage === 4) {
        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        const r = cardsDiv.getBoundingClientRect();
        return { cardsBottom: r.bottom, coversTarget: r.bottom > tgtY };
      }
    }
  }, { tgtY: coords.tgtCenter.y });
  console.log(`  .cards now extends to bottom: ${afterFixCards?.cardsBottom?.toFixed(0)}px`);
  console.log(`  .cards covers target point: ${afterFixCards?.coversTarget}\n`);

  const result2 = await performDrag(page, coords.srcCenter.x, coords.srcCenter.y, coords.tgtCenter.x, coords.tgtCenter.y);
  console.log(`  dragover reached .cards: ${result2.dragoverPrevented}`);
  console.log(`  drop occurred: ${result2.dropped}`);
  console.log(`  Result: ${result2.dropped ? '✓ SUCCESS — fix works!' : '❌ FAILED'}\n`);

  console.log('=== SUMMARY ===');
  console.log(`Before fix: dropped=${result1.dropped} (BROKEN)`);
  console.log(`After fix:  dropped=${result2.dropped} (${result2.dropped ? 'FIXED' : 'still broken'})`);

  await browser.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

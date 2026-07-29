/**
 * DnD Investigation: Verify that adding flex:1 back to .cards fixes the dead zone issue.
 * Tests drag-to-dead-zone BEFORE and AFTER the CSS fix.
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

async function setupTracing(page) {
  await page.evaluate(() => {
    window.__dndDropped = false;
    window.__dndDragoverPrevented = false;
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      const cardsDiv = col.shadowRoot?.querySelector('.cards');
      if (cardsDiv) {
        cardsDiv.addEventListener('dragover', () => { window.__dndDragoverPrevented = true; });
        cardsDiv.addEventListener('drop', () => { window.__dndDropped = true; });
      }
    }
  });
}

async function dragToDeadZone(page) {
  const positions = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

    // Source: first card found
    let srcRect = null;
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (cards?.length > 0 && !srcRect) {
        const shell = cards[0].shadowRoot?.querySelector('.card-shell');
        srcRect = shell?.getBoundingClientRect();
      }
    }

    // Target: an empty column's dead zone (center of area below .cards)
    let tgtPos = null;
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      if (cards?.length === 0) {
        const cardsDiv = col.shadowRoot?.querySelector('.cards');
        const cdRect = cardsDiv?.getBoundingClientRect();
        const hostRect = col.getBoundingClientRect();
        const deadZoneHeight = hostRect.bottom - cdRect.bottom;
        if (deadZoneHeight > 50) {
          tgtPos = {
            x: hostRect.x + hostRect.width / 2,
            y: cdRect.bottom + deadZoneHeight / 2,
            label: col.label,
            deadZone: deadZoneHeight,
          };
          break;
        }
      }
    }

    return { srcRect, tgtPos };
  });

  if (!positions.srcRect || !positions.tgtPos) {
    return { error: 'Could not find positions' };
  }

  const srcX = positions.srcRect.x + positions.srcRect.width / 2;
  const srcY = positions.srcRect.y + positions.srcRect.height / 2;
  const tgtX = positions.tgtPos.x;
  const tgtY = Math.min(positions.tgtPos.y, 900); // Ensure within viewport

  await page.mouse.move(srcX, srcY);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(50);
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(
      srcX + (tgtX - srcX) * (i / 20),
      srcY + (tgtY - srcY) * (i / 20),
      { steps: 1 }
    );
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => ({
    dropped: window.__dndDropped,
    dragoverPrevented: window.__dndDragoverPrevented,
  }));

  return { ...result, targetLabel: positions.tgtPos.label, deadZone: positions.tgtPos.deadZone };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // === TEST 1: Without fix ===
  console.log('=== TEST 1: BEFORE fix (current deployed state) ===');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoard(page);
  await setupTracing(page);
  const beforeResult = await dragToDeadZone(page);
  console.log(`Drag to dead zone in "${beforeResult.targetLabel}" (${beforeResult.deadZone}px dead zone):`);
  console.log(`  dropped=${beforeResult.dropped}, dragoverPrevented=${beforeResult.dragoverPrevented}`);
  console.log(`  ${!beforeResult.dropped ? '❌ DROP FAILED' : '✓ Drop succeeded'}`);

  // === TEST 2: With fix (inject flex:1 on .cards) ===
  console.log('\n=== TEST 2: AFTER fix (flex:1 added to .cards) ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoard(page);

  // Apply fix
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      const cardsDiv = col.shadowRoot?.querySelector('.cards');
      if (cardsDiv) {
        cardsDiv.style.flex = '1';
      }
    }
  });

  await setupTracing(page);
  const afterResult = await dragToDeadZone(page);
  console.log(`Drag to same dead zone area in "${afterResult.targetLabel}":`);
  console.log(`  dropped=${afterResult.dropped}, dragoverPrevented=${afterResult.dragoverPrevented}`);
  console.log(`  ${afterResult.dropped ? '✓ DROP SUCCEEDED' : '❌ Drop failed'}`);

  // Verify dimensions after fix
  const fixedDimensions = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    const results = [];
    for (const col of columns) {
      const hostRect = col.getBoundingClientRect();
      const cardsDiv = col.shadowRoot?.querySelector('.cards');
      const cardsDivRect = cardsDiv?.getBoundingClientRect();
      results.push({
        label: col.label,
        hostH: hostRect.height.toFixed(0),
        cardsH: cardsDivRect?.height?.toFixed(0),
        deadZone: (hostRect.bottom - (cardsDivRect?.bottom || hostRect.bottom)).toFixed(0),
      });
    }
    return results;
  });
  console.log('\nColumn dimensions after fix:');
  for (const d of fixedDimensions) {
    console.log(`  ${d.label}: host=${d.hostH}px, .cards=${d.cardsH}px, dead zone=${d.deadZone}px`);
  }

  console.log('\n=== CONCLUSION ===');
  if (!beforeResult.dropped && afterResult.dropped) {
    console.log('CONFIRMED: Adding flex:1 to .cards fixes the DnD dead zone issue.');
    console.log('Root cause: PR #111 (commit 8dfd5b8) removed flex:1 from .cards in');
    console.log('ft-kanban-column.ts, creating a massive dead zone (up to 1795px) in');
    console.log('each column where drops silently fail.');
    console.log('\nFix: Add `flex: 1;` back to .cards in ft-kanban-column.ts');
  }

  await browser.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

/**
 * DnD Investigation v4: Test the hypothesis that removing `flex: 1` from `.cards`
 * created a dead zone in each column where drops don't work.
 *
 * HYPOTHESIS: After PR #111 removed `flex: 1` from `.cards`, the drop target
 * no longer fills the entire column height. The empty space below `.cards`
 * is NOT a valid drop target, so dragging to the visible column area
 * but below the cards fails silently.
 */
import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const COLLECTION_ID = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const URL = `${BASE_URL}/?collection=${COLLECTION_ID}&view=kanban`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

  // === Get column dimensions: host rect vs .cards rect ===
  const dimensions = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');
    const results = [];

    for (const col of columns) {
      const hostRect = col.getBoundingClientRect();
      const cardsDiv = col.shadowRoot?.querySelector('.cards');
      const cardsDivRect = cardsDiv?.getBoundingClientRect();
      const headerDiv = col.shadowRoot?.querySelector('.header');
      const headerRect = headerDiv?.getBoundingClientRect();
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card');
      const cardsStyle = cardsDiv ? getComputedStyle(cardsDiv) : null;

      results.push({
        label: col.label,
        stage: col.stage,
        cardCount: cards?.length || 0,
        hostRect: { x: hostRect.x, y: hostRect.y, w: hostRect.width, h: hostRect.height, bottom: hostRect.bottom },
        headerRect: headerRect ? { h: headerRect.height, bottom: headerRect.bottom } : null,
        cardsDivRect: cardsDivRect ? { y: cardsDivRect.y, h: cardsDivRect.height, bottom: cardsDivRect.bottom } : null,
        cardsFlex: cardsStyle?.flex,
        cardsMinHeight: cardsStyle?.minHeight,
        cardsOverflow: cardsStyle?.overflow,
        deadZoneHeight: hostRect.bottom - (cardsDivRect?.bottom || hostRect.bottom),
      });
    }
    return results;
  });

  console.log('=== Column dimensions (host vs .cards):');
  console.log('=== LOOKING FOR DEAD ZONES WHERE DROPS FAIL ===\n');
  let maxDeadZone = 0;
  for (const d of dimensions) {
    const status = d.deadZoneHeight > 5 ? '⚠️ DEAD ZONE' : '✓ OK';
    console.log(`${d.label} (${d.cardCount} cards):`);
    console.log(`  Host:  h=${d.hostRect.h.toFixed(0)}px  (y=${d.hostRect.y.toFixed(0)} → bottom=${d.hostRect.bottom.toFixed(0)})`);
    console.log(`  Header: h=${d.headerRect?.h?.toFixed(0)}px (bottom=${d.headerRect?.bottom?.toFixed(0)})`);
    console.log(`  .cards: h=${d.cardsDivRect?.h.toFixed(0)}px (bottom=${d.cardsDivRect?.bottom?.toFixed(0)}) flex="${d.cardsFlex}" minH="${d.cardsMinHeight}"`);
    console.log(`  ${status}: Dead zone = ${d.deadZoneHeight.toFixed(0)}px below .cards`);
    console.log();
    maxDeadZone = Math.max(maxDeadZone, d.deadZoneHeight);
  }

  console.log(`\n=== MAX dead zone: ${maxDeadZone.toFixed(0)}px`);

  if (maxDeadZone > 5) {
    console.log('=== CONFIRMED: There are dead zones in columns where drops will silently fail!');
    console.log('=== Root cause: PR #111 removed flex:1 from .cards, so the drop target');
    console.log('=== no longer fills the column height. Empty space below cards has no drop handler.\n');

    // === Now test: drag to the dead zone vs. to the .cards area ===
    const sourceCol = dimensions.find(d => d.cardCount > 0);
    const targetCol = dimensions.find(d => d.stage !== sourceCol.stage && d.deadZoneHeight > 20);

    if (sourceCol && targetCol) {
      console.log(`\n=== TEST: Drag to dead zone in "${targetCol.label}" column`);

      // Get source card rect
      const setup = await page.evaluate(({ srcStage, tgtStage }) => {
        const app = document.querySelector('ft-app');
        const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
        const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

        let srcRect = null;
        let srcTaskId = null;
        let tgtDeadZoneCenter = null;
        let tgtCardsDivCenter = null;

        for (const col of columns) {
          if (col.stage === srcStage) {
            const card = col.shadowRoot?.querySelector('ft-task-card');
            const shell = card?.shadowRoot?.querySelector('.card-shell');
            srcRect = shell?.getBoundingClientRect();
            srcTaskId = card?.task?.id;
          }
          if (col.stage === tgtStage) {
            const cardsDiv = col.shadowRoot?.querySelector('.cards');
            const cdRect = cardsDiv?.getBoundingClientRect();
            const hostRect = col.getBoundingClientRect();

            // Center of .cards div (valid drop target)
            tgtCardsDivCenter = { x: cdRect.x + cdRect.width / 2, y: cdRect.y + cdRect.height / 2 };

            // Center of dead zone (below .cards, within column)
            const deadZoneTop = cdRect.bottom;
            const deadZoneBottom = hostRect.bottom;
            tgtDeadZoneCenter = { x: hostRect.x + hostRect.width / 2, y: (deadZoneTop + deadZoneBottom) / 2 };
          }
        }
        return { srcRect, srcTaskId, tgtDeadZoneCenter, tgtCardsDivCenter };
      }, { srcStage: sourceCol.stage, tgtStage: targetCol.stage });

      console.log(`  Source rect: ${JSON.stringify(setup.srcRect)}`);
      console.log(`  Target dead zone center: ${JSON.stringify(setup.tgtDeadZoneCenter)}`);
      console.log(`  Target .cards center: ${JSON.stringify(setup.tgtCardsDivCenter)}`);

      // Inject tracing
      await page.evaluate(() => {
        window.__dndDropped = false;
        window.__dndDragoverPrevented = false;

        const app = document.querySelector('ft-app');
        const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
        const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column');

        for (const col of columns) {
          const cardsDiv = col.shadowRoot?.querySelector('.cards');
          if (cardsDiv) {
            cardsDiv.addEventListener('dragover', (e) => {
              window.__dndDragoverPrevented = true;
            });
            cardsDiv.addEventListener('drop', () => {
              window.__dndDropped = true;
            });
          }
        }
      });

      if (setup.srcRect && setup.tgtDeadZoneCenter) {
        const srcX = setup.srcRect.x + setup.srcRect.width / 2;
        const srcY = setup.srcRect.y + setup.srcRect.height / 2;
        const tgtX = setup.tgtDeadZoneCenter.x;
        const tgtY = setup.tgtDeadZoneCenter.y;

        console.log(`\n  --- TEST A: Drag to DEAD ZONE at (${tgtX.toFixed(0)}, ${tgtY.toFixed(0)}) ---`);

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

        const deadZoneResult = await page.evaluate(() => ({
          dropped: window.__dndDropped,
          dragoverPrevented: window.__dndDragoverPrevented,
        }));
        console.log(`  Dead zone result: dropped=${deadZoneResult.dropped}, dragoverPrevented=${deadZoneResult.dragoverPrevented}`);

        if (!deadZoneResult.dropped && !deadZoneResult.dragoverPrevented) {
          console.log('  ⚠️ CONFIRMED: Drop in dead zone FAILS — dragover handler never reached!');
        }

        // Reset
        await page.evaluate(() => {
          window.__dndDropped = false;
          window.__dndDragoverPrevented = false;
        });

        // TEST B: Drag to .cards area (should work)
        console.log(`\n  --- TEST B: Drag to .CARDS AREA at (${setup.tgtCardsDivCenter.x.toFixed(0)}, ${setup.tgtCardsDivCenter.y.toFixed(0)}) ---`);

        const srcX2 = setup.srcRect.x + setup.srcRect.width / 2;
        const srcY2 = setup.srcRect.y + setup.srcRect.height / 2;
        const tgtX2 = setup.tgtCardsDivCenter.x;
        const tgtY2 = setup.tgtCardsDivCenter.y;

        await page.mouse.move(srcX2, srcY2);
        await page.waitForTimeout(100);
        await page.mouse.down();
        await page.waitForTimeout(50);
        for (let i = 1; i <= 20; i++) {
          await page.mouse.move(
            srcX2 + (tgtX2 - srcX2) * (i / 20),
            srcY2 + (tgtY2 - srcY2) * (i / 20),
            { steps: 1 }
          );
          await page.waitForTimeout(15);
        }
        await page.waitForTimeout(100);
        await page.mouse.up();
        await page.waitForTimeout(500);

        const cardsResult = await page.evaluate(() => ({
          dropped: window.__dndDropped,
          dragoverPrevented: window.__dndDragoverPrevented,
        }));
        console.log(`  Cards area result: dropped=${cardsResult.dropped}, dragoverPrevented=${cardsResult.dragoverPrevented}`);

        if (cardsResult.dropped || cardsResult.dragoverPrevented) {
          console.log('  ✓ CONFIRMED: Drop in .cards area WORKS!');
        }
      }
    }
  } else {
    console.log('=== No dead zones found — hypothesis might be wrong.');
  }

  // === Additional: check what the CSS FIX would look like ===
  console.log('\n\n=== CSS FIX TEST: Add flex:1 back to .cards ===');

  await page.reload({ waitUntil: 'domcontentloaded' });
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

  // Inject the CSS fix: add flex:1 to .cards
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

  // Re-check dimensions
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
        cardCount: col.shadowRoot?.querySelectorAll('ft-task-card')?.length || 0,
        hostH: hostRect.height.toFixed(0),
        cardsH: cardsDivRect?.height?.toFixed(0),
        deadZone: (hostRect.bottom - (cardsDivRect?.bottom || hostRect.bottom)).toFixed(0),
      });
    }
    return results;
  });

  console.log('After adding flex:1 to .cards:');
  for (const d of fixedDimensions) {
    console.log(`  ${d.label} (${d.cardCount} cards): host=${d.hostH}px, cards=${d.cardsH}px, dead zone=${d.deadZone}px`);
  }

  await browser.close();
  console.log('\n=== Done');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

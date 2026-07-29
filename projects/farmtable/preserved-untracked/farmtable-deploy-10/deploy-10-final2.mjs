import { chromium } from 'playwright';
import fs from 'fs';

const LIVE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-10';
const RESULTS = {};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // ===== Load app =====
  console.log('=== Step 0: Load app ===');
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/00-app-loaded.png`, fullPage: false });

  // Select "default" collection
  console.log('=== Step 1: Select collection ===');
  await page.locator('text=default').first().click();
  await page.waitForTimeout(3000);

  // Get state
  const state = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const style = getComputedStyle(mainEl);
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    let total = 0;
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      total += col.shadowRoot.querySelectorAll('ft-task-card').length;
    }
    return {
      totalTasks: total,
      mainScrollH: mainEl.scrollHeight,
      mainClientH: mainEl.clientHeight,
      overflowY: style.overflowY,
      isScrollable: mainEl.scrollHeight > mainEl.clientHeight,
    };
  });
  console.log(`Board: ${state.totalTasks} tasks, scrollable=${state.isScrollable} (${state.mainScrollH}/${state.mainClientH})`);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-board-overview.png`, fullPage: false });

  // ==========================================================================
  // V1: .main IS the scroll container
  // ==========================================================================
  console.log('\n=== V1: .main is scroll container ===');
  RESULTS.v1 = {
    scrollHeight: state.mainScrollH, clientHeight: state.mainClientH,
    overflowY: state.overflowY,
    pass: state.isScrollable && state.overflowY === 'auto',
  };
  console.log(`scrollH=${state.mainScrollH} > clientH=${state.mainClientH}, overflowY=${state.overflowY}`);
  console.log(`RESULT: ${RESULTS.v1.pass ? 'PASS' : 'FAIL'}`);

  // ==========================================================================
  // V2: No per-column scrollbars
  // ==========================================================================
  console.log('\n=== V2: No per-column scrollbars ===');
  const colScroll = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    const data = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelector('.cards');
      if (!cards) continue;
      const s = getComputedStyle(cards);
      const h = col.shadowRoot.querySelector('.header')?.textContent?.trim()?.replace(/\s+/g, ' ').substring(0, 15);
      data.push({
        name: h, overflowY: s.overflowY,
        scrollH: cards.scrollHeight, clientH: cards.clientHeight,
        hasScroll: cards.scrollHeight > cards.clientHeight && s.overflowY !== 'visible' && s.overflowY !== 'hidden',
      });
    }
    return data;
  });
  let v2pass = true;
  for (const c of colScroll) {
    if (c.hasScroll) { v2pass = false; console.log(`  FAIL: ${c.name}`); }
    else console.log(`  OK: ${c.name} overflowY=${c.overflowY}`);
  }
  RESULTS.v2 = { pass: v2pass };
  console.log(`RESULT: ${v2pass ? 'PASS' : 'FAIL'}`);

  // ==========================================================================
  // V3: Toolbar stays fixed during main scroll
  // ==========================================================================
  console.log('\n=== V3: Toolbar stays fixed ===');
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(200);

  const tbBefore = await page.evaluate(() => {
    return document.querySelector('ft-app').shadowRoot.querySelector('ft-toolbar').getBoundingClientRect().top;
  });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-scroll-position-1-top.png`, fullPage: false });

  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 500;
  });
  await page.waitForTimeout(500);

  const after3 = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    return {
      tbTop: ftApp.shadowRoot.querySelector('ft-toolbar').getBoundingClientRect().top,
      mainST: ftApp.shadowRoot.querySelector('.main').scrollTop,
      docST: document.documentElement.scrollTop,
    };
  });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-scroll-position-2-scrolled.png`, fullPage: false });

  const v3pass = tbBefore === after3.tbTop && after3.mainST > 0 && after3.docST === 0;
  RESULTS.v3 = { tbBefore, tbAfter: after3.tbTop, mainST: after3.mainST, docST: after3.docST, pass: v3pass };
  console.log(`  Toolbar top: before=${tbBefore}, after=${after3.tbTop}`);
  console.log(`  mainST=${after3.mainST}, docST=${after3.docST}`);
  console.log(`RESULT: ${v3pass ? 'PASS' : 'FAIL'}`);

  // ==========================================================================
  // V4: Inspector scrolls independently
  // ==========================================================================
  console.log('\n=== V4: Inspector independent scroll ===');

  // IMPORTANT: Scroll to top FIRST so the card is visible, then click
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(300);

  // Get card position (should be visible now)
  const cardPos = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card');
      if (cards.length > 0) {
        const r = cards[0].getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
      }
    }
    return null;
  });
  console.log(`  Card at (${cardPos?.x}, ${cardPos?.y})`);

  if (cardPos && cardPos.y > 0 && cardPos.y < 800) {
    await page.mouse.click(cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);

    // Now scroll main to 300
    await page.evaluate(() => {
      document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 300;
    });
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-inspector-open.png`, fullPage: false });

    // Check inspector appeared
    const inspState = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const content = ftApp.shadowRoot.querySelector('.content');
      const inspDiv = content?.querySelector('.inspector');
      if (!inspDiv) return { found: false };
      const rect = inspDiv.getBoundingClientRect();
      // Check for ft-inspector with scrollable body
      const fti = inspDiv.querySelector('ft-inspector');
      let bodyInfo = null;
      if (fti?.shadowRoot) {
        const body = fti.shadowRoot.querySelector('.body');
        if (body) {
          const s = getComputedStyle(body);
          bodyInfo = { overflowY: s.overflowY, scrollH: body.scrollHeight, clientH: body.clientHeight, hasScroll: body.scrollHeight > body.clientHeight };
        }
      }
      return { found: true, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, bodyInfo };
    });
    console.log(`  Inspector found: ${inspState.found}, size: ${inspState.rect?.w}x${inspState.rect?.h}`);
    if (inspState.bodyInfo) console.log(`  Inspector body: scrollH=${inspState.bodyInfo.scrollH}, clientH=${inspState.bodyInfo.clientH}, hasScroll=${inspState.bodyInfo.hasScroll}`);

    // Record main scroll before inspector scroll
    const mainBefore = await page.evaluate(() =>
      document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
    );

    // Scroll inside inspector
    if (inspState.found) {
      const ix = inspState.rect.x + inspState.rect.w / 2;
      const iy = inspState.rect.y + inspState.rect.h / 2;
      console.log(`  Scrolling inspector at (${ix}, ${iy})`);
      await page.mouse.move(ix, iy);
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(500);
    }

    const mainAfter = await page.evaluate(() =>
      document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
    );

    const v4pass = inspState.found && mainBefore === mainAfter;
    RESULTS.v4 = {
      inspectorFound: inspState.found,
      mainScrollBefore: mainBefore, mainScrollAfter: mainAfter,
      independent: mainBefore === mainAfter,
      pass: v4pass,
    };
    console.log(`  Main scrollTop: before=${mainBefore}, after=${mainAfter}`);
    console.log(`RESULT: ${v4pass ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-inspector-scrolled.png`, fullPage: false });

    // Reverse test: scrolling main doesn't move inspector
    if (inspState.found && inspState.bodyInfo?.hasScroll) {
      // Set inspector body scrollTop
      await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const inspDiv = ftApp.shadowRoot.querySelector('.content').querySelector('.inspector');
        const fti = inspDiv?.querySelector('ft-inspector');
        const body = fti?.shadowRoot?.querySelector('.body');
        if (body) body.scrollTop = 50;
      });
      await page.waitForTimeout(200);

      const inspBefore = await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const inspDiv = ftApp.shadowRoot.querySelector('.content').querySelector('.inspector');
        return inspDiv?.querySelector('ft-inspector')?.shadowRoot?.querySelector('.body')?.scrollTop;
      });

      // Scroll main
      const mainBox = await page.evaluate(() => {
        const mainEl = document.querySelector('ft-app').shadowRoot.querySelector('.main');
        const r = mainEl.getBoundingClientRect();
        return { x: r.x + r.width / 3, y: r.y + r.height / 2 };
      });
      await page.mouse.move(mainBox.x, mainBox.y);
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(300);

      const inspAfter = await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const inspDiv = ftApp.shadowRoot.querySelector('.content').querySelector('.inspector');
        return inspDiv?.querySelector('ft-inspector')?.shadowRoot?.querySelector('.body')?.scrollTop;
      });

      console.log(`  Reverse: inspST before=${inspBefore}, after=${inspAfter} (${inspBefore === inspAfter ? 'independent' : 'NOT independent'})`);
      RESULTS.v4_reverse = { inspBefore, inspAfter, independent: inspBefore === inspAfter };
    }

    // Close inspector
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    RESULTS.v4 = { pass: false, error: 'card not visible' };
    console.log('RESULT: FAIL (card not visible)');
  }

  // ==========================================================================
  // V5: Horizontal scroll
  // ==========================================================================
  console.log('\n=== V5: Horizontal scroll ===');
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(300);

  const hBefore = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const kanbanView = ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view');
    const board = kanbanView.shadowRoot.querySelector('.board');
    return { scrollLeft: board.scrollLeft, scrollWidth: board.scrollWidth, clientWidth: board.clientWidth, canScrollH: board.scrollWidth > board.clientWidth };
  });

  if (hBefore.canScrollH) {
    await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view').shadowRoot.querySelector('.board').scrollLeft = 400;
    });
    await page.waitForTimeout(500);
  }

  const hAfter = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const board = ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view').shadowRoot.querySelector('.board');
    const tbTop = ftApp.shadowRoot.querySelector('ft-toolbar').getBoundingClientRect().top;
    return { scrollLeft: board.scrollLeft, tbTop };
  });

  const v5pass = hAfter.scrollLeft > 0;
  RESULTS.v5 = { scrollLeftBefore: hBefore.scrollLeft, scrollLeftAfter: hAfter.scrollLeft, scrollWidth: hBefore.scrollWidth, clientWidth: hBefore.clientWidth, pass: v5pass };
  console.log(`  scrollLeft: ${hBefore.scrollLeft} → ${hAfter.scrollLeft}`);
  console.log(`  scrollWidth=${hBefore.scrollWidth}, clientWidth=${hBefore.clientWidth}, toolbar top=${hAfter.tbTop}`);
  console.log(`RESULT: ${v5pass ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-horizontal-scroll.png`, fullPage: false });

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n\n============ FINAL VERIFICATION SUMMARY ============');
  console.log(`1. .main IS scroll container:      ${RESULTS.v1.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`2. No per-column scrollbars:        ${RESULTS.v2.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`3. Toolbar stays fixed on scroll:   ${RESULTS.v3.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`4. Inspector independent scroll:    ${RESULTS.v4.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`5. Horizontal scroll works:         ${RESULTS.v5.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('====================================================');

  const allPass = RESULTS.v1.pass && RESULTS.v2.pass && RESULTS.v3.pass && RESULTS.v4.pass && RESULTS.v5.pass;
  console.log(`\nOVERALL: ${allPass ? 'ALL PASS' : 'SOME FAILURES'}`);

  fs.writeFileSync(`${SCREENSHOT_DIR}/verification-results.json`, JSON.stringify(RESULTS, null, 2));
  console.log(`Results saved to ${SCREENSHOT_DIR}/`);

  await browser.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

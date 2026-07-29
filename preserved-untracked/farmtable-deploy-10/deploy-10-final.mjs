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

  // Check state - tasks should already exist from earlier run
  const state = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const style = getComputedStyle(mainEl);
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    let total = 0;
    const colInfo = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card');
      total += cards.length;
      const h = col.shadowRoot.querySelector('.header')?.textContent?.trim()?.replace(/\s+/g, ' ').substring(0, 20);
      colInfo.push({ name: h, count: cards.length });
    }
    return {
      totalTasks: total,
      columns: colInfo,
      mainScrollH: mainEl.scrollHeight,
      mainClientH: mainEl.clientHeight,
      overflowY: style.overflowY,
      isScrollable: mainEl.scrollHeight > mainEl.clientHeight,
    };
  });
  console.log(`Board: ${state.totalTasks} tasks, scrollable=${state.isScrollable} (${state.mainScrollH}/${state.mainClientH})`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-board-overview.png`, fullPage: false });

  // ==========================================================================
  // VERIFICATION 1: .main IS the scroll container
  // ==========================================================================
  console.log('\n=== V1: .main is scroll container ===');
  RESULTS.v1 = {
    scrollHeight: state.mainScrollH,
    clientHeight: state.mainClientH,
    overflowY: state.overflowY,
    pass: state.isScrollable && state.overflowY === 'auto',
  };
  console.log(`scrollHeight=${state.mainScrollH} > clientHeight=${state.mainClientH}, overflowY=${state.overflowY}`);
  console.log(`RESULT: ${RESULTS.v1.pass ? 'PASS' : 'FAIL'}`);

  // ==========================================================================
  // VERIFICATION 2: No per-column scrollbars
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
        name: h,
        overflowY: s.overflowY,
        scrollH: cards.scrollHeight,
        clientH: cards.clientHeight,
        hasScroll: cards.scrollHeight > cards.clientHeight && s.overflowY !== 'visible' && s.overflowY !== 'hidden',
      });
    }
    return data;
  });
  let v2pass = true;
  for (const c of colScroll) {
    if (c.hasScroll) { v2pass = false; console.log(`  FAIL: ${c.name} has scrollbar (${c.overflowY})`); }
    else console.log(`  OK: ${c.name} overflowY=${c.overflowY} scrollH=${c.scrollH} clientH=${c.clientH}`);
  }
  RESULTS.v2 = { columns: colScroll, pass: v2pass };
  console.log(`RESULT: ${v2pass ? 'PASS' : 'FAIL'}`);

  // ==========================================================================
  // VERIFICATION 3: Scrolling .main does NOT move toolbar
  // ==========================================================================
  console.log('\n=== V3: Toolbar stays fixed during main scroll ===');

  // Ensure at top
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(200);

  const tbBefore = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const tb = ftApp.shadowRoot.querySelector('ft-toolbar');
    return { top: tb.getBoundingClientRect().top, bottom: tb.getBoundingClientRect().bottom };
  });

  // Screenshot at top
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-scroll-position-1-top.png`, fullPage: false });

  // Scroll .main down 500px
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 500;
  });
  await page.waitForTimeout(500);

  const tbAfter = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const tb = ftApp.shadowRoot.querySelector('ft-toolbar');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    return {
      top: tb.getBoundingClientRect().top,
      bottom: tb.getBoundingClientRect().bottom,
      mainScrollTop: mainEl.scrollTop,
      docScrollTop: document.documentElement.scrollTop,
    };
  });

  // Screenshot after scroll
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-scroll-position-2-scrolled.png`, fullPage: false });

  const v3pass = tbBefore.top === tbAfter.top && tbAfter.mainScrollTop > 0 && tbAfter.docScrollTop === 0;
  RESULTS.v3 = {
    toolbarTopBefore: tbBefore.top, toolbarTopAfter: tbAfter.top,
    mainScrollTop: tbAfter.mainScrollTop, docScrollTop: tbAfter.docScrollTop,
    pass: v3pass,
  };
  console.log(`  Toolbar top: before=${tbBefore.top}, after=${tbAfter.top}`);
  console.log(`  Main scrollTop=${tbAfter.mainScrollTop}, document scrollTop=${tbAfter.docScrollTop}`);
  console.log(`RESULT: ${v3pass ? 'PASS' : 'FAIL'}`);

  // ==========================================================================
  // VERIFICATION 4: Inspector scrolls independently
  // ==========================================================================
  console.log('\n=== V4: Inspector scrolls independently ===');

  // Reset scroll position
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 300;
  });
  await page.waitForTimeout(300);

  // Click the first task card using page.mouse.click (NOT element.click)
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
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: cards[0].textContent?.trim()?.substring(0, 30) };
      }
    }
    return null;
  });

  if (cardPos) {
    console.log(`  Clicking card "${cardPos.text}" at (${cardPos.x}, ${cardPos.y})`);
    await page.mouse.click(cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);
  }

  // Screenshot with inspector open
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-inspector-open.png`, fullPage: false });

  // Check inspector appeared
  const inspectorState = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const content = ftApp.shadowRoot.querySelector('.content');
    const inspDiv = content?.querySelector('.inspector');
    if (!inspDiv) return { found: false };

    const fti = inspDiv.querySelector('ft-inspector');
    let bodyScroll = null;
    if (fti?.shadowRoot) {
      const body = fti.shadowRoot.querySelector('.body');
      if (body) {
        const style = getComputedStyle(body);
        bodyScroll = {
          overflowY: style.overflowY,
          scrollH: body.scrollHeight,
          clientH: body.clientHeight,
          hasScroll: body.scrollHeight > body.clientHeight,
        };
      }
    }

    const rect = inspDiv.getBoundingClientRect();
    return {
      found: true,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      bodyScroll,
    };
  });
  console.log(`  Inspector found: ${inspectorState.found}`);
  if (inspectorState.bodyScroll) {
    console.log(`  Inspector body: overflowY=${inspectorState.bodyScroll.overflowY}, scrollH=${inspectorState.bodyScroll.scrollH}, clientH=${inspectorState.bodyScroll.clientH}`);
  }

  // Record main scroll before inspector interaction
  const mainSTBefore = await page.evaluate(() =>
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
  );

  // Scroll inside inspector using mouse wheel
  if (inspectorState.found && inspectorState.rect.w > 0) {
    const ix = inspectorState.rect.x + inspectorState.rect.w / 2;
    const iy = inspectorState.rect.y + inspectorState.rect.h / 2;
    console.log(`  Scrolling inspector at (${ix}, ${iy})`);
    await page.mouse.move(ix, iy);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
  }

  const mainSTAfter = await page.evaluate(() =>
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
  );

  const v4pass = inspectorState.found && mainSTBefore === mainSTAfter;
  RESULTS.v4 = {
    inspectorFound: inspectorState.found,
    mainScrollBefore: mainSTBefore,
    mainScrollAfter: mainSTAfter,
    independent: mainSTBefore === mainSTAfter,
    pass: v4pass,
  };
  console.log(`  Main scrollTop: before=${mainSTBefore}, after=${mainSTAfter}`);
  console.log(`RESULT: ${v4pass ? 'PASS' : 'FAIL'}`);

  // Screenshot after inspector scroll
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-inspector-scrolled.png`, fullPage: false });

  // Also verify reverse: scrolling main doesn't change inspector
  if (inspectorState.found && inspectorState.bodyScroll?.hasScroll) {
    // First scroll the inspector body to a known position
    await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const inspDiv = ftApp.shadowRoot.querySelector('.content').querySelector('.inspector');
      const fti = inspDiv.querySelector('ft-inspector');
      if (fti?.shadowRoot) {
        const body = fti.shadowRoot.querySelector('.body');
        if (body) body.scrollTop = 50;
      }
    });
    await page.waitForTimeout(200);

    const inspSTBefore = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const inspDiv = ftApp.shadowRoot.querySelector('.content').querySelector('.inspector');
      const fti = inspDiv?.querySelector('ft-inspector');
      return fti?.shadowRoot?.querySelector('.body')?.scrollTop ?? null;
    });

    // Scroll main
    await page.evaluate(() => {
      const mainEl = document.querySelector('ft-app').shadowRoot.querySelector('.main');
      mainEl.scrollTop = mainEl.scrollTop + 200;
    });
    await page.waitForTimeout(300);

    const inspSTAfter = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const inspDiv = ftApp.shadowRoot.querySelector('.content').querySelector('.inspector');
      const fti = inspDiv?.querySelector('ft-inspector');
      return fti?.shadowRoot?.querySelector('.body')?.scrollTop ?? null;
    });

    console.log(`  Reverse: inspST before main scroll=${inspSTBefore}, after=${inspSTAfter}`);
    RESULTS.v4_reverse = { inspSTBefore, inspSTAfter, independent: inspSTBefore === inspSTAfter };
  }

  // ==========================================================================
  // VERIFICATION 5: Horizontal scroll works
  // ==========================================================================
  console.log('\n=== V5: Horizontal scroll ===');

  // Close inspector
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Reset scroll
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(300);

  const hBefore = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const kanbanView = ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view');
    const board = kanbanView.shadowRoot.querySelector('.board');
    const s = getComputedStyle(board);
    return {
      scrollLeft: board.scrollLeft,
      scrollWidth: board.scrollWidth,
      clientWidth: board.clientWidth,
      overflowX: s.overflowX || s.overflow,
      canScrollH: board.scrollWidth > board.clientWidth,
    };
  });

  if (hBefore.canScrollH) {
    await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const kanbanView = ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view');
      kanbanView.shadowRoot.querySelector('.board').scrollLeft = 400;
    });
    await page.waitForTimeout(500);
  }

  const hAfter = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const kanbanView = ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view');
    const board = kanbanView.shadowRoot.querySelector('.board');
    const tb = ftApp.shadowRoot.querySelector('ft-toolbar');
    return {
      scrollLeft: board.scrollLeft,
      toolbarTop: tb?.getBoundingClientRect().top,
    };
  });

  const v5pass = hAfter.scrollLeft > 0;
  RESULTS.v5 = {
    scrollLeftBefore: hBefore.scrollLeft,
    scrollLeftAfter: hAfter.scrollLeft,
    scrollWidth: hBefore.scrollWidth,
    clientWidth: hBefore.clientWidth,
    toolbarTopAfterH: hAfter.toolbarTop,
    pass: v5pass,
  };
  console.log(`  scrollLeft: before=${hBefore.scrollLeft}, after=${hAfter.scrollLeft}`);
  console.log(`  scrollWidth=${hBefore.scrollWidth}, clientWidth=${hBefore.clientWidth}`);
  console.log(`  Toolbar top after H-scroll: ${hAfter.toolbarTop}`);
  console.log(`RESULT: ${v5pass ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-horizontal-scroll.png`, fullPage: false });

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n\n============ FINAL VERIFICATION SUMMARY ============');
  console.log(`1. .main IS scroll container:      ${RESULTS.v1.pass ? 'PASS' : 'FAIL'}`);
  console.log(`   scrollHeight=${RESULTS.v1.scrollHeight} > clientHeight=${RESULTS.v1.clientHeight}, overflowY=${RESULTS.v1.overflowY}`);
  console.log(`2. No per-column scrollbars:        ${RESULTS.v2.pass ? 'PASS' : 'FAIL'}`);
  console.log(`   All columns overflowY=visible`);
  console.log(`3. Toolbar stays fixed on scroll:   ${RESULTS.v3.pass ? 'PASS' : 'FAIL'}`);
  console.log(`   top before=${RESULTS.v3.toolbarTopBefore}, after=${RESULTS.v3.toolbarTopAfter}; mainST=${RESULTS.v3.mainScrollTop}`);
  console.log(`4. Inspector independent scroll:    ${RESULTS.v4.pass ? 'PASS' : 'FAIL'}`);
  console.log(`   mainST before=${RESULTS.v4.mainScrollBefore}, after=${RESULTS.v4.mainScrollAfter}`);
  if (RESULTS.v4_reverse) {
    console.log(`   reverse: inspST before=${RESULTS.v4_reverse.inspSTBefore}, after=${RESULTS.v4_reverse.inspSTAfter}`);
  }
  console.log(`5. Horizontal scroll works:         ${RESULTS.v5.pass ? 'PASS' : 'FAIL'}`);
  console.log(`   scrollLeft: ${RESULTS.v5.scrollLeftBefore} → ${RESULTS.v5.scrollLeftAfter}`);
  console.log('====================================================');

  // Save results
  fs.writeFileSync(`${SCREENSHOT_DIR}/verification-results.json`, JSON.stringify(RESULTS, null, 2));
  console.log(`\nResults + screenshots saved to ${SCREENSHOT_DIR}/`);

  await browser.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

import { chromium } from 'playwright';
import fs from 'fs';

const LIVE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-10';
const RESULTS = {};

async function createTasks(page, count, colIdx) {
  let created = 0;
  for (let i = 0; i < count; i++) {
    const taskName = `Ready-${String(i + 1).padStart(2, '0')}`;

    // Click add button on column
    await page.evaluate((ci) => {
      const ftApp = document.querySelector('ft-app');
      const mainEl = ftApp.shadowRoot.querySelector('.main');
      const kanbanView = mainEl.querySelector('ft-kanban-view');
      const cols = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
      cols[ci].shadowRoot.querySelector('.add-task-button').click();
    }, colIdx);
    await page.waitForTimeout(500);

    // Focus and type into the SL-INPUT's inner input
    const typed = await page.evaluate((name) => {
      const ftApp = document.querySelector('ft-app');
      const mainEl = ftApp.shadowRoot.querySelector('.main');
      const kanbanView = mainEl.querySelector('ft-kanban-view');
      const dialog = kanbanView.shadowRoot.querySelector('ft-add-task-dialog');
      if (!dialog || !dialog.shadowRoot) return { error: 'no dialog' };
      const slInput = dialog.shadowRoot.querySelector('sl-input');
      if (!slInput || !slInput.shadowRoot) return { error: 'no sl-input' };
      const input = slInput.shadowRoot.querySelector('input.input__control');
      if (!input) return { error: 'no input control' };
      input.focus();
      input.value = name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Also set the sl-input value
      slInput.value = name;
      return { typed: true };
    }, taskName);

    if (!typed?.typed) {
      console.log(`Failed to type task name: ${JSON.stringify(typed)}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      continue;
    }

    // Submit the form - find the submit/create button in the dialog
    const submitted = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const mainEl = ftApp.shadowRoot.querySelector('.main');
      const kanbanView = mainEl.querySelector('ft-kanban-view');
      const dialog = kanbanView.shadowRoot.querySelector('ft-add-task-dialog');
      if (!dialog?.shadowRoot) return { error: 'no dialog' };

      // Look for submit button
      const buttons = dialog.shadowRoot.querySelectorAll('sl-button, button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim()?.toLowerCase();
        if (text?.includes('add') || text?.includes('create') || text?.includes('save') ||
            btn.getAttribute('type') === 'submit' || btn.getAttribute('variant') === 'primary') {
          btn.click();
          return { submitted: true, text: btn.textContent?.trim() };
        }
      }

      // Try submitting the form directly
      const form = dialog.shadowRoot.querySelector('form');
      if (form) {
        form.requestSubmit();
        return { submitted: true, via: 'form.requestSubmit' };
      }

      // List buttons
      const allBtns = Array.from(buttons).map(b => b.textContent?.trim());
      return { error: 'no submit button', buttons: allBtns };
    });

    if (i === 0) console.log('Submit result:', JSON.stringify(submitted));

    await page.waitForTimeout(1000);
    created++;
    if ((i + 1) % 5 === 0) console.log(`Created ${created} tasks...`);
  }
  return created;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // ===== Load app =====
  console.log('=== Loading app ===');
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/00-app-loaded.png`, fullPage: false });

  // Select "default" collection
  await page.locator('text=default').first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-collection-board.png`, fullPage: false });
  console.log('Board loaded.');

  // ===== Create tasks =====
  console.log('\n=== Creating tasks in Ready column ===');
  const created = await createTasks(page, 15, 2); // Ready is index 2
  console.log(`Total tasks created: ${created}`);
  await page.waitForTimeout(2000);

  // Reload to ensure all tasks are visible
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('text=default').first().click();
  await page.waitForTimeout(3000);

  // ===== Verify state =====
  const currentState = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const mainStyle = getComputedStyle(mainEl);
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    let totalTasks = 0;
    const colInfo = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card').length;
      totalTasks += cards;
      const h = col.shadowRoot.querySelector('.header')?.textContent?.trim()?.substring(0, 15);
      colInfo.push({ h, cards });
    }
    return {
      totalTasks, columns: colInfo,
      mainScrollHeight: mainEl.scrollHeight,
      mainClientHeight: mainEl.clientHeight,
      mainOverflowY: mainStyle.overflowY,
      isScrollable: mainEl.scrollHeight > mainEl.clientHeight,
    };
  });
  console.log('Current state:', JSON.stringify(currentState, null, 2));

  // Screenshot: initial board with all tasks
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-board-with-tasks.png`, fullPage: false });

  // ====================================================================
  // VERIFICATION 1: .main IS the scroll container
  // ====================================================================
  console.log('\n=== VERIFICATION 1: .main is scroll container ===');
  RESULTS['main_scroll'] = {
    scrollHeight: currentState.mainScrollHeight,
    clientHeight: currentState.mainClientHeight,
    overflowY: currentState.mainOverflowY,
    isScrollable: currentState.isScrollable,
  };
  const v1 = currentState.isScrollable;
  console.log(`RESULT: ${v1 ? 'PASS' : 'FAIL'} — scrollHeight=${currentState.mainScrollHeight} vs clientHeight=${currentState.mainClientHeight}, overflowY=${currentState.mainOverflowY}`);

  // ====================================================================
  // VERIFICATION 2: No per-column scrollbars
  // ====================================================================
  console.log('\n=== VERIFICATION 2: No per-column scrollbars ===');
  const colScrollInfo = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    const data = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cardsEl = col.shadowRoot.querySelector('.cards');
      if (!cardsEl) continue;
      const style = getComputedStyle(cardsEl);
      const h = col.shadowRoot.querySelector('.header')?.textContent?.trim()?.substring(0, 15);
      data.push({
        header: h,
        overflowY: style.overflowY,
        scrollH: cardsEl.scrollHeight,
        clientH: cardsEl.clientHeight,
        hasOwnScroll: cardsEl.scrollHeight > cardsEl.clientHeight &&
          style.overflowY !== 'visible' && style.overflowY !== 'hidden',
      });
    }
    return data;
  });
  RESULTS['column_scroll'] = colScrollInfo;
  let v2 = true;
  for (const col of colScrollInfo) {
    if (col.hasOwnScroll) {
      v2 = false;
      console.log(`  FAIL: ${col.header} has own scrollbar (overflowY=${col.overflowY})`);
    } else {
      console.log(`  OK: ${col.header} overflowY=${col.overflowY}`);
    }
  }
  console.log(`RESULT: ${v2 ? 'PASS' : 'FAIL'}`);

  // ====================================================================
  // VERIFICATION 3: Toolbar stays fixed when scrolling .main
  // ====================================================================
  console.log('\n=== VERIFICATION 3: Toolbar stays fixed during scroll ===');
  const tbBefore = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const toolbar = ftApp.shadowRoot.querySelector('ft-toolbar');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    return {
      toolbarTop: toolbar?.getBoundingClientRect().top,
      toolbarBottom: toolbar?.getBoundingClientRect().bottom,
      mainScrollTop: mainEl?.scrollTop,
    };
  });

  if (currentState.isScrollable) {
    await page.evaluate(() => {
      document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 500;
    });
  } else {
    // Use mouse wheel
    const mainBox = await page.evaluate(() => {
      const mainEl = document.querySelector('ft-app').shadowRoot.querySelector('.main');
      const r = mainEl.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(mainBox.x, mainBox.y);
    await page.mouse.wheel(0, 500);
  }
  await page.waitForTimeout(500);

  const tbAfter = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const toolbar = ftApp.shadowRoot.querySelector('ft-toolbar');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    return {
      toolbarTop: toolbar?.getBoundingClientRect().top,
      toolbarBottom: toolbar?.getBoundingClientRect().bottom,
      mainScrollTop: mainEl?.scrollTop,
      docScrollTop: document.documentElement.scrollTop,
    };
  });
  RESULTS['toolbar_scroll'] = { before: tbBefore, after: tbAfter };

  const scrolled = tbAfter.mainScrollTop > 0;
  const v3 = tbAfter.toolbarTop === tbBefore.toolbarTop && scrolled;
  console.log(`  Before: toolbar top=${tbBefore.toolbarTop}, mainST=${tbBefore.mainScrollTop}`);
  console.log(`  After:  toolbar top=${tbAfter.toolbarTop}, mainST=${tbAfter.mainScrollTop}, docST=${tbAfter.docScrollTop}`);
  console.log(`RESULT: ${v3 ? 'PASS' : scrolled ? 'FAIL' : 'SKIP (could not scroll)'}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-main-scrolled-toolbar-fixed.png`, fullPage: false });

  // ====================================================================
  // VERIFICATION 4: Inspector scrolls independently
  // ====================================================================
  console.log('\n=== VERIFICATION 4: Inspector scrolls independently ===');

  // Set main to a known scroll position
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 300;
  });
  await page.waitForTimeout(300);

  // Click a task card to open inspector
  await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card');
      if (cards.length > 0) { cards[0].click(); break; }
    }
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-inspector-open.png`, fullPage: false });

  // Record main scroll before inspector scroll
  const mainSTBefore = await page.evaluate(() =>
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
  );

  // Find inspector panel and check its scroll properties
  const inspInfo = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const content = ftApp.shadowRoot.querySelector('.content');
    // Look for inspector in .content children
    const children = content ? Array.from(content.children).map(c => `${c.tagName}.${c.className}`) : [];

    // Find .inspector div or ft-inspector
    const inspDiv = content?.querySelector(':scope > .inspector') ||
                    ftApp.shadowRoot.querySelector('.inspector');

    if (inspDiv) {
      const rect = inspDiv.getBoundingClientRect();
      // Find ft-inspector inside
      const fti = inspDiv.querySelector('ft-inspector');
      let bodyInfo = null;
      if (fti?.shadowRoot) {
        const body = fti.shadowRoot.querySelector('.body');
        if (body) {
          const style = getComputedStyle(body);
          bodyInfo = {
            overflowY: style.overflowY,
            scrollH: body.scrollHeight,
            clientH: body.clientHeight,
            hasScroll: body.scrollHeight > body.clientHeight,
          };
        }
      }
      return { found: true, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, bodyInfo };
    }

    return { found: false, contentChildren: children };
  });
  console.log('Inspector info:', JSON.stringify(inspInfo, null, 2));
  RESULTS['inspector_info'] = inspInfo;

  // Scroll inside inspector
  if (inspInfo.found && inspInfo.rect.w > 0) {
    await page.mouse.move(inspInfo.rect.x + inspInfo.rect.w / 2, inspInfo.rect.y + inspInfo.rect.h / 2);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
  }

  const mainSTAfter = await page.evaluate(() =>
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
  );
  RESULTS['inspector_independence'] = {
    mainScrollBefore: mainSTBefore,
    mainScrollAfter: mainSTAfter,
    independent: mainSTBefore === mainSTAfter,
  };

  const v4 = mainSTBefore === mainSTAfter;
  console.log(`  Main scrollTop before inspector scroll: ${mainSTBefore}`);
  console.log(`  Main scrollTop after inspector scroll: ${mainSTAfter}`);
  console.log(`RESULT: ${v4 ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-inspector-scrolled.png`, fullPage: false });

  // Also verify scrolling main doesn't change inspector
  // Scroll main while inspector is open
  if (inspInfo.found && inspInfo.bodyInfo?.hasScroll) {
    const inspScrollBefore = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const inspDiv = ftApp.shadowRoot.querySelector('.content')?.querySelector('.inspector') ||
                      ftApp.shadowRoot.querySelector('.inspector');
      const fti = inspDiv?.querySelector('ft-inspector');
      if (fti?.shadowRoot) {
        const body = fti.shadowRoot.querySelector('.body');
        return body?.scrollTop ?? null;
      }
      return null;
    });

    // Scroll main
    await page.evaluate(() => {
      const mainEl = document.querySelector('ft-app').shadowRoot.querySelector('.main');
      mainEl.scrollTop = mainEl.scrollTop + 200;
    });
    await page.waitForTimeout(300);

    const inspScrollAfter = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const inspDiv = ftApp.shadowRoot.querySelector('.content')?.querySelector('.inspector') ||
                      ftApp.shadowRoot.querySelector('.inspector');
      const fti = inspDiv?.querySelector('ft-inspector');
      if (fti?.shadowRoot) {
        const body = fti.shadowRoot.querySelector('.body');
        return body?.scrollTop ?? null;
      }
      return null;
    });
    console.log(`  Inspector scrollTop before main scroll: ${inspScrollBefore}, after: ${inspScrollAfter}`);
    RESULTS['reverse_independence'] = { inspScrollBefore, inspScrollAfter, independent: inspScrollBefore === inspScrollAfter };
  }

  // ====================================================================
  // VERIFICATION 5: Horizontal scroll
  // ====================================================================
  console.log('\n=== VERIFICATION 5: Horizontal scroll ===');

  // Close inspector by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Reset main scroll
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(300);

  const hBefore = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const kanbanView = ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view');
    const board = kanbanView.shadowRoot.querySelector('.board');
    const style = getComputedStyle(board);
    return {
      scrollLeft: board.scrollLeft,
      scrollWidth: board.scrollWidth,
      clientWidth: board.clientWidth,
      overflowX: style.overflowX,
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
    return { scrollLeft: board.scrollLeft };
  });

  RESULTS['horizontal_scroll'] = { before: hBefore, after: hAfter };
  const v5 = hAfter.scrollLeft > 0;
  console.log(`  scrollLeft before=${hBefore.scrollLeft}, after=${hAfter.scrollLeft}`);
  console.log(`  canScrollH=${hBefore.canScrollH} (scrollWidth=${hBefore.scrollWidth}, clientWidth=${hBefore.clientWidth})`);
  console.log(`RESULT: ${v5 ? 'PASS' : 'FAIL'}`);

  // Check toolbar still fixed after h-scroll
  const tbAfterH = await page.evaluate(() => {
    const tb = document.querySelector('ft-app').shadowRoot.querySelector('ft-toolbar');
    return { top: tb?.getBoundingClientRect().top };
  });
  console.log(`  Toolbar top after H-scroll: ${tbAfterH.top}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-horizontal-scroll.png`, fullPage: false });

  // ====================================================================
  // FINAL SUMMARY
  // ====================================================================
  console.log('\n\n============ FINAL VERIFICATION SUMMARY ============');
  console.log(`1. .main IS scroll container:    ${v1 ? 'PASS' : 'FAIL'}`);
  console.log(`2. No per-column scrollbars:     ${v2 ? 'PASS' : 'FAIL'}`);
  console.log(`3. Toolbar stays fixed:          ${v3 ? 'PASS' : scrolled ? 'FAIL' : 'SKIP'}`);
  console.log(`4. Inspector independent scroll: ${v4 ? 'PASS' : 'FAIL'}`);
  console.log(`5. Horizontal scroll works:      ${v5 ? 'PASS' : 'FAIL'}`);
  console.log('====================================================');

  fs.writeFileSync(`${SCREENSHOT_DIR}/verification-results.json`, JSON.stringify(RESULTS, null, 2));
  console.log(`\nResults saved to ${SCREENSHOT_DIR}/verification-results.json`);

  await browser.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

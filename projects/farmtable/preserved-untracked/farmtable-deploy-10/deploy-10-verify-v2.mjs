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

  // ===== Step 0: Load app =====
  console.log('=== Step 0: Load app ===');
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/00-app-loaded.png`, fullPage: false });
  console.log('App loaded.');

  // ===== Step 1: Select "default" collection =====
  console.log('\n=== Step 1: Select collection ===');
  await page.locator('text=default').first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-collection-board.png`, fullPage: false });
  console.log('Board view loaded.');

  // ===== Step 2: Create tasks via "+" column buttons =====
  console.log('\n=== Step 2: Creating tasks to make board overflow ===');

  // First, let's understand the column header structure
  const headerInfo = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    if (!ftApp || !ftApp.shadowRoot) return { error: 'no ft-app' };
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    if (!kanbanView || !kanbanView.shadowRoot) return { error: 'no kanban' };
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    const info = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const header = col.shadowRoot.querySelector('.header');
      if (!header) continue;
      const els = Array.from(header.querySelectorAll('*')).map(e => ({
        tag: e.tagName, class: e.className, text: e.textContent?.trim()?.substring(0, 20),
        clickable: e.tagName === 'BUTTON' || e.getAttribute('role') === 'button' || e.style.cursor === 'pointer',
      }));
      info.push({
        headerText: header.textContent?.trim()?.substring(0, 30),
        headerHTML: header.innerHTML?.substring(0, 200),
        elements: els,
      });
    }
    return info;
  });
  console.log('Column header info:', JSON.stringify(headerInfo.slice(0, 2), null, 2));

  // Try to find the "+" buttons - they appear as "+" text with count badges
  // From the screenshot: "TRIAGE 1 +"
  // Let's try to click them by finding span/button with "+" text

  let tasksCreated = 0;
  for (let i = 0; i < 15; i++) {
    const taskName = `Scroll-Test-${i + 1}`;

    // Click the Ready column's "+" element (column index 2)
    const clickResult = await page.evaluate((colIdx) => {
      const ftApp = document.querySelector('ft-app');
      const mainEl = ftApp.shadowRoot.querySelector('.main');
      const kanbanView = mainEl.querySelector('ft-kanban-view');
      const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
      const col = columns[colIdx];
      if (!col || !col.shadowRoot) return { error: 'no column' };

      // Find the "+" element in header
      const header = col.shadowRoot.querySelector('.header');
      if (!header) return { error: 'no header' };

      // Try clicking any element with "+" text
      const allEls = header.querySelectorAll('*');
      for (const el of allEls) {
        if (el.textContent?.trim() === '+' || el.textContent?.trim() === '+ ' ||
            el.classList?.contains('add') || el.classList?.contains('plus')) {
          el.click();
          return { clicked: true, tag: el.tagName, class: el.className };
        }
      }

      // If no "+" found, try last element in header (often the + button)
      const lastEl = allEls[allEls.length - 1];
      if (lastEl) {
        return { notClicked: true, lastElement: { tag: lastEl.tagName, class: lastEl.className, text: lastEl.textContent?.trim() } };
      }

      return { error: 'no + element found' };
    }, 2);

    if (i === 0) console.log('First click result:', JSON.stringify(clickResult));

    if (clickResult.clicked) {
      await page.waitForTimeout(300);
      // Check if an input appeared
      const inputAppeared = await page.evaluate(() => {
        // Check for any input/textarea that appeared
        const inputs = document.querySelectorAll('input, textarea');
        if (inputs.length > 0) return { found: true, count: inputs.length };

        // Check shadow DOMs
        const ftApp = document.querySelector('ft-app');
        if (!ftApp?.shadowRoot) return { found: false };

        // Check for modal/dialog
        const dialogs = ftApp.shadowRoot.querySelectorAll('dialog, [role="dialog"], .modal, .overlay');
        if (dialogs.length > 0) return { found: true, type: 'dialog', count: dialogs.length };

        // Check for inline input in kanban
        const mainEl = ftApp.shadowRoot.querySelector('.main');
        const kanbanView = mainEl?.querySelector('ft-kanban-view');
        if (kanbanView?.shadowRoot) {
          const kInputs = kanbanView.shadowRoot.querySelectorAll('input, textarea');
          if (kInputs.length > 0) return { found: true, type: 'kanban-input', count: kInputs.length };
        }

        return { found: false };
      });

      if (i === 0) console.log('Input appeared:', JSON.stringify(inputAppeared));

      if (inputAppeared.found) {
        await page.keyboard.type(taskName, { delay: 20 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        tasksCreated++;
      }
    } else {
      if (i === 0) console.log('Could not click + button, will try alternative approach');
      break;
    }

    if ((i + 1) % 5 === 0) console.log(`Created ${tasksCreated} tasks so far...`);
  }

  console.log(`Tasks created via + button: ${tasksCreated}`);

  // If + button approach didn't work, try the "+ Add Task" button
  if (tasksCreated === 0) {
    console.log('\nTrying "+ Add Task" button approach...');

    // Look for the Add Task button in the kanban view area
    // From screenshot it's a blue button labeled "+ Add Task" in the top-right
    const addBtnInfo = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      if (!ftApp?.shadowRoot) return { error: 'no ft-app' };

      // Search all shadow roots for "Add Task" button
      const search = (root, path) => {
        const results = [];
        root.querySelectorAll('button, [role="button"]').forEach(b => {
          const text = b.textContent?.trim();
          if (text?.toLowerCase().includes('add')) {
            results.push({ path, tag: b.tagName, class: b.className, text: text.substring(0, 40) });
          }
        });
        // Search nested shadow roots
        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            results.push(...search(el.shadowRoot, `${path} > ${el.tagName}`));
          }
        });
        return results;
      };

      return search(ftApp.shadowRoot, 'ft-app');
    });
    console.log('Add buttons found:', JSON.stringify(addBtnInfo, null, 2));

    // Try clicking "Add Task" button
    for (let i = 0; i < 15; i++) {
      const taskName = `Scroll-Test-${i + 1}`;

      const clicked = await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const search = (root) => {
          // Direct buttons
          for (const b of root.querySelectorAll('button, [role="button"]')) {
            if (b.textContent?.trim()?.includes('Add Task')) {
              b.click();
              return { clicked: true, text: b.textContent.trim().substring(0, 40) };
            }
          }
          // Nested shadow roots
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) {
              const result = search(el.shadowRoot);
              if (result?.clicked) return result;
            }
          }
          return null;
        };
        return search(ftApp.shadowRoot) || { error: 'not found' };
      });

      if (i === 0) console.log('Add Task click result:', JSON.stringify(clicked));

      if (!clicked?.clicked) break;

      await page.waitForTimeout(500);

      // Check for dialog/modal/input
      const dialogInfo = await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const search = (root) => {
          const dialogs = root.querySelectorAll('dialog[open], [role="dialog"], .modal, .dialog, .overlay');
          const inputs = root.querySelectorAll('input[type="text"], input:not([type]), textarea');
          if (dialogs.length > 0 || inputs.length > 0) {
            return { dialogs: dialogs.length, inputs: inputs.length };
          }
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) {
              const result = search(el.shadowRoot);
              if (result) return result;
            }
          }
          return null;
        };
        return search(ftApp.shadowRoot) || search(document);
      });

      if (i === 0) console.log('Dialog/input info:', JSON.stringify(dialogInfo));

      if (dialogInfo?.inputs > 0 || dialogInfo?.dialogs > 0) {
        // Type the task name
        await page.keyboard.type(taskName, { delay: 20 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        tasksCreated++;
      } else {
        // Maybe it opens inline - try typing anyway
        await page.keyboard.type(taskName, { delay: 20 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        tasksCreated++;
      }

      if ((i + 1) % 5 === 0) console.log(`Created ${tasksCreated} tasks so far...`);
    }
  }

  console.log(`Total tasks created: ${tasksCreated}`);
  await page.waitForTimeout(1000);

  // Check current task count and scroll state
  const currentState = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    if (!ftApp?.shadowRoot) return { error: 'no ft-app' };
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl?.querySelector('ft-kanban-view');
    if (!kanbanView?.shadowRoot) return { error: 'no kanban' };
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    let totalTasks = 0;
    const colInfo = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card');
      totalTasks += cards.length;
      const header = col.shadowRoot.querySelector('.header')?.textContent?.trim()?.substring(0, 20);
      colInfo.push({ header, cards: cards.length });
    }
    return {
      totalTasks,
      columns: colInfo,
      mainScrollHeight: mainEl.scrollHeight,
      mainClientHeight: mainEl.clientHeight,
      isScrollable: mainEl.scrollHeight > mainEl.clientHeight,
    };
  });
  console.log('Current state after task creation:', JSON.stringify(currentState, null, 2));

  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-after-task-creation.png`, fullPage: false });

  // ===== Now run verification checks =====
  console.log('\n=== VERIFICATION CHECKS ===');

  // 1. .main scroll container
  const mainScrollInfo = {
    scrollHeight: currentState.mainScrollHeight,
    clientHeight: currentState.mainClientHeight,
    isScrollable: currentState.isScrollable,
  };
  const mainOverflow = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const style = getComputedStyle(mainEl);
    return { overflowY: style.overflowY, overflowX: style.overflowX };
  });
  mainScrollInfo.overflowY = mainOverflow.overflowY;
  RESULTS['main_scroll'] = mainScrollInfo;

  // 2. No per-column scrollbars
  const columnScrollInfo = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    if (!kanbanView?.shadowRoot) return { error: 'no kanban' };
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    const data = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cardsEl = col.shadowRoot.querySelector('.cards');
      if (!cardsEl) continue;
      const style = getComputedStyle(cardsEl);
      const header = col.shadowRoot.querySelector('.header')?.textContent?.trim()?.substring(0, 20);
      data.push({
        header,
        overflowY: style.overflowY,
        scrollHeight: cardsEl.scrollHeight,
        clientHeight: cardsEl.clientHeight,
        hasOwnScrollbar: cardsEl.scrollHeight > cardsEl.clientHeight &&
          style.overflowY !== 'visible' && style.overflowY !== 'hidden',
      });
    }
    return { columns: data };
  });
  RESULTS['column_scroll'] = columnScrollInfo;

  // 3. Toolbar fixed during scroll
  const toolbarBefore = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const toolbar = ftApp.shadowRoot.querySelector('.toolbar') || ftApp.shadowRoot.querySelector('ft-toolbar');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    return {
      toolbarTop: toolbar?.getBoundingClientRect().top,
      mainScrollTop: mainEl?.scrollTop,
    };
  });

  if (mainScrollInfo.isScrollable) {
    await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      ftApp.shadowRoot.querySelector('.main').scrollTop = 500;
    });
    await page.waitForTimeout(500);
  }

  const toolbarAfter = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const toolbar = ftApp.shadowRoot.querySelector('.toolbar') || ftApp.shadowRoot.querySelector('ft-toolbar');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    return {
      toolbarTop: toolbar?.getBoundingClientRect().top,
      mainScrollTop: mainEl?.scrollTop,
      docScrollTop: document.documentElement.scrollTop,
    };
  });
  RESULTS['scroll_test'] = { before: toolbarBefore, after: toolbarAfter };

  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-main-scrolled.png`, fullPage: false });

  // 4. Inspector independence
  await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    ftApp.shadowRoot.querySelector('.main').scrollTop = 300;
  });
  await page.waitForTimeout(300);

  // Click a task
  await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card');
      if (cards.length > 0) { cards[0].click(); return; }
    }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-inspector-open.png`, fullPage: false });

  const mainBeforeInsp = await page.evaluate(() =>
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
  );

  // Find inspector and scroll it
  const inspBox = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    // Try to find .inspector in .content
    const content = ftApp.shadowRoot.querySelector('.content');
    const insp = content?.querySelector('.inspector') || ftApp.shadowRoot.querySelector('.inspector');
    if (insp) {
      const r = insp.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }
    // Try ft-inspector
    const fti = ftApp.shadowRoot.querySelector('ft-inspector') || content?.querySelector('ft-inspector');
    if (fti) {
      const r = fti.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }
    return null;
  });

  if (inspBox && inspBox.w > 0) {
    await page.mouse.move(inspBox.x, inspBox.y);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
  }

  const mainAfterInsp = await page.evaluate(() =>
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop
  );
  RESULTS['inspector_independence'] = {
    mainScrollBefore: mainBeforeInsp,
    mainScrollAfter: mainAfterInsp,
    independent: mainBeforeInsp === mainAfterInsp,
  };

  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-inspector-scrolled.png`, fullPage: false });

  // 5. Horizontal scroll
  await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    ftApp.shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(300);

  const hBefore = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const kanbanView = ftApp.shadowRoot.querySelector('.main').querySelector('ft-kanban-view');
    const board = kanbanView.shadowRoot.querySelector('.board');
    return {
      scrollLeft: board.scrollLeft,
      scrollWidth: board.scrollWidth,
      clientWidth: board.clientWidth,
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

  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-horizontal-scroll.png`, fullPage: false });

  // ===== SUMMARY =====
  console.log('\n========== VERIFICATION SUMMARY ==========\n');

  console.log(`1. .main IS scroll container: ${mainScrollInfo.isScrollable ? 'PASS' : 'FAIL/SKIP (need more tasks)'}`);
  console.log(`   scrollHeight=${mainScrollInfo.scrollHeight}, clientHeight=${mainScrollInfo.clientHeight}, overflowY=${mainScrollInfo.overflowY}`);

  let perColFail = false;
  if (columnScrollInfo.columns) {
    for (const col of columnScrollInfo.columns) {
      if (col.hasOwnScrollbar) { perColFail = true; }
    }
  }
  console.log(`2. No per-column scrollbars: ${!perColFail ? 'PASS' : 'FAIL'}`);
  if (columnScrollInfo.columns) {
    for (const col of columnScrollInfo.columns) {
      console.log(`   ${col.header}: overflowY=${col.overflowY}`);
    }
  }

  const tbFixed = toolbarAfter.toolbarTop === toolbarBefore.toolbarTop && toolbarAfter.mainScrollTop > 0;
  console.log(`3. Toolbar fixed: ${tbFixed ? 'PASS' : mainScrollInfo.isScrollable ? 'FAIL' : 'SKIP (not scrollable)'}`);
  console.log(`   before=${toolbarBefore.toolbarTop}, after=${toolbarAfter.toolbarTop}, mainST=${toolbarAfter.mainScrollTop}`);

  console.log(`4. Inspector independent: ${RESULTS.inspector_independence.independent ? 'PASS' : 'FAIL'}`);
  console.log(`   mainST before=${mainBeforeInsp}, after=${mainAfterInsp}`);

  console.log(`5. Horizontal scroll: ${hAfter.scrollLeft > 0 ? 'PASS' : 'FAIL'}`);
  console.log(`   scrollLeft before=${hBefore.scrollLeft}, after=${hAfter.scrollLeft}`);

  console.log('\n==========================================');

  fs.writeFileSync(`${SCREENSHOT_DIR}/verification-results.json`, JSON.stringify(RESULTS, null, 2));
  await browser.close();
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});

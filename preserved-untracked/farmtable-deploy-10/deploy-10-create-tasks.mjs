import { chromium } from 'playwright';

const LIVE_URL = 'https://farmtable-486315127503.us-central1.run.app';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Load app
  console.log('Loading app...');
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Select "default" collection
  await page.locator('text=default').first().click();
  await page.waitForTimeout(3000);
  console.log('Board loaded.');

  // Count initial tasks
  const initialCount = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    let total = 0;
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      total += col.shadowRoot.querySelectorAll('ft-task-card').length;
    }
    return total;
  });
  console.log(`Initial tasks: ${initialCount}`);

  // Try clicking the SL-ICON-BUTTON.add-task-button on the Ready column
  for (let i = 0; i < 15; i++) {
    const taskName = `Ready-${String(i + 1).padStart(2, '0')}`;

    // Click the add-task-button on Ready column (index 2)
    const clickResult = await page.evaluate((colIdx) => {
      const ftApp = document.querySelector('ft-app');
      const mainEl = ftApp.shadowRoot.querySelector('.main');
      const kanbanView = mainEl.querySelector('ft-kanban-view');
      const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
      const col = columns[colIdx];
      if (!col?.shadowRoot) return { error: 'no column shadow' };

      const addBtn = col.shadowRoot.querySelector('.add-task-button') ||
                     col.shadowRoot.querySelector('sl-icon-button');
      if (!addBtn) return { error: 'no add button' };

      // For web components, dispatch a click event
      addBtn.click();
      return { clicked: true, tag: addBtn.tagName, class: addBtn.className };
    }, 2);

    if (i === 0) console.log('Click result:', JSON.stringify(clickResult));
    if (!clickResult?.clicked) {
      console.log('Failed to click add button:', JSON.stringify(clickResult));
      break;
    }

    await page.waitForTimeout(500);

    // Check for input field - it could be an inline input in the column
    const inputInfo = await page.evaluate(() => {
      // Deep search for input across all shadow roots
      const search = (root, depth = 0) => {
        if (depth > 5) return null;
        const inputs = root.querySelectorAll('input, textarea');
        if (inputs.length > 0) {
          return { found: true, count: inputs.length, depth,
            details: Array.from(inputs).map(inp => ({
              type: inp.type, class: inp.className, placeholder: inp.placeholder,
              visible: inp.offsetParent !== null || inp.style.display !== 'none',
            }))
          };
        }
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const result = search(el.shadowRoot, depth + 1);
            if (result) return result;
          }
        }
        return null;
      };
      return search(document) || { found: false };
    });

    if (i === 0) console.log('Input search:', JSON.stringify(inputInfo, null, 2));

    if (inputInfo.found) {
      // Focus the input and type
      const focused = await page.evaluate(() => {
        const search = (root) => {
          const inputs = root.querySelectorAll('input, textarea');
          for (const inp of inputs) {
            if (inp.offsetParent !== null || inp.style.display !== 'none') {
              inp.focus();
              return true;
            }
          }
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) {
              if (search(el.shadowRoot)) return true;
            }
          }
          return false;
        };
        return search(document);
      });
      if (focused) {
        await page.keyboard.type(taskName, { delay: 10 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        if ((i + 1) % 5 === 0) console.log(`Created ${i + 1}/15 tasks...`);
      }
    } else {
      // Maybe it's a modal or dialog - take screenshot to see what happened
      if (i === 0) {
        await page.screenshot({ path: '/tmp/debug-add-click.png' });
        console.log('No input found after clicking add button. Screenshot saved.');

        // Check if there's a modal/overlay
        const overlay = await page.evaluate(() => {
          const ftApp = document.querySelector('ft-app');
          const search = (root, path = '') => {
            const els = root.querySelectorAll('dialog, [role="dialog"], .modal, .dialog, .overlay, ft-task-dialog, ft-add-task');
            if (els.length) return { found: true, path, tags: Array.from(els).map(e => e.tagName + '.' + e.className) };
            for (const el of root.querySelectorAll('*')) {
              if (el.shadowRoot) {
                const r = search(el.shadowRoot, path + '>' + el.tagName);
                if (r) return r;
              }
            }
            return null;
          };
          return search(ftApp.shadowRoot) || search(document);
        });
        console.log('Overlay search:', JSON.stringify(overlay));
      }
      // Try pressing Escape and retry
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  // Check final state
  const finalCount = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');
    let total = 0;
    const cols = [];
    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card').length;
      total += cards;
      const h = col.shadowRoot.querySelector('.header')?.textContent?.trim()?.substring(0, 15);
      cols.push(`${h}:${cards}`);
    }
    return { total, cols: cols.join(', '), mainScrollHeight: mainEl.scrollHeight, mainClientHeight: mainEl.clientHeight };
  });
  console.log(`Final state: ${JSON.stringify(finalCount)}`);

  await browser.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

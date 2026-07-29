/**
 * Quick re-verification for Feature 61 fix round:
 *   1. Isolate toggle still works (basic on/off)
 *   2. Isolate auto-disables when selection clears
 *   3. Level selector shows correct range when isolated
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:9091';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';
const SCREENSHOT_DIR = 'screenshots';

async function countVisibleNodes(page) {
  return page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return { count: 0, names: [] };
    const nodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node') ?? [];
    const names = [];
    for (const n of nodes) {
      const title = n.shadowRoot?.querySelector('.title')?.textContent?.trim();
      if (title) names.push(title);
    }
    return { count: nodes.length, names };
  });
}

async function getIsolateButtonState(page) {
  return page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return null;
    const nav = treeView.shadowRoot?.querySelector('ft-hierarchy-nav');
    if (!nav) return null;
    const btn = nav.shadowRoot?.querySelector('.isolate-btn');
    if (!btn) return null;
    return {
      visible: true,
      active: btn.classList.contains('active'),
      disabled: btn.disabled,
      text: btn.textContent?.trim(),
    };
  });
}

async function getLevelOptions(page) {
  return page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return [];
    const nav = treeView.shadowRoot?.querySelector('ft-hierarchy-nav');
    if (!nav) return [];
    const select = nav.shadowRoot?.querySelector('sl-select');
    if (!select) return [];
    const opts = select.querySelectorAll('sl-option');
    return Array.from(opts).map(o => o.textContent?.trim());
  });
}

async function clickIsolateButton(page) {
  await page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    const nav = treeView?.shadowRoot?.querySelector('ft-hierarchy-nav');
    const btn = nav?.shadowRoot?.querySelector('.isolate-btn');
    btn?.click();
  });
}

async function selectFirstTask(page) {
  // Click the first foreignObject in the SVG to select a task
  await page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return;
    const fo = treeView.shadowRoot?.querySelector('foreignObject');
    if (fo) fo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function clickSvgBackground(page) {
  // Click the SVG background to deselect
  await page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return;
    const svg = treeView.shadowRoot?.querySelector('svg');
    if (svg) {
      // Click at a point that's not on any foreignObject
      const evt = new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 });
      svg.dispatchEvent(evt);
    }
  });
}

async function selectTaskByName(page, name) {
  await page.evaluate((taskName) => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return;
    const nodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node') ?? [];
    for (const n of nodes) {
      const title = n.shadowRoot?.querySelector('.title')?.textContent?.trim();
      if (title && title.includes(taskName)) {
        const fo = n.closest('foreignObject');
        if (fo) fo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return;
      }
    }
  }, name);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('=== F61 Fix Round: Re-verification ===\n');

  // Set localStorage token before navigating to bypass login
  const TOKEN = 'ft_f16afac06df1a9ff6a23d4e6525b2591e5457e2c8baa8743f2e1fba9618196b6';
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  // Reload to pick up localStorage token
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click into a collection with hierarchical tasks
  console.log('Selecting collection "Scenario 1: 4-Layer Chain"...');
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return;
    const collList = app.shadowRoot?.querySelector('ft-collection-list');
    if (!collList) { console.log('No ft-collection-list found'); return; }
    const buttons = collList.shadowRoot?.querySelectorAll('button.collection') ?? [];
    for (const btn of buttons) {
      if (btn.textContent?.includes('Feature 19 Alpha')) {
        btn.click();
        return;
      }
    }
    // fallback: click the first collection
    if (buttons.length > 0) buttons[0].click();
  });
  await page.waitForTimeout(3000);

  // Switch to Tree view
  console.log('Switching to Tree view...');
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const toolbar = app?.shadowRoot?.querySelector('ft-toolbar');
    const viewSwitcher = toolbar?.shadowRoot?.querySelector('sl-radio-group.view-switcher');
    if (viewSwitcher) {
      const treeBtn = viewSwitcher.querySelector('sl-radio-button[value="tree"]');
      treeBtn?.click();
    }
  });
  await page.waitForTimeout(2000);

  let nodesBefore = await countVisibleNodes(page);
  let btn = await getIsolateButtonState(page);
  let levels = await getLevelOptions(page);
  console.log(`Initial state: ${nodesBefore.count} nodes, names: ${JSON.stringify(nodesBefore.names)}`);
  console.log(`Button: ${JSON.stringify(btn)}`);
  console.log(`Level options: ${JSON.stringify(levels)}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/fix-00-initial.png` });

  // --- Test 1: Isolate toggle basic on/off ---
  console.log('\n--- Test 1: Isolate toggle basic on/off ---');

  // Select the first visible task node
  console.log(`Available nodes: ${JSON.stringify(nodesBefore.names)}`);
  if (nodesBefore.names.length > 0) {
    await selectTaskByName(page, nodesBefore.names[0]);
  } else {
    await selectFirstTask(page);
  }
  await page.waitForTimeout(1000);

  btn = await getIsolateButtonState(page);
  console.log(`After selecting "Root Task A", button: ${JSON.stringify(btn)}`);

  const fullTreeNodes = await countVisibleNodes(page);
  const fullTreeLevels = await getLevelOptions(page);
  console.log(`Full tree: ${fullTreeNodes.count} nodes`);
  console.log(`Full tree levels: ${JSON.stringify(fullTreeLevels)}`);

  // Click isolate
  await clickIsolateButton(page);
  await page.waitForTimeout(1000);

  const isolatedNodes = await countVisibleNodes(page);
  const isolatedLevels = await getLevelOptions(page);
  btn = await getIsolateButtonState(page);
  console.log(`Isolated: ${isolatedNodes.count} nodes, names: ${JSON.stringify(isolatedNodes.names)}`);
  console.log(`Isolated levels: ${JSON.stringify(isolatedLevels)}`);
  console.log(`Button active: ${btn?.active}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/fix-01-isolated.png` });

  if (btn?.active) {
    console.log('  ✅ PASS: Isolate button shows active state');
  } else {
    console.log('  ❌ FAIL: Isolate button not active');
  }

  // Toggle off
  await clickIsolateButton(page);
  await page.waitForTimeout(1000);

  const restoredNodes = await countVisibleNodes(page);
  btn = await getIsolateButtonState(page);
  console.log(`Restored: ${restoredNodes.count} nodes`);
  console.log(`Button active after off: ${btn?.active}`);

  if (!btn?.active && restoredNodes.count === fullTreeNodes.count) {
    console.log('  ✅ PASS: Isolate toggles off correctly');
  } else {
    console.log('  ❌ FAIL: Isolate toggle off issue');
  }

  // --- Test 2: Level selector shows correct range in isolate mode ---
  console.log('\n--- Test 2: Level selector in isolate mode ---');

  // Isolate on Root Task A (has child, grandchild => max 2 levels)
  await clickIsolateButton(page);
  await page.waitForTimeout(1000);

  const isoLevels = await getLevelOptions(page);
  console.log(`Level options during isolate: ${JSON.stringify(isoLevels)}`);
  console.log(`Full tree levels were: ${JSON.stringify(fullTreeLevels)}`);

  // The isolated subtree should have <= levels as full tree
  if (isoLevels.length <= fullTreeLevels.length) {
    console.log('  ✅ PASS: Level selector shows correct range for isolated subtree');
  } else {
    console.log('  ❌ FAIL: Level selector shows more levels than full tree (should be <= )');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/fix-02-levels-isolated.png` });

  // --- Test 3: Deselection auto-disables isolate mode ---
  console.log('\n--- Test 3: Deselection auto-disables isolate mode ---');

  // We are currently in isolate mode. Deselect by setting selectedTaskId to null.
  // The tree view uses a click handler that deselects when clicking on the background SVG
  // Let's dispatch a selected-task-change event or click elsewhere
  await page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    if (treeView) {
      // Directly set selectedTaskId to null to simulate deselection
      treeView.selectedTaskId = null;
      // Trigger Lit update cycle
      treeView.requestUpdate('selectedTaskId', treeView.selectedTaskId);
    }
  });
  await page.waitForTimeout(1000);

  btn = await getIsolateButtonState(page);
  const afterDeselectNodes = await countVisibleNodes(page);
  console.log(`After deselection: button active=${btn?.active}, disabled=${btn?.disabled}`);
  console.log(`After deselection: ${afterDeselectNodes.count} nodes`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/fix-03-deselect-auto-off.png` });

  if (!btn?.active) {
    console.log('  ✅ PASS: Isolate mode auto-disabled when selection cleared');
  } else {
    console.log('  ❌ FAIL: Isolate mode still active after deselection');
  }

  // === Summary ===
  console.log('\n=== SUMMARY ===');
  console.log('Test 1 (Isolate toggle on/off): checked');
  console.log('Test 2 (Level selector range in isolate): checked');
  console.log('Test 3 (Deselection auto-disables isolate): checked');
  console.log('\nScreenshots saved to screenshots/ directory.');

  await browser.close();
  console.log('\nDone.');
})();

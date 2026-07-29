/**
 * Playwright verification script for Feature 61: Isolate/Solo Mode
 *
 * Tests:
 *   (a) Full tree with mid-hierarchy node selected, isolate OFF
 *   (b) Same node with isolate ON — only descendants visible
 *   (c) Toggle isolate OFF — full tree restored
 *   (d) Isolate survives a poll tick (wait >15s)
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:9090';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';
const SCREENSHOT_DIR = 'screenshots';

async function countVisibleNodes(page) {
  // Count ft-tree-node elements inside the SVG foreignObjects
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

async function clickIsolateButton(page) {
  await page.evaluate(() => {
    const treeView = document.querySelector('ft-app')
      ?.shadowRoot?.querySelector('ft-tree-view');
    const nav = treeView?.shadowRoot?.querySelector('ft-hierarchy-nav');
    const btn = nav?.shadowRoot?.querySelector('.isolate-btn');
    btn?.click();
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
        // Find the parent foreignObject and click it
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

  console.log('=== Feature 61: Isolate Mode Verification ===\n');

  // Navigate and wait for app to load
  await page.goto(BASE, { waitUntil: 'networkidle' });
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

  // === Test (a): Full tree, select "Epic: User Authentication" ===
  console.log('\n--- Test (a): Full tree, isolate OFF, select mid-hierarchy node ---');

  // Select "Epic: User Authentication" which has 3 children and 2 grandchildren
  await selectTaskByName(page, 'Epic: User Auth');
  await page.waitForTimeout(1500);

  let nodeInfo = await countVisibleNodes(page);
  let btnState = await getIsolateButtonState(page);
  console.log(`  Visible nodes: ${nodeInfo.count}`);
  console.log(`  Node names: ${JSON.stringify(nodeInfo.names)}`);
  console.log(`  Isolate button: ${JSON.stringify(btnState)}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/a-full-tree-selected.png`, fullPage: false });
  console.log(`  Screenshot: ${SCREENSHOT_DIR}/a-full-tree-selected.png`);

  const fullTreeCount = nodeInfo.count;

  // === Test (b): Toggle isolate ON ===
  console.log('\n--- Test (b): Isolate ON — should show only selected node + descendants ---');

  await clickIsolateButton(page);
  await page.waitForTimeout(1500);

  nodeInfo = await countVisibleNodes(page);
  btnState = await getIsolateButtonState(page);
  console.log(`  Visible nodes: ${nodeInfo.count}`);
  console.log(`  Node names: ${JSON.stringify(nodeInfo.names)}`);
  console.log(`  Isolate button active: ${btnState?.active}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/b-isolate-on.png`, fullPage: false });
  console.log(`  Screenshot: ${SCREENSHOT_DIR}/b-isolate-on.png`);

  const isolatedCount = nodeInfo.count;

  // Verify isolated count is less than full tree
  if (isolatedCount < fullTreeCount) {
    console.log(`  ✅ PASS: Isolated count (${isolatedCount}) < full tree count (${fullTreeCount})`);
  } else {
    console.log(`  ❌ FAIL: Isolated count (${isolatedCount}) should be < full tree count (${fullTreeCount})`);
  }

  // === Test (c): Toggle isolate OFF — full tree restored ===
  console.log('\n--- Test (c): Isolate OFF — full tree should be restored ---');

  await clickIsolateButton(page);
  await page.waitForTimeout(1500);

  nodeInfo = await countVisibleNodes(page);
  btnState = await getIsolateButtonState(page);
  console.log(`  Visible nodes: ${nodeInfo.count}`);
  console.log(`  Node names: ${JSON.stringify(nodeInfo.names)}`);
  console.log(`  Isolate button active: ${btnState?.active}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/c-isolate-off.png`, fullPage: false });
  console.log(`  Screenshot: ${SCREENSHOT_DIR}/c-isolate-off.png`);

  if (nodeInfo.count === fullTreeCount) {
    console.log(`  ✅ PASS: Full tree restored (${nodeInfo.count} nodes)`);
  } else {
    console.log(`  ❌ FAIL: Expected ${fullTreeCount} nodes, got ${nodeInfo.count}`);
  }

  // === Test (d): Isolate survives poll tick ===
  console.log('\n--- Test (d): Isolate survives poll tick (waiting 18s) ---');

  // Turn isolate on again
  await clickIsolateButton(page);
  await page.waitForTimeout(1500);

  const beforePollInfo = await countVisibleNodes(page);
  console.log(`  Before poll wait: ${beforePollInfo.count} nodes`);
  console.log(`  Before poll names: ${JSON.stringify(beforePollInfo.names)}`);

  // Wait >15s for poll tick
  console.log('  Waiting 18 seconds for poll tick...');
  await page.waitForTimeout(18000);

  const afterPollInfo = await countVisibleNodes(page);
  const afterPollBtn = await getIsolateButtonState(page);
  console.log(`  After poll wait: ${afterPollInfo.count} nodes`);
  console.log(`  After poll names: ${JSON.stringify(afterPollInfo.names)}`);
  console.log(`  Isolate button still active: ${afterPollBtn?.active}`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/d-isolate-survives-poll.png`, fullPage: false });
  console.log(`  Screenshot: ${SCREENSHOT_DIR}/d-isolate-survives-poll.png`);

  if (afterPollInfo.count === beforePollInfo.count && afterPollBtn?.active) {
    console.log(`  ✅ PASS: Isolate mode survived poll tick (${afterPollInfo.count} nodes, button still active)`);
  } else {
    console.log(`  ❌ FAIL: Isolate mode did not survive poll tick`);
  }

  // === Summary ===
  console.log('\n=== SUMMARY ===');
  console.log(`Full tree node count:       ${fullTreeCount}`);
  console.log(`Isolated node count:        ${isolatedCount}`);
  console.log(`Restored tree node count:   ${nodeInfo.count}`);
  console.log(`Post-poll isolated count:   ${afterPollInfo.count}`);
  console.log(`Post-poll button active:    ${afterPollBtn?.active}`);
  console.log('');
  console.log(`Test (a) Full tree + selection:    ${fullTreeCount} nodes - DONE`);
  console.log(`Test (b) Isolate ON:               ${isolatedCount} nodes - ${isolatedCount < fullTreeCount ? 'PASS' : 'FAIL'}`);
  console.log(`Test (c) Isolate OFF restores:     ${nodeInfo.count} nodes - ${nodeInfo.count === fullTreeCount ? 'PASS' : 'FAIL'}`);
  console.log(`Test (d) Survives poll tick:        ${afterPollInfo.count} nodes, active=${afterPollBtn?.active} - ${afterPollInfo.count === beforePollInfo.count && afterPollBtn?.active ? 'PASS' : 'FAIL'}`);

  await browser.close();
  console.log('\nDone.');
})();

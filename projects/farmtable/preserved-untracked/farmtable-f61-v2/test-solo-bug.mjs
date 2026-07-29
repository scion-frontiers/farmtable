// test-solo-bug.mjs — Reproduce the un-solo bug
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Switch to Tree view
const treeButton = page.locator('sl-tab[panel="tree"]');
await treeButton.click();
await page.waitForTimeout(2000);

// Screenshot 1: Full tree view
await page.screenshot({ path: 'screenshots/01-full-tree.png', fullPage: false });

// Count nodes in the full tree
const fullNodeCount = await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  if (!treeView) return -1;
  const svgNodes = treeView.shadowRoot?.querySelectorAll('foreignObject');
  return svgNodes?.length ?? -1;
});
console.log(`Step 1: Full tree node count: ${fullNodeCount}`);

// Click a mid-level task to select it (e.g., "Backend API" which has children)
// Find a node with text "Backend API"
const nodeText = await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  if (!treeView) return [];
  const nodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node');
  const names = [];
  if (nodes) {
    for (const n of nodes) {
      const name = n.shadowRoot?.querySelector('.task-name')?.textContent?.trim();
      names.push(name || 'unnamed');
    }
  }
  return names;
});
console.log(`Tree nodes found: ${nodeText.join(', ')}`);

// Click the "Backend API" node (2nd node typically) to select it
await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  if (!treeView) return;
  const nodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node');
  if (!nodes) return;
  for (const node of nodes) {
    const name = node.shadowRoot?.querySelector('.task-name')?.textContent?.trim();
    if (name === 'Backend API') {
      // Click the foreignObject parent to trigger task-select
      const fo = node.closest('foreignObject');
      if (fo) fo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      break;
    }
  }
});
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/02-selected-backend.png', fullPage: false });

// Click Solo button to enter Solo mode
await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  if (!treeView) return;
  const nav = treeView.shadowRoot?.querySelector('ft-hierarchy-nav');
  if (!nav) return;
  const soloBtn = nav.shadowRoot?.querySelector('.isolate-btn');
  if (soloBtn) soloBtn.click();
});
await page.waitForTimeout(1500);

// Screenshot 3: Solo mode ON
await page.screenshot({ path: 'screenshots/03-solo-on.png', fullPage: false });
const soloNodeCount = await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  if (!treeView) return -1;
  const svgNodes = treeView.shadowRoot?.querySelectorAll('foreignObject');
  return svgNodes?.length ?? -1;
});
console.log(`Step 2: Solo ON node count: ${soloNodeCount}`);

// Now toggle Solo OFF — this is where the bug should appear
await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  if (!treeView) return;
  const nav = treeView.shadowRoot?.querySelector('ft-hierarchy-nav');
  if (!nav) return;
  const soloBtn = nav.shadowRoot?.querySelector('.isolate-btn');
  if (soloBtn) soloBtn.click();
});
await page.waitForTimeout(1500);

// Screenshot 4: Solo mode OFF — should show full tree
await page.screenshot({ path: 'screenshots/04-solo-off.png', fullPage: false });
const afterOffNodeCount = await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  if (!treeView) return -1;
  const svgNodes = treeView.shadowRoot?.querySelectorAll('foreignObject');
  return svgNodes?.length ?? -1;
});
console.log(`Step 3: Solo OFF node count: ${afterOffNodeCount}`);

// Check isolateMode state
const isolateState = await page.evaluate(() => {
  const treeView = document.querySelector('ft-tree-view');
  return treeView?.isolateMode ?? 'undefined';
});
console.log(`isolateMode after toggle off: ${isolateState}`);

console.log('\n--- SUMMARY ---');
console.log(`Full tree:  ${fullNodeCount} nodes`);
console.log(`Solo ON:    ${soloNodeCount} nodes`);
console.log(`Solo OFF:   ${afterOffNodeCount} nodes`);
console.log(`Bug present: ${afterOffNodeCount !== fullNodeCount ? 'YES — Solo OFF count does not match Full tree count' : 'NO — counts match'}`);

await browser.close();

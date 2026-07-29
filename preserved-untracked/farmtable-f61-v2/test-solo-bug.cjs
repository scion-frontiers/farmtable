// test-solo-bug.cjs — Reproduce the un-solo bug
const { chromium } = require('playwright');

const TOKEN = 'ft_17fab390be4b2b0a4e3f720059564f5931c45f99926592941b49e7fa7128493b';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Set token in localStorage before navigating
  await page.goto('http://localhost:9090', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);

  // Navigate to tree view with collection ID
  await page.goto('http://localhost:9090?collection=d53b0f6f-4e81-43ae-b38e-9949cd1dfd77&view=tree', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Screenshot 1: Full tree view
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/01-full-tree.png', fullPage: false });

  // Count nodes in full tree
  const fullTreeInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { count: -1, error: 'no ft-app' };
    const treeView = app.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return { count: -1, error: 'no ft-tree-view', tags: [...app.shadowRoot.querySelectorAll('*')].map(e => e.tagName.toLowerCase()).slice(0, 20) };
    const svgNodes = treeView.shadowRoot?.querySelectorAll('foreignObject');
    const nodeNames = [];
    const treeNodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node');
    if (treeNodes) {
      for (const n of treeNodes) {
        nodeNames.push(n.shadowRoot?.querySelector('.task-name')?.textContent?.trim() || 'unnamed');
      }
    }
    return { count: svgNodes?.length ?? -1, names: nodeNames };
  });
  console.log(`Step 1: Full tree - ${fullTreeInfo.count} nodes: ${(fullTreeInfo.names || []).join(', ')}`);
  if (fullTreeInfo.error) console.log('Error:', fullTreeInfo.error, fullTreeInfo.tags);

  // Click "Backend API" node to select it
  const clicked = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return 'no tree view';
    const nodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node');
    if (!nodes || nodes.length === 0) return 'no tree nodes';
    // Click the 2nd node (Backend API should be child of Root Project)
    for (const node of nodes) {
      const name = node.shadowRoot?.querySelector('.task-name')?.textContent?.trim();
      if (name === 'Backend API') {
        const fo = node.closest('foreignObject');
        if (fo) {
          fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
          return `clicked: ${name}`;
        }
      }
    }
    // If not found by name, click the second node
    if (nodes.length >= 2) {
      const fo = nodes[1].closest('foreignObject');
      if (fo) {
        const name = nodes[1].shadowRoot?.querySelector('.task-name')?.textContent?.trim();
        fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        return `clicked second node: ${name}`;
      }
    }
    return 'could not find appropriate node';
  });
  console.log(`Selection: ${clicked}`);
  await page.waitForTimeout(1500);

  // Check that selection worked
  const selState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    return {
      selectedTaskId: treeView?.selectedTaskId,
      isolateMode: treeView?.isolateMode,
    };
  });
  console.log('After selection:', JSON.stringify(selState));

  // Click Solo button
  const soloClicked = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return 'no tree view';
    const nav = treeView.shadowRoot?.querySelector('ft-hierarchy-nav');
    if (!nav) return 'no nav';
    const soloBtn = nav.shadowRoot?.querySelector('.isolate-btn');
    if (!soloBtn) return 'no solo button';
    if (soloBtn.disabled) return 'solo button is disabled';
    soloBtn.click();
    return 'clicked solo';
  });
  console.log(`Solo click: ${soloClicked}`);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/03-solo-on.png', fullPage: false });

  const soloState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return { error: 'no tree view' };
    const svgNodes = treeView.shadowRoot?.querySelectorAll('foreignObject');
    const nodeNames = [];
    const treeNodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node');
    if (treeNodes) {
      for (const n of treeNodes) {
        nodeNames.push(n.shadowRoot?.querySelector('.task-name')?.textContent?.trim() || 'unnamed');
      }
    }
    return {
      count: svgNodes?.length ?? -1,
      names: nodeNames,
      isolateMode: treeView.isolateMode,
    };
  });
  console.log(`Step 2: Solo ON - ${soloState.count} nodes: ${(soloState.names || []).join(', ')}`);
  console.log(`  isolateMode: ${soloState.isolateMode}`);

  // Toggle Solo OFF
  const offClicked = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return 'no tree view';
    const nav = treeView.shadowRoot?.querySelector('ft-hierarchy-nav');
    if (!nav) return 'no nav';
    const soloBtn = nav.shadowRoot?.querySelector('.isolate-btn');
    if (!soloBtn) return 'no solo button';
    soloBtn.click();
    return 'clicked solo off';
  });
  console.log(`Solo off click: ${offClicked}`);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/04-solo-off.png', fullPage: false });

  const afterOff = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return { error: 'no tree view' };
    const svgNodes = treeView.shadowRoot?.querySelectorAll('foreignObject');
    const nodeNames = [];
    const treeNodes = treeView.shadowRoot?.querySelectorAll('ft-tree-node');
    if (treeNodes) {
      for (const n of treeNodes) {
        nodeNames.push(n.shadowRoot?.querySelector('.task-name')?.textContent?.trim() || 'unnamed');
      }
    }
    return {
      count: svgNodes?.length ?? -1,
      names: nodeNames,
      isolateMode: treeView.isolateMode,
      focusRootId: treeView.focusRootId,
      selectedTaskId: treeView.selectedTaskId,
      layoutNodeCount: treeView.layoutNodes?.length,
    };
  });
  console.log(`Step 3: Solo OFF - ${afterOff.count} nodes: ${(afterOff.names || []).join(', ')}`);
  console.log(`  state:`, JSON.stringify({
    isolateMode: afterOff.isolateMode,
    focusRootId: afterOff.focusRootId,
    selectedTaskId: afterOff.selectedTaskId,
    layoutNodeCount: afterOff.layoutNodeCount,
  }));

  console.log('\n--- SUMMARY ---');
  console.log(`Full tree:  ${fullTreeInfo.count} nodes`);
  console.log(`Solo ON:    ${soloState.count} nodes`);
  console.log(`Solo OFF:   ${afterOff.count} nodes`);
  if (afterOff.count !== fullTreeInfo.count) {
    console.log(`BUG CONFIRMED: Solo OFF (${afterOff.count}) != Full tree (${fullTreeInfo.count})`);
  } else {
    console.log('No bug detected: counts match');
  }

  await browser.close();
})();

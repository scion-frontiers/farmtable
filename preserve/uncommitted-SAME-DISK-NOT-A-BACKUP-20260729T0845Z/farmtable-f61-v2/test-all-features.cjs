// test-all-features.cjs — Verify all 3 features
const { chromium } = require('playwright');

const TOKEN = 'ft_17fab390be4b2b0a4e3f720059564f5931c45f99926592941b49e7fa7128493b';
const COLLECTION = 'd53b0f6f-4e81-43ae-b38e-9949cd1dfd77';
const PORT = 9091;
const BASE = `http://localhost:${PORT}`;

async function setupPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  return page;
}

function getNodeInfo(root, selector) {
  // Traverse shadow DOM to get node info
  const view = root?.shadowRoot?.querySelector(selector);
  if (!view) return { count: -1, names: [], error: `no ${selector}` };
  const fos = view.shadowRoot?.querySelectorAll('foreignObject');
  const names = [];
  const nodes = view.shadowRoot?.querySelectorAll('ft-tree-node');
  if (nodes) {
    for (const n of nodes) {
      names.push(n.shadowRoot?.querySelector('.title')?.textContent?.trim() || '?');
    }
  }
  return { count: fos?.length ?? -1, names };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });

  // ═══════════════════════════════════════════════════
  // PART 1: Un-solo bug fix verification
  // ═══════════════════════════════════════════════════
  console.log('═══ PART 1: Tree View un-solo bug fix ═══');
  let page = await setupPage(browser);
  await page.goto(`${BASE}?collection=${COLLECTION}&view=tree`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const p1_full = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    return app?.shadowRoot?.querySelector('ft-tree-view')?.shadowRoot?.querySelectorAll('foreignObject')?.length ?? -1;
  });
  console.log(`  Full tree: ${p1_full} nodes`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p1-01-full.png' });

  // Select node by index (click foreignObject directly)
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    const fos = tv?.shadowRoot?.querySelectorAll('foreignObject');
    if (fos && fos.length >= 2) fos[1].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  });
  await page.waitForTimeout(1000);

  // Solo ON
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    tv?.shadowRoot?.querySelector('ft-hierarchy-nav')?.shadowRoot?.querySelector('.isolate-btn')?.click();
  });
  await page.waitForTimeout(1500);
  const p1_solo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    return app?.shadowRoot?.querySelector('ft-tree-view')?.shadowRoot?.querySelectorAll('foreignObject')?.length ?? -1;
  });
  console.log(`  Solo ON: ${p1_solo} nodes`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p1-02-solo-on.png' });

  // Solo OFF
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    tv?.shadowRoot?.querySelector('ft-hierarchy-nav')?.shadowRoot?.querySelector('.isolate-btn')?.click();
  });
  await page.waitForTimeout(2000);
  const p1_off = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    return app?.shadowRoot?.querySelector('ft-tree-view')?.shadowRoot?.querySelectorAll('foreignObject')?.length ?? -1;
  });
  console.log(`  Solo OFF: ${p1_off} nodes`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p1-03-solo-off.png' });
  console.log(`  RESULT: ${p1_off === p1_full ? 'PASS ✓' : 'FAIL ✗'} (${p1_full} → ${p1_solo} → ${p1_off})`);
  await page.close();

  // ═══════════════════════════════════════════════════
  // PART 2: Dependency View Solo mode
  // ═══════════════════════════════════════════════════
  console.log('\n═══ PART 2: Dependency View Solo mode ═══');
  page = await setupPage(browser);
  await page.goto(`${BASE}?collection=${COLLECTION}&view=dependencies`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p2-01-full-dep.png' });

  const p2_full = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!dv) return { count: -1, error: 'no dep view' };
    const fos = dv.shadowRoot?.querySelectorAll('foreignObject');
    const names = [];
    const nodes = dv.shadowRoot?.querySelectorAll('ft-tree-node');
    if (nodes) for (const n of nodes) names.push(n.shadowRoot?.querySelector('.title')?.textContent?.trim() || '?');
    return { count: fos?.length ?? -1, names };
  });
  console.log(`  Full dep graph: ${p2_full.count} nodes: ${(p2_full.names || []).join(', ')}`);

  // Check Solo button exists
  const hasSoloBtn = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    return !!dv?.shadowRoot?.querySelector('.isolate-btn');
  });
  console.log(`  Solo button present: ${hasSoloBtn}`);

  // Select a mid-graph node (use index-based click on foreignObject)
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    const fos = dv?.shadowRoot?.querySelectorAll('foreignObject');
    // Try to select a node that's not at an edge (index 1 or 2 for better connectivity)
    if (fos && fos.length >= 2) {
      fos[1].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    }
  });
  await page.waitForTimeout(1000);

  const selState = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    return { selectedTaskId: dv?.selectedTaskId, isolateMode: dv?.isolateMode };
  });
  console.log(`  After selection: selectedTaskId=${selState.selectedTaskId}, isolateMode=${selState.isolateMode}`);

  // Solo ON
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    const btn = dv?.shadowRoot?.querySelector('.isolate-btn');
    if (btn && !btn.disabled) btn.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p2-02-solo-on.png' });

  const p2_solo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!dv) return { count: -1 };
    const fos = dv.shadowRoot?.querySelectorAll('foreignObject');
    const names = [];
    const nodes = dv.shadowRoot?.querySelectorAll('ft-tree-node');
    if (nodes) for (const n of nodes) names.push(n.shadowRoot?.querySelector('.title')?.textContent?.trim() || '?');
    return { count: fos?.length ?? -1, names, isolateMode: dv.isolateMode };
  });
  console.log(`  Solo ON: ${p2_solo.count} nodes: ${(p2_solo.names || []).join(', ')} (isolateMode=${p2_solo.isolateMode})`);

  // Wait for poll tick
  console.log('  Waiting 12s for poll tick...');
  await page.waitForTimeout(12000);
  const p2_afterPoll = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    return dv?.shadowRoot?.querySelectorAll('foreignObject')?.length ?? -1;
  });
  console.log(`  After poll: ${p2_afterPoll} nodes (stable=${p2_afterPoll === p2_solo.count})`);

  // Solo OFF
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    dv?.shadowRoot?.querySelector('.isolate-btn')?.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p2-03-solo-off.png' });

  const p2_off = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    return { count: dv?.shadowRoot?.querySelectorAll('foreignObject')?.length ?? -1, isolateMode: dv?.isolateMode };
  });
  console.log(`  Solo OFF: ${p2_off.count} nodes (isolateMode=${p2_off.isolateMode})`);
  console.log(`  RESULT: ${p2_off.count === p2_full.count ? 'PASS ✓' : 'FAIL ✗'} (${p2_full.count} → ${p2_solo.count} → ${p2_off.count})`);
  await page.close();

  // ═══════════════════════════════════════════════════
  // PART 3: Edge color-coding
  // ═══════════════════════════════════════════════════
  console.log('\n═══ PART 3: Edge color-coding ═══');
  page = await setupPage(browser);
  await page.goto(`${BASE}?collection=${COLLECTION}&view=dependencies`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // (a) With Solo OFF — select a node
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    const fos = dv?.shadowRoot?.querySelectorAll('foreignObject');
    if (fos && fos.length >= 2) fos[1].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  });
  await page.waitForTimeout(1500);

  const p3a = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!dv) return {};
    const paths = dv.shadowRoot?.querySelectorAll('path');
    const classes = [];
    if (paths) for (const p of paths) classes.push(p.getAttribute('class'));
    return {
      selectedTaskId: dv.selectedTaskId,
      isolateMode: dv.isolateMode,
      totalEdges: classes.length,
      blocking: classes.filter(c => c?.includes('edge-blocking')).length,
      blocked: classes.filter(c => c?.includes('edge-blocked')).length,
      neutral: classes.filter(c => c === 'edge-dependency').length,
    };
  });
  console.log(`  (a) Solo OFF, node selected: ${p3a.selectedTaskId}`);
  console.log(`     Edges: ${p3a.totalEdges} total, ${p3a.blocking} blocking (red-orange), ${p3a.blocked} blocked (blue-purple), ${p3a.neutral} neutral`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p3-01-colors-solo-off.png' });

  // (b) With Solo ON — same node
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    const btn = dv?.shadowRoot?.querySelector('.isolate-btn');
    if (btn && !btn.disabled) btn.click();
  });
  await page.waitForTimeout(2000);

  const p3b = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!dv) return {};
    const paths = dv.shadowRoot?.querySelectorAll('path');
    const classes = [];
    if (paths) for (const p of paths) classes.push(p.getAttribute('class'));
    return {
      isolateMode: dv.isolateMode,
      totalEdges: classes.length,
      blocking: classes.filter(c => c?.includes('edge-blocking')).length,
      blocked: classes.filter(c => c?.includes('edge-blocked')).length,
      neutral: classes.filter(c => c === 'edge-dependency').length,
    };
  });
  console.log(`  (b) Solo ON:`);
  console.log(`     Edges: ${p3b.totalEdges} total, ${p3b.blocking} blocking, ${p3b.blocked} blocked, ${p3b.neutral} neutral`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p3-02-colors-solo-on.png' });

  // (c) Tree View NOT affected
  await page.close();
  page = await setupPage(browser);
  await page.goto(`${BASE}?collection=${COLLECTION}&view=tree`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    const fos = tv?.shadowRoot?.querySelectorAll('foreignObject');
    if (fos && fos.length >= 2) fos[1].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  });
  await page.waitForTimeout(1000);

  const p3c = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!tv) return {};
    const paths = tv.shadowRoot?.querySelectorAll('path');
    const classes = [];
    if (paths) for (const p of paths) classes.push(p.getAttribute('class'));
    return {
      edgeCount: classes.length,
      hasColoredEdges: classes.some(c => c?.includes('edge-blocking') || c?.includes('edge-blocked')),
      uniqueClasses: [...new Set(classes)],
    };
  });
  console.log(`  (c) Tree View: ${p3c.edgeCount} edges, colored=${p3c.hasColoredEdges}, classes=${JSON.stringify(p3c.uniqueClasses)}`);
  console.log(`  Tree View NOT affected: ${!p3c.hasColoredEdges ? 'PASS ✓' : 'FAIL ✗'}`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p3-03-tree-no-colors.png' });

  await page.close();
  await browser.close();

  console.log('\n═══ FINAL SUMMARY ═══');
  console.log(`Part 1 (Un-solo fix):  Full=${p1_full} → Solo=${p1_solo} → Off=${p1_off} ${p1_off === p1_full ? '✓' : '✗'}`);
  console.log(`Part 2 (Dep Solo):     Full=${p2_full.count} → Solo=${p2_solo.count} → Off=${p2_off.count} ${p2_off.count === p2_full.count ? '✓' : '✗'}`);
  console.log(`Part 2 (Poll stable):  ${p2_afterPoll === p2_solo.count ? '✓' : '✗'}`);
  console.log(`Part 3 (Colors OFF):   blocking=${p3a.blocking} blocked=${p3a.blocked} ${(p3a.blocking > 0 || p3a.blocked > 0) ? '✓' : '⚠ no colored edges'}`);
  console.log(`Part 3 (Colors ON):    blocking=${p3b.blocking} blocked=${p3b.blocked} ${(p3b.blocking > 0 || p3b.blocked > 0) ? '✓' : '⚠ no colored edges'}`);
  console.log(`Part 3 (Tree safe):    ${!p3c.hasColoredEdges ? '✓' : '✗'}`);
})();

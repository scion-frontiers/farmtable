// test-solo-scenarios.cjs — Test various un-solo scenarios including poll interaction
const { chromium } = require('playwright');

const TOKEN = 'ft_17fab390be4b2b0a4e3f720059564f5931c45f99926592941b49e7fa7128493b';
const COLLECTION = 'd53b0f6f-4e81-43ae-b38e-9949cd1dfd77';
const BASE_URL = `http://localhost:9090?collection=${COLLECTION}&view=tree`;

async function getNodeCount(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!tv) return -1;
    return tv.shadowRoot?.querySelectorAll('foreignObject')?.length ?? -1;
  });
}

async function getState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!tv) return {};
    return {
      isolateMode: tv.isolateMode,
      selectedTaskId: tv.selectedTaskId,
      focusRootId: tv.focusRootId,
      layoutNodeCount: tv.layoutNodes?.length,
      nodeCount: tv.shadowRoot?.querySelectorAll('foreignObject')?.length,
    };
  });
}

async function clickNode(page, index) {
  return page.evaluate((idx) => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!tv) return 'no tree view';
    const nodes = tv.shadowRoot?.querySelectorAll('ft-tree-node');
    if (!nodes || nodes.length <= idx) return `only ${nodes?.length} nodes`;
    const fo = nodes[idx].closest('foreignObject');
    if (fo) {
      fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      return `clicked node ${idx}`;
    }
    return 'no foreignObject';
  }, index);
}

async function clickSolo(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!tv) return 'no tree view';
    const nav = tv.shadowRoot?.querySelector('ft-hierarchy-nav');
    if (!nav) return 'no nav';
    const btn = nav.shadowRoot?.querySelector('.isolate-btn');
    if (!btn) return 'no button';
    if (btn.disabled) return 'disabled';
    btn.click();
    return 'clicked';
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });

  // ═══════════════════════════════════════════════════
  // Scenario 1: Simple toggle on/off (baseline)
  // ═══════════════════════════════════════════════════
  console.log('=== Scenario 1: Simple toggle on/off ===');
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:9090', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const s1_full = await getNodeCount(page);
  console.log(`  Full: ${s1_full}`);
  await clickNode(page, 1); // Select Backend API
  await page.waitForTimeout(500);
  await clickSolo(page); // Solo ON
  await page.waitForTimeout(1500);
  const s1_on = await getNodeCount(page);
  console.log(`  Solo ON: ${s1_on}`);
  await clickSolo(page); // Solo OFF
  await page.waitForTimeout(1500);
  const s1_off = await getNodeCount(page);
  console.log(`  Solo OFF: ${s1_off}`);
  console.log(`  Result: ${s1_off === s1_full ? 'PASS' : 'FAIL'}`);
  await page.close();

  // ═══════════════════════════════════════════════════
  // Scenario 2: Solo on, then CHANGE SELECTION while in solo, then toggle off
  // ═══════════════════════════════════════════════════
  console.log('\n=== Scenario 2: Change selection while in solo, then toggle off ===');
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:9090', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const s2_full = await getNodeCount(page);
  console.log(`  Full: ${s2_full}`);
  await clickNode(page, 1); // Select Backend API
  await page.waitForTimeout(500);
  await clickSolo(page); // Solo ON
  await page.waitForTimeout(1500);
  const s2_on = await getNodeCount(page);
  console.log(`  Solo ON (Backend API): ${s2_on} nodes`);

  // Now click a DIFFERENT node while in solo mode
  await clickNode(page, 0); // Click the first node visible in solo (the root of solo subtree)
  await page.waitForTimeout(1500);
  let s2_state = await getState(page);
  console.log(`  After click in solo: isolateMode=${s2_state.isolateMode}, nodeCount=${s2_state.nodeCount}`);

  // Toggle solo OFF
  await clickSolo(page);
  await page.waitForTimeout(2000);
  const s2_off = await getNodeCount(page);
  console.log(`  Solo OFF: ${s2_off}`);
  console.log(`  Result: ${s2_off === s2_full ? 'PASS' : 'FAIL'}`);
  await page.close();

  // ═══════════════════════════════════════════════════
  // Scenario 3: Solo on, wait for poll tick, then toggle off
  // ═══════════════════════════════════════════════════
  console.log('\n=== Scenario 3: Solo on, wait for poll tick, then toggle off ===');
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:9090', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const s3_full = await getNodeCount(page);
  console.log(`  Full: ${s3_full}`);
  await clickNode(page, 1);
  await page.waitForTimeout(500);
  await clickSolo(page);
  await page.waitForTimeout(1500);
  const s3_on = await getNodeCount(page);
  console.log(`  Solo ON: ${s3_on}`);

  // Wait for a poll tick (~10 seconds default)
  console.log('  Waiting 12s for poll tick...');
  await page.waitForTimeout(12000);
  const s3_afterPoll = await getNodeCount(page);
  console.log(`  After poll: ${s3_afterPoll}`);

  // Now toggle off
  await clickSolo(page);
  await page.waitForTimeout(2000);
  const s3_off = await getNodeCount(page);
  console.log(`  Solo OFF: ${s3_off}`);
  console.log(`  Result: ${s3_off === s3_full ? 'PASS' : 'FAIL'}`);
  await page.close();

  // ═══════════════════════════════════════════════════
  // Scenario 4: Solo on, then rapid double-click toggle off (race condition?)
  // ═══════════════════════════════════════════════════
  console.log('\n=== Scenario 4: Rapid double-click solo off ===');
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:9090', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const s4_full = await getNodeCount(page);
  console.log(`  Full: ${s4_full}`);
  await clickNode(page, 1);
  await page.waitForTimeout(500);
  await clickSolo(page); // Solo ON
  await page.waitForTimeout(1500);
  const s4_on = await getNodeCount(page);
  console.log(`  Solo ON: ${s4_on}`);

  // Rapid double-click (off then on again)
  await clickSolo(page); // OFF
  await page.waitForTimeout(100);
  await clickSolo(page); // ON again
  await page.waitForTimeout(100);
  await clickSolo(page); // OFF again
  await page.waitForTimeout(2000);

  const s4_off = await getNodeCount(page);
  const s4_state = await getState(page);
  console.log(`  After rapid toggles: ${s4_off} nodes, isolateMode=${s4_state.isolateMode}`);
  console.log(`  Result: ${s4_off === s4_full && !s4_state.isolateMode ? 'PASS' : 'FAIL'}`);
  await page.close();

  // ═══════════════════════════════════════════════════
  // Scenario 5: Solo on task with no children (leaf node)
  // ═══════════════════════════════════════════════════
  console.log('\n=== Scenario 5: Solo on leaf node, toggle off ===');
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:9090', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const s5_full = await getNodeCount(page);
  console.log(`  Full: ${s5_full}`);
  // Click last node (should be a leaf)
  const numNodes = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const tv = app?.shadowRoot?.querySelector('ft-tree-view');
    return tv?.shadowRoot?.querySelectorAll('ft-tree-node')?.length ?? 0;
  });
  await clickNode(page, numNodes - 1);
  await page.waitForTimeout(500);
  await clickSolo(page);
  await page.waitForTimeout(1500);
  const s5_on = await getNodeCount(page);
  console.log(`  Solo ON (leaf): ${s5_on}`);

  await clickSolo(page);
  await page.waitForTimeout(2000);
  const s5_off = await getNodeCount(page);
  console.log(`  Solo OFF: ${s5_off}`);
  console.log(`  Result: ${s5_off === s5_full ? 'PASS' : 'FAIL'}`);
  await page.close();

  await browser.close();
  console.log('\nAll scenarios complete.');
})();

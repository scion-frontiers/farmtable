import { chromium } from 'playwright';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-60-graph-poll-redraw';
const BASE = 'http://localhost:9091';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// ── Step 1: Load dashboard and select a collection ──
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Click the first collection card/link if there's a collection picker
const collectionLink = page.locator('ft-collection-card, .collection-card, a[href*="collection"]').first();
if (await collectionLink.isVisible({ timeout: 2000 }).catch(() => false)) {
  await collectionLink.click();
  await page.waitForTimeout(3000);
}

// ── Step 2: Navigate to dependency view ──
// Use URL param approach
await page.goto(BASE + '?view=dependencies', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Wait for the dependency view SVG to render
await page.waitForSelector('ft-dependency-view', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2000);

// Screenshot A: Dependency view with graph rendered
await page.screenshot({ path: `${EVIDENCE_DIR}/A-dependency-view-initial.png`, fullPage: false });
console.log('Screenshot A captured: dependency view initial state');

// ── Step 3: Get viewport state BEFORE simulated poll ──
const viewportBefore = await page.evaluate(() => {
  const depView = document.querySelector('ft-dependency-view');
  if (!depView) return { error: 'no ft-dependency-view found' };
  return {
    panX: depView.panX,
    panY: depView.panY,
    scale: depView.scale,
    layoutNodeCount: depView.layoutNodes?.length ?? 0,
  };
});
console.log('Viewport BEFORE simulated poll:', JSON.stringify(viewportBefore));

// ── Step 4: Simulate no-op poll with reversed relationship order ──
const pollResult = await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app) return { error: 'no ft-app found' };

  const store = app.taskStore;
  if (!store) return { error: 'no taskStore found' };

  // Get all tasks, reverse their relationships arrays, and re-upsert
  const tasks = store.allTasks;
  let upsertResults = [];
  for (const task of tasks) {
    // Deep clone and reverse relationships
    const clone = JSON.parse(JSON.stringify(task));
    if (clone.relationships && clone.relationships.length > 1) {
      clone.relationships.reverse();
    }
    const changed = store.upsert(clone);
    upsertResults.push({ id: task.id, changed, relCount: clone.relationships?.length ?? 0 });
  }

  // Fire snapshotComplete like poll-manager would (but ONLY if something changed)
  const anyChanged = upsertResults.some(r => r.changed);
  if (anyChanged || store.isLoading) {
    store.snapshotComplete();
  }

  return { upsertResults, anyChanged, snapshotFired: anyChanged || store.isLoading };
});
console.log('Poll simulation result:', JSON.stringify(pollResult));

// Wait for any re-render to settle
await page.waitForTimeout(2000);

// ── Step 5: Get viewport state AFTER simulated poll ──
const viewportAfter = await page.evaluate(() => {
  const depView = document.querySelector('ft-dependency-view');
  if (!depView) return { error: 'no ft-dependency-view found' };
  return {
    panX: depView.panX,
    panY: depView.panY,
    scale: depView.scale,
    layoutNodeCount: depView.layoutNodes?.length ?? 0,
  };
});
console.log('Viewport AFTER simulated poll:', JSON.stringify(viewportAfter));

// Check stability
const stable = viewportBefore.panX === viewportAfter.panX
  && viewportBefore.panY === viewportAfter.panY
  && viewportBefore.scale === viewportAfter.scale;
console.log(`Viewport STABLE across no-op poll: ${stable}`);

// Screenshot B: After simulated poll — should look identical to A
await page.screenshot({ path: `${EVIDENCE_DIR}/B-dependency-view-after-noop-poll.png`, fullPage: false });
console.log('Screenshot B captured: after simulated no-op poll (should match A visually)');

// ── Step 6: Navigate to tree view for regression check ──
await page.goto(BASE + '?view=tree', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.waitForSelector('ft-tree-view', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2000);

// Screenshot C: Tree view regression check
await page.screenshot({ path: `${EVIDENCE_DIR}/C-tree-view-regression.png`, fullPage: false });
console.log('Screenshot C captured: tree view regression check');

// ── Summary ──
console.log('\n=== EVIDENCE SUMMARY ===');
console.log(`Viewport before: panX=${viewportBefore.panX}, panY=${viewportBefore.panY}, scale=${viewportBefore.scale}`);
console.log(`Viewport after:  panX=${viewportAfter.panX}, panY=${viewportAfter.panY}, scale=${viewportAfter.scale}`);
console.log(`Viewport stable: ${stable}`);
console.log(`Poll simulation: anyChanged=${pollResult.anyChanged}, snapshotFired=${pollResult.snapshotFired}`);
console.log(`Screenshot files saved to: ${EVIDENCE_DIR}`);

await browser.close();

// Exit with error if viewport was NOT stable
if (!stable) {
  console.error('FAIL: Viewport changed during no-op poll!');
  process.exit(1);
}

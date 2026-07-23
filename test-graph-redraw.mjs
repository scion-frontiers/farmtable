/**
 * Reproduction test for graph view redraw on poll refresh.
 */
import { chromium } from '/scion-volumes/scratchpad/web-test/node_modules/playwright/index.mjs';

const BASE_URL = 'http://localhost:9090';
const COLLECTION_ID = '8ef64de9-cc3e-47ed-aae2-02e83f26dc5d';

// Helper: get element from ft-app's shadow DOM
const Q = (sel) => `document.querySelector('ft-app')?.shadowRoot?.querySelector('${sel}')`;

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE_URL}?collection=${COLLECTION_ID}&view=tree`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('\n=== TEST 1: snapshotComplete() alone on tree view ===');

  const isTreeVisible = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    return !!app?.shadowRoot?.querySelector('ft-tree-view');
  });
  console.log(`Tree view present: ${isTreeVisible}`);
  if (!isTreeVisible) { console.log('ABORT'); await browser.close(); return; }

  // Select first task
  const taskInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!view?.store) return null;
    const tasks = view.store.allTasks;
    if (tasks.length === 0) return { count: 0 };
    view.dispatchEvent(new CustomEvent('task-select', {
      detail: { taskId: tasks[0].id },
      bubbles: true, composed: true,
    }));
    return { count: tasks.length, id: tasks[0].id, name: tasks[0].name };
  });
  console.log(`Tasks: ${taskInfo?.count}, selected: "${taskInfo?.name}" (${taskInfo?.id})`);
  await page.waitForTimeout(1500); // Wait for zoom animation

  const getViewport = async (sel) => {
    return await page.evaluate((s) => {
      const app = document.querySelector('ft-app');
      const view = app?.shadowRoot?.querySelector(s);
      if (!view) return null;
      return { panX: view.panX, panY: view.panY, scale: view.scale };
    }, sel);
  };
  const fv = (v) => v ? `panX=${v.panX.toFixed(2)}, panY=${v.panY.toFixed(2)}, scale=${v.scale.toFixed(4)}` : 'null';
  const changed = (a, b) => a && b && (
    Math.abs(a.panX - b.panX) > 0.1 ||
    Math.abs(a.panY - b.panY) > 0.1 ||
    Math.abs(a.scale - b.scale) > 0.001
  );

  // --- Test 1: Just snapshotComplete() ---
  const before1 = await getViewport('ft-tree-view');
  console.log(`Before: ${fv(before1)}`);

  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    app?.shadowRoot?.querySelector('ft-tree-view')?.store?.snapshotComplete();
  });
  await page.waitForTimeout(1500);

  const after1 = await getViewport('ft-tree-view');
  console.log(`After:  ${fv(after1)}`);
  console.log(`RESULT: ${changed(before1, after1) ? '❌ VIEWPORT CHANGED' : '✅ Viewport stable'}\n`);

  // --- Test 2: Re-upsert identical data (deep clone) ---
  console.log('=== TEST 2: Re-upsert identical data (deep clone) + snapshotComplete() ===');
  const before2 = await getViewport('ft-tree-view');
  console.log(`Before: ${fv(before2)}`);

  const events2 = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!view?.store) return [];
    const events = [];
    const orig = view.store.dispatchEvent.bind(view.store);
    view.store.dispatchEvent = (e) => { events.push(e.type); return orig(e); };
    for (const task of view.store.allTasks) {
      view.store.upsert(JSON.parse(JSON.stringify(task)));
    }
    view.store.snapshotComplete();
    view.store.dispatchEvent = orig;
    return events;
  });
  console.log(`Events fired: ${JSON.stringify(events2)}`);
  await page.waitForTimeout(1500);

  const after2 = await getViewport('ft-tree-view');
  console.log(`After:  ${fv(after2)}`);
  console.log(`RESULT: ${changed(before2, after2) ? '❌ VIEWPORT CHANGED' : '✅ Viewport stable'}\n`);

  // --- Test 3: Re-upsert with changed updatedAt ---
  console.log('=== TEST 3: Re-upsert with changed updatedAt + snapshotComplete() ===');
  const before3 = await getViewport('ft-tree-view');
  console.log(`Before: ${fv(before3)}`);

  const events3 = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!view?.store) return [];
    const events = [];
    const orig = view.store.dispatchEvent.bind(view.store);
    view.store.dispatchEvent = (e) => { events.push(e.type); return orig(e); };
    for (const task of view.store.allTasks) {
      const clone = JSON.parse(JSON.stringify(task));
      clone.updatedAt = '2099-01-01T00:00:00.000Z';
      view.store.upsert(clone);
    }
    view.store.snapshotComplete();
    view.store.dispatchEvent = orig;
    return events;
  });
  console.log(`Events fired: ${JSON.stringify(events3)}`);
  await page.waitForTimeout(1500);

  const after3 = await getViewport('ft-tree-view');
  console.log(`After:  ${fv(after3)}`);
  console.log(`RESULT: ${changed(before3, after3) ? '❌ VIEWPORT CHANGED' : '✅ Viewport stable'}\n`);

  // --- Test 4: Instrument updated() to see what Lit passes ---
  console.log('=== TEST 4: Trace updated() changedProps after snapshotComplete ===');
  const updatedCalls = await page.evaluate(async () => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!view) return null;
    const results = [];
    const origUpdated = view.updated.bind(view);
    view.updated = function(changedProps) {
      results.push({
        hasSelectedTaskId: changedProps.has('selectedTaskId'),
        changedKeys: [...changedProps.keys()],
        needsCenter: this.needsCenter,
        selectedTaskId: this.selectedTaskId,
      });
      return origUpdated(changedProps);
    };
    // Trigger snapshotComplete
    view.store.snapshotComplete();
    await new Promise(r => setTimeout(r, 200));
    view.updated = origUpdated;
    return results;
  });
  console.log(`updated() calls: ${JSON.stringify(updatedCalls, null, 2)}\n`);

  // --- Test 5: Trace updated() after upsert with changed data ---
  console.log('=== TEST 5: Trace updated() changedProps after upsert+snapshotComplete ===');
  const updatedCalls2 = await page.evaluate(async () => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!view) return null;
    const results = [];
    const origUpdated = view.updated.bind(view);
    view.updated = function(changedProps) {
      results.push({
        hasSelectedTaskId: changedProps.has('selectedTaskId'),
        changedKeys: [...changedProps.keys()],
        needsCenter: this.needsCenter,
        selectedTaskId: this.selectedTaskId,
      });
      return origUpdated(changedProps);
    };
    for (const task of view.store.allTasks) {
      const clone = JSON.parse(JSON.stringify(task));
      clone.updatedAt = '2099-03-01T00:00:00.000Z';
      view.store.upsert(clone);
    }
    view.store.snapshotComplete();
    await new Promise(r => setTimeout(r, 200));
    view.updated = origUpdated;
    return results;
  });
  console.log(`updated() calls: ${JSON.stringify(updatedCalls2, null, 2)}\n`);

  // --- Test 6: Check selectedTaskId on ft-app vs child ---
  console.log('=== TEST 6: Check selectedTaskId propagation ===');
  const selIds = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-tree-view');
    return {
      appSelectedTaskId: app?.selectedTaskId,
      viewSelectedTaskId: view?.selectedTaskId,
      viewAttr: view?.getAttribute('selected-task-id'),
    };
  });
  console.log(`Selection state: ${JSON.stringify(selIds)}\n`);

  await browser.close();
  console.log('=== Tests complete ===');
}

run().catch(console.error);

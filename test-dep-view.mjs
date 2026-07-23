/**
 * Reproduction test: dependency view redraw on relationship reorder.
 * Tests the hypothesis that unsorted relationships in structureKey() cause
 * spurious re-layout and viewport reset.
 */
import { chromium } from '/scion-volumes/scratchpad/web-test/node_modules/playwright/index.mjs';

const BASE_URL = 'http://localhost:9090';
const COLLECTION_ID = '8ef64de9-cc3e-47ed-aae2-02e83f26dc5d';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE_URL}?collection=${COLLECTION_ID}&view=dependencies`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000); // Extra wait for streaming + layout

  await page.screenshot({ path: '/workspace/farmtable-inv-graph-redraw/dep-view.png' });

  const fv = (v) => v ? `panX=${v.panX.toFixed(2)}, panY=${v.panY.toFixed(2)}, scale=${v.scale.toFixed(4)}` : 'null';

  // Check dependency view state
  const info = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!view) return null;
    const tasks = view.store.allTasks;
    const tasksWithMultiRels = tasks.filter(t => t.relationships.length > 1);
    return {
      viewPresent: true,
      layoutNodes: view.layoutNodes?.length ?? 0,
      totalTasks: tasks.length,
      tasksWithMultiRels: tasksWithMultiRels.map(t => ({
        id: t.id,
        name: t.name,
        rels: t.relationships.map(r => `${r.type}:${r.targetTaskId.substring(0,8)}`),
      })),
      lastStructureKey: view.lastStructureKey?.substring(0, 200),
    };
  });
  console.log('Dependency view info:', JSON.stringify(info, null, 2));

  if (!info || info.layoutNodes === 0) {
    console.log('No dependency nodes — cannot test');
    await browser.close();
    return;
  }

  // Select a task
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (view?.layoutNodes?.length > 0) {
      view.dispatchEvent(new CustomEvent('task-select', {
        detail: { taskId: view.layoutNodes[0].id },
        bubbles: true, composed: true,
      }));
    }
  });
  await page.waitForTimeout(1500);

  const getViewport = async () => {
    return await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const view = app?.shadowRoot?.querySelector('ft-dependency-view');
      if (!view) return null;
      return { panX: view.panX, panY: view.panY, scale: view.scale };
    });
  };

  // --- Test A: snapshotComplete() alone ---
  console.log('\n=== TEST A: snapshotComplete() alone ===');
  const beforeA = await getViewport();
  console.log(`Before: ${fv(beforeA)}`);

  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-dependency-view');
    view?.store?.snapshotComplete();
  });
  await page.waitForTimeout(1500);

  const afterA = await getViewport();
  console.log(`After:  ${fv(afterA)}`);
  const changedA = beforeA && afterA && (
    Math.abs(beforeA.panX - afterA.panX) > 0.1 ||
    Math.abs(beforeA.panY - afterA.panY) > 0.1 ||
    Math.abs(beforeA.scale - afterA.scale) > 0.001
  );
  console.log(`RESULT: ${changedA ? '❌ VIEWPORT CHANGED' : '✅ Viewport stable'}`);

  // --- Test B: Re-upsert with REVERSED relationships (the key test!) ---
  console.log('\n=== TEST B: Re-upsert with REVERSED relationship order + snapshotComplete() ===');

  // First, verify current structure key
  const keyBefore = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-dependency-view');
    return view?.lastStructureKey;
  });

  const beforeB = await getViewport();
  console.log(`Before: ${fv(beforeB)}`);

  const testBResult = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!view?.store) return null;

    const events = [];
    const orig = view.store.dispatchEvent.bind(view.store);
    view.store.dispatchEvent = (e) => { events.push(e.type); return orig(e); };

    let reversed = 0;
    for (const task of view.store.allTasks) {
      if (task.relationships.length > 1) {
        const clone = JSON.parse(JSON.stringify(task));
        clone.relationships.reverse();
        view.store.upsert(clone);
        reversed++;
      }
    }
    view.store.snapshotComplete();
    view.store.dispatchEvent = orig;

    return { events, reversed, keyAfter: view.lastStructureKey };
  });
  console.log(`Reversed ${testBResult?.reversed} tasks' relationships`);
  console.log(`Events: ${JSON.stringify(testBResult?.events)}`);
  console.log(`Structure key changed: ${keyBefore !== testBResult?.keyAfter}`);
  if (keyBefore !== testBResult?.keyAfter) {
    console.log(`  Key before: ${keyBefore?.substring(0, 100)}`);
    console.log(`  Key after:  ${testBResult?.keyAfter?.substring(0, 100)}`);
  }

  await page.waitForTimeout(1500);

  const afterB = await getViewport();
  console.log(`After:  ${fv(afterB)}`);
  const changedB = beforeB && afterB && (
    Math.abs(beforeB.panX - afterB.panX) > 0.1 ||
    Math.abs(beforeB.panY - afterB.panY) > 0.1 ||
    Math.abs(beforeB.scale - afterB.scale) > 0.001
  );
  console.log(`RESULT: ${changedB ? '❌ VIEWPORT CHANGED — relationship ordering causes re-zoom!' : '✅ Viewport stable'}`);

  // --- Test C: Trace updated() during the relationship reorder ---
  console.log('\n=== TEST C: Trace updated() during relationship reorder ===');

  // First restore original order by re-reversing
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-dependency-view');
    for (const task of view.store.allTasks) {
      if (task.relationships.length > 1) {
        const clone = JSON.parse(JSON.stringify(task));
        clone.relationships.reverse(); // Back to original
        view.store.upsert(clone);
      }
    }
    view.store.snapshotComplete();
  });
  await page.waitForTimeout(1500);

  // Now instrument and reverse again
  const updatedCalls = await page.evaluate(async () => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!view) return null;

    const results = [];
    const origUpdated = view.updated.bind(view);
    view.updated = function(changedProps) {
      results.push({
        changedKeys: [...changedProps.keys()],
        needsCenter: this.needsCenter,
        hasSelectedTaskId: changedProps.has('selectedTaskId'),
      });
      return origUpdated(changedProps);
    };

    for (const task of view.store.allTasks) {
      if (task.relationships.length > 1) {
        const clone = JSON.parse(JSON.stringify(task));
        clone.relationships.reverse();
        view.store.upsert(clone);
      }
    }
    view.store.snapshotComplete();

    await new Promise(r => setTimeout(r, 300));
    view.updated = origUpdated;
    return results;
  });
  console.log(`updated() calls: ${JSON.stringify(updatedCalls, null, 2)}`);

  await browser.close();
  console.log('\n=== Tests complete ===');
}

run().catch(console.error);

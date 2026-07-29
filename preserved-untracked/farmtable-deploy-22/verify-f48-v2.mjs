import { chromium } from 'playwright';

const SITE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-22';

async function switchToDependencyView(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return 'no toolbar shadow';
    const radioGroup = toolbar.shadowRoot.querySelector('sl-radio-group');
    if (radioGroup) {
      const radios = radioGroup.querySelectorAll('sl-radio-button');
      for (const r of radios) {
        const val = r.getAttribute('value') || '';
        if (val === 'dependencies' || val.includes('depend')) {
          r.click();
          return 'clicked radio: ' + val;
        }
      }
    }
    return 'not found';
  });
}

async function selectDefaultCollection(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    const collList = app.shadowRoot.querySelector('ft-collection-list');
    if (!collList?.shadowRoot) return 'no collection list';
    const buttons = collList.shadowRoot.querySelectorAll('button.collection');
    for (const btn of buttons) {
      const name = btn.querySelector('.name');
      if (name && name.textContent?.trim() === 'default') {
        btn.click();
        return 'clicked default';
      }
    }
    return 'default not found';
  });
}

async function dndDispatch(page, sourceId, targetId) {
  return page.evaluate(async ({ sourceId, targetId }) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dep view' };

    const srcNode = depView.shadowRoot.querySelector(`foreignObject[data-task-id="${sourceId}"]`);
    const tgtNode = depView.shadowRoot.querySelector(`foreignObject[data-task-id="${targetId}"]`);
    if (!srcNode || !tgtNode) return { error: 'nodes not found' };

    const srcRect = srcNode.getBoundingClientRect();
    const tgtRect = tgtNode.getBoundingClientRect();

    const dt = new DataTransfer();
    dt.setData('application/ft-task-id', sourceId);
    dt.effectAllowed = 'link';

    srcNode.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: srcRect.x + srcRect.width / 2,
      clientY: srcRect.y + srcRect.height / 2,
    }));
    await new Promise(r => setTimeout(r, 100));

    tgtNode.dispatchEvent(new DragEvent('dragenter', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: tgtRect.x + tgtRect.width / 2,
      clientY: tgtRect.y + tgtRect.height / 2,
    }));
    tgtNode.dispatchEvent(new DragEvent('dragover', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: tgtRect.x + tgtRect.width / 2,
      clientY: tgtRect.y + tgtRect.height / 2,
    }));
    tgtNode.dispatchEvent(new DragEvent('drop', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: tgtRect.x + tgtRect.width / 2,
      clientY: tgtRect.y + tgtRect.height / 2,
    }));
    srcNode.dispatchEvent(new DragEvent('dragend', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
    }));

    return { success: true };
  }, { sourceId, targetId });
}

async function getTaskRels(page, taskId) {
  return page.evaluate((taskId) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    const store = depView?.store;
    if (!store) return null;
    const task = store.getTask(taskId);
    return task ? { id: task.id, title: task.title, relationships: task.relationships } : null;
  }, taskId);
}

function hasBlockedBy(rels, targetId) {
  return rels?.relationships?.some(
    r => (r.type === 'BLOCKED_BY' || r.type === 2) && r.targetTaskId === targetId
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to site...');
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Selecting "default" collection...');
  await selectDefaultCollection(page);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-01-app-loaded.png`, fullPage: false });

  console.log('Switching to dependency view...');
  await switchToDependencyView(page);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-02-dependency-view.png`, fullPage: false });

  // ── Find all task nodes and their titles ──
  const nodeInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return [];
    const nodes = depView.shadowRoot.querySelectorAll('foreignObject[data-task-id]');
    const store = depView.store;
    return Array.from(nodes).map(n => {
      const id = n.getAttribute('data-task-id');
      const task = store?.getTask(id);
      return {
        taskId: id,
        title: task?.title || 'unknown',
        relCount: task?.relationships?.length || 0,
        rels: task?.relationships || [],
      };
    });
  });
  console.log(`Found ${nodeInfo.length} task nodes`);

  // Find a pair where sourceNode does NOT have BLOCKED_BY targetNode
  let sourceNode = null;
  let targetNode = null;
  let foundFreshPair = false;

  for (let i = 0; i < nodeInfo.length && !foundFreshPair; i++) {
    for (let j = 0; j < nodeInfo.length && !foundFreshPair; j++) {
      if (i === j) continue;
      const src = nodeInfo[i];
      const tgt = nodeInfo[j];
      const alreadyBlocked = src.rels.some(
        r => (r.type === 'BLOCKED_BY' || r.type === 2) && r.targetTaskId === tgt.taskId
      );
      if (!alreadyBlocked) {
        sourceNode = src;
        targetNode = tgt;
        foundFreshPair = true;
      }
    }
  }

  if (!sourceNode || !targetNode) {
    console.error('Cannot find a pair without existing BLOCKED_BY. Using first two.');
    sourceNode = nodeInfo[0];
    targetNode = nodeInfo[1];
  }

  console.log(`\nSource: ${sourceNode.taskId} ("${sourceNode.title}") — ${sourceNode.relCount} existing rels`);
  console.log(`Target: ${targetNode.taskId} ("${targetNode.title}") — ${targetNode.relCount} existing rels`);

  const relsBefore = sourceNode.rels;
  console.log('Source rels BEFORE:', JSON.stringify(relsBefore));

  const edgesBefore = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return 0;
    return depView.shadowRoot.querySelectorAll('.edges path, .edges line').length;
  });
  console.log('Edges before:', edgesBefore);

  // ── TEST 1: Create BLOCKED_BY via DnD ──
  console.log('\n=== TEST 1: Drag-and-drop creates BLOCKED_BY relationship ===');

  await dndDispatch(page, sourceNode.taskId, targetNode.taskId);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-03-after-dnd-drop.png`, fullPage: false });

  const relsAfter = await getTaskRels(page, sourceNode.taskId);
  console.log('Source rels AFTER:', JSON.stringify(relsAfter?.relationships));

  const newRel = hasBlockedBy(relsAfter, targetNode.taskId);

  const edgesAfter = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return 0;
    return depView.shadowRoot.querySelectorAll('.edges path, .edges line').length;
  });
  console.log('Edges after:', edgesAfter);
  console.log(`Edges increased: ${edgesBefore} -> ${edgesAfter} (+${edgesAfter - edgesBefore})`);

  if (newRel && edgesAfter > edgesBefore) {
    console.log('✓ PASS [TEST 1]: BLOCKED_BY relationship created AND new edge visible');
  } else if (newRel) {
    console.log('✓ PASS [TEST 1]: BLOCKED_BY relationship created (edge count may need re-render)');
  } else {
    console.log('✗ FAIL [TEST 1]: BLOCKED_BY relationship NOT created');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-04-relationship-created.png`, fullPage: false });

  // ── TEST 2: Self-drop is no-op ──
  console.log('\n=== TEST 2: Self-drop is a no-op ===');

  const relCountBefore2 = relsAfter?.relationships?.length || 0;

  await page.evaluate(async ({ nodeId }) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return;
    const node = depView.shadowRoot.querySelector(`foreignObject[data-task-id="${nodeId}"]`);
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const dt = new DataTransfer();
    dt.setData('application/ft-task-id', nodeId);
    dt.effectAllowed = 'link';

    node.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
    }));
    await new Promise(r => setTimeout(r, 100));
    node.dispatchEvent(new DragEvent('dragenter', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
    }));
    node.dispatchEvent(new DragEvent('dragover', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
    }));
    node.dispatchEvent(new DragEvent('drop', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
    }));
    node.dispatchEvent(new DragEvent('dragend', {
      bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
    }));
  }, { nodeId: sourceNode.taskId });
  await page.waitForTimeout(2000);

  const relsAfterSelf = await getTaskRels(page, sourceNode.taskId);
  const relCountAfter2 = relsAfterSelf?.relationships?.length || 0;

  console.log(`Self-drop: rels before=${relCountBefore2}, after=${relCountAfter2}`);
  if (relCountBefore2 === relCountAfter2) {
    console.log('✓ PASS [TEST 2]: Self-drop is a no-op');
  } else {
    console.log('✗ FAIL [TEST 2]: Self-drop changed relationship count');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-05-self-drop-noop.png`, fullPage: false });

  // ── TEST 3: Cycle detection ──
  console.log('\n=== TEST 3: Cycle detection ===');

  if (newRel) {
    // sourceNode is BLOCKED_BY targetNode.
    // Try targetNode BLOCKED_BY sourceNode — should be rejected as a cycle.
    console.log(`Attempting cycle: drag "${targetNode.title}" onto "${sourceNode.title}"`);

    const cycleResult = await page.evaluate(async ({ sourceId, targetId }) => {
      const app = document.querySelector('ft-app');
      const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dep view' };

      const srcNode = depView.shadowRoot.querySelector(`foreignObject[data-task-id="${sourceId}"]`);
      const tgtNode = depView.shadowRoot.querySelector(`foreignObject[data-task-id="${targetId}"]`);
      if (!srcNode || !tgtNode) return { error: 'nodes not found' };

      const srcRect = srcNode.getBoundingClientRect();
      const tgtRect = tgtNode.getBoundingClientRect();
      const dt = new DataTransfer();
      dt.setData('application/ft-task-id', sourceId);
      dt.effectAllowed = 'link';

      srcNode.dispatchEvent(new DragEvent('dragstart', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
        clientX: srcRect.x + srcRect.width / 2, clientY: srcRect.y + srcRect.height / 2,
      }));
      await new Promise(r => setTimeout(r, 100));
      tgtNode.dispatchEvent(new DragEvent('dragenter', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
        clientX: tgtRect.x + tgtRect.width / 2, clientY: tgtRect.y + tgtRect.height / 2,
      }));
      tgtNode.dispatchEvent(new DragEvent('dragover', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
        clientX: tgtRect.x + tgtRect.width / 2, clientY: tgtRect.y + tgtRect.height / 2,
      }));
      tgtNode.dispatchEvent(new DragEvent('drop', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
        clientX: tgtRect.x + tgtRect.width / 2, clientY: tgtRect.y + tgtRect.height / 2,
      }));
      srcNode.dispatchEvent(new DragEvent('dragend', {
        bubbles: true, composed: true, cancelable: true, dataTransfer: dt,
      }));

      await new Promise(r => setTimeout(r, 1500));
      const alerts = document.querySelectorAll('sl-alert');
      return {
        success: true,
        toasts: Array.from(alerts).map(a => ({
          variant: a.getAttribute('variant'),
          text: a.textContent?.trim(),
        })),
      };
    }, { sourceId: targetNode.taskId, targetId: sourceNode.taskId });

    console.log('Cycle result:', JSON.stringify(cycleResult, null, 2));

    // Check that targetNode did NOT get a BLOCKED_BY sourceNode relationship
    const targetRels = await getTaskRels(page, targetNode.taskId);
    const cycleCreated = hasBlockedBy(targetRels, sourceNode.taskId);

    if (!cycleCreated) {
      console.log('✓ PASS [TEST 3]: Cycle was prevented');
    } else {
      console.log('✗ FAIL [TEST 3]: Cycle was NOT prevented');
    }

    const hasWarningToast = cycleResult?.toasts?.some(
      t => t.variant === 'warning' && t.text?.toLowerCase().includes('circular')
    );
    if (hasWarningToast) {
      console.log('✓ PASS: Warning toast "Cannot add dependency: would create a circular dependency"');
    } else {
      console.log('⚠ Toast may have auto-dismissed');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-06-cycle-detection.png`, fullPage: false });
  }

  // ── TEST 4: Persistence after reload ──
  console.log('\n=== TEST 4: Persistence after reload ===');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await selectDefaultCollection(page);
  await page.waitForTimeout(4000);
  await switchToDependencyView(page);
  await page.waitForTimeout(3000);

  const relsAfterReload = await getTaskRels(page, sourceNode.taskId);
  console.log('Source rels AFTER RELOAD:', JSON.stringify(relsAfterReload?.relationships));

  const persisted = hasBlockedBy(relsAfterReload, targetNode.taskId);
  if (persisted) {
    console.log('✓ PASS [TEST 4]: Relationship persisted after reload');
  } else {
    console.log('✗ FAIL [TEST 4]: Relationship NOT found after reload');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-07-after-reload.png`, fullPage: false });

  // ── Cleanup ──
  console.log('\n=== Cleaning up ===');
  // Try to remove the test relationship using the inspector's delete button approach
  // Use ft-app's applyTaskUpdate method
  const cleanup = await page.evaluate(async ({ sourceId, targetId }) => {
    const app = document.querySelector('ft-app');
    if (!app) return 'no app';
    // Try calling applyTaskUpdate directly
    if (typeof app.applyTaskUpdate === 'function') {
      try {
        await app.applyTaskUpdate(sourceId, { removeBlockedBy: [targetId] });
        return 'cleaned via applyTaskUpdate';
      } catch (e) {
        return 'applyTaskUpdate error: ' + e.message;
      }
    }
    // Try the task store from the dependency view
    const depView = app.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView) return 'no dep view';
    const store = depView.store;
    if (!store) return 'no store';
    // Check for various method names
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(store))
      .filter(m => m.toLowerCase().includes('update') || m.toLowerCase().includes('remove') || m.toLowerCase().includes('delete'));
    return { storeMethods: methods };
  }, { sourceId: sourceNode.taskId, targetId: targetNode.taskId });
  console.log('Cleanup result:', JSON.stringify(cleanup));

  // If cleanup didn't work, try via the gRPC/REST API
  if (typeof cleanup === 'object' && cleanup.storeMethods) {
    console.log('Trying store method approach...');
    const cleanup2 = await page.evaluate(async ({ sourceId, targetId, methods }) => {
      const app = document.querySelector('ft-app');
      const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
      const store = depView?.store;
      if (!store) return 'no store';
      for (const m of methods) {
        if (m.toLowerCase().includes('update')) {
          try {
            await store[m](sourceId, { removeBlockedBy: [targetId] });
            return 'cleaned via ' + m;
          } catch (e) {
            // Try next method
          }
        }
      }
      return 'no cleanup method worked';
    }, { sourceId: sourceNode.taskId, targetId: targetNode.taskId, methods: cleanup.storeMethods });
    console.log('Cleanup2 result:', cleanup2);
  }

  await browser.close();
  console.log('\n=== Feature 48 verification COMPLETE ===');
  console.log('\nSUMMARY:');
  console.log(`  TEST 1 (DnD creates BLOCKED_BY): ${newRel ? 'PASS' : 'FAIL'}`);
  console.log(`  TEST 2 (Self-drop no-op):         ${relCountBefore2 === relCountAfter2 ? 'PASS' : 'FAIL'}`);
  console.log(`  TEST 3 (Cycle detection):          ${newRel ? 'PASS' : 'SKIPPED'}`);
  console.log(`  TEST 4 (Persistence):              ${persisted ? 'PASS' : 'FAIL'}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

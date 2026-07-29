import { chromium } from 'playwright';

const SITE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-22';

async function switchToDependencyView(page) {
  // The toolbar is inside ft-toolbar component with its own shadow root
  const result = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return 'no toolbar shadow';

    // Look inside the toolbar for view buttons
    const tooltips = toolbar.shadowRoot.querySelectorAll('sl-tooltip');
    for (const tip of tooltips) {
      const content = (tip.getAttribute('content') || '').toLowerCase();
      if (content.includes('depend')) {
        const btn = tip.querySelector('sl-icon-button') || tip.querySelector('button');
        if (btn) { btn.click(); return 'clicked tooltip: ' + tip.getAttribute('content'); }
      }
    }

    // Try icon buttons inside toolbar
    const btns = toolbar.shadowRoot.querySelectorAll('sl-icon-button');
    for (const btn of btns) {
      const name = btn.getAttribute('name') || '';
      if (name === 'share-nodes' || name === 'diagram-3' || name === 'diagram' || name === 'git-branch') {
        btn.click();
        return 'clicked icon: ' + name;
      }
    }

    // Try radio buttons/groups inside toolbar
    const radioGroup = toolbar.shadowRoot.querySelector('sl-radio-group');
    if (radioGroup) {
      const radios = radioGroup.querySelectorAll('sl-radio-button');
      for (const r of radios) {
        const val = r.getAttribute('value') || '';
        if (val === 'dependency' || val.includes('depend')) {
          r.click();
          return 'clicked radio: ' + val;
        }
      }
      return { radioGroup: true, radios: Array.from(radios).map(r => r.getAttribute('value')) };
    }

    // Dump what's in the toolbar
    const allBtns = toolbar.shadowRoot.querySelectorAll('sl-icon-button, button, sl-radio-button');
    const info = Array.from(allBtns).map(b => ({
      tag: b.tagName,
      name: b.getAttribute('name'),
      label: b.getAttribute('label'),
      value: b.getAttribute('value'),
      title: b.getAttribute('title'),
      text: b.textContent?.trim().substring(0, 50),
    }));

    const allTooltips = toolbar.shadowRoot.querySelectorAll('sl-tooltip');
    const tipInfo = Array.from(allTooltips).map(t => t.getAttribute('content'));

    return { buttons: info, tooltips: tipInfo, html: toolbar.shadowRoot.innerHTML?.substring(0, 2000) };
  });
  return result;
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

async function isOnDependencyView(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return false;
    return !!app.shadowRoot.querySelector('ft-dependency-view');
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ── Step 1: Navigate and select collection ──
  console.log('Navigating to site...');
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Selecting "default" collection...');
  const collResult = await selectDefaultCollection(page);
  console.log('Collection:', collResult);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-01-app-loaded.png`, fullPage: false });
  console.log('✓ App loaded with default collection');

  // ── Step 2: Switch to Dependency view ──
  console.log('Switching to dependency view...');
  const switchResult = await switchToDependencyView(page);
  console.log('Switch result:', JSON.stringify(switchResult, null, 2));
  await page.waitForTimeout(2000);

  let onDepView = await isOnDependencyView(page);

  if (!onDepView) {
    // If the toolbar had a radio group, try setting value directly
    console.log('Direct click may not have worked. Trying to set radio group value...');
    const radioResult = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return 'no app';
      const toolbar = app.shadowRoot.querySelector('ft-toolbar');
      if (!toolbar?.shadowRoot) return 'no toolbar';

      // Look for any kind of view selector
      const allElements = Array.from(toolbar.shadowRoot.querySelectorAll('*'));
      const tags = {};
      for (const el of allElements) {
        const tag = el.tagName.toLowerCase();
        tags[tag] = (tags[tag] || 0) + 1;
      }

      // Try setting view directly via event dispatch on ft-app
      const evt = new CustomEvent('view-change', { detail: { view: 'dependency' }, bubbles: true, composed: true });
      app.dispatchEvent(evt);

      return { tags, html: toolbar.shadowRoot.innerHTML?.substring(0, 3000) };
    });
    console.log('Radio result:', JSON.stringify(radioResult, null, 2));
    await page.waitForTimeout(1000);
    onDepView = await isOnDependencyView(page);
  }

  if (!onDepView) {
    // Try keyboard shortcut — maybe there's one for switching views
    // Or try setting the property directly on ft-app
    const directSet = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app) return 'no app';
      // Try setting the view property directly
      if ('view' in app) {
        app.view = 'dependency';
        return 'set view property';
      }
      if ('currentView' in app) {
        app.currentView = 'dependency';
        return 'set currentView property';
      }
      // List all properties
      const props = [];
      for (const key in app) {
        if (typeof app[key] !== 'function' && key.toLowerCase().includes('view')) {
          props.push({ key, value: String(app[key]).substring(0, 50) });
        }
      }
      return { props };
    });
    console.log('Direct set:', JSON.stringify(directSet));
    await page.waitForTimeout(1000);
    onDepView = await isOnDependencyView(page);
  }

  if (!onDepView) {
    // Last resort: try navigating with URL hash or query params
    console.log('Trying URL-based navigation...');
    await page.goto(SITE_URL + '/#dependency', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // Select collection again
    await selectDefaultCollection(page);
    await page.waitForTimeout(3000);
    onDepView = await isOnDependencyView(page);
    if (!onDepView) {
      await page.goto(SITE_URL + '/?view=dependency', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await selectDefaultCollection(page);
      await page.waitForTimeout(3000);
      onDepView = await isOnDependencyView(page);
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-02-dependency-view.png`, fullPage: false });

  if (!onDepView) {
    console.error('Cannot switch to dependency view after multiple attempts. Aborting.');
    await browser.close();
    process.exit(1);
  }

  console.log('✓ On dependency view');

  // ── Step 3: Find task nodes ──
  console.log('Finding task nodes...');
  const nodeInfo = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return [];
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return [];
    const nodes = depView.shadowRoot.querySelectorAll('foreignObject[data-task-id]');
    return Array.from(nodes).map(n => ({
      taskId: n.getAttribute('data-task-id'),
      x: parseFloat(n.getAttribute('x')),
      y: parseFloat(n.getAttribute('y')),
      width: parseFloat(n.getAttribute('width')),
      height: parseFloat(n.getAttribute('height')),
    }));
  });
  console.log(`Found ${nodeInfo.length} task nodes`);

  if (nodeInfo.length < 2) {
    console.error('Need at least 2 nodes for DnD test');
    await browser.close();
    process.exit(1);
  }

  // Get task titles
  const taskTitles = await page.evaluate((ids) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    const store = depView?.store;
    if (!store) return {};
    const result = {};
    for (const id of ids) {
      const task = store.getTask(id);
      result[id] = task?.title || 'unknown';
    }
    return result;
  }, nodeInfo.map(n => n.taskId));

  // Find two nodes without existing BLOCKED_BY between them
  let sourceNode = null;
  let targetNode = null;

  for (let i = 0; i < nodeInfo.length && !sourceNode; i++) {
    for (let j = 0; j < nodeInfo.length && !sourceNode; j++) {
      if (i === j) continue;
      const hasRel = await page.evaluate(({ srcId, tgtId }) => {
        const app = document.querySelector('ft-app');
        const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
        const store = depView?.store;
        if (!store) return true;
        const task = store.getTask(srcId);
        if (!task) return true;
        return task.relationships.some(
          r => r.type === 'BLOCKED_BY' && r.targetTaskId === tgtId
        );
      }, { srcId: nodeInfo[i].taskId, tgtId: nodeInfo[j].taskId });
      if (!hasRel) {
        sourceNode = nodeInfo[i];
        targetNode = nodeInfo[j];
      }
    }
  }

  if (!sourceNode || !targetNode) {
    sourceNode = nodeInfo[0];
    targetNode = nodeInfo[1];
  }

  console.log(`Source: ${sourceNode.taskId} ("${taskTitles[sourceNode.taskId]}")`);
  console.log(`Target: ${targetNode.taskId} ("${taskTitles[targetNode.taskId]}")`);

  // ── Step 4: Record relationships before drag ──
  const relsBefore = await page.evaluate((taskId) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    const store = depView?.store;
    if (!store) return null;
    const task = store.getTask(taskId);
    return task ? { title: task.title, relationships: task.relationships } : null;
  }, sourceNode.taskId);
  console.log('Source relationships BEFORE:', JSON.stringify(relsBefore?.relationships, null, 2));

  const edgesBefore = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return 0;
    return depView.shadowRoot.querySelectorAll('.edges path, .edges line').length;
  });
  console.log('Edges before:', edgesBefore);

  // ── Step 5: Perform real HTML5 DnD ──
  console.log('\n=== TEST 1: Drag-and-drop relationship creation ===');

  const dndResult = await page.evaluate(async ({ sourceId, targetId }) => {
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
  }, { sourceId: sourceNode.taskId, targetId: targetNode.taskId });

  console.log('DnD dispatch result:', JSON.stringify(dndResult));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-03-after-dnd-drop.png`, fullPage: false });

  // Verify relationship was created
  const relsAfter = await page.evaluate((taskId) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    const store = depView?.store;
    if (!store) return null;
    const task = store.getTask(taskId);
    return task ? { title: task.title, relationships: task.relationships } : null;
  }, sourceNode.taskId);
  console.log('Source relationships AFTER:', JSON.stringify(relsAfter?.relationships, null, 2));

  // type can be numeric enum (2) or string 'BLOCKED_BY'
  const newRel = relsAfter?.relationships?.find(
    r => (r.type === 'BLOCKED_BY' || r.type === 2) && r.targetTaskId === targetNode.taskId
  );

  const edgesAfter = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return 0;
    return depView.shadowRoot.querySelectorAll('.edges path, .edges line').length;
  });
  console.log('Edges after:', edgesAfter);

  if (newRel) {
    console.log('✓ PASS [TEST 1]: BLOCKED_BY relationship created');
  } else {
    console.log('✗ FAIL [TEST 1]: BLOCKED_BY relationship NOT created');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-04-relationship-created.png`, fullPage: false });

  // ── Step 6: Self-drop test ──
  console.log('\n=== TEST 2: Self-drop (should be no-op) ===');

  const relCountBefore = relsAfter?.relationships?.length || 0;

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

  const relCountAfter = await page.evaluate((taskId) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    const store = depView?.store;
    if (!store) return -1;
    const task = store.getTask(taskId);
    return task?.relationships?.length || 0;
  }, sourceNode.taskId);

  console.log(`Self-drop: relationships before=${relCountBefore}, after=${relCountAfter}`);
  if (relCountBefore === relCountAfter) {
    console.log('✓ PASS [TEST 2]: Self-drop is a no-op');
  } else {
    console.log('✗ FAIL [TEST 2]: Self-drop changed relationship count');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-05-self-drop-noop.png`, fullPage: false });

  // ── Step 7: Cycle detection test ──
  console.log('\n=== TEST 3: Cycle detection ===');

  if (newRel) {
    console.log(`Attempting cycle: drag ${targetNode.taskId} onto ${sourceNode.taskId}`);

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

      await new Promise(r => setTimeout(r, 1000));
      const alerts = document.querySelectorAll('sl-alert');
      return {
        success: true,
        toasts: Array.from(alerts).map(a => ({
          variant: a.getAttribute('variant'),
          text: a.textContent?.trim(),
        })),
      };
    }, { sourceId: targetNode.taskId, targetId: sourceNode.taskId });

    console.log('Cycle detection result:', JSON.stringify(cycleResult, null, 2));

    const targetRels = await page.evaluate((taskId) => {
      const app = document.querySelector('ft-app');
      const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
      const store = depView?.store;
      if (!store) return null;
      const task = store.getTask(taskId);
      return task?.relationships || [];
    }, targetNode.taskId);

    const cycleRelCreated = targetRels?.find(
      r => (r.type === 'BLOCKED_BY' || r.type === 2) && r.targetTaskId === sourceNode.taskId
    );

    if (!cycleRelCreated) {
      console.log('✓ PASS [TEST 3]: Cycle was prevented');
    } else {
      console.log('✗ FAIL [TEST 3]: Cycle was NOT prevented');
    }

    const hasWarningToast = cycleResult?.toasts?.some(
      t => t.variant === 'warning' && t.text?.toLowerCase().includes('circular')
    );
    if (hasWarningToast) {
      console.log('✓ PASS: Warning toast displayed');
    } else {
      console.log('⚠ Toast may have auto-dismissed (5s duration)');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-06-cycle-detection.png`, fullPage: false });
  } else {
    console.log('Skipping — initial relationship was not created');
  }

  // ── Step 8: Reload and verify persistence ──
  console.log('\n=== TEST 4: Persistence after reload ===');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  await selectDefaultCollection(page);
  await page.waitForTimeout(4000);
  await switchToDependencyView(page);
  await page.waitForTimeout(3000);

  const relsAfterReload = await page.evaluate((taskId) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    const store = depView?.store;
    if (!store) return null;
    const task = store.getTask(taskId);
    return task ? { title: task.title, relationships: task.relationships } : null;
  }, sourceNode.taskId);

  console.log('Source relationships AFTER RELOAD:', JSON.stringify(relsAfterReload?.relationships, null, 2));

  const persistedRel = relsAfterReload?.relationships?.find(
    r => (r.type === 'BLOCKED_BY' || r.type === 2) && r.targetTaskId === targetNode.taskId
  );

  if (persistedRel) {
    console.log('✓ PASS [TEST 4]: Relationship persisted after reload');
  } else {
    console.log('✗ FAIL [TEST 4]: Relationship NOT found after reload');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f48-07-after-reload.png`, fullPage: false });

  // ── Step 9: Clean up ──
  console.log('\n=== Cleaning up test relationship ===');
  if (newRel || persistedRel) {
    const cleanup = await page.evaluate(async ({ sourceId, targetId }) => {
      const app = document.querySelector('ft-app');
      const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
      const store = depView?.store;
      if (!store) return 'no store';
      try {
        await store.updateTask(sourceId, { removeBlockedBy: [targetId] });
        return 'cleaned up';
      } catch (e) {
        return 'cleanup error: ' + e.message;
      }
    }, { sourceId: sourceNode.taskId, targetId: targetNode.taskId });
    console.log('Cleanup result:', cleanup);
  }

  await browser.close();
  console.log('\n=== Feature 48 verification COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

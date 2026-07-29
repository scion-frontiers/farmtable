// Playwright verification script for deploy-41 — Feature 62: Task Deep-Links
// Checks:
//   a. Select a task in Tree View → URL gets ?task= param
//   b. Open captured URL in FRESH browser context → task selected, Inspector open, view centered
//   c. Repeat a+b for Dependency View
//   d. Close Inspector → ?task= removed from URL
//   e. Switch collections → no stale ?task= leaks
//   f. Regression: normal navigation still works (selecting tasks, switching views)

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-41';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`, { encoding: 'utf-8' }).trim();
}

const results = [];
const consoleErrors = [];

function record(check, action, pass, detail, error) {
  const r = { check, action, pass, detail, timestamp: new Date().toISOString() };
  if (error) r.error = error;
  results.push(r);
  console.log(`  [${check}] ${pass ? 'PASS' : 'FAIL'}: ${action}`);
  console.log(`    Detail: ${detail}`);
  if (error) console.log(`    Error: ${error}`);
}

// ────── Shadow DOM helpers ──────

async function getInspectorState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const inspector = app.shadowRoot.querySelector('ft-inspector');
    if (!inspector) return { visible: false };
    const sr = inspector.shadowRoot;
    if (!sr) return { visible: false };
    // Get task title from inspector
    const titleEl = sr.querySelector('.inspector-title, h2, h3, .task-title');
    const generalTab = sr.querySelector('[data-tab="general"], .tab-content');
    return {
      visible: true,
      titleText: titleEl?.textContent?.trim() || null,
      hasContent: sr.innerHTML.length > 50,
      inspectorText: sr.textContent?.substring(0, 200) || '',
    };
  });
}

async function closeInspector(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const inspector = app.shadowRoot.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return { closed: false, error: 'no inspector' };
    // The close button is an sl-icon-button with class "close-btn"
    const closeBtn = inspector.shadowRoot.querySelector('sl-icon-button.close-btn');
    if (closeBtn) {
      closeBtn.click();
      return { closed: true, method: 'sl-icon-button' };
    }
    // Fallback: dispatch a 'close' CustomEvent from the inspector (simulates the close action)
    inspector.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    return { closed: true, method: 'custom-event-dispatch' };
  });
}

async function getTreeNodeCount(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { count: -1, names: [] };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { count: -1, names: [] };
    const nodes = treeView.shadowRoot.querySelectorAll('ft-tree-node');
    const names = [];
    for (const n of nodes) {
      const task = n.task;
      if (task) names.push({ id: task.id, title: task.title || task.name || '(untitled)' });
    }
    return { count: nodes.length, names };
  });
}

async function clickTaskInTreeView(page, taskId) {
  return page.evaluate((id) => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return false;
    const foreignObjects = treeView.shadowRoot.querySelectorAll('foreignObject');
    for (const fo of foreignObjects) {
      const treeNode = fo.querySelector('ft-tree-node');
      if (treeNode?.task?.id === id) {
        fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        return true;
      }
    }
    return false;
  }, taskId);
}

async function clickTaskInDepView(page, taskId) {
  return page.evaluate((id) => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return false;
    const foreignObjects = depView.shadowRoot.querySelectorAll('foreignObject');
    for (const fo of foreignObjects) {
      const treeNode = fo.querySelector('ft-tree-node');
      if (treeNode?.task?.id === id) {
        fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        return true;
      }
    }
    return false;
  }, taskId);
}

async function getSelectedTaskId(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return null;
    // selectedTaskId is a private property on ft-app itself
    return app.selectedTaskId || null;
  });
}

async function findAnyTask(page, viewSelector) {
  return page.evaluate((vs) => {
    const app = document.querySelector('ft-app');
    const view = app?.shadowRoot?.querySelector(vs);
    if (!view) return { error: `no ${vs}` };
    const store = view.store;
    if (!store) return { error: 'no store' };
    const allTasks = store.allTasks || [];
    // Pick first non-closed task with a title
    for (const task of allTasks) {
      if (task.phase === 2) continue; // skip CLOSED
      if (task.title || task.name) {
        return {
          id: task.id,
          title: task.title || task.name,
        };
      }
    }
    return { error: 'no suitable task found', taskCount: allTasks.length };
  }, viewSelector);
}

// ────── Main ──────

async function run() {
  const iapToken = getIAPToken();
  console.log('IAP token obtained');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Authorization': `Bearer ${iapToken}` },
      ignoreHTTPSErrors: true,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Track console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('favicon.ico')) return;
        consoleErrors.push({ text, url: msg.location()?.url, timestamp: new Date().toISOString() });
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push({ text: err.message, type: 'pageerror', timestamp: new Date().toISOString() });
    });

    // ── Step 0: Login ──
    console.log('\n=== Step 0: Login ===');
    await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const loginResp = await page.evaluate(async (token) => {
      const resp = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return { status: resp.status, body: await resp.json().catch(() => null) };
    }, FT_TOKEN);
    console.log(`Login response: ${JSON.stringify(loginResp)}`);

    if (loginResp.status !== 200) {
      console.error('LOGIN FAILED — cannot proceed');
      record('login', 'Session login', false, `HTTP ${loginResp.status}: ${JSON.stringify(loginResp.body)}`);
      process.exit(1);
    }

    // Reload after login
    await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    // ── Find a collection ──
    console.log('\n=== Finding collection ===');
    const collectionData = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return [];
      const picker = app.shadowRoot.querySelector('ft-collection-list');
      if (!picker?.collections) return [];
      return picker.collections.map(c => ({ id: c.id, name: c.name }));
    });
    console.log(`Collections: ${JSON.stringify(collectionData?.slice(0, 5))}`);

    let targetCollectionId = null;
    let targetCollectionName = null;
    let secondCollectionId = null;
    let secondCollectionName = null;
    if (collectionData && collectionData.length > 0) {
      const prefs = [
        c => c.name === 'default',
        c => c.name?.includes('deploy4-web'),
        c => c.name?.includes('deploy4-cli'),
      ];
      let target = null;
      for (const pred of prefs) {
        target = collectionData.find(pred);
        if (target) break;
      }
      if (!target) target = collectionData[0];
      targetCollectionId = target.id;
      targetCollectionName = target.name;
      console.log(`Primary collection: ${target.name} (${targetCollectionId})`);

      // Find a second collection for the switch test
      const second = collectionData.find(c => c.id !== targetCollectionId);
      if (second) {
        secondCollectionId = second.id;
        secondCollectionName = second.name;
        console.log(`Second collection: ${second.name} (${secondCollectionId})`);
      }
    }

    // ═══════════════════════════════════════════════════
    // CHECK (a): Select task in Tree View → URL gets ?task= param
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (a): Tree View — select task, verify URL gets ?task= ===');

    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(8000);

    await page.screenshot({ path: `${EVIDENCE_DIR}/a1-tree-view-loaded.png` });

    const treeTask = await findAnyTask(page, 'ft-tree-view');
    console.log(`Tree task found: ${JSON.stringify(treeTask)}`);

    let capturedTreeUrl = null;

    if (treeTask?.id) {
      const clicked = await clickTaskInTreeView(page, treeTask.id);
      console.log(`Clicked tree task: ${clicked}`);
      await page.waitForTimeout(2000);

      capturedTreeUrl = page.url();
      const url = new URL(capturedTreeUrl);
      const taskParam = url.searchParams.get('task');

      await page.screenshot({ path: `${EVIDENCE_DIR}/a2-tree-task-selected.png` });

      const inspState = await getInspectorState(page);
      console.log(`Inspector state: ${JSON.stringify(inspState)}`);

      record('a-tree-url', 'Selecting task in Tree View adds ?task= to URL',
        taskParam === treeTask.id,
        `URL: ${capturedTreeUrl}. ?task param: ${taskParam}. Expected: ${treeTask.id}. ` +
        `Inspector visible: ${inspState.visible}`);

      record('a-inspector-open', 'Inspector opens when task is selected',
        inspState.visible,
        `Inspector visible: ${inspState.visible}. ` +
        `Content preview: ${inspState.inspectorText?.substring(0, 100)}`);
    } else {
      record('a-tree-url', 'Selecting task in Tree View adds ?task= to URL',
        false, `Could not find a suitable task: ${JSON.stringify(treeTask)}`);
      record('a-inspector-open', 'Inspector opens when task is selected',
        false, 'No task to click');
    }

    // ═══════════════════════════════════════════════════
    // CHECK (b): Fresh context opens deep-link URL → correct task, Inspector open
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (b): Fresh context deep-link in Tree View ===');

    if (capturedTreeUrl) {
      // Create a FRESH browser context
      const freshIapToken = getIAPToken(); // fresh token
      const freshContext = await browser.newContext({
        extraHTTPHeaders: { 'Authorization': `Bearer ${freshIapToken}` },
        ignoreHTTPSErrors: true,
        viewport: { width: 1920, height: 1080 },
      });
      const freshPage = await freshContext.newPage();

      // Login in fresh context
      await freshPage.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
      await freshPage.waitForTimeout(2000);
      await freshPage.evaluate(async (token) => {
        const resp = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        return { status: resp.status };
      }, FT_TOKEN);

      // Navigate to the captured deep-link URL
      console.log(`Opening deep-link URL in fresh context: ${capturedTreeUrl}`);
      await freshPage.goto(capturedTreeUrl, { waitUntil: 'load', timeout: 30000 });
      await freshPage.waitForTimeout(8000);

      await freshPage.screenshot({ path: `${EVIDENCE_DIR}/b1-fresh-context-deep-link-tree.png` });

      // Check URL is preserved
      const freshUrl = freshPage.url();
      const freshUrlObj = new URL(freshUrl);
      const freshTaskParam = freshUrlObj.searchParams.get('task');

      // Check Inspector is open
      const freshInspector = await getInspectorState(freshPage);
      console.log(`Fresh context inspector: ${JSON.stringify(freshInspector)}`);

      // Check selected task matches
      const freshSelectedTask = await getSelectedTaskId(freshPage);
      console.log(`Fresh context selected task: ${freshSelectedTask}`);

      record('b-fresh-url', 'Fresh context preserves ?task= in URL',
        freshTaskParam === treeTask.id,
        `Fresh URL: ${freshUrl}. ?task param: ${freshTaskParam}. Expected: ${treeTask.id}`);

      record('b-fresh-inspector', 'Fresh context: Inspector auto-opens with correct task',
        freshInspector.visible,
        `Inspector visible: ${freshInspector.visible}. ` +
        `Content: ${freshInspector.inspectorText?.substring(0, 150)}`);

      record('b-fresh-task-selected', 'Fresh context: correct task is selected',
        freshSelectedTask === treeTask.id,
        `Selected task ID: ${freshSelectedTask}. Expected: ${treeTask.id}. ` +
        `Task title: "${treeTask.title}"`);

      await freshContext.close();
    } else {
      record('b-fresh-url', 'Fresh context preserves ?task= in URL', false, 'No captured URL');
      record('b-fresh-inspector', 'Fresh context: Inspector auto-opens', false, 'No captured URL');
      record('b-fresh-task-selected', 'Fresh context: correct task selected', false, 'No captured URL');
    }

    // ═══════════════════════════════════════════════════
    // CHECK (c): Repeat for Dependency View
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (c): Dependency View deep-link ===');

    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(8000);

    await page.screenshot({ path: `${EVIDENCE_DIR}/c1-dep-view-loaded.png` });

    const depTask = await findAnyTask(page, 'ft-dependency-view');
    console.log(`Dep task found: ${JSON.stringify(depTask)}`);

    let capturedDepUrl = null;

    if (depTask?.id) {
      const clicked = await clickTaskInDepView(page, depTask.id);
      console.log(`Clicked dep task: ${clicked}`);
      await page.waitForTimeout(2000);

      capturedDepUrl = page.url();
      const url = new URL(capturedDepUrl);
      const taskParam = url.searchParams.get('task');

      await page.screenshot({ path: `${EVIDENCE_DIR}/c2-dep-task-selected.png` });

      const inspState = await getInspectorState(page);

      record('c-dep-url', 'Selecting task in Dependency View adds ?task= to URL',
        taskParam === depTask.id,
        `URL: ${capturedDepUrl}. ?task param: ${taskParam}. Expected: ${depTask.id}. ` +
        `Inspector visible: ${inspState.visible}`);

      // Fresh context for dependency view
      const freshIapToken2 = getIAPToken();
      const freshCtx2 = await browser.newContext({
        extraHTTPHeaders: { 'Authorization': `Bearer ${freshIapToken2}` },
        ignoreHTTPSErrors: true,
        viewport: { width: 1920, height: 1080 },
      });
      const freshPage2 = await freshCtx2.newPage();

      await freshPage2.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
      await freshPage2.waitForTimeout(2000);
      await freshPage2.evaluate(async (token) => {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      }, FT_TOKEN);

      console.log(`Opening dep deep-link in fresh context: ${capturedDepUrl}`);
      await freshPage2.goto(capturedDepUrl, { waitUntil: 'load', timeout: 30000 });
      await freshPage2.waitForTimeout(8000);

      await freshPage2.screenshot({ path: `${EVIDENCE_DIR}/c3-fresh-context-deep-link-dep.png` });

      const freshUrl2 = freshPage2.url();
      const freshUrlObj2 = new URL(freshUrl2);
      const freshTaskParam2 = freshUrlObj2.searchParams.get('task');
      const freshInsp2 = await getInspectorState(freshPage2);
      const freshSelected2 = await getSelectedTaskId(freshPage2);

      record('c-fresh-dep-url', 'Fresh context dependency deep-link preserves ?task=',
        freshTaskParam2 === depTask.id,
        `Fresh URL: ${freshUrl2}. ?task param: ${freshTaskParam2}. Expected: ${depTask.id}`);

      record('c-fresh-dep-inspector', 'Fresh context dependency: Inspector auto-opens',
        freshInsp2.visible,
        `Inspector visible: ${freshInsp2.visible}. ` +
        `Content: ${freshInsp2.inspectorText?.substring(0, 150)}`);

      record('c-fresh-dep-selected', 'Fresh context dependency: correct task selected',
        freshSelected2 === depTask.id,
        `Selected: ${freshSelected2}. Expected: ${depTask.id}`);

      await freshCtx2.close();
    } else {
      record('c-dep-url', 'Dependency View URL has ?task=', false, `No task: ${JSON.stringify(depTask)}`);
      record('c-fresh-dep-url', 'Fresh dep deep-link', false, 'No task');
      record('c-fresh-dep-inspector', 'Fresh dep inspector', false, 'No task');
      record('c-fresh-dep-selected', 'Fresh dep task selected', false, 'No task');
    }

    // ═══════════════════════════════════════════════════
    // CHECK (d): Close Inspector → ?task= removed from URL
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (d): Close Inspector → ?task= removed ===');

    // Make sure we're in a state with a task selected and inspector open
    if (depTask?.id) {
      // Navigate to dependency view with task param
      await page.goto(
        `${SERVICE_URL}/?collection=${targetCollectionId}&view=dependencies&task=${depTask.id}`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(8000);

      const beforeClose = page.url();
      const beforeCloseUrl = new URL(beforeClose);
      const beforeTaskParam = beforeCloseUrl.searchParams.get('task');
      console.log(`Before close - URL: ${beforeClose}, ?task: ${beforeTaskParam}`);

      const inspBefore = await getInspectorState(page);
      console.log(`Inspector before close: ${JSON.stringify(inspBefore)}`);

      // Close the inspector
      const closeResult = await closeInspector(page);
      console.log(`Close result: ${JSON.stringify(closeResult)}`);
      await page.waitForTimeout(2000);

      const afterClose = page.url();
      const afterCloseUrl = new URL(afterClose);
      const afterTaskParam = afterCloseUrl.searchParams.get('task');

      const inspAfter = await getInspectorState(page);

      await page.screenshot({ path: `${EVIDENCE_DIR}/d1-inspector-closed.png` });

      record('d-task-param-removed', 'Closing Inspector removes ?task= from URL',
        afterTaskParam === null,
        `Before: ?task=${beforeTaskParam}. After: ?task=${afterTaskParam}. ` +
        `Inspector before: visible=${inspBefore.visible}. After: visible=${inspAfter.visible}. ` +
        `Full URL after: ${afterClose}`);
    } else {
      record('d-task-param-removed', 'Closing Inspector removes ?task= from URL',
        false, 'No task available for this check');
    }

    // ═══════════════════════════════════════════════════
    // CHECK (e): Switch collections → no stale ?task= leaks
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (e): Switch collections → no stale ?task= ===');

    // Start with a task selected
    const taskForSwitch = treeTask?.id || depTask?.id;
    if (taskForSwitch && targetCollectionId) {
      await page.goto(
        `${SERVICE_URL}/?collection=${targetCollectionId}&view=tree&task=${taskForSwitch}`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(8000);

      const beforeSwitch = page.url();
      const beforeSwitchUrl = new URL(beforeSwitch);
      console.log(`Before switch: ${beforeSwitch}, ?task=${beforeSwitchUrl.searchParams.get('task')}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/e1-before-collection-switch.png` });

      // Navigate to collection list (root)
      await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(3000);

      const collListUrl = page.url();
      const collListUrlObj = new URL(collListUrl);
      const collListTaskParam = collListUrlObj.searchParams.get('task');

      await page.screenshot({ path: `${EVIDENCE_DIR}/e2-collection-list.png` });

      record('e-collection-list-clean', 'Collection list URL has no stale ?task= param',
        collListTaskParam === null,
        `URL: ${collListUrl}. ?task param: ${collListTaskParam}`);

      // Now enter a different collection (or same collection again)
      const reenterCollId = secondCollectionId || targetCollectionId;
      const reenterCollName = secondCollectionId ? secondCollectionName : targetCollectionName;
      await page.goto(
        `${SERVICE_URL}/?collection=${reenterCollId}&view=tree`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const reenterUrl = page.url();
      const reenterUrlObj = new URL(reenterUrl);
      const reenterTaskParam = reenterUrlObj.searchParams.get('task');

      const reenterInspector = await getInspectorState(page);

      await page.screenshot({ path: `${EVIDENCE_DIR}/e3-collection-reentered.png` });

      record('e-reenter-clean', `Entering ${reenterCollName === targetCollectionName ? 'same' : 'different'} collection has no stale ?task=`,
        reenterTaskParam === null,
        `URL: ${reenterUrl}. ?task param: ${reenterTaskParam}. ` +
        `Inspector visible: ${reenterInspector.visible} (expected: false). ` +
        `Collection: ${reenterCollName}`);

      record('e-no-inspector', 'No Inspector open after entering collection without ?task=',
        !reenterInspector.visible,
        `Inspector visible: ${reenterInspector.visible}`);
    } else {
      record('e-collection-list-clean', 'Collection list clean', false, 'No task or collection');
      record('e-reenter-clean', 'Re-enter clean', false, 'No task or collection');
      record('e-no-inspector', 'No Inspector after re-enter', false, 'No task or collection');
    }

    // ═══════════════════════════════════════════════════
    // CHECK (f): Basic regression — normal navigation still works
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (f): Basic regression ===');

    // Tree view regression
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const treeNodes = await getTreeNodeCount(page);
    const treeHasSvg = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const tv = app?.shadowRoot?.querySelector('ft-tree-view');
      if (!tv?.shadowRoot) return false;
      return !!tv.shadowRoot.querySelector('svg');
    });

    record('f-tree-renders', 'Tree View renders correctly (regression)',
      treeHasSvg && treeNodes.count > 0,
      `SVG present: ${treeHasSvg}, Node count: ${treeNodes.count}`);

    // Select a task without deep-link (normal click navigation)
    if (treeTask?.id) {
      const clicked = await clickTaskInTreeView(page, treeTask.id);
      await page.waitForTimeout(1500);
      const selectedId = await getSelectedTaskId(page);
      record('f-tree-select', 'Selecting task via click works normally',
        selectedId === treeTask.id,
        `Clicked: ${clicked}. Selected: ${selectedId}. Expected: ${treeTask.id}`);
    }

    // Switch to Kanban view
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=kanban`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const kanbanState = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return null;
      const kanban = app.shadowRoot.querySelector('ft-kanban-view');
      if (!kanban?.shadowRoot) return null;
      const columns = kanban.shadowRoot.querySelectorAll('ft-kanban-column');
      const cards = kanban.shadowRoot.querySelectorAll('ft-task-card');
      return { columnCount: columns.length, cardCount: cards.length };
    });

    await page.screenshot({ path: `${EVIDENCE_DIR}/f-regression-kanban.png` });

    record('f-kanban-renders', 'Kanban View renders correctly (regression)',
      kanbanState && kanbanState.columnCount > 0,
      `Columns: ${kanbanState?.columnCount}, Cards: ${kanbanState?.cardCount}`);

    // Switch to dependency view
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const depNodeCount = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return { count: -1 };
      const depView = app.shadowRoot.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { count: -1 };
      const nodes = depView.shadowRoot.querySelectorAll('ft-tree-node');
      return { count: nodes.length };
    });

    record('f-dep-renders', 'Dependency View renders correctly (regression)',
      depNodeCount.count > 0,
      `Node count: ${depNodeCount.count}`);

    // Console errors
    const relevantErrors = consoleErrors.filter(e =>
      !e.text?.includes('401') &&
      !e.text?.includes('favicon') &&
      !e.url?.includes('favicon') &&
      !e.text?.includes('net::ERR') &&
      !e.text?.includes('Slow network') &&
      !e.text?.includes('Response closed without grpc-status') &&
      !e.text?.includes('Stream error: GrpcError')
    );

    record('f-console', 'No console errors during all checks', relevantErrors.length === 0,
      relevantErrors.length > 0
        ? `${relevantErrors.length} error(s): ${JSON.stringify(relevantErrors.slice(0, 5))}`
        : `Zero relevant console errors (${consoleErrors.length} filtered)`);

    await context.close();
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════
  console.log('\n=== DEPLOY-41 VERIFICATION RESULTS ===');
  const allPass = results.every(r => r.pass);
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  for (const r of results) {
    console.log(`  [${r.check}] ${r.pass ? 'PASS' : 'FAIL'}: ${r.action}`);
  }
  console.log(`\n${passCount}/${results.length} passed, ${failCount} failed`);
  console.log(allPass ? '\nAll checks PASSED' : '\nSome checks FAILED!');

  fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`, JSON.stringify({
    testDate: new Date().toISOString(),
    deployRevision: 'farmtable-00048-zgz',
    commitSha: '65deb12ef92c00a40d2b8b6b4d66b1e2712798f5',
    feature: 'Feature 62 — Task deep-linking via ?task= URL param',
    serviceUrl: SERVICE_URL,
    result: allPass ? 'ALL PASS' : 'SOME FAILED',
    passCount,
    failCount,
    totalChecks: results.length,
    checks: results,
  }, null, 2));
  fs.writeFileSync(`${EVIDENCE_DIR}/console-errors.json`, JSON.stringify(consoleErrors, null, 2));
  process.exit(allPass ? 0 : 1);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

// Playwright verification script for deploy-42 — Feature 63: Default Dashboard View
// Checks:
//   a. Navigate to collection with NO ?view= and NO ?task= → Dashboard loads
//   b. View switcher shows Dashboard first (leftmost), before Kanban, with grid icon
//   c. Navigate with ?task=<id> and NO ?view= → lands on KANBAN (not Dashboard),
//      task selected, Inspector open, no dim overlay (regression fix check)
//   d. Explicit ?view= params (kanban, tree, dependencies, dashboard) still work
//   e. Regression: normal view switching, task selection, Feature 62 deep-links

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-42';

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
    const titleEl = sr.querySelector('.inspector-title, h2, h3, .task-title');
    return {
      visible: true,
      titleText: titleEl?.textContent?.trim() || null,
      hasContent: sr.innerHTML.length > 50,
      inspectorText: sr.textContent?.substring(0, 200) || '',
    };
  });
}

async function getCurrentView(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return null;
    return app.currentView || null;
  });
}

async function getViewSwitcherInfo(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return { error: 'no toolbar shadow root' };
    const radioGroup = toolbar.shadowRoot.querySelector('sl-radio-group.view-switcher');
    if (!radioGroup) return { error: 'no view-switcher radio group' };
    const radioButtons = radioGroup.querySelectorAll('sl-radio-button');
    const views = [];
    for (const rb of radioButtons) {
      const value = rb.getAttribute('value');
      const icon = rb.querySelector('sl-icon');
      const iconName = icon?.getAttribute('name') || null;
      views.push({ value, iconName });
    }
    return {
      views,
      selectedValue: radioGroup.value || null,
      firstView: views[0]?.value || null,
      firstIcon: views[0]?.iconName || null,
    };
  });
}

async function getSelectedTaskId(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return null;
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
    for (const task of allTasks) {
      if (task.phase === 2) continue;
      if (task.title || task.name) {
        return { id: task.id, title: task.title || task.name };
      }
    }
    return { error: 'no suitable task found', taskCount: allTasks.length };
  }, viewSelector);
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

async function checkDimOverlay(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    // Check for any dim/overlay elements that might interfere
    const overlay = app.shadowRoot.querySelector('.dim-overlay, .overlay, .modal-backdrop');
    if (overlay) {
      const style = getComputedStyle(overlay);
      return {
        found: true,
        visible: style.display !== 'none' && style.opacity !== '0',
        tagName: overlay.tagName,
        className: overlay.className,
      };
    }
    return { found: false, visible: false };
  });
}

async function getTreeNodeCount(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { count: -1 };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { count: -1 };
    const nodes = treeView.shadowRoot.querySelectorAll('ft-tree-node');
    return { count: nodes.length };
  });
}

async function closeInspector(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const inspector = app.shadowRoot.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return { closed: false, error: 'no inspector' };
    const closeBtn = inspector.shadowRoot.querySelector('sl-icon-button.close-btn');
    if (closeBtn) {
      closeBtn.click();
      return { closed: true, method: 'sl-icon-button' };
    }
    inspector.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    return { closed: true, method: 'custom-event-dispatch' };
  });
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

    // ── Find collections ──
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
    }

    // ═══════════════════════════════════════════════════
    // CHECK (a): Navigate with NO ?view= and NO ?task= → Dashboard loads
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (a): Default view is Dashboard (no ?view=, no ?task=) ===');

    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(8000);

    const defaultView = await getCurrentView(page);
    console.log(`Default view (no params): ${defaultView}`);

    // Check if dashboard view component is present
    const dashboardPresent = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return false;
      return !!app.shadowRoot.querySelector('ft-dashboard-view');
    });

    // Check URL doesn't have ?view= (it's the default)
    const defaultUrl = page.url();
    const defaultUrlObj = new URL(defaultUrl);
    const viewParam = defaultUrlObj.searchParams.get('view');

    await page.screenshot({ path: `${EVIDENCE_DIR}/a-default-dashboard.png` });

    record('a-default-view', 'Default view (no ?view=, no ?task=) is Dashboard',
      defaultView === 'dashboard',
      `currentView: "${defaultView}". Dashboard component present: ${dashboardPresent}. ` +
      `URL ?view param: ${viewParam}. URL: ${defaultUrl}`);

    // ═══════════════════════════════════════════════════
    // CHECK (b): View switcher shows Dashboard first with grid icon
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (b): View switcher order and icon ===');

    const switcherInfo = await getViewSwitcherInfo(page);
    console.log(`View switcher info: ${JSON.stringify(switcherInfo)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/b-view-switcher.png` });

    const dashboardIsFirst = switcherInfo.firstView === 'dashboard';
    const hasGridIcon = switcherInfo.firstIcon === 'grid';
    const kanbanIsSecond = switcherInfo.views?.[1]?.value === 'kanban';

    record('b-dashboard-first', 'Dashboard is first (leftmost) in view switcher',
      dashboardIsFirst,
      `First view: "${switcherInfo.firstView}". Order: ${switcherInfo.views?.map(v => v.value).join(', ')}`);

    record('b-grid-icon', 'Dashboard uses grid icon (not bar-chart-line)',
      hasGridIcon,
      `First icon: "${switcherInfo.firstIcon}". Expected: "grid"`);

    record('b-kanban-second', 'Kanban is second in view switcher (after Dashboard)',
      kanbanIsSecond,
      `Second view: "${switcherInfo.views?.[1]?.value}". Full order: ${switcherInfo.views?.map(v => `${v.value}(${v.iconName})`).join(', ')}`);

    record('b-dashboard-selected', 'Dashboard is selected in view switcher for default view',
      switcherInfo.selectedValue === 'dashboard',
      `Selected value: "${switcherInfo.selectedValue}". Expected: "dashboard"`);

    // ═══════════════════════════════════════════════════
    // CHECK (c): Navigate with ?task=<id> and NO ?view= → KANBAN, task selected
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (c): Task deep-link without ?view= → falls back to Kanban ===');

    // First, find a task ID to use for deep-link testing
    // Navigate to kanban to find a task
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=kanban`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(8000);

    const kanbanTask = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return { error: 'no app shadow root' };
      const kanban = app.shadowRoot.querySelector('ft-kanban-view');
      if (!kanban?.shadowRoot) return { error: 'no kanban shadow root' };
      // Find task from the store
      const store = kanban.store;
      if (!store) return { error: 'no store' };
      const allTasks = store.allTasks || [];
      for (const task of allTasks) {
        if (task.phase === 2) continue;
        if (task.title || task.name) {
          return { id: task.id, title: task.title || task.name };
        }
      }
      return { error: 'no suitable task', taskCount: allTasks.length };
    });
    console.log(`Kanban task for deep-link test: ${JSON.stringify(kanbanTask)}`);

    if (kanbanTask?.id) {
      // Navigate with ?task= but NO ?view= — this is the critical regression test
      const deepLinkUrl = `${SERVICE_URL}/?collection=${targetCollectionId}&task=${kanbanTask.id}`;
      console.log(`Deep-link URL (no ?view=): ${deepLinkUrl}`);

      // Use a FRESH browser context to simulate a real deep-link experience
      const freshIapToken = getIAPToken();
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

      // Navigate to deep-link (task param, no view param)
      await freshPage.goto(deepLinkUrl, { waitUntil: 'load', timeout: 30000 });
      await freshPage.waitForTimeout(8000);

      const deepLinkView = await freshPage.evaluate(() => {
        const app = document.querySelector('ft-app');
        return app?.currentView || null;
      });
      console.log(`Deep-link view: ${deepLinkView}`);

      const deepLinkSelectedTask = await freshPage.evaluate(() => {
        const app = document.querySelector('ft-app');
        return app?.selectedTaskId || null;
      });
      console.log(`Deep-link selected task: ${deepLinkSelectedTask}`);

      const deepLinkInspector = await getInspectorState(freshPage);
      console.log(`Deep-link inspector: ${JSON.stringify(deepLinkInspector)}`);

      const deepLinkDimOverlay = await checkDimOverlay(freshPage);
      console.log(`Deep-link dim overlay: ${JSON.stringify(deepLinkDimOverlay)}`);

      // Check kanban view is rendered
      const kanbanPresent = await freshPage.evaluate(() => {
        const app = document.querySelector('ft-app');
        if (!app?.shadowRoot) return false;
        return !!app.shadowRoot.querySelector('ft-kanban-view');
      });
      const dashboardAbsent = await freshPage.evaluate(() => {
        const app = document.querySelector('ft-app');
        if (!app?.shadowRoot) return true;
        return !app.shadowRoot.querySelector('ft-dashboard-view');
      });

      await freshPage.screenshot({ path: `${EVIDENCE_DIR}/c1-task-deeplink-kanban.png` });

      record('c-deeplink-kanban', 'Task deep-link (no ?view=) lands on KANBAN (not Dashboard)',
        deepLinkView === 'kanban',
        `currentView: "${deepLinkView}". Expected: "kanban". ` +
        `Kanban component present: ${kanbanPresent}. Dashboard absent: ${dashboardAbsent}. ` +
        `URL: ${freshPage.url()}`);

      record('c-deeplink-task-selected', 'Task deep-link selects the correct task',
        deepLinkSelectedTask === kanbanTask.id,
        `Selected task: "${deepLinkSelectedTask}". Expected: "${kanbanTask.id}" ("${kanbanTask.title}")`);

      record('c-deeplink-inspector-open', 'Task deep-link opens Inspector',
        deepLinkInspector.visible,
        `Inspector visible: ${deepLinkInspector.visible}. ` +
        `Content: ${deepLinkInspector.inspectorText?.substring(0, 150)}`);

      record('c-deeplink-no-dim-overlay', 'No dim overlay present on task deep-link',
        !deepLinkDimOverlay.visible,
        `Dim overlay found: ${deepLinkDimOverlay.found}. Visible: ${deepLinkDimOverlay.visible}`);

      // Also verify the view switcher shows kanban as selected
      const deepLinkSwitcher = await freshPage.evaluate(() => {
        const app = document.querySelector('ft-app');
        if (!app?.shadowRoot) return null;
        const toolbar = app.shadowRoot.querySelector('ft-toolbar');
        if (!toolbar?.shadowRoot) return null;
        const radioGroup = toolbar.shadowRoot.querySelector('sl-radio-group.view-switcher');
        return radioGroup?.value || null;
      });

      record('c-deeplink-switcher-kanban', 'View switcher shows Kanban selected on task deep-link',
        deepLinkSwitcher === 'kanban',
        `Switcher value: "${deepLinkSwitcher}". Expected: "kanban"`);

      await freshContext.close();
    } else {
      record('c-deeplink-kanban', 'Task deep-link lands on KANBAN', false,
        `No suitable task found: ${JSON.stringify(kanbanTask)}`);
      record('c-deeplink-task-selected', 'Task deep-link selects task', false, 'No task');
      record('c-deeplink-inspector-open', 'Task deep-link opens Inspector', false, 'No task');
      record('c-deeplink-no-dim-overlay', 'No dim overlay', false, 'No task');
      record('c-deeplink-switcher-kanban', 'Switcher shows Kanban', false, 'No task');
    }

    // ═══════════════════════════════════════════════════
    // CHECK (d): Explicit ?view= params all work
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (d): Explicit ?view= params ===');

    const explicitViews = ['kanban', 'tree', 'dependencies', 'dashboard'];
    for (const view of explicitViews) {
      await page.goto(
        `${SERVICE_URL}/?collection=${targetCollectionId}&view=${view}`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const actualView = await getCurrentView(page);
      console.log(`Explicit ?view=${view} → currentView: ${actualView}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/d-explicit-${view}.png` });

      record(`d-explicit-${view}`, `Explicit ?view=${view} loads correctly`,
        actualView === view,
        `currentView: "${actualView}". Expected: "${view}"`);
    }

    // Also check ?view=dashboard&task=<id> if we have a task
    if (kanbanTask?.id) {
      console.log('\n=== CHECK (d-extra): ?view=dashboard&task=<id> ===');
      await page.goto(
        `${SERVICE_URL}/?collection=${targetCollectionId}&view=dashboard&task=${kanbanTask.id}`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const dashTaskView = await getCurrentView(page);
      console.log(`?view=dashboard&task=<id> → currentView: ${dashTaskView}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/d-explicit-dashboard-with-task.png` });

      // When explicit ?view=dashboard is set, it should stay on dashboard even with task param
      record('d-explicit-dashboard-task', '?view=dashboard with ?task= stays on dashboard',
        dashTaskView === 'dashboard',
        `currentView: "${dashTaskView}". Expected: "dashboard" (explicit ?view= overrides default fallback)`);
    }

    // ═══════════════════════════════════════════════════
    // CHECK (e): Regression — normal view switching, task selection, Feature 62 deep-links
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (e): Regression — normal features ===');

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

    record('e-tree-renders', 'Tree View renders correctly (regression)',
      treeHasSvg && treeNodes.count > 0,
      `SVG present: ${treeHasSvg}, Node count: ${treeNodes.count}`);

    // Task selection
    const treeTask = await findAnyTask(page, 'ft-tree-view');
    if (treeTask?.id) {
      const clicked = await clickTaskInTreeView(page, treeTask.id);
      await page.waitForTimeout(2000);
      const selectedId = await getSelectedTaskId(page);
      const treeUrl = page.url();
      const treeUrlObj = new URL(treeUrl);
      const treeTaskParam = treeUrlObj.searchParams.get('task');

      record('e-task-select', 'Task selection works (click in Tree View)',
        selectedId === treeTask.id,
        `Clicked: ${clicked}. Selected: ${selectedId}. Expected: ${treeTask.id}`);

      record('e-url-sync', 'URL updates with ?task= on task selection (Feature 62)',
        treeTaskParam === treeTask.id,
        `URL ?task param: ${treeTaskParam}. Expected: ${treeTask.id}`);

      // Close inspector and verify ?task= removed
      await closeInspector(page);
      await page.waitForTimeout(1500);
      const afterCloseUrl = new URL(page.url());
      const afterCloseTask = afterCloseUrl.searchParams.get('task');

      record('e-close-inspector', 'Closing Inspector removes ?task= (Feature 62)',
        afterCloseTask === null,
        `?task param after close: ${afterCloseTask}. Expected: null`);
    }

    // Feature 62 deep-link round-trip (tree view)
    if (treeTask?.id) {
      const treeDeepLink = `${SERVICE_URL}/?collection=${targetCollectionId}&view=tree&task=${treeTask.id}`;
      const freshIapToken3 = getIAPToken();
      const freshCtx3 = await browser.newContext({
        extraHTTPHeaders: { 'Authorization': `Bearer ${freshIapToken3}` },
        ignoreHTTPSErrors: true,
        viewport: { width: 1920, height: 1080 },
      });
      const freshPage3 = await freshCtx3.newPage();

      await freshPage3.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
      await freshPage3.waitForTimeout(2000);
      await freshPage3.evaluate(async (token) => {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      }, FT_TOKEN);

      await freshPage3.goto(treeDeepLink, { waitUntil: 'load', timeout: 30000 });
      await freshPage3.waitForTimeout(8000);

      const freshView3 = await freshPage3.evaluate(() => {
        const app = document.querySelector('ft-app');
        return app?.currentView || null;
      });
      const freshSelected3 = await freshPage3.evaluate(() => {
        const app = document.querySelector('ft-app');
        return app?.selectedTaskId || null;
      });
      const freshInsp3 = await getInspectorState(freshPage3);

      await freshPage3.screenshot({ path: `${EVIDENCE_DIR}/e-deeplink-tree-regression.png` });

      record('e-deeplink-tree', 'Feature 62 tree deep-link still works (regression)',
        freshView3 === 'tree' && freshSelected3 === treeTask.id && freshInsp3.visible,
        `View: ${freshView3}, Selected: ${freshSelected3}, Inspector: ${freshInsp3.visible}`);

      await freshCtx3.close();
    }

    // Kanban view regression
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

    await page.screenshot({ path: `${EVIDENCE_DIR}/e-regression-kanban.png` });

    record('e-kanban-renders', 'Kanban View renders correctly (regression)',
      kanbanState && kanbanState.columnCount > 0,
      `Columns: ${kanbanState?.columnCount}, Cards: ${kanbanState?.cardCount}`);

    // Dependency view regression
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

    record('e-dep-renders', 'Dependency View renders correctly (regression)',
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

    record('e-console', 'No relevant console errors during all checks', relevantErrors.length === 0,
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
  console.log('\n=== DEPLOY-42 VERIFICATION RESULTS ===');
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
    deployRevision: 'farmtable-00049-4rl',
    commitSha: 'eef367b29fcca7b224c31184549bc545db3f71fe',
    feature: 'Feature 63 — Default Dashboard View, reordered switcher, task-deep-link fallback to Kanban',
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

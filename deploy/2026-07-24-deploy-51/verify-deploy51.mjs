// Playwright verification script for deploy-51 — CLOSED-task Solo fix
// PR #158: fix(dependency): show CLOSED task relationships in Solo mode
//
// Checks:
//   4(a): CLOSED task Solo mode — selecting a CLOSED task with BLOCKS relationships
//         and enabling Solo mode shows those relationships (not "No dependency relationships")
//   4(b): NORMAL (non-Solo) Dependency View still hides CLOSED tasks
//   4(c): Unrelated CLOSED tasks stay hidden even when Solo is on for a different task
//   5:    Regression — Perf Phase 2 viewport culling (deploy-49) still works
//   5:    Regression — Feature 67 LR default + layout toggle (deploy-50) still works

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-51';

// The original repro IDs from the brief
const REPRO_COLLECTION = '7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7';
const REPRO_TASK = '9f7731a8-a23d-493d-86eb-2ac5d39f5e7a';

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

async function getAppState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'no ft-app' };
    return {
      currentView: app.currentView,
      selectedTaskId: app.selectedTaskId,
      isolateMode: app.isolateMode,
      layoutOrientation: app.layoutOrientation,
      currentUrl: window.location.href,
    };
  });
}

async function getCollections(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return [];
    const picker = app.shadowRoot.querySelector('ft-collection-list');
    if (!picker?.collections) return [];
    return picker.collections.map(c => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      external: c.platform !== 1,
    }));
  });
}

async function getDependencyViewState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const totalLayoutNodes = depView.layoutNodes ? depView.layoutNodes.length : 0;
    const totalLayoutEdges = depView.layoutEdges ? depView.layoutEdges.length : 0;

    const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg') ||
                         depView.shadowRoot.querySelector('svg');
    const foreignObjects = svgContainer?.querySelectorAll('foreignObject') || [];
    const domNodeCount = foreignObjects.length;
    const edgePaths = svgContainer?.querySelectorAll('.edge-dependency') || [];
    const domEdgeCount = edgePaths.length;

    // Check for "No dependency relationships" message
    const noRelMsg = depView.shadowRoot.querySelector('.empty-state') ||
                     depView.shadowRoot.querySelector('.no-dependencies');
    const emptyStateText = noRelMsg?.textContent?.trim() || '';

    // Also search all text content in shadow root for the message
    const allText = depView.shadowRoot.textContent || '';
    const hasNoDepsMessage = allText.includes('No dependency relationships');

    const panX = depView.panX;
    const panY = depView.panY;
    const scale = depView.scale;

    return {
      totalLayoutNodes,
      totalLayoutEdges,
      domNodeCount,
      domEdgeCount,
      panX, panY, scale,
      emptyStateText,
      hasNoDepsMessage,
    };
  });
}

async function getDependencyViewDetailedState(page) {
  // More detailed check — look for specific task nodes and their relationships
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const selectedTaskId = app.selectedTaskId;
    const isolateMode = app.isolateMode;
    const currentUrl = window.location.href;

    // Get info about rendered nodes
    const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg') ||
                         depView.shadowRoot.querySelector('svg');
    const foreignObjects = svgContainer ? Array.from(svgContainer.querySelectorAll('foreignObject')) : [];

    // Check if selected task is among rendered nodes
    const renderedNodeIds = [];
    for (const fo of foreignObjects) {
      const taskCard = fo.querySelector('.task-node') || fo.querySelector('[data-task-id]');
      const taskId = taskCard?.dataset?.taskId || fo.dataset?.taskId || fo.id || '';
      if (taskId) renderedNodeIds.push(taskId);
    }

    // Count edges
    const edgePaths = svgContainer?.querySelectorAll('.edge-dependency') || [];
    const domEdgeCount = edgePaths.length;

    // Layout data
    const layoutNodes = depView.layoutNodes || [];
    const layoutEdges = depView.layoutEdges || [];

    // Check for empty state
    const allText = depView.shadowRoot.textContent || '';
    const hasNoDepsMessage = allText.includes('No dependency relationships');

    // Check store for task details
    const store = app.store || depView.store;
    let selectedTaskInfo = null;
    if (store?.allTasks && selectedTaskId) {
      const task = store.allTasks.find(t => t.id === selectedTaskId);
      if (task) {
        selectedTaskInfo = {
          id: task.id,
          title: task.title,
          phase: task.phase,
          isClosed: task.phase === 4,
        };
      }
    }

    // Get task phases for visibility check
    const closedTasksInLayout = layoutNodes.filter(n => {
      if (!store?.allTasks) return false;
      const task = store.allTasks.find(t => t.id === n.id);
      return task && task.phase === 4;
    }).length;

    return {
      selectedTaskId,
      isolateMode,
      currentUrl,
      renderedNodeCount: foreignObjects.length,
      renderedNodeIds: renderedNodeIds.slice(0, 20),
      domEdgeCount,
      layoutNodeCount: layoutNodes.length,
      layoutEdgeCount: layoutEdges.length,
      hasNoDepsMessage,
      selectedTaskInfo,
      closedTasksInLayout,
      allText: allText.substring(0, 500),
    };
  });
}

async function getTreeViewState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { error: 'no tree view shadow root' };

    const layoutOrientation = treeView.layoutOrientation || 'unknown';
    const hierNav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');

    let orientationBtnInfo = null;
    let soloBtnInfo = null;

    if (hierNav?.shadowRoot) {
      const buttons = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
      for (const btn of buttons) {
        const icon = btn.querySelector('sl-icon');
        const iconName = icon?.getAttribute('name') || '';

        const styles = window.getComputedStyle(btn);
        const bgColor = styles.backgroundColor;
        const color = styles.color;
        const hasActiveClass = btn.classList.contains('active');

        if (iconName.includes('arrow-clockwise') || iconName.includes('arrow-counterclockwise')) {
          orientationBtnInfo = {
            found: true,
            iconName,
            hasActiveClass,
            backgroundColor: bgColor,
            color,
            classList: Array.from(btn.classList),
          };
        } else if (iconName.includes('fullscreen')) {
          soloBtnInfo = {
            found: true,
            iconName,
            hasActiveClass,
            backgroundColor: bgColor,
            color,
            classList: Array.from(btn.classList),
          };
        }
      }
    }

    const svgContainer = treeView.shadowRoot.querySelector('.canvas-container svg') ||
                         treeView.shadowRoot.querySelector('svg');
    const foreignObjects = svgContainer?.querySelectorAll('foreignObject') || [];
    const nodeCount = foreignObjects.length;

    const currentUrl = window.location.href;
    const urlParams = new URL(currentUrl).searchParams;
    const layoutdirParam = urlParams.get('layoutdir');

    return {
      layoutOrientation,
      orientationBtnInfo,
      soloBtnInfo,
      nodeCount,
      currentUrl,
      layoutdirParam,
    };
  });
}

async function clickOrientationToggle(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { error: 'no tree view shadow root' };
    const hierNav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');
    if (!hierNav?.shadowRoot) return { error: 'no hierarchy nav shadow root' };

    const buttons = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
    for (const btn of buttons) {
      const icon = btn.querySelector('sl-icon');
      const iconName = icon?.getAttribute('name') || '';
      if (iconName.includes('arrow-clockwise') || iconName.includes('arrow-counterclockwise')) {
        btn.click();
        return { clicked: true, previousIcon: iconName };
      }
    }
    return { error: 'orientation toggle button not found' };
  });
}

async function getClosedTasksInfo(page) {
  // Get info about closed tasks and their relationships
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { error: 'no ft-app' };
    const store = app.store;
    if (!store?.allTasks) return { error: 'no store or tasks' };

    const closedTasks = store.allTasks.filter(t => t.phase === 4);
    const closedWithBlocks = closedTasks.filter(t => {
      // Check if this task has BLOCKS or BLOCKED_BY relationships
      const rels = store.relationships?.filter(r =>
        r.sourceId === t.id || r.targetId === t.id
      ) || [];
      return rels.length > 0;
    });

    return {
      totalTasks: store.allTasks.length,
      closedTasks: closedTasks.length,
      closedWithRelationships: closedWithBlocks.length,
      closedTaskSample: closedTasks.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title?.substring(0, 60),
        phase: t.phase,
      })),
    };
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
    console.log('\n=== Finding collections ===');
    const collections = await getCollections(page);
    console.log(`Found ${collections.length} collections`);
    for (const c of collections) {
      console.log(`  ${c.name} (${c.id}) external=${c.external}`);
    }

    // Check if we can reach the original repro collection
    const reproCollectionAvailable = collections.some(c => c.id === REPRO_COLLECTION);
    console.log(`Original repro collection available: ${reproCollectionAvailable}`);

    let nativeCollection = collections.find(c => !c.external) || collections[0];
    console.log(`Default native collection: ${nativeCollection?.name} (${nativeCollection?.id})`);

    // ═══════════════════════════════════════════════════
    // CHECK 4(a): CLOSED task Solo mode shows relationships
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(a): CLOSED task Solo mode shows BLOCKS relationships ===');

    let testCollection = REPRO_COLLECTION;
    let testTask = REPRO_TASK;
    let usingOriginalRepro = reproCollectionAvailable;

    if (usingOriginalRepro) {
      console.log(`Using original repro: collection=${REPRO_COLLECTION}, task=${REPRO_TASK}`);
    } else {
      console.log('Original repro collection not available. Finding alternative CLOSED task with relationships...');
      // Use the native collection and find a closed task with relationships
      testCollection = nativeCollection.id;

      // Navigate to dependency view to load tasks
      await page.goto(
        `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(6000);

      const closedInfo = await getClosedTasksInfo(page);
      console.log(`Closed tasks info: ${JSON.stringify(closedInfo, null, 2)}`);

      // Find a closed task with relationships from the store
      const closedTaskWithRels = await page.evaluate(() => {
        const app = document.querySelector('ft-app');
        if (!app?.store?.allTasks) return null;
        const store = app.store;

        for (const task of store.allTasks) {
          if (task.phase !== 4) continue;  // Not closed
          const rels = (store.relationships || []).filter(r =>
            r.sourceId === task.id || r.targetId === task.id
          );
          if (rels.length > 0) {
            return {
              id: task.id,
              title: task.title,
              phase: task.phase,
              relationshipCount: rels.length,
              relationships: rels.slice(0, 5).map(r => ({
                type: r.type,
                sourceId: r.sourceId,
                targetId: r.targetId,
              })),
            };
          }
        }
        return null;
      });

      if (closedTaskWithRels) {
        testTask = closedTaskWithRels.id;
        console.log(`Found alternative CLOSED task: ${closedTaskWithRels.title} (${closedTaskWithRels.id})`);
        console.log(`  Relationships: ${closedTaskWithRels.relationshipCount}`);
      } else {
        testTask = null;
        console.log('WARNING: No closed task with relationships found for testing');
      }
    }

    if (testTask) {
      // Navigate to dependency view with the CLOSED task selected and Solo mode enabled
      const soloUrl = `${SERVICE_URL}/?collection=${testCollection}&view=dependencies&task=${testTask}&solo=1`;
      console.log(`Navigating to Solo mode URL: ${soloUrl}`);
      await page.goto(soloUrl, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(8000);

      const soloState = await getDependencyViewDetailedState(page);
      console.log(`Solo state: ${JSON.stringify(soloState, null, 2)}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/4a-closed-task-solo.png` });

      // The fix should show relationships, not "No dependency relationships"
      const showsRelationships = !soloState.hasNoDepsMessage && soloState.layoutNodeCount > 0;
      const expectedEdges = usingOriginalRepro ? 3 : 1;  // original repro has 3 BLOCKS

      record('4a-closed-solo-shows-relationships',
        `CLOSED task in Solo mode shows BLOCKS relationships (${usingOriginalRepro ? 'original repro' : 'alternative task'})`,
        showsRelationships,
        `hasNoDepsMessage: ${soloState.hasNoDepsMessage} (expected false — fix should show relationships). ` +
        `Layout nodes: ${soloState.layoutNodeCount}. Layout edges: ${soloState.layoutEdgeCount}. ` +
        `DOM nodes: ${soloState.renderedNodeCount}. DOM edges: ${soloState.domEdgeCount}. ` +
        `Selected task: ${soloState.selectedTaskInfo?.title || testTask}. ` +
        `Task is closed: ${soloState.selectedTaskInfo?.isClosed}. ` +
        `Using original repro: ${usingOriginalRepro}. ` +
        (usingOriginalRepro
          ? `Expected ≥3 BLOCKS edges (got ${soloState.layoutEdgeCount}).`
          : `Expected ≥1 edges (got ${soloState.layoutEdgeCount}).`));

      if (usingOriginalRepro) {
        // Additional check: verify at least 3 BLOCKS relationships for the specific repro
        const has3Blocks = soloState.layoutEdgeCount >= 3;
        record('4a-repro-3-blocks',
          'Original repro task shows all 3 BLOCKS relationships',
          has3Blocks,
          `Layout edges: ${soloState.layoutEdgeCount} (expected ≥3). ` +
          `Layout nodes: ${soloState.layoutNodeCount}. ` +
          `Task: ${REPRO_TASK}`);
      }
    } else {
      record('4a-closed-solo-shows-relationships',
        'CLOSED task in Solo mode shows BLOCKS relationships',
        false,
        'Could not find a CLOSED task with relationships to test');
    }

    // ═══════════════════════════════════════════════════
    // CHECK 4(b): NORMAL (non-Solo) Dependency View still hides CLOSED tasks
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(b): Non-Solo Dependency View hides CLOSED tasks ===');

    // Use the test collection for consistency
    const depCollectionId = testCollection || nativeCollection.id;
    await page.goto(
      `${SERVICE_URL}/?collection=${depCollectionId}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const normalDepState = await getDependencyViewDetailedState(page);
    console.log(`Normal dep view state: ${JSON.stringify(normalDepState, null, 2)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4b-normal-no-closed.png` });

    // In normal (non-Solo) mode, closed tasks should be hidden
    const normalHidesClosed = normalDepState.closedTasksInLayout === 0;

    record('4b-normal-hides-closed',
      'Non-Solo Dependency View hides CLOSED tasks (no regression)',
      normalHidesClosed,
      `Closed tasks in layout: ${normalDepState.closedTasksInLayout} (expected 0). ` +
      `Total layout nodes: ${normalDepState.layoutNodeCount}. ` +
      `isolateMode: ${normalDepState.isolateMode} (expected false/undefined). ` +
      `selectedTaskId: ${normalDepState.selectedTaskId}`);

    // ═══════════════════════════════════════════════════
    // CHECK 4(c): Unrelated CLOSED tasks still hidden in Solo mode
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(c): Unrelated CLOSED tasks hidden in Solo mode ===');

    // Find a non-closed task and solo it — closed tasks unrelated to it should be hidden
    const openTaskForSolo = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.store?.allTasks) return null;
      const store = app.store;

      // Find an OPEN task that has some relationships
      for (const task of store.allTasks) {
        if (task.phase === 4) continue;  // Skip closed
        const rels = (store.relationships || []).filter(r =>
          r.sourceId === task.id || r.targetId === task.id
        );
        if (rels.length > 0) {
          return {
            id: task.id,
            title: task.title,
            phase: task.phase,
            relationshipCount: rels.length,
          };
        }
      }
      return null;
    });

    if (openTaskForSolo) {
      console.log(`Using open task for Solo: ${openTaskForSolo.title} (${openTaskForSolo.id})`);
      await page.goto(
        `${SERVICE_URL}/?collection=${depCollectionId}&view=dependencies&task=${openTaskForSolo.id}&solo=1`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(6000);

      const soloOpenState = await getDependencyViewDetailedState(page);
      console.log(`Solo-open state: ${JSON.stringify(soloOpenState, null, 2)}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/4c-solo-open-no-unrelated-closed.png` });

      // Unrelated closed tasks should not appear in the layout
      const unrelatedClosedHidden = soloOpenState.closedTasksInLayout === 0;

      record('4c-unrelated-closed-hidden-in-solo',
        'Unrelated CLOSED tasks stay hidden when Solo is active for an OPEN task',
        unrelatedClosedHidden,
        `Closed tasks in solo layout: ${soloOpenState.closedTasksInLayout} (expected 0). ` +
        `Selected task: ${openTaskForSolo.title} (open, phase ${openTaskForSolo.phase}). ` +
        `Solo nodes: ${soloOpenState.layoutNodeCount}. Solo edges: ${soloOpenState.layoutEdgeCount}. ` +
        `isolateMode: ${soloOpenState.isolateMode}`);
    } else {
      record('4c-unrelated-closed-hidden-in-solo',
        'Unrelated CLOSED tasks stay hidden when Solo is active',
        false,
        'No open task with relationships found for testing');
    }

    // ═══════════════════════════════════════════════════
    // CHECK 5: Regression checks
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 5: Regression checks ===');

    // 5a: Dependency View with viewport culling (Perf Phase 2 — deploy-49)
    console.log('  Checking Dependency View viewport culling (deploy-49)...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const depState = await getDependencyViewState(page);
    console.log(`Dependency View state: ${JSON.stringify(depState, null, 2)}`);

    const cullingActive = depState.totalLayoutNodes > 0 && depState.domNodeCount > 0;
    const cullingCorrect = depState.domNodeCount <= depState.totalLayoutNodes;

    record('5-dependency-culling',
      'Dependency View loads with viewport culling (Perf Phase 2 from deploy-49)',
      cullingActive && cullingCorrect,
      `Layout nodes: ${depState.totalLayoutNodes}, DOM nodes: ${depState.domNodeCount}. ` +
      `Edges: ${depState.totalLayoutEdges} layout, ${depState.domEdgeCount} DOM. ` +
      `Culling correct (DOM ≤ layout): ${cullingCorrect}. Scale: ${depState.scale?.toFixed(3)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-dependency-culling.png` });

    // 5b: Tree View — default LR + layout toggle (Feature 67 — deploy-50)
    console.log('  Checking Tree View default LR orientation (deploy-50)...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const treeState = await getTreeViewState(page);
    console.log(`Tree state: ${JSON.stringify(treeState, null, 2)}`);

    const defaultIsLR = treeState.layoutOrientation === 'LR';
    const noLayoutdirParam = treeState.layoutdirParam === null;
    const noActiveOnOrientBtn = treeState.orientationBtnInfo && !treeState.orientationBtnInfo.hasActiveClass;

    record('5-tree-default-lr',
      'Tree View defaults to LR layout, no ?layoutdir= param (deploy-50 regression)',
      defaultIsLR && noLayoutdirParam,
      `Orientation: ${treeState.layoutOrientation} (expected LR). ` +
      `layoutdir param: ${treeState.layoutdirParam} (expected null). ` +
      `Node count: ${treeState.nodeCount}. ` +
      `Orientation btn icon: ${treeState.orientationBtnInfo?.iconName}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-tree-default-lr.png` });

    // Toggle to TB and back
    const toggleResult = await clickOrientationToggle(page);
    await page.waitForTimeout(2000);
    let treeStateTB = await getTreeViewState(page);

    const isTB = treeStateTB.layoutOrientation === 'TB';
    const hasLayoutdirTB = treeStateTB.layoutdirParam === 'TB';

    record('5-tree-toggle-tb',
      'Tree View toggles to TB, URL shows ?layoutdir=TB (deploy-50 regression)',
      isTB && hasLayoutdirTB,
      `Orientation after toggle: ${treeStateTB.layoutOrientation} (expected TB). ` +
      `layoutdir param: ${treeStateTB.layoutdirParam} (expected TB)`);

    // Toggle back to LR
    await clickOrientationToggle(page);
    await page.waitForTimeout(2000);
    let treeStateBack = await getTreeViewState(page);

    const backToLR = treeStateBack.layoutOrientation === 'LR';
    const paramRemoved = treeStateBack.layoutdirParam === null;

    record('5-tree-toggle-back-lr',
      'Tree View toggles back to LR, URL param removed (deploy-50 regression)',
      backToLR && paramRemoved,
      `Orientation after toggle back: ${treeStateBack.layoutOrientation} (expected LR). ` +
      `layoutdir param: ${treeStateBack.layoutdirParam} (expected null)`);

    // 5c: Dashboard
    console.log('  Checking Dashboard...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dashboard`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(4000);

    const dashState = await getAppState(page);

    record('5-dashboard',
      'Dashboard loads correctly',
      dashState.currentView === 'dashboard',
      `Current view: ${dashState.currentView}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-dashboard.png` });

    // 5d: Default view routing
    console.log('  Checking default view routing...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(4000);

    const defaultState = await getAppState(page);

    record('5-default-view-routing',
      'Default view routing works (should default to dashboard)',
      defaultState.currentView === 'dashboard',
      `Default view: ${defaultState.currentView}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-default-view.png` });

    // 5e: Console errors
    const relevantErrors = consoleErrors.filter(e =>
      !e.text.includes('net::ERR') && !e.text.includes('grpc') &&
      !e.text.includes('stream') && !e.text.includes('favicon') &&
      !e.text.includes('404') && !e.text.includes('401') &&
      !e.text.includes('auth/session')
    );

    record('5-console-errors',
      'No relevant console errors',
      relevantErrors.length === 0,
      `Total console errors: ${consoleErrors.length}, relevant: ${relevantErrors.length}. ` +
      (relevantErrors.length > 0 ? `Errors: ${JSON.stringify(relevantErrors.slice(0, 5))}` : 'Clean'));

    // ── Save results ──
    fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`,
      JSON.stringify(results, null, 2));
    fs.writeFileSync(`${EVIDENCE_DIR}/console-errors.json`,
      JSON.stringify(consoleErrors, null, 2));

    // ── Summary ──
    console.log('\n\n═══════════════════════════════════════════');
    console.log('  DEPLOY-51 VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════');

    let allPass = true;
    for (const r of results) {
      const status = r.pass ? 'PASS' : 'FAIL';
      if (!r.pass) allPass = false;
      console.log(`  [${status}] ${r.check}: ${r.action}`);
    }

    console.log(`\n  Overall: ${allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
    console.log(`  Total checks: ${results.length}`);
    console.log(`  Passed: ${results.filter(r => r.pass).length}`);
    console.log(`  Failed: ${results.filter(r => !r.pass).length}`);
    console.log('═══════════════════════════════════════════\n');

  } catch (err) {
    console.error('FATAL ERROR:', err);
    record('fatal', 'Script execution', false, err.message, err.stack);
    fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`,
      JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

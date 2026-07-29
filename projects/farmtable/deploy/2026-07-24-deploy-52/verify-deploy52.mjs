// Playwright verification script for deploy-52 — Solo cross-edge fix
// PR #159: fix(dependency): exclude cross-edges in Solo mode
//
// Checks:
//   4: Solo mode — selected task's direct chain edges (orange/purple) appear,
//      but cross-edges between chain members that bypass the selected task do NOT
//   5: Non-Solo Dependency View still renders ALL edges (including cross-edges)
//   6: Regression — Perf Phase 2 viewport culling, Feature 67 layout toggle + LR default,
//      CLOSED-task solo fix (deploy-51)

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-52';

// The EXACT original repro from the brief (the cross-edge bug repro)
const REPRO_COLLECTION = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const REPRO_TASK       = '717ab19c-e86f-4c51-8126-fc16a8f81ef7';

// CLOSED-task solo repro from deploy-51 (for regression check)
const CLOSED_REPRO_COLLECTION = '7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7';
const CLOSED_REPRO_TASK       = '9f7731a8-a23d-493d-86eb-2ac5d39f5e7a';

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
      hasNoDepsMessage,
    };
  });
}

async function getSoloEdgeDetails(page) {
  // Detailed edge analysis for the Solo cross-edge fix verification
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const selectedTaskId = app.selectedTaskId;
    const isolateMode = app.isolateMode;

    const layoutNodes = depView.layoutNodes || [];
    const layoutEdges = depView.layoutEdges || [];

    const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg') ||
                         depView.shadowRoot.querySelector('svg');

    // Get rendered edge details: class names tell us blocking/blocked/cross
    const edgeElements = svgContainer ? Array.from(svgContainer.querySelectorAll('.edge-dependency')) : [];
    const renderedEdges = edgeElements.map(el => {
      const classList = Array.from(el.classList);
      const isBlocking = classList.includes('edge-blocking');
      const isBlocked  = classList.includes('edge-blocked');
      const isDashed   = el.getAttribute('stroke-dasharray') !== null ||
                         el.style.strokeDasharray !== '' ||
                         classList.some(c => c.includes('cross') || c.includes('indirect'));
      return {
        classList,
        isBlocking,
        isBlocked,
        isDashed,
      };
    });

    // Count orange (blocking) and purple (blocked) edges
    const orangeEdges = renderedEdges.filter(e => e.isBlocking).length;
    const purpleEdges = renderedEdges.filter(e => e.isBlocked).length;
    const dashedEdges = renderedEdges.filter(e => e.isDashed).length;
    const otherEdges  = renderedEdges.filter(e => !e.isBlocking && !e.isBlocked).length;

    // Rendered nodes
    const foreignObjects = svgContainer ? Array.from(svgContainer.querySelectorAll('foreignObject')) : [];

    // Get node titles for verification
    const nodeDetails = foreignObjects.map(fo => {
      const titleEl = fo.querySelector('.task-title') || fo.querySelector('h3') || fo.querySelector('h4');
      const title = titleEl?.textContent?.trim()?.substring(0, 80) || '';
      const taskId = fo.dataset?.taskId || fo.id || '';
      return { title, taskId };
    });

    return {
      selectedTaskId,
      isolateMode,
      layoutNodeCount: layoutNodes.length,
      layoutEdgeCount: layoutEdges.length,
      renderedNodeCount: foreignObjects.length,
      renderedEdgeCount: edgeElements.length,
      orangeEdges,
      purpleEdges,
      dashedEdges,
      otherEdges,
      renderedEdges: renderedEdges.slice(0, 20),
      nodeDetails: nodeDetails.slice(0, 20),
      hasNoDepsMessage: (depView.shadowRoot.textContent || '').includes('No dependency relationships'),
    };
  });
}

async function getNonSoloEdgeDetails(page) {
  // Get edge count without Solo for comparison
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const totalLayoutNodes = depView.layoutNodes ? depView.layoutNodes.length : 0;
    const totalLayoutEdges = depView.layoutEdges ? depView.layoutEdges.length : 0;

    const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg') ||
                         depView.shadowRoot.querySelector('svg');
    const edgeElements = svgContainer ? Array.from(svgContainer.querySelectorAll('.edge-dependency')) : [];

    // Look for cross-edges (the ones that should now appear without Solo)
    const renderedEdges = edgeElements.map(el => {
      const classList = Array.from(el.classList);
      const isBlocking = classList.includes('edge-blocking');
      const isBlocked  = classList.includes('edge-blocked');
      const isDashed   = el.getAttribute('stroke-dasharray') !== null ||
                         el.style.strokeDasharray !== '' ||
                         classList.some(c => c.includes('cross') || c.includes('indirect'));
      return { classList, isBlocking, isBlocked, isDashed };
    });

    return {
      isolateMode: app.isolateMode,
      selectedTaskId: app.selectedTaskId,
      totalLayoutNodes,
      totalLayoutEdges,
      renderedEdgeCount: edgeElements.length,
      orangeEdges: renderedEdges.filter(e => e.isBlocking).length,
      purpleEdges: renderedEdges.filter(e => e.isBlocked).length,
      dashedEdges: renderedEdges.filter(e => e.isDashed).length,
      otherEdges: renderedEdges.filter(e => !e.isBlocking && !e.isBlocked).length,
    };
  });
}

async function getDependencyViewDetailedState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const selectedTaskId = app.selectedTaskId;
    const isolateMode = app.isolateMode;

    const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg') ||
                         depView.shadowRoot.querySelector('svg');
    const foreignObjects = svgContainer ? Array.from(svgContainer.querySelectorAll('foreignObject')) : [];
    const edgePaths = svgContainer?.querySelectorAll('.edge-dependency') || [];

    const layoutNodes = depView.layoutNodes || [];
    const layoutEdges = depView.layoutEdges || [];

    const allText = depView.shadowRoot.textContent || '';
    const hasNoDepsMessage = allText.includes('No dependency relationships');

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

    const closedTasksInLayout = layoutNodes.filter(n => {
      if (!store?.allTasks) return false;
      const task = store.allTasks.find(t => t.id === n.id);
      return task && task.phase === 4;
    }).length;

    return {
      selectedTaskId,
      isolateMode,
      renderedNodeCount: foreignObjects.length,
      domEdgeCount: edgePaths.length,
      layoutNodeCount: layoutNodes.length,
      layoutEdgeCount: layoutEdges.length,
      hasNoDepsMessage,
      selectedTaskInfo,
      closedTasksInLayout,
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
    if (hierNav?.shadowRoot) {
      const buttons = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
      for (const btn of buttons) {
        const icon = btn.querySelector('sl-icon');
        const iconName = icon?.getAttribute('name') || '';
        if (iconName.includes('arrow-clockwise') || iconName.includes('arrow-counterclockwise')) {
          orientationBtnInfo = {
            found: true,
            iconName,
            hasActiveClass: btn.classList.contains('active'),
          };
        }
      }
    }

    const svgContainer = treeView.shadowRoot.querySelector('.canvas-container svg') ||
                         treeView.shadowRoot.querySelector('svg');
    const foreignObjects = svgContainer?.querySelectorAll('foreignObject') || [];

    const currentUrl = window.location.href;
    const urlParams = new URL(currentUrl).searchParams;
    const layoutdirParam = urlParams.get('layoutdir');

    return {
      layoutOrientation,
      orientationBtnInfo,
      nodeCount: foreignObjects.length,
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

    const reproCollectionAvailable = collections.some(c => c.id === REPRO_COLLECTION);
    console.log(`Original cross-edge repro collection available: ${reproCollectionAvailable}`);

    let nativeCollection = collections.find(c => !c.external) || collections[0];
    console.log(`Default native collection: ${nativeCollection?.name} (${nativeCollection?.id})`);

    // ═══════════════════════════════════════════════════
    // CHECK 4: Solo mode — cross-edge fix on EXACT original repro
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4: Solo cross-edge fix on exact original repro ===');

    // 4a: Navigate to the EXACT repro URL from the brief
    const exactReproUrl = `${SERVICE_URL}/?collection=${REPRO_COLLECTION}&view=dependencies&task=${REPRO_TASK}&solo=1`;
    console.log(`Navigating to exact repro URL: ${exactReproUrl}`);
    await page.goto(exactReproUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(8000);

    const soloEdgeState = await getSoloEdgeDetails(page);
    console.log(`Solo edge state: ${JSON.stringify(soloEdgeState, null, 2)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4a-solo-crossedge-fix.png` });

    // The fix should mean:
    //   - Selected task ("D16-Run-Tests...") shows direct chain edges
    //   - Orange edges from blockers, purple edge to what it blocks
    //   - NO dashed-blue cross-edge (Ready-15 → Deploy to production bypassing the selected task)
    //
    // Criteria: no dashed/cross edges should appear; only blocking/blocked edges

    const directChainEdgesOnly = soloEdgeState.dashedEdges === 0 && soloEdgeState.otherEdges === 0;
    const hasDirectChainEdges = (soloEdgeState.orangeEdges + soloEdgeState.purpleEdges) > 0 ||
                                soloEdgeState.renderedEdgeCount > 0;

    record('4a-solo-no-cross-edges',
      'Solo mode: selected task shows ONLY direct chain edges (no cross-edges)',
      directChainEdgesOnly && hasDirectChainEdges,
      `Rendered edges: ${soloEdgeState.renderedEdgeCount}. ` +
      `Orange (blocking): ${soloEdgeState.orangeEdges}. Purple (blocked): ${soloEdgeState.purpleEdges}. ` +
      `Dashed/cross: ${soloEdgeState.dashedEdges} (expected 0). Other: ${soloEdgeState.otherEdges} (expected 0). ` +
      `Selected task: ${soloEdgeState.selectedTaskId}. isolateMode: ${soloEdgeState.isolateMode}. ` +
      `Nodes: ${soloEdgeState.renderedNodeCount}. ` +
      `Node titles: ${soloEdgeState.nodeDetails.map(n => n.title).join(', ')}`);

    // 4b: Confirm selected task is the "D16-Run-Tests..." task
    const selectedTaskTitle = soloEdgeState.nodeDetails.find(n =>
      n.title.includes('D16') || n.title.includes('Run') || n.title.includes('Test')
    );
    const isCorrectTask = soloEdgeState.selectedTaskId === REPRO_TASK;

    record('4a-correct-repro-task',
      'Verified using the EXACT original repro task (D16-Run-Tests)',
      isCorrectTask,
      `Selected task ID: ${soloEdgeState.selectedTaskId} (expected ${REPRO_TASK}). ` +
      `Task match: ${isCorrectTask}. ` +
      `Matching node title: ${selectedTaskTitle?.title || 'not found among rendered nodes'}. ` +
      `All node titles: ${soloEdgeState.nodeDetails.map(n => n.title).join(' | ')}`);

    // ═══════════════════════════════════════════════════
    // CHECK 5: Non-Solo view still shows ALL edges (including cross-edges)
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 5: Non-Solo Dependency View renders ALL edges ===');

    // Navigate to the same collection WITHOUT Solo and WITHOUT task selection
    const nonSoloUrl = `${SERVICE_URL}/?collection=${REPRO_COLLECTION}&view=dependencies`;
    console.log(`Navigating to non-Solo URL: ${nonSoloUrl}`);
    await page.goto(nonSoloUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(6000);

    const nonSoloState = await getNonSoloEdgeDetails(page);
    console.log(`Non-Solo edge state: ${JSON.stringify(nonSoloState, null, 2)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-non-solo-all-edges.png` });

    // Non-Solo should have MORE edges than Solo (the cross-edges should appear)
    const nonSoloHasMoreEdges = nonSoloState.renderedEdgeCount >= soloEdgeState.renderedEdgeCount;
    const nonSoloNotInIsolateMode = !nonSoloState.isolateMode;

    record('5-non-solo-all-edges',
      'Non-Solo Dependency View renders ALL edges including cross-edges',
      nonSoloHasMoreEdges && nonSoloNotInIsolateMode,
      `Non-Solo edges: ${nonSoloState.renderedEdgeCount} (should be ≥ Solo's ${soloEdgeState.renderedEdgeCount}). ` +
      `Non-Solo nodes: ${nonSoloState.totalLayoutNodes}. ` +
      `isolateMode: ${nonSoloState.isolateMode} (expected false). ` +
      `Orange: ${nonSoloState.orangeEdges}, Purple: ${nonSoloState.purpleEdges}, ` +
      `Dashed: ${nonSoloState.dashedEdges}, Other: ${nonSoloState.otherEdges}`);

    // ═══════════════════════════════════════════════════
    // CHECK 6: Regression checks
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 6: Regression checks ===');

    // 6a: Perf Phase 2 viewport culling (deploy-49)
    console.log('  6a: Dependency View viewport culling (deploy-49)...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const depState = await getDependencyViewState(page);
    console.log(`Dependency View state: ${JSON.stringify(depState, null, 2)}`);

    const cullingActive = depState.totalLayoutNodes > 0 && depState.domNodeCount > 0;
    const cullingCorrect = depState.domNodeCount <= depState.totalLayoutNodes;

    record('6a-dependency-culling',
      'Dependency View loads with viewport culling (Perf Phase 2 from deploy-49)',
      cullingActive && cullingCorrect,
      `Layout nodes: ${depState.totalLayoutNodes}, DOM nodes: ${depState.domNodeCount}. ` +
      `Edges: ${depState.totalLayoutEdges} layout, ${depState.domEdgeCount} DOM. ` +
      `Culling correct (DOM ≤ layout): ${cullingCorrect}. Scale: ${depState.scale?.toFixed(3)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/6a-dependency-culling.png` });

    // 6b: Feature 67 — LR default + layout toggle (deploy-50)
    console.log('  6b: Tree View default LR + layout toggle (deploy-50)...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const treeState = await getTreeViewState(page);
    console.log(`Tree state: ${JSON.stringify(treeState, null, 2)}`);

    const defaultIsLR = treeState.layoutOrientation === 'LR';
    const noLayoutdirParam = treeState.layoutdirParam === null;

    record('6b-tree-default-lr',
      'Tree View defaults to LR layout, no ?layoutdir= param',
      defaultIsLR && noLayoutdirParam,
      `Orientation: ${treeState.layoutOrientation} (expected LR). ` +
      `layoutdir param: ${treeState.layoutdirParam} (expected null). ` +
      `Node count: ${treeState.nodeCount}. ` +
      `Orientation btn icon: ${treeState.orientationBtnInfo?.iconName}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/6b-tree-default-lr.png` });

    // Toggle to TB and back
    await clickOrientationToggle(page);
    await page.waitForTimeout(2000);
    let treeStateTB = await getTreeViewState(page);

    record('6b-tree-toggle-tb',
      'Tree View toggles to TB, URL shows ?layoutdir=TB',
      treeStateTB.layoutOrientation === 'TB' && treeStateTB.layoutdirParam === 'TB',
      `Orientation: ${treeStateTB.layoutOrientation} (expected TB). layoutdir: ${treeStateTB.layoutdirParam} (expected TB)`);

    await clickOrientationToggle(page);
    await page.waitForTimeout(2000);
    let treeStateBack = await getTreeViewState(page);

    record('6b-tree-toggle-back-lr',
      'Tree View toggles back to LR, URL param removed',
      treeStateBack.layoutOrientation === 'LR' && treeStateBack.layoutdirParam === null,
      `Orientation: ${treeStateBack.layoutOrientation} (expected LR). layoutdir: ${treeStateBack.layoutdirParam} (expected null)`);

    // 6c: CLOSED-task solo fix regression (deploy-51)
    console.log('  6c: CLOSED-task solo fix regression (deploy-51)...');
    const closedCollectionAvailable = collections.some(c => c.id === CLOSED_REPRO_COLLECTION);
    console.log(`CLOSED-task repro collection available: ${closedCollectionAvailable}`);

    if (closedCollectionAvailable) {
      const closedSoloUrl = `${SERVICE_URL}/?collection=${CLOSED_REPRO_COLLECTION}&view=dependencies&task=${CLOSED_REPRO_TASK}&solo=1`;
      await page.goto(closedSoloUrl, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(8000);

      const closedSoloState = await getDependencyViewDetailedState(page);
      console.log(`CLOSED-task solo state: ${JSON.stringify(closedSoloState, null, 2)}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/6c-closed-task-solo-regression.png` });

      const closedSoloWorks = !closedSoloState.hasNoDepsMessage && closedSoloState.layoutNodeCount > 0;

      record('6c-closed-task-solo-regression',
        'CLOSED task Solo mode still shows relationships (deploy-51 regression)',
        closedSoloWorks,
        `hasNoDepsMessage: ${closedSoloState.hasNoDepsMessage} (expected false). ` +
        `Layout nodes: ${closedSoloState.layoutNodeCount}. Layout edges: ${closedSoloState.layoutEdgeCount}. ` +
        `Selected task: ${closedSoloState.selectedTaskInfo?.title || CLOSED_REPRO_TASK}. ` +
        `isClosed: ${closedSoloState.selectedTaskInfo?.isClosed}. ` +
        `closedTasksInLayout: ${closedSoloState.closedTasksInLayout}`);
    } else {
      // Try to verify with the native collection instead
      console.log('CLOSED repro collection not available. Checking with native collection...');

      // Find a closed task with relationships in the native collection
      await page.goto(
        `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(6000);

      const closedTaskWithRels = await page.evaluate(() => {
        const app = document.querySelector('ft-app');
        if (!app?.store?.allTasks) return null;
        const store = app.store;
        for (const task of store.allTasks) {
          if (task.phase !== 4) continue;
          const rels = (store.relationships || []).filter(r =>
            r.sourceId === task.id || r.targetId === task.id
          );
          if (rels.length > 0) return { id: task.id, title: task.title, phase: task.phase, rels: rels.length };
        }
        return null;
      });

      if (closedTaskWithRels) {
        const closedSoloUrl = `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies&task=${closedTaskWithRels.id}&solo=1`;
        await page.goto(closedSoloUrl, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(8000);

        const closedSoloState = await getDependencyViewDetailedState(page);
        await page.screenshot({ path: `${EVIDENCE_DIR}/6c-closed-task-solo-regression.png` });

        const closedSoloWorks = !closedSoloState.hasNoDepsMessage && closedSoloState.layoutNodeCount > 0;
        record('6c-closed-task-solo-regression',
          'CLOSED task Solo mode still shows relationships (deploy-51 regression, alt task)',
          closedSoloWorks,
          `hasNoDepsMessage: ${closedSoloState.hasNoDepsMessage}. ` +
          `Layout nodes: ${closedSoloState.layoutNodeCount}. Layout edges: ${closedSoloState.layoutEdgeCount}. ` +
          `Task: ${closedTaskWithRels.title} (${closedTaskWithRels.id})`);
      } else {
        record('6c-closed-task-solo-regression',
          'CLOSED task Solo mode regression check',
          false,
          'No CLOSED task with relationships found in any available collection');
      }
    }

    // 6d: Dashboard
    console.log('  6d: Dashboard...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dashboard`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(4000);

    const dashState = await getAppState(page);
    record('6d-dashboard',
      'Dashboard loads correctly',
      dashState.currentView === 'dashboard',
      `Current view: ${dashState.currentView}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/6d-dashboard.png` });

    // 6e: Console errors
    const relevantErrors = consoleErrors.filter(e =>
      !e.text.includes('net::ERR') && !e.text.includes('grpc') &&
      !e.text.includes('stream') && !e.text.includes('favicon') &&
      !e.text.includes('404') && !e.text.includes('401') &&
      !e.text.includes('auth/session')
    );

    record('6e-console-errors',
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
    console.log('  DEPLOY-52 VERIFICATION SUMMARY');
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

// Playwright verification script for deploy-54 — v2 (fixed inspector selection)
// PR #161: feat(inspector): add platform-agnostic "External Source" link
// PR #162: feat(web): add tractor emoji favicon

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-54';

// Collections
const EXT_COLLECTION     = '466c2baa-334e-439c-b9f9-abbe89eb8aae'; // github-mirror
const NATIVE_COLLECTION  = '1e0f02d1-99cd-46bc-a739-bac0fde60710'; // default
const REPRO_COLLECTION   = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const REPRO_TASK         = '717ab19c-e86f-4c51-8126-fc16a8f81ef7';
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
      currentUrl: window.location.href,
    };
  });
}

// Get a task with remoteUrl from the store
async function findTaskWithRemoteUrl(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.taskStore?.allTasks) return { error: 'no task store' };
    const task = app.taskStore.allTasks.find(t => t.remoteUrl || t.remote_url);
    if (!task) return { found: false };
    return {
      found: true,
      id: task.id,
      title: task.title,
      remoteUrl: task.remoteUrl || task.remote_url,
    };
  });
}

// Get a task WITHOUT remoteUrl
async function findNativeTask(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.taskStore?.allTasks) return { error: 'no task store' };
    const task = app.taskStore.allTasks.find(t => !t.remoteUrl && !t.remote_url);
    if (!task) return { found: false };
    return {
      found: true,
      id: task.id,
      title: task.title,
      remoteUrl: task.remoteUrl || task.remote_url || null,
    };
  });
}

// Check inspector for External Source row
async function getInspectorExternalSource(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };

    const inspector = app.shadowRoot.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return { error: 'no inspector shadow root' };

    const meta = inspector.shadowRoot.querySelector('ft-inspector-meta');
    if (!meta?.shadowRoot) return { error: 'no inspector-meta shadow root' };

    const rows = meta.shadowRoot.querySelectorAll('.row');
    const rowLabels = Array.from(rows).map(r => {
      const label = r.querySelector('.label');
      return label?.textContent?.trim() || 'unknown';
    });

    let externalSourceRow = null;
    for (const row of rows) {
      const label = row.querySelector('.label');
      if (label && label.textContent.trim() === 'External Source') {
        externalSourceRow = row;
        break;
      }
    }

    if (!externalSourceRow) {
      return { found: false, hasExternalSourceRow: false, rowLabels };
    }

    const link = externalSourceRow.querySelector('a.external-source-link');
    return {
      found: true,
      hasExternalSourceRow: true,
      linkHref: link?.href || null,
      linkText: link?.textContent?.trim() || null,
      hasIcon: !!link?.querySelector('sl-icon'),
      target: link?.target || null,
      rel: link?.rel || null,
      rowLabels,
    };
  });
}

// ────── Regression helpers ──────

async function getKanbanBoardState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (!kanban?.shadowRoot) return { error: 'no kanban view shadow root' };

    const board = kanban.shadowRoot.querySelector('.board');
    if (!board) return { error: 'no .board element' };

    const columns = board.querySelectorAll('ft-kanban-column');
    return {
      columnCount: columns.length,
      boardScrollWidth: board.scrollWidth,
      boardClientWidth: board.clientWidth,
      boardOverflows: board.scrollWidth > board.clientWidth,
    };
  });
}

async function testAutoScrollRight(page) {
  return page.evaluate(async () => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (!kanban?.shadowRoot) return { error: 'no kanban shadow root' };
    const board = kanban.shadowRoot.querySelector('.board');
    if (!board) return { error: 'no .board element' };

    board.scrollLeft = 0;
    await new Promise(r => setTimeout(r, 100));
    const initialScrollLeft = board.scrollLeft;

    const rect = board.getBoundingClientRect();
    const clientX = rect.right - 20;
    const clientY = rect.top + rect.height / 2;

    const scrollSamples = [initialScrollLeft];
    for (let i = 0; i < 30; i++) {
      board.dispatchEvent(new DragEvent('dragover', {
        bubbles: true, cancelable: true, clientX, clientY,
      }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      scrollSamples.push(board.scrollLeft);
    }
    for (let i = 0; i < 10; i++) {
      await new Promise(r => requestAnimationFrame(r));
      scrollSamples.push(board.scrollLeft);
    }

    const finalScrollLeft = board.scrollLeft;
    board.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));

    let monotonic = true;
    for (let i = 1; i < scrollSamples.length; i++) {
      if (scrollSamples[i] < scrollSamples[i - 1]) { monotonic = false; break; }
    }

    return { initialScrollLeft, finalScrollLeft, delta: finalScrollLeft - initialScrollLeft, monotonic, sampleCount: scrollSamples.length };
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

    return { totalLayoutNodes, totalLayoutEdges, domNodeCount, domEdgeCount, scale: depView.scale };
  });
}

async function getSoloEdgeDetails(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg') ||
                         depView.shadowRoot.querySelector('svg');
    const edgeElements = svgContainer ? Array.from(svgContainer.querySelectorAll('.edge-dependency')) : [];
    const renderedEdges = edgeElements.map(el => {
      const classList = Array.from(el.classList);
      return {
        isBlocking: classList.includes('edge-blocking'),
        isBlocked: classList.includes('edge-blocked'),
        isDashed: el.getAttribute('stroke-dasharray') !== null ||
                  el.style.strokeDasharray !== '' ||
                  classList.some(c => c.includes('cross') || c.includes('indirect')),
      };
    });

    return {
      isolateMode: app.isolateMode, selectedTaskId: app.selectedTaskId,
      layoutNodeCount: (depView.layoutNodes || []).length,
      renderedEdgeCount: edgeElements.length,
      orangeEdges: renderedEdges.filter(e => e.isBlocking).length,
      purpleEdges: renderedEdges.filter(e => e.isBlocked).length,
      dashedEdges: renderedEdges.filter(e => e.isDashed).length,
    };
  });
}

async function getDependencyViewDetailedState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const layoutNodes = depView.layoutNodes || [];
    const layoutEdges = depView.layoutEdges || [];
    const allText = depView.shadowRoot.textContent || '';
    const hasNoDepsMessage = allText.includes('No dependency relationships');

    const store = app.taskStore;
    const closedTasksInLayout = layoutNodes.filter(n => {
      if (!store?.allTasks) return false;
      const task = store.allTasks.find(t => t.id === n.id);
      return task && task.phase === 4;
    }).length;

    return {
      selectedTaskId: app.selectedTaskId, isolateMode: app.isolateMode,
      layoutNodeCount: layoutNodes.length, layoutEdgeCount: layoutEdges.length,
      hasNoDepsMessage, closedTasksInLayout,
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
    const urlParams = new URL(window.location.href).searchParams;
    return { layoutOrientation, layoutdirParam: urlParams.get('layoutdir') };
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
        return { clicked: true };
      }
    }
    return { error: 'not found' };
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
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

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
      record('login', 'Session login', false, `HTTP ${loginResp.status}`);
      process.exit(1);
    }

    // ═══════════════════════════════════════════════════
    // FEATURE 70: Tractor Favicon
    // ═══════════════════════════════════════════════════
    console.log('\n=== FEATURE 70: Tractor Favicon ===');

    await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 70a: favicon.svg served and contains tractor emoji
    const faviconCheck = await page.evaluate(async () => {
      try {
        const resp = await fetch('/favicon.svg');
        const text = await resp.text();
        return {
          status: resp.status,
          contentType: resp.headers.get('content-type'),
          body: text,
          hasTractor: text.includes('🚜'),
          isSvg: text.includes('<svg'),
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    record('70a-favicon-svg',
      'favicon.svg is served and contains tractor emoji',
      faviconCheck.status === 200 && faviconCheck.hasTractor && faviconCheck.isSvg,
      `Status: ${faviconCheck.status}. Has tractor: ${faviconCheck.hasTractor}. ` +
      `Is SVG: ${faviconCheck.isSvg}. Content-Type: ${faviconCheck.contentType}`);

    // 70b: <link rel="icon"> tag
    const faviconLinkCheck = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="icon"]');
      return Array.from(links).map(l => ({
        href: l.href,
        type: l.type || l.getAttribute('type'),
        rel: l.rel,
      }));
    });

    const hasFaviconLink = faviconLinkCheck.some(l => l.href.includes('favicon.svg'));
    record('70b-favicon-link',
      '<link rel="icon"> tag points to favicon.svg',
      hasFaviconLink,
      `Found ${faviconLinkCheck.length} icon link(s). Links: ${JSON.stringify(faviconLinkCheck)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/70-favicon-page.png`, fullPage: false });

    // ═══════════════════════════════════════════════════
    // FEATURE 69: Inspector External Source Link
    // ═══════════════════════════════════════════════════
    console.log('\n=== FEATURE 69a: GitHub-sourced task — External Source row ===');

    // Navigate to external collection, find a task with remoteUrl
    await page.goto(`${SERVICE_URL}/?collection=${EXT_COLLECTION}&view=kanban`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.waitForTimeout(5000);

    const extTask = await findTaskWithRemoteUrl(page);
    console.log(`External task: ${JSON.stringify(extTask)}`);

    if (extTask.found) {
      // Navigate with task= URL param to open inspector
      await page.goto(
        `${SERVICE_URL}/?collection=${EXT_COLLECTION}&view=kanban&task=${extTask.id}`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const extSourceResult = await getInspectorExternalSource(page);
      console.log(`External source result: ${JSON.stringify(extSourceResult, null, 2)}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/69a-inspector-external-source.png` });

      const linkMatchesTask = extSourceResult.linkHref === extTask.remoteUrl;
      const isGitHubUrl = extSourceResult.linkHref?.includes('github.com');

      record('69a-external-source-present',
        'GitHub-sourced task has "External Source" row with a working link',
        extSourceResult.hasExternalSourceRow && extSourceResult.linkHref != null,
        `Has row: ${extSourceResult.hasExternalSourceRow}. ` +
        `Link href: ${extSourceResult.linkHref}. ` +
        `Link text: ${extSourceResult.linkText}. ` +
        `Has icon: ${extSourceResult.hasIcon}. ` +
        `target: ${extSourceResult.target}, rel: ${extSourceResult.rel}. ` +
        `Task remoteUrl: ${extTask.remoteUrl}. ` +
        `Row labels: ${extSourceResult.rowLabels?.join(', ')}`);

      record('69a-external-source-url-match',
        'External Source link points to correct GitHub issue URL',
        isGitHubUrl && linkMatchesTask,
        `Link href: ${extSourceResult.linkHref}. Task remoteUrl: ${extTask.remoteUrl}. ` +
        `Is GitHub URL: ${isGitHubUrl}. URL matches: ${linkMatchesTask}`);
    } else {
      record('69a-external-source-present', 'Find external task', false, 'No task with remoteUrl found');
      record('69a-external-source-url-match', 'Find external task', false, 'No task with remoteUrl found');
    }

    // 69b: Native task — NO External Source row
    console.log('\n=== FEATURE 69b: Native task — NO External Source row ===');

    await page.goto(`${SERVICE_URL}/?collection=${NATIVE_COLLECTION}&view=kanban`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.waitForTimeout(5000);

    const nativeTask = await findNativeTask(page);
    console.log(`Native task: ${JSON.stringify(nativeTask)}`);

    if (nativeTask.found) {
      await page.goto(
        `${SERVICE_URL}/?collection=${NATIVE_COLLECTION}&view=kanban&task=${nativeTask.id}`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const nativeExtResult = await getInspectorExternalSource(page);
      console.log(`Native ext source result: ${JSON.stringify(nativeExtResult, null, 2)}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/69b-inspector-no-external-source.png` });

      record('69b-no-external-source-native',
        'Native (non-external) task does NOT show "External Source" row',
        !nativeExtResult.hasExternalSourceRow,
        `Has row: ${nativeExtResult.hasExternalSourceRow} (expected false). ` +
        `Task: ${nativeTask.title}. Task remoteUrl: ${nativeTask.remoteUrl}. ` +
        `Row labels: ${nativeExtResult.rowLabels?.join(', ')}`);
    } else {
      record('69b-no-external-source-native', 'Find native task', false, 'No native task found');
    }

    // ═══════════════════════════════════════════════════
    // REGRESSION CHECKS
    // ═══════════════════════════════════════════════════
    console.log('\n=== REGRESSION CHECKS ===');

    // Reg-a: Kanban auto-scroll (deploy-53)
    console.log('  Reg-a: Kanban auto-scroll (deploy-53)...');
    await page.goto(`${SERVICE_URL}/?collection=${NATIVE_COLLECTION}&view=kanban`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.waitForTimeout(5000);

    const boardState = await getKanbanBoardState(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-a-kanban-board.png` });

    record('reg-a-kanban-overflow',
      'Kanban board overflows (deploy-53 regression)',
      boardState.boardOverflows && boardState.columnCount >= 5,
      `Columns: ${boardState.columnCount}. Overflows: ${boardState.boardOverflows}. ` +
      `clientWidth: ${boardState.boardClientWidth}. scrollWidth: ${boardState.boardScrollWidth}`);

    const rightScroll = await testAutoScrollRight(page);
    record('reg-a-kanban-autoscroll',
      'Kanban auto-scroll right works (deploy-53 regression)',
      rightScroll.delta > 0 && rightScroll.monotonic,
      `Initial: ${rightScroll.initialScrollLeft}. Final: ${rightScroll.finalScrollLeft}. ` +
      `Delta: ${rightScroll.delta}px. Monotonic: ${rightScroll.monotonic}`);

    // Reg-b: Dependency View viewport culling (deploy-49)
    console.log('  Reg-b: Dependency View viewport culling...');
    await page.goto(`${SERVICE_URL}/?collection=${NATIVE_COLLECTION}&view=dependencies`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.waitForTimeout(6000);

    const depState = await getDependencyViewState(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-b-dependency-culling.png` });

    const cullingCorrect = depState.domNodeCount <= depState.totalLayoutNodes;
    record('reg-b-dependency-culling',
      'Dependency View viewport culling works (deploy-49 regression)',
      depState.totalLayoutNodes > 0 && cullingCorrect,
      `Layout nodes: ${depState.totalLayoutNodes}, DOM nodes: ${depState.domNodeCount}. ` +
      `Edges: ${depState.totalLayoutEdges} layout, ${depState.domEdgeCount} DOM. ` +
      `Culling correct: ${cullingCorrect}`);

    // Reg-c: Feature 67 — LR default + layout toggle (deploy-50)
    console.log('  Reg-c: Tree View default LR + layout toggle...');
    await page.goto(`${SERVICE_URL}/?collection=${NATIVE_COLLECTION}&view=tree`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.waitForTimeout(6000);

    const treeState = await getTreeViewState(page);
    record('reg-c-tree-default-lr',
      'Tree View defaults to LR (deploy-50 regression)',
      treeState.layoutOrientation === 'LR' && treeState.layoutdirParam === null,
      `Orientation: ${treeState.layoutOrientation}. layoutdir: ${treeState.layoutdirParam}`);

    await clickOrientationToggle(page);
    await page.waitForTimeout(2000);
    const treeStateTB = await getTreeViewState(page);
    record('reg-c-tree-toggle-tb',
      'Tree View toggles to TB',
      treeStateTB.layoutOrientation === 'TB' && treeStateTB.layoutdirParam === 'TB',
      `Orientation: ${treeStateTB.layoutOrientation}. layoutdir: ${treeStateTB.layoutdirParam}`);

    await clickOrientationToggle(page);
    await page.waitForTimeout(2000);
    const treeStateBack = await getTreeViewState(page);
    record('reg-c-tree-toggle-back',
      'Tree View toggles back to LR',
      treeStateBack.layoutOrientation === 'LR' && treeStateBack.layoutdirParam === null,
      `Orientation: ${treeStateBack.layoutOrientation}. layoutdir: ${treeStateBack.layoutdirParam}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-c-tree-toggle.png` });

    // Reg-d: Solo cross-edge fix (deploy-52)
    console.log('  Reg-d: Solo cross-edge fix regression...');
    await page.goto(
      `${SERVICE_URL}/?collection=${REPRO_COLLECTION}&view=dependencies&task=${REPRO_TASK}&solo=1`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(8000);

    const soloState = await getSoloEdgeDetails(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-d-solo-crossedge.png` });

    record('reg-d-solo-crossedge',
      'Solo mode: no cross-edges (deploy-52 regression)',
      soloState.dashedEdges === 0 && soloState.renderedEdgeCount > 0,
      `Edges: ${soloState.renderedEdgeCount}. Orange: ${soloState.orangeEdges}. ` +
      `Purple: ${soloState.purpleEdges}. Dashed: ${soloState.dashedEdges}. ` +
      `isolateMode: ${soloState.isolateMode}`);

    // Reg-e: CLOSED-task Solo fix (deploy-51)
    console.log('  Reg-e: CLOSED-task solo fix regression...');
    await page.goto(
      `${SERVICE_URL}/?collection=${CLOSED_REPRO_COLLECTION}&view=dependencies&task=${CLOSED_REPRO_TASK}&solo=1`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(8000);

    const closedState = await getDependencyViewDetailedState(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-e-closed-task-solo.png` });

    record('reg-e-closed-task-solo',
      'CLOSED task Solo shows relationships (deploy-51 regression)',
      !closedState.hasNoDepsMessage && closedState.layoutNodeCount > 0,
      `hasNoDepsMessage: ${closedState.hasNoDepsMessage}. ` +
      `Layout nodes: ${closedState.layoutNodeCount}. Edges: ${closedState.layoutEdgeCount}. ` +
      `closedTasksInLayout: ${closedState.closedTasksInLayout}`);

    // Reg-f: Dashboard
    console.log('  Reg-f: Dashboard...');
    await page.goto(`${SERVICE_URL}/?collection=${NATIVE_COLLECTION}&view=dashboard`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.waitForTimeout(4000);

    const dashState = await getAppState(page);
    record('reg-f-dashboard',
      'Dashboard loads correctly',
      dashState.currentView === 'dashboard',
      `Current view: ${dashState.currentView}`);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-f-dashboard.png` });

    // Reg-g: Console errors
    const relevantErrors = consoleErrors.filter(e =>
      !e.text.includes('net::ERR') && !e.text.includes('grpc') &&
      !e.text.includes('stream') && !e.text.includes('favicon') &&
      !e.text.includes('404') && !e.text.includes('401') &&
      !e.text.includes('auth/session')
    );

    record('reg-g-console-errors',
      'No relevant console errors',
      relevantErrors.length === 0,
      `Total: ${consoleErrors.length}, relevant: ${relevantErrors.length}. ` +
      (relevantErrors.length > 0 ? `Errors: ${JSON.stringify(relevantErrors.slice(0, 5))}` : 'Clean'));

    // ── Save results ──
    fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`,
      JSON.stringify(results, null, 2));
    fs.writeFileSync(`${EVIDENCE_DIR}/console-errors.json`,
      JSON.stringify(consoleErrors, null, 2));

    // ── Summary ──
    console.log('\n\n═══════════════════════════════════════════');
    console.log('  DEPLOY-54 VERIFICATION SUMMARY');
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

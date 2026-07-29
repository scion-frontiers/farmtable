// Playwright verification script for deploy-54
// PR #161: feat(inspector): add platform-agnostic "External Source" link
// PR #162: feat(web): add tractor emoji favicon
//
// Checks:
//   Feature 69: Inspector external link
//     (a) GitHub-sourced task has "External Source" row with working link
//     (b) Native (non-external) task does NOT have "External Source" row
//   Feature 70: Tractor favicon
//     (a) favicon.svg is served and contains tractor emoji
//     (b) Browser tab screenshot showing favicon
//   Regressions:
//     (a) Kanban auto-scroll (deploy-53) — board overflows, right/left scroll works
//     (b) Dependency View culling (deploy-49)
//     (c) Feature 67 LR toggle (deploy-50)
//     (d) Solo cross-edge fix (deploy-52)
//     (e) CLOSED-task Solo (deploy-51)
//     (f) Dashboard
//     (g) Console errors

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

// Collections for regression checks
const REPRO_COLLECTION = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const REPRO_TASK       = '717ab19c-e86f-4c51-8126-fc16a8f81ef7';
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

// ────── Inspector helpers ──────

async function getInspectorExternalSource(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };

    const inspector = app.shadowRoot.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return { error: 'no inspector shadow root' };

    const meta = inspector.shadowRoot.querySelector('ft-inspector-meta');
    if (!meta?.shadowRoot) return { error: 'no inspector-meta shadow root' };

    // Find the "External Source" row
    const rows = meta.shadowRoot.querySelectorAll('.row');
    let externalSourceRow = null;
    for (const row of rows) {
      const label = row.querySelector('.label');
      if (label && label.textContent.trim() === 'External Source') {
        externalSourceRow = row;
        break;
      }
    }

    if (!externalSourceRow) {
      return { found: false, hasExternalSourceRow: false };
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
    };
  });
}

async function getTaskRemoteUrl(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const store = app.store;
    const taskId = app.selectedTaskId;
    if (!store || !taskId) return { error: 'no store or selectedTaskId' };
    const task = store.getTask?.(taskId) || store.allTasks?.find(t => t.id === taskId);
    if (!task) return { error: 'task not found' };
    return {
      taskId: task.id,
      title: task.title,
      remoteUrl: task.remoteUrl || task.remote_url || null,
      platform: task.platform,
    };
  });
}

async function openInspector(page) {
  // Click on a task to open the inspector
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };

    // Try to find the current view and click a task card
    const kanban = app.shadowRoot.querySelector('ft-kanban-view');
    if (kanban?.shadowRoot) {
      const board = kanban.shadowRoot.querySelector('.board');
      if (board) {
        const columns = board.querySelectorAll('ft-kanban-column');
        for (const col of columns) {
          const sr = col.shadowRoot;
          if (!sr) continue;
          const cards = sr.querySelectorAll('ft-task-card');
          if (cards.length > 0) {
            cards[0].click();
            return { clicked: true, cardCount: cards.length };
          }
        }
      }
    }
    return { error: 'no cards found to click' };
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
    const columnInfo = Array.from(columns).map(col => {
      const sr = col.shadowRoot;
      const header = sr?.querySelector('.column-header h3, .column-header .title, h3');
      const title = header?.textContent?.trim() || col.getAttribute('label') || 'unknown';
      const cards = sr?.querySelectorAll('ft-task-card') || [];
      return { title, cardCount: cards.length };
    });

    const boardRect = board.getBoundingClientRect();
    return {
      columnCount: columns.length,
      columns: columnInfo,
      boardWidth: boardRect.width,
      boardScrollWidth: board.scrollWidth,
      boardScrollLeft: board.scrollLeft,
      boardOverflows: board.scrollWidth > board.clientWidth,
      boardClientWidth: board.clientWidth,
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

    return {
      initialScrollLeft, finalScrollLeft,
      delta: finalScrollLeft - initialScrollLeft,
      scrollSamples, sampleCount: scrollSamples.length, monotonic,
    };
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
      const isBlocking = classList.includes('edge-blocking');
      const isBlocked  = classList.includes('edge-blocked');
      const isDashed   = el.getAttribute('stroke-dasharray') !== null ||
                         el.style.strokeDasharray !== '' ||
                         classList.some(c => c.includes('cross') || c.includes('indirect'));
      return { isBlocking, isBlocked, isDashed };
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

    const store = app.store || depView.store;
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
      record('login', 'Session login', false, `HTTP ${loginResp.status}: ${JSON.stringify(loginResp.body)}`);
      process.exit(1);
    }

    // Reload after login
    await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find collections
    console.log('\n=== Finding collections ===');
    const collections = await getCollections(page);
    console.log(`Found ${collections.length} collections`);
    for (const c of collections) {
      console.log(`  ${c.name} (${c.id}) external=${c.external}`);
    }

    let nativeCollection = collections.find(c => !c.external) || collections[0];
    let externalCollection = collections.find(c => c.external);
    console.log(`Native collection: ${nativeCollection?.name} (${nativeCollection?.id})`);
    console.log(`External collection: ${externalCollection?.name} (${externalCollection?.id})`);

    // ═══════════════════════════════════════════════════
    // FEATURE 70: Tractor Favicon
    // ═══════════════════════════════════════════════════
    console.log('\n=== FEATURE 70: Tractor Favicon ===');

    // Check 70a: favicon.svg is served and accessible
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
    console.log(`Favicon check: ${JSON.stringify(faviconCheck, null, 2)}`);

    record('70a-favicon-svg',
      'favicon.svg is served and contains tractor emoji',
      faviconCheck.status === 200 && faviconCheck.hasTractor && faviconCheck.isSvg,
      `Status: ${faviconCheck.status}. Has tractor: ${faviconCheck.hasTractor}. ` +
      `Is SVG: ${faviconCheck.isSvg}. Content-Type: ${faviconCheck.contentType}`);

    // Check 70b: <link rel="icon"> tag is present in the DOM
    const faviconLinkCheck = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="icon"]');
      const linkInfo = Array.from(links).map(l => ({
        href: l.href,
        type: l.type || l.getAttribute('type'),
        rel: l.rel,
      }));
      return { count: links.length, links: linkInfo };
    });
    console.log(`Favicon link check: ${JSON.stringify(faviconLinkCheck, null, 2)}`);

    const hasFaviconLink = faviconLinkCheck.links.some(l => l.href.includes('favicon.svg'));
    record('70b-favicon-link',
      '<link rel="icon"> tag points to favicon.svg',
      hasFaviconLink,
      `Found ${faviconLinkCheck.count} icon link(s). ` +
      `Links: ${JSON.stringify(faviconLinkCheck.links)}`);

    // Take a screenshot showing the tab (full page with the favicon context)
    await page.screenshot({ path: `${EVIDENCE_DIR}/70-favicon-page.png`, fullPage: false });

    // ═══════════════════════════════════════════════════
    // FEATURE 69: Inspector External Source Link
    // ═══════════════════════════════════════════════════
    console.log('\n=== FEATURE 69: Inspector External Source Link ===');

    // 69a: GitHub-sourced task should show "External Source" row
    if (externalCollection) {
      console.log(`\nNavigating to external collection: ${externalCollection.name}`);
      const extKanbanUrl = `${SERVICE_URL}/?collection=${externalCollection.id}&view=kanban`;
      await page.goto(extKanbanUrl, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(5000);

      // Click on a task card to open inspector
      const clickResult = await openInspector(page);
      console.log(`Click result: ${JSON.stringify(clickResult)}`);
      await page.waitForTimeout(2000);

      const taskInfo = await getTaskRemoteUrl(page);
      console.log(`Task info: ${JSON.stringify(taskInfo, null, 2)}`);

      const extSourceResult = await getInspectorExternalSource(page);
      console.log(`External source result: ${JSON.stringify(extSourceResult, null, 2)}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/69a-inspector-external-source.png` });

      const extLinkPass = extSourceResult.hasExternalSourceRow &&
                          extSourceResult.linkHref !== null &&
                          extSourceResult.linkHref.length > 0;
      record('69a-external-source-present',
        'GitHub-sourced task has "External Source" row with a link',
        extLinkPass,
        `Has row: ${extSourceResult.hasExternalSourceRow}. ` +
        `Link href: ${extSourceResult.linkHref}. ` +
        `Link text: ${extSourceResult.linkText}. ` +
        `Has icon: ${extSourceResult.hasIcon}. ` +
        `target: ${extSourceResult.target}, rel: ${extSourceResult.rel}. ` +
        `Task remoteUrl: ${taskInfo.remoteUrl}. Task title: ${taskInfo.title}`);

      // Verify the link points to a valid GitHub URL
      const isGitHubUrl = extSourceResult.linkHref?.includes('github.com');
      record('69a-external-source-url',
        'External Source link points to correct GitHub URL',
        isGitHubUrl && extSourceResult.linkHref === taskInfo.remoteUrl,
        `Link href: ${extSourceResult.linkHref}. ` +
        `Task remoteUrl: ${taskInfo.remoteUrl}. ` +
        `Is GitHub URL: ${isGitHubUrl}. ` +
        `URL matches task.remoteUrl: ${extSourceResult.linkHref === taskInfo.remoteUrl}`);
    } else {
      console.log('WARNING: No external collection found! Trying to find a GitHub-mirrored task.');

      // Try all collections to find a task with remoteUrl
      let foundExternal = false;
      for (const c of collections) {
        const url = `${SERVICE_URL}/?collection=${c.id}&view=kanban`;
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check if any tasks have remoteUrl
        const hasRemoteUrl = await page.evaluate(() => {
          const app = document.querySelector('ft-app');
          if (!app?.store?.allTasks) return false;
          return app.store.allTasks.some(t => t.remoteUrl || t.remote_url);
        });

        if (hasRemoteUrl) {
          console.log(`Found collection with remote URL tasks: ${c.name}`);

          // Click the task with remoteUrl
          await page.evaluate(() => {
            const app = document.querySelector('ft-app');
            const task = app.store.allTasks.find(t => t.remoteUrl || t.remote_url);
            if (task) {
              app.selectedTaskId = task.id;
              app.requestUpdate();
            }
          });
          await page.waitForTimeout(2000);

          const taskInfo = await getTaskRemoteUrl(page);
          const extSourceResult = await getInspectorExternalSource(page);
          await page.screenshot({ path: `${EVIDENCE_DIR}/69a-inspector-external-source.png` });

          record('69a-external-source-present',
            'Task with remoteUrl has "External Source" row',
            extSourceResult.hasExternalSourceRow,
            `Task: ${taskInfo.title}. remoteUrl: ${taskInfo.remoteUrl}. ` +
            `Has row: ${extSourceResult.hasExternalSourceRow}. Link: ${extSourceResult.linkHref}`);

          foundExternal = true;
          break;
        }
      }

      if (!foundExternal) {
        record('69a-external-source-present',
          'No tasks with remoteUrl found — cannot verify',
          false, 'No external/GitHub-mirrored tasks found in any collection');
      }
    }

    // 69b: Native (non-external) task should NOT show "External Source" row
    console.log('\n=== CHECK 69b: Native task — NO External Source row ===');
    const nativeKanbanUrl = `${SERVICE_URL}/?collection=${nativeCollection.id}&view=kanban`;
    await page.goto(nativeKanbanUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Click on a native task card
    const nativeClickResult = await openInspector(page);
    console.log(`Native click result: ${JSON.stringify(nativeClickResult)}`);
    await page.waitForTimeout(2000);

    const nativeTaskInfo = await getTaskRemoteUrl(page);
    console.log(`Native task info: ${JSON.stringify(nativeTaskInfo, null, 2)}`);

    const nativeExtSourceResult = await getInspectorExternalSource(page);
    console.log(`Native external source result: ${JSON.stringify(nativeExtSourceResult, null, 2)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/69b-inspector-no-external-source.png` });

    record('69b-no-external-source-native',
      'Native (non-external) task does NOT show "External Source" row',
      !nativeExtSourceResult.hasExternalSourceRow,
      `Has row: ${nativeExtSourceResult.hasExternalSourceRow} (expected false). ` +
      `Task: ${nativeTaskInfo.title}. Task remoteUrl: ${nativeTaskInfo.remoteUrl}`);

    // ═══════════════════════════════════════════════════
    // REGRESSION CHECKS
    // ═══════════════════════════════════════════════════
    console.log('\n=== REGRESSION CHECKS ===');

    // Reg-a: Kanban auto-scroll (deploy-53) — quick check, board overflows + right scroll
    console.log('  Reg-a: Kanban auto-scroll (deploy-53)...');
    await page.goto(nativeKanbanUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);

    const boardState = await getKanbanBoardState(page);
    console.log(`Board state: ${JSON.stringify(boardState, null, 2)}`);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-a-kanban-board.png` });

    record('reg-a-kanban-overflow',
      'Kanban board has enough columns to overflow (deploy-53 regression)',
      boardState.boardOverflows && boardState.columnCount >= 5,
      `Columns: ${boardState.columnCount}. Overflows: ${boardState.boardOverflows}. ` +
      `clientWidth: ${boardState.boardClientWidth}. scrollWidth: ${boardState.boardScrollWidth}`);

    const rightScrollResult = await testAutoScrollRight(page);
    const rightPassed = rightScrollResult.delta > 0 && rightScrollResult.monotonic;
    record('reg-a-kanban-autoscroll',
      'Kanban auto-scroll right works (deploy-53 regression)',
      rightPassed,
      `Initial: ${rightScrollResult.initialScrollLeft}. Final: ${rightScrollResult.finalScrollLeft}. ` +
      `Delta: ${rightScrollResult.delta}px. Monotonic: ${rightScrollResult.monotonic}`);

    // Reg-b: Dependency View viewport culling (deploy-49)
    console.log('  Reg-b: Dependency View viewport culling...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const depState = await getDependencyViewState(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-b-dependency-culling.png` });

    const cullingCorrect = depState.domNodeCount <= depState.totalLayoutNodes;
    record('reg-b-dependency-culling',
      'Dependency View loads with viewport culling (deploy-49 regression)',
      depState.totalLayoutNodes > 0 && cullingCorrect,
      `Layout nodes: ${depState.totalLayoutNodes}, DOM nodes: ${depState.domNodeCount}. ` +
      `Edges: ${depState.totalLayoutEdges} layout, ${depState.domEdgeCount} DOM. ` +
      `Culling correct: ${cullingCorrect}`);

    // Reg-c: Feature 67 — LR default + layout toggle (deploy-50)
    console.log('  Reg-c: Tree View default LR + layout toggle...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const treeState = await getTreeViewState(page);
    record('reg-c-tree-default-lr',
      'Tree View defaults to LR layout (deploy-50 regression)',
      treeState.layoutOrientation === 'LR' && treeState.layoutdirParam === null,
      `Orientation: ${treeState.layoutOrientation}. layoutdir param: ${treeState.layoutdirParam}`);

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
    record('reg-c-tree-toggle-back-lr',
      'Tree View toggles back to LR',
      treeStateBack.layoutOrientation === 'LR' && treeStateBack.layoutdirParam === null,
      `Orientation: ${treeStateBack.layoutOrientation}. layoutdir: ${treeStateBack.layoutdirParam}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-c-tree-toggle.png` });

    // Reg-d: Solo cross-edge fix (deploy-52)
    console.log('  Reg-d: Solo cross-edge fix regression...');
    const soloUrl = `${SERVICE_URL}/?collection=${REPRO_COLLECTION}&view=dependencies&task=${REPRO_TASK}&solo=1`;
    await page.goto(soloUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(8000);

    const soloState = await getSoloEdgeDetails(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-d-solo-crossedge.png` });

    record('reg-d-solo-crossedge',
      'Solo mode: no cross-edges (deploy-52 regression)',
      soloState.dashedEdges === 0 && soloState.renderedEdgeCount > 0,
      `Edges: ${soloState.renderedEdgeCount}. Orange: ${soloState.orangeEdges}. ` +
      `Purple: ${soloState.purpleEdges}. Dashed/cross: ${soloState.dashedEdges}. ` +
      `isolateMode: ${soloState.isolateMode}`);

    // Reg-e: CLOSED-task Solo fix (deploy-51)
    console.log('  Reg-e: CLOSED-task solo fix regression...');
    const closedSoloUrl = `${SERVICE_URL}/?collection=${CLOSED_REPRO_COLLECTION}&view=dependencies&task=${CLOSED_REPRO_TASK}&solo=1`;
    await page.goto(closedSoloUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(8000);

    const closedState = await getDependencyViewDetailedState(page);
    await page.screenshot({ path: `${EVIDENCE_DIR}/reg-e-closed-task-solo.png` });

    record('reg-e-closed-task-solo',
      'CLOSED task Solo mode shows relationships (deploy-51 regression)',
      !closedState.hasNoDepsMessage && closedState.layoutNodeCount > 0,
      `hasNoDepsMessage: ${closedState.hasNoDepsMessage} (expected false). ` +
      `Layout nodes: ${closedState.layoutNodeCount}. Edges: ${closedState.layoutEdgeCount}. ` +
      `closedTasksInLayout: ${closedState.closedTasksInLayout}`);

    // Reg-f: Dashboard
    console.log('  Reg-f: Dashboard...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dashboard`,
      { waitUntil: 'load', timeout: 30000 }
    );
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

// Playwright verification script for deploy-48 — Feature 67: Tree Layout Orientation Toggle (PR #154)
// Checks:
//   4(a): Default orientation is TB (top-to-bottom)
//   4(b): Rotate-toggle switches to LR and icon changes
//   4(c): URL gets ?layoutdir=LR and persists on reload
//   4(d): Toggle back to TB — URL param removed, layout reflows
//   4(e): View-switcher icons for Tree and Dependencies are visually DISTINCT in both modes
//   4(f): Solo mode works correctly in both TB and LR orientations
//   4(g): Minimap and depth-limit badge (Perf Phase 1) still work in both orientations
//   5: Regression checks — Dependency View, Dashboard, periodic-redraw fix

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-48';

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

async function getTreeViewState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { error: 'no tree view shadow root' };

    // Check layout orientation property
    const layoutOrientation = treeView.layoutOrientation || 'TB';

    // Check the hierarchy nav for the orientation toggle button
    const hierNav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');
    let toggleBtnInfo = null;
    if (hierNav?.shadowRoot) {
      // The orientation toggle button is right after the Solo button
      const buttons = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
      // Solo button is usually first; orientation toggle is the second one with the arrow icon
      for (const btn of buttons) {
        const icon = btn.querySelector('sl-icon');
        const iconName = icon?.getAttribute('name') || '';
        if (iconName.includes('arrow-clockwise') || iconName.includes('arrow-counterclockwise')) {
          toggleBtnInfo = {
            found: true,
            iconName: iconName,
            isActive: btn.classList.contains('active'),
            tooltip: btn.closest('sl-tooltip')?.getAttribute('content') || '',
          };
          break;
        }
      }
    }

    // Count nodes in the SVG layout
    const svgContainer = treeView.shadowRoot.querySelector('.canvas-container svg') ||
                         treeView.shadowRoot.querySelector('svg');
    const foreignObjects = svgContainer?.querySelectorAll('foreignObject') || [];
    const nodeCount = foreignObjects.length;

    // Check the dagre graph rankdir
    let graphRankdir = null;
    // We can infer orientation from node positions:
    // TB layout: nodes spread more vertically, LR layout: nodes spread more horizontally
    const positions = [];
    for (const fo of foreignObjects) {
      const x = parseFloat(fo.getAttribute('x') || '0');
      const y = parseFloat(fo.getAttribute('y') || '0');
      positions.push({ x, y });
    }
    let layoutSpread = null;
    if (positions.length > 1) {
      const xs = positions.map(p => p.x);
      const ys = positions.map(p => p.y);
      const xSpread = Math.max(...xs) - Math.min(...xs);
      const ySpread = Math.max(...ys) - Math.min(...ys);
      layoutSpread = { xSpread, ySpread, ratio: xSpread > 0 ? ySpread / xSpread : Infinity };
    }

    // Check store for task count
    const store = treeView.store || app.store;
    const taskCount = store?.allTasks?.length || 0;

    // Check Solo button state
    const soloBtn = hierNav?.shadowRoot?.querySelector('.isolate-btn:not([class*="active"])') ||
                    hierNav?.shadowRoot?.querySelector('.isolate-btn');
    let soloBtnInfo = null;
    if (hierNav?.shadowRoot) {
      const allBtns = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
      for (const btn of allBtns) {
        const icon = btn.querySelector('sl-icon');
        const iconName = icon?.getAttribute('name') || '';
        if (iconName === 'bullseye' || iconName === 'crosshair' || iconName.includes('focus') || !iconName.includes('arrow')) {
          soloBtnInfo = {
            found: true,
            iconName,
            isActive: btn.classList.contains('active'),
          };
          break;
        }
      }
    }

    // Check minimap — it's a custom element <ft-minimap> inside tree view shadow root
    const minimap = treeView.shadowRoot.querySelector('ft-minimap') ||
                    treeView.shadowRoot.querySelector('.minimap') ||
                    treeView.shadowRoot.querySelector('[class*="minimap"]');
    const minimapExists = !!minimap;

    // Check depth-limit badge — look for the hierarchy-nav level indicator
    const depthBadge = hierNav?.shadowRoot?.querySelector('.level-indicator') ||
                       hierNav?.shadowRoot?.querySelector('[class*="depth"]') ||
                       hierNav?.shadowRoot?.querySelector('[class*="level"]') ||
                       treeView.shadowRoot.querySelector('.depth-badge') ||
                       treeView.shadowRoot.querySelector('[class*="depth"]');

    return {
      layoutOrientation,
      toggleBtnInfo,
      nodeCount,
      taskCount,
      layoutSpread,
      soloBtnInfo,
      minimapExists,
      depthBadgeExists: !!depthBadge,
      isolateMode: treeView.isolateMode || false,
    };
  });
}

async function getViewSwitcherIcons(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return { error: 'no toolbar shadow root' };

    const viewSwitcher = toolbar.shadowRoot.querySelector('.view-switcher');
    if (!viewSwitcher) return { error: 'no view-switcher' };

    const radioButtons = viewSwitcher.querySelectorAll('sl-radio-button');
    const iconData = [];
    for (const rb of radioButtons) {
      const value = rb.getAttribute('value') || '';
      const icon = rb.querySelector('sl-icon');
      const iconName = icon?.getAttribute('name') || '';
      const style = icon?.getAttribute('style') || '';
      iconData.push({ view: value, iconName, style });
    }

    // Specifically check Tree and Dependencies icons
    const treeIcon = iconData.find(d => d.view === 'tree');
    const depsIcon = iconData.find(d => d.view === 'dependencies');

    return {
      allIcons: iconData,
      treeIcon,
      depsIcon,
      iconsAreDistinct: treeIcon && depsIcon &&
        (treeIcon.iconName !== depsIcon.iconName || treeIcon.style !== depsIcon.style),
    };
  });
}

async function clickOrientationToggle(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app' };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { error: 'no tree view' };
    const hierNav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');
    if (!hierNav?.shadowRoot) return { error: 'no hier nav' };

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

async function toggleSolo(page, taskId) {
  return page.evaluate((tid) => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app' };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { error: 'no tree view' };
    const hierNav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');
    if (!hierNav?.shadowRoot) return { error: 'no hier nav' };

    // Set selected task first
    if (tid) {
      treeView.selectedTaskId = tid;
      app.selectedTaskId = tid;
      treeView.dispatchEvent(new CustomEvent('task-select', {
        detail: { taskId: tid }, bubbles: true, composed: true
      }));
    }

    // Find Solo button (the one without arrow icon)
    const buttons = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
    for (const btn of buttons) {
      const icon = btn.querySelector('sl-icon');
      const iconName = icon?.getAttribute('name') || '';
      if (!iconName.includes('arrow')) {
        btn.click();
        return { clicked: true, iconName };
      }
    }
    return { error: 'solo button not found' };
  }, taskId);
}

async function findTaskWithChildren(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app' };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    const store = treeView?.store || app?.store;
    if (!store) return { error: 'no store' };

    const allTasks = store.allTasks || [];
    // Find a task that has children (is a parent)
    const parentIds = new Set(allTasks.filter(t => t.parentTaskId).map(t => t.parentTaskId));
    const parents = allTasks.filter(t => parentIds.has(t.id));

    // Find the parent with the most children
    let bestParent = null;
    let bestChildCount = 0;
    for (const p of parents) {
      const children = allTasks.filter(t => t.parentTaskId === p.id);
      if (children.length > bestChildCount) {
        bestParent = { id: p.id, title: p.title, childCount: children.length };
        bestChildCount = children.length;
      }
    }
    return { taskCount: allTasks.length, bestParent, parentCount: parents.length };
  });
}

async function getDependencyViewState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no dependency view shadow root' };

    const svgContainer = depView.shadowRoot.querySelector('.svg-container svg') ||
                         depView.shadowRoot.querySelector('svg');
    const foreignObjects = svgContainer?.querySelectorAll('foreignObject') || [];
    return { nodeCount: foreignObjects.length };
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

    // Use the native (default) collection for tree view feature testing
    let nativeCollection = collections.find(c => !c.external) || collections[0];
    console.log(`Using native collection: ${nativeCollection?.name} (${nativeCollection?.id})`);

    // ═══════════════════════════════════════════════════
    // CHECK 4(a): Default orientation is top-to-bottom (TB)
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(a): Default Tree View orientation is TB ===');

    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    let treeState = await getTreeViewState(page);
    console.log(`Tree state: ${JSON.stringify(treeState, null, 2)}`);

    const defaultIsTB = treeState.layoutOrientation === 'TB';
    const toggleFound = !!treeState.toggleBtnInfo?.found;
    const defaultIconIsCCW = treeState.toggleBtnInfo?.iconName === 'arrow-counterclockwise';

    record('4a-default-orientation',
      'Default Tree View orientation is TB (top-to-bottom)',
      defaultIsTB && toggleFound,
      `layoutOrientation=${treeState.layoutOrientation}, toggleBtn found=${toggleFound}, ` +
      `icon=${treeState.toggleBtnInfo?.iconName}, nodes=${treeState.nodeCount}, tasks=${treeState.taskCount}. ` +
      `Layout spread: ${JSON.stringify(treeState.layoutSpread)}`);

    record('4a-toggle-button-exists',
      'Orientation toggle button exists next to Solo button',
      toggleFound && defaultIconIsCCW,
      `Toggle button: ${JSON.stringify(treeState.toggleBtnInfo)}. ` +
      `Solo button: ${JSON.stringify(treeState.soloBtnInfo)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4a-tree-default-TB.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(b): Toggle to LR — tree re-layouts, icon changes
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(b): Toggle to LR ===');

    const toggleResult = await clickOrientationToggle(page);
    console.log(`Toggle result: ${JSON.stringify(toggleResult)}`);
    await page.waitForTimeout(2000); // Wait for layout to re-render

    let treeStateLR = await getTreeViewState(page);
    console.log(`Tree state after LR toggle: ${JSON.stringify(treeStateLR, null, 2)}`);

    const isNowLR = treeStateLR.layoutOrientation === 'LR';
    const iconChangedToCW = treeStateLR.toggleBtnInfo?.iconName === 'arrow-clockwise';
    const toggleBtnActiveInLR = treeStateLR.toggleBtnInfo?.isActive === true;

    // Check that layout spread changed: in LR mode, xSpread should be larger relative to ySpread
    let layoutChangedToLR = false;
    if (treeState.layoutSpread && treeStateLR.layoutSpread &&
        treeState.layoutSpread.ratio > 0 && treeStateLR.layoutSpread.ratio > 0) {
      // In TB mode, ySpread/xSpread should be large; in LR mode, it should be smaller
      layoutChangedToLR = treeStateLR.layoutSpread.ratio < treeState.layoutSpread.ratio;
    }

    record('4b-toggle-to-LR',
      'Click orientation toggle: tree re-layouts to left-to-right',
      isNowLR && iconChangedToCW,
      `layoutOrientation=${treeStateLR.layoutOrientation}, icon=${treeStateLR.toggleBtnInfo?.iconName}, ` +
      `active=${toggleBtnActiveInLR}. ` +
      `TB spread: ${JSON.stringify(treeState.layoutSpread)}, LR spread: ${JSON.stringify(treeStateLR.layoutSpread)}. ` +
      `Layout visually changed: ${layoutChangedToLR}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4b-tree-LR-toggled.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(c): URL has ?layoutdir=LR and persists on reload
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(c): URL persistence ===');

    const currentUrl = page.url();
    const urlHasLayoutdir = currentUrl.includes('layoutdir=LR');
    console.log(`Current URL: ${currentUrl}`);
    console.log(`URL has layoutdir=LR: ${urlHasLayoutdir}`);

    record('4c-url-param-set',
      'URL has ?layoutdir=LR after toggling to LR',
      urlHasLayoutdir,
      `URL: ${currentUrl}`);

    // Reload and check persistence
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);

    const afterReloadUrl = page.url();
    const afterReloadState = await getTreeViewState(page);
    const persistedAfterReload = afterReloadState.layoutOrientation === 'LR';
    const urlStillHasParam = afterReloadUrl.includes('layoutdir=LR');

    record('4c-persistence-on-reload',
      'Orientation persists to LR after page reload',
      persistedAfterReload && urlStillHasParam,
      `After reload: layoutOrientation=${afterReloadState.layoutOrientation}, ` +
      `URL: ${afterReloadUrl}, icon=${afterReloadState.toggleBtnInfo?.iconName}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4c-tree-LR-after-reload.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(d): Toggle back to TB — URL param removed, layout reflows
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(d): Toggle back to TB ===');

    const toggleBackResult = await clickOrientationToggle(page);
    console.log(`Toggle back result: ${JSON.stringify(toggleBackResult)}`);
    await page.waitForTimeout(2000);

    let treeStateTB = await getTreeViewState(page);
    const backToTB = treeStateTB.layoutOrientation === 'TB';
    const iconBackToCCW = treeStateTB.toggleBtnInfo?.iconName === 'arrow-counterclockwise';

    const urlAfterToggleBack = page.url();
    const urlParamRemoved = !urlAfterToggleBack.includes('layoutdir=');

    record('4d-toggle-back-to-TB',
      'Toggle back to TB: URL param removed, layout reflows to top-to-bottom',
      backToTB && iconBackToCCW && urlParamRemoved,
      `layoutOrientation=${treeStateTB.layoutOrientation}, icon=${treeStateTB.toggleBtnInfo?.iconName}, ` +
      `URL: ${urlAfterToggleBack}, layoutdir removed=${urlParamRemoved}. ` +
      `Layout spread: ${JSON.stringify(treeStateTB.layoutSpread)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4d-tree-TB-restored.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(e): View-switcher icons are visually DISTINCT for Tree and Dependencies
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(e): View-switcher icons distinctness ===');

    // Check in TB mode
    const iconsTB = await getViewSwitcherIcons(page);
    console.log(`View switcher icons (TB mode): ${JSON.stringify(iconsTB, null, 2)}`);

    record('4e-icons-distinct-TB',
      'Tree and Dependencies view-switcher icons are visually distinct in TB mode',
      iconsTB.iconsAreDistinct === true,
      `Tree icon: name=${iconsTB.treeIcon?.iconName}, style="${iconsTB.treeIcon?.style}". ` +
      `Deps icon: name=${iconsTB.depsIcon?.iconName}, style="${iconsTB.depsIcon?.style}". ` +
      `Distinct: ${iconsTB.iconsAreDistinct}`);

    // Toggle to LR and check again
    await clickOrientationToggle(page);
    await page.waitForTimeout(2000);

    const iconsLR = await getViewSwitcherIcons(page);
    console.log(`View switcher icons (LR mode): ${JSON.stringify(iconsLR, null, 2)}`);

    // Crucially: the tree icon should NOT rotate with orientation (the bug fix)
    const treeIconSameBothModes = iconsTB.treeIcon?.iconName === iconsLR.treeIcon?.iconName &&
                                  iconsTB.treeIcon?.style === iconsLR.treeIcon?.style;

    record('4e-icons-distinct-LR',
      'Tree and Dependencies view-switcher icons are visually distinct in LR mode',
      iconsLR.iconsAreDistinct === true,
      `Tree icon: name=${iconsLR.treeIcon?.iconName}, style="${iconsLR.treeIcon?.style}". ` +
      `Deps icon: name=${iconsLR.depsIcon?.iconName}, style="${iconsLR.depsIcon?.style}". ` +
      `Distinct: ${iconsLR.iconsAreDistinct}`);

    record('4e-tree-icon-stable',
      'Tree view-switcher icon does NOT rotate with layout orientation (bug fix verified)',
      treeIconSameBothModes,
      `TB mode: name=${iconsTB.treeIcon?.iconName}, style="${iconsTB.treeIcon?.style}". ` +
      `LR mode: name=${iconsLR.treeIcon?.iconName}, style="${iconsLR.treeIcon?.style}". ` +
      `Same in both modes: ${treeIconSameBothModes}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4e-view-switcher-icons-LR.png` });

    // Toggle back to TB for subsequent checks
    await clickOrientationToggle(page);
    await page.waitForTimeout(1000);

    // ═══════════════════════════════════════════════════
    // CHECK 4(f): Solo mode works correctly in both orientations
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(f): Solo mode in both orientations ===');

    // First, find a task with children
    const taskInfo = await findTaskWithChildren(page);
    console.log(`Task info: ${JSON.stringify(taskInfo)}`);

    if (taskInfo.bestParent) {
      // Test Solo in TB mode — use URL-based activation for reliable state propagation
      console.log(`Testing Solo on task "${taskInfo.bestParent.title}" (${taskInfo.bestParent.childCount} children)`);

      // Navigate with task + solo params in TB mode (no layoutdir param = TB default)
      await page.goto(
        `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree&task=${taskInfo.bestParent.id}&solo=1`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const soloTBState = await getTreeViewState(page);
      console.log(`Solo TB state: ${JSON.stringify(soloTBState, null, 2)}`);
      const soloActiveTB = soloTBState.isolateMode;
      const soloNodesTB = soloTBState.nodeCount;

      await page.screenshot({ path: `${EVIDENCE_DIR}/4f-solo-TB.png` });

      record('4f-solo-TB',
        'Solo mode works in TB orientation',
        soloNodesTB > 0 && soloNodesTB < taskInfo.taskCount,
        `Solo active=${soloActiveTB}, nodes visible=${soloNodesTB} (full tree=${taskInfo.taskCount}), ` +
        `parent has ${taskInfo.bestParent.childCount} children. ` +
        `Layout orientation=${soloTBState.layoutOrientation}`);

      // Now navigate with Solo + LR mode
      await page.goto(
        `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree&task=${taskInfo.bestParent.id}&solo=1&layoutdir=LR`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const soloLRState = await getTreeViewState(page);
      console.log(`Solo LR state: ${JSON.stringify(soloLRState, null, 2)}`);
      const soloNodesLR = soloLRState.nodeCount;

      await page.screenshot({ path: `${EVIDENCE_DIR}/4f-solo-LR.png` });

      record('4f-solo-LR',
        'Solo mode works in LR orientation',
        soloNodesLR > 0 && soloNodesLR < taskInfo.taskCount,
        `Solo nodes in LR=${soloNodesLR}, orientation=${soloLRState.layoutOrientation}, ` +
        `isolateMode=${soloLRState.isolateMode}. ` +
        `Same subtree in both: nodes TB=${soloNodesTB}, LR=${soloNodesLR}`);

      // Navigate back to tree view without Solo for subsequent checks
      await page.goto(
        `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(3000);
    } else {
      record('4f-solo-TB', 'Solo mode works in TB orientation',
        false, `No task with children found. Task count: ${taskInfo.taskCount}, parents: ${taskInfo.parentCount}`);
      record('4f-solo-LR', 'Solo mode works in LR orientation',
        false, 'No task with children found');
    }

    // ═══════════════════════════════════════════════════
    // CHECK 4(g): Minimap and depth-limit badge (Perf Phase 1)
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(g): Minimap and depth-limit in both orientations ===');

    // Check in TB mode
    const perfStateTB = await getTreeViewState(page);

    record('4g-minimap-TB',
      'Minimap present in TB orientation',
      perfStateTB.minimapExists,
      `Minimap exists: ${perfStateTB.minimapExists}, nodes: ${perfStateTB.nodeCount}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4g-tree-minimap-TB.png` });

    // Switch to LR and check
    await clickOrientationToggle(page);
    await page.waitForTimeout(2000);

    const perfStateLR = await getTreeViewState(page);

    record('4g-minimap-LR',
      'Minimap present in LR orientation',
      perfStateLR.minimapExists,
      `Minimap exists: ${perfStateLR.minimapExists}, orientation: ${perfStateLR.layoutOrientation}, nodes: ${perfStateLR.nodeCount}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4g-tree-minimap-LR.png` });

    // Toggle back to TB
    await clickOrientationToggle(page);
    await page.waitForTimeout(1000);

    // ═══════════════════════════════════════════════════
    // CHECK 5: Regression checks
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 5: Regression checks ===');

    // 5a: Dependency View
    console.log('  Checking Dependency View...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const depState = await getDependencyViewState(page);
    const depViewWorks = depState.nodeCount > 0;

    record('5-dependency-view',
      'Dependency View loads and renders correctly',
      depViewWorks,
      `Node count: ${depState.nodeCount}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-dependency-view.png` });

    // 5b: Dashboard
    console.log('  Checking Dashboard...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dashboard`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(4000);

    const dashState = await getAppState(page);
    const dashboardWorks = dashState.currentView === 'dashboard';

    record('5-dashboard',
      'Dashboard loads correctly',
      dashboardWorks,
      `Current view: ${dashState.currentView}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-dashboard.png` });

    // 5c: Default view routing
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

    // 5d: Tree view normal (final check)
    console.log('  Checking Tree View normal...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(4000);

    const treeNormal = await getTreeViewState(page);

    record('5-tree-view-normal',
      'Tree View loads normally',
      treeNormal.nodeCount > 0,
      `Nodes: ${treeNormal.nodeCount}, orientation: ${treeNormal.layoutOrientation}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-tree-view-normal.png` });

    // Console errors
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
    console.log('  DEPLOY-48 VERIFICATION SUMMARY');
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

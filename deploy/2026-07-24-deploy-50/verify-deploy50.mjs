// Playwright verification script for deploy-50 — Feature 67 Tweak
// PR #157: feat(tree): default to LR orientation, remove rotate-button highlight
//
// Checks:
//   4(a): Tree View defaults to LR (left-to-right) without ?layoutdir= URL param
//   4(b): Rotate-toggle button has NO color/background highlight regardless of state
//   4(c): Toggle to TB — URL shows ?layoutdir=TB, layout reflows to TB, no highlight
//   4(d): Toggle back to LR — URL param removed (LR is default, omitted)
//   4(e): Solo button highlight styling is UNCHANGED (still highlights when active)
//   5:    Regression checks — Dependency View (Perf Phase 2), Dashboard, etc.

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-50';

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

    const layoutOrientation = treeView.layoutOrientation || 'unknown';
    const hierNav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');

    let orientationBtnInfo = null;
    let soloBtnInfo = null;

    if (hierNav?.shadowRoot) {
      const buttons = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
      for (const btn of buttons) {
        const icon = btn.querySelector('sl-icon');
        const iconName = icon?.getAttribute('name') || '';

        // Get computed styles
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
    const minimap = treeView.shadowRoot.querySelector('ft-minimap');

    // Check URL
    const currentUrl = window.location.href;
    const urlParams = new URL(currentUrl).searchParams;
    const layoutdirParam = urlParams.get('layoutdir');

    return {
      layoutOrientation,
      orientationBtnInfo,
      soloBtnInfo,
      nodeCount,
      minimapExists: !!minimap,
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

    const panX = depView.panX;
    const panY = depView.panY;
    const scale = depView.scale;

    return {
      totalLayoutNodes,
      totalLayoutEdges,
      domNodeCount,
      domEdgeCount,
      panX, panY, scale,
    };
  });
}

async function getSoloBtnHighlightState(page) {
  // Click a task to select it, then check Solo button styling with active class
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { error: 'no tree view shadow root' };
    const hierNav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');
    if (!hierNav?.shadowRoot) return { error: 'no hierarchy nav shadow root' };

    // Find the Solo button and check its CSS when active
    const buttons = hierNav.shadowRoot.querySelectorAll('.isolate-btn');
    let soloBtnResult = null;

    for (const btn of buttons) {
      const icon = btn.querySelector('sl-icon');
      const iconName = icon?.getAttribute('name') || '';
      if (iconName.includes('fullscreen')) {
        // Check the style rules in the shadow DOM stylesheet
        const sheets = hierNav.shadowRoot.adoptedStyleSheets || [];
        let activeRuleFound = false;
        let activeRuleText = '';

        for (const sheet of sheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText && rule.selectorText.includes('.isolate-btn.active')) {
                activeRuleFound = true;
                activeRuleText = rule.cssText;
              }
            }
          } catch (e) {
            // Cross-origin stylesheet access might fail
          }
        }

        const styles = window.getComputedStyle(btn);
        soloBtnResult = {
          found: true,
          iconName,
          hasActiveClass: btn.classList.contains('active'),
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          activeRuleExists: activeRuleFound,
          activeRuleText: activeRuleText,
          classList: Array.from(btn.classList),
        };
        break;
      }
    }

    return soloBtnResult || { found: false };
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

    let nativeCollection = collections.find(c => !c.external) || collections[0];
    console.log(`Using native collection: ${nativeCollection?.name} (${nativeCollection?.id})`);

    // ═══════════════════════════════════════════════════
    // CHECK 4(a): Tree View defaults to LR without layoutdir param
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(a): Default orientation is LR ===');

    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    let treeState = await getTreeViewState(page);
    console.log(`Tree state (no layoutdir): ${JSON.stringify(treeState, null, 2)}`);

    const defaultIsLR = treeState.layoutOrientation === 'LR';
    const noLayoutdirParam = treeState.layoutdirParam === null;
    const hasClockwiseIcon = treeState.orientationBtnInfo?.iconName === 'arrow-clockwise';

    record('4a-default-lr',
      'Tree View defaults to LR layout with no ?layoutdir= URL param',
      defaultIsLR && noLayoutdirParam,
      `Orientation: ${treeState.layoutOrientation} (expected LR). ` +
      `URL layoutdir param: ${treeState.layoutdirParam} (expected null/absent). ` +
      `Nodes: ${treeState.nodeCount}. ` +
      `Icon: ${treeState.orientationBtnInfo?.iconName} (expected arrow-clockwise for LR). ` +
      `URL: ${treeState.currentUrl}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4a-default-lr-tree.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(b): Rotate-toggle button has NO color/highlight
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(b): No highlight on rotate-toggle button ===');

    // Check the orientation button has no .active class in LR state
    const orientBtnLR = treeState.orientationBtnInfo;
    const noActiveClassLR = orientBtnLR && !orientBtnLR.hasActiveClass;
    const noActiveInClassListLR = orientBtnLR && !orientBtnLR.classList.includes('active');

    record('4b-no-highlight-lr',
      'Rotate-toggle button has NO .active class in LR state',
      noActiveClassLR && noActiveInClassListLR,
      `hasActiveClass: ${orientBtnLR?.hasActiveClass} (expected false). ` +
      `classList: ${JSON.stringify(orientBtnLR?.classList)} (should NOT include "active"). ` +
      `Icon: ${orientBtnLR?.iconName} (CW = LR state). ` +
      `Background: ${orientBtnLR?.backgroundColor}. Color: ${orientBtnLR?.color}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4b-no-highlight-lr.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(c): Toggle to TB — URL shows ?layoutdir=TB, no highlight
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(c): Toggle to TB ===');

    const toggleResult = await clickOrientationToggle(page);
    console.log(`Toggle result: ${JSON.stringify(toggleResult)}`);
    await page.waitForTimeout(2000);

    let treeStateTB = await getTreeViewState(page);
    console.log(`Tree state after toggle to TB: ${JSON.stringify(treeStateTB, null, 2)}`);

    const isTB = treeStateTB.layoutOrientation === 'TB';
    const hasLayoutdirTB = treeStateTB.layoutdirParam === 'TB';
    const hasCounterClockwiseIcon = treeStateTB.orientationBtnInfo?.iconName === 'arrow-counterclockwise';
    const noActiveClassTB = treeStateTB.orientationBtnInfo && !treeStateTB.orientationBtnInfo.hasActiveClass;
    const noActiveInClassListTB = treeStateTB.orientationBtnInfo && !treeStateTB.orientationBtnInfo.classList.includes('active');

    record('4c-toggle-to-tb',
      'Toggle to TB: orientation is TB, URL shows ?layoutdir=TB',
      isTB && hasLayoutdirTB,
      `Orientation: ${treeStateTB.layoutOrientation} (expected TB). ` +
      `URL layoutdir: ${treeStateTB.layoutdirParam} (expected TB). ` +
      `Icon: ${treeStateTB.orientationBtnInfo?.iconName} (expected arrow-counterclockwise). ` +
      `URL: ${treeStateTB.currentUrl}`);

    record('4c-no-highlight-tb',
      'Rotate-toggle button has NO .active class in TB state either',
      noActiveClassTB && noActiveInClassListTB,
      `hasActiveClass: ${treeStateTB.orientationBtnInfo?.hasActiveClass} (expected false). ` +
      `classList: ${JSON.stringify(treeStateTB.orientationBtnInfo?.classList)} (should NOT include "active"). ` +
      `Background: ${treeStateTB.orientationBtnInfo?.backgroundColor}. Color: ${treeStateTB.orientationBtnInfo?.color}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4c-tb-layout.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(d): Toggle back to LR — URL param removed
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(d): Toggle back to LR ===');

    const toggleBack = await clickOrientationToggle(page);
    console.log(`Toggle back result: ${JSON.stringify(toggleBack)}`);
    await page.waitForTimeout(2000);

    let treeStateBack = await getTreeViewState(page);
    console.log(`Tree state after toggle back to LR: ${JSON.stringify(treeStateBack, null, 2)}`);

    const backToLR = treeStateBack.layoutOrientation === 'LR';
    const paramRemoved = treeStateBack.layoutdirParam === null;
    const backToClockwise = treeStateBack.orientationBtnInfo?.iconName === 'arrow-clockwise';
    const noActiveClassBackLR = treeStateBack.orientationBtnInfo && !treeStateBack.orientationBtnInfo.hasActiveClass;

    record('4d-toggle-back-lr',
      'Toggle back to LR: orientation is LR, URL param removed (LR is default)',
      backToLR && paramRemoved,
      `Orientation: ${treeStateBack.layoutOrientation} (expected LR). ` +
      `URL layoutdir: ${treeStateBack.layoutdirParam} (expected null — omitted for default). ` +
      `Icon: ${treeStateBack.orientationBtnInfo?.iconName} (expected arrow-clockwise). ` +
      `No active class: ${noActiveClassBackLR}. ` +
      `URL: ${treeStateBack.currentUrl}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/4d-toggle-back-lr.png` });

    // ═══════════════════════════════════════════════════
    // CHECK 4(e): Solo button highlight styling UNCHANGED
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 4(e): Solo button highlight unchanged ===');

    // First, check Solo button in non-active state
    const soloInactive = treeState.soloBtnInfo;
    console.log(`Solo button (inactive): ${JSON.stringify(soloInactive, null, 2)}`);

    // Navigate with a task selected to enable Solo button, then activate Solo
    // Find a task to select
    const taskId = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return null;
      const treeView = app.shadowRoot.querySelector('ft-tree-view');
      const store = treeView?.store || app?.store;
      if (!store?.allTasks?.length) return null;
      const nonClosed = store.allTasks.filter(t => t.phase !== 4);
      return nonClosed[0]?.id || null;
    });
    console.log(`Selected task for Solo test: ${taskId}`);

    if (taskId) {
      // Navigate to tree with task selected and Solo on
      await page.goto(
        `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree&task=${taskId}&solo=1`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const treeStateSolo = await getTreeViewState(page);
      console.log(`Tree state with Solo active: ${JSON.stringify(treeStateSolo, null, 2)}`);

      const soloActive = treeStateSolo.soloBtnInfo;
      const soloBtnHasActive = soloActive?.hasActiveClass === true || soloActive?.classList?.includes('active');

      record('4e-solo-highlight-active',
        'Solo button HAS .active class / highlight when active (styling unchanged)',
        soloBtnHasActive,
        `Solo button classList: ${JSON.stringify(soloActive?.classList)}. ` +
        `hasActiveClass: ${soloActive?.hasActiveClass}. ` +
        `Icon: ${soloActive?.iconName} (expected fullscreen-exit when active). ` +
        `Background: ${soloActive?.backgroundColor}. Color: ${soloActive?.color}`);

      // Also verify the orientation button still has NO active class even during Solo
      const orientBtnDuringSolo = treeStateSolo.orientationBtnInfo;
      const noActiveDuringSolo = orientBtnDuringSolo && !orientBtnDuringSolo.hasActiveClass;

      record('4e-orient-no-highlight-during-solo',
        'Orientation toggle button still has NO highlight even during active Solo mode',
        noActiveDuringSolo,
        `Orientation btn classList: ${JSON.stringify(orientBtnDuringSolo?.classList)}. ` +
        `hasActiveClass: ${orientBtnDuringSolo?.hasActiveClass} (expected false). ` +
        `This confirms only the Solo button gets highlight, not the orientation button.`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/4e-solo-active.png` });

      // Check Solo inactive state too
      await page.goto(
        `${SERVICE_URL}/?collection=${nativeCollection.id}&view=tree&task=${taskId}`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(5000);

      const treeStateNoSolo = await getTreeViewState(page);
      const soloInactiveState = treeStateNoSolo.soloBtnInfo;
      const soloNoActiveWhenOff = soloInactiveState && !soloInactiveState.hasActiveClass;

      record('4e-solo-no-highlight-inactive',
        'Solo button has NO .active class when Solo is off (confirms toggle behavior)',
        soloNoActiveWhenOff,
        `Solo btn classList when off: ${JSON.stringify(soloInactiveState?.classList)}. ` +
        `hasActiveClass: ${soloInactiveState?.hasActiveClass} (expected false when off). ` +
        `Icon: ${soloInactiveState?.iconName} (expected fullscreen when inactive)`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/4e-solo-inactive.png` });
    } else {
      record('4e-solo-highlight-active', 'Solo button highlight when active', false,
        'No task found to select for Solo mode testing');
      record('4e-orient-no-highlight-during-solo', 'Orientation toggle no highlight during Solo', false,
        'No task found to select for Solo mode testing');
      record('4e-solo-no-highlight-inactive', 'Solo button no highlight when off', false,
        'No task found to select for Solo mode testing');
    }

    // ═══════════════════════════════════════════════════
    // CHECK 5: Regression checks
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK 5: Regression checks ===');

    // 5a: Dependency View (Perf Phase 2 viewport culling from deploy-49)
    console.log('  Checking Dependency View (viewport culling)...');
    await page.goto(
      `${SERVICE_URL}/?collection=${nativeCollection.id}&view=dependencies`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const depState = await getDependencyViewState(page);
    console.log(`Dependency View state: ${JSON.stringify(depState, null, 2)}`);

    const cullingActive = depState.totalLayoutNodes > 0 && depState.domNodeCount > 0;
    const cullingCorrect = depState.domNodeCount <= depState.totalLayoutNodes;

    record('5-dependency-view',
      'Dependency View loads with viewport culling (Perf Phase 2 from deploy-49)',
      cullingActive && cullingCorrect,
      `Layout nodes: ${depState.totalLayoutNodes}, DOM nodes: ${depState.domNodeCount}. ` +
      `Edges: ${depState.totalLayoutEdges} layout, ${depState.domEdgeCount} DOM. ` +
      `Culling correct (DOM ≤ layout): ${cullingCorrect}. Scale: ${depState.scale?.toFixed(3)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/5-dependency-view.png` });

    // 5b: Dashboard
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

    // 5d: Console errors
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
    console.log('  DEPLOY-50 VERIFICATION SUMMARY');
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

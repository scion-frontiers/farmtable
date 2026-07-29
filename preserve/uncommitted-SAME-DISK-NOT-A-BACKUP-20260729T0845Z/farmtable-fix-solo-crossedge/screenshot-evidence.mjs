/**
 * Playwright script to capture the "before" screenshot of the Solo cross-edge bug.
 *
 * Shows the dashed-blue cross-edge from Ready-15 to Deploy-to-production
 * that bypasses the selected task (D16-Run-Tests) in Solo mode.
 */

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/reports/solo-crossedge-fix-evidence';

const COLLECTION_ID = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const TASK_ID = '717ab19c-e86f-4c51-8126-fc16a8f81ef7';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`, { encoding: 'utf-8' }).trim();
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

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
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('favicon.ico')) return;
        console.log(`[console.error] ${text}`);
      }
    });

    // Step 1: Login
    console.log('Step 1: Logging in...');
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
    console.log(`Login response: status=${loginResp.status}`);

    if (loginResp.status !== 200) {
      console.error('LOGIN FAILED');
      process.exit(1);
    }

    // Step 2: Navigate to the dependency view with solo mode
    const targetUrl = `${SERVICE_URL}/?collection=${COLLECTION_ID}&view=dependencies&task=${TASK_ID}&solo=1`;
    console.log(`Step 2: Navigating to dependency view with Solo mode...`);
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(6000);

    // Step 3: Check the dependency view state
    const depState = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return { error: 'no ft-app' };
      const depView = app.shadowRoot.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dependency view' };

      const totalLayoutNodes = depView.layoutNodes ? depView.layoutNodes.length : 0;
      const totalLayoutEdges = depView.layoutEdges ? depView.layoutEdges.length : 0;
      const isolateMode = depView.isolateMode;
      const selectedTaskId = depView.selectedTaskId;

      const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg');
      const edgePaths = svgContainer?.querySelectorAll('path[class*="edge-dependency"]') || [];
      const domEdgeCount = edgePaths.length;

      // Classify rendered edges
      const blockingEdges = [];
      const blockedEdges = [];
      const crossEdges = [];
      for (const path of edgePaths) {
        const classList = Array.from(path.classList);
        const info = { d: path.getAttribute('d')?.substring(0, 60), classList };
        if (classList.includes('edge-blocking')) {
          blockingEdges.push(info);
        } else if (classList.includes('edge-blocked')) {
          blockedEdges.push(info);
        } else {
          crossEdges.push(info);
        }
      }

      // Get node labels for identification
      const foreignObjects = svgContainer?.querySelectorAll('foreignObject') || [];
      const nodeLabels = [];
      for (const fo of foreignObjects) {
        const treeNode = fo.querySelector('ft-tree-node');
        if (treeNode?.shadowRoot) {
          const nameEl = treeNode.shadowRoot.querySelector('.name');
          if (nameEl) nodeLabels.push(nameEl.textContent?.trim());
        }
      }

      return {
        totalLayoutNodes,
        totalLayoutEdges,
        isolateMode,
        selectedTaskId,
        domEdgeCount,
        blockingEdgeCount: blockingEdges.length,
        blockedEdgeCount: blockedEdges.length,
        crossEdgeCount: crossEdges.length,
        crossEdges,
        nodeLabels,
      };
    });

    console.log('\nDependency View State:');
    console.log(JSON.stringify(depState, null, 2));

    // Take the before screenshot
    await page.screenshot({
      path: `${EVIDENCE_DIR}/before-solo-crossedge.png`,
      fullPage: false,
    });
    console.log(`\nScreenshot saved: ${EVIDENCE_DIR}/before-solo-crossedge.png`);

    // Save state data
    fs.writeFileSync(
      `${EVIDENCE_DIR}/before-state.json`,
      JSON.stringify(depState, null, 2)
    );

    // Check if there are cross-edges (the bug)
    if (depState.crossEdgeCount > 0) {
      console.log(`\n*** BUG CONFIRMED: ${depState.crossEdgeCount} cross-edge(s) visible in Solo mode ***`);
    } else if (depState.error) {
      console.log(`\nWarning: Could not inspect dependency view: ${depState.error}`);
    } else {
      console.log('\nNote: No cross-edges detected (bug may have already been fixed or data changed)');
    }

  } finally {
    await browser.close();
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

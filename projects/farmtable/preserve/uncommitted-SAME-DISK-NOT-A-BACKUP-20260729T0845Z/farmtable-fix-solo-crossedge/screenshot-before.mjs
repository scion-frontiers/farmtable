/**
 * Playwright script to capture before/after screenshots of the Solo cross-edge bug.
 *
 * BEFORE: Shows the bug — a dashed-blue cross-edge from Ready-15 to Deploy-to-production
 *         that bypasses the selected task (D16-Run-Tests).
 *
 * The "after" screenshot requires the fix to be deployed, so we capture before only
 * from the live deployment, and will capture after from a local dev server with the fix.
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

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: {
      'Authorization': `Bearer ${iapToken}`,
      'Proxy-Authorization': `Bearer ${iapToken}`,
    },
  });

  const page = await context.newPage();

  // Navigate to the dependency view with Solo mode for the specific task
  const url = `${SERVICE_URL}/?collection=${COLLECTION_ID}&view=dependencies&task=${TASK_ID}&solo=1`;
  console.log(`Navigating to: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log(`Initial navigation warning: ${e.message}`);
  }

  // Inject FT token for API access
  await page.evaluate((token) => {
    localStorage.setItem('ft_token', token);
  }, FT_TOKEN);

  // Reload to pick up the token
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log(`Reload warning: ${e.message}`);
  }

  // Wait for the dependency view to render
  await page.waitForTimeout(3000);

  // Get dependency view state
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
    const edgePaths = svgContainer?.querySelectorAll('.edge-dependency') || [];
    const domEdgeCount = edgePaths.length;

    // Check for edges with the default dashed-blue style (no blocking/blocked class)
    const crossEdges = [];
    for (const path of edgePaths) {
      const classList = Array.from(path.classList);
      // Default edge-dependency without edge-blocking or edge-blocked = cross-edge
      if (classList.includes('edge-dependency') &&
          !classList.includes('edge-blocking') &&
          !classList.includes('edge-blocked')) {
        crossEdges.push({
          d: path.getAttribute('d'),
          classList: classList,
        });
      }
    }

    return {
      totalLayoutNodes,
      totalLayoutEdges,
      isolateMode,
      selectedTaskId,
      domEdgeCount,
      crossEdgeCount: crossEdges.length,
      crossEdges,
    };
  });

  console.log('Dependency View State (BEFORE fix):');
  console.log(JSON.stringify(depState, null, 2));

  // Take the screenshot
  await page.screenshot({
    path: `${EVIDENCE_DIR}/before-solo-crossedge.png`,
    fullPage: false,
  });
  console.log(`Screenshot saved: ${EVIDENCE_DIR}/before-solo-crossedge.png`);

  // Also take a zoomed-in screenshot of just the dependency view area
  const depViewHandle = await page.evaluateHandle(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return null;
    return app.shadowRoot.querySelector('ft-dependency-view');
  });

  if (depViewHandle) {
    try {
      // Get the bounding box of the component
      const box = await page.evaluate(() => {
        const app = document.querySelector('ft-app');
        const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
        if (!depView) return null;
        const rect = depView.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });

      if (box && box.width > 0 && box.height > 0) {
        await page.screenshot({
          path: `${EVIDENCE_DIR}/before-solo-crossedge-zoomed.png`,
          clip: box,
        });
        console.log(`Zoomed screenshot saved: ${EVIDENCE_DIR}/before-solo-crossedge-zoomed.png`);
      }
    } catch (e) {
      console.log(`Could not take zoomed screenshot: ${e.message}`);
    }
  }

  // Write state data as evidence
  fs.writeFileSync(
    `${EVIDENCE_DIR}/before-state.json`,
    JSON.stringify(depState, null, 2)
  );

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

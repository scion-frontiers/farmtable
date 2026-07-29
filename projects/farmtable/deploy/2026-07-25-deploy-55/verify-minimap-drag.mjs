// Focused minimap drag verification using Playwright's native mouse API
// This provides more reliable drag simulation than synthetic events

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-25-deploy-55';
const NATIVE_COLLECTION = '1e0f02d1-99cd-46bc-a739-bac0fde60710';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`, { encoding: 'utf-8' }).trim();
}

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

    // Login
    await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(async (token) => {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    }, FT_TOKEN);

    // Navigate to tree view
    console.log('\nNavigating to tree view...');
    await page.goto(`${SERVICE_URL}/?collection=${NATIVE_COLLECTION}&view=tree`, {
      waitUntil: 'load', timeout: 30000,
    });
    await page.waitForTimeout(8000);

    // Get the viewport frame's screen coordinates
    const frameInfo = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return { error: 'no app shadow root' };
      const treeView = app.shadowRoot.querySelector('ft-tree-view');
      if (!treeView?.shadowRoot) return { error: 'no tree view' };
      const minimap = treeView.shadowRoot.querySelector('ft-minimap');
      if (!minimap?.shadowRoot) return { error: 'no minimap' };

      const viewportFrame = minimap.shadowRoot.querySelector('.viewport-frame') ||
                            minimap.shadowRoot.querySelector('rect.viewport') ||
                            minimap.shadowRoot.querySelector('[class*="viewport"]');
      if (!viewportFrame) return { error: 'no viewport frame' };

      const svg = minimap.shadowRoot.querySelector('svg');
      const frameRect = viewportFrame.getBoundingClientRect();
      const svgRect = svg?.getBoundingClientRect();

      return {
        frameCenter: {
          x: frameRect.left + frameRect.width / 2,
          y: frameRect.top + frameRect.height / 2,
        },
        frameRect: { x: frameRect.x, y: frameRect.y, w: frameRect.width, h: frameRect.height },
        svgRect: svgRect ? { x: svgRect.x, y: svgRect.y, w: svgRect.width, h: svgRect.height } : null,
        panX: treeView.panX,
        panY: treeView.panY,
        scale: treeView.scale,
      };
    });

    console.log('Frame info:', JSON.stringify(frameInfo, null, 2));

    if (frameInfo.error) {
      console.error('ERROR:', frameInfo.error);
      return;
    }

    // ─── TEST 1: Minimap drag with Playwright mouse API ───
    console.log('\n=== TEST 1: Drag viewport frame with Playwright mouse ===');

    const DRAG_DELTA_X = 30;
    const DRAG_DELTA_Y = 20;
    const startX = frameInfo.frameCenter.x;
    const startY = frameInfo.frameCenter.y;

    // Record pan before drag
    const preDragPan = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      return { panX: treeView?.panX, panY: treeView?.panY };
    });
    console.log('Pre-drag pan:', JSON.stringify(preDragPan));

    // Use Playwright's native mouse API for a proper drag
    await page.mouse.move(startX, startY);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(50);

    // Move in small steps (more realistic)
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const x = startX + (DRAG_DELTA_X * i / steps);
      const y = startY + (DRAG_DELTA_Y * i / steps);
      await page.mouse.move(x, y);
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Record pan after drag
    const postDragPan = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      return { panX: treeView?.panX, panY: treeView?.panY };
    });
    console.log('Post-drag pan:', JSON.stringify(postDragPan));

    const panDeltaX = postDragPan.panX - preDragPan.panX;
    const panDeltaY = postDragPan.panY - preDragPan.panY;
    console.log(`Pan delta: (${panDeltaX.toFixed(2)}, ${panDeltaY.toFixed(2)})`);
    console.log(`Mouse delta: (${DRAG_DELTA_X}, ${DRAG_DELTA_Y})`);

    // With MINIMAP_DRAG_DAMPING = 0.35, the graph-space pan should be dampened.
    // The minimap maps the whole graph (which is much larger) into 180px, so
    // a 30px mouse delta in minimap-space maps to a much larger graph-space delta.
    // With damping: the graph-space delta = undampened_delta * 0.35
    // So whatever pan change we see, it should be ~65% less than it would be without damping.
    // We can verify the damping by checking the ratio of pan change to mouse delta.
    const dragMoved = panDeltaX !== 0 || panDeltaY !== 0;
    console.log(`Drag caused pan change: ${dragMoved}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/71-drag-test-result.png` });

    // ─── TEST 2: Second drag to verify consistent ratio ───
    console.log('\n=== TEST 2: Second drag for ratio comparison ===');

    const preDragPan2 = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      return { panX: treeView?.panX, panY: treeView?.panY };
    });

    // Drag the opposite direction to compare
    const DRAG2_DELTA_X = -30;
    const DRAG2_DELTA_Y = 0;

    // Get updated frame position
    const frameInfo2 = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      const minimap = treeView?.shadowRoot?.querySelector('ft-minimap');
      const viewportFrame = minimap?.shadowRoot?.querySelector('.viewport-frame') ||
                            minimap?.shadowRoot?.querySelector('rect.viewport') ||
                            minimap?.shadowRoot?.querySelector('[class*="viewport"]');
      if (!viewportFrame) return null;
      const r = viewportFrame.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });

    if (frameInfo2) {
      await page.mouse.move(frameInfo2.cx, frameInfo2.cy);
      await page.waitForTimeout(100);
      await page.mouse.down();
      await page.waitForTimeout(50);
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(
          frameInfo2.cx + (DRAG2_DELTA_X * i / steps),
          frameInfo2.cy + (DRAG2_DELTA_Y * i / steps)
        );
        await page.waitForTimeout(30);
      }
      await page.waitForTimeout(200);
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    const postDragPan2 = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      return { panX: treeView?.panX, panY: treeView?.panY };
    });

    const panDelta2X = postDragPan2.panX - preDragPan2.panX;
    const panDelta2Y = postDragPan2.panY - preDragPan2.panY;
    console.log(`Second drag - Pan delta: (${panDelta2X.toFixed(2)}, ${panDelta2Y.toFixed(2)})`);
    console.log(`Second drag - Mouse delta: (${DRAG2_DELTA_X}, ${DRAG2_DELTA_Y})`);

    // ─── TEST 3: Click-to-jump (should be 1:1, no damping) ───
    console.log('\n=== TEST 3: Click-to-jump (should NOT be dampened) ===');

    // Get current minimap SVG rect and frame position
    const clickInfo = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      const minimap = treeView?.shadowRoot?.querySelector('ft-minimap');
      const svg = minimap?.shadowRoot?.querySelector('svg');
      const viewportFrame = minimap?.shadowRoot?.querySelector('.viewport-frame') ||
                            minimap?.shadowRoot?.querySelector('rect.viewport') ||
                            minimap?.shadowRoot?.querySelector('[class*="viewport"]');
      if (!svg) return { error: 'no svg' };
      const svgRect = svg.getBoundingClientRect();
      const frameRect = viewportFrame?.getBoundingClientRect();
      return {
        svgRect: { x: svgRect.x, y: svgRect.y, w: svgRect.width, h: svgRect.height },
        frameRect: frameRect ? { x: frameRect.x, y: frameRect.y, w: frameRect.width, h: frameRect.height } : null,
      };
    });

    // Click in a corner of the minimap away from the frame
    let clickX = clickInfo.svgRect.x + 15;
    let clickY = clickInfo.svgRect.y + 15;

    if (clickInfo.frameRect) {
      // Make sure we're outside the frame
      if (clickX >= clickInfo.frameRect.x && clickX <= clickInfo.frameRect.x + clickInfo.frameRect.w &&
          clickY >= clickInfo.frameRect.y && clickY <= clickInfo.frameRect.y + clickInfo.frameRect.h) {
        // Try bottom right corner instead
        clickX = clickInfo.svgRect.x + clickInfo.svgRect.w - 15;
        clickY = clickInfo.svgRect.y + clickInfo.svgRect.h - 15;
      }
    }

    const preClickPan = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      return { panX: treeView?.panX, panY: treeView?.panY };
    });

    // Click on the minimap background
    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(500);

    const postClickPan = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
      return { panX: treeView?.panX, panY: treeView?.panY };
    });

    const clickPanDeltaX = postClickPan.panX - preClickPan.panX;
    const clickPanDeltaY = postClickPan.panY - preClickPan.panY;
    console.log(`Click-to-jump - Pre-pan: (${preClickPan.panX.toFixed(2)}, ${preClickPan.panY.toFixed(2)})`);
    console.log(`Click-to-jump - Post-pan: (${postClickPan.panX.toFixed(2)}, ${postClickPan.panY.toFixed(2)})`);
    console.log(`Click-to-jump - Pan delta: (${clickPanDeltaX.toFixed(2)}, ${clickPanDeltaY.toFixed(2)})`);
    console.log(`Click-to-jump caused pan change: ${clickPanDeltaX !== 0 || clickPanDeltaY !== 0}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/71-click-to-jump-result.png` });

    // ─── Summary ───
    console.log('\n═══════════════════════════════════════════');
    console.log('  MINIMAP DRAG DAMPING TEST SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log(`  Drag Test 1: mouse_delta=(${DRAG_DELTA_X}, ${DRAG_DELTA_Y}) → pan_delta=(${panDeltaX.toFixed(2)}, ${panDeltaY.toFixed(2)}) | moved=${dragMoved}`);
    console.log(`  Drag Test 2: mouse_delta=(${DRAG2_DELTA_X}, ${DRAG2_DELTA_Y}) → pan_delta=(${panDelta2X.toFixed(2)}, ${panDelta2Y.toFixed(2)})`);
    console.log(`  Click-to-jump: pan_delta=(${clickPanDeltaX.toFixed(2)}, ${clickPanDeltaY.toFixed(2)}) | moved=${clickPanDeltaX !== 0 || clickPanDeltaY !== 0}`);

    // Save detailed results
    const detailedResults = {
      dragTest1: {
        mouseDelta: { x: DRAG_DELTA_X, y: DRAG_DELTA_Y },
        panBefore: preDragPan,
        panAfter: postDragPan,
        panDelta: { x: panDeltaX, y: panDeltaY },
        moved: dragMoved,
      },
      dragTest2: {
        mouseDelta: { x: DRAG2_DELTA_X, y: DRAG2_DELTA_Y },
        panBefore: preDragPan2,
        panAfter: postDragPan2,
        panDelta: { x: panDelta2X, y: panDelta2Y },
      },
      clickToJump: {
        clickPosition: { x: clickX, y: clickY },
        panBefore: preClickPan,
        panAfter: postClickPan,
        panDelta: { x: clickPanDeltaX, y: clickPanDeltaY },
        moved: clickPanDeltaX !== 0 || clickPanDeltaY !== 0,
      },
      frameInfo,
    };

    fs.writeFileSync(`${EVIDENCE_DIR}/minimap-drag-test-results.json`,
      JSON.stringify(detailedResults, null, 2));

    console.log('\n  Results saved to minimap-drag-test-results.json');
    console.log('═══════════════════════════════════════════\n');

  } catch (err) {
    console.error('FATAL ERROR:', err);
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

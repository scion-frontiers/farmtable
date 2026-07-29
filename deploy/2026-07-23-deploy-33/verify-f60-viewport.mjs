/**
 * Feature 60 Live Verification — Viewport Stability
 *
 * Tests two collections:
 * 1. "jibo" — has rendered dependency nodes with significant viewport offset
 * 2. "github-experiment" — external GitHub collection (polling path)
 *
 * For each: capture viewport pan/scale via page.evaluate(), wait through
 * data refresh cycles, and confirm viewport values are stable (zero drift).
 */
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-33';
const BASE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';

const IAP_TOKEN = execSync(
  `gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`,
  { encoding: 'utf-8' }
).trim();
const FT_TOKEN = execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();

const COLLECTIONS = [
  { id: '7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7', name: 'jibo', desc: 'Internal collection with dependency graph' },
  { id: '6a0a49f9-9c61-46cf-af5a-46f98f90ff20', name: 'github-experiment-scion-frontiers-farmtable', desc: 'External GitHub collection (polling)' },
];

const log = [];
function logMsg(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  log.push(line);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    extraHTTPHeaders: { 'Authorization': `Bearer ${IAP_TOKEN}` },
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  // Track all gRPC requests
  const grpcRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('FarmTableService')) {
      grpcRequests.push({ time: Date.now(), endpoint: url.split('/').pop() });
    }
  });

  const results = {};

  try {
    for (const coll of COLLECTIONS) {
      logMsg(`\n${'='.repeat(60)}`);
      logMsg(`TESTING: ${coll.name}`);
      logMsg(`Description: ${coll.desc}`);
      logMsg(`${'='.repeat(60)}`);

      // Clear request tracking
      const collReqStart = grpcRequests.length;

      const url = `${BASE_URL}/?token=${encodeURIComponent(FT_TOKEN)}&collection=${coll.id}&view=dependencies`;
      logMsg(`Navigating to: ${url.replace(FT_TOKEN, 'FT_TOKEN_REDACTED')}`);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const depViewLocator = page.locator('ft-dependency-view');
      await depViewLocator.waitFor({ timeout: 30000 });
      logMsg('ft-dependency-view found.');

      // Wait for data to load and graph to render
      await page.waitForTimeout(10000);

      // Get connection and polling status
      const connState = await page.locator('ft-app').evaluate(el => ({
        currentView: el.currentView,
        isPolling: el.isPolling,
        connectionStatus: el.connectionStatus,
        isExternalWritable: el.isExternalWritable,
        pollManagerExists: !!el.pollManager,
        pollManagerActive: el.pollManager ? !!el.pollManager._intervalId : false,
        pollInterval: el.pollManager?.intervalMs,
        streamManagerExists: !!el.streamManager,
      }));
      logMsg(`Connection state: ${JSON.stringify(connState)}`);

      // Get initial viewport
      const initial = await depViewLocator.evaluate(el => ({
        panX: el.panX, panY: el.panY, scale: el.scale,
        hasEmpty: !!el.querySelector('ft-empty-state') || !!el.shadowRoot?.querySelector('ft-empty-state'),
      }));
      logMsg(`INITIAL: panX=${initial.panX}, panY=${initial.panY}, scale=${initial.scale}, empty=${initial.hasEmpty}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/${coll.name.replace(/[^a-z0-9-]/gi, '-')}-dep-initial.png`, fullPage: false });

      // Interact: pan and zoom
      logMsg('Interacting: pan + zoom...');
      const box = await depViewLocator.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(500);
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 120, cy + 60, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
      }

      const afterInteract = await depViewLocator.evaluate(el => ({
        panX: el.panX, panY: el.panY, scale: el.scale,
      }));
      logMsg(`AFTER INTERACTION: panX=${afterInteract.panX}, panY=${afterInteract.panY}, scale=${afterInteract.scale}`);

      const changed = initial.panX !== afterInteract.panX || initial.panY !== afterInteract.panY || initial.scale !== afterInteract.scale;
      logMsg(changed ? 'Viewport changed by interaction ✓' : 'WARNING: Viewport unchanged (empty state?)');

      // Reference point for drift measurement
      const ref = afterInteract;
      const monitorStart = Date.now();
      const pollsBefore = grpcRequests.filter(r => r.endpoint === 'ListTasks').length;

      // Monitor for 40 seconds (covers ~2 poll cycles at 15s or ~1.3 at 30s)
      const samples = [];
      const WAIT_MS = 40000;
      const INTERVAL = 5000;
      const N = WAIT_MS / INTERVAL;

      logMsg(`\nMonitoring for ${WAIT_MS / 1000}s...`);
      for (let i = 0; i < N; i++) {
        await page.waitForTimeout(INTERVAL);
        const vp = await depViewLocator.evaluate(el => ({
          panX: el.panX, panY: el.panY, scale: el.scale,
        }));
        const elapsed = (i + 1) * INTERVAL / 1000;
        const dPX = Math.abs(vp.panX - ref.panX);
        const dPY = Math.abs(vp.panY - ref.panY);
        const dS = Math.abs(vp.scale - ref.scale);
        const curPolls = grpcRequests.filter(r => r.endpoint === 'ListTasks').length;
        logMsg(`  [${i + 1}] t+${elapsed}s: panX=${vp.panX} panY=${vp.panY} scale=${vp.scale} | ListTasks=${curPolls} | drift: pX=${dPX.toFixed(3)} pY=${dPY.toFixed(3)} s=${dS.toFixed(6)}`);
        samples.push({ elapsed, ...vp, dPX, dPY, dS, listTasksCalls: curPolls });
      }

      await page.screenshot({ path: `${EVIDENCE_DIR}/${coll.name.replace(/[^a-z0-9-]/gi, '-')}-dep-final.png`, fullPage: false });

      // Analyze
      const pollsAfter = grpcRequests.filter(r => r.endpoint === 'ListTasks').length;
      const pollsDuring = pollsAfter - pollsBefore;
      const maxDrift = {
        panX: Math.max(...samples.map(s => s.dPX)),
        panY: Math.max(...samples.map(s => s.dPY)),
        scale: Math.max(...samples.map(s => s.dS)),
      };
      const stable = maxDrift.panX < 0.5 && maxDrift.panY < 0.5 && maxDrift.scale < 0.001;

      // All gRPC during this collection's test
      const collReqs = grpcRequests.slice(collReqStart).map(r => ({
        time: new Date(r.time).toISOString(),
        endpoint: r.endpoint,
      }));

      logMsg(`\n--- Result for ${coll.name} ---`);
      logMsg(`Max drift: panX=${maxDrift.panX.toFixed(3)} panY=${maxDrift.panY.toFixed(3)} scale=${maxDrift.scale.toFixed(6)}`);
      logMsg(`ListTasks poll calls during monitor: ${pollsDuring}`);
      logMsg(`All gRPC calls: ${collReqs.map(r => r.endpoint).join(', ')}`);
      logMsg(`Stable: ${stable}`);

      results[coll.name] = {
        collectionId: coll.id,
        description: coll.desc,
        connectionState: connState,
        initialViewport: initial,
        afterInteraction: afterInteract,
        viewportChanged: changed,
        samples,
        maxDrift,
        stable,
        pollsDuringMonitor: pollsDuring,
        grpcRequests: collReqs,
        verdict: stable ? (pollsDuring >= 2 ? 'PASS' : 'PASS_NO_POLL') : 'FAIL',
      };
    }

    // ── Tree view check ──
    logMsg(`\n${'='.repeat(60)}`);
    logMsg('TREE VIEW CHECK (jibo collection)');
    logMsg(`${'='.repeat(60)}`);

    const treeUrl = `${BASE_URL}/?token=${encodeURIComponent(FT_TOKEN)}&collection=${COLLECTIONS[0].id}&view=tree`;
    await page.goto(treeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const treeLocator = page.locator('ft-tree-view');

    try {
      await treeLocator.waitFor({ timeout: 15000 });
      await page.waitForTimeout(5000);

      const treeInit = await treeLocator.evaluate(el => ({
        panX: el.panX, panY: el.panY, scale: el.scale,
      }));
      logMsg(`Tree initial: ${JSON.stringify(treeInit)}`);

      await page.waitForTimeout(20000);

      const treeAfter = await treeLocator.evaluate(el => ({
        panX: el.panX, panY: el.panY, scale: el.scale,
      }));
      logMsg(`Tree after 20s: ${JSON.stringify(treeAfter)}`);

      const treeDrift = {
        panX: Math.abs(treeAfter.panX - treeInit.panX),
        panY: Math.abs(treeAfter.panY - treeInit.panY),
        scale: Math.abs(treeAfter.scale - treeInit.scale),
      };
      logMsg(`Tree drift: panX=${treeDrift.panX.toFixed(3)} panY=${treeDrift.panY.toFixed(3)} scale=${treeDrift.scale.toFixed(6)}`);
      results['tree-view'] = {
        initial: treeInit,
        after: treeAfter,
        drift: treeDrift,
        verdict: (treeDrift.panX < 0.5 && treeDrift.panY < 0.5 && treeDrift.scale < 0.001) ? 'PASS' : 'DRIFT',
      };
      logMsg(`Tree view: ${results['tree-view'].verdict === 'PASS' ? '✅ PASS' : '⚠️ DRIFT'}`);

      await page.screenshot({ path: `${EVIDENCE_DIR}/tree-view-final.png`, fullPage: false });
    } catch (e) {
      logMsg(`Tree view: ${e.message}`);
      results['tree-view'] = { verdict: 'SKIP', error: e.message };
    }

    // ── Final summary ──
    logMsg(`\n${'='.repeat(60)}`);
    logMsg('FINAL SUMMARY');
    logMsg(`${'='.repeat(60)}`);

    for (const [name, r] of Object.entries(results)) {
      logMsg(`  ${name}: ${r.verdict}`);
    }

    // Overall: PASS if all collections show stable viewport
    const allStable = Object.values(results).every(r => r.verdict === 'PASS' || r.verdict === 'PASS_NO_POLL');
    const anyPollVerified = Object.values(results).some(r => r.verdict === 'PASS');

    const overall = allStable ? (anyPollVerified ? 'PASS' : 'PASS_NO_POLL') : 'FAIL';
    logMsg(`\nOVERALL VERDICT: ${overall}`);

    // Save
    const report = {
      test: 'Feature 60 Viewport Stability — Live Verification',
      timestamp: new Date().toISOString(),
      serviceUrl: BASE_URL,
      revision: 'farmtable-00039-8xw',
      commit: 'c957f7e',
      results,
      overallVerdict: overall,
    };

    fs.writeFileSync(`${EVIDENCE_DIR}/viewport-stability-report.json`, JSON.stringify(report, null, 2));
    fs.writeFileSync(`${EVIDENCE_DIR}/viewport-stability-log.txt`, log.join('\n'));
    logMsg(`\nEvidence saved to ${EVIDENCE_DIR}`);

  } catch (err) {
    logMsg(`ERROR: ${err.message}`);
    console.error(err);
    fs.writeFileSync(`${EVIDENCE_DIR}/viewport-stability-log.txt`, log.join('\n'));
  } finally {
    await browser.close();
  }
})();

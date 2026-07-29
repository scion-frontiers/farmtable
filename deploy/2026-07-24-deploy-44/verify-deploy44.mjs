// Playwright verification script for deploy-44 — Feature 65: Dashboard Ready Count
// Checks:
//   a. Load the Dashboard view, confirm the Ready count appears and is a plausible number.
//   b. Cross-check: navigate to Ready Queue view for the same collection, confirm the
//      count matches.
//   c. Click the Ready count card, confirm it navigates to Ready Queue.
//   d. Confirm no console errors, no regression to other Dashboard stats.

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-44';

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

async function getCurrentView(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return null;
    return app.currentView || null;
  });
}

/**
 * Extract Dashboard stats from the live DOM.
 * Returns an object with phase stats array, readyCount, totalCount, and
 * whether the ready card element exists.
 */
async function getDashboardStats(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const dashboard = app.shadowRoot.querySelector('ft-dashboard-view');
    if (!dashboard?.shadowRoot) return { error: 'no dashboard shadow root' };

    const cards = dashboard.shadowRoot.querySelectorAll('.stat-card');
    const stats = [];
    let readyCount = null;
    let readyCardFound = false;
    let totalCount = null;

    for (const card of cards) {
      const countEl = card.querySelector('.stat-count');
      const labelEl = card.querySelector('.stat-label');
      const count = countEl ? parseInt(countEl.textContent.trim(), 10) : null;
      const label = labelEl ? labelEl.textContent.trim() : null;

      if (card.classList.contains('ready')) {
        readyCount = count;
        readyCardFound = true;
      } else if (card.classList.contains('total')) {
        totalCount = count;
      }

      stats.push({
        label,
        count,
        isReady: card.classList.contains('ready'),
        isTotal: card.classList.contains('total'),
        hasClickHandler: card.hasAttribute('role') && card.getAttribute('role') === 'link',
      });
    }

    return { stats, readyCount, readyCardFound, totalCount };
  });
}

/**
 * Get the count of items in the Ready Queue view.
 * The component is `ft-ready-queue-view` (not `ft-ready-queue`).
 * It renders a `.queue-header` h2 with text "Ready Queue (N)" and
 * `.queue-row` divs for each task.
 */
async function getReadyQueueCount(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const readyQueue = app.shadowRoot.querySelector('ft-ready-queue-view');
    if (!readyQueue?.shadowRoot) return { error: 'no ready queue shadow root' };

    // Count .queue-row elements (one per ready task)
    const queueRows = readyQueue.shadowRoot.querySelectorAll('.queue-row');

    // Extract count from the header "Ready Queue (N)"
    const header = readyQueue.shadowRoot.querySelector('.queue-header');
    let headerCount = null;
    if (header) {
      const match = header.textContent?.match(/\((\d+)\)/);
      if (match) {
        headerCount = parseInt(match[1], 10);
      }
    }

    return {
      domItemCount: queueRows.length,
      headerCount,
      bestCount: headerCount ?? queueRows.length,
    };
  });
}

/**
 * Click the Ready card on the Dashboard and return the resulting view.
 */
async function clickReadyCard(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app shadow root' };
    const dashboard = app.shadowRoot.querySelector('ft-dashboard-view');
    if (!dashboard?.shadowRoot) return { error: 'no dashboard shadow root' };

    const readyCard = dashboard.shadowRoot.querySelector('.stat-card.ready');
    if (!readyCard) return { error: 'ready card not found' };

    readyCard.click();
    return { clicked: true };
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
    console.log('\n=== Finding collection ===');
    const collectionData = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return [];
      const picker = app.shadowRoot.querySelector('ft-collection-list');
      if (!picker?.collections) return [];
      return picker.collections.map(c => ({ id: c.id, name: c.name }));
    });
    console.log(`Collections: ${JSON.stringify(collectionData?.slice(0, 5))}`);

    let targetCollectionId = null;
    if (collectionData && collectionData.length > 0) {
      const prefs = [
        c => c.name === 'default',
        c => c.name?.includes('deploy4-web'),
        c => c.name?.includes('deploy4-cli'),
      ];
      let target = null;
      for (const pred of prefs) {
        target = collectionData.find(pred);
        if (target) break;
      }
      if (!target) target = collectionData[0];
      targetCollectionId = target.id;
      console.log(`Primary collection: ${target.name} (${targetCollectionId})`);
    }

    // ═══════════════════════════════════════════════════
    // CHECK (a): Dashboard Ready count appears and is plausible
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (a): Dashboard Ready count ===');

    // Navigate to Dashboard view
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=dashboard`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const currentView = await getCurrentView(page);
    console.log(`Current view: ${currentView}`);

    const dashStats = await getDashboardStats(page);
    console.log(`Dashboard stats: ${JSON.stringify(dashStats)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/a-dashboard-ready-count.png` });

    // Check (a.1): Ready card exists
    record('a-ready-card-exists', 'Ready stat card exists on Dashboard',
      dashStats.readyCardFound === true,
      `readyCardFound: ${dashStats.readyCardFound}, readyCount: ${dashStats.readyCount}`);

    // Check (a.2): Ready count is a plausible number (non-negative integer, ≤ total)
    const readyPlausible = dashStats.readyCount !== null &&
      Number.isInteger(dashStats.readyCount) &&
      dashStats.readyCount >= 0 &&
      (dashStats.totalCount === null || dashStats.readyCount <= dashStats.totalCount);

    record('a-ready-count-plausible', 'Ready count is a plausible number',
      readyPlausible,
      `readyCount: ${dashStats.readyCount}, totalCount: ${dashStats.totalCount}`);

    // ═══════════════════════════════════════════════════
    // CHECK (b): Cross-check with Ready Queue view
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (b): Cross-check with Ready Queue ===');

    // Remember the dashboard ready count
    const dashboardReadyCount = dashStats.readyCount;

    // Navigate to Ready Queue view
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=ready-queue`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const readyQueueView = await getCurrentView(page);
    console.log(`Current view: ${readyQueueView}`);

    const rqCount = await getReadyQueueCount(page);
    console.log(`Ready Queue count: ${JSON.stringify(rqCount)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/b-ready-queue-view.png` });

    const readyQueueActualCount = rqCount.bestCount;
    const countsMatch = dashboardReadyCount === readyQueueActualCount;

    record('b-count-cross-check', 'Dashboard Ready count matches Ready Queue item count',
      countsMatch,
      `Dashboard Ready: ${dashboardReadyCount}, Ready Queue: ${readyQueueActualCount} ` +
      `(dom: ${rqCount.domItemCount}, header: ${rqCount.headerCount}, property: ${rqCount.propertyCount})`);

    // ═══════════════════════════════════════════════════
    // CHECK (c): Click Ready card → navigates to Ready Queue
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (c): Click Ready card → Ready Queue ===');

    // Go back to Dashboard
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=dashboard`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const preDashView = await getCurrentView(page);
    console.log(`Before click, view: ${preDashView}`);

    // Click the ready card
    const clickResult = await clickReadyCard(page);
    console.log(`Click result: ${JSON.stringify(clickResult)}`);

    // Wait for navigation
    await page.waitForTimeout(2000);

    const postClickView = await getCurrentView(page);
    console.log(`After click, view: ${postClickView}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/c-after-ready-click.png` });

    record('c-ready-card-click-navigates', 'Clicking Ready card navigates to Ready Queue',
      postClickView === 'ready-queue',
      `View before: ${preDashView}, view after: ${postClickView}`);

    // ═══════════════════════════════════════════════════
    // CHECK (d): No console errors, no regression to other Dashboard stats
    // ═══════════════════════════════════════════════════
    console.log('\n=== CHECK (d): No console errors, no regression ===');

    // Go back to Dashboard to verify other stats are still there
    await page.goto(
      `${SERVICE_URL}/?collection=${targetCollectionId}&view=dashboard`,
      { waitUntil: 'load', timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const finalDashStats = await getDashboardStats(page);
    console.log(`Final dashboard stats: ${JSON.stringify(finalDashStats)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/d-dashboard-regression.png` });

    // Check that the other stat cards (phase stats + total) are still present
    const phaseCards = finalDashStats.stats?.filter(s => !s.isReady && !s.isTotal) || [];
    const totalCard = finalDashStats.stats?.find(s => s.isTotal);
    const hasPhaseStats = phaseCards.length > 0 && phaseCards.every(s => s.count !== null);
    const hasTotalStat = totalCard && totalCard.count !== null && totalCard.count > 0;

    record('d-other-stats-present', 'Other Dashboard stats (phase, total) are present and non-null',
      hasPhaseStats && hasTotalStat,
      `Phase cards: ${phaseCards.length} (all have counts: ${phaseCards.every(s => s.count !== null)}). ` +
      `Total card: ${totalCard?.count}. All stats: ${JSON.stringify(finalDashStats.stats?.map(s => `${s.label}:${s.count}`))}`);

    // Final console error check
    const relevantErrors = consoleErrors.filter(e =>
      !e.text?.includes('401') &&
      !e.text?.includes('favicon') &&
      !e.url?.includes('favicon') &&
      !e.text?.includes('net::ERR') &&
      !e.text?.includes('Slow network') &&
      !e.text?.includes('Response closed without grpc-status') &&
      !e.text?.includes('Stream error: GrpcError')
    );

    record('d-no-console-errors', 'No relevant console errors during entire verification',
      relevantErrors.length === 0,
      relevantErrors.length > 0
        ? `${relevantErrors.length} error(s): ${JSON.stringify(relevantErrors.slice(0, 5))}`
        : `Zero relevant console errors (${consoleErrors.length} total, all filtered)`);

    await context.close();
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════
  console.log('\n=== DEPLOY-44 VERIFICATION RESULTS ===');
  const allPass = results.every(r => r.pass);
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  for (const r of results) {
    console.log(`  [${r.check}] ${r.pass ? 'PASS' : 'FAIL'}: ${r.action}`);
  }
  console.log(`\n${passCount}/${results.length} passed, ${failCount} failed`);
  console.log(allPass ? '\nAll checks PASSED' : '\nSome checks FAILED!');

  fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`, JSON.stringify({
    testDate: new Date().toISOString(),
    deployRevision: 'farmtable-00051-l7d',
    commitSha: 'e5218539d576be5a8788da9d410aac4ef0b8a134',
    feature: 'Feature 65 — Dashboard Ready item count (PR #148)',
    serviceUrl: SERVICE_URL,
    result: allPass ? 'ALL PASS' : 'SOME FAILED',
    passCount,
    failCount,
    totalChecks: results.length,
    checks: results,
  }, null, 2));
  fs.writeFileSync(`${EVIDENCE_DIR}/console-errors.json`, JSON.stringify(consoleErrors, null, 2));
  process.exit(allPass ? 0 : 1);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

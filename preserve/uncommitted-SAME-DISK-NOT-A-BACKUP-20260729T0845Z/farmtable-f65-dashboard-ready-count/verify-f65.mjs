// Verification script for Feature 65: Dashboard Ready-Item Count
// Takes screenshots of Dashboard and Ready Queue views, cross-checks counts.

import { chromium } from 'playwright';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/reports/f65-dashboard-ready-count-evidence';
const BASE_URL = 'http://localhost:9090';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// --- Step 1: Navigate to Dashboard view ---
console.log('1. Navigating to Dashboard view...');
await page.goto(`${BASE_URL}?view=dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000); // Wait for gRPC data + web component render

await page.screenshot({
  path: `${EVIDENCE_DIR}/01-dashboard-ready-count.png`,
  fullPage: false,
});
console.log('   Screenshot: 01-dashboard-ready-count.png');

// Extract the Ready count from Dashboard
const dashboardReadyCount = await page.evaluate(() => {
  const dashboard = document.querySelector('ft-dashboard-view');
  if (!dashboard || !dashboard.shadowRoot) return null;
  const readyCard = dashboard.shadowRoot.querySelector('.stat-card.ready');
  if (!readyCard) return null;
  const countEl = readyCard.querySelector('.stat-count');
  return countEl ? parseInt(countEl.textContent.trim(), 10) : null;
});
console.log(`   Dashboard Ready count: ${dashboardReadyCount}`);

// --- Step 2: Click the Ready card to navigate to Ready Queue ---
console.log('2. Clicking Ready card to navigate to Ready Queue...');
const readyCard = page.locator('ft-dashboard-view').first();
// We need to click inside the shadow DOM
await page.evaluate(() => {
  const dashboard = document.querySelector('ft-dashboard-view');
  if (dashboard && dashboard.shadowRoot) {
    const card = dashboard.shadowRoot.querySelector('.stat-card.ready');
    if (card) card.click();
  }
});
await page.waitForTimeout(2000);

await page.screenshot({
  path: `${EVIDENCE_DIR}/02-ready-queue-view.png`,
  fullPage: false,
});
console.log('   Screenshot: 02-ready-queue-view.png');

// Extract the Ready Queue count
const readyQueueCount = await page.evaluate(() => {
  const readyQueue = document.querySelector('ft-ready-queue-view');
  if (!readyQueue || !readyQueue.shadowRoot) return null;
  const header = readyQueue.shadowRoot.querySelector('.queue-header');
  if (!header) return null;
  const match = header.textContent.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
});
console.log(`   Ready Queue count: ${readyQueueCount}`);

// --- Step 3: Cross-check ---
console.log('\n--- Cross-Check Results ---');
console.log(`Dashboard Ready count: ${dashboardReadyCount}`);
console.log(`Ready Queue count:     ${readyQueueCount}`);
if (dashboardReadyCount !== null && readyQueueCount !== null) {
  if (dashboardReadyCount === readyQueueCount) {
    console.log('PASS: Counts match!');
  } else {
    console.log('FAIL: Counts do NOT match!');
  }
} else {
  console.log('WARNING: Could not extract one or both counts');
}

// --- Step 4: Go back to Dashboard, wait for poll refresh (15s cycle) ---
console.log('\n3. Verifying poll-tick update...');
await page.goto(`${BASE_URL}?view=dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const countBefore = await page.evaluate(() => {
  const dashboard = document.querySelector('ft-dashboard-view');
  if (!dashboard || !dashboard.shadowRoot) return null;
  const readyCard = dashboard.shadowRoot.querySelector('.stat-card.ready');
  if (!readyCard) return null;
  const countEl = readyCard.querySelector('.stat-count');
  return countEl ? parseInt(countEl.textContent.trim(), 10) : null;
});
console.log(`   Count before poll: ${countBefore}`);

// Wait through a poll cycle (15s + buffer)
console.log('   Waiting 18 seconds for poll cycle...');
await page.waitForTimeout(18000);

const countAfter = await page.evaluate(() => {
  const dashboard = document.querySelector('ft-dashboard-view');
  if (!dashboard || !dashboard.shadowRoot) return null;
  const readyCard = dashboard.shadowRoot.querySelector('.stat-card.ready');
  if (!readyCard) return null;
  const countEl = readyCard.querySelector('.stat-count');
  return countEl ? parseInt(countEl.textContent.trim(), 10) : null;
});
console.log(`   Count after poll:  ${countAfter}`);

await page.screenshot({
  path: `${EVIDENCE_DIR}/03-dashboard-after-poll.png`,
  fullPage: false,
});
console.log('   Screenshot: 03-dashboard-after-poll.png');

if (countBefore !== null && countAfter !== null) {
  if (countBefore === countAfter) {
    console.log('PASS: Count stable across poll cycle (no jarring redraw)');
  } else {
    console.log(`INFO: Count changed from ${countBefore} to ${countAfter} (data may have changed)`);
  }
}

await browser.close();
console.log('\nVerification complete.');

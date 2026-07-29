import { chromium } from '/scion-volumes/scratchpad/web-test/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const appUrl = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const repoRoot = '/workspace/farmtable';
const distDir = path.join(repoRoot, 'web/dist/assets');
const outputDir = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-37-scroll-to-item';

fs.mkdirSync(outputDir, { recursive: true });

const jsAsset = fs.readdirSync(distDir).find((file) => /^index-.*\.js$/.test(file));
const cssAsset = fs.readdirSync(distDir).find((file) => /^index-.*\.css$/.test(file));

if (!jsAsset || !cssAsset) {
  throw new Error('Expected built Vite JS and CSS assets in web/dist/assets');
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });

// Route local assets
await page.route('**/assets/index-*.js', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: fs.readFileSync(path.join(distDir, jsAsset)),
  });
});

await page.route('**/assets/index-*.css', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: fs.readFileSync(path.join(distDir, cssAsset)),
  });
});

// Navigate to the app — starts at collection selector
await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('ft-app');
await page.waitForTimeout(1500);

// Click the "default" collection to enter the board view
console.log('Selecting "default" collection...');
const collectionCard = page.getByText('default', { exact: true }).first();
await collectionCard.click();
await page.waitForTimeout(3000); // Wait for collection load + stream + render

// Now stop the stream and seed our test data
console.log('Seeding test data...');
await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app) throw new Error('ft-app not found');

  // Stop the live stream so it doesn't overwrite our seeded data
  app.streamManager?.stop?.();
  app.connectionStatus = 'live';
  app.phaseFilter = null;
  app.assigneeFilter = null;

  const now = new Date().toISOString();
  const makeTask = (id, name, stage, phase, priority = 3, relationships = []) => ({
    id,
    name,
    description: `${name} — seeded for Feature 37 screenshot.`,
    phase,
    stage,
    priority,
    assignees: [],
    relationships,
    collectionId: app.currentCollectionId || 'default',
    labels: [],
    customFields: [],
    platform: 1,
    createdAt: now,
    updatedAt: now,
    version: 'feature-37',
  });

  app.taskStore.clear();

  const tasks = [];

  // Create many tasks in Ready column (stage=3, phase=1=OPEN) to force scrolling
  for (let i = 1; i <= 25; i++) {
    tasks.push(makeTask(`ready-${i}`, `Ready Task ${i}`, 3, 1, (i % 5) + 1));
  }

  // Create tasks in Working column (stage=4, phase=2=IN_PROGRESS)
  for (let i = 1; i <= 10; i++) {
    tasks.push(makeTask(`working-${i}`, `Working Task ${i}`, 4, 2, (i % 5) + 1));
  }

  // Create tasks in Backlog column (stage=2, phase=1=OPEN)
  for (let i = 1; i <= 8; i++) {
    tasks.push(makeTask(`backlog-${i}`, `Backlog Task ${i}`, 2, 1, (i % 5) + 1));
  }

  // Create a CLOSED task that should NOT appear in kanban/ready-queue
  tasks.push(makeTask('closed-target', 'Closed Target Task', 12, 4, 1));

  tasks.forEach((task) => app.taskStore.upsert(task));
  app.taskStore.snapshotComplete();
  app.requestUpdate();
});

await page.waitForTimeout(2000);

/**
 * Helper: simulate task navigation by calling onTaskSelect directly.
 * TypeScript's 'private' is compile-time only — we can access it at runtime.
 * This is exactly what happens when a user clicks a relationship link or
 * selects from the command palette.
 */
async function navigateToTask(taskId) {
  await page.evaluate((id) => {
    const app = document.querySelector('ft-app');
    if (!app) throw new Error('ft-app not found');
    // Call the private onTaskSelect handler directly (TS private is not enforced at runtime)
    const event = new CustomEvent('task-select', { detail: { taskId: id } });
    app['onTaskSelect'](event);
  }, taskId);
}

// ─── Screenshot (a): Kanban - Navigate to a task, card scrolled into view ───

// First select a task near the top to open the inspector panel
console.log('Step 1: Selecting ready-1 to open inspector...');
await navigateToTask('ready-1');
await page.waitForTimeout(1500);

// Take a debug shot after first selection
await page.screenshot({ path: path.join(outputDir, '00-debug-after-select.png'), fullPage: false });
console.log('Debug: After first select captured.');

// Now navigate to a task far down the list — this should scroll the card into view
console.log('Step 2: Navigating to ready-20 (should scroll down in the Ready column)...');
await navigateToTask('ready-20');
await page.waitForTimeout(2000); // Wait for smooth scroll

await page.screenshot({
  path: path.join(outputDir, '01-kanban-scroll-to-card.png'),
  fullPage: false,
});
console.log('Screenshot 01: Kanban scroll-to-card saved.');

// ─── Screenshot (b): Tree view - Navigate to a task, node framed ───

console.log('Step 3: Switching to Tree view...');
await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  app.currentView = 'tree';
  app.selectedTaskId = null;
  app.requestUpdate();
});
await page.waitForTimeout(3000); // Wait for dagre layout calculation

// Navigate to a specific task to trigger centerOnNode
console.log('Step 4: Navigating to working-5 in tree (should pan viewport)...');
await navigateToTask('working-5');
await page.waitForTimeout(1500);

await page.screenshot({
  path: path.join(outputDir, '02-tree-frame-node.png'),
  fullPage: false,
});
console.log('Screenshot 02: Tree view frame-node saved.');

// ─── Screenshot (c): Ready Queue - Scroll to row ───

console.log('Step 5: Switching to Ready Queue view...');
await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  app.currentView = 'ready-queue';
  app.selectedTaskId = null;
  app.requestUpdate();
});
await page.waitForTimeout(1500);

// Navigate to a task that should be visible in ready queue
console.log('Step 6: Navigating to ready-18 in ready queue (should scroll row)...');
await navigateToTask('ready-18');
await page.waitForTimeout(2000);

await page.screenshot({
  path: path.join(outputDir, '03-ready-queue-scroll-to-row.png'),
  fullPage: false,
});
console.log('Screenshot 03: Ready Queue scroll-to-row saved.');

// ─── Screenshot (d): Dim overlay - Navigate to task NOT in current view ───

// Switch to Dashboard view for the overlay demo — Dashboard view has no individual
// task display, so isTaskVisibleInCurrentView always returns false, triggering the overlay.
console.log('Step 7: Switching to Dashboard for overlay demo...');
await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  app.currentView = 'dashboard';
  app.selectedTaskId = null;
  app['hideDimOverlay'](); // Clear any lingering state
  app.requestUpdate();
});
await page.waitForTimeout(1500);

// Navigate to any task — it won't be visible in Dashboard view
console.log('Step 8: Navigating to ready-5 (not visible in dashboard — should show overlay)...');
await navigateToTask('ready-5');
// Take screenshot quickly before auto-dismiss (2.5s timer)
await page.waitForTimeout(400);

await page.screenshot({
  path: path.join(outputDir, '04-dim-overlay-not-in-view.png'),
  fullPage: false,
});
console.log('Screenshot 04: Dim overlay saved.');

// ─── Verify screenshots are unique ───
console.log('\nVerifying screenshot md5sums...');
const { execSync } = await import('node:child_process');
const md5output = execSync(`md5sum ${outputDir}/0[1-4]*.png`).toString();
console.log(md5output);

const hashes = md5output.trim().split('\n').map(line => line.split(/\s+/)[0]);
const uniqueHashes = new Set(hashes);
if (uniqueHashes.size === hashes.length) {
  console.log(`All ${hashes.length} screenshots are unique.`);
} else {
  console.warn(`WARNING: Only ${uniqueHashes.size} of ${hashes.length} screenshots are unique!`);
}

await browser.close();
console.log('\nDone!');

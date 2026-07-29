import { chromium } from '/scion-volumes/scratchpad/web-test/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const appUrl = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const repoRoot = '/workspace/farmtable';
const distDir = path.join(repoRoot, 'web/dist/assets');
const outputDir = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-16-column-count-tooltip';

fs.mkdirSync(outputDir, { recursive: true });

const jsAsset = fs.readdirSync(distDir).find((file) => /^index-.*\.js$/.test(file));
const cssAsset = fs.readdirSync(distDir).find((file) => /^index-.*\.css$/.test(file));

if (!jsAsset || !cssAsset) {
  throw new Error('Expected built Vite JS and CSS assets in web/dist/assets');
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });

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

await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('ft-app');

await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app) throw new Error('ft-app not found');

  app.streamManager?.stop?.();
  app.connectionStatus = 'live';
  app.phaseFilter = null;
  app.assigneeFilter = null;
  app.users = [];

  const now = new Date().toISOString();
  const makeTask = (id, name, stage, phase, priority = 3, assignees = []) => ({
    id,
    name,
    description: `${name} seeded for Feature 16 screenshot verification.`,
    phase,
    stage,
    priority,
    assignees,
    collectionId: '00000000-0000-0000-0000-000000000001',
    relationships: [],
    labels: [],
    customFields: [],
    platform: 1,
    createdAt: now,
    updatedAt: now,
    version: 'feature-16',
  });

  app.taskStore.clear();
  [
    makeTask('feature-16-ready-open-a', 'Feature 16 ready open A', 3, 1, 2),
    makeTask('feature-16-ready-open-b', 'Feature 16 ready open B', 3, 1, 3),
    makeTask('feature-16-working-progress-a', 'Feature 16 working progress A', 4, 2, 1),
    makeTask('feature-16-review-progress-a', 'Feature 16 review progress A', 5, 2, 2),
    makeTask('feature-16-backlog-open-a', 'Feature 16 backlog open A', 2, 1, 3),
    makeTask('feature-16-completed-closed-a', 'Feature 16 completed closed A', 12, 4, 3),
  ].forEach((task) => app.taskStore.upsert(task));
  app.taskStore.snapshotComplete();
  app.requestUpdate();
});

const readyColumn = page.locator('ft-kanban-column').filter({ hasText: 'Ready' }).first();
const readyCount = readyColumn.locator('.count');
await readyCount.waitFor({ state: 'visible' });
await page.screenshot({ path: path.join(outputDir, 'plain-count.png'), fullPage: true });

const phaseSelect = page.locator('ft-toolbar sl-select').first();
await phaseSelect.click();
await page.getByRole('option', { name: 'In Progress' }).click();
await page.mouse.click(24, 430);
await page.getByRole('option', { name: 'Open' }).waitFor({ state: 'hidden' });

await readyColumn.locator('.count.filtered').waitFor({ state: 'visible' });
await page.screenshot({ path: path.join(outputDir, 'filtered-count-tint.png'), fullPage: true });

await readyColumn.locator('.count.filtered').hover();
await page.getByText('0 tasks visible out of 2 total (filter active)').waitFor({ state: 'visible' });
await page.screenshot({ path: path.join(outputDir, 'filtered-count-tooltip.png'), fullPage: true });

await browser.close();

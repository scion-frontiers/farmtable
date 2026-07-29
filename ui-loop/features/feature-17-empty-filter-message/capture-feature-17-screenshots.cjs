const fs = require('fs');
const path = require('path');
const { chromium } = require('/scion-volumes/scratchpad/web-test/node_modules/playwright');

const origin = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const webDist = '/workspace/farmtable/web/dist';
const outDir = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-17-empty-filter-message';

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.js')) return 'text/javascript';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function task(overrides) {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    name: overrides.name,
    description: '',
    acceptanceCriteria: '',
    phase: overrides.phase,
    stage: overrides.stage,
    nativeStatus: '',
    type: 'Feature',
    priority: 3,
    assignees: overrides.assignees ?? [],
    collectionId: 'feature-17-fixture',
    relationships: [],
    labels: [],
    customFields: [],
    platform: 1,
    createdAt: overrides.createdAt ?? now,
    updatedAt: now,
    version: '1',
  };
}

async function seedTasks(page) {
  await page.evaluate((tasks) => {
    const app = document.querySelector('ft-app');
    app.streamManager?.stop();
    app.taskStore.clear();
    for (const fixtureTask of tasks) {
      app.taskStore.upsert(fixtureTask);
    }
    app.taskStore.snapshotComplete();
  }, [
    task({ id: 'hidden-ready-1', name: 'Hidden ready task A', phase: 1, stage: 3, createdAt: '2026-07-19T12:00:00.000Z' }),
    task({ id: 'hidden-ready-2', name: 'Hidden ready task B', phase: 1, stage: 3, createdAt: '2026-07-19T12:01:00.000Z' }),
    task({ id: 'visible-working-1', name: 'Visible working task', phase: 2, stage: 4, createdAt: '2026-07-19T12:02:00.000Z' }),
  ]);
}

async function waitForSettledApp(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('ft-app');
  await page.waitForFunction(async () => {
    const app = document.querySelector('ft-app');
    if (!app) return false;
    await app.updateComplete;
    const view = app.shadowRoot?.querySelector('ft-kanban-view');
    if (view) await view.updateComplete;
    const columns = [...(view?.shadowRoot?.querySelectorAll('ft-kanban-column') ?? [])];
    await Promise.all(columns.map((column) => column.updateComplete));
    return columns.length > 0;
  });
}

async function choosePhaseFilter(page, label) {
  await page.locator('ft-toolbar sl-select').first().click();
  await page.getByRole('option', { name: label }).click();
  await waitForSettledApp(page);
}

async function columnLocator(page, label) {
  return page.locator('ft-kanban-column').filter({ hasText: label }).first();
}

async function screenshotColumn(page, label, fileName) {
  const column = await columnLocator(page, label);
  await column.scrollIntoViewIfNeeded();
  await column.screenshot({ path: path.join(outDir, fileName) });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.route(`${origin}/**`, async (route) => {
    const requestUrl = new URL(route.request().url());
    let filePath = path.join(webDist, requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname);
    if (!filePath.startsWith(webDist) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    await route.fulfill({
      status: 200,
      contentType: contentType(filePath),
      body: fs.readFileSync(filePath),
    });
  });

  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await waitForSettledApp(page);
  await seedTasks(page);
  await waitForSettledApp(page);

  await choosePhaseFilter(page, 'In Progress');
  await (await columnLocator(page, 'Ready')).getByText('No visible tasks match this filter.').waitFor();
  await screenshotColumn(page, 'Ready', 'filter-hidden-tasks-message.png');

  await screenshotColumn(page, 'Backlog', 'genuinely-empty-column.png');

  await screenshotColumn(page, 'Working', 'column-with-visible-matches.png');

  await browser.close();
})();

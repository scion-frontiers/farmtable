import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const COLLECTION_ID = 'f7351b20';
const URL = `${BASE_URL}/?collection=${COLLECTION_ID}&view=kanban`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log(`[console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));

  console.log('Navigating to', URL);
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  console.log('Page loaded, URL:', page.url());

  // Wait a bit for JS to initialize
  await page.waitForTimeout(3000);

  // Check what's on the page
  const html = await page.evaluate(() => document.documentElement.outerHTML.substring(0, 2000));
  console.log('\n=== Page HTML (first 2000 chars):\n', html);

  // Check for ft-app
  const appExists = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    return {
      exists: !!app,
      hasShadow: !!app?.shadowRoot,
      innerHTML: app ? app.innerHTML.substring(0, 500) : 'N/A',
      shadowHTML: app?.shadowRoot ? app.shadowRoot.innerHTML.substring(0, 500) : 'N/A',
    };
  });
  console.log('\n=== ft-app:', JSON.stringify(appExists, null, 2));

  if (appExists.hasShadow) {
    const kanbanCheck = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return { error: 'no shadow' };

      // Check route state
      const routeView = app.routeView;
      const currentView = app.currentView;

      // Check for kanban-view
      const kanban = app.shadowRoot.querySelector('ft-kanban-view');
      const placeholder = app.shadowRoot.querySelector('.placeholder');
      const collectionList = app.shadowRoot.querySelector('ft-collection-list');

      return {
        routeView,
        currentView,
        hasKanban: !!kanban,
        hasPlaceholder: !!placeholder,
        hasCollectionList: !!collectionList,
        kanbanShadow: kanban?.shadowRoot ? 'yes' : 'no',
        allChildren: Array.from(app.shadowRoot.children).map(c => c.tagName),
      };
    });
    console.log('\n=== Kanban check:', JSON.stringify(kanbanCheck, null, 2));
  }

  await browser.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

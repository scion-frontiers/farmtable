import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-qo7k5fvpda-uc.a.run.app';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  await page.waitForTimeout(3000);

  // Get collection list
  const collections = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return [];
    const list = app.shadowRoot.querySelector('ft-collection-list');
    if (!list?.shadowRoot) return [];

    // Look for collection links or items
    const items = list.shadowRoot.querySelectorAll('[data-collection-id], a, button, sl-card');
    const results = [];
    for (const item of items) {
      results.push({
        tag: item.tagName,
        text: item.textContent?.trim()?.substring(0, 50),
        href: item.href || null,
        dataId: item.dataset?.collectionId || null,
      });
    }

    // Also try to find the collection data from the component
    if (list.collections) {
      for (const c of list.collections) {
        results.push({ tag: 'DATA', id: c.id, name: c.name, platform: c.platform });
      }
    }

    return results;
  });
  console.log('\n=== Collections:', JSON.stringify(collections, null, 2));

  // Also try to look at the full page HTML for collection links
  const links = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no shadow';
    const list = app.shadowRoot.querySelector('ft-collection-list');
    if (!list?.shadowRoot) return 'no collection list shadow';
    return list.shadowRoot.innerHTML.substring(0, 3000);
  });
  console.log('\n=== Collection list HTML:\n', links);

  await browser.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Capture console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:9090?view=tree', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const html = await page.content();
  console.log('Page HTML (first 500 chars):', html.substring(0, 500));

  const info = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app) return { hasApp: false, bodyHTML: document.body.innerHTML.substring(0, 300) };
    const sr = app.shadowRoot;
    if (!sr) return { hasApp: true, hasShadow: false };
    const allElements = sr.querySelectorAll('*');
    const tagNames = [...new Set([...allElements].map(e => e.tagName.toLowerCase()))];
    const treeView = sr.querySelector('ft-tree-view');

    let treeInfo = null;
    if (treeView) {
      const treeSr = treeView.shadowRoot;
      if (treeSr) {
        const fos = treeSr.querySelectorAll('foreignObject');
        treeInfo = { hasShadow: true, foreignObjects: fos.length };
      } else {
        treeInfo = { hasShadow: false };
      }
    }

    return {
      hasApp: true,
      hasShadow: true,
      elementCount: allElements.length,
      tags: tagNames.slice(0, 30),
      hasTreeView: !!treeView,
      treeInfo,
    };
  });
  console.log('Page info:', JSON.stringify(info, null, 2));

  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/debug.png', fullPage: false });

  await browser.close();
})();

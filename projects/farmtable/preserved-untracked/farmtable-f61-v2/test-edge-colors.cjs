// Test edge colors with a node that has BOTH upstream and downstream connections
const { chromium } = require('playwright');

const TOKEN = 'ft_17fab390be4b2b0a4e3f720059564f5931c45f99926592941b49e7fa7128493b';
const COLLECTION = 'd53b0f6f-4e81-43ae-b38e-9949cd1dfd77';
const PORT = 9091;
const BASE = `http://localhost:${PORT}`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('farmtable.token', t), TOKEN);
  await page.goto(`${BASE}?collection=${COLLECTION}&view=dependencies`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Find the "Frontend UI" node which is BLOCKED_BY Backend API AND BLOCKS UI Tests
  // This should show both blocking (upstream) and blocked (downstream) colored edges
  const selectedName = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    const nodes = dv?.shadowRoot?.querySelectorAll('ft-tree-node');
    if (!nodes) return 'no nodes';
    for (const n of nodes) {
      const name = n.shadowRoot?.querySelector('.title')?.textContent?.trim();
      if (name === 'Frontend UI') {
        n.closest('foreignObject')?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        return name;
      }
    }
    // List all names for debugging
    const names = [];
    for (const n of nodes) names.push(n.shadowRoot?.querySelector('.title')?.textContent?.trim());
    return `Frontend UI not found. Available: ${names.join(', ')}`;
  });
  console.log(`Selected: ${selectedName}`);
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!dv) return {};
    const paths = dv.shadowRoot?.querySelectorAll('path');
    const classes = [];
    if (paths) for (const p of paths) classes.push(p.getAttribute('class'));
    return {
      selectedTaskId: dv.selectedTaskId,
      totalEdges: classes.length,
      blocking: classes.filter(c => c?.includes('edge-blocking')).length,
      blocked: classes.filter(c => c?.includes('edge-blocked')).length,
      neutral: classes.filter(c => c === 'edge-dependency').length,
      allClasses: classes,
    };
  });
  console.log(`Edges: ${result.totalEdges} total`);
  console.log(`  Blocking (red-orange #D55E00): ${result.blocking}`);
  console.log(`  Blocked (blue-purple #7B3FF2): ${result.blocked}`);
  console.log(`  Neutral: ${result.neutral}`);
  console.log(`  All classes: ${JSON.stringify(result.allClasses)}`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p3-frontend-selected.png' });

  // Also test with Auth Module (BLOCKED_BY DB Layer, BLOCKS API Tests)
  const selectedAuth = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    const nodes = dv?.shadowRoot?.querySelectorAll('ft-tree-node');
    if (!nodes) return 'no nodes';
    for (const n of nodes) {
      const name = n.shadowRoot?.querySelector('.title')?.textContent?.trim();
      if (name === 'Auth Module') {
        n.closest('foreignObject')?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        return name;
      }
    }
    return 'Auth Module not found';
  });
  console.log(`\nSelected: ${selectedAuth}`);
  await page.waitForTimeout(1500);

  const result2 = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const dv = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!dv) return {};
    const paths = dv.shadowRoot?.querySelectorAll('path');
    const classes = [];
    if (paths) for (const p of paths) classes.push(p.getAttribute('class'));
    return {
      selectedTaskId: dv.selectedTaskId,
      totalEdges: classes.length,
      blocking: classes.filter(c => c?.includes('edge-blocking')).length,
      blocked: classes.filter(c => c?.includes('edge-blocked')).length,
      neutral: classes.filter(c => c === 'edge-dependency').length,
    };
  });
  console.log(`Edges: ${result2.totalEdges} total`);
  console.log(`  Blocking (red-orange): ${result2.blocking}`);
  console.log(`  Blocked (blue-purple): ${result2.blocked}`);
  console.log(`  Neutral: ${result2.neutral}`);
  await page.screenshot({ path: '/workspace/farmtable-f61-v2/screenshots/p3-auth-selected.png' });

  await page.close();
  await browser.close();
})();

/**
 * Feature 56 Verification: Zoom-to-Target-Size + More Prominent Highlight
 *
 * Captures screenshots and measures the selected node's rendered width
 * as a percentage of viewport width after the zoom-to-target animation.
 */
import { chromium } from 'playwright';

const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';
const BASE_URL = 'http://localhost:9876';
const COLLECTION_ID = '8ef64de9-cc3e-47ed-aae2-02e83f26dc5d';
const OUT_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight';
const VIEWPORT = { width: 1440, height: 900 };

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function measureSelectedNodePercent(page, viewLabel) {
  const result = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    if (!ftApp || !ftApp.shadowRoot) return { error: 'no ft-app' };

    const views = ftApp.shadowRoot.querySelectorAll('ft-tree-view, ft-dependency-view');
    for (const view of views) {
      const sr = view.shadowRoot;
      if (!sr) continue;
      const svgEl = sr.querySelector('svg');
      if (!svgEl) continue;

      const foreignObjects = svgEl.querySelectorAll('foreignObject');
      for (const fo of foreignObjects) {
        const treeNode = fo.querySelector('ft-tree-node');
        if (!treeNode) continue;
        const innerSr = treeNode.shadowRoot;
        if (!innerSr) continue;
        const nodeDiv = innerSr.querySelector('.node.selected');
        if (nodeDiv) {
          const nodeRect = nodeDiv.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          return {
            nodeWidth: nodeRect.width,
            viewportWidth,
            percent: (nodeRect.width / viewportWidth) * 100,
          };
        }
      }
    }
    return { error: 'no selected node found' };
  });

  if (result && !result.error) {
    console.log(`[${viewLabel}] Selected node width: ${result.nodeWidth.toFixed(1)}px`);
    console.log(`[${viewLabel}] Viewport width: ${result.viewportWidth}px`);
    console.log(`[${viewLabel}] Node width as % of viewport: ${result.percent.toFixed(1)}%`);
  } else {
    console.log(`[${viewLabel}] WARNING: ${result?.error || 'unknown error'}`);
  }
  return result;
}

async function clickNodeInView(page, viewSelector) {
  return page.evaluate((sel) => {
    const ftApp = document.querySelector('ft-app');
    if (!ftApp || !ftApp.shadowRoot) return 'no ft-app';

    const view = ftApp.shadowRoot.querySelector(sel);
    if (!view || !view.shadowRoot) return `no ${sel}`;

    const svgEl = view.shadowRoot.querySelector('svg');
    if (!svgEl) return `no svg in ${sel}`;

    const foreignObjects = svgEl.querySelectorAll('foreignObject');
    if (foreignObjects.length === 0) return `no foreignObject in ${sel}`;

    // Click the first foreignObject to select a node
    const fo = foreignObjects[0];
    fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    return 'clicked';
  }, viewSelector);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--disable-gpu'],
    headless: true,
  });

  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // ═══ TREE VIEW ═══
  console.log('\n═══ Tree View ═══');
  await page.goto(`${BASE_URL}?collection=${COLLECTION_ID}&view=tree`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  // Take "before" screenshot
  await page.screenshot({ path: `${OUT_DIR}/tree-before-select.png`, fullPage: false });
  console.log('Saved: tree-before-select.png');

  // Debug: check view state
  const treeViewDebug = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    if (!ftApp || !ftApp.shadowRoot) return 'no ft-app';
    const tv = ftApp.shadowRoot.querySelector('ft-tree-view');
    if (!tv) return 'no tree view';
    if (!tv.shadowRoot) return 'tree view no shadow root';
    const svg = tv.shadowRoot.querySelector('svg');
    if (!svg) return 'no svg';
    const fos = svg.querySelectorAll('foreignObject');
    return `tree view found with ${fos.length} nodes`;
  });
  console.log('Debug:', treeViewDebug);

  // Click a node
  const treeResult = await clickNodeInView(page, 'ft-tree-view');
  console.log(`Tree node click result: ${treeResult}`);
  await sleep(1500);

  // Take "after" screenshot
  await page.screenshot({ path: `${OUT_DIR}/tree-after-select.png`, fullPage: false });
  console.log('Saved: tree-after-select.png');

  // Measure
  const treeMeasure = await measureSelectedNodePercent(page, 'Tree View');

  // ═══ DEPENDENCY VIEW ═══
  console.log('\n═══ Dependency View ═══');
  await page.goto(`${BASE_URL}?collection=${COLLECTION_ID}&view=dependencies`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  // Take "before" screenshot
  await page.screenshot({ path: `${OUT_DIR}/dep-before-select.png`, fullPage: false });
  console.log('Saved: dep-before-select.png');

  // Debug
  const depViewDebug = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    if (!ftApp || !ftApp.shadowRoot) return 'no ft-app';
    const dv = ftApp.shadowRoot.querySelector('ft-dependency-view');
    if (!dv) return 'no dep view';
    if (!dv.shadowRoot) return 'dep view no shadow root';
    const svg = dv.shadowRoot.querySelector('svg');
    if (!svg) return 'no svg (might show empty state)';
    const fos = svg.querySelectorAll('foreignObject');
    return `dep view found with ${fos.length} nodes`;
  });
  console.log('Debug:', depViewDebug);

  // Click a node
  const depResult = await clickNodeInView(page, 'ft-dependency-view');
  console.log(`Dep node click result: ${depResult}`);
  await sleep(1500);

  // Take "after" screenshot
  await page.screenshot({ path: `${OUT_DIR}/dep-after-select.png`, fullPage: false });
  console.log('Saved: dep-after-select.png');

  // Measure
  const depMeasure = await measureSelectedNodePercent(page, 'Dependency View');

  // ═══ SUMMARY ═══
  console.log('\n═══ SUMMARY ═══');
  const treePercent = treeMeasure && !treeMeasure.error ? treeMeasure.percent.toFixed(1) + '%' : 'N/A';
  const depPercent = depMeasure && !depMeasure.error ? depMeasure.percent.toFixed(1) + '%' : 'N/A';
  console.log(`Tree View:       ${treePercent} of viewport width`);
  console.log(`Dependency View: ${depPercent} of viewport width`);
  console.log(`Target:          ~20%`);

  await browser.close();
  console.log('\nDone. Screenshots saved to:', OUT_DIR);
})();

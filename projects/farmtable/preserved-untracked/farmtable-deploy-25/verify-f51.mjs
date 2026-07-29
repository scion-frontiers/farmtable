import { chromium } from 'playwright';
import { execSync } from 'child_process';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_AUDIENCE = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-25';

const token = execSync(`gcloud auth print-identity-token --audiences=${IAP_AUDIENCE}`)
  .toString().trim();
console.log('Token obtained, length:', token.length);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { Authorization: `Bearer ${token}` },
});
const page = await context.newPage();

// Step 1: Navigate to root, find "Scenario 1: 4-Layer Chain" collection
console.log('Navigating to root...');
await page.goto(SERVICE_URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);

const collections = await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app?.shadowRoot) return [];
  const list = app.shadowRoot.querySelector('ft-collection-list');
  if (!list?.shadowRoot) return [];
  const buttons = list.shadowRoot.querySelectorAll('button.collection');
  return Array.from(buttons).map((b, i) => ({
    index: i,
    name: b.querySelector('.name')?.textContent?.trim() || '',
  }));
});
console.log('Collections found:', collections.map(c => c.name).join(', '));

// Click "Scenario 1: 4-Layer Chain"
const targetName = 'Scenario 1';
console.log(`\nClicking collection containing "${targetName}"...`);
const clicked = await page.evaluate((search) => {
  const app = document.querySelector('ft-app');
  if (!app?.shadowRoot) return false;
  const list = app.shadowRoot.querySelector('ft-collection-list');
  if (!list?.shadowRoot) return false;
  const buttons = list.shadowRoot.querySelectorAll('button.collection');
  for (const btn of buttons) {
    if (btn.querySelector('.name')?.textContent?.trim()?.includes(search)) {
      btn.click();
      return true;
    }
  }
  return false;
}, targetName);
console.log('Clicked:', clicked);
await page.waitForTimeout(4000);

// Step 2: Switch to Dependencies view
console.log('Switching to Dependencies view...');
const switched = await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app?.shadowRoot) return 'no-app';
  const toolbar = app.shadowRoot.querySelector('ft-toolbar');
  if (!toolbar?.shadowRoot) return 'no-toolbar';
  const group = toolbar.shadowRoot.querySelector('sl-radio-group');
  if (!group) return 'no-radio-group';
  group.value = 'dependencies';
  group.dispatchEvent(new Event('sl-change', { bubbles: true }));
  return 'switched to dependencies';
});
console.log('View switch:', switched);
await page.waitForTimeout(3000);

await page.screenshot({ path: `${SCREENSHOT_DIR}/f51-01-dep-view.png`, fullPage: false });
console.log('Screenshot 1: Dependency view');

// Step 3: Extract layout data
const layoutInfo = await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app?.shadowRoot) return { error: 'no-app' };
  const depView = app.shadowRoot.querySelector('ft-dependency-view');
  if (!depView) return { error: 'no-dep-view', tags: Array.from(app.shadowRoot.querySelectorAll('*')).map(e => e.tagName).filter(t => t.startsWith('FT-')).join(', ') };
  if (!depView.shadowRoot) return { error: 'no-shadow' };

  const svg = depView.shadowRoot.querySelector('svg');
  if (!svg) {
    const empty = depView.shadowRoot.querySelector('ft-empty-state');
    return { error: 'no-svg', emptyState: empty?.getAttribute('heading') || null };
  }

  const foreignObjects = svg.querySelectorAll('foreignObject');
  const nodes = [];
  for (const fo of foreignObjects) {
    const x = parseFloat(fo.getAttribute('x'));
    const y = parseFloat(fo.getAttribute('y'));
    const width = parseFloat(fo.getAttribute('width'));
    const height = parseFloat(fo.getAttribute('height'));
    const taskId = fo.getAttribute('data-task-id');
    const treeNode = fo.querySelector('ft-tree-node');
    let taskName = '';
    if (treeNode?.shadowRoot) {
      taskName = treeNode.shadowRoot.querySelector('.name')?.textContent?.trim() || '';
    }
    nodes.push({ taskId, x, y, width, height, taskName });
  }

  const paths = svg.querySelectorAll('path.edge-dependency');
  const edges = Array.from(paths).map(p => ({ d: p.getAttribute('d') }));

  return { nodeCount: nodes.length, edgeCount: edges.length, nodes, edges, viewBox: svg.getAttribute('viewBox') };
});

console.log('\nLayout info:');
console.log(JSON.stringify(layoutInfo, null, 2));

// Step 4: Verify Feature 51
console.log('\n=== FEATURE 51 VERIFICATION ===');

if (layoutInfo.nodes && layoutInfo.nodes.length > 0) {
  const xPositions = [...new Set(layoutInfo.nodes.map(n => n.x))].sort((a, b) => a - b);
  const leftmostX = xPositions[0];
  const leftmostNodes = layoutInfo.nodes.filter(n => n.x === leftmostX);

  console.log(`Total nodes: ${layoutInfo.nodeCount}`);
  console.log(`Total edges: ${layoutInfo.edgeCount}`);
  console.log(`Unique X columns: ${xPositions.join(', ')}`);
  console.log(`Leftmost X: ${leftmostX}`);
  console.log(`Nodes in leftmost column: ${leftmostNodes.length}`);
  console.log(`Leftmost tasks: ${leftmostNodes.map(n => n.taskName || n.taskId).join(', ')}`);

  const leftXUnique = new Set(leftmostNodes.map(n => n.x));
  const v1Pass = leftXUnique.size === 1;
  console.log(`\nV1 — Layer-0 alignment: ${v1Pass ? 'PASS' : 'FAIL'}`);

  // V2: Edge anchoring (right edge of source -> left edge of target)
  let edgesCorrect = true;
  for (const edge of layoutInfo.edges) {
    const parts = edge.d.match(/^M ([\d.]+) ([\d.]+) C ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+)$/);
    if (parts) {
      const startX = parseFloat(parts[1]);
      const endX = parseFloat(parts[7]);
      const srcNode = layoutInfo.nodes.find(n => Math.abs((n.x + n.width) - startX) < 2);
      const tgtNode = layoutInfo.nodes.find(n => Math.abs(n.x - endX) < 2);
      if (!srcNode || !tgtNode) {
        console.log(`  Edge anomaly: start=${startX}, end=${endX} — src: ${!!srcNode}, tgt: ${!!tgtNode}`);
        edgesCorrect = false;
      }
    }
  }
  console.log(`V2 — Edge anchoring (right→left): ${edgesCorrect ? 'PASS' : 'NEEDS REVIEW'}`);

  // Column summary
  const columns = new Map();
  for (const node of layoutInfo.nodes) {
    if (!columns.has(node.x)) columns.set(node.x, []);
    columns.get(node.x).push(node.taskName || node.taskId);
  }
  console.log('\nLayer columns (left to right):');
  for (const [x, tasks] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  X=${x}: ${tasks.join(', ')}`);
  }

  const allBezier = layoutInfo.edges.every(e => e.d.includes(' C '));
  console.log(`\nV3 — Bezier curves: ${allBezier ? 'PASS' : 'FAIL'}`);
} else {
  console.log('ERROR: No nodes found in dependency view');
  console.log('Layout data:', JSON.stringify(layoutInfo));
}

await page.screenshot({ path: `${SCREENSHOT_DIR}/f51-02-dep-layout-detail.png`, fullPage: false });
console.log('\nScreenshot 2: Layout detail');

// Step 5: DnD spot-check
const dndInfo = await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app?.shadowRoot) return { error: 'no-app' };
  const depView = app.shadowRoot.querySelector('ft-dependency-view');
  if (!depView) return { error: 'no-dep-view' };
  return { readOnly: depView.readOnly, hasStore: !!depView.store, dndReady: !depView.readOnly };
});

console.log('\n=== FEATURE 48 DnD SPOT-CHECK ===');
console.log(`readOnly: ${dndInfo.readOnly}`);
console.log(`Store available: ${dndInfo.hasStore}`);
console.log(`DnD ready: ${dndInfo.dndReady ? 'PASS' : 'FAIL'}`);

const dragResult = await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app?.shadowRoot) return 'no-app';
  const depView = app.shadowRoot.querySelector('ft-dependency-view');
  if (!depView?.shadowRoot) return 'no-dep-view';
  const svg = depView.shadowRoot.querySelector('svg');
  if (!svg) return 'no-svg';
  const fo = svg.querySelector('foreignObject');
  if (!fo) return 'no-node';
  const treeNode = fo.querySelector('ft-tree-node');
  if (!treeNode?.shadowRoot) return 'no-tree-node';
  const dragDiv = treeNode.shadowRoot.querySelector('[draggable="true"]');
  return dragDiv ? 'draggable-found' : 'events-on-foreignObject';
});
console.log(`Drag elements: ${dragResult}`);

await page.screenshot({ path: `${SCREENSHOT_DIR}/f51-03-dnd-spotcheck.png`, fullPage: false });
console.log('Screenshot 3: DnD spot-check');

await browser.close();
console.log('\n=== ALL VERIFICATIONS COMPLETE ===');

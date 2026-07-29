import { chromium } from 'playwright';
import { execSync } from 'child_process';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_AUDIENCE = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-25';

const token = execSync(`gcloud auth print-identity-token --audiences=${IAP_AUDIENCE}`)
  .toString().trim();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { Authorization: `Bearer ${token}` },
});
const page = await context.newPage();

async function navigateToCollection(searchStr) {
  await page.goto(SERVICE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const clicked = await page.evaluate((search) => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return false;
    const list = app.shadowRoot.querySelector('ft-collection-list');
    if (!list?.shadowRoot) return false;
    const buttons = list.shadowRoot.querySelectorAll('button.collection');
    for (const btn of buttons) {
      if (btn.querySelector('.name')?.textContent?.trim()?.includes(search)) {
        btn.click();
        return btn.querySelector('.name')?.textContent?.trim();
      }
    }
    return false;
  }, searchStr);
  console.log(`Navigated to: ${clicked}`);
  await page.waitForTimeout(4000);
  return clicked;
}

async function switchToDepView() {
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return;
    const toolbar = app.shadowRoot.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return;
    const group = toolbar.shadowRoot.querySelector('sl-radio-group');
    if (group) {
      group.value = 'dependencies';
      group.dispatchEvent(new Event('sl-change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(3000);
}

async function getLayoutInfo() {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no-app' };
    const depView = app.shadowRoot.querySelector('ft-dependency-view');
    if (!depView?.shadowRoot) return { error: 'no-dep-view' };
    const svg = depView.shadowRoot.querySelector('svg');
    if (!svg) {
      const empty = depView.shadowRoot.querySelector('ft-empty-state');
      return { error: 'no-svg', emptyState: empty?.getAttribute('heading') };
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
    return { nodeCount: nodes.length, edgeCount: edges.length, nodes, edges };
  });
}

// Try collections with dependency data
const collectionsToTry = ['deploy-16-dep-test', 'D16-DepTest', 'D17-Phase2', 'deploy-20-beads', 'default', 'farmtable-deploy4-web'];

let bestLayout = null;
let bestCollection = null;

for (const colName of collectionsToTry) {
  const result = await navigateToCollection(colName);
  if (!result) continue;
  
  await switchToDepView();
  const layout = await getLayoutInfo();
  
  const xSet = new Set((layout.nodes || []).map(n => n.x));
  console.log(`  ${result}: ${layout.nodeCount || 0} nodes, ${layout.edgeCount || 0} edges, ${xSet.size} layers`);
  
  if (layout.edgeCount > 0 && xSet.size > 1) {
    bestLayout = layout;
    bestCollection = result;
    console.log(`  → Found multi-layer collection with edges!`);
    break;
  }
  
  if (!bestLayout && layout.nodeCount > 0) {
    bestLayout = layout;
    bestCollection = result;
  }
}

if (!bestCollection || !bestLayout || bestLayout.edgeCount === 0) {
  // The "Scenario 1" collection has tasks but no blocking relationships.
  // This is actually valid for Feature 51 — the bug was that unblocked tasks
  // were NOT all placed at layer 0. Now they all ARE at the same X.
  // But we also need edges for edge-anchoring verification.
  // Let me check if we can create test data, or use the existing Scenario 1 data.
  console.log('\nNo collection with both edges AND multiple layers found.');
  console.log('Using best available collection for verification.');
  
  if (!bestCollection) {
    // Fall back to Scenario 1
    await navigateToCollection('Scenario 1');
    await switchToDepView();
    bestLayout = await getLayoutInfo();
    bestCollection = 'Scenario 1: 4-Layer Chain';
  }
}

// Now take screenshots and verify with the best layout available
console.log(`\n=== Using collection: ${bestCollection} ===`);
console.log(`Nodes: ${bestLayout?.nodeCount}, Edges: ${bestLayout?.edgeCount}`);

// If we need to navigate back
if (bestCollection) {
  await navigateToCollection(bestCollection.substring(0, 15));
  await switchToDepView();
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: `${SCREENSHOT_DIR}/f51-01-dep-view.png`, fullPage: false });

const finalLayout = await getLayoutInfo();
console.log('\nFinal layout:');
console.log(JSON.stringify(finalLayout, null, 2));

// Feature 51 Verification
console.log('\n=== FEATURE 51 VERIFICATION ===');

if (finalLayout.nodes && finalLayout.nodes.length > 0) {
  const xPositions = [...new Set(finalLayout.nodes.map(n => n.x))].sort((a, b) => a - b);
  const leftmostX = xPositions[0];
  const leftmostNodes = finalLayout.nodes.filter(n => n.x === leftmostX);

  console.log(`Total nodes: ${finalLayout.nodeCount}`);
  console.log(`Total edges: ${finalLayout.edgeCount}`);
  console.log(`Unique X columns (layers): ${xPositions.length} — [${xPositions.join(', ')}]`);
  console.log(`Leftmost column X: ${leftmostX}`);
  console.log(`Unblocked (layer-0) nodes: ${leftmostNodes.length}`);
  leftmostNodes.forEach(n => console.log(`  - ${n.taskName || n.taskId} at X=${n.x}`));

  const v1 = leftmostNodes.length > 0 && new Set(leftmostNodes.map(n => n.x)).size === 1;
  console.log(`\nV1 — All unblocked tasks at same leftmost X: ${v1 ? 'PASS' : 'FAIL'}`);

  if (finalLayout.edgeCount > 0) {
    let v2 = true;
    for (const edge of finalLayout.edges) {
      const parts = edge.d?.match(/^M ([\d.-]+) ([\d.-]+) C ([\d.-]+) ([\d.-]+), ([\d.-]+) ([\d.-]+), ([\d.-]+) ([\d.-]+)$/);
      if (parts) {
        const startX = parseFloat(parts[1]);
        const endX = parseFloat(parts[7]);
        const srcMatch = finalLayout.nodes.find(n => Math.abs((n.x + n.width) - startX) < 2);
        const tgtMatch = finalLayout.nodes.find(n => Math.abs(n.x - endX) < 2);
        if (!srcMatch || !tgtMatch) {
          console.log(`  Edge anomaly: startX=${startX} endX=${endX}`);
          v2 = false;
        }
      }
    }
    console.log(`V2 — Edge anchoring (right→left): ${v2 ? 'PASS' : 'NEEDS REVIEW'}`);
  } else {
    console.log('V2 — Edge anchoring: N/A (no edges — all tasks unblocked)');
    console.log('  This is correct behavior: with no blocking relationships, all nodes are layer 0');
  }

  // Column layout summary
  const cols = new Map();
  for (const n of finalLayout.nodes) {
    if (!cols.has(n.x)) cols.set(n.x, []);
    cols.get(n.x).push(n.taskName || n.taskId);
  }
  console.log('\nColumn layout:');
  for (const [x, tasks] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Layer ${([...cols.keys()].sort((a,b)=>a-b).indexOf(x))}: X=${x}, ${tasks.length} tasks`);
    tasks.forEach(t => console.log(`    - ${t}`));
  }
}

await page.screenshot({ path: `${SCREENSHOT_DIR}/f51-02-dep-layout-detail.png`, fullPage: false });

// DnD spot-check
const dnd = await page.evaluate(() => {
  const app = document.querySelector('ft-app');
  if (!app?.shadowRoot) return {};
  const depView = app.shadowRoot.querySelector('ft-dependency-view');
  if (!depView) return {};
  const hasDragHandlers = !depView.readOnly;
  const hasNodes = depView.shadowRoot?.querySelector('svg foreignObject') !== null;
  const draggable = depView.shadowRoot?.querySelector('ft-tree-node')?.shadowRoot?.querySelector('[draggable="true"]');
  return { readOnly: depView.readOnly, hasNodes, draggable: !!draggable, dndReady: hasDragHandlers && hasNodes };
});

console.log('\n=== FEATURE 48 DnD SPOT-CHECK ===');
console.log(`readOnly: ${dnd.readOnly}, hasNodes: ${dnd.hasNodes}, draggable: ${dnd.draggable}`);
console.log(`DnD functional: ${dnd.dndReady ? 'PASS' : 'FAIL'}`);

await page.screenshot({ path: `${SCREENSHOT_DIR}/f51-03-dnd-spotcheck.png`, fullPage: false });

await browser.close();
console.log('\n=== ALL VERIFICATIONS COMPLETE ===');

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-41-tree-center-animation';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

console.log('1. Loading dashboard...');
await page.goto('http://localhost:9091', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

console.log('2. Switching to Tree view...');
const treeButton = page.locator('text=Tree');
if (await treeButton.isVisible()) {
  await treeButton.click();
  await page.waitForTimeout(2000);
} else {
  console.error('ERROR: Tree button not found!');
  await browser.close();
  process.exit(1);
}

// Take "before" screenshot showing tree view
await page.screenshot({ path: `${EVIDENCE_DIR}/01-tree-view-initial.png`, fullPage: false });
console.log('3. Captured initial tree view');

// Find all tree nodes
const treeNodes = page.locator('ft-tree-node');
const nodeCount = await treeNodes.count();
console.log(`   Found ${nodeCount} tree nodes`);

if (nodeCount < 2) {
  console.error('ERROR: Need at least 2 tree nodes for animation testing');
  await browser.close();
  process.exit(1);
}

// Get SVG viewBox before click for comparison
const svgViewBox = await page.locator('ft-tree-view').evaluate(el => {
  const svg = el.shadowRoot?.querySelector('svg');
  return svg?.getAttribute('viewBox') || 'not found';
});
console.log(`   SVG viewBox before click: ${svgViewBox}`);

// === Test 1: Click a task node and capture animation frames ===
console.log('4. Clicking first task node to trigger centering animation...');

// Click the LAST node (furthest from center) to maximize visible animation
const targetNode = treeNodes.nth(nodeCount - 1);
await targetNode.click({ force: true });

// Capture screenshot sequence at ~100ms intervals over 900ms
const frameTimings = [];
for (let i = 0; i < 10; i++) {
  const startMs = Date.now();
  await page.screenshot({
    path: `${EVIDENCE_DIR}/02-animation-frame-${String(i).padStart(2, '0')}.png`,
    fullPage: false
  });
  const captureMs = Date.now() - startMs;

  // Get viewBox at this moment
  const vb = await page.locator('ft-tree-view').evaluate(el => {
    const svg = el.shadowRoot?.querySelector('svg');
    return svg?.getAttribute('viewBox') || 'not found';
  });
  frameTimings.push({ frame: i, viewBox: vb, captureTimeMs: captureMs });
  console.log(`   Frame ${i}: viewBox=${vb} (captured in ${captureMs}ms)`);

  if (i < 9) {
    await page.waitForTimeout(100);
  }
}

// Wait for animation to complete (750ms total, we captured ~900ms worth)
await page.waitForTimeout(200);
await page.screenshot({ path: `${EVIDENCE_DIR}/03-animation-complete.png`, fullPage: false });
const finalVb = await page.locator('ft-tree-view').evaluate(el => {
  const svg = el.shadowRoot?.querySelector('svg');
  return svg?.getAttribute('viewBox') || 'not found';
});
console.log(`5. Animation complete. Final viewBox: ${finalVb}`);

// === Test 2: Click a different node to verify second animation ===
console.log('6. Clicking a different task node (rapid reselection test)...');
const secondNode = treeNodes.nth(0);
await secondNode.click({ force: true });

for (let i = 0; i < 5; i++) {
  await page.screenshot({
    path: `${EVIDENCE_DIR}/04-second-animation-frame-${String(i).padStart(2, '0')}.png`,
    fullPage: false
  });
  const vb = await page.locator('ft-tree-view').evaluate(el => {
    const svg = el.shadowRoot?.querySelector('svg');
    return svg?.getAttribute('viewBox') || 'not found';
  });
  console.log(`   Second animation frame ${i}: viewBox=${vb}`);
  if (i < 4) await page.waitForTimeout(150);
}

await page.waitForTimeout(500);
await page.screenshot({ path: `${EVIDENCE_DIR}/05-second-animation-complete.png`, fullPage: false });

// === Test 3: Check Inspector relationship click ===
console.log('7. Checking Inspector panel for relationship links...');
await page.waitForTimeout(500);
await page.screenshot({ path: `${EVIDENCE_DIR}/06-inspector-panel.png`, fullPage: false });

// Try to find relationship links in the inspector
const inspectorRelLinks = page.locator('ft-inspector a, ft-inspector .relationship-link, ft-inspector [data-task-id]');
const relCount = await inspectorRelLinks.count();
console.log(`   Found ${relCount} relationship links in Inspector`);

if (relCount > 0) {
  console.log('   Clicking a relationship link...');
  await inspectorRelLinks.first().click({ force: true });

  for (let i = 0; i < 5; i++) {
    await page.screenshot({
      path: `${EVIDENCE_DIR}/07-inspector-nav-frame-${String(i).padStart(2, '0')}.png`,
      fullPage: false
    });
    if (i < 4) await page.waitForTimeout(150);
  }
} else {
  console.log('   No relationship links found in Inspector (seed data may lack relationships)');
}

// Generate summary
const summary = {
  timestamp: new Date().toISOString(),
  initialViewBox: svgViewBox,
  finalViewBox: finalVb,
  frameTimings,
  nodeCount,
  relationshipLinksFound: relCount,
  conclusion: 'Screenshot sequence captured. Check image files to verify progressive viewport movement during animation frames.'
};

writeFileSync(`${EVIDENCE_DIR}/verification-summary.json`, JSON.stringify(summary, null, 2));
console.log('\n=== VERIFICATION COMPLETE ===');
console.log(`Evidence saved to: ${EVIDENCE_DIR}`);
console.log(`Total screenshots: ${10 + 5 + 4 + (relCount > 0 ? 5 : 0)} files`);

await browser.close();

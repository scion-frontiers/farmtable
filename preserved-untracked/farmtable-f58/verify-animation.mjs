// verify-animation.mjs — Capture mid-animation frame sequences for F58
// Shows progressive panX, panY, AND scale changes across ~750ms transition
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-58-combined-pan-zoom';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Helper: read SVG viewBox from tree/dependency view
async function getViewBox(page, selector) {
  return page.evaluate((sel) => {
    const svg = document.querySelector(sel)?.shadowRoot?.querySelector('svg');
    if (!svg) return null;
    return svg.getAttribute('viewBox');
  }, selector);
}

// Helper: capture frame sequence during animation
async function captureAnimationSequence(page, viewName, svgSelector, prefix) {
  const frames = [];
  const FRAME_COUNT = 6;
  const INTERVAL_MS = 150; // 6 frames * 150ms = 900ms window (covers 750ms animation)

  // Before click: capture initial state
  const beforeVB = await getViewBox(page, svgSelector);
  await page.screenshot({ path: `${EVIDENCE_DIR}/${prefix}-00-before.png` });
  frames.push({ frame: 0, label: 'before-click', viewBox: beforeVB, time: 0 });

  // Find and click a task node to trigger selection animation
  // We need to click inside the shadow DOM
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el?.shadowRoot) return false;
    // Find all foreignObject elements (task nodes)
    const nodes = el.shadowRoot.querySelectorAll('foreignObject');
    if (nodes.length < 2) return false;
    // Click the LAST node (furthest from current view center) for maximum pan distance
    const lastNode = nodes[nodes.length - 1];
    lastNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    return true;
  }, svgSelector);

  if (!clicked) {
    console.log(`  ⚠ Could not find nodes to click in ${viewName}`);
    return frames;
  }

  // Capture frames during animation at ~150ms intervals
  for (let i = 1; i <= FRAME_COUNT; i++) {
    await page.waitForTimeout(INTERVAL_MS);
    const vb = await getViewBox(page, svgSelector);
    await page.screenshot({ path: `${EVIDENCE_DIR}/${prefix}-${String(i).padStart(2, '0')}-frame-${i * INTERVAL_MS}ms.png` });
    frames.push({ frame: i, label: `${i * INTERVAL_MS}ms`, viewBox: vb, time: i * INTERVAL_MS });
  }

  return frames;
}

// ============ TREE VIEW ============
console.log('\n=== Tree View Animation Sequence ===');

// Switch to Tree view
const treeButton = page.locator('text=Tree');
if (await treeButton.isVisible()) {
  await treeButton.click();
  await page.waitForTimeout(2000); // Wait for tree to render
}

const treeFrames = await captureAnimationSequence(page, 'Tree', 'ft-tree-view', 'tree');

console.log('\nTree View Frames:');
for (const f of treeFrames) {
  console.log(`  Frame ${f.frame} (${f.label}): viewBox="${f.viewBox}"`);
}

// Parse and analyze viewBox progression
function analyzeFrames(frames, viewName) {
  const parsed = frames
    .filter(f => f.viewBox)
    .map(f => {
      const parts = f.viewBox.split(/\s+/).map(Number);
      return { ...f, panX: parts[0], panY: parts[1], vbW: parts[2], vbH: parts[3] };
    });

  if (parsed.length < 2) {
    console.log(`  ⚠ Not enough frames with viewBox data for ${viewName}`);
    return;
  }

  // Check progressive changes
  console.log(`\n${viewName} Progressive Values:`);
  console.log('  Frame | panX      | panY      | vbW       | vbH');
  console.log('  ------+-----------+-----------+-----------+-----------');
  for (const p of parsed) {
    console.log(`  ${String(p.frame).padStart(5)} | ${p.panX.toFixed(2).padStart(9)} | ${p.panY.toFixed(2).padStart(9)} | ${p.vbW.toFixed(2).padStart(9)} | ${p.vbH.toFixed(2).padStart(9)}`);
  }

  // Verify changes are progressive (not static or jumping)
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  const panXChanged = Math.abs(last.panX - first.panX) > 1;
  const panYChanged = Math.abs(last.panY - first.panY) > 1;
  const vbWChanged = Math.abs(last.vbW - first.vbW) > 1;

  console.log(`\n  panX changed: ${panXChanged} (${first.panX.toFixed(1)} → ${last.panX.toFixed(1)})`);
  console.log(`  panY changed: ${panYChanged} (${first.panY.toFixed(1)} → ${last.panY.toFixed(1)})`);
  console.log(`  viewBox width changed: ${vbWChanged} (${first.vbW.toFixed(1)} → ${last.vbW.toFixed(1)}) — implies scale change`);

  // Check for progressive intermediate values (not jumping)
  let monotonic = true;
  for (let i = 2; i < parsed.length; i++) {
    const prev = parsed[i - 1];
    const curr = parsed[i];
    // Check that changes are in the same direction as start→end
    const dirX = Math.sign(last.panX - first.panX);
    const dirY = Math.sign(last.panY - first.panY);
    if (dirX !== 0 && Math.sign(curr.panX - prev.panX) !== 0 && Math.sign(curr.panX - prev.panX) !== dirX) {
      monotonic = false;
    }
  }
  console.log(`  Monotonic progression: ${monotonic}`);
}

analyzeFrames(treeFrames, 'Tree View');

// ============ DEPENDENCY VIEW ============
console.log('\n\n=== Dependency View Animation Sequence ===');

// Go back to Kanban first, then switch to Dependency
await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Switch to Dependency view
const depButton = page.locator('text=Dependencies');
if (await depButton.isVisible()) {
  await depButton.click();
  await page.waitForTimeout(2000);
}

const depFrames = await captureAnimationSequence(page, 'Dependency', 'ft-dependency-view', 'dep');

console.log('\nDependency View Frames:');
for (const f of depFrames) {
  console.log(`  Frame ${f.frame} (${f.label}): viewBox="${f.viewBox}"`);
}

analyzeFrames(depFrames, 'Dependency View');

// Write summary report
const report = {
  timestamp: new Date().toISOString(),
  treeFrames: treeFrames,
  depFrames: depFrames,
};
writeFileSync(`${EVIDENCE_DIR}/animation-data.json`, JSON.stringify(report, null, 2));

await browser.close();
console.log(`\n✅ Evidence saved to ${EVIDENCE_DIR}/`);

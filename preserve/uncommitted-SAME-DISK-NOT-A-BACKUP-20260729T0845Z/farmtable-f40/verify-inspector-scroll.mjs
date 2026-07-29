// Feature 40: Inspector Panel Scroll Verification
// Takes 4 screenshots proving the Inspector can scroll independently.

import { chromium } from 'playwright';

const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-40-inspector-scroll';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Navigate and wait for data
await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Click the "default" collection to enter the board
const collectionCard = page.locator('text=default').first();
if (await collectionCard.isVisible()) {
  console.log('Selecting "default" collection...');
  await collectionCard.click();
  await page.waitForTimeout(3000);
}

// Wait for task cards to appear
try {
  await page.locator('ft-task-card').first().waitFor({ state: 'visible', timeout: 15000 });
  console.log('Task cards visible.');
} catch {
  console.log('No task cards appeared after 15s');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/debug-no-cards.png`, fullPage: false });
  await browser.close();
  process.exit(1);
}

// Click a task card to open the Inspector
const taskCard = page.locator('ft-task-card').first();
await taskCard.click();
await page.waitForTimeout(1500);

// Expand all sl-details sections inside the Inspector to maximize content
// The Inspector is inside the .inspector div in ft-app's shadow DOM
// ft-app is a custom element with shadow DOM, so we need to pierce it
const expandResult = await page.evaluate(async () => {
  const ftApp = document.querySelector('ft-app');
  if (!ftApp || !ftApp.shadowRoot) return 'No ft-app shadow root';

  const inspector = ftApp.shadowRoot.querySelector('.inspector ft-inspector');
  if (!inspector || !inspector.shadowRoot) return 'No ft-inspector shadow root';

  // Find all sl-details elements and open them
  const details = inspector.shadowRoot.querySelectorAll('sl-details');
  let opened = 0;
  for (const d of details) {
    if (!d.open) {
      d.open = true;
      opened++;
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Get scroll info to understand the layout
  const tabPanel = inspector.shadowRoot.querySelector('sl-tab-panel[name="general"]');
  const body = inspector.shadowRoot.querySelector('.body');

  const info = {
    detailsCount: details.length,
    opened,
    inspectorHeight: inspector.clientHeight,
    inspectorScrollHeight: inspector.scrollHeight,
  };

  if (tabPanel) {
    info.tabPanelHeight = tabPanel.clientHeight;
    info.tabPanelScrollHeight = tabPanel.scrollHeight;
    info.tabPanelOverflowY = getComputedStyle(tabPanel).overflowY;

    // Check the ::part(base) via the internal shadow DOM
    if (tabPanel.shadowRoot) {
      const base = tabPanel.shadowRoot.querySelector('[part="base"]') ||
                   tabPanel.shadowRoot.querySelector('.tab-panel');
      if (base) {
        info.tabPanelBaseHeight = base.clientHeight;
        info.tabPanelBaseScrollHeight = base.scrollHeight;
        info.tabPanelBaseOverflowY = getComputedStyle(base).overflowY;
      }
    }
  }

  if (body) {
    info.bodyHeight = body.clientHeight;
    info.bodyScrollHeight = body.scrollHeight;
    info.bodyOverflowY = getComputedStyle(body).overflowY;
  }

  return info;
});

console.log('Inspector layout info:', JSON.stringify(expandResult, null, 2));

// Screenshot A: Inspector at initial scroll position with expanded sections
await page.screenshot({
  path: `${SCREENSHOT_DIR}/A-inspector-before-scroll.png`,
  fullPage: false,
});
console.log('Screenshot A taken: Inspector with expanded sections (initial position)');

// Find the scroll container and scroll it
// Position the mouse over the inspector panel area (right side of viewport)
// The inspector is ~400px wide on the right side of a 1440px viewport
const inspectorCenterX = 1440 - 200; // middle of inspector
const inspectorCenterY = 450; // middle of viewport vertically

// Scroll the inspector down
await page.mouse.move(inspectorCenterX, inspectorCenterY);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(1000);

// Verify scroll happened
const scrollStateAfterInspectorScroll = await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  if (!ftApp || !ftApp.shadowRoot) return null;

  const mainEl = ftApp.shadowRoot.querySelector('.main');
  const inspector = ftApp.shadowRoot.querySelector('.inspector ft-inspector');
  if (!inspector || !inspector.shadowRoot) return null;

  // Find all scrollable elements inside the inspector
  const tabPanel = inspector.shadowRoot.querySelector('sl-tab-panel[name="general"]');
  const body = inspector.shadowRoot.querySelector('.body');

  const result = {
    mainScrollTop: mainEl ? mainEl.scrollTop : -1,
    documentScrollTop: document.documentElement.scrollTop,
  };

  if (tabPanel) {
    result.tabPanelScrollTop = tabPanel.scrollTop;
    if (tabPanel.shadowRoot) {
      const base = tabPanel.shadowRoot.querySelector('[part="base"]') ||
                   tabPanel.shadowRoot.querySelector('.tab-panel');
      if (base) result.tabPanelBaseScrollTop = base.scrollTop;
    }
  }

  if (body) result.bodyScrollTop = body.scrollTop;

  return result;
});

console.log('Scroll state after Inspector scroll:', JSON.stringify(scrollStateAfterInspectorScroll, null, 2));

// Screenshot B: Inspector scrolled down
await page.screenshot({
  path: `${SCREENSHOT_DIR}/B-inspector-scrolled-down.png`,
  fullPage: false,
});
console.log('Screenshot B taken: Inspector scrolled down');

// Now scroll the main content area
const mainCenterX = 400; // middle of main area
const mainCenterY = 450;

// First, record current scroll states
const beforeMainScroll = await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  if (!ftApp || !ftApp.shadowRoot) return null;
  const mainEl = ftApp.shadowRoot.querySelector('.main');
  const inspector = ftApp.shadowRoot.querySelector('.inspector ft-inspector');
  const tabPanel = inspector?.shadowRoot?.querySelector('sl-tab-panel[name="general"]');
  let inspectorScrollTop = 0;
  if (tabPanel?.shadowRoot) {
    const base = tabPanel.shadowRoot.querySelector('[part="base"]') || tabPanel.shadowRoot.querySelector('.tab-panel');
    if (base) inspectorScrollTop = base.scrollTop;
  }
  if (tabPanel && inspectorScrollTop === 0) inspectorScrollTop = tabPanel.scrollTop;
  return {
    mainScrollTop: mainEl ? mainEl.scrollTop : -1,
    inspectorScrollTop,
  };
});

console.log('Before main scroll:', JSON.stringify(beforeMainScroll));

await page.mouse.move(mainCenterX, mainCenterY);
await page.mouse.wheel(0, 300);
await page.waitForTimeout(1000);

// Check scroll state
const afterMainScroll = await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  if (!ftApp || !ftApp.shadowRoot) return null;
  const mainEl = ftApp.shadowRoot.querySelector('.main');
  const inspector = ftApp.shadowRoot.querySelector('.inspector ft-inspector');
  const tabPanel = inspector?.shadowRoot?.querySelector('sl-tab-panel[name="general"]');
  let inspectorScrollTop = 0;
  if (tabPanel?.shadowRoot) {
    const base = tabPanel.shadowRoot.querySelector('[part="base"]') || tabPanel.shadowRoot.querySelector('.tab-panel');
    if (base) inspectorScrollTop = base.scrollTop;
  }
  if (tabPanel && inspectorScrollTop === 0) inspectorScrollTop = tabPanel.scrollTop;
  return {
    mainScrollTop: mainEl ? mainEl.scrollTop : -1,
    inspectorScrollTop,
    documentScrollTop: document.documentElement.scrollTop,
    toolbarTop: (() => {
      const toolbar = ftApp.shadowRoot.querySelector('ft-toolbar');
      return toolbar ? toolbar.getBoundingClientRect().top : -1;
    })(),
  };
});

console.log('After main scroll:', JSON.stringify(afterMainScroll));

// Screenshot C: Main scrolled, toolbar fixed, inspector unaffected
await page.screenshot({
  path: `${SCREENSHOT_DIR}/C-main-scroll-unaffected.png`,
  fullPage: false,
});
console.log('Screenshot C taken: Main scrolled, toolbar fixed');

// Screenshot D: Independent scroll verification
// Scroll inspector again to prove independence
await page.mouse.move(inspectorCenterX, inspectorCenterY);
await page.mouse.wheel(0, 200);
await page.waitForTimeout(500);

const finalState = await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  if (!ftApp || !ftApp.shadowRoot) return null;
  const mainEl = ftApp.shadowRoot.querySelector('.main');
  const inspector = ftApp.shadowRoot.querySelector('.inspector ft-inspector');
  const tabPanel = inspector?.shadowRoot?.querySelector('sl-tab-panel[name="general"]');
  let inspectorScrollTop = 0;
  if (tabPanel?.shadowRoot) {
    const base = tabPanel.shadowRoot.querySelector('[part="base"]') || tabPanel.shadowRoot.querySelector('.tab-panel');
    if (base) inspectorScrollTop = base.scrollTop;
  }
  if (tabPanel && inspectorScrollTop === 0) inspectorScrollTop = tabPanel.scrollTop;
  return {
    mainScrollTop: mainEl ? mainEl.scrollTop : -1,
    inspectorScrollTop,
    documentScrollTop: document.documentElement.scrollTop,
  };
});

console.log('Final state (independent scroll):', JSON.stringify(finalState));

await page.screenshot({
  path: `${SCREENSHOT_DIR}/D-independent-scroll.png`,
  fullPage: false,
});
console.log('Screenshot D taken: Independent scroll verification');

// Summary
console.log('\n=== VERIFICATION SUMMARY ===');
console.log(`Inspector scroll activated: ${
  (scrollStateAfterInspectorScroll?.tabPanelScrollTop > 0 ||
   scrollStateAfterInspectorScroll?.tabPanelBaseScrollTop > 0 ||
   scrollStateAfterInspectorScroll?.bodyScrollTop > 0)
    ? 'YES ✓' : 'NO ✗ — scroll not working!'
}`);
console.log(`Main scroll independent: ${
  afterMainScroll?.mainScrollTop > 0 ? 'YES ✓' : 'NO ✗'
}`);
console.log(`Toolbar stays fixed: ${
  afterMainScroll?.toolbarTop === 0 ? 'YES ✓' : `NO ✗ (top: ${afterMainScroll?.toolbarTop})`
}`);
console.log(`No document scroll: ${
  afterMainScroll?.documentScrollTop === 0 ? 'YES ✓' : 'NO ✗'
}`);

await browser.close();
console.log('\nDone. Screenshots saved to:', SCREENSHOT_DIR);

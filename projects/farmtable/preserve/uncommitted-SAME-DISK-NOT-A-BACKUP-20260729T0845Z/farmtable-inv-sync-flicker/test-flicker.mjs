/**
 * Playwright script to observe render behavior during poll cycles.
 *
 * Strategy: Load the dashboard with the seed DB (stream mode), then
 * programmatically invoke the poll path by:
 * 1. Waiting for initial load
 * 2. Injecting a MutationObserver on the main board area
 * 3. Programmatically triggering store.upsert() for all tasks (simulating a poll cycle)
 * 4. Counting DOM mutations
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Collect console output
const consoleLogs = [];
page.on('console', msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});

await page.goto('http://localhost:9091', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Screenshot the initial state
await page.screenshot({ path: 'screenshots/01-initial-load.png', fullPage: false });

// Count task cards to verify load
const cardCount = await page.locator('ft-task-card').count();
console.log(`Initial task card count: ${cardCount}`);

// Inject a MutationObserver to count DOM changes
const mutationReport = await page.evaluate(() => {
  return new Promise((resolve) => {
    const board = document.querySelector('ft-app');
    if (!board) {
      resolve({ error: 'ft-app not found' });
      return;
    }

    let mutationCount = 0;
    let mutationDetails = [];

    // Deep observe through shadow DOMs
    function observeDeep(root) {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          mutationCount++;
          if (mutationDetails.length < 50) {
            mutationDetails.push({
              type: m.type,
              target: m.target.nodeName || m.target.tagName || 'text',
              attributeName: m.attributeName || null,
              addedNodes: m.addedNodes.length,
              removedNodes: m.removedNodes.length,
            });
          }
        }
      });

      observer.observe(root, {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true,
      });

      // Also observe shadow roots of children
      const elements = root.querySelectorAll('*');
      for (const el of elements) {
        if (el.shadowRoot) {
          observeDeep(el.shadowRoot);
        }
      }
    }

    observeDeep(board.shadowRoot || board);

    // Now simulate what PollManager does: re-upsert all tasks
    // Access the TaskStore via ft-app's internal state
    const ftApp = document.querySelector('ft-app');
    const store = ftApp?.taskStore;

    if (!store) {
      resolve({ error: 'TaskStore not accessible (private). Trying alternative approach...' });
      return;
    }

    // Wait a frame then report
    setTimeout(() => {
      resolve({
        mutationCount,
        mutationDetails: mutationDetails.slice(0, 20),
        note: 'Mutations observed over 2 seconds after simulated poll'
      });
    }, 2000);
  });
});

console.log('Mutation report:', JSON.stringify(mutationReport, null, 2));

// Try accessing the store via a different approach - look at the rendered DOM directly
// Take a second screenshot
await page.screenshot({ path: 'screenshots/02-after-wait.png', fullPage: false });

// Now inject a more direct test: force a component re-render by dispatching events on the store
const renderTest = await page.evaluate(() => {
  return new Promise((resolve) => {
    const ftApp = document.querySelector('ft-app');
    if (!ftApp) {
      resolve({ error: 'ft-app not found' });
      return;
    }

    // Check if taskStore is accessible
    const keys = Object.getOwnPropertyNames(ftApp);
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(ftApp));

    resolve({
      ownKeys: keys.filter(k => k.includes('task') || k.includes('store') || k.includes('poll') || k.includes('stream')),
      protoKeys: proto.filter(k => k.includes('task') || k.includes('store') || k.includes('poll') || k.includes('stream')),
      hasTaskStore: 'taskStore' in ftApp,
      hasStoreController: 'storeController' in ftApp,
    });
  });
});
console.log('Component inspection:', JSON.stringify(renderTest, null, 2));

// Check if the Refresh button exists (only shows in polling mode)
const refreshButton = await page.locator('sl-button:has-text("Refresh")').count();
console.log(`Refresh button visible: ${refreshButton > 0} (count: ${refreshButton})`);

// Check connection badge status
const badgeText = await page.evaluate(() => {
  const badge = document.querySelector('ft-app')
    ?.shadowRoot?.querySelector('ft-toolbar')
    ?.shadowRoot?.querySelector('ft-connection-badge')
    ?.shadowRoot?.querySelector('.label')?.textContent;
  return badge;
});
console.log(`Connection badge: "${badgeText}"`);

// Summary
console.log('\n--- ANALYSIS ---');
console.log(`Task cards rendered: ${cardCount}`);
console.log(`Connection mode: ${badgeText}`);
console.log(`Refresh button (polling indicator) visible: ${refreshButton > 0}`);
console.log('Console logs from page:', consoleLogs.filter(l => l.includes('Poll') || l.includes('Watch') || l.includes('Stream') || l.includes('Unimplemented')).join('\n'));

await browser.close();
console.log('\nDone.');

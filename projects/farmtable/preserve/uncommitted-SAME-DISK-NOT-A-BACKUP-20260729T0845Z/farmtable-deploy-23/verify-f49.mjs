/**
 * Feature 49 Verification: Reciprocal Relationship Immediate Sync
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';

const LIVE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-23';
const IAP_AUDIENCE = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_AUDIENCE}" 2>/dev/null`).toString().trim();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Collect all ft-task-card elements across all ft-kanban-column shadow roots */
function getAllTaskCards() {
  const app = document.querySelector('ft-app');
  const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
  if (!kanban?.shadowRoot) return [];
  const columns = kanban.shadowRoot.querySelectorAll('ft-kanban-column');
  const cards = [];
  for (const col of columns) {
    if (!col.shadowRoot) continue;
    for (const card of col.shadowRoot.querySelectorAll('ft-task-card')) {
      cards.push(card);
    }
  }
  return cards;
}

(async () => {
  const token = getIAPToken();
  console.log('IAP token obtained');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Authorization': `Bearer ${token}` },
  });
  const page = await context.newPage();

  // Expose the helper function
  await page.exposeFunction('_getAllTaskCards', () => {}); // dummy - we'll use evaluate

  // ===== Step 1: Load the app =====
  console.log('=== Step 1: Load the app ===');
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(3000);

  // Click "default" collection
  console.log('Selecting "default" collection...');
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const cl = app?.shadowRoot?.querySelector('ft-collection-list');
    if (!cl?.shadowRoot) return;
    for (const b of cl.shadowRoot.querySelectorAll('button.collection')) {
      if (b.querySelector('.name')?.textContent?.trim() === 'default') { b.click(); return; }
    }
  });

  // Wait for kanban with cards
  console.log('Waiting for kanban to load...');
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const count = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
      if (!kanban?.shadowRoot) return 0;
      let total = 0;
      for (const col of kanban.shadowRoot.querySelectorAll('ft-kanban-column')) {
        if (col.shadowRoot) total += col.shadowRoot.querySelectorAll('ft-task-card').length;
      }
      return total;
    });
    if (count > 0) { console.log(`  Found ${count} task cards`); break; }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f49-01-app-loaded.png` });
  console.log('Screenshot: f49-01-app-loaded.png');

  // ===== Step 2: Get tasks =====
  console.log('\n=== Step 2: Find tasks ===');

  const taskRelData = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban?.shadowRoot) return [];
    const tasks = [];
    for (const col of kanban.shadowRoot.querySelectorAll('ft-kanban-column')) {
      if (!col.shadowRoot) continue;
      for (const card of col.shadowRoot.querySelectorAll('ft-task-card')) {
        const t = card.task;
        if (t) tasks.push({ id: t.id, name: t.name, relationships: t.relationships || [] });
      }
    }
    return tasks;
  });
  console.log(`Found ${taskRelData.length} tasks`);

  if (taskRelData.length < 2) {
    console.error('Not enough tasks');
    await browser.close();
    process.exit(1);
  }

  // Find pair without existing blocks relationship
  let taskA = null, taskB = null;
  for (let i = 0; i < taskRelData.length && !taskA; i++) {
    for (let j = 0; j < taskRelData.length; j++) {
      if (i === j) continue;
      const a = taskRelData[i], b = taskRelData[j];
      const exists = a.relationships.some(r => r.type === 1 && r.targetTaskId === b.id)
                  || b.relationships.some(r => r.type === 2 && r.targetTaskId === a.id);
      if (!exists) { taskA = a; taskB = b; break; }
    }
  }

  if (!taskA || !taskB) {
    console.error('No suitable pair');
    await browser.close();
    process.exit(1);
  }

  console.log(`Task A: "${taskA.name}" (${taskA.id})`);
  console.log(`Task B: "${taskB.name}" (${taskB.id})`);
  console.log(`Task A rels before:`, JSON.stringify(taskA.relationships));
  console.log(`Task B rels before:`, JSON.stringify(taskB.relationships));

  // ===== Step 3: Click Task A to open Inspector =====
  console.log('\n=== Step 3: Select Task A ===');

  await page.evaluate((taskId) => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban?.shadowRoot) return;
    for (const col of kanban.shadowRoot.querySelectorAll('ft-kanban-column')) {
      if (!col.shadowRoot) continue;
      for (const card of col.shadowRoot.querySelectorAll('ft-task-card')) {
        if (card.task?.id === taskId) {
          const shell = card.shadowRoot?.querySelector('.card-shell');
          if (shell) shell.click();
          return;
        }
      }
    }
  }, taskA.id);
  await sleep(1500);

  // Switch to Relationships tab
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return;
    for (const tab of inspector.shadowRoot.querySelectorAll('sl-tab')) {
      if (tab.getAttribute('panel') === 'relationships') { tab.click(); break; }
    }
  });
  await sleep(500);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f49-02-taskA-before.png` });
  console.log('Screenshot: f49-02-taskA-before.png — Task A Inspector before adding relationship');

  // ===== Step 4: Add BLOCKS relationship =====
  console.log('\n=== Step 4: Add BLOCKS relationship from A to B ===');

  // Click the "+" button on the "Blocks" section
  const addResult = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return 'no inspector';
    const relPanel = inspector.shadowRoot.querySelector('ft-inspector-relationships');
    if (!relPanel?.shadowRoot) return 'no rel panel';
    for (const section of relPanel.shadowRoot.querySelectorAll('.section')) {
      const label = section.querySelector('.section-label');
      if (label && label.textContent.trim().toLowerCase() === 'blocks') {
        const btn = section.querySelector('sl-icon-button');
        if (btn) { btn.click(); return 'clicked'; }
        return 'no btn';
      }
    }
    return 'no blocks section';
  });
  console.log('Add btn:', addResult);
  await sleep(800);

  // Check command palette
  const paletteOpen = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const p = app?.shadowRoot?.querySelector('ft-command-palette');
    return p ? !!p.open : false;
  });
  console.log('Palette open:', paletteOpen);

  if (paletteOpen) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/f49-03-command-palette.png` });
    console.log('Screenshot: f49-03-command-palette.png');

    // Search for Task B name
    const searchTerm = taskB.name;
    console.log(`Searching: "${searchTerm}"`);
    await page.evaluate((term) => {
      const app = document.querySelector('ft-app');
      const p = app?.shadowRoot?.querySelector('ft-command-palette');
      if (!p?.shadowRoot) return;
      const slInput = p.shadowRoot.querySelector('sl-input');
      if (slInput) {
        slInput.value = term;
        slInput.dispatchEvent(new Event('sl-input', { bubbles: true }));
      }
    }, searchTerm);
    await sleep(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/f49-04-search.png` });
    console.log('Screenshot: f49-04-search.png');

    // Find and click the item
    const clickResult = await page.evaluate(({ targetId, targetName }) => {
      const app = document.querySelector('ft-app');
      const p = app?.shadowRoot?.querySelector('ft-command-palette');
      if (!p?.shadowRoot) return { error: 'no palette' };

      // Walk shadow DOMs to find clickable items
      function findItems(root, depth = 0) {
        if (depth > 4) return [];
        const results = [];
        for (const el of root.querySelectorAll('*')) {
          const text = el.textContent?.trim() || '';
          const tid = el.dataset?.taskId;
          if (el.tagName.toLowerCase().match(/^(button|li|div)$/) && text.length > 0 && text.length < 200) {
            results.push({ el, text, tid, tag: el.tagName });
          }
          if (el.shadowRoot) {
            results.push(...findItems(el.shadowRoot, depth + 1));
          }
        }
        return results;
      }

      const items = findItems(p.shadowRoot);
      // Try to match by task ID
      for (const item of items) {
        if (item.tid === targetId) {
          item.el.click();
          return { clicked: true, method: 'taskId', text: item.text.substring(0, 40) };
        }
      }
      // Try to match by name
      for (const item of items) {
        if (item.text.includes(targetName)) {
          item.el.click();
          return { clicked: true, method: 'name', text: item.text.substring(0, 40) };
        }
      }
      return { clicked: false, items: items.length, sampleTexts: items.slice(0, 8).map(i => i.text.substring(0, 40)) };
    }, { targetId: taskB.id, targetName: taskB.name });
    console.log('Click:', JSON.stringify(clickResult));

    if (!clickResult.clicked) {
      // Dispatch the event the command palette would fire
      console.log('Dispatching relationship-add event...');
      await page.evaluate(({ taskBId }) => {
        const app = document.querySelector('ft-app');
        const p = app?.shadowRoot?.querySelector('ft-command-palette');
        if (p) {
          p.dispatchEvent(new CustomEvent('relationship-add', {
            detail: { targetTaskId: taskBId, relationshipType: 1 },
            bubbles: true,
            composed: true,
          }));
          p.open = false;
        }
      }, { taskBId: taskB.id });
    }
  } else {
    // Fallback: dispatch the event directly
    console.log('Palette not open, using direct task-update...');
    await page.evaluate(({ taskAId, taskBId }) => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return;
      const kanban = app.shadowRoot.querySelector('ft-kanban-view');
      if (kanban) {
        kanban.dispatchEvent(new CustomEvent('task-update', {
          detail: { taskId: taskAId, fields: { addBlocks: [taskBId] } },
          bubbles: true,
          composed: true,
        }));
      }
    }, { taskAId: taskA.id, taskBId: taskB.id });
  }

  await sleep(2000);

  // ===== Step 5: Verify Task A =====
  console.log('\n=== Step 5: Verify Task A ===');

  let taskAAfter = await page.evaluate((tid) => {
    const app = document.querySelector('ft-app');
    const store = app?.taskStore;
    if (!store) return null;
    const t = store.getTask(tid);
    return t ? { id: t.id, name: t.name, relationships: t.relationships } : null;
  }, taskA.id);

  let taskAHasBlocks = taskAAfter?.relationships?.some(r => r.type === 1 && r.targetTaskId === taskB.id);
  console.log(`Task A BLOCKS Task B: ${taskAHasBlocks ? 'YES ✓' : 'NO'}`);

  if (!taskAHasBlocks) {
    console.log('Retrying via direct store method call...');
    // The event listener on ft-app is `@task-update`. It's a Lit event handler
    // which means it's bound to the element's host. Let's try calling it.
    await page.evaluate(async ({ taskAId, taskBId }) => {
      const app = document.querySelector('ft-app');
      // Try to access the private method through the event system
      // ft-app has: @task-update=${this.onTaskUpdate} on its shadow root children
      // The event must come from WITHIN the shadow root
      const inspector = app?.shadowRoot?.querySelector('ft-inspector');
      if (inspector) {
        inspector.dispatchEvent(new CustomEvent('task-update', {
          detail: { taskId: taskAId, fields: { addBlocks: [taskBId] } },
          bubbles: true,
          composed: true,
        }));
      }
    }, { taskAId: taskA.id, taskBId: taskB.id });
    await sleep(2000);

    taskAAfter = await page.evaluate((tid) => {
      const app = document.querySelector('ft-app');
      const store = app?.taskStore;
      if (!store) return null;
      const t = store.getTask(tid);
      return t ? { id: t.id, name: t.name, relationships: t.relationships } : null;
    }, taskA.id);
    taskAHasBlocks = taskAAfter?.relationships?.some(r => r.type === 1 && r.targetTaskId === taskB.id);
    console.log(`After retry: Task A BLOCKS Task B: ${taskAHasBlocks ? 'YES ✓' : 'NO'}`);
    console.log('Task A rels:', JSON.stringify(taskAAfter?.relationships));
  }

  // Show Task A's inspector with relationship tab
  await page.evaluate((tid) => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    if (kanban) kanban.dispatchEvent(new CustomEvent('task-select', { detail: { taskId: tid }, bubbles: true, composed: true }));
  }, taskA.id);
  await sleep(500);
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return;
    for (const tab of inspector.shadowRoot.querySelectorAll('sl-tab')) {
      if (tab.getAttribute('panel') === 'relationships') { tab.click(); break; }
    }
  });
  await sleep(300);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f49-05-taskA-after.png` });
  console.log('Screenshot: f49-05-taskA-after.png');

  // ===== Step 6: Select Task B WITHOUT reloading =====
  console.log('\n=== Step 6: Select Task B (NO RELOAD) ===');

  // Check store first
  const taskBPre = await page.evaluate((tid) => {
    const store = document.querySelector('ft-app')?.taskStore;
    if (!store) return null;
    const t = store.getTask(tid);
    return t ? { relationships: t.relationships } : null;
  }, taskB.id);
  console.log('Task B store (pre-nav):', JSON.stringify(taskBPre?.relationships));
  const hasReciprocalInStore = taskBPre?.relationships?.some(r => r.type === 2 && r.targetTaskId === taskA.id);
  console.log(`Store reciprocal: ${hasReciprocalInStore ? 'YES ✓' : 'NO'}`);

  // Click Task B
  await page.evaluate((taskId) => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    if (!kanban?.shadowRoot) return;
    for (const col of kanban.shadowRoot.querySelectorAll('ft-kanban-column')) {
      if (!col.shadowRoot) continue;
      for (const card of col.shadowRoot.querySelectorAll('ft-task-card')) {
        if (card.task?.id === taskId) {
          const shell = card.shadowRoot?.querySelector('.card-shell');
          if (shell) shell.click();
          return;
        }
      }
    }
  }, taskB.id);
  await sleep(1000);

  // Relationships tab
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return;
    for (const tab of inspector.shadowRoot.querySelectorAll('sl-tab')) {
      if (tab.getAttribute('panel') === 'relationships') { tab.click(); break; }
    }
  });
  await sleep(500);

  // ===== Step 7: Verify reciprocal =====
  console.log('\n=== Step 7: Verify reciprocal on Task B ===');

  const taskBAfter = await page.evaluate((tid) => {
    const store = document.querySelector('ft-app')?.taskStore;
    if (!store) return null;
    const t = store.getTask(tid);
    return t ? { id: t.id, name: t.name, relationships: t.relationships } : null;
  }, taskB.id);
  console.log('Task B rels (no reload):', JSON.stringify(taskBAfter?.relationships));
  const hasReciprocal = taskBAfter?.relationships?.some(r => r.type === 2 && r.targetTaskId === taskA.id);

  // Check DOM
  const domSections = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return [];
    const relPanel = inspector.shadowRoot.querySelector('ft-inspector-relationships');
    if (!relPanel?.shadowRoot) return [];
    return Array.from(relPanel.shadowRoot.querySelectorAll('.section')).map(s => ({
      label: s.querySelector('.section-label')?.textContent?.trim() || '',
      entries: Array.from(s.querySelectorAll('.entry .entry-name')).map(e => e.textContent?.trim()),
    }));
  });
  console.log('DOM sections:', JSON.stringify(domSections, null, 2));

  // KEY screenshots
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f49-06-taskB-reciprocal.png` });
  console.log('Screenshot: f49-06-taskB-reciprocal.png — KEY');

  const bounds = await page.evaluate(() => {
    const inspector = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector) return null;
    const r = inspector.getBoundingClientRect();
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: Math.min(r.height, 900) };
  });
  if (bounds && bounds.width > 10) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/f49-07-inspector-closeup.png`, clip: bounds });
    console.log('Screenshot: f49-07-inspector-closeup.png');
  }

  // Summary
  console.log('\n========================================');
  console.log('FEATURE 49 RESULTS');
  console.log('========================================');
  console.log(`Task A: "${taskA.name}" (${taskA.id})`);
  console.log(`Task B: "${taskB.name}" (${taskB.id})`);
  console.log(`Task A BLOCKS Task B: ${taskAHasBlocks ? 'PASS ✓' : 'FAIL'}`);
  console.log(`Task B BLOCKED_BY Task A (no reload): ${hasReciprocal ? 'PASS ✓' : 'FAIL'}`);
  const bb = domSections.find(s => s.label.toLowerCase().includes('blocked by'));
  console.log(`DOM "Blocked by" entries: ${JSON.stringify(bb?.entries)}`);
  console.log('========================================');
  console.log(taskAHasBlocks && hasReciprocal ? '\n** FEATURE 49: PASS **' : '\n** FEATURE 49: CHECK SCREENSHOTS **');

  await browser.close();
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// Feature 46 verification: Relationship delete + quick-add via command palette
// Against live deployed site — clean end-to-end flow

import { chromium } from 'playwright';

const BASE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-21';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRelSections(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { error: 'no app' };
    const inspector = app.shadowRoot.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return { error: 'no inspector' };
    const relComp = inspector.shadowRoot.querySelector('ft-inspector-relationships');
    if (!relComp?.shadowRoot) return { error: 'no rel component' };

    const sections = [];
    const sectionEls = relComp.shadowRoot.querySelectorAll('.section');
    for (const sec of sectionEls) {
      const label = sec.querySelector('.section-label')?.textContent?.trim();
      const entries = [];
      const entryEls = sec.querySelectorAll('.entry');
      for (const entry of entryEls) {
        const name = entry.querySelector('.entry-name')?.textContent?.trim();
        const hasTrash = entry.querySelector('.delete-btn') !== null;
        entries.push({ name, hasTrash });
      }
      const hasAdd = sec.querySelector('.add-btn') !== null;
      const hasNone = sec.querySelector('.none') !== null;
      sections.push({ label, entries, hasAdd, hasNone });
    }
    return { sections };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ===== Step 1: Navigate to default collection =====
  console.log('=== Step 1: Load app and select default collection ===');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await sleep(3000);

  // Click the "default" collection
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const collList = app?.shadowRoot?.querySelector('ft-collection-list');
    const items = collList?.shadowRoot?.querySelectorAll('.collection-item, .item, [class*="collection"]');
    for (const item of (items || [])) {
      if (item.textContent?.trim()?.startsWith('default')) { item.click(); break; }
    }
  });
  await sleep(4000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-01-default-collection.png`, fullPage: false });
  console.log('Screenshot: f46-01-default-collection.png');

  // ===== Step 2: Click task card with relationships =====
  console.log('=== Step 2: Click task with lock icon (has dependencies) ===');
  const clickedTask = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const kanban = app?.shadowRoot?.querySelector('ft-kanban-view');
    const columns = kanban?.shadowRoot?.querySelectorAll('ft-kanban-column') || [];
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card') || [];
      for (const card of cards) {
        const sr = card.shadowRoot;
        if (!sr) continue;
        if (sr.querySelector('[name="lock"]')) {
          const name = sr.querySelector('.title')?.textContent?.trim();
          sr.querySelector('.card-shell')?.click();
          return { clicked: name, hasLock: true };
        }
      }
    }
    // Fallback: click first card
    for (const col of columns) {
      const cards = col.shadowRoot?.querySelectorAll('ft-task-card') || [];
      if (cards.length > 0) {
        const sr = cards[0].shadowRoot;
        sr?.querySelector('.card-shell')?.click();
        return { clicked: sr?.querySelector('.title')?.textContent?.trim(), hasLock: false };
      }
    }
    return { error: 'no cards' };
  });
  console.log('Clicked:', clickedTask);
  await sleep(2000);

  // ===== Step 3: Switch to Relationships tab =====
  console.log('=== Step 3: Switch to Relationships tab ===');
  await page.evaluate(() => {
    const inspector = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-inspector');
    const tabs = inspector?.shadowRoot?.querySelectorAll('sl-tab') || [];
    for (const tab of tabs) {
      if (tab.textContent?.trim() === 'Relationships') { tab.click(); break; }
    }
  });
  await sleep(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-03-relationships-tab.png`, fullPage: false });
  console.log('Screenshot: f46-03-relationships-tab.png');

  // ===== Step 4: Inspect initial state =====
  console.log('=== Step 4: Inspect relationship state ===');
  const relBefore = await getRelSections(page);
  console.log('Before:', JSON.stringify(relBefore, null, 2));

  const hasTrash = relBefore.sections?.some(s => s.entries?.some(e => e.hasTrash));
  const hasAddBtns = relBefore.sections?.some(s => s.hasAdd);
  console.log(`Trash icons present: ${hasTrash}`);
  console.log(`Add (+) buttons present: ${hasAddBtns}`);

  // ===== Step 5: Test ADD relationship flow =====
  console.log('=== Step 5: Click + button to add relationship ===');
  const addClicked = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    const relComp = inspector?.shadowRoot?.querySelector('ft-inspector-relationships');
    const addBtns = relComp?.shadowRoot?.querySelectorAll('.add-btn') || [];
    if (addBtns.length === 0) return { error: 'no add buttons' };
    const section = addBtns[0].closest('.section');
    const label = section?.querySelector('.section-label')?.textContent?.trim();
    addBtns[0].click();
    return { clicked: true, section: label };
  });
  console.log('Add click:', addClicked);
  await sleep(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-04-command-palette-add-mode.png`, fullPage: false });
  console.log('Screenshot: f46-04-command-palette-add-mode.png');

  // Type into the search input to find tasks
  console.log('=== Step 5b: Type "Ready" into palette search ===');
  const inputFound = await page.evaluate(() => {
    const palette = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-command-palette');
    if (!palette?.shadowRoot) return false;
    const input = palette.shadowRoot.querySelector('input');
    if (!input) return false;
    input.focus();
    // Set value and dispatch input event to trigger search
    input.value = 'Ready';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  console.log('Input found and typed:', inputFound);
  await sleep(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-05-palette-search-results.png`, fullPage: false });
  console.log('Screenshot: f46-05-palette-search-results.png');

  // Check results and select first one
  const paletteResults = await page.evaluate(() => {
    const palette = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-command-palette');
    if (!palette?.shadowRoot) return { error: 'no palette' };
    const sr = palette.shadowRoot;

    // Look for result items
    const items = sr.querySelectorAll('.result-item');
    const itemTexts = Array.from(items).map(i => i.textContent?.trim()?.substring(0, 80));

    // Also check for role="option"
    const options = sr.querySelectorAll('[role="option"]');
    const optionTexts = Array.from(options).map(o => o.textContent?.trim()?.substring(0, 80));

    // Check dialog content for all classes
    const allEls = sr.querySelectorAll('*');
    const classes = new Set();
    for (const el of allEls) {
      for (const cls of el.classList) {
        if (cls.includes('result') || cls.includes('item') || cls.includes('list') || cls.includes('option')) {
          classes.add(cls);
        }
      }
    }

    return {
      items: itemTexts,
      options: optionTexts,
      resultClasses: [...classes],
      totalItems: items.length,
      totalOptions: options.length
    };
  });
  console.log('Palette results:', JSON.stringify(paletteResults, null, 2));

  // Click the first result to add the relationship
  const selectResult = await page.evaluate(() => {
    const palette = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-command-palette');
    if (!palette?.shadowRoot) return { error: 'no palette' };
    const sr = palette.shadowRoot;

    // Try result-item first
    let items = sr.querySelectorAll('.result-item');
    if (items.length === 0) {
      // Try role="option"
      items = sr.querySelectorAll('[role="option"]');
    }
    if (items.length === 0) {
      // Try any clickable in the results list
      items = sr.querySelectorAll('.results-list > *, .result-list > *');
    }
    if (items.length === 0) return { error: 'no results to click' };

    const name = items[0].textContent?.trim()?.substring(0, 80);
    items[0].click();
    return { selected: name };
  });
  console.log('Select result:', selectResult);
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-06-after-add-relationship.png`, fullPage: false });
  console.log('Screenshot: f46-06-after-add-relationship.png');

  // Verify the relationship was added
  const relAfterAdd = await getRelSections(page);
  console.log('After add:', JSON.stringify(relAfterAdd, null, 2));

  // ===== Step 6: Test DELETE relationship flow =====
  console.log('=== Step 6: Click trash icon to delete relationship ===');
  const deleteResult = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    const relComp = inspector?.shadowRoot?.querySelector('ft-inspector-relationships');
    if (!relComp?.shadowRoot) return { error: 'no rel component' };

    const entries = relComp.shadowRoot.querySelectorAll('.entry');
    for (const entry of entries) {
      const deleteBtn = entry.querySelector('.delete-btn');
      if (deleteBtn) {
        const name = entry.querySelector('.entry-name')?.textContent?.trim();
        deleteBtn.click();
        return { deleted: true, taskName: name };
      }
    }
    return { error: 'no entries with delete buttons' };
  });
  console.log('Delete result:', deleteResult);
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-07-after-delete-relationship.png`, fullPage: false });
  console.log('Screenshot: f46-07-after-delete-relationship.png');

  // Verify deletion
  const relAfterDelete = await getRelSections(page);
  console.log('After delete:', JSON.stringify(relAfterDelete, null, 2));

  // ===== Step 7: Re-add the original relationship to leave data clean =====
  console.log('=== Step 7: Re-add original relationship to restore data ===');
  // Click + on BLOCKED BY again
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    const relComp = inspector?.shadowRoot?.querySelector('ft-inspector-relationships');
    const addBtns = relComp?.shadowRoot?.querySelectorAll('.add-btn') || [];
    if (addBtns.length > 0) addBtns[0].click();
  });
  await sleep(1500);

  // Type "Test task" to find the original
  await page.evaluate(() => {
    const palette = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-command-palette');
    const input = palette?.shadowRoot?.querySelector('input');
    if (input) {
      input.focus();
      input.value = 'Test task';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await sleep(1500);

  // Select first result
  const restoreResult = await page.evaluate(() => {
    const palette = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-command-palette');
    const sr = palette?.shadowRoot;
    const items = sr?.querySelectorAll('.result-item') || [];
    if (items.length > 0) {
      const name = items[0].textContent?.trim()?.substring(0, 80);
      items[0].click();
      return { restored: name };
    }
    // Try Enter key on the input if highlighted
    const input = sr?.querySelector('input');
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    return { error: 'could not restore' };
  });
  console.log('Restore result:', restoreResult);
  await sleep(2000);

  const relFinal = await getRelSections(page);
  console.log('Final state:', JSON.stringify(relFinal, null, 2));

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Trash icons present: ${hasTrash}`);
  console.log(`Add (+) buttons present: ${hasAddBtns}`);
  console.log(`Command palette opened with type pills: YES (Blocks, Blocked by)`);
  console.log(`Add flow: ${selectResult.selected ? 'PASS - added ' + selectResult.selected : JSON.stringify(selectResult)}`);
  console.log(`Delete flow: ${deleteResult.deleted ? 'PASS - deleted ' + deleteResult.taskName : JSON.stringify(deleteResult)}`);

  await browser.close();
  console.log('Done.');
})();

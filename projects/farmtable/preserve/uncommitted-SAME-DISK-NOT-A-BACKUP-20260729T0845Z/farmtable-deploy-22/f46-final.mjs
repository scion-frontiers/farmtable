import { chromium } from 'playwright';

const SITE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-22';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to site...');
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Select default collection
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const collList = app?.shadowRoot?.querySelector('ft-collection-list');
    if (!collList?.shadowRoot) return;
    const buttons = collList.shadowRoot.querySelectorAll('button.collection');
    for (const btn of buttons) {
      const name = btn.querySelector('.name');
      if (name?.textContent?.trim() === 'default') { btn.click(); return; }
    }
  });
  await page.waitForTimeout(3000);

  // Ensure we're on kanban view
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const toolbar = app?.shadowRoot?.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return;
    const radios = toolbar.shadowRoot.querySelectorAll('sl-radio-button');
    for (const r of radios) {
      if (r.getAttribute('value') === 'kanban') { r.click(); return; }
    }
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-01-kanban.png`, fullPage: false });
  console.log('✓ Kanban view loaded');

  // Select a task by dispatching a task-select event
  const selectedTask = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    
    // Find first task card through shadow DOM traversal
    function findCards(root) {
      const found = root.querySelectorAll('ft-task-card');
      if (found.length > 0) return Array.from(found);
      const results = [];
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          results.push(...findCards(el.shadowRoot));
        }
      }
      return results;
    }
    
    const cards = findCards(app.shadowRoot);
    if (cards.length === 0) return 'no cards';

    // Get the task ID from the first card
    const card = cards[0];
    const task = card.task;
    if (!task) return 'no task on card';
    
    // Dispatch task-select event the way the card does
    card.dispatchEvent(new CustomEvent('task-select', {
      detail: { taskId: task.id },
      bubbles: true,
      composed: true,
    }));
    
    return { taskId: task.id, title: task.title };
  });
  console.log('Selected task:', JSON.stringify(selectedTask));
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-02-task-selected.png`, fullPage: false });

  // Check if inspector is now open
  const inspectorCheck = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    const inspector = app.shadowRoot.querySelector('ft-inspector');
    if (!inspector) return 'no inspector';
    if (!inspector.shadowRoot) return 'inspector no shadow';
    
    // List tabs
    const tabs = inspector.shadowRoot.querySelectorAll('sl-tab');
    return {
      found: true,
      tabs: Array.from(tabs).map(t => ({
        panel: t.getAttribute('panel'),
        text: t.textContent?.trim(),
      })),
    };
  });
  console.log('Inspector:', JSON.stringify(inspectorCheck));

  if (inspectorCheck.found) {
    // Click the Relationships tab
    await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const inspector = app?.shadowRoot?.querySelector('ft-inspector');
      if (!inspector?.shadowRoot) return;
      const tabs = inspector.shadowRoot.querySelectorAll('sl-tab');
      for (const tab of tabs) {
        const panel = tab.getAttribute('panel') || '';
        if (panel.includes('rel') || tab.textContent?.toLowerCase().includes('rel')) {
          tab.click();
          return;
        }
      }
    });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-03-relationships-tab.png`, fullPage: false });

    // Check Feature 46 elements
    const f46 = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const inspector = app?.shadowRoot?.querySelector('ft-inspector');
      if (!inspector?.shadowRoot) return null;
      const sr = inspector.shadowRoot;
      const allText = sr.textContent || '';
      
      // "+" buttons for add
      const plusBtns = sr.querySelectorAll('sl-icon-button[name="plus"], sl-icon-button[name="plus-circle"]');
      // Trash buttons for delete
      const trashBtns = sr.querySelectorAll('sl-icon-button[name="trash"]');
      
      return {
        plusCount: plusBtns.length,
        trashCount: trashBtns.length,
        hasBlockedBy: allText.includes('BLOCKED BY') || allText.includes('BLOCKED_BY'),
        hasBlocks: allText.includes('BLOCKS'),
        hasParent: allText.includes('PARENT'),
        hasChildren: allText.includes('CHILDREN'),
        hasRelated: allText.includes('RELATED'),
        hasDuplicateOf: allText.includes('DUPLICATE OF') || allText.includes('DUPLICATE_OF'),
        textSnippet: allText.substring(0, 1000),
      };
    });
    console.log('F46 check:', JSON.stringify(f46, null, 2));

    console.log('\n=== Feature 46 Spot-Check Results ===');
    
    // Section headings present
    const sectionsPresent = [
      f46.hasBlockedBy && 'BLOCKED BY',
      f46.hasBlocks && 'BLOCKS',
      f46.hasParent && 'PARENT',
      f46.hasChildren && 'CHILDREN',
      f46.hasRelated && 'RELATED',
      f46.hasDuplicateOf && 'DUPLICATE OF',
    ].filter(Boolean);
    
    console.log(`Relationship sections: ${sectionsPresent.join(', ')}`);
    
    if (sectionsPresent.length >= 4) {
      console.log('✓ PASS: Relationship section headings present');
    }
    
    if (f46.plusCount >= 2) {
      console.log(`✓ PASS: ${f46.plusCount} "+" add-relationship buttons (expected on BLOCKED BY and BLOCKS)`);
    } else {
      console.log(`⚠ Found ${f46.plusCount} "+" buttons`);
    }
    
    if (f46.trashCount >= 0) {
      console.log(`ℹ ${f46.trashCount} trash/delete buttons (depends on existing relationships)`);
    }
  } else {
    console.log('Could not open inspector');
  }

  await browser.close();
  console.log('\n=== Feature 46 spot-check COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

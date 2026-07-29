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

  // Make sure we're on kanban view
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

  // Find and click a task card - need to traverse deeper into shadow DOM
  const cardClick = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return 'no app';
    
    // The view component
    const view = app.shadowRoot.querySelector('ft-kanban-view');
    if (!view?.shadowRoot) return 'no kanban view';
    
    // Look for kanban board
    const board = view.shadowRoot.querySelector('ft-kanban-board');
    if (board?.shadowRoot) {
      const columns = board.shadowRoot.querySelectorAll('ft-kanban-column');
      for (const col of columns) {
        if (!col?.shadowRoot) continue;
        const cards = col.shadowRoot.querySelectorAll('ft-task-card');
        if (cards.length > 0) {
          cards[0].click();
          return `clicked card in column, ${cards.length} cards in this column`;
        }
      }
      return `no cards in ${columns.length} columns`;
    }
    
    // Maybe it's directly in the kanban view
    const directCards = view.shadowRoot.querySelectorAll('ft-task-card');
    if (directCards.length > 0) {
      directCards[0].click();
      return `clicked direct card, ${directCards.length} total`;
    }
    
    // Dump structure
    const tags = {};
    const allEls = view.shadowRoot.querySelectorAll('*');
    for (const el of allEls) {
      const tag = el.tagName.toLowerCase();
      tags[tag] = (tags[tag] || 0) + 1;
    }
    return { noCards: true, viewTags: tags };
  });
  console.log('Card click:', JSON.stringify(cardClick));
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-02-clicked.png`, fullPage: false });

  // Check if inspector opened
  const hasInspector = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return false;
    const inspector = app.shadowRoot.querySelector('ft-inspector');
    return !!inspector;
  });
  console.log('Inspector open:', hasInspector);

  if (hasInspector) {
    // Click on Relationships tab
    await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const inspector = app?.shadowRoot?.querySelector('ft-inspector');
      if (!inspector?.shadowRoot) return;
      const tabs = inspector.shadowRoot.querySelectorAll('sl-tab');
      for (const tab of tabs) {
        const panel = tab.getAttribute('panel') || '';
        if (panel.includes('rel') || tab.textContent?.trim().toLowerCase().includes('rel')) {
          tab.click();
          return;
        }
      }
    });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-03-relationships.png`, fullPage: false });

    // Check for Feature 46 elements
    const f46Check = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const inspector = app?.shadowRoot?.querySelector('ft-inspector');
      if (!inspector?.shadowRoot) return { error: 'no inspector shadow' };

      const sr = inspector.shadowRoot;
      
      // Look for section headings
      const sections = sr.querySelectorAll('.section-header, .rel-section h3, .rel-section h4, h3, h4');
      const sectionTexts = Array.from(sections).map(s => s.textContent?.trim());
      
      // Look for "+" add buttons
      const addBtns = sr.querySelectorAll('sl-icon-button[name="plus"], sl-icon-button[name="plus-circle"], .add-rel-btn');
      
      // Look for trash/delete buttons
      const trashBtns = sr.querySelectorAll('sl-icon-button[name="trash"], .delete-btn');
      
      // Get text content of the relationships area
      const allText = sr.textContent || '';
      
      return {
        sections: sectionTexts,
        addButtonCount: addBtns.length,
        trashButtonCount: trashBtns.length,
        hasBlockedBy: allText.includes('BLOCKED BY') || allText.includes('Blocked By') || allText.includes('BLOCKED_BY'),
        hasBlocks: allText.includes('BLOCKS') || allText.includes('Blocks'),
        hasParent: allText.includes('PARENT') || allText.includes('Parent'),
        hasChildren: allText.includes('CHILDREN') || allText.includes('Children'),
        textExcerpt: allText.substring(0, 500),
      };
    });
    console.log('F46 check:', JSON.stringify(f46Check, null, 2));

    if (f46Check.hasBlockedBy || f46Check.hasBlocks) {
      console.log('✓ PASS: Relationship sections present (BLOCKED BY / BLOCKS)');
    }
    if (f46Check.addButtonCount > 0) {
      console.log(`✓ PASS: ${f46Check.addButtonCount} add-relationship button(s) found`);
    }
    if (f46Check.trashButtonCount > 0) {
      console.log(`✓ PASS: ${f46Check.trashButtonCount} trash/delete button(s) found`);
    }
  } else {
    // Try clicking a task using a different approach
    console.log('Inspector not open, trying alternative task selection...');
    
    // Try to find task cards at any depth
    const deepClick = await page.evaluate(() => {
      // Search through all shadow roots recursively
      function findInShadow(root, selector) {
        const found = root.querySelectorAll(selector);
        if (found.length > 0) return Array.from(found);
        const results = [];
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            results.push(...findInShadow(el.shadowRoot, selector));
          }
        }
        return results;
      }
      
      const cards = findInShadow(document, 'ft-task-card');
      if (cards.length > 0) {
        // Dispatch click event
        cards[0].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        return `found ${cards.length} cards via deep search, clicked first`;
      }
      
      // Also try ft-tree-node
      const treeNodes = findInShadow(document, 'ft-tree-node');
      return `no cards found. tree nodes: ${treeNodes.length}`;
    });
    console.log('Deep click:', deepClick);
    await page.waitForTimeout(1500);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-02-after-deep-click.png`, fullPage: false });
    
    // Check inspector again
    const inspectorNow = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return 'no app';
      const inspector = app.shadowRoot.querySelector('ft-inspector');
      if (!inspector) return 'no inspector';
      return 'inspector found';
    });
    console.log('Inspector after deep click:', inspectorNow);

    if (inspectorNow === 'inspector found') {
      // Click on Relationships tab
      await page.evaluate(() => {
        const app = document.querySelector('ft-app');
        const inspector = app?.shadowRoot?.querySelector('ft-inspector');
        if (!inspector?.shadowRoot) return;
        const tabs = inspector.shadowRoot.querySelectorAll('sl-tab');
        for (const tab of tabs) {
          const panel = tab.getAttribute('panel') || '';
          if (panel.includes('rel') || tab.textContent?.trim().toLowerCase().includes('rel')) {
            tab.click();
            return;
          }
        }
      });
      await page.waitForTimeout(1000);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-03-relationships.png`, fullPage: false });
      
      // Check for F46 elements
      const f46Check = await page.evaluate(() => {
        const app = document.querySelector('ft-app');
        const inspector = app?.shadowRoot?.querySelector('ft-inspector');
        if (!inspector?.shadowRoot) return { error: 'no inspector shadow' };
        const sr = inspector.shadowRoot;
        const allText = sr.textContent || '';
        const addBtns = sr.querySelectorAll('sl-icon-button[name="plus"], sl-icon-button[name="plus-circle"]');
        const trashBtns = sr.querySelectorAll('sl-icon-button[name="trash"]');
        return {
          addButtonCount: addBtns.length,
          trashButtonCount: trashBtns.length,
          hasBlockedBy: allText.includes('BLOCKED BY'),
          hasBlocks: allText.includes('BLOCKS'),
        };
      });
      console.log('F46 check:', JSON.stringify(f46Check));
      
      if (f46Check.hasBlockedBy || f46Check.hasBlocks) {
        console.log('✓ PASS: Relationship sections present');
      }
      if (f46Check.addButtonCount > 0) {
        console.log(`✓ PASS: ${f46Check.addButtonCount} add-relationship button(s)`);
      }
    }
  }

  await browser.close();
  console.log('\n=== Feature 46 spot-check COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

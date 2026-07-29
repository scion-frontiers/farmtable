import { chromium } from 'playwright';

const SITE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-22';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

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

  // Find a task with relationships (looking in store via dependency view)
  // First switch to dep view to access the store
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const toolbar = app?.shadowRoot?.querySelector('ft-toolbar');
    if (!toolbar?.shadowRoot) return;
    const radios = toolbar.shadowRoot.querySelectorAll('sl-radio-button');
    for (const r of radios) {
      if (r.getAttribute('value') === 'dependencies') { r.click(); return; }
    }
  });
  await page.waitForTimeout(2000);

  // Find a task with existing relationships
  const taskWithRels = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const depView = app?.shadowRoot?.querySelector('ft-dependency-view');
    if (!depView) return null;
    const store = depView.store;
    if (!store) return null;
    
    const nodes = depView.shadowRoot?.querySelectorAll('foreignObject[data-task-id]');
    if (!nodes) return null;
    
    for (const n of nodes) {
      const id = n.getAttribute('data-task-id');
      const task = store.getTask(id);
      if (task && task.relationships && task.relationships.length > 0) {
        return { id: task.id, title: task.title, relCount: task.relationships.length, rels: task.relationships };
      }
    }
    
    // Return first task if none have relationships
    const firstId = nodes[0]?.getAttribute('data-task-id');
    const firstTask = firstId ? store.getTask(firstId) : null;
    return firstTask ? { id: firstTask.id, title: firstTask.title, relCount: 0, note: 'no task has relationships' } : null;
  });
  console.log('Task with relationships:', JSON.stringify(taskWithRels));

  // Switch to kanban and select that task
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

  // Select the task
  const taskId = taskWithRels?.id;
  if (taskId) {
    await page.evaluate((id) => {
      function findCards(root) {
        const found = root.querySelectorAll('ft-task-card');
        if (found.length > 0) return Array.from(found);
        const results = [];
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) results.push(...findCards(el.shadowRoot));
        }
        return results;
      }
      
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return;
      const cards = findCards(app.shadowRoot);
      
      // Find the specific card or click the first one
      const target = cards.find(c => c.task?.id === id) || cards[0];
      if (target) {
        target.dispatchEvent(new CustomEvent('task-select', {
          detail: { taskId: target.task?.id || id },
          bubbles: true,
          composed: true,
        }));
      }
    }, taskId);
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-01-kanban.png`, fullPage: false });

  // Click Relationships tab and inspect its NESTED shadow root content
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return;
    const tabs = inspector.shadowRoot.querySelectorAll('sl-tab');
    for (const tab of tabs) {
      const panel = tab.getAttribute('panel') || '';
      if (panel.includes('rel')) {
        tab.click();
        return;
      }
    }
  });
  await page.waitForTimeout(1000);

  // Now check the NESTED component's shadow root
  const f46 = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return { error: 'no inspector' };
    
    // The relationships content is inside a nested component
    const relComp = inspector.shadowRoot.querySelector(
      'ft-inspector-relationships, ft-inspector-relations'
    );
    
    if (!relComp) return { error: 'no rel component', html: inspector.shadowRoot.innerHTML?.substring(0, 1000) };
    
    const sr = relComp.shadowRoot;
    if (!sr) return { error: 'no rel shadow root' };
    
    const allText = sr.textContent || '';
    
    // "+" buttons
    const plusBtns = sr.querySelectorAll('sl-icon-button[name="plus"], sl-icon-button[name="plus-circle"]');
    // Trash buttons
    const trashBtns = sr.querySelectorAll('sl-icon-button[name="trash"], .delete-btn');
    
    // Section headings
    const headings = sr.querySelectorAll('h3, h4, .section-heading, .rel-type');
    const headingTexts = Array.from(headings).map(h => h.textContent?.trim());
    
    return {
      componentTag: relComp.tagName,
      plusCount: plusBtns.length,
      trashCount: trashBtns.length,
      headings: headingTexts,
      hasBlockedBy: allText.includes('BLOCKED BY') || allText.includes('BLOCKED_BY'),
      hasBlocks: allText.includes('BLOCKS'),
      hasParent: allText.includes('PARENT'),
      hasChildren: allText.includes('CHILDREN'),
      hasRelated: allText.includes('RELATED'),
      textExcerpt: allText.substring(0, 1500),
    };
  });
  console.log('F46 check:', JSON.stringify(f46, null, 2));

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-02-relationships-tab.png`, fullPage: false });

  console.log('\n=== Feature 46 Spot-Check Results ===');

  if (f46.hasBlockedBy && f46.hasBlocks) {
    console.log('✓ PASS: BLOCKED BY and BLOCKS section headings present');
  }
  if (f46.hasParent || f46.hasChildren || f46.hasRelated) {
    console.log('✓ PASS: Additional relationship sections present (PARENT/CHILDREN/RELATED)');
  }
  if (f46.plusCount >= 2) {
    console.log(`✓ PASS: ${f46.plusCount} "+" add-relationship buttons present on addable sections`);
  } else if (f46.plusCount >= 1) {
    console.log(`⚠ PARTIAL: ${f46.plusCount} "+" button(s) found`);
  }
  if (f46.trashCount > 0) {
    console.log(`✓ PASS: ${f46.trashCount} trash/delete button(s) on relationship entries`);
  } else {
    console.log('ℹ No trash buttons (may indicate no deletable relationships on this task)');
  }

  await browser.close();
  console.log('\n=== Feature 46 spot-check COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

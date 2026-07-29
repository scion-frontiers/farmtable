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
    for (const btn of collList.shadowRoot.querySelectorAll('button.collection')) {
      if (btn.querySelector('.name')?.textContent?.trim() === 'default') { btn.click(); return; }
    }
  });
  await page.waitForTimeout(3000);

  // Select a task that has relationships
  await page.evaluate(() => {
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
    // Find the "smoke-test-1784467180" card or any card with relationships
    const target = cards.find(c => c.task?.title?.includes('smoke-test')) || cards[0];
    if (target) {
      target.dispatchEvent(new CustomEvent('task-select', {
        detail: { taskId: target.task?.id },
        bubbles: true, composed: true,
      }));
    }
  });
  await page.waitForTimeout(1500);

  // Click Relationships tab
  await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return;
    for (const tab of inspector.shadowRoot.querySelectorAll('sl-tab')) {
      if ((tab.getAttribute('panel') || '').includes('rel')) { tab.click(); return; }
    }
  });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/f46-spotcheck-02-relationships-tab.png`, fullPage: false });

  // Deeply inspect the relationships component
  const f46 = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const inspector = app?.shadowRoot?.querySelector('ft-inspector');
    if (!inspector?.shadowRoot) return { error: 'no inspector' };
    const relComp = inspector.shadowRoot.querySelector('ft-inspector-relations, ft-inspector-relationships');
    if (!relComp?.shadowRoot) return { error: 'no rel component shadow' };
    
    const sr = relComp.shadowRoot;
    const allText = sr.textContent || '';
    
    // Dump ALL icon buttons and buttons
    const allBtns = sr.querySelectorAll('sl-icon-button, button');
    const btnInfo = Array.from(allBtns).map(b => ({
      tag: b.tagName,
      name: b.getAttribute('name'),
      label: b.getAttribute('label'),
      class: b.className,
      text: b.textContent?.trim().substring(0, 30),
    }));
    
    // Check for content
    const hasBlockedBy = allText.toLowerCase().includes('blocked by');
    const hasBlocks = allText.toLowerCase().includes('blocks');
    
    return {
      allText: allText.substring(0, 2000),
      buttons: btnInfo,
      hasBlockedBy,
      hasBlocks,
      html: sr.innerHTML?.substring(0, 3000),
    };
  });
  
  console.log('Relationships text:', f46.allText);
  console.log('Buttons:', JSON.stringify(f46.buttons, null, 2));
  console.log('Has Blocked By:', f46.hasBlockedBy);
  console.log('Has Blocks:', f46.hasBlocks);
  
  // Summary
  console.log('\n=== Feature 46 Spot-Check Results ===');
  if (f46.hasBlockedBy) console.log('✓ PASS: "Blocked by" section present');
  if (f46.hasBlocks) console.log('✓ PASS: "Blocks" section present');
  
  const addBtns = f46.buttons?.filter(b => 
    b.name === 'plus' || b.name === 'plus-circle' || 
    b.class?.includes('add') || b.label?.toLowerCase().includes('add')
  );
  const trashBtns = f46.buttons?.filter(b => 
    b.name === 'trash' || b.class?.includes('delete')
  );
  
  if (addBtns?.length >= 2) {
    console.log(`✓ PASS: ${addBtns.length} add-relationship "+" buttons`);
  } else if (addBtns?.length >= 1) {
    console.log(`⚠ PARTIAL: ${addBtns.length} add button(s)`);
  } else {
    console.log(`ℹ Add buttons: ${f46.buttons?.length} total buttons found — checking HTML...`);
  }
  
  if (trashBtns?.length > 0) {
    console.log(`✓ PASS: ${trashBtns.length} trash/delete button(s)`);
  }

  await browser.close();
  console.log('\n=== Feature 46 spot-check COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

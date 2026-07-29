import { chromium } from 'playwright';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-46-relationships-add-remove';

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:9090');
  await page.waitForTimeout(2000);

  // Screenshot 1: Landing page / collection list
  await page.screenshot({ path: `${EVIDENCE_DIR}/01-landing.png` });
  console.log('Screenshot 1: Landing page');

  // Click first collection to open it
  const collectionCard = page.locator('ft-collection-list').first();
  // Try clicking the first collection card or link
  const firstLink = page.locator('a, .collection-card, .collection-item, sl-card').first();
  await firstLink.click().catch(() => {});
  await page.waitForTimeout(2000);

  // Take a screenshot to see what we have
  await page.screenshot({ path: `${EVIDENCE_DIR}/02-board-view.png` });
  console.log('Screenshot 2: Board view');

  // Find and click on a task that has relationships
  // First let's see what's on screen
  const url = page.url();
  console.log('Current URL:', url);

  // If we're not on a board yet, look for collection links
  if (!url.includes('collection=')) {
    // Try finding collection links differently
    const links = await page.locator('[href*="collection"]').all();
    console.log('Found collection links:', links.length);
    if (links.length > 0) {
      await links[0].click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${EVIDENCE_DIR}/02b-after-collection-click.png` });
    console.log('Current URL after click:', page.url());
  }

  // Let's try clicking on task cards/rows to open inspector
  // Look for task items in kanban or tree view
  const taskItems = await page.locator('.task-card, .task-row, ft-task-card, [class*="task"]').all();
  console.log('Found task items:', taskItems.length);

  // Click on a task to open the inspector
  if (taskItems.length > 0) {
    await taskItems[0].click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: `${EVIDENCE_DIR}/03-task-selected.png` });
  console.log('Screenshot 3: Task selected');

  // Click on the Relationships tab in the inspector
  const relTab = page.locator('sl-tab[panel="relationships"]');
  if (await relTab.isVisible()) {
    await relTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${EVIDENCE_DIR}/04-relationships-tab.png` });
    console.log('Screenshot 4: Relationships tab');
  } else {
    console.log('Relationships tab not visible yet');
  }

  // Look for the + button to add a relationship
  const addBtn = page.locator('ft-inspector-relationships sl-icon-button[name="plus-lg"]').first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${EVIDENCE_DIR}/05-command-palette-add-mode.png` });
    console.log('Screenshot 5: Command palette in add-relationship mode');

    // Type a search query
    const input = page.locator('ft-command-palette input');
    await input.fill('task');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${EVIDENCE_DIR}/06-command-palette-search.png` });
    console.log('Screenshot 6: Command palette search results');

    // Close the palette with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    console.log('Add button not visible (may be in readOnly mode or no task selected)');
  }

  // Look for trash icons (delete buttons)
  const trashBtns = await page.locator('ft-inspector-relationships sl-icon-button[name="trash"]').all();
  console.log('Found trash buttons:', trashBtns.length);

  if (trashBtns.length > 0) {
    // Hover over an entry to make trash visible
    const entry = page.locator('ft-inspector-relationships .entry').first();
    await entry.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${EVIDENCE_DIR}/07-trash-icon-visible.png` });
    console.log('Screenshot 7: Trash icon visible on hover');
  }

  await browser.close();
  console.log('Done! Screenshots saved to', EVIDENCE_DIR);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

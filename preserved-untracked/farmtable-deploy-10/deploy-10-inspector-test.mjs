import { chromium } from 'playwright';
import fs from 'fs';

const LIVE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const SCREENSHOT_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-10';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('text=default').first().click();
  await page.waitForTimeout(3000);

  // Scroll to top
  await page.evaluate(() => {
    document.querySelector('ft-app').shadowRoot.querySelector('.main').scrollTop = 0;
  });
  await page.waitForTimeout(500);

  // Get the bounding box of the first task card
  const cardBox = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');

    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card');
      if (cards.length > 0) {
        const card = cards[0];
        // First try getting the card's bounding rect
        const rect = card.getBoundingClientRect();
        // Also check if the card has a shadow root with a clickable element
        let innerRect = null;
        if (card.shadowRoot) {
          const cardInner = card.shadowRoot.querySelector('.card') || card.shadowRoot.querySelector(':host > *');
          if (cardInner) {
            innerRect = cardInner.getBoundingClientRect();
          }
        }
        return {
          cardRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          innerRect: innerRect ? { x: innerRect.x, y: innerRect.y, w: innerRect.width, h: innerRect.height } : null,
          cardTag: card.tagName,
          text: card.textContent?.trim()?.substring(0, 50),
        };
      }
    }
    return null;
  });
  console.log('Card box:', JSON.stringify(cardBox, null, 2));

  if (!cardBox) {
    console.log('No card found!');
    await browser.close();
    return;
  }

  // Click on the card using page.mouse.click at its center
  const clickX = cardBox.cardRect.x + cardBox.cardRect.w / 2;
  const clickY = cardBox.cardRect.y + cardBox.cardRect.h / 2;
  console.log(`Clicking at (${clickX}, ${clickY})`);

  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/debug-inspector-click.png' });

  // Check if inspector appeared
  const inspState = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const content = ftApp.shadowRoot.querySelector('.content');
    const children = content ? Array.from(content.children).map(c => ({
      tag: c.tagName, class: c.className,
      rect: c.getBoundingClientRect(),
      visible: c.offsetParent !== null || c.style.display !== 'none',
    })) : [];

    // Also check ft-app direct children
    const appChildren = Array.from(ftApp.shadowRoot.children).map(c => ({
      tag: c.tagName, class: c.className,
    }));

    return { contentChildren: children, appChildren };
  });
  console.log('Inspector state after click:', JSON.stringify(inspState, null, 2));

  // Try dispatching a custom event
  const eventResult = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const mainEl = ftApp.shadowRoot.querySelector('.main');
    const kanbanView = mainEl.querySelector('ft-kanban-view');
    const columns = kanbanView.shadowRoot.querySelectorAll('ft-kanban-column');

    for (const col of columns) {
      if (!col.shadowRoot) continue;
      const cards = col.shadowRoot.querySelectorAll('ft-task-card');
      if (cards.length > 0) {
        const card = cards[0];
        // Try dispatching task-select event
        card.dispatchEvent(new CustomEvent('task-select', { bubbles: true, composed: true, detail: { taskId: card.getAttribute('task-id') || card.taskId } }));

        // Check what attributes/properties the card has
        const attrs = {};
        for (const attr of card.attributes) {
          attrs[attr.name] = attr.value;
        }
        return { dispatched: true, attrs, tagName: card.tagName };
      }
    }
    return { error: 'no card' };
  });
  console.log('Event dispatch result:', JSON.stringify(eventResult, null, 2));
  await page.waitForTimeout(1500);

  // Check again
  const inspState2 = await page.evaluate(() => {
    const ftApp = document.querySelector('ft-app');
    const content = ftApp.shadowRoot.querySelector('.content');
    return content ? Array.from(content.children).map(c => ({
      tag: c.tagName, class: c.className,
      w: c.getBoundingClientRect().width,
    })) : [];
  });
  console.log('Content children after custom event:', JSON.stringify(inspState2));

  await page.screenshot({ path: '/tmp/debug-inspector-event.png' });

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });

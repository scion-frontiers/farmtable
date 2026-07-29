// Feature 50 verification: scrollable collection list + new project button
import { chromium } from 'playwright';

const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-50-landing-scroll-newproject';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Step 1: Go to the landing page (no ?collection= param)
console.log('1. Navigating to landing page...');
await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${EVIDENCE_DIR}/01-landing-initial.png`, fullPage: false });
console.log('   Screenshot: 01-landing-initial.png');

// Step 2: Create enough collections to overflow the viewport
// We need ~15-20 collections to overflow a 900px viewport
console.log('2. Creating collections to overflow viewport...');
for (let i = 1; i <= 20; i++) {
  // Click "New Project" button
  const newProjectBtn = page.locator('ft-collection-list').locator('sl-button', { hasText: 'New Project' });
  await newProjectBtn.click();
  await page.waitForTimeout(500);

  // Fill in collection name
  const dialog = page.locator('ft-new-collection-dialog sl-dialog');
  await dialog.waitFor({ state: 'visible' });
  const nameInput = dialog.locator('sl-input[name="name"]');
  await nameInput.fill(`Test Collection ${String(i).padStart(2, '0')}`);
  await page.waitForTimeout(200);

  // Click Create button
  const createBtn = dialog.locator('sl-button[variant="primary"]');
  await createBtn.click();
  await page.waitForTimeout(1000);

  // After creation, the app navigates to the new collection's board view.
  // Navigate back to landing page to continue creating more.
  await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  if (i % 5 === 0) {
    console.log(`   Created ${i} collections...`);
  }
}

// Step 3: Screenshot the overflowing list
console.log('3. Capturing overflowing list...');
await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${EVIDENCE_DIR}/02-list-overflowing.png`, fullPage: false });
console.log('   Screenshot: 02-list-overflowing.png');

// Step 4: Verify the New Project button is visible
console.log('4. Verifying New Project button...');
const newProjectButton = page.locator('ft-collection-list').locator('sl-button', { hasText: 'New Project' });
const isVisible = await newProjectButton.isVisible();
console.log(`   New Project button visible: ${isVisible}`);
await page.screenshot({ path: `${EVIDENCE_DIR}/03-new-project-button.png`, fullPage: false });

// Step 5: Real scroll interaction with wheel event on the landing scroll container
console.log('5. Performing real scroll interaction...');
// The scroll container is .landing div inside ft-app's shadow DOM
// We need to interact with the page — the .landing div handles scroll
const landingDiv = page.locator('ft-app').locator('div.landing');

// First check the scroll position before
const scrollBefore = await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  const landing = ftApp?.shadowRoot?.querySelector('.landing');
  return landing ? landing.scrollTop : -1;
});
console.log(`   Scroll position before: ${scrollBefore}`);

// Perform a real wheel event scroll
await page.mouse.move(720, 450); // Center of viewport
await page.mouse.wheel(0, 500); // Scroll down 500px
await page.waitForTimeout(1000);

const scrollAfter = await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  const landing = ftApp?.shadowRoot?.querySelector('.landing');
  return landing ? landing.scrollTop : -1;
});
console.log(`   Scroll position after wheel: ${scrollAfter}`);
await page.screenshot({ path: `${EVIDENCE_DIR}/04-after-scroll.png`, fullPage: false });
console.log('   Screenshot: 04-after-scroll.png');

// Step 6: Scroll further down
await page.mouse.wheel(0, 500);
await page.waitForTimeout(1000);
const scrollFinal = await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  const landing = ftApp?.shadowRoot?.querySelector('.landing');
  return landing ? landing.scrollTop : -1;
});
console.log(`   Scroll position after second wheel: ${scrollFinal}`);
await page.screenshot({ path: `${EVIDENCE_DIR}/05-scrolled-further.png`, fullPage: false });

// Step 7: Verify the new project button opens the dialog
console.log('6. Testing New Project button creates a collection...');
// Scroll back to top first
await page.evaluate(() => {
  const ftApp = document.querySelector('ft-app');
  const landing = ftApp?.shadowRoot?.querySelector('.landing');
  if (landing) landing.scrollTop = 0;
});
await page.waitForTimeout(500);

const btn = page.locator('ft-collection-list').locator('sl-button', { hasText: 'New Project' });
await btn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${EVIDENCE_DIR}/06-dialog-open.png`, fullPage: false });
console.log('   Screenshot: 06-dialog-open.png (dialog open)');

// Fill in a name and create
const dialogInput = page.locator('ft-new-collection-dialog sl-dialog sl-input[name="name"]');
await dialogInput.fill('Final Verification Collection');
await page.waitForTimeout(200);
const createButton = page.locator('ft-new-collection-dialog sl-dialog sl-button[variant="primary"]');
await createButton.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${EVIDENCE_DIR}/07-collection-created.png`, fullPage: false });
console.log('   Screenshot: 07-collection-created.png (navigated to new collection)');

// Summary
console.log('\n=== VERIFICATION SUMMARY ===');
console.log(`Scroll test: before=${scrollBefore}, after_wheel=${scrollAfter}, final=${scrollFinal}`);
console.log(`Scroll changed: ${scrollAfter > scrollBefore ? 'YES' : 'NO'}`);
console.log(`New Project button visible: ${isVisible}`);
console.log(`Dialog opens: check 06-dialog-open.png`);
console.log(`Collection created: check 07-collection-created.png`);

if (scrollAfter > scrollBefore && isVisible) {
  console.log('\n✅ ALL CHECKS PASSED');
} else {
  console.log('\n❌ SOME CHECKS FAILED');
  if (scrollAfter <= scrollBefore) console.log('   - Scroll did not work');
  if (!isVisible) console.log('   - New Project button not visible');
}

await browser.close();

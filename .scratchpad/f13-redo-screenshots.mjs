import playwright from '/scion-volumes/scratchpad/web-test/node_modules/playwright/index.js';

const { chromium } = playwright;

const outputDir = '/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--disable-crash-reporter'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function selectValue(select, option) {
  await select.click();
  await option.click();
}

async function selectLabel(select) {
  return await select.evaluate((element) => {
    const control = element.shadowRoot?.querySelector('[part="display-input"]');
    return (control instanceof HTMLInputElement ? control.value || control.placeholder : '');
  });
}

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded' });
  await page.locator('ft-toolbar').waitFor();

  const selects = page.locator('ft-toolbar sl-select');
  const phaseSelect = selects.nth(0);
  const assigneeSelect = selects.nth(1);
  const chips = page.locator('ft-filter-chips');


  await assert(await chips.isHidden(), 'Expected no active-filter chip row initially');
  await assert(await selectLabel(phaseSelect) === 'Phase', 'Expected Phase placeholder initially');
  await assert(await selectLabel(assigneeSelect) === 'Assignee', 'Expected Assignee placeholder initially');
  await page.screenshot({ path: `${outputDir}/01-no-filters.png`, fullPage: true });

  await selectValue(phaseSelect, page.locator('ft-toolbar sl-option[value="1"]'));
  await page.getByText('Phase: Open', { exact: false }).waitFor();
  await assert(await selectLabel(phaseSelect) === 'Open', 'Expected Phase selection to be Open');
  await assert(await page.getByText('Clear all', { exact: true }).count() === 0, 'Clear all must not appear with one filter');
  await page.screenshot({ path: `${outputDir}/02-one-filter-chip.png`, fullPage: true });

  const realUserOption = assigneeSelect.locator('sl-option').filter({ hasNotText: 'Unassigned' }).filter({ hasNotText: 'Loading users...' }).first();
  const assigneeLabel = (await realUserOption.textContent()).trim();
  await assert(Boolean(assigneeLabel), 'Expected a non-Unassigned user option');
  await selectValue(assigneeSelect, realUserOption);
  await page.getByText(`Assignee: ${assigneeLabel}`, { exact: false }).waitFor();
  await assert(await selectLabel(assigneeSelect) === assigneeLabel, 'Expected Assignee dropdown to show its selected user');
  await page.getByText('Clear all', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${outputDir}/03-two-filters-clear-all.png`, fullPage: true });

  await page.getByText('Clear all', { exact: true }).click();
  await chips.waitFor({ state: 'hidden' });
  await assert(await selectLabel(phaseSelect) === 'Phase', 'Expected Phase placeholder after clearing');
  await assert(await selectLabel(assigneeSelect) === 'Assignee', 'Expected Assignee placeholder after clearing');
  await page.screenshot({ path: `${outputDir}/04-post-clear.png`, fullPage: true });
} finally {
  await browser.close();
}

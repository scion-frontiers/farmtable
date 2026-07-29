import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const require = createRequire('/scion-volumes/scratchpad/web-test/package.json');
const { chromium } = require('playwright');

const url = 'https://farmtable-qo7k5fvpda-uc.a.run.app';
const screenshotPath =
  '/scion-volumes/scratchpad/projects/farmtable/reports/dashboard-screenshot.png';
const resultPath =
  '/scion-volumes/scratchpad/projects/farmtable/reports/dashboard-verification-result.json';

const consoleMessages = [];
const requestFailures = [];
const pageErrors = [];
const responses = [];

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  executablePath,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

page.on('console', (message) => {
  consoleMessages.push({
    type: message.type(),
    text: message.text(),
    location: message.location(),
  });
});

page.on('pageerror', (error) => {
  pageErrors.push({ name: error.name, message: error.message, stack: error.stack });
});

page.on('requestfailed', (request) => {
  requestFailures.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? null,
  });
});

page.on('response', (response) => {
  const status = response.status();
  const responseUrl = response.url();
  if (status >= 400 || responseUrl.includes('/farmtable.v1.FarmTableService/')) {
    responses.push({ url: responseUrl, status, statusText: response.statusText() });
  }
});

const mainResponse = await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
await page.waitForSelector('ft-app', { timeout: 30_000 });
await page.waitForFunction(() => customElements.get('ft-toolbar'), null, {
  timeout: 30_000,
});
await page.waitForFunction(
  () => document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-toolbar'),
  null,
  { timeout: 30_000 }
);

const domSummary = await page.evaluate(() => {
  function collectText(root) {
    if (!root) {
      return '';
    }

    const parts = [];
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          parts.push(text);
        }
        return;
      }

      const element = node instanceof Element ? node : null;
      if (element?.shadowRoot) {
        visit(element.shadowRoot);
      }

      for (const child of node.childNodes) {
        visit(child);
      }
    }

    visit(root);
    return parts.join(' ');
  }

  return {
    title: document.title,
    hasFtApp: Boolean(document.querySelector('ft-app')),
    hasFtToolbarDefinition: Boolean(customElements.get('ft-toolbar')),
    bodyText: document.body.innerText,
    ftAppShadowText: collectText(document.querySelector('ft-app')?.shadowRoot),
  };
});

await page.screenshot({ path: screenshotPath, fullPage: true });
await browser.close();

const result = {
  checkedAt: new Date().toISOString(),
  url,
  httpStatus: mainResponse?.status() ?? null,
  ok: mainResponse?.ok() ?? false,
  domSummary,
  consoleMessages,
  pageErrors,
  requestFailures,
  notableResponses: responses,
  screenshotPath,
  executablePath: executablePath ?? 'playwright-managed chromium',
};

await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

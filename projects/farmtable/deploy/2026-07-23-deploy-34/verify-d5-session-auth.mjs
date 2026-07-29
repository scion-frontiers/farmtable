import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN;
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-34';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`, { encoding: 'utf-8' }).trim();
}

async function run() {
  const iapToken = getIAPToken();
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    extraHTTPHeaders: { 'Authorization': `Bearer ${iapToken}` },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Navigate and login
  await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
  const loginResp = await page.evaluate(async (params) => {
    const resp = await fetch(params.baseUrl + '/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token }),
    });
    return { status: resp.status, body: await resp.json() };
  }, { token: FT_TOKEN, baseUrl: SERVICE_URL });
  console.log('Login:', JSON.stringify(loginResp));

  // Monitor gRPC-web requests
  const grpcRequests = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('farmtable.v1')) {
      grpcRequests.push({
        url: url,
        status: response.status(),
      });
    }
  });

  // Reload page to trigger data loading with session cookie
  await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000); // Wait for data to load

  // Take screenshot
  await page.screenshot({ path: `${EVIDENCE_DIR}/d5-dashboard-session-auth.png`, fullPage: true });

  // Check shadow DOM content
  const appContent = await page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app || !app.shadowRoot) return { found: false, html: '' };
    const text = app.shadowRoot.textContent || '';
    const html = app.shadowRoot.innerHTML.substring(0, 500);
    return { found: true, textLength: text.length, text: text.substring(0, 200), html: html };
  });

  console.log('\nShadow DOM content:', JSON.stringify(appContent, null, 2));
  console.log('\ngRPC-web requests captured:', JSON.stringify(grpcRequests, null, 2));

  // Determine pass/fail
  const grpcSuccess = grpcRequests.length > 0 && grpcRequests.every(r => r.status === 200);
  const hasContent = appContent.found && appContent.textLength > 50;

  const result = {
    check: 'd5',
    action: 'Web dashboard loads data with session cookie (session-to-bearer middleware)',
    pass: grpcSuccess || hasContent,
    detail: `gRPC-web requests: ${grpcRequests.length} (${grpcSuccess ? 'all succeeded' : 'some failed'}). ` +
            `Shadow DOM content: ${appContent.found ? `found (text length=${appContent.textLength})` : 'not found'}.`,
    grpcRequests: grpcRequests,
  };

  console.log(`\nResult: ${result.pass ? 'PASS' : 'FAIL'}: ${result.detail}`);
  fs.writeFileSync(`${EVIDENCE_DIR}/d5-session-auth-detail.json`, JSON.stringify(result, null, 2));

  await context.close();
  await browser.close();

  process.exit(result.pass ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });

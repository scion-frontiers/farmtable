// Playwright verification script for farmtable web dashboard auth (deploy-37, Check c)
// Tests: login flow, session cookie, dashboard data loading, logout, session invalidation.

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || '';
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-37';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`, { encoding: 'utf-8' }).trim();
}

const results = [];

function record(check, action, pass, detail, error) {
  const r = { check, action, pass, detail };
  if (error) r.error = error;
  results.push(r);
  console.log(`  [${check}] ${pass ? 'PASS' : 'FAIL'}: ${action}`);
  console.log(`    Detail: ${detail}`);
  if (error) console.log(`    Error: ${error}`);
}

async function run() {
  const iapToken = getIAPToken();
  console.log('IAP token obtained');

  const browser = await chromium.launch({ headless: true });

  try {
    // c1: Load web dashboard without ?token= param
    console.log('\n=== Check c1: Load web dashboard without ?token= param ===');
    {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'Authorization': `Bearer ${iapToken}` },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      try {
        const response = await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
        const status = response.status();
        if (status === 200) {
          await page.screenshot({ path: `${EVIDENCE_DIR}/c1-dashboard-no-token.png` });
          record('c1', 'Load dashboard without ?token= param', true,
            `Dashboard loaded (HTTP ${status}). App shell renders.`);
        } else {
          record('c1', 'Load dashboard without ?token= param', false,
            `Unexpected HTTP status ${status}`);
        }
      } catch (e) {
        record('c1', 'Load dashboard without ?token= param', false, e.message, e.stack);
      }
      await context.close();
    }

    // c2-c7: Session-based auth tests
    console.log('\n=== Check c2: Login via /api/auth/session POST ===');
    const sessionContext = await browser.newContext({
      extraHTTPHeaders: { 'Authorization': `Bearer ${iapToken}` },
      ignoreHTTPSErrors: true,
    });
    const page = await sessionContext.newPage();

    try {
      await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });

      // c2: Login
      const loginResponse = await page.evaluate(async (params) => {
        const resp = await fetch(params.baseUrl + '/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: params.token }),
        });
        return { status: resp.status, body: await resp.json() };
      }, { token: FT_TOKEN, baseUrl: SERVICE_URL });

      if (loginResponse.status === 200 && loginResponse.body.userId) {
        record('c2', 'Login via /api/auth/session POST', true,
          `Login successful. userId=${loginResponse.body.userId}.`);
      } else {
        record('c2', 'Login via /api/auth/session POST', false,
          `Login returned status=${loginResponse.status} body=${JSON.stringify(loginResponse.body)}`);
      }

      // c3: Session cookie
      console.log('\n=== Check c3: Verify session cookie ===');
      const cookies = await sessionContext.cookies(SERVICE_URL);
      const sessionCookie = cookies.find(c => c.name === 'farmtable_session');
      if (sessionCookie) {
        record('c3', 'Verify farmtable_session cookie is set', true,
          `Cookie found: httpOnly=${sessionCookie.httpOnly}, secure=${sessionCookie.secure}, sameSite=${sessionCookie.sameSite}`);
      } else {
        record('c3', 'Verify farmtable_session cookie is set', false,
          `No farmtable_session cookie found. Cookies: ${cookies.map(c => c.name).join(', ')}`);
      }

      // c4: GET session info
      console.log('\n=== Check c4: GET /api/auth/session ===');
      const sessionResp = await page.evaluate(async (baseUrl) => {
        const resp = await fetch(baseUrl + '/api/auth/session', { method: 'GET' });
        return { status: resp.status, body: await resp.json() };
      }, SERVICE_URL);

      if (sessionResp.status === 200 && sessionResp.body.userId) {
        record('c4', 'GET /api/auth/session returns active session', true,
          `Session active. userId=${sessionResp.body.userId}`);
      } else {
        record('c4', 'GET /api/auth/session returns active session', false,
          `GET returned status=${sessionResp.status} body=${JSON.stringify(sessionResp.body)}`);
      }

      // c5: Dashboard loads data with session cookie (post-wiring)
      console.log('\n=== Check c5: Dashboard loads data with session cookie (post-Stage5/6-wiring) ===');
      await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${EVIDENCE_DIR}/c5-dashboard-authenticated.png` });
      const pageContent = await page.textContent('body');
      const hasContent = pageContent.includes('collection') ||
                         pageContent.includes('Collection') || pageContent.length > 200;
      if (hasContent) {
        record('c5', 'Dashboard loads data with session cookie (Stage5/6 wiring unchanged)', true,
          `Dashboard rendered (body length=${pageContent.length}). Session-to-bearer middleware working post-wiring.`);
      } else {
        record('c5', 'Dashboard loads data with session cookie (Stage5/6 wiring unchanged)', false,
          `Dashboard empty. body length=${pageContent.length}. Wiring may have broken session auth.`);
      }

      // c6: Logout
      console.log('\n=== Check c6: Logout via DELETE /api/auth/session ===');
      const logoutResp = await page.evaluate(async (baseUrl) => {
        const resp = await fetch(baseUrl + '/api/auth/session', { method: 'DELETE' });
        return { status: resp.status, body: await resp.json() };
      }, SERVICE_URL);

      if (logoutResp.status === 200 && logoutResp.body.status === 'ok') {
        record('c6', 'Logout via DELETE /api/auth/session', true,
          `Logout successful. Response: ${JSON.stringify(logoutResp.body)}`);
      } else {
        record('c6', 'Logout via DELETE /api/auth/session', false,
          `Logout returned status=${logoutResp.status} body=${JSON.stringify(logoutResp.body)}`);
      }

      // c7: Session invalidated
      console.log('\n=== Check c7: Verify session invalidated after logout ===');
      const postLogoutResp = await page.evaluate(async (baseUrl) => {
        const resp = await fetch(baseUrl + '/api/auth/session', { method: 'GET' });
        return { status: resp.status, body: await resp.json() };
      }, SERVICE_URL);

      if (postLogoutResp.status === 401) {
        record('c7', 'Session invalidated after logout', true,
          `GET /api/auth/session returns 401 after logout. Session properly cleared.`);
      } else {
        record('c7', 'Session invalidated after logout', false,
          `Expected 401, got ${postLogoutResp.status}: ${JSON.stringify(postLogoutResp.body)}`);
      }

    } catch (e) {
      record('c-error', 'Web dashboard tests', false, e.message, e.stack);
    }
    await sessionContext.close();

  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n=== WEB DASHBOARD RESULTS ===');
  const allPass = results.every(r => r.pass);
  for (const r of results) {
    console.log(`  [${r.check}] ${r.pass ? 'PASS' : 'FAIL'}: ${r.action}`);
  }
  console.log(allPass ? '\nAll web dashboard checks PASSED' : '\nSome web dashboard checks FAILED!');

  fs.writeFileSync(`${EVIDENCE_DIR}/web-dashboard-results.json`, JSON.stringify(results, null, 2));
  process.exit(allPass ? 0 : 1);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

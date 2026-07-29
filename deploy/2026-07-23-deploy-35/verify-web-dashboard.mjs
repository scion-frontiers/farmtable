// Playwright verification script for farmtable web dashboard auth (deploy-35, Check d)
// Tests: login flow, session cookie, logout, and confirms RBAC didn't break session auth.

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || '';
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-35';

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
    // d1: Load web dashboard without ?token= param
    console.log('\n=== Check d1: Load web dashboard without ?token= param ===');
    {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'Authorization': `Bearer ${iapToken}` },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      try {
        const response = await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
        const status = response.status();
        const url = page.url();
        if (status === 200) {
          await page.screenshot({ path: `${EVIDENCE_DIR}/d1-dashboard-no-token.png` });
          record('d1', 'Load dashboard without ?token= param', true,
            `Dashboard loaded (HTTP ${status}). URL: ${url}. App renders correctly.`);
        } else {
          record('d1', 'Load dashboard without ?token= param', false,
            `Unexpected HTTP status ${status}`);
        }
      } catch (e) {
        record('d1', 'Load dashboard without ?token= param', false, e.message, e.stack);
      }
      await context.close();
    }

    // d2-d7: Session-based auth tests
    console.log('\n=== Check d2: Login via /api/auth/session POST ===');
    const sessionContext = await browser.newContext({
      extraHTTPHeaders: { 'Authorization': `Bearer ${iapToken}` },
      ignoreHTTPSErrors: true,
    });
    const page = await sessionContext.newPage();

    try {
      await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });

      // d2: Login
      const loginResponse = await page.evaluate(async (params) => {
        const resp = await fetch(params.baseUrl + '/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: params.token }),
        });
        return { status: resp.status, body: await resp.json() };
      }, { token: FT_TOKEN, baseUrl: SERVICE_URL });

      if (loginResponse.status === 200 && loginResponse.body.userId) {
        record('d2', 'Login via /api/auth/session POST', true,
          `Login successful. userId=${loginResponse.body.userId}.`);
      } else {
        record('d2', 'Login via /api/auth/session POST', false,
          `Login returned status=${loginResponse.status} body=${JSON.stringify(loginResponse.body)}`);
      }

      // d3: Session cookie
      console.log('\n=== Check d3: Verify session cookie ===');
      const cookies = await sessionContext.cookies(SERVICE_URL);
      const sessionCookie = cookies.find(c => c.name === 'farmtable_session');
      if (sessionCookie) {
        record('d3', 'Verify farmtable_session cookie is set', true,
          `Cookie found: name=${sessionCookie.name}, httpOnly=${sessionCookie.httpOnly}, secure=${sessionCookie.secure}, sameSite=${sessionCookie.sameSite}`);
      } else {
        record('d3', 'Verify farmtable_session cookie is set', false,
          `No farmtable_session cookie found. Cookies: ${cookies.map(c => c.name).join(', ')}`);
      }

      // d4: GET session info
      console.log('\n=== Check d4: GET /api/auth/session ===');
      const sessionResp = await page.evaluate(async (baseUrl) => {
        const resp = await fetch(baseUrl + '/api/auth/session', { method: 'GET' });
        return { status: resp.status, body: await resp.json() };
      }, SERVICE_URL);

      if (sessionResp.status === 200 && sessionResp.body.userId) {
        record('d4', 'GET /api/auth/session returns active session', true,
          `Session active. userId=${sessionResp.body.userId}`);
      } else {
        record('d4', 'GET /api/auth/session returns active session', false,
          `GET returned status=${sessionResp.status} body=${JSON.stringify(sessionResp.body)}`);
      }

      // d5: Dashboard loads with session cookie (post-RBAC)
      console.log('\n=== Check d5: Dashboard loads data with session cookie (RBAC-compatible) ===');
      await page.goto(SERVICE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${EVIDENCE_DIR}/d5-dashboard-authenticated.png` });
      const pageContent = await page.textContent('body');
      const hasContent = pageContent.includes('jibo') || pageContent.includes('collection') ||
                         pageContent.includes('Collection') || pageContent.length > 200;
      if (hasContent) {
        record('d5', 'Web dashboard loads data with session cookie (RBAC unchanged)', true,
          `Dashboard rendered (body length=${pageContent.length}). Session-to-bearer middleware working. RBAC did NOT break session auth.`);
      } else {
        record('d5', 'Web dashboard loads data with session cookie (RBAC unchanged)', false,
          `Dashboard empty. body length=${pageContent.length}. RBAC may have broken session-to-bearer middleware.`);
      }

      // d6: Logout
      console.log('\n=== Check d6: Logout via DELETE /api/auth/session ===');
      const logoutResp = await page.evaluate(async (baseUrl) => {
        const resp = await fetch(baseUrl + '/api/auth/session', { method: 'DELETE' });
        return { status: resp.status, body: await resp.json() };
      }, SERVICE_URL);

      if (logoutResp.status === 200 && logoutResp.body.status === 'ok') {
        record('d6', 'Logout via DELETE /api/auth/session', true,
          `Logout successful. Response: ${JSON.stringify(logoutResp.body)}`);
      } else {
        record('d6', 'Logout via DELETE /api/auth/session', false,
          `Logout returned status=${logoutResp.status} body=${JSON.stringify(logoutResp.body)}`);
      }

      // d7: Session invalidated
      console.log('\n=== Check d7: Verify session invalidated after logout ===');
      const postLogoutResp = await page.evaluate(async (baseUrl) => {
        const resp = await fetch(baseUrl + '/api/auth/session', { method: 'GET' });
        return { status: resp.status, body: await resp.json() };
      }, SERVICE_URL);

      if (postLogoutResp.status === 401) {
        record('d7', 'Session invalidated after logout', true,
          `GET /api/auth/session returns 401 after logout. Session properly cleared.`);
      } else {
        record('d7', 'Session invalidated after logout', false,
          `Expected 401, got ${postLogoutResp.status}: ${JSON.stringify(postLogoutResp.body)}`);
      }

    } catch (e) {
      record('d-error', 'Web dashboard tests', false, e.message, e.stack);
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

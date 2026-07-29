/**
 * Playwright script to capture the "after" screenshot with the Solo cross-edge fix.
 *
 * Starts a local Vite dev server with the fix applied, proxies API calls to the
 * live Cloud Run deployment, then navigates to the exact same repro scenario.
 */

import { chromium } from '/usr/local/share/npm-global/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
import { execSync, spawn } from 'child_process';
import fs from 'fs';

const CLOUD_RUN_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || execSync(
  'gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test',
  { encoding: 'utf-8' }
).trim();
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/reports/solo-crossedge-fix-evidence';

const COLLECTION_ID = '1e0f02d1-99cd-46bc-a739-bac0fde60710';
const TASK_ID = '717ab19c-e86f-4c51-8126-fc16a8f81ef7';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`, { encoding: 'utf-8' }).trim();
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const iapToken = getIAPToken();
  console.log('IAP token obtained');

  // Save original vite config and write one that proxies to Cloud Run
  const viteConfigPath = '/workspace/farmtable-fix-solo-crossedge/web/vite.config.ts';
  const originalConfig = fs.readFileSync(viteConfigPath, 'utf-8');

  const proxyConfig = `
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [{
        src: 'node_modules/@shoelace-style/shoelace/dist/assets/**/*',
        dest: 'shoelace/assets',
      }],
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      '/farmtable.v1': {
        target: '${CLOUD_RUN_URL}',
        changeOrigin: true,
        headers: {
          'Authorization': 'Bearer ${iapToken}',
        },
      },
      '/api': {
        target: '${CLOUD_RUN_URL}',
        changeOrigin: true,
        headers: {
          'Authorization': 'Bearer ${iapToken}',
        },
      },
    },
  },
});
`;

  // Write custom config BEFORE starting vite
  fs.writeFileSync(viteConfigPath, proxyConfig);

  console.log('Starting Vite dev server with proxy to Cloud Run...');
  const viteProcess = spawn('npx', ['--no-install', 'vite'], {
    cwd: '/workspace/farmtable-fix-solo-crossedge/web',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Wait for vite to start
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite timeout')), 30000);
    const onData = (data) => {
      const text = data.toString();
      console.log(`[vite] ${text.trim()}`);
      if (text.includes('Local:')) {
        clearTimeout(timeout);
        resolve();
      }
    };
    viteProcess.stdout.on('data', onData);
    viteProcess.stderr.on('data', onData);
    viteProcess.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });

  // Give vite a moment to finish
  await new Promise(r => setTimeout(r, 2000));

  const LOCAL_URL = 'http://localhost:5174';

  try {
    const browser = await chromium.launch({
      headless: true,
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('favicon.ico')) return;
        console.log(`[console.error] ${text}`);
      }
    });

    // Step 1: Login via API
    console.log('Step 1: Logging in...');
    await page.goto(LOCAL_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const loginResp = await page.evaluate(async (token) => {
      const resp = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return { status: resp.status, body: await resp.json().catch(() => null) };
    }, FT_TOKEN);
    console.log(`Login response: status=${loginResp.status}`);

    if (loginResp.status !== 200) {
      console.error('LOGIN FAILED');
      await browser.close();
      return;
    }

    // Step 2: Navigate to the dependency view with solo mode
    const targetUrl = `${LOCAL_URL}/?collection=${COLLECTION_ID}&view=dependencies&task=${TASK_ID}&solo=1`;
    console.log('Step 2: Navigating to dependency view with Solo mode (FIXED version)...');
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(6000);

    // Step 3: Check the dependency view state
    const depState = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return { error: 'no ft-app' };
      const depView = app.shadowRoot.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dependency view' };

      const totalLayoutNodes = depView.layoutNodes ? depView.layoutNodes.length : 0;
      const totalLayoutEdges = depView.layoutEdges ? depView.layoutEdges.length : 0;
      const isolateMode = depView.isolateMode;
      const selectedTaskId = depView.selectedTaskId;

      const svgContainer = depView.shadowRoot.querySelector('.canvas-container svg');
      const edgePaths = svgContainer?.querySelectorAll('path[class*="edge-dependency"]') || [];
      const domEdgeCount = edgePaths.length;

      const blockingEdges = [];
      const blockedEdges = [];
      const crossEdges = [];
      for (const path of edgePaths) {
        const classList = Array.from(path.classList);
        const info = { d: path.getAttribute('d')?.substring(0, 60), classList };
        if (classList.includes('edge-blocking')) {
          blockingEdges.push(info);
        } else if (classList.includes('edge-blocked')) {
          blockedEdges.push(info);
        } else {
          crossEdges.push(info);
        }
      }

      return {
        totalLayoutNodes,
        totalLayoutEdges,
        isolateMode,
        selectedTaskId,
        domEdgeCount,
        blockingEdgeCount: blockingEdges.length,
        blockedEdgeCount: blockedEdges.length,
        crossEdgeCount: crossEdges.length,
        crossEdges,
      };
    });

    console.log('\nDependency View State (AFTER fix):');
    console.log(JSON.stringify(depState, null, 2));

    // Take the after screenshot
    await page.screenshot({
      path: `${EVIDENCE_DIR}/after-solo-crossedge.png`,
      fullPage: false,
    });
    console.log(`\nScreenshot saved: ${EVIDENCE_DIR}/after-solo-crossedge.png`);

    // Save state data
    fs.writeFileSync(
      `${EVIDENCE_DIR}/after-state.json`,
      JSON.stringify(depState, null, 2)
    );

    // Verify the fix
    if (depState.crossEdgeCount === 0) {
      console.log('\n*** FIX VERIFIED: No cross-edges visible in Solo mode ***');
    } else {
      console.log(`\n*** FIX DID NOT WORK: Still ${depState.crossEdgeCount} cross-edge(s) ***`);
    }

    await browser.close();
  } finally {
    // Kill Vite and restore original config
    viteProcess.kill('SIGTERM');
    fs.writeFileSync(viteConfigPath, originalConfig);
    console.log('Restored original vite.config.ts');
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Script failed:', err);
  // Restore vite config on failure
  const viteConfigPath = '/workspace/farmtable-fix-solo-crossedge/web/vite.config.ts';
  const originalConfig = `import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [{
        src: 'node_modules/@shoelace-style/shoelace/dist/assets/**/*',
        dest: 'shoelace/assets',
      }],
    }),
  ],
  server: {
    proxy: {
      '/farmtable.v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
`;
  fs.writeFileSync(viteConfigPath, originalConfig);
  process.exit(1);
});

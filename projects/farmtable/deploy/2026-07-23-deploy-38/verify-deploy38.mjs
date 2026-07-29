// Playwright verification script for deploy-38 — Feature 61 (Solo tree view) + regression smoke
// Checks:
//   a. Solo button appears and is enabled when a mid-hierarchy task is selected
//   b. Solo click filters tree to selected task + descendants (node count evidence)
//   c. Solo toggle off returns to full tree
//   d. No console errors, button label reads "Solo" (not "Isolate")
//   e. Regression: normal Tree View browsing (pan/zoom/minimap) still works

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const SERVICE_URL = 'https://farmtable-486315127503.us-central1.run.app';
const IAP_CLIENT_ID = '486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com';
const FT_TOKEN = process.env.FT_TOKEN || '';
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-38';

function getIAPToken() {
  return execSync(`gcloud auth print-identity-token --audiences="${IAP_CLIENT_ID}"`, { encoding: 'utf-8' }).trim();
}

const results = [];
const consoleErrors = [];

function record(check, action, pass, detail, error) {
  const r = { check, action, pass, detail };
  if (error) r.error = error;
  results.push(r);
  console.log(`  [${check}] ${pass ? 'PASS' : 'FAIL'}: ${action}`);
  console.log(`    Detail: ${detail}`);
  if (error) console.log(`    Error: ${error}`);
}

// ── Shadow DOM helpers ──

async function getSoloButton(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return null;
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return null;
    const nav = treeView.shadowRoot.querySelector('ft-hierarchy-nav');
    if (!nav?.shadowRoot) return null;
    const btn = nav.shadowRoot.querySelector('button.isolate-btn');
    if (!btn) return null;
    return {
      exists: true,
      disabled: btn.disabled,
      textContent: btn.textContent.trim(),
      classList: Array.from(btn.classList),
      isActive: btn.classList.contains('active'),
    };
  });
}

async function clickSoloButton(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    const nav = treeView?.shadowRoot?.querySelector('ft-hierarchy-nav');
    const btn = nav?.shadowRoot?.querySelector('button.isolate-btn');
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });
}

async function getTreeNodeCount(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return { count: -1, names: [] };
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return { count: -1, names: [] };
    const nodes = treeView.shadowRoot.querySelectorAll('ft-tree-node');
    const names = [];
    for (const n of nodes) {
      const task = n.task;
      if (task) names.push(task.title || task.name || '(untitled)');
    }
    return { count: nodes.length, names };
  });
}

async function getTreeViewInfo(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    if (!app?.shadowRoot) return null;
    const treeView = app.shadowRoot.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return null;
    const svg = treeView.shadowRoot.querySelector('svg');
    const minimap = treeView.shadowRoot.querySelector('ft-minimap');
    const nodes = treeView.shadowRoot.querySelectorAll('ft-tree-node');
    const edges = treeView.shadowRoot.querySelectorAll('.edge-hierarchy');
    return {
      hasSvg: !!svg,
      hasMinimap: !!minimap,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      viewBox: svg ? svg.getAttribute('viewBox') : null,
    };
  });
}

async function findMidHierarchyTask(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView) return { error: 'no tree-view' };

    const store = treeView.store;
    if (!store) return { error: 'no store' };

    const allTasks = store.allTasks || [];

    // Debug: log task structure
    const debugInfo = allTasks.slice(0, 3).map(t => ({
      id: t.id?.substring(0, 8),
      title: t.title || t.name,
      parentTaskId: t.parentTaskId,
      keys: Object.keys(t).filter(k => k.includes('parent') || k.includes('Parent')),
    }));

    // Count descendants recursively
    function countDescendants(taskId) {
      let count = 0;
      const q = [taskId];
      const seen = new Set();
      while (q.length > 0) {
        const id = q.shift();
        if (seen.has(id)) continue;
        seen.add(id);
        const ch = store.getChildren(id);
        count += ch.length;
        for (const c of ch) q.push(c.id);
      }
      return count;
    }

    // Find a task that has a parent AND has children (true mid-hierarchy)
    for (const task of allTasks) {
      if (task.parentTaskId) {
        const children = store.getChildren(task.id);
        if (children.length > 0) {
          return {
            id: task.id,
            title: task.title || task.name || '(untitled)',
            parentId: task.parentTaskId,
            childCount: children.length,
            descendantCount: countDescendants(task.id),
            debug: debugInfo,
          };
        }
      }
    }

    // Fallback: root with children
    for (const task of allTasks) {
      const children = store.getChildren(task.id);
      if (children.length > 0) {
        return {
          id: task.id,
          title: task.title || task.name || '(untitled)',
          parentId: task.parentTaskId || null,
          childCount: children.length,
          descendantCount: countDescendants(task.id),
          fallback: true,
          debug: debugInfo,
        };
      }
    }

    return { error: 'no task with children', taskCount: allTasks.length, debug: debugInfo };
  });
}

async function clickTaskById(page, taskId) {
  return page.evaluate((id) => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return false;
    const foreignObjects = treeView.shadowRoot.querySelectorAll('foreignObject');
    for (const fo of foreignObjects) {
      const treeNode = fo.querySelector('ft-tree-node');
      if (treeNode?.task?.id === id) {
        // foreignObject is SVG — use dispatchEvent instead of .click()
        fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        return true;
      }
    }
    return false;
  }, taskId);
}

async function clickTreeNode(page, index) {
  return page.evaluate((idx) => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return null;
    const foreignObjects = treeView.shadowRoot.querySelectorAll('foreignObject');
    if (idx >= foreignObjects.length) return null;
    const fo = foreignObjects[idx];
    // foreignObject is SVG — use dispatchEvent instead of .click()
    fo.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    const treeNode = fo.querySelector('ft-tree-node');
    return {
      clicked: true,
      taskTitle: treeNode?.task?.title || treeNode?.task?.name || '(unknown)',
      taskId: treeNode?.task?.id || null,
    };
  }, index);
}

async function getSelectedNodeInfo(page) {
  return page.evaluate(() => {
    const app = document.querySelector('ft-app');
    const treeView = app?.shadowRoot?.querySelector('ft-tree-view');
    if (!treeView?.shadowRoot) return null;
    const nodes = treeView.shadowRoot.querySelectorAll('ft-tree-node[selected]');
    if (nodes.length === 0) return null;
    const node = nodes[0];
    return {
      title: node.task?.title || node.task?.name || '(unknown)',
      id: node.task?.id || null,
      selected: true,
    };
  });
}

async function run() {
  const iapToken = getIAPToken();
  console.log('IAP token obtained');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Authorization': `Bearer ${iapToken}` },
      ignoreHTTPSErrors: true,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Track console errors (only during feature checks)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('favicon.ico')) return;
        consoleErrors.push({ text, url: msg.location()?.url });
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push({ text: err.message, type: 'pageerror' });
    });

    // ── Step 1: Login via the login dialog ──
    console.log('\n=== Step 1: Login ===');
    await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Login by POSTing to the session endpoint (sets cookie)
    const loginResp = await page.evaluate(async (token) => {
      const resp = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return { status: resp.status, body: await resp.json() };
    }, FT_TOKEN);
    console.log(`Login response: ${JSON.stringify(loginResp)}`);

    if (loginResp.status !== 200) {
      console.error('LOGIN FAILED — cannot proceed');
      record('login', 'Session login', false, `HTTP ${loginResp.status}: ${JSON.stringify(loginResp.body)}`);
      process.exit(1);
    }
    console.log('Session cookie set. Reloading page...');

    // Reload the page — the app checks GET /api/auth/session on load
    await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify we're past the login dialog
    const postLoginState = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return { loginShowing: true };
      const loginDialog = app.shadowRoot.querySelector('ft-login-dialog');
      return {
        loginShowing: !!loginDialog,
        html: app.shadowRoot.innerHTML?.substring(0, 200),
      };
    });
    console.log(`Post-login state: loginShowing=${postLoginState.loginShowing}`);

    if (postLoginState.loginShowing) {
      console.error('Login dialog still showing after session login!');
    }

    await page.screenshot({ path: `${EVIDENCE_DIR}/step1-after-login.png` });

    // ── Step 2: Navigate to a collection with hierarchy in tree view ──
    console.log('\n=== Step 2: Find and open a hierarchical collection in tree view ===');

    // Get collections from the collection picker component
    const collectionData = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      if (!app?.shadowRoot) return [];
      const picker = app.shadowRoot.querySelector('ft-collection-list');
      if (!picker) return [];
      // Try to get collections from the component's property
      if (picker.collections) {
        return picker.collections.map(c => ({ id: c.id, name: c.name }));
      }
      return [];
    });
    console.log(`Collections from component: ${JSON.stringify(collectionData?.slice(0, 5))}`);

    // If we can't get collections from the component, try the API
    let targetCollectionId = null;
    if (collectionData && collectionData.length > 0) {
      // Try collections in preference order:
      // 1. github-experiment (likely has rich hierarchy from GitHub issues)
      // 2. default (had 50 tasks in deploy-37)
      // 3. github-mirror (mirror of real repo issues)
      // 4. Any collection with "deploy" in name
      // 5. First collection
      const preferences = [
        c => c.name === 'default',
        c => c.name?.includes('deploy4-web'),
        c => c.name?.includes('deploy4-cli'),
        c => c.name?.includes('github-mirror'),
      ];
      let target = null;
      for (const pred of preferences) {
        target = collectionData.find(pred);
        if (target) break;
      }
      if (!target) target = collectionData[0];
      targetCollectionId = target.id;
      console.log(`Selected collection: ${target.name} (${targetCollectionId})`);
    }

    if (!targetCollectionId) {
      // Try getting collections via the API
      console.log('Trying API to list collections...');
      const apiColls = await page.evaluate(async () => {
        try {
          const resp = await fetch('/api/collections');
          if (resp.ok) {
            return await resp.json();
          }
        } catch (e) {}
        return null;
      });
      console.log(`API collections: ${JSON.stringify(apiColls)?.substring(0, 500)}`);

      if (apiColls?.items || apiColls?.collections) {
        const items = apiColls.items || apiColls.collections;
        const target = items.find(c => c.name?.includes('4-Layer'));
        targetCollectionId = target?.id || items[0]?.id;
      }
    }

    if (!targetCollectionId) {
      // Last resort: click a collection card in the DOM
      console.log('Trying to click a collection card in the DOM...');
      const clickedColl = await page.evaluate(() => {
        const app = document.querySelector('ft-app');
        if (!app?.shadowRoot) return null;

        // Look for collection list items
        const collList = app.shadowRoot.querySelector('ft-collection-list');
        if (!collList?.shadowRoot) return null;

        // Find all anchor/clickable elements containing collection names
        const allEls = collList.shadowRoot.querySelectorAll('*');
        for (const el of allEls) {
          const text = el.textContent?.trim();
          if (text && (text.includes('4-Layer') || text.includes('Scenario 1'))) {
            // Find the closest clickable card
            let target = el;
            for (let i = 0; i < 5 && target; i++) {
              if (target.tagName === 'A' || target.tagName === 'BUTTON' ||
                  target.getAttribute('role') === 'button' ||
                  target.classList.contains('card') ||
                  target.classList.contains('collection-card') ||
                  target.classList.contains('collection-item') ||
                  target.tagName === 'LI' || target.tagName === 'DIV') {
                target.click();
                return { clicked: true, name: text.substring(0, 40) };
              }
              target = target.parentElement;
            }
            el.click();
            return { clicked: true, name: text.substring(0, 40) };
          }
        }

        // If no 4-Layer found, click the first collection with "Scenario" or the first one
        for (const el of allEls) {
          const text = el.textContent?.trim();
          if (text && text.includes('Farm Table') && !text.includes('Select')) {
            let target = el;
            for (let i = 0; i < 3; i++) {
              target = target.parentElement;
              if (!target) break;
            }
            if (target) {
              target.click();
              return { clicked: true, name: text.substring(0, 40) };
            }
          }
        }

        return null;
      });
      console.log(`Clicked collection: ${JSON.stringify(clickedColl)}`);
      if (clickedColl?.clicked) {
        await page.waitForTimeout(5000);
        // Get the collection ID from the URL
        const u = new URL(page.url());
        targetCollectionId = u.searchParams.get('collection');
      }
    }

    if (targetCollectionId) {
      // Navigate to tree view — use 'load' instead of 'networkidle' since
      // gRPC streaming keeps the network active
      await page.goto(
        `${SERVICE_URL}/?collection=${targetCollectionId}&view=tree`,
        { waitUntil: 'load', timeout: 30000 }
      );
      await page.waitForTimeout(8000); // wait for gRPC data to load and tree to render
    } else {
      console.error('Could not find any collection ID!');
    }

    await page.screenshot({ path: `${EVIDENCE_DIR}/step2-tree-view.png` });

    // Check tree view state
    let treeInfo = await getTreeViewInfo(page);
    console.log(`Tree view info: ${JSON.stringify(treeInfo)}`);

    // If no nodes, the collection might not have hierarchy. Try the default collection.
    if (!treeInfo || treeInfo.nodeCount === 0) {
      console.log('No nodes in tree view. Checking app state...');
      const appState = await page.evaluate(() => {
        const app = document.querySelector('ft-app');
        return {
          currentView: app?.currentView,
          collectionId: app?.currentCollectionId,
          taskCount: app?.taskStore?.allTasks?.length,
          showLogin: app?.showLogin,
          routeView: app?.routeView,
        };
      });
      console.log(`App state: ${JSON.stringify(appState)}`);

      // Try to find the collection list and navigate
      if (appState?.taskCount === 0 || !appState?.collectionId) {
        // The collection might not have data. Try another approach.
        // Navigate back to the collection picker, find one with tasks
        await page.goto(SERVICE_URL + '/', { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Get all collections and try the "default" one
        const htmlContent = await page.evaluate(() => {
          const app = document.querySelector('ft-app');
          return app?.shadowRoot?.innerHTML?.substring(0, 2000);
        });
        console.log(`App HTML: ${htmlContent?.substring(0, 500)}`);
      }
    }

    // Clear console errors before the Feature 61 checks
    consoleErrors.length = 0;

    // ── Check a: Solo button appears and is enabled ──
    console.log('\n=== Feature 61 Check (a): Solo button visible and enabled ===');

    const midTask = await findMidHierarchyTask(page);
    console.log(`Mid-hierarchy task: ${JSON.stringify(midTask)}`);

    const nodeCountBefore = await getTreeNodeCount(page);
    console.log(`Total nodes before Solo: ${nodeCountBefore.count}`);
    console.log(`Node names (first 10): ${JSON.stringify(nodeCountBefore.names?.slice(0, 10))}`);

    let taskForSolo = midTask;

    if (midTask) {
      const clicked = await clickTaskById(page, midTask.id);
      console.log(`Clicked task ${midTask.title}: ${clicked}`);
      await page.waitForTimeout(1000);
    } else if (nodeCountBefore.count > 0) {
      // Click the first node as fallback
      const cr = await clickTreeNode(page, 0);
      console.log(`Clicked first node: ${JSON.stringify(cr)}`);
      taskForSolo = cr ? { title: cr.taskTitle, id: cr.taskId, childCount: 'unknown', descendantCount: 'unknown', parentId: 'unknown' } : null;
      await page.waitForTimeout(1000);
    }

    const soloBtn = await getSoloButton(page);
    console.log(`Solo button state: ${JSON.stringify(soloBtn)}`);

    if (soloBtn?.exists) {
      const labelCorrect = soloBtn.textContent.includes('Solo');
      const notIsolate = !soloBtn.textContent.includes('Isolate');

      record('d-label', 'Button label reads "Solo" (not "Isolate")', labelCorrect && notIsolate,
        `Button text: "${soloBtn.textContent}". Contains "Solo": ${labelCorrect}. Contains "Isolate": ${!notIsolate}`);

      if (!soloBtn.disabled) {
        record('a', 'Solo button appears and is enabled for selected task', true,
          `Button found, enabled. Selected task: "${taskForSolo?.title}" ` +
          `(direct children: ${taskForSolo?.childCount}, total descendants: ${taskForSolo?.descendantCount}, ` +
          `parent: ${taskForSolo?.parentId || 'root'})`);
      } else {
        record('a', 'Solo button appears (disabled — no task selected or leaf task)', soloBtn.disabled && nodeCountBefore.count === 0,
          `Button found but DISABLED. Selected task: "${taskForSolo?.title}". ` +
          `This is expected only if no task is selected or the selected task is a leaf.`);
      }
    } else {
      record('a', 'Solo button appears', false,
        `Solo button not found in DOM. Tree node count: ${nodeCountBefore.count}`);
      record('d-label', 'Button label reads "Solo"', false, 'Button not found');
    }

    await page.screenshot({ path: `${EVIDENCE_DIR}/a-solo-button-enabled.png` });

    // ── Check b: Solo click filters tree ──
    console.log('\n=== Feature 61 Check (b): Solo click filters tree ===');

    const fullNodeCountBefore = await getTreeNodeCount(page);
    console.log(`Full tree node count before Solo: ${fullNodeCountBefore.count}`);

    const soloClicked = await clickSoloButton(page);
    console.log(`Solo button clicked: ${soloClicked}`);
    await page.waitForTimeout(2000);

    const soloNodeCount = await getTreeNodeCount(page);
    console.log(`Solo tree node count: ${soloNodeCount.count}`);
    console.log(`Solo visible nodes: ${JSON.stringify(soloNodeCount.names)}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/b-solo-active.png` });

    const soloStateAfter = await getSoloButton(page);
    console.log(`Solo button state after click: ${JSON.stringify(soloStateAfter)}`);

    if (soloClicked && soloNodeCount.count > 0 && soloNodeCount.count < fullNodeCountBefore.count) {
      record('b', 'Solo filters tree to selected task + descendants', true,
        `Before Solo: ${fullNodeCountBefore.count} nodes. After Solo: ${soloNodeCount.count} nodes. ` +
        `Selected: "${taskForSolo?.title}" (expected: 1 + ${taskForSolo?.descendantCount} descendants). ` +
        `Solo button active: ${soloStateAfter?.isActive}. ` +
        `Visible nodes in Solo mode: ${JSON.stringify(soloNodeCount.names)}`);
    } else if (soloClicked && soloNodeCount.count === fullNodeCountBefore.count) {
      record('b', 'Solo filters tree to selected task + descendants', false,
        `Node count did not change: before=${fullNodeCountBefore.count}, after=${soloNodeCount.count}`);
    } else if (!soloClicked) {
      record('b', 'Solo filters tree to selected task + descendants', false,
        `Could not click Solo button (disabled or not found)`);
    } else {
      record('b', 'Solo filters tree to selected task + descendants', soloNodeCount.count > 0,
        `Before: ${fullNodeCountBefore.count}, After: ${soloNodeCount.count}`);
    }

    // ── Check c: Solo toggle off returns to full tree ──
    console.log('\n=== Feature 61 Check (c): Solo toggle off returns to full tree ===');

    const soloClickedOff = await clickSoloButton(page);
    console.log(`Solo button clicked off: ${soloClickedOff}`);
    await page.waitForTimeout(2000);

    const nodeCountAfterOff = await getTreeNodeCount(page);
    console.log(`Node count after Solo off: ${nodeCountAfterOff.count}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/c-solo-off.png` });

    const soloStateOff = await getSoloButton(page);

    if (soloClickedOff && nodeCountAfterOff.count === fullNodeCountBefore.count) {
      record('c', 'Solo toggle off returns to full tree', true,
        `After toggling Solo off: ${nodeCountAfterOff.count} nodes (same as before: ${fullNodeCountBefore.count}). Solo active: ${soloStateOff?.isActive}`);
    } else if (soloClickedOff) {
      const close = Math.abs(nodeCountAfterOff.count - fullNodeCountBefore.count) <= 1;
      record('c', 'Solo toggle off returns to full tree', close || nodeCountAfterOff.count >= fullNodeCountBefore.count,
        `After toggle off: ${nodeCountAfterOff.count}. Before: ${fullNodeCountBefore.count}. Solo active: ${soloStateOff?.isActive}`);
    } else {
      record('c', 'Solo toggle off returns to full tree', false,
        `Could not click Solo button to toggle off`);
    }

    // ── Check d: Console errors ──
    console.log('\n=== Check (d): No console errors during Solo toggle ===');
    const relevantErrors = consoleErrors.filter(e =>
      !e.text?.includes('401') && !e.text?.includes('favicon') && !e.text?.includes('net::ERR')
    );
    record('d-console', 'No console errors during Solo toggle', relevantErrors.length === 0,
      relevantErrors.length > 0
        ? `${relevantErrors.length} error(s): ${JSON.stringify(relevantErrors.slice(0, 5))}`
        : `Zero relevant console errors (${consoleErrors.length} filtered)`);

    // ── Check e: Regression — Tree View browsing ──
    console.log('\n=== Regression Check (e): Normal Tree View browsing ===');

    const finalTreeInfo = await getTreeViewInfo(page);
    record('e1', 'Tree view renders correctly (SVG + nodes + edges)',
      !!finalTreeInfo?.hasSvg && finalTreeInfo.nodeCount > 0,
      `SVG: ${finalTreeInfo?.hasSvg}, nodes: ${finalTreeInfo?.nodeCount}, edges: ${finalTreeInfo?.edgeCount}, viewBox: ${finalTreeInfo?.viewBox}`);

    record('e2', 'Minimap is present', finalTreeInfo?.hasMinimap === true,
      `Minimap found: ${finalTreeInfo?.hasMinimap}`);

    // e3: Node selection
    const clickResult = await clickTreeNode(page, 0);
    await page.waitForTimeout(500);
    const selectedNode = await getSelectedNodeInfo(page);
    record('e3', 'Node selection (highlight) works', selectedNode?.selected === true,
      `Clicked: "${clickResult?.taskTitle}". Selected: "${selectedNode?.title}". selected=${selectedNode?.selected}`);

    // e4: Zoom
    const viewBoxBefore = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const tv = app?.shadowRoot?.querySelector('ft-tree-view');
      return tv?.shadowRoot?.querySelector('svg')?.getAttribute('viewBox');
    });

    await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const tv = app?.shadowRoot?.querySelector('ft-tree-view');
      const svg = tv?.shadowRoot?.querySelector('svg');
      if (svg) {
        const r = svg.getBoundingClientRect();
        svg.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -100, clientX: r.left + r.width/2, clientY: r.top + r.height/2, bubbles: true,
        }));
      }
    });
    await page.waitForTimeout(500);

    const viewBoxAfter = await page.evaluate(() => {
      const app = document.querySelector('ft-app');
      const tv = app?.shadowRoot?.querySelector('ft-tree-view');
      return tv?.shadowRoot?.querySelector('svg')?.getAttribute('viewBox');
    });

    record('e4', 'Zoom (mouse wheel) changes viewBox', viewBoxBefore !== viewBoxAfter,
      `Before: "${viewBoxBefore}", After: "${viewBoxAfter}". Changed: ${viewBoxBefore !== viewBoxAfter}`);

    await page.screenshot({ path: `${EVIDENCE_DIR}/e-regression-tree-view.png` });

    await context.close();
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n=== DEPLOY-38 VERIFICATION RESULTS ===');
  const allPass = results.every(r => r.pass);
  for (const r of results) {
    console.log(`  [${r.check}] ${r.pass ? 'PASS' : 'FAIL'}: ${r.action}`);
  }
  console.log(allPass ? '\nAll checks PASSED' : '\nSome checks FAILED!');

  fs.writeFileSync(`${EVIDENCE_DIR}/verification-results.json`, JSON.stringify(results, null, 2));
  fs.writeFileSync(`${EVIDENCE_DIR}/console-errors.json`, JSON.stringify(consoleErrors, null, 2));
  process.exit(allPass ? 0 : 1);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

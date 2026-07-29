import puppeteer from 'puppeteer';

const COLLECTION_ID = 'a1b1b649-3e4f-487c-a592-6190da840bef'; // 3800-task collection
const BASE_URL = 'http://localhost:5173';

async function measure() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const url = `${BASE_URL}/?collection=${COLLECTION_ID}&view=dependencies`;
    console.log(`Navigating to 3800-task collection: ${url}`);
    
    // Measure initial load time
    const loadStart = performance.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for data to load and render — poll for layoutNodes
    let loadComplete = false;
    let pollCount = 0;
    while (!loadComplete && pollCount < 60) {
      await new Promise(r => setTimeout(r, 1000));
      pollCount++;
      const state = await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
        return {
          hasDepView: !!depView,
          layoutNodeCount: depView?.layoutNodes?.length ?? 0,
          hasSvg: !!depView?.shadowRoot?.querySelector('svg'),
        };
      });
      if (state.layoutNodeCount > 0) {
        loadComplete = true;
        const loadTime = performance.now() - loadStart;
        console.log(`Data loaded and rendered in ${loadTime.toFixed(0)}ms (${pollCount}s polling)`);
        console.log(`Layout nodes: ${state.layoutNodeCount}`);
      }
    }

    if (!loadComplete) {
      console.log('TIMEOUT: Data did not load within 60s');
      await page.screenshot({ path: '/tmp/perf-large-timeout.png' });
      return;
    }

    // Wait for centering animation to complete
    await new Promise(r => setTimeout(r, 2000));

    // ─── Baseline metrics at zoom-to-fit ───
    const baselineMetrics = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dep view' };
      const sr = depView.shadowRoot;
      return {
        totalLayoutNodes: depView.layoutNodes?.length ?? 0,
        totalLayoutEdges: depView.layoutEdges?.length ?? 0,
        renderedDOMNodes: sr.querySelectorAll('foreignObject').length,
        renderedDOMEdges: sr.querySelectorAll('path').length,
        scale: depView.scale?.toFixed(4),
        containerWidth: depView.containerWidth,
        containerHeight: depView.containerHeight,
      };
    });
    console.log('\n=== Zoom-to-fit Baseline ===');
    console.log(JSON.stringify(baselineMetrics, null, 2));
    await page.screenshot({ path: '/tmp/perf-large-baseline.png' });

    // ─── Zoom in to scale=1.0 to activate culling ───
    console.log('\n=== Zooming in to scale=1.0 ===');
    const culledMetrics = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView) return { error: 'no dep view' };

      depView.scale = 1.0;
      depView.panX = 0;
      depView.panY = 0;

      return new Promise((resolve) => {
        depView.requestUpdate();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const sr = depView.shadowRoot;
            const totalNodes = depView.layoutNodes?.length ?? 0;
            const renderedNodes = sr.querySelectorAll('foreignObject').length;
            resolve({
              totalLayoutNodes: totalNodes,
              totalLayoutEdges: depView.layoutEdges?.length ?? 0,
              renderedDOMNodes: renderedNodes,
              renderedDOMEdges: sr.querySelectorAll('path').length,
              culledNodes: totalNodes - renderedNodes,
              cullingRatio: totalNodes > 0
                ? ((1 - renderedNodes / totalNodes) * 100).toFixed(1) + '%'
                : 'N/A',
            });
          });
        });
      });
    });
    console.log(JSON.stringify(culledMetrics, null, 2));
    await page.screenshot({ path: '/tmp/perf-large-zoomed.png' });

    // ─── Re-render performance (measures render with culling) ───
    console.log('\n=== Re-render Performance (store-triggered, includes layout) ===');
    const renderPerf = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ftApp = document.querySelector('ft-app');
        const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
        if (!depView) { resolve({ error: 'no dep view' }); return; }

        const times = [];
        let count = 0;

        function measureOne() {
          const start = performance.now();
          // This triggers with empty changedProperties (store-like update)
          // so runLayout() + structureKey() WILL run — measures full render cost
          depView.requestUpdate();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              times.push(performance.now() - start);
              count++;
              if (count < 15) {
                measureOne();
              } else {
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                resolve({
                  avgRenderTime: avg.toFixed(2) + 'ms',
                  maxRenderTime: Math.max(...times).toFixed(2) + 'ms',
                  minRenderTime: Math.min(...times).toFixed(2) + 'ms',
                  estimatedFPS: (1000 / avg).toFixed(1),
                  samples: times.length,
                  note: 'Includes runLayout() + structureKey() (store-triggered update)',
                });
              }
            });
          });
        }
        measureOne();
      });
    });
    console.log(JSON.stringify(renderPerf, null, 2));

    // ─── Pan performance (layout guard active) ───
    console.log('\n=== Pan Performance (layout guard skips structureKey) ===');
    const panPerf = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ftApp = document.querySelector('ft-app');
        const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
        if (!depView) { resolve({ error: 'no dep view' }); return; }

        const times = [];
        let count = 0;
        const totalFrames = 30;

        function measurePanFrame() {
          const start = performance.now();
          // panX is @state() — changing it triggers willUpdate with panX in changedProperties
          // Layout guard skips runLayout() for pan-only changes
          depView.panX = (depView.panX || 0) + 20;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              times.push(performance.now() - start);
              count++;
              if (count < totalFrames) {
                measurePanFrame();
              } else {
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                resolve({
                  avgFrameTime: avg.toFixed(2) + 'ms',
                  maxFrameTime: Math.max(...times).toFixed(2) + 'ms',
                  minFrameTime: Math.min(...times).toFixed(2) + 'ms',
                  estimatedFPS: (1000 / avg).toFixed(1),
                  samples: times.length,
                  note: 'Pan at scale=1.0, layout guard active (structureKey skipped)',
                });
              }
            });
          });
        }
        measurePanFrame();
      });
    });
    console.log(JSON.stringify(panPerf, null, 2));

    // ─── Minimap verification ───
    const minimapMetrics = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      const minimap = depView?.shadowRoot?.querySelector('ft-minimap');
      if (!minimap?.shadowRoot) return { error: 'No minimap' };
      const sr = minimap.shadowRoot;
      return {
        minimapNodes: sr.querySelectorAll('.minimap-nodes rect').length,
        minimapEdges: sr.querySelectorAll('.minimap-edges path').length,
      };
    });
    console.log('\n=== Minimap (should show all nodes) ===');
    console.log(JSON.stringify(minimapMetrics, null, 2));

    await page.screenshot({ path: '/tmp/perf-large-after-pan.png' });
    console.log('\nAll measurements complete');

  } finally {
    await browser.close();
  }
}

measure().catch(err => { console.error('Error:', err.message); process.exit(1); });

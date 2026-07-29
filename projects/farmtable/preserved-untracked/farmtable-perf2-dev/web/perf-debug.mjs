import puppeteer from 'puppeteer';

const COLLECTION_ID = 'a1b1b649-3e4f-487c-a592-6190da840bef';
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for data to load
    let loaded = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const state = await page.evaluate(() => {
        const depView = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
        return depView?.layoutNodes?.length ?? 0;
      });
      if (state > 0) { loaded = true; break; }
    }
    if (!loaded) { console.log('TIMEOUT'); return; }
    await new Promise(r => setTimeout(r, 3000));

    // Zoom in
    await page.evaluate(() => {
      const depView = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      depView.scale = 1.0;
      depView.panX = 0;
      depView.panY = 0;
    });
    await new Promise(r => setTimeout(r, 2000));

    // Instrument willUpdate to measure if layout guard is working
    console.log('=== Testing layout guard directly ===');
    const guardTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        const depView = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
        if (!depView) { resolve({ error: 'no dep view' }); return; }

        // Monkey-patch runLayout to count calls
        let layoutCalls = 0;
        const origRunLayout = depView.runLayout.bind(depView);
        depView.runLayout = function() { layoutCalls++; return origRunLayout(); };

        // Also patch structureKey
        let structureKeyCalls = 0;
        const origStructureKey = depView.structureKey.bind(depView);
        depView.structureKey = function(...args) { structureKeyCalls++; return origStructureKey(...args); };

        // Now do 10 pan frames
        const times = [];
        let count = 0;

        function doPan() {
          const layoutBefore = layoutCalls;
          const skBefore = structureKeyCalls;
          const start = performance.now();
          depView.panX += 20;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const elapsed = performance.now() - start;
              times.push({
                frameTime: elapsed.toFixed(2),
                layoutCallsDuringFrame: layoutCalls - layoutBefore,
                structureKeyCallsDuringFrame: structureKeyCalls - skBefore,
              });
              count++;
              if (count < 10) {
                doPan();
              } else {
                // Restore
                depView.runLayout = origRunLayout;
                depView.structureKey = origStructureKey;
                
                const avgTime = times.reduce((a, t) => a + parseFloat(t.frameTime), 0) / times.length;
                resolve({
                  totalLayoutCalls: layoutCalls,
                  totalStructureKeyCalls: structureKeyCalls,
                  perFrameDetails: times,
                  avgFrameTime: avgTime.toFixed(2) + 'ms',
                  note: 'layoutCalls=0 means guard is working',
                });
              }
            });
          });
        }
        doPan();
      });
    });
    console.log(JSON.stringify(guardTest, null, 2));

  } finally {
    await browser.close();
  }
}

measure().catch(err => { console.error('Error:', err.message); process.exit(1); });

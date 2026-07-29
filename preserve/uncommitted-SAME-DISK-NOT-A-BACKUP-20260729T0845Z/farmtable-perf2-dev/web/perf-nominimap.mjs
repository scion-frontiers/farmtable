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

    await page.goto(`${BASE_URL}/?collection=${COLLECTION_ID}&view=dependencies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const n = await page.evaluate(() => document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view')?.layoutNodes?.length ?? 0);
      if (n > 0) break;
    }
    await new Promise(r => setTimeout(r, 3000));

    // Zoom in
    await page.evaluate(() => {
      const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      dv.scale = 1.0; dv.panX = 0; dv.panY = 0;
    });
    await new Promise(r => setTimeout(r, 2000));

    // Test 1: Pan WITH minimap (normal)
    console.log('=== Pan WITH minimap (3800 nodes) ===');
    const withMinimap = await page.evaluate(() => {
      return new Promise((resolve) => {
        const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
        const times = [];
        let c = 0;
        function go() {
          const s = performance.now();
          dv.panX += 20;
          requestAnimationFrame(() => { requestAnimationFrame(() => {
            times.push(performance.now() - s);
            c++;
            if (c < 10) go();
            else {
              const avg = times.reduce((a,b)=>a+b,0)/times.length;
              resolve({ avgMs: avg.toFixed(1), minMs: Math.min(...times).toFixed(1), maxMs: Math.max(...times).toFixed(1) });
            }
          }); });
        }
        go();
      });
    });
    console.log(JSON.stringify(withMinimap));

    // Test 2: Pan WITHOUT minimap (hide it)
    console.log('\n=== Pan WITHOUT minimap (hidden) ===');
    await page.evaluate(() => {
      const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      const minimap = dv?.shadowRoot?.querySelector('ft-minimap');
      if (minimap) minimap.style.display = 'none';
    });
    await new Promise(r => setTimeout(r, 500));

    const withoutMinimap = await page.evaluate(() => {
      return new Promise((resolve) => {
        const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
        const times = [];
        let c = 0;
        function go() {
          const s = performance.now();
          dv.panX += 20;
          requestAnimationFrame(() => { requestAnimationFrame(() => {
            times.push(performance.now() - s);
            c++;
            if (c < 10) go();
            else {
              const avg = times.reduce((a,b)=>a+b,0)/times.length;
              resolve({ avgMs: avg.toFixed(1), minMs: Math.min(...times).toFixed(1), maxMs: Math.max(...times).toFixed(1) });
            }
          }); });
        }
        go();
      });
    });
    console.log(JSON.stringify(withoutMinimap));

    // Also check the visible edge count - maybe that's the issue
    const edgeInfo = await page.evaluate(() => {
      const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      const sr = dv?.shadowRoot;
      return {
        renderedPaths: sr?.querySelectorAll('path').length ?? 0,
        renderedFOs: sr?.querySelectorAll('foreignObject').length ?? 0,
      };
    });
    console.log('\nRendered elements:', JSON.stringify(edgeInfo));

  } finally {
    await browser.close();
  }
}

measure().catch(err => { console.error('Error:', err.message); process.exit(1); });

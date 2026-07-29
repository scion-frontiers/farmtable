import puppeteer from 'puppeteer';

const COLLECTION_ID = 'a1b1b649-3e4f-487c-a592-6190da840bef';
const BASE_URL = 'http://localhost:5173';

async function measure() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/?collection=${COLLECTION_ID}&view=dependencies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 1000)); const n = await page.evaluate(() => document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view')?.layoutNodes?.length ?? 0); if (n > 0) break; }
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => { const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view'); dv.scale = 1.0; dv.panX = 0; dv.panY = 0; });
    await new Promise(r => setTimeout(r, 2000));

    // Measure JS execution time vs total frame time
    console.log('=== JS vs Total Frame Breakdown (3800 nodes) ===');
    const breakdown = await page.evaluate(() => {
      return new Promise((resolve) => {
        const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
        const results = [];
        let c = 0;

        function go() {
          // Measure only JS work: filter + template construction
          const jsStart = performance.now();
          
          // Manually compute what render() does
          const vbW = dv.containerWidth / dv.scale;
          const vbH = dv.containerHeight / dv.scale;
          const margin = 220;
          const vpL = dv.panX - margin, vpR = dv.panX + vbW + margin;
          const vpT = dv.panY - margin, vpB = dv.panY + vbH + margin;
          
          const visNodes = dv.layoutNodes.filter(n => 
            n.x + n.width/2 > vpL && n.x - n.width/2 < vpR &&
            n.y + n.height/2 > vpT && n.y - n.height/2 < vpB
          );
          const visNodeIds = new Set(visNodes.map(n => n.id));
          const visEdges = dv.layoutEdges.filter(e => visNodeIds.has(e.from) || visNodeIds.has(e.to));
          
          const jsTime = performance.now() - jsStart;

          // Now measure actual frame update
          const frameStart = performance.now();
          dv.panX += 20;
          requestAnimationFrame(() => { requestAnimationFrame(() => {
            const frameTime = performance.now() - frameStart;
            results.push({
              jsFilterMs: jsTime.toFixed(3),
              totalFrameMs: frameTime.toFixed(1),
              visNodes: visNodes.length,
              visEdges: visEdges.length,
            });
            c++;
            if (c < 10) go();
            else resolve({
              results,
              avgJsFilter: (results.reduce((a,r) => a + parseFloat(r.jsFilterMs), 0) / results.length).toFixed(3) + 'ms',
              avgFrame: (results.reduce((a,r) => a + parseFloat(r.totalFrameMs), 0) / results.length).toFixed(1) + 'ms',
            });
          }); });
        }
        go();
      });
    });
    console.log(JSON.stringify(breakdown, null, 2));

    // Also test: what if we reduce edge count by using stricter culling?
    console.log('\n=== Edge analysis ===');
    const edgeAnalysis = await page.evaluate(() => {
      const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      const vbW = dv.containerWidth / dv.scale;
      const vbH = dv.containerHeight / dv.scale;
      const margin = 220;
      const vpL = dv.panX - margin, vpR = dv.panX + vbW + margin;
      const vpT = dv.panY - margin, vpB = dv.panY + vbH + margin;
      
      const visNodes = dv.layoutNodes.filter(n => 
        n.x + n.width/2 > vpL && n.x - n.width/2 < vpR &&
        n.y + n.height/2 > vpT && n.y - n.height/2 < vpB
      );
      const visNodeIds = new Set(visNodes.map(n => n.id));
      
      // Count edges by type
      let bothVisible = 0, oneVisible = 0, noneVisible = 0;
      for (const e of dv.layoutEdges) {
        const fromVis = visNodeIds.has(e.from);
        const toVis = visNodeIds.has(e.to);
        if (fromVis && toVis) bothVisible++;
        else if (fromVis || toVis) oneVisible++;
        else noneVisible++;
      }
      
      return {
        totalEdges: dv.layoutEdges.length,
        bothEndpointsVisible: bothVisible,
        oneEndpointVisible: oneVisible,
        neitherVisible: noneVisible,
        totalRendered: bothVisible + oneVisible,
        visibleNodes: visNodes.length,
      };
    });
    console.log(JSON.stringify(edgeAnalysis, null, 2));

  } finally { await browser.close(); }
}

measure().catch(err => { console.error('Error:', err.message); process.exit(1); });

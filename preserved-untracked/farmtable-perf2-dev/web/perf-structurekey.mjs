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

    // Measure structureKey cost directly
    console.log('=== structureKey() cost at 3800 nodes ===');
    const skCost = await page.evaluate(() => {
      const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      const tasks = dv.getVisibleTasks();
      
      const times = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const key = dv.structureKey(tasks);
        times.push(performance.now() - start);
      }
      
      const avg = times.reduce((a,b) => a + b, 0) / times.length;
      // Get the key size
      const tasks2 = dv.getVisibleTasks();
      const key = dv.structureKey(tasks2);
      
      return {
        taskCount: tasks.length,
        structureKeySize: key.length,
        structureKeySizeKB: (key.length / 1024).toFixed(1) + 'KB',
        avgStructureKeyMs: avg.toFixed(2) + 'ms',
        perCallTimes: times.map(t => t.toFixed(2) + 'ms'),
        note: 'This would run on EVERY pan frame without the layout guard',
      };
    });
    console.log(JSON.stringify(skCost, null, 2));

    // Measure getVisibleTasks cost
    console.log('\n=== getVisibleTasks() cost at 3800 nodes ===');
    const gvtCost = await page.evaluate(() => {
      const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      const times = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const tasks = dv.getVisibleTasks();
        times.push(performance.now() - start);
      }
      const avg = times.reduce((a,b) => a + b, 0) / times.length;
      return {
        avgMs: avg.toFixed(2) + 'ms',
        perCallTimes: times.map(t => t.toFixed(2) + 'ms'),
      };
    });
    console.log(JSON.stringify(gvtCost, null, 2));

    // Total pre-fix per-frame cost (what would happen without the guard)
    console.log('\n=== Simulated pre-fix per-frame cost (structureKey + getVisibleTasks on every frame) ===');
    const prefixCost = await page.evaluate(() => {
      const dv = document.querySelector('ft-app')?.shadowRoot?.querySelector('ft-dependency-view');
      const times = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const tasks = dv.getVisibleTasks();
        dv.structureKey(tasks);
        times.push(performance.now() - start);
      }
      const avg = times.reduce((a,b) => a + b, 0) / times.length;
      const fps = 1000 / avg;
      return {
        avgMs: avg.toFixed(2) + 'ms',
        estimatedMaxFPS: fps.toFixed(1) + ' FPS (just for JS, before DOM rendering)',
        note: 'Pre-fix: this cost was paid on EVERY pan frame. Guard eliminates it.',
      };
    });
    console.log(JSON.stringify(prefixCost, null, 2));

  } finally { await browser.close(); }
}

measure().catch(err => { console.error('Error:', err.message); process.exit(1); });

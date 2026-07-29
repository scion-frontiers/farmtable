import puppeteer from 'puppeteer';

const COLLECTION_ID = '6eb74644-35bb-45ad-9110-93946e75afe4';
const BASE_URL = 'http://localhost:5173';

async function testInteractions() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // ─── STEP 1: Load dependency view ───
    const url = `${BASE_URL}/?collection=${COLLECTION_ID}&view=dependencies`;
    console.log('=== Loading dependency view ===');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));

    // Zoom in to activate culling
    console.log('Zooming in to activate culling...');
    await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (depView) {
        depView.scale = 1.0;
        depView.panX = 0;
        depView.panY = 0;
        depView.requestUpdate();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    const baselineMetrics = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dep view' };
      const sr = depView.shadowRoot;
      return {
        totalLayoutNodes: depView.layoutNodes?.length ?? 0,
        renderedDOMNodes: sr.querySelectorAll('foreignObject').length,
        totalLayoutEdges: depView.layoutEdges?.length ?? 0,
        renderedDOMEdges: sr.querySelectorAll('path').length,
        isolateMode: depView.isolateMode,
      };
    });
    console.log('Baseline (zoomed in, culling active):', JSON.stringify(baselineMetrics, null, 2));
    await page.screenshot({ path: '/tmp/interaction-01-baseline.png' });

    // ─── STEP 2: Select a task by dispatching task-select event ───
    console.log('\n=== Selecting a task node ===');
    const selectResult = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dep view' };
      
      // Find a group 1 node (has blocking relationship - blocked by group 0)
      const nodes = depView.layoutNodes || [];
      const targetNode = nodes.find(n => n.task?.name?.includes('Group 1 Task 1'));
      if (!targetNode) return { error: 'No Group 1 Task 1 found', names: nodes.map(n=>n.task?.name).slice(0,10) };
      
      // Dispatch task-select event like clicking would
      depView.dispatchEvent(new CustomEvent('task-select', {
        detail: { taskId: targetNode.id },
        bubbles: true,
        composed: true,
      }));
      
      return { selected: targetNode.task?.name, taskId: targetNode.id };
    });
    console.log('Select result:', JSON.stringify(selectResult));
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/tmp/interaction-02-selected.png' });

    // ─── STEP 3: Toggle Solo mode ON ───
    console.log('\n=== Toggling Solo mode ON ===');
    
    // We need to set selectedTaskId on the component AND toggle isolateMode via the app
    const soloResult = await page.evaluate((taskId) => {
      const ftApp = document.querySelector('ft-app');
      if (!ftApp) return { error: 'no ft-app' };
      
      // Set the selected task on the app (which passes it to dep view)
      // and toggle isolate mode
      ftApp.selectedTaskId = taskId;
      ftApp.isolateMode = true;
      ftApp.requestUpdate();
      
      return { done: true };
    }, selectResult.taskId);
    console.log('Solo toggle:', JSON.stringify(soloResult));
    await new Promise(r => setTimeout(r, 3000));

    const soloMetrics = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dep view' };
      const sr = depView.shadowRoot;
      
      return {
        isolateMode: depView.isolateMode,
        selectedTaskId: depView.selectedTaskId,
        totalLayoutNodes: depView.layoutNodes?.length ?? 0,
        totalLayoutEdges: depView.layoutEdges?.length ?? 0,
        renderedDOMNodes: sr.querySelectorAll('foreignObject').length,
        renderedDOMEdges: sr.querySelectorAll('path').length,
        layoutNodeNames: (depView.layoutNodes || []).map(n => n.task?.name),
      };
    });
    console.log('Solo mode metrics:', JSON.stringify(soloMetrics, null, 2));
    await page.screenshot({ path: '/tmp/interaction-03-solo-mode.png' });

    // Minimap in Solo mode
    const minimapSolo = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      const minimap = depView?.shadowRoot?.querySelector('ft-minimap');
      if (!minimap?.shadowRoot) return { minimapError: 'No minimap' };
      const sr = minimap.shadowRoot;
      return {
        minimapNodes: sr.querySelectorAll('.minimap-nodes rect').length,
        minimapEdges: sr.querySelectorAll('.minimap-edges path').length,
      };
    });
    console.log('Minimap in Solo mode:', JSON.stringify(minimapSolo));

    // ─── STEP 4: Turn Solo OFF ───
    console.log('\n=== Turning Solo mode OFF ===');
    await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      if (ftApp) {
        ftApp.isolateMode = false;
        ftApp.requestUpdate();
      }
    });
    await new Promise(r => setTimeout(r, 3000));
    
    const afterSoloOff = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dep view' };
      const sr = depView.shadowRoot;
      return {
        isolateMode: depView.isolateMode,
        totalLayoutNodes: depView.layoutNodes?.length ?? 0,
        renderedDOMNodes: sr.querySelectorAll('foreignObject').length,
      };
    });
    console.log('After Solo off:', JSON.stringify(afterSoloOff));
    await page.screenshot({ path: '/tmp/interaction-04-solo-off.png' });

    // ─── STEP 5: DnD FLIP Animation Test ───
    console.log('\n=== DnD FLIP Animation Test ===');
    
    // Pan to origin at scale=1 so we can see Group 0 nodes
    await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (depView) {
        depView.scale = 1.0;
        depView.panX = 0;
        depView.panY = 0;
        depView.requestUpdate();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // Find two Group 0 nodes (same layer, no existing blocked-by between them)
    const dndSetup = await page.evaluate(() => {
      const ftApp = document.querySelector('ft-app');
      const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
      if (!depView?.shadowRoot) return { error: 'no dep view' };
      
      const nodes = depView.layoutNodes || [];
      const sourceNode = nodes.find(n => n.task?.name === 'Group 0 Task 10');
      const targetNode = nodes.find(n => n.task?.name === 'Group 0 Task 5');
      
      if (!sourceNode || !targetNode) {
        return { error: 'Nodes not found', available: nodes.map(n => n.task?.name).slice(0, 20) };
      }
      
      const sr = depView.shadowRoot;
      return {
        sourceNode: { id: sourceNode.id, name: sourceNode.task?.name, x: sourceNode.x, y: sourceNode.y },
        targetNode: { id: targetNode.id, name: targetNode.task?.name, x: targetNode.x, y: targetNode.y },
        sourceInDOM: !!sr.querySelector(`foreignObject[data-task-id="${sourceNode.id}"]`),
        targetInDOM: !!sr.querySelector(`foreignObject[data-task-id="${targetNode.id}"]`),
        edgesBefore: depView.layoutEdges?.length ?? 0,
      };
    });
    console.log('DnD setup:', JSON.stringify(dndSetup, null, 2));
    await page.screenshot({ path: '/tmp/interaction-05-before-dnd.png' });

    if (dndSetup.sourceInDOM && dndSetup.targetInDOM) {
      // Perform the DnD via DataTransfer events
      const dndResult = await page.evaluate((sourceId, targetId) => {
        const ftApp = document.querySelector('ft-app');
        const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
        if (!depView?.shadowRoot) return { error: 'no dep view' };
        const sr = depView.shadowRoot;

        const sourceFO = sr.querySelector(`foreignObject[data-task-id="${sourceId}"]`);
        const targetFO = sr.querySelector(`foreignObject[data-task-id="${targetId}"]`);
        if (!sourceFO || !targetFO) return { error: 'foreignObjects not found' };

        // Simulate the full DnD sequence
        const dt = new DataTransfer();
        dt.setData('application/ft-task-id', sourceId);
        
        sourceFO.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        targetFO.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
        targetFO.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        targetFO.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        sourceFO.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));

        return { 
          dragDropPerformed: true,
          animatingEdge: depView.animatingEdge ? { from: depView.animatingEdge.from, to: depView.animatingEdge.to } : null,
          nodeAnimActive: depView.nodeAnimFrameId !== null,
          dndAnimContext: depView.dndAnimContext ? 'present' : null,
        };
      }, dndSetup.sourceNode.id, dndSetup.targetNode.id);
      console.log('DnD result:', JSON.stringify(dndResult, null, 2));

      // Capture mid-animation
      await new Promise(r => setTimeout(r, 200));
      
      const midAnimState = await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
        if (!depView?.shadowRoot) return { error: 'no dep view' };
        const sr = depView.shadowRoot;
        return {
          nodeAnimActive: depView.nodeAnimFrameId !== null,
          edgeAnimActive: depView.edgeAnimFrameId !== null,
          animatingEdge: depView.animatingEdge ? 'present' : null,
          renderedDOMNodes: sr.querySelectorAll('foreignObject').length,
          renderedDOMEdges: sr.querySelectorAll('path').length,
        };
      });
      console.log('Mid-animation state:', JSON.stringify(midAnimState, null, 2));
      await page.screenshot({ path: '/tmp/interaction-06-dnd-mid-anim.png' });
      
      // Wait for animation to complete
      await new Promise(r => setTimeout(r, 1500));
      
      const dndFinal = await page.evaluate(() => {
        const ftApp = document.querySelector('ft-app');
        const depView = ftApp?.shadowRoot?.querySelector('ft-dependency-view');
        if (!depView?.shadowRoot) return { error: 'no dep view' };
        const sr = depView.shadowRoot;
        return {
          totalLayoutNodes: depView.layoutNodes?.length ?? 0,
          totalLayoutEdges: depView.layoutEdges?.length ?? 0,
          renderedDOMNodes: sr.querySelectorAll('foreignObject').length,
          renderedDOMEdges: sr.querySelectorAll('path').length,
          nodeAnimActive: depView.nodeAnimFrameId !== null,
          edgeAnimActive: depView.edgeAnimFrameId !== null,
          animatingEdge: depView.animatingEdge,
        };
      });
      console.log('After DnD complete:', JSON.stringify(dndFinal, null, 2));
      await page.screenshot({ path: '/tmp/interaction-07-dnd-complete.png' });
    } else {
      console.log('WARN: One or both DnD nodes are viewport-culled, cannot perform drag');
    }

    console.log('\n=== All interaction tests complete ===');

  } finally {
    await browser.close();
  }
}

testInteractions().catch(err => { console.error('Error:', err.message); process.exit(1); });

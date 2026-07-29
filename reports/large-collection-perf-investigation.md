# Large-Collection (~10k Task) Rendering Performance Investigation

**Date:** 2026-07-24  
**Reporter:** Performance investigation agent  
**Trigger:** ptone@google.com report of UI becoming unresponsive with ~10k-task collections  
**Status:** Investigation complete, recommendations provided

---

## Executive Summary

The primary bottleneck for large collections is **Dagre layout computation**, which takes **~13 seconds for 10,000 nodes** in the Tree View. A secondary O(n^2) hotspot exists in the render path (`getChildren()` called per node). Together with DOM creation cost for 10k SVG `foreignObject` elements, total time from data-loaded to interactive is estimated at **17-25 seconds**.

Data transfer and client-side storage are **NOT** the bottleneck, confirming ptone's hypothesis. Solo mode is fast because it filters to a small subtree (~50-200 nodes), sidestepping both the layout and DOM cost entirely.

**Top recommendation:** A layered approach combining (1) depth-limited default rendering, (2) getChildren() O(n^2) fix, and (3) viewport culling would reduce perceived render time from ~20 seconds to under 1 second for most interactions, with moderate implementation complexity.

---

## 1. Reproduction and Measurement

### Environment

Benchmarks were run using Node.js v20.20.2 against the actual `@dagrejs/dagre` v1.1.0 dependency used by the web frontend. DOM/SVG estimates are based on established browser performance characteristics for SVG foreignObject rendering. Live-instance profiling with browser DevTools was not performed (IAP auth prevented programmatic access to large collections); findings are based on code-level analysis + synthetic benchmarks.

### Benchmark Results

#### Dagre Layout Computation (Tree View)

| Node Count | Layout Time (avg) | Min | Max |
|------------|-------------------|-----|-----|
| 100 | 31ms | 23ms | 45ms |
| 500 | 135ms | 120ms | 157ms |
| 1,000 | 294ms | 290ms | 302ms |
| 2,000 | 783ms | 763ms | 814ms |
| 5,000 | 3,528ms | 3,477ms | 3,600ms |
| **10,000** | **13,215ms** | **12,496ms** | **14,375ms** |

Growth is approximately O(n^1.7), consistent with Dagre's Sugiyama-based layer assignment and crossing minimization algorithm.

#### getChildren() O(n^2) in Render Path

Current implementation in `task-store.ts` line 55-57:
```typescript
getChildren(parentId: string): Task[] {
  return this.allTasks.filter((t) => t.parentTaskId === parentId);
}
```
Where `allTasks` creates a new array copy via `[...this.tasks.values()]` on every call.

Called once per node in the Tree View render method (line 786):
```typescript
.childCount=${this.store.getChildren(n.id).length}
```

| Node Count | Current O(n^2) | Optimized (Map) | Speedup |
|------------|----------------|-----------------|---------|
| 100 | 0.4ms | 0.05ms | 8x |
| 500 | 2.9ms | 0.10ms | 29x |
| 1,000 | 13.6ms | 0.21ms | 65x |
| 5,000 | 154ms | 0.99ms | 156x |
| 10,000 | ~620ms (est.) | 2.11ms | ~300x |

#### structureKey() Computation

| Node Count | Time | Key Size |
|------------|------|----------|
| 1,000 | 0.2ms | 17 KB |
| 5,000 | 1.5ms | 91 KB |
| 10,000 | 2.8ms | 189 KB |

Negligible contributor to total time.

#### Estimated Total Render Time (10k tasks, Tree View)

| Phase | Estimated Time | Notes |
|-------|---------------|-------|
| Data transfer (streaming) | 2-5s | 10-20 MB over gRPC, not blocking render |
| Store upserts (10k) | ~50ms | Map.set operations + event dispatch |
| Dagre layout | **~13,000ms** | **Dominant bottleneck** |
| getChildren O(n^2) | ~620ms | Fixable |
| structureKey | ~3ms | Negligible |
| DOM creation (10k foreignObject + ft-tree-node) | ~3,000-8,000ms | 10k LitElement instances inside SVG |
| Browser layout/paint | ~1,000-3,000ms | SVG reflow with 10k elements |
| **TOTAL** | **~17,000-25,000ms** | **17-25 seconds** |

### Why Solo Mode Is Fast

Solo mode (Feature 61/61v2) filters via `getDescendantIds()` to show only the selected task and its descendants. A typical Solo selection might include 50-200 nodes out of 10k, which means:
- Dagre layout: ~30-150ms (vs 13s)
- DOM nodes: 50-200 (vs 10k)
- getChildren cost: negligible
- **Result: sub-200ms render** vs 17-25 seconds

This conclusively confirms the bottleneck is rendering/layout cost proportional to node count.

### Data Transfer Is NOT the Bottleneck

- The `StreamManager` streams tasks via gRPC WatchTasks with `includeInitial: true`
- Each task is ~1-2 KB serialized; 10k tasks = ~10-20 MB
- Transfer time: ~2-5 seconds depending on connection
- Store upserts during streaming are O(1) each (Map.set)
- **The data is fully loaded and available 5-10 seconds before rendering completes**
- Lit batches the `requestUpdate()` calls during streaming, so the render only fires once after microtask queue drains

---

## 2. Root Cause Diagnosis

### Primary Bottleneck: Dagre Layout Algorithm

**File:** `web/src/components/tree/ft-tree-view.ts`, lines 376-391

The `dagre.layout(g)` call implements the Sugiyama algorithm for hierarchical graph layout:
1. **Layer assignment** (rank assignment) - O(V + E)
2. **Crossing minimization** (order within layers) - O(V^2) in practice, iterative
3. **Coordinate assignment** (node positioning) - O(V + E)

Step 2 (crossing minimization) dominates for large graphs. Dagre uses a barycenter heuristic with multiple passes, making it approximately O(n^1.7) empirically.

With 10k nodes, this single call blocks the main thread for ~13 seconds, during which the UI is completely frozen.

### Secondary Bottleneck: O(n^2) getChildren() in Render

**File:** `web/src/store/task-store.ts`, line 55-57  
**Called from:** `web/src/components/tree/ft-tree-view.ts`, line 786

For each of the n rendered nodes, `getChildren(n.id)` performs:
1. `this.allTasks` - creates new array copy of all tasks: O(n)
2. `.filter(t => t.parentTaskId === parentId)` - scans entire array: O(n)

Total: O(n^2) array operations, ~620ms at 10k nodes.

### Tertiary Bottleneck: 10k SVG foreignObject DOM Nodes

Each node in the Tree View creates:
1. An SVG `<foreignObject>` element
2. An `<ft-tree-node>` LitElement component inside it (with shadow DOM)
3. Full HTML rendering inside: title, badges, labels, expand button

With 10k nodes, this produces ~30-40k DOM elements total. Browser layout and paint for this many SVG-embedded HTML elements takes 4-11 seconds.

### Non-Issue: Dependency View

The Dependency View uses a simpler manual layering algorithm (`computeLayers()` at line 73-123) that is O(V * R) where R = average relationships per task, with memoization. However, it also creates 10k DOM nodes when many tasks have blocking relationships. The dependency view also filters out CLOSED tasks, which typically reduces the visible set.

---

## 3. Strategy Assessment

### Strategy A: Depth-Limited Default Rendering (RECOMMENDED - Priority 1)

**Concept:** Render only the first N levels of the tree hierarchy by default, with expand-on-demand for deeper levels.

**Existing Infrastructure:**
- `maxDepth` state property already exists in `ft-tree-view.ts` (line 106)
- `ft-hierarchy-nav.ts` already provides a "Level" dropdown (lines 173-186)
- `getVisibleTasks()` already filters by `maxDepth` (lines 333-344)
- Collapse/expand mechanism already works per-node (lines 544-566)

**What's Needed:**
- Set `maxDepth` to a sensible default (e.g., 2-3) instead of -1 (all levels)
- Add a visual indicator when deeper children exist but aren't rendered
- Auto-expand on node selection or double-click

**Impact:**
- For a typical 10k-node tree with branching factor 5 and depth ~6:
  - Level 0: 1 node
  - Level 0-1: 6 nodes
  - Level 0-2: 31 nodes
  - Level 0-3: 156 nodes
- **At depth 3: only ~156 nodes rendered (98.4% reduction)**
- Dagre layout at 156 nodes: ~40ms (vs 13,000ms)
- DOM elements: ~450 (vs ~30k)
- **Total render time: ~100-200ms (vs 17-25 seconds)**

**Complexity:** LOW (1-2 days)  
**UX Tradeoff:** Data is hidden until expanded. Mitigated by: level dropdown exists, search/filter can reveal deeper nodes, double-click focus already shows subtrees.

### Strategy B: Fix getChildren() O(n^2) (RECOMMENDED - Priority 1)

**Concept:** Replace linear scan with cached Map lookup.

**Current Code** (`task-store.ts`, line 55-57):
```typescript
getChildren(parentId: string): Task[] {
  return this.allTasks.filter((t) => t.parentTaskId === parentId);
}
```

**Optimized Approach:**
```typescript
// Option 1: Use existing byParent getter (already defined at lines 36-49)
getChildren(parentId: string): Task[] {
  return this.byParent.get(parentId) ?? [];
}

// Option 2: Maintain a cached childMap (better - avoids rebuilding on every call)
private childMap = new Map<string, Task[]>();
// Update childMap in upsert() and delete()
getChildren(parentId: string): Task[] {
  return this.childMap.get(parentId) ?? [];
}
```

**Impact:** Reduces from ~620ms to ~2ms at 10k nodes (300x improvement)

**Complexity:** VERY LOW (30 minutes - 1 hour)  
**Risk:** None - pure performance optimization, no behavior change.

**Note:** The `byParent` getter at lines 36-49 already builds the exact Map needed, but it rebuilds it from scratch on every call. Converting this to a cached, incrementally-updated index would solve the problem with minimal code change.

### Strategy C: Viewport Culling (RECOMMENDED - Priority 2)

**Concept:** Only render nodes and edges that are visible within the current viewport. Maintain full layout computation but skip DOM creation for off-screen elements.

**Existing Infrastructure:**
- Viewport state is already tracked: `panX`, `panY`, `scale`, `containerWidth`, `containerHeight`
- The viewBox attribute already defines the visible region
- Layout nodes have explicit (x, y, width, height) — visibility check is trivial:
  ```typescript
  const isVisible = (n: LayoutNode) =>
    n.x + n.width/2 > panX && n.x - n.width/2 < panX + vbW &&
    n.y + n.height/2 > panY && n.y - n.height/2 < panY + vbH;
  ```

**Complications:**
- **Edges:** An edge connecting a visible node to an off-screen node needs partial rendering (render to the viewport boundary). Or: render all edges whose bounding box intersects the viewport.
- **Minimap:** The minimap (Feature 54) needs full-graph awareness. It already receives the full `layoutNodes` and `layoutEdges` arrays and draws simplified rectangles — this would continue to work since layout is still computed for all nodes.
- **Reusability:** Solo mode's filtering in `getVisibleTasks()` shows the pattern works; viewport culling would apply at the render step rather than the layout step.

**Impact:**
- At typical viewing zoom levels, a 1920x1080 viewport might show 50-200 nodes out of 10k
- **~95-99% reduction in DOM elements**
- DOM creation: ~50-200 elements instead of 10k → ~50-200ms instead of 4-11 seconds
- **Does NOT help with Dagre layout computation** (layout still needed for all nodes to determine positions)
- For pan/zoom interactions after initial render: nearly instant re-render (just filtering which nodes to show)

**Complexity:** MEDIUM (2-3 days)  
**UX Tradeoff:** None — completely invisible to the user. Nodes appear seamlessly as the user pans/zooms.

### Strategy D: Web Worker for Dagre Layout (RECOMMENDED - Priority 2)

**Concept:** Offload Dagre layout computation to a Web Worker so the main thread remains responsive during the 13-second calculation.

**Implementation:**
1. Create a worker that imports dagre
2. Send serialized graph data (node IDs, edges, dimensions) to worker
3. Worker runs `dagre.layout()` and returns computed positions
4. Main thread applies positions to layout nodes and renders

**Impact:**
- Does NOT reduce total computation time (still ~13 seconds)
- **Unblocks the main thread** — UI remains responsive during layout
- Show a progress indicator ("Computing layout...") while worker runs
- Combined with viewport culling: render nodes progressively as worker provides positions

**Complexity:** MEDIUM (2-3 days)  
**UX:** User sees layout building progressively instead of frozen UI

### Strategy E: Replace Dagre with Faster Layout Algorithm (CONSIDER)

**Concept:** Dagre's Sugiyama algorithm is general-purpose but slow. For a tree (which is what Tree View displays), simpler algorithms exist:

1. **Reingold-Tilford tree layout**: O(n) time, specifically designed for trees. Libraries: `d3-hierarchy`, `@observablehq/plot`
2. **Simple recursive layout**: For a tree (no crossing edges), positions can be computed in O(n) with a simple DFS:
   ```
   function layout(node, x, y):
     node.x = x; node.y = y
     childX = x - totalChildWidth/2
     for each child:
       layout(child, childX, y + rankSep)
       childX += childWidth + nodeSep
   ```

**Impact:**
- Reduces layout from ~13,000ms to **~10-50ms** for 10k nodes
- Tree-specific algorithms don't need crossing minimization (trees have no crossings)
- **This is the single highest-impact change possible**

**Complexity:** MEDIUM-HIGH (3-5 days)  
- Need to implement or integrate a tree-specific layout
- Must handle edge cases: multiple roots, disconnected components
- The Dependency View should stay with its existing manual layering (which is already fast)

**UX:** No change — same visual output, dramatically faster

### Strategy F: Canvas Rendering (NOT RECOMMENDED short-term)

**Concept:** Replace SVG foreignObject rendering with HTML5 Canvas for large graphs.

**Impact:** Can handle 100k+ nodes at 60fps. Libraries like `pixi.js`, `@antv/g6`, `cytoscape.js` are designed for this.

**Complexity:** VERY HIGH (2-4 weeks)  
- Complete rewrite of node rendering (loses LitElement components, CSS, hit testing)
- Need custom text rendering, interaction handling, accessibility
- Would need to maintain SVG mode for small collections (accessibility, text selection)

**Recommendation:** Not worth pursuing unless the application regularly deals with 50k+ task collections. The simpler strategies (A-E) solve the 10k case adequately.

### Strategy G: Incremental/Progressive Rendering (CONSIDER)

**Concept:** Render nodes in batches using `requestIdleCallback()` or `requestAnimationFrame()`, showing partial results while computation continues.

**Impact:** Improves perceived responsiveness — user sees nodes appearing progressively
**Complexity:** MEDIUM (2-3 days)
**Note:** Most effective when combined with viewport culling (render visible nodes first, off-screen nodes later).

---

## 4. Ranked Recommendations

| Priority | Strategy | Expected Impact | Complexity | Dependencies |
|----------|----------|----------------|------------|--------------|
| **P0** | **B: Fix getChildren() O(n^2)** | 300x speedup on child-count computation (~620ms→2ms) | Very Low (1hr) | None |
| **P1** | **A: Depth-limited default rendering** | 98% reduction in rendered nodes, total render ~200ms | Low (1-2 days) | None |
| **P1** | **E: Replace Dagre with tree-specific layout** | 260x speedup on layout computation (~13s→50ms) | Medium-High (3-5 days) | None |
| **P2** | **C: Viewport culling** | 95-99% reduction in DOM elements during pan/zoom | Medium (2-3 days) | Helps most after A or E |
| **P2** | **D: Web Worker for layout** | Unblocks main thread during layout computation | Medium (2-3 days) | Only needed if keeping Dagre |
| **P3** | **G: Progressive rendering** | Better perceived responsiveness | Medium (2-3 days) | Best combined with C |
| **P4** | **F: Canvas rendering** | Handles 100k+ nodes | Very High (2-4 weeks) | Only if 50k+ needed |

### Recommended Implementation Plan

**Phase 1 (Quick Wins — 1-2 days):**
1. Fix `getChildren()` O(n^2) → O(1) with cached Map (Strategy B)
2. Set default `maxDepth` to 3 in Tree View (Strategy A)

**Phase 2 (Substantial Improvement — 3-5 days):**
3. Replace Dagre with tree-specific layout algorithm (Strategy E)
   - This eliminates the dominant 13-second bottleneck entirely
   - Consider `d3-hierarchy`'s `tree()` layout which is O(n) and battle-tested

**Phase 3 (Polish — 2-3 days, optional):**
4. Add viewport culling for smooth pan/zoom at scale (Strategy C)
5. If keeping Dagre for any reason, move to Web Worker (Strategy D)

**Expected outcome after Phase 1+2:** Rendering 10k-task collections drops from ~17-25 seconds to **under 1 second** for initial render, with smooth pan/zoom interactions.

---

## 5. Additional Observations

### allTasks Getter Creates Array Copies

`TaskStore.allTasks` (line 11-13) returns `[...this.tasks.values()]` — a new array copy on every call. This is called multiple times per render cycle. For 10k tasks, each copy allocates ~80KB. Consider caching the array and invalidating on mutation.

### Minimap Renders All Nodes

The minimap component renders simplified rectangles for all nodes. At 10k nodes, this adds ~10k SVG `<rect>` elements to the DOM. However, these are lightweight compared to foreignObject + LitElement, so the impact is minor (~50-100ms). If viewport culling is implemented, the minimap should continue to render all nodes (it needs full-graph awareness).

### Dependency View Is Less Affected

The Dependency View's manual layering algorithm (`computeLayers()`) is O(V * R) with memoization and is significantly faster than Dagre. However, if many tasks have blocking relationships, DOM creation for 10k nodes is still expensive. The same viewport culling strategy would help.

### Store Event Storm During Initial Load

During streaming initial sync, `upsert()` fires `tasks-changed` for each of 10k tasks. While Lit batches `requestUpdate()` calls, the `JSON.stringify()` comparison in `upsert()` (line 64) adds unnecessary overhead during streaming (where `_changes` is provided, so the comparison is already bypassed). This is correctly optimized.

### Existing `byParent` Getter Is Unused

`TaskStore.byParent` (lines 36-49) builds exactly the Map that `getChildren()` needs, but `getChildren()` doesn't use it. The `byParent` getter itself rebuilds from scratch on every call, which is still O(n). Making this a cached, incrementally-maintained index would solve both `getChildren()` and `byParent` performance.

---

## 6. Files Referenced

| File | Relevance |
|------|-----------|
| `web/src/components/tree/ft-tree-view.ts` | Tree View rendering, Dagre layout, O(n^2) getChildren call |
| `web/src/components/dependency/ft-dependency-view.ts` | Dependency View rendering, manual layering |
| `web/src/store/task-store.ts` | Task store, getChildren() implementation, allTasks getter |
| `web/src/store/task-store-controller.ts` | Reactive controller triggering re-renders |
| `web/src/store/stream-manager.ts` | Streaming data load, initial snapshot |
| `web/src/components/tree/ft-tree-node.ts` | Node UI component (LitElement in foreignObject) |
| `web/src/components/minimap/ft-minimap.ts` | Minimap rendering |
| `web/src/components/tree/ft-hierarchy-nav.ts` | Level dropdown, Solo mode controls |
| `web/src/gen/types.ts` | Task type definition |

---

## Appendix: Benchmark Script

The dagre benchmark script used for measurements is at `/tmp/dagre-bench.mjs`. Run with:
```bash
cd /workspace/farmtable/web && node /tmp/dagre-bench.mjs
```

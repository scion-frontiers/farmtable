# Dependency View Large-Collection Performance Investigation

**Date:** 2026-07-24  
**Reporter:** Performance investigation agent  
**Trigger:** ptone@google.com reports Perf Phase 1 improvement "less obvious" for Dependency View than Tree View  
**Prior work:** [large-collection-perf-investigation.md](large-collection-perf-investigation.md) — verified and extended here  
**Status:** Investigation complete, one recommendation provided

---

## Executive Summary

The prior investigation's "Non-Issue: Dependency View" label is **incorrect**. While `computeLayers()` is indeed efficient (O(V+E), confirmed), the Dependency View has **two concrete performance problems** for large collections:

1. **No default scoping** (analogous to Tree View's `maxDepth=3`): Dependency View renders ALL non-CLOSED tasks involved in blocking relationships OR passing `isReady()`. For a 9,284-task decomposed collection, this means **~8,000+ visible nodes** — each creating a `<foreignObject>` + `<ft-tree-node>` LitElement with shadow DOM. Estimated DOM creation + browser paint: **~4,600–8,700ms** (compared to Tree View's post-fix 2,999ms for 1,036 nodes).

2. **`runLayout()` recomputes on every pan/zoom frame**: `panX`, `panY`, `scale` are `@state()` properties. Every change triggers `willUpdate()` → `runLayout()` → `getVisibleTasks()` + `structureKey()`. For 8,000+ tasks, `structureKey()` alone costs ~50–100ms per frame, yielding **~9–16 FPS during panning** (target: 60 FPS).

Phase 1's `getChildren()` O(n²)→O(1) fix had **zero effect** on Dependency View — it never calls `getChildren()` (passes `.childCount=${0}` to `ft-tree-node` at line 1450).

**Recommended fix:** Viewport culling — render only nodes/edges visible within the current SVG viewBox. Priority 1, MEDIUM complexity (2–3 days), expected to reduce initial render to **~200–500ms** and achieve **60 FPS** panning.

---

## 1. Code-Level Analysis

### 1.1 `computeLayers()` — Verified O(V+E), No Hidden Hotspot

**File:** `web/src/components/dependency/ft-dependency-view.ts`, lines 149–199

The function uses memoized recursive DFS. Each task is visited exactly once (`layers.has(taskId)` check at line 158). Per task, it iterates only that task's relationships (not all tasks), and each `store.getTask()` call is an O(1) Map lookup (verified in `task-store.ts` line 46–48).

```
Total: O(V + E) where V = visible tasks, E = total BLOCKED_BY edges
```

For the 9,284-task test collection with an estimated ~28,000 blocking relationships (decomposer creates ~3 relationships per task on average): **~10–20ms** (estimated, based on ~28,000 × ~0.5µs per Map lookup + recursion overhead).

**Verdict:** `computeLayers()` is NOT a bottleneck. The prior report's O(V*R) characterization is correct (equivalent to O(V+E)). No O(n²) hotspot analogous to the old `getChildren()` bug.

### 1.2 `getVisibleTasks()` — Shows ALL Non-CLOSED Tasks for Decomposed Collections

**File:** lines 624–673

The method collects tasks in two categories:
1. **Relationship-connected** (lines 629–654): Any task with a BLOCKED_BY or BLOCKS relationship targeting a non-CLOSED task, plus the target itself.
2. **Ready/unblocked** (lines 651–652): Any task passing `isReady()` — OPEN/IN_PROGRESS with no non-CLOSED blockers.

For a decomposer-generated collection, the decomposer creates group-sequential blocking relationships (engine.go lines 160–184: tasks in group N are BLOCKED_BY all tasks in group N-1). This means virtually ALL tasks have at least one blocking relationship and are included via category 1. Ready tasks (group 0, leaf tasks whose blockers are all closed) are additionally included via category 2.

**Result: For a 9,284-task collection where ~90% are non-CLOSED, ~8,000+ tasks pass the filter.** There is no equivalent of Tree View's `maxDepth=3` to scope this down.

### 1.3 `structureKey()` — Expensive String Construction on Every Frame

**File:** lines 675–693

```typescript
return tasks.map(t =>
  `${t.id}:${t.phase}:${t.relationships
    .map(r => `${r.type}-${r.targetTaskId}`).sort().join(',')}`
).sort().join('|') + '||' + isolateKey;
```

For 8,000 tasks with ~3 relationships each:
- Inner sort per task: 8,000 × O(3 log 3) = trivial per task
- Outer sort: O(8,000 × log(8,000)) string comparisons
- Total string size: ~8,000 × 60 chars ≈ **~480KB**
- **Estimated cost: ~50–100ms** (string allocation + sorting + comparison)

This runs in `runLayout()`, which is called from `willUpdate()` on EVERY render cycle — including pan/zoom changes (since `panX`, `panY`, `scale` are `@state()` at lines 319–321). Even when the structure hasn't changed, the string is rebuilt and compared.

### 1.4 `allTasks` Getter — Shallow Copy per Call

**File:** `web/src/store/task-store.ts`, lines 38–44

```typescript
get allTasks(): readonly Task[] {
    if (!this._allTasksCache) {
      this._allTasksCache = [...this.tasks.values()];
    }
    return [...this._allTasksCache]; // New copy every call
}
```

Called 3 times per Dependency View render cycle:
1. `render()` line 1343: `this.store.allTasks.length === 0` — creates copy just to check length
2. `getVisibleTasks()` line 629: `for (const task of this.store.allTasks)` — iteration copy
3. `getVisibleTasks()` line 656: `this.store.allTasks.filter(...)` — filter copy

Each copy: 9,284 elements × 8 bytes ≈ 74KB. Total: ~220KB of array allocation per render cycle. Minor cost (~2ms) but wasteful — line 1343 should use `this.store.taskCount` (O(1) Map.size).

### 1.5 DOM Creation — The Dominant Bottleneck

**File:** `render()` method, lines 1342–1471

Per visible node, the render creates:
- 1 SVG `<foreignObject>` element (lines 1431–1453)
- 1 `<ft-tree-node>` LitElement with shadow DOM (~6 inner DOM elements)
- Event handlers: click, dragstart, dragend, dragover, dragenter, dragleave, drop

Per edge:
- 1 SVG `<path>` element with computed cubic bezier `d` attribute

For 8,000 nodes + ~20,000 edges: **~68,000+ DOM elements total**.

### 1.6 Phase 1 Fix Had Zero Effect on Dependency View

The two Phase 1 changes:
1. **`getChildren()` O(n²)→O(1)**: Dependency View never calls `getChildren()`. It passes `.childCount=${0}` to `ft-tree-node` (line 1450), bypassing the child-count lookup entirely. **Zero impact.**
2. **`maxDepth=3` default for large collections**: Added only to `ft-tree-view.ts` (line 216). No equivalent exists in `ft-dependency-view.ts`. **Zero impact.**

This confirms ptone's observation: the Phase 1 improvement is "less obvious" for Dependency View because **there was literally no improvement** for Dependency View.

---

## 2. Performance Estimates

### 2.1 Estimated Dependency View Render Time (9,284-task collection, post-Phase 1)

| Phase | Estimated Time | Method | Notes |
|-------|---------------|--------|-------|
| `getVisibleTasks()` | ~5ms | Code analysis | O(V+E), Map lookups |
| `structureKey()` | ~50–100ms | Code analysis | ~480KB string, sort, compare |
| `computeLayers()` | ~10–20ms | Code analysis | O(V+E), memoized DFS |
| `runLayout()` positioning | ~5ms | Code analysis | Simple arithmetic per node |
| `computeEdgeSets()` | ~5–10ms | Code analysis | Two BFS passes, cached |
| **DOM creation (8,000 nodes)** | **~3,000–5,500ms** | **Extrapolated¹** | **foreignObject + LitElement + shadow DOM** |
| **Browser layout/paint** | **~1,500–3,000ms** | **Extrapolated¹** | **SVG reflow + path rendering** |
| **TOTAL** | **~4,600–8,700ms** | | |

¹ Extrapolated from the prior investigation's established DOM cost model: 3,000–8,000ms for 10k SVG foreignObject + LitElement instances, linearly scaled to 8,000 nodes.

### 2.2 Comparison with Tree View

| Metric | Tree View (post-fix) | Dependency View (current) | Ratio |
|--------|---------------------|--------------------------|-------|
| Total tasks | 9,284 | 9,284 | 1x |
| Rendered nodes | 1,036 (depth-limited) | ~8,000+ (no scoping) | **~8x more** |
| Layout algorithm | Dagre (~300ms at 1k) | computeLayers (~20ms at 8k) | Dep View faster |
| DOM creation | ~500–1,000ms | ~3,000–5,500ms | **~5x slower** |
| Total render | **2,999ms** (measured²) | **~4,600–8,700ms** (estimated) | **1.5–3x slower** |
| Source | deploy-45 evidence | Code analysis | |

² Measured on live instance during deploy-45 verification (performance-measurements.json).

### 2.3 Pan/Zoom Frame Budget

During panning/zooming, each frame triggers `willUpdate()` → `runLayout()`:

| Per-frame cost | Time | Notes |
|----------------|------|-------|
| `getVisibleTasks()` | ~5ms | Rebuilds involvedIds set |
| `structureKey()` | ~50–100ms | Rebuilds ~480KB string |
| Fast-path comparison | ~1ms | String equality check |
| Lit render diff | ~2–5ms | No DOM changes needed |
| **Total per frame** | **~60–110ms** | |
| **Achievable FPS** | **~9–16 FPS** | Target: 60 FPS (16.67ms budget) |

The `structureKey()` recomputation consumes 3–6× the entire 16.67ms frame budget, making panning visibly janky on large collections.

### 2.4 Note on Live Measurement

Deploy-45 verification check #6 ("Dependency View renders correctly") **failed** with "View: dashboard, Rendered: undefined, Nodes: undefined" — the automated verifier could not navigate to or measure the Dependency View. Therefore no live Dependency View measurements exist from the performance verification. All Dependency View numbers in this report are estimated from code analysis and extrapolation from measured Tree View numbers.

---

## 3. Strategy Assessment: Default Scoping for Dependency View

### Why Tree View's Approach Doesn't Directly Apply

Tree View scopes by **depth in a rooted hierarchy** (`maxDepth=3` hides levels 4+). This works because:
- Trees have a natural root → depth axis
- Shallow nodes (levels 0–3) provide useful context without the full tree
- Users can expand deeper via the Level dropdown

Dependency View has **no single root** and no natural "depth" axis. The graph is potentially many independent BLOCKS chains. "Layer" (longest-path distance from unblocked roots) doesn't map cleanly to user intent — hiding high-layer nodes would hide the most deeply blocked tasks, which are arguably the **most** important to see in a dependency view.

### Evaluated Scoping Strategies

| Strategy | Estimated Impact | Complexity | UX Tradeoff |
|----------|-----------------|------------|-------------|
| **A. Layer-limited** (maxLayer=2) | ~30–50% node reduction | LOW (1–2 days) | Hides deeply blocked tasks — counterintuitive |
| **B. Hide orphan ready tasks** | ~10–30% reduction | VERY LOW (2 hrs) | Modest impact, changes view semantics |
| **C. Viewport culling** | **~95–99% DOM reduction** | **MEDIUM (2–3 days)** | **None — transparent to user** |
| D. Web Worker for layout | Unblocks main thread | MEDIUM (2–3 days) | No total-time reduction (layout already fast) |
| E. Connected-component limit | ~40–60% reduction | MEDIUM (2–3 days) | Arbitrary cutoff, confusing UX |

### Why Viewport Culling is the Right Answer

Viewport culling is the only strategy that:
1. **Matches the bottleneck**: DOM creation is ~80% of render time; viewport culling eliminates ~95–99% of it
2. **Has zero UX tradeoff**: Users see exactly the same graph; nodes appear/disappear seamlessly as they pan
3. **Addresses both bottlenecks**: Initial render AND pan/zoom performance improve (fewer DOM nodes to create, update, and reflow)
4. **Works regardless of graph shape**: Effective for dense dependency graphs, sparse ones, and everything in between
5. **Has existing infrastructure**: `panX`, `panY`, `scale`, `containerWidth`, `containerHeight` are already tracked; `layoutNodes` have explicit `(x, y, width, height)` — visibility check is a simple AABB test

Layer-limiting (Strategy A) would be the most "analogous" to Tree View's `maxDepth`, but it poorly fits Dependency View's semantics: users open the Dependency View specifically to see blocking chains, and hiding the deepest (most blocked) tasks defeats the purpose.

---

## 4. Recommendation

### Priority 1: Viewport Culling for Dependency View

**Concept:** Compute layout for ALL visible tasks (positions + edges), but only create DOM elements for nodes and edges whose bounding boxes intersect the current SVG viewBox. Nodes outside the viewport are simply not rendered — they appear instantly when the user pans to them.

**Implementation sketch:**

```typescript
// In render(), replace this.layoutNodes.map(...) with:
const vbW = this.containerWidth / this.scale;
const vbH = this.containerHeight / this.scale;
const visibleNodes = this.layoutNodes.filter(n =>
  n.x + n.width / 2 > this.panX &&
  n.x - n.width / 2 < this.panX + vbW &&
  n.y + n.height / 2 > this.panY &&
  n.y - n.height / 2 < this.panY + vbH
);
// Render only visibleNodes (foreignObject + ft-tree-node)

// For edges: render if either endpoint's node is visible
const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
const visibleEdges = this.layoutEdges.filter(e =>
  visibleNodeIds.has(e.from) || visibleNodeIds.has(e.to)
);
```

**Also needed (complementary, included in complexity estimate):**

Guard `runLayout()` in `willUpdate()` to skip on pan/zoom-only changes. One approach: check if `changedProperties` contains only pan/zoom keys (`panX`, `panY`, `scale`, `isPanning`, `draggingNodeId`, `dragOverNodeId`); if so, skip `runLayout()` — panning doesn't change which tasks are visible (only which are in the viewport, which is handled in `render()`). Store-triggered updates (via `TaskStoreController.requestUpdate()` with no arguments) produce an empty `changedProperties`, so they still trigger `runLayout()`.

```typescript
protected willUpdate(changedProperties: PropertyValues): void {
  super.willUpdate(changedProperties);
  // Skip layout recomputation for pan/zoom-only changes.
  const panZoomKeys = new Set(['panX', 'panY', 'scale', 'isPanning',
    'draggingNodeId', 'dragOverNodeId']);
  const isPanZoomOnly = changedProperties.size > 0 &&
    [...changedProperties.keys()].every(k => panZoomKeys.has(k as string));
  if (!isPanZoomOnly) {
    this.runLayout();
    this.computeEdgeSets();
  }
}
```

**Also fix:** `render()` line 1343 — replace `this.store.allTasks.length === 0` with `this.store.taskCount === 0` to avoid unnecessary array copy.

**Expected impact:**

| Metric | Current (estimated) | With viewport culling | Improvement |
|--------|--------------------|-----------------------|-------------|
| Rendered DOM nodes | ~8,000 | ~50–200 (viewport) | **40–160x reduction** |
| Initial render | ~4,600–8,700ms | ~200–500ms | **~10–20x faster** |
| Pan/zoom FPS | ~9–16 FPS | ~60 FPS | **~4–6x smoother** |
| Layout computation | ~20ms | ~20ms (unchanged) | — |

**Complexity:** MEDIUM (2–3 days)
- Day 1: Viewport culling for nodes + edges in `render()`, with `runLayout()` guard
- Day 2: Edge cases — partial edge rendering for edges crossing viewport boundary, ensure minimap continues rendering all nodes (it already receives `layoutNodes`/`layoutEdges` directly), handle centering behavior on initial load
- Day 3: Testing with large collection, edge-case handling (resize, Solo mode toggle, DnD animation interaction)

**Risk:** LOW
- Minimap already works from `layoutNodes`/`layoutEdges` arrays — unaffected since layout is still computed for all nodes
- Solo mode filtering happens in `getVisibleTasks()` before layout — viewport culling is applied after, so they compose naturally
- DnD animations manipulate node positions directly — viewport culling just filters what's rendered, so animations work unchanged (nodes animate into/out of viewport naturally)

---

## 5. Files Referenced

| File | Relevance |
|------|-----------|
| `web/src/components/dependency/ft-dependency-view.ts` | Primary analysis target: `computeLayers()`, `getVisibleTasks()`, `structureKey()`, `render()`, `runLayout()` |
| `web/src/store/task-store.ts` | `allTasks` getter (shallow copy per call), `getTask()` (O(1) Map lookup), `taskCount` property |
| `web/src/store/task-store-controller.ts` | Triggers `requestUpdate()` on store changes (no `changedProperties` args) |
| `web/src/utils/task-ready.ts` | `isReady()` — determines Layer-0 inclusion in Dependency View |
| `web/src/components/tree/ft-tree-view.ts` | Reference for `maxDepth` depth-limiting pattern (lines 18, 117, 211–217) |
| `web/src/components/tree/ft-tree-node.ts` | Shared node component — ~6 DOM elements per instance |
| `internal/decomposer/engine.go` | Decomposer creates group-sequential blocking relationships (lines 160–184) |

---

## 6. Verification of Prior Investigation's "Non-Issue" Claim

The prior investigation (Section 2, "Non-Issue: Dependency View") stated:

> The Dependency View's manual layering algorithm (`computeLayers()`) is O(V * R) with memoization and is significantly faster than Dagre. However, if many tasks have blocking relationships, DOM creation for 10k nodes is still expensive.

**What was correct:**
- `computeLayers()` IS O(V*R) ≡ O(V+E) with memoization ✓
- It IS significantly faster than Dagre ✓
- DOM creation for many nodes IS expensive ✓

**What was incorrect:**
- Labeling Dependency View as "Non-Issue" — the view renders ~8,000+ nodes for large decomposed collections with no scoping mechanism, resulting in estimated 4,600–8,700ms render time
- Assumption that CLOSED-task filtering "typically reduces the visible set" — for newly decomposed collections, nearly all tasks are OPEN
- Not identifying that Phase 1 fixes had zero effect on Dependency View (getChildren never called, no depth limit added)
- Not analyzing the `structureKey()` per-frame overhead during pan/zoom

# Performance Phase 1 — Evidence Report

**Date:** 2026-07-24  
**Branch:** `fix/perf-phase1-getchildren-depth`  
**Benchmark environment:** Node.js v20 (synthetic benchmark simulating render-path costs)

---

## Fix 1: getChildren() O(n^2) -> O(1)

### What changed

**File:** `web/src/store/task-store.ts`

**Before:** `getChildren(parentId)` called `this.allTasks.filter(t => t.parentTaskId === parentId)`, where `allTasks` creates a new array copy (`[...this.tasks.values()]`) on every call. In the render path, this is called once per visible node, making the total cost O(n^2).

**After:** A cached `Map<parentId, Task[]>` (`_childMap`) is maintained incrementally on every `upsert()`, `delete()`, and `clear()` call. `getChildren()` becomes a single Map lookup — O(1). The `allTasks` getter and `roots` getter are also cached with lazy invalidation.

### Measured results

| Node Count | Before (ms) | After (ms) | Speedup |
|------------|-------------|------------|---------|
| 100        | 0.31        | 0.01       | 26x     |
| 500        | 2.81        | 0.05       | 55x     |
| 1,000      | 8.19        | 0.04       | 233x    |
| 5,000      | 174.31      | 0.13       | 1,381x  |
| **10,000** | **801.22**  | **0.38**   | **2,120x** |

The old implementation's growth is clearly O(n^2) — cost quadruples when node count doubles. The new implementation is essentially constant-time (sub-millisecond) regardless of collection size.

---

## Fix 2: Default Depth Limit for Large Collections

### What changed

**Files:** `web/src/components/tree/ft-tree-view.ts`, `web/src/components/tree/ft-hierarchy-nav.ts`

- Collections with > 500 tasks automatically get a depth limit of 3 levels on initial render
- The user can always change the depth via the existing Level dropdown — the auto-limit only applies if the user hasn't manually set a depth
- A visual badge ("N deeper levels hidden") appears in the hierarchy nav bar when depth is limited, so the user always knows deeper data exists
- Small/medium collections (< 500 tasks) are unaffected — behavior is unchanged

### Node-count reduction (10,000-task tree, branching factor 5)

| Max Depth | Visible Nodes | Reduction |
|-----------|---------------|-----------|
| 0         | 1             | 100.0%    |
| 1         | 6             | 99.9%     |
| 2         | 31            | 99.7%     |
| **3 (default)** | **156** | **98.4%** |
| 4         | 781           | 92.2%     |
| 5         | 3,906         | 60.9%     |
| All       | 10,000        | 0.0%      |

At the default depth of 3, only 156 nodes need layout and rendering — a **98.4% reduction**.

### UX safeguards

1. **Visual indicator:** A "depth-badge" in the hierarchy nav shows how many deeper levels are hidden
2. **Level dropdown synced:** The dropdown reflects the auto-applied depth (shows "Level 3" not "All Levels")
3. **User override:** Any manual dropdown change is respected; the auto-limit never overrides user choice
4. **Small collections unaffected:** The threshold is 500 tasks — typical collections with dozens or hundreds of tasks behave exactly as before
5. **Solo mode unaffected:** Solo mode filters to a subtree before depth limiting; the two mechanisms are independent and compatible

---

## Combined Impact

### Estimated total render time for 10,000-task collection

| Component          | Before     | After      |
|--------------------|------------|------------|
| Dagre layout       | ~13,000ms  | ~11ms      |
| getChildren()      | ~801ms     | < 1ms      |
| DOM creation       | ~5,500ms   | ~86ms      |
| Browser paint      | ~2,000ms   | ~31ms      |
| **Total**          | **~21,301ms** | **~128ms** |

**Overall speedup: ~166x** (from ~21 seconds to ~128ms)

Note: The Dagre layout speedup comes entirely from the depth limit reducing visible nodes from 10,000 to 156. The actual Dagre algorithm is unchanged — that's Phase 2 (replacing Dagre with a tree-specific O(n) layout).

---

## Regression check

- **TypeScript:** `tsc --noEmit` passes cleanly
- **Solo mode:** Uses `getDescendantIds()` which calls `getChildren()` — benefits from the O(1) fix without any API change
- **Level dropdown:** Now driven by the `maxDepth` property passed from the tree view, keeping auto-depth and user selection in sync
- **Collapse/expand:** Uses `expandedNodes` set independently of depth limiting — no interaction
- **Drag-and-drop reparenting:** Calls `store.upsert()` which correctly updates the child map
- **Small collections:** Threshold of 500 means no behavior change for collections under that size

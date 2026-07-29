# Independent Review: PR #155 — Perf Phase 2 Viewport Culling

**Reviewer:** Code review agent (independent)
**Date:** 2026-07-24
**Branch:** `perf-phase2-viewport-culling`
**Commit reviewed:** `8430eb0`
**File changed:** `web/src/components/dependency/ft-dependency-view.ts`

---

## Verdict: APPROVE

No correctness bugs found. The implementation is sound, the guard logic is
safe, and feature interactions are properly handled. One minor comment
inaccuracy noted below as a nit.

---

## 1. Viewport Culling Filter (render(), lines 1384–1408)

### AABB Intersection Math — Correct

The culling filter uses standard AABB intersection with a margin:

```typescript
const margin = Math.max(NODE_WIDTH, NODE_HEIGHT); // = 220
const vpLeft   = this.panX - margin;
const vpRight  = this.panX + vbW + margin;
const vpTop    = this.panY - margin;
const vpBottom = this.panY + vbH + margin;

const visibleNodes = this.layoutNodes.filter((n) =>
  n.x + n.width / 2 > vpLeft &&   // node right > viewport left
  n.x - n.width / 2 < vpRight &&  // node left < viewport right
  n.y + n.height / 2 > vpTop &&   // node bottom > viewport top
  n.y - n.height / 2 < vpBottom,  // node top < viewport bottom
);
```

Analysis:
- Node positions (`n.x`, `n.y`) are center-based; `n.width/2` and `n.height/2`
  correctly expand to the node's bounding box edges.
- The viewport rectangle (`panX` to `panX + vbW`) is in SVG viewBox coordinates,
  matching the node coordinate space. Confirmed by the `viewBox` attribute at
  line 1427: `viewBox="${this.panX} ${this.panY} ${vbW} ${vbH}"`.
- Strict inequalities (`>`, `<`) correctly exclude zero-overlap boundary touches;
  no off-by-one issue — a node must have nonzero intersection area to pass.
- Margin of 220px (= `NODE_WIDTH`) adds a full node-width buffer in all
  directions, preventing pop-in during panning. This is generous and correct.

### Edge Culling — Correct

```typescript
const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
const visibleEdges = this.layoutEdges.filter((e) =>
  visibleNodeIds.has(e.from) || visibleNodeIds.has(e.to),
);
```

An edge is rendered if **at least one** endpoint is visible. This ensures edges
connecting a visible node to an off-screen node are still drawn (they'd extend
off-screen, which is correct — the SVG clips them naturally). The acknowledged
limitation is that edge-heavy views can still be slow because edges connecting
two visible nodes are never culled. This is filed as issue #156.

---

## 2. willUpdate() Pan/Zoom Guard (lines 423–456) — Correct

### Guard Logic

```typescript
private static readonly PAN_ZOOM_KEYS = new Set([
  'panX', 'panY', 'scale', 'isPanning',
  'draggingNodeId', 'dragOverNodeId',
]);

const isPanZoomOnly = changedProperties.size > 0 &&
  [...changedProperties.keys()].every(
    (k) => FtDependencyView.PAN_ZOOM_KEYS.has(k as string),
  );
```

### Verified scenarios:

| Trigger | `changedProperties` | `isPanZoomOnly` | Layout runs? | Correct? |
|---------|---------------------|-----------------|-------------|----------|
| Mouse pan (`panX`/`panY`) | `{panX, panY}` | `true` | No | ✓ |
| Wheel zoom (`scale`, `panX`, `panY`) | `{scale, panX, panY}` | `true` | No | ✓ |
| Store update (SSE/poll) | `{}` (empty) | `false` (size=0) | Yes | ✓ |
| Task selection | `{selectedTaskId}` | `false` | Yes | ✓ |
| Solo toggle | `{isolateMode}` | `false` | Yes | ✓ |
| Store prop change | `{store}` | `false` | Yes | ✓ |
| ResizeObserver | `{}` (empty) | `false` (size=0) | Yes | ✓ |
| Mixed (pan + selection) | `{panX, selectedTaskId}` | `false` (every fails) | Yes | ✓ |
| DnD start (`draggingNodeId`) | `{draggingNodeId}` | `true` | No | ✓ |
| DnD hover (`dragOverNodeId`) | `{dragOverNodeId}` | `true` | No | ✓ |
| DnD animation rAF | `{}` (empty) | `false` (size=0) | Yes* | ✓ |

*\*During DnD animation frames, `runLayout()` runs but immediately early-returns
via the `structureKey` comparison (the structure hasn't changed since the
drop-triggered layout). `computeEdgeSets()` similarly early-returns via its
`_edgeCacheKey` comparison. No wasted work beyond the key comparisons.*

### PAN_ZOOM_KEYS completeness check

All `@state()` and `@property()` decorators in the class:
- `store` — @property — NOT in set → layout runs ✓
- `selectedTaskId` — @property — NOT in set → layout runs ✓
- `readOnly` — @property — NOT in set → layout runs (conservative, harmless) ✓
- `isolateMode` — @property — NOT in set → layout runs ✓
- `panX` — @state — IN set ✓
- `panY` — @state — IN set ✓
- `scale` — @state — IN set ✓
- `isPanning` — @state — IN set ✓
- `draggingNodeId` — @state — IN set ✓
- `dragOverNodeId` — @state — IN set ✓

All 10 reactive properties are accounted for. No property is missing from
consideration — the set is complete.

### Key safety property: empty changedProperties → layout runs

The comment at lines 437–440 correctly documents this behavior:
`TaskStoreController.requestUpdate()` calls `this.host.requestUpdate()` with no
arguments (confirmed in `task-store-controller.ts` lines 7–8), which produces
empty `changedProperties`. Since `size > 0` is `false`, `isPanZoomOnly` is
`false`, and layout correctly runs. This is the critical path for SSE/poll
data updates.

---

## 3. Feature Interaction Checks

### 3a. Solo Mode — Correct composition

Solo mode filtering happens in `getVisibleTasks()` (lines 685–691), which runs
inside `runLayout()`. Viewport culling happens later in `render()`. The two
filters are sequential and independent:

1. `getVisibleTasks()` → filters by Solo mode (directed reachability)
2. `runLayout()` → positions the filtered set, stores in `this.layoutNodes`
3. `render()` → viewport culling filters `this.layoutNodes` to `visibleNodes`

A node must pass BOTH filters to be rendered. No double-hide or double-show
is possible. Toggling Solo mode changes `isolateMode` (a @property), which is
NOT in `PAN_ZOOM_KEYS`, so layout correctly re-runs.

### 3b. DnD FLIP Animation — Correct

During the FLIP animation (lines 876–916):
- The rAF loop interpolates `node.x` and `node.y` directly on the
  `layoutNodes` objects each frame.
- `this.requestUpdate()` triggers re-render.
- In `willUpdate`, `changedProperties` is empty → `isPanZoomOnly = false` →
  `runLayout()` runs, but early-returns via structureKey check (positions are
  mutated on the same objects, structure hasn't changed).
- In `render()`, the culling filter reads the CURRENT interpolated `n.x`/`n.y`,
  so an animating node correctly appears/disappears based on its current
  position, not a stale one.
- The 220px margin provides additional buffer against animation flicker.

### 3c. Minimap — Correct

The minimap at lines 1508–1519 receives:
```typescript
.nodes=${this.layoutNodes}
.edges=${this.layoutEdges}
```

These are the FULL unculled arrays. The culled `visibleNodes`/`visibleEdges`
variables are local to `render()` and are only used for the SVG `<g>` elements.
The minimap always shows the complete graph. ✓

---

## 4. TypeScript Compilation

```
$ npx tsc --noEmit
```

Passes cleanly — zero errors.

---

## 5. Minor Fix: `allTasks.length` → `taskCount`

Line 1365: `this.store.taskCount === 0` replaces `this.store.allTasks.length === 0`.

`taskCount` is a getter returning `this.tasks.size` (Map size), which is O(1).
`allTasks` creates a shallow copy of the tasks array on every access. The
semantic is identical but `taskCount` avoids the unnecessary allocation. ✓

---

## 6. Nits (non-blocking)

### Nit 1: Comment says "half a node size" but margin is a full node width

Line 1390: *"A generous margin (half a node size) prevents pop-in"*

The actual margin is `Math.max(NODE_WIDTH, NODE_HEIGHT) = 220`, which is the
**full** `NODE_WIDTH`, not half. The behavior is correct (and generous), but
the comment is inaccurate. Consider updating to "a full node width."

---

## Summary

The PR implements viewport culling and a pan/zoom layout guard cleanly and
correctly. The AABB intersection math is standard and verified. The
`willUpdate()` guard correctly handles all identified property-change
scenarios, including the critical empty-changedProperties path for store
updates. Feature interactions with Solo mode, DnD FLIP animation, and the
minimap are all properly handled. TypeScript compiles cleanly.

**Verdict: APPROVE** — ship it.

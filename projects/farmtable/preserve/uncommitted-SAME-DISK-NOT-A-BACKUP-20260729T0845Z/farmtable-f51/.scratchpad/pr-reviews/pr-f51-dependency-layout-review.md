# Review: fix(web): align layer-0 tasks to leftmost column and anchor edges to node sides

**Commit:** `e3f18ae`
**Branch:** `fix/f51-dependency-view-layout`
**File:** `web/src/components/dependency/ft-dependency-view.ts`

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This commit replaces dagre-based automatic layout with a
deterministic manual layout that respects pre-computed `computeLayers()` layer
assignments and anchors edge bezier curves to node side-centers. The change is
clean, correctly addresses the stated bugs (layer-0 misplacement and
center-point edge anchoring), preserves all existing interaction handlers
(DnD, pan/zoom, centerGraph, centerOnNode), and the build passes with zero
type errors. Two minor issues worth addressing in a follow-up.

---

### Critical Issues

None.

---

### Important Issues

None.

---

### Suggestions

#### 1. O(N) node lookups per edge in render path — use a Map  
**Severity:** Medium  
**File:** `ft-dependency-view.ts:749-751`

In the render template, each edge performs two `Array.find()` calls against
`this.layoutNodes` to resolve source and target nodes:

```typescript
const src = this.layoutNodes.find((n) => n.id === e.from);
const tgt = this.layoutNodes.find((n) => n.id === e.to);
```

This is O(N) per lookup, making edge rendering O(E × N) overall. A `nodeMap`
is already built inside `runLayout()` (line 467) but is scoped as a local
variable and discarded. For typical small graphs this is negligible, but it's
an easy fix that also makes the code more consistent.

**Suggested Fix:**

Promote `nodeMap` to an instance field set alongside `this.layoutNodes`:

```typescript
// In class body:
private nodeMap = new Map<string, LayoutNode>();

// In runLayout(), after populating this.layoutNodes:
this.nodeMap = new Map(this.layoutNodes.map((n) => [n.id, n]));

// In render():
${this.layoutEdges.map((e) => {
  const src = this.nodeMap.get(e.from);
  const tgt = this.nodeMap.get(e.to);
  if (!src || !tgt) return null;
  return svg`<path d="${edgePath(src, tgt)}" class="edge-dependency" />`;
})}
```

---

#### 2. `LayoutEdge.points` is now vestigial  
**Severity:** Low (code clarity)  
**File:** `ft-dependency-view.ts:39-43` (interface), `ft-dependency-view.ts:482-485` (population)

The `LayoutEdge` interface still declares a `points` array and `runLayout()`
still populates it with two entries (src center, tgt center), but the render
method no longer reads `e.points` — it looks up full `LayoutNode` objects and
passes them to `edgePath()`. The `points` field is dead data.

**Suggested Fix:**

Either remove `points` from `LayoutEdge` entirely (simplest), or repurpose the
interface to store `src` / `tgt` node references directly if you want to avoid
the render-time lookup discussed above.

```typescript
interface LayoutEdge {
  from: string;
  to: string;
  // Remove `points` — no longer consumed by any caller
}
```

---

### What's Done Well

- **Clean dagre removal:** The import is removed only from this file; dagre
  remains available for `ft-tree-view.ts` which still uses it. No stale
  references left behind.

- **Correct `computeLayers()` reuse:** The existing pure-function layer
  computation (with cycle detection and `MAX_LAYER_DEPTH` cap) is now the
  single source of truth for X positioning, eliminating the bug where dagre
  reassigned ranks.

- **Elegant `edgePath()` rewrite:** The new cubic bezier from right-center →
  left-center with 40% control-point offsets produces a smooth S-curve. The
  math is correct:
  - `startX = src.x + src.width/2` (right edge)
  - `endX = tgt.x - tgt.width/2` (left edge)
  - Control points at 40% and 60% of dx, pinned to start/end Y respectively.

- **Edge-case resilience:** Cycles resolve to layer 0 (per `computeLayers()`),
  resulting in degenerate beziers (dx ≈ 0) that render as vertical lines —
  ugly but not broken. Empty graphs and single-node graphs are handled by
  existing early-return paths.

- **No regressions on interaction:** All DnD handlers (Feature 48),
  pan/zoom, `centerGraph()`, `centerOnNode()`, cycle detection, and the
  `structureKey` cache-invalidation remain untouched and intact.

- **Well-documented constants:** The new `LAYER_GAP`, `NODE_GAP`,
  `MARGIN_LEFT`, `MARGIN_TOP` static fields are clearly named and
  doc-commented, making future tuning easy.

---

### Verification Story

- **Tests reviewed:** No unit tests for this UI component (consistent with the
  rest of the web codebase — Lit components are not unit-tested here).
- **Build verified:** Yes — `tsc --noEmit && vite build` succeeds cleanly.
- **Lint/static analysis clean:** Yes — TypeScript compilation produces zero
  errors.
- **Security checked:** Yes — no security surface in this change (pure UI
  layout math, no user input handling, no network calls).

---

### Edge-Case Analysis

| Scenario | Behavior | Verdict |
|----------|----------|---------|
| Empty graph (no tasks) | `getVisibleTasks()` returns `[]`, render shows empty state | OK |
| Single unblocked task | Layer 0, positioned at (150, 80), no edges | OK |
| Deep chain (50+ layers) | Capped at `MAX_LAYER_DEPTH = 50` by `computeLayers()` | OK |
| Cycle (A ↔ B) | Both placed at layer 0, bezier with dx=0 renders as vertical | Acceptable |
| Back-edges (dx < 0) | Bezier control points flip; renders left-pointing curve | Acceptable |
| Many nodes in one layer | Vertical stacking with 40px gaps; no overlap | OK |

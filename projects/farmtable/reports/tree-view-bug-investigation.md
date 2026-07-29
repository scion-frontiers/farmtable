# Tree View Infinite Vertical-Space Bug — Investigation Report

**Date:** 2026-07-20
**Investigator:** investigator agent
**Reported by:** ptone@google.com
**Severity:** Medium-High — affects all collections in tree view; causes unbounded DOM growth and performance degradation on the live service

---

## Summary

The tree view's SVG element uses the default `display: inline`, which adds descender-line baseline spacing (~4px) below the SVG on every render. A `ResizeObserver` on the `.canvas-container` detects this height increase, calls `requestUpdate()`, which re-renders with a taller viewBox, triggering the observer again — creating an infinite feedback loop that grows the page by ~250px/second. The fix is a single CSS addition: `display: block` on the SVG element (`ft-tree-view.ts:65`). The bug is **not hierarchy-specific** — it reproduces on all collections with any tasks in tree view, including the flat 4-node "default" collection.

---

## Reproduction

**URL:** `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d&view=tree`

**Steps:**
1. Open the URL above (or any collection with tasks in `?view=tree`)
2. Wait — no user interaction needed
3. Observe the page growing taller continuously

**Observed behavior:**
- Page document height grows linearly: 1902px → 7903px in 24 seconds (~250px/second)
- The `.canvas-container` div inside `ft-tree-view`'s shadow DOM is what grows
- SVG viewBox height attribute grows proportionally (5753 → 13747)
- DOM node count is STABLE throughout (74 shadow DOM nodes, 24 foreignObject elements) — no elements are being added
- The tree view's `requestUpdate()` is called ~60 times/second (300 calls in 5 seconds)

**Expected behavior:**
- Tree view fills its allocated viewport area and stays stable

**Confirmed affected:**
| Collection | Tasks | Growth |
|---|---|---|
| External Store Passthrough (24 tasks, hierarchical) | 24 | ~240px/s |
| default (4 tasks, flat) | 4 | ~240px/s |
| smoke-test (0 tasks) | 0 | 0px/s (no SVG rendered) |

---

## Root Cause

**File:** `web/src/components/tree/ft-tree-view.ts`
**Mechanism:** ResizeObserver ↔ SVG inline baseline feedback loop

### The chain of events:

1. **SVG is `display: inline` (default)** — `ft-tree-view.ts:63-68` styles the SVG with `width: 100%; height: 100%` but does NOT set `display: block`. As an inline replaced element, the SVG sits on the text baseline inside `.canvas-container`, creating ~4px of descender spacing below it in the anonymous line box.

2. **`.canvas-container` grows by ~4px** — The descender spacing makes the container's content height slightly larger than the SVG element's height. This ~4px extra space increases the container's rendered height.

3. **ResizeObserver fires** — `ft-tree-view.ts:156-164` has a `ResizeObserver` watching `.canvas-container`. It detects the height change, stores `this.containerHeight = entry.contentRect.height`, and calls `this.requestUpdate()`.

4. **Re-render uses inflated height** — In `render()` (`ft-tree-view.ts:537`), the SVG viewBox is computed as:
   ```
   vbH = this.containerHeight / this.scale   // ft-tree-view.ts:545
   ```
   The taller `containerHeight` produces a taller viewBox.

5. **SVG renders with taller viewBox** — The SVG element's CSS size stays at `100%` of the container, but the viewBox attribute changes. This does NOT directly change the SVG's CSS layout size, but the inline baseline spacing persists, adding another ~4px.

6. **Loop repeats at ~60fps** — Each browser frame: container is ~4px taller → ResizeObserver fires → requestUpdate → new viewBox → render → container is ~4px taller again. At 60fps: 4px × 60 = 240px/second of growth. ✓ Matches observed rate.

### Why the container height doesn't self-correct:

The `.canvas-container` has `flex: 1` in a column flex layout, but its `min-height` defaults to `auto`. For a flex item with non-`visible` overflow (`overflow: hidden`), the automatic min-height SHOULD be 0. However, the SVG's intrinsic size (derived from the viewBox aspect ratio) initially inflates the container beyond the flex-allocated height. Once inflated, the feedback loop prevents it from ever shrinking back — each render adds a few more pixels.

### Evidence from controlled experiments:

| Experiment | Growth in 10s | Conclusion |
|---|---|---|
| No fix (baseline) | ~2400px | Bug reproduces |
| `svg { display: block }` | **0px** | **Fixes the bug** |
| `canvas-container { overflow: auto; min-height: 0 }` | ~2400px | Does not fix |
| `min-height: 0` on all containers | ~2400px | Does not fix |
| ResizeObserver disconnected | **0px** | Confirms observer is the feedback path |
| `display: block` + all `min-height: 0` | **0px** | Fixes (display: block is the key) |

---

## Scope Recommendation

**XS** — Single-line CSS fix.

---

## Recommended Approach

### Primary fix (stops the infinite growth):

In `web/src/components/tree/ft-tree-view.ts`, line 65, add `display: block` to the SVG style rule:

```css
svg {
  display: block;    /* ← ADD: prevents inline baseline spacing feedback loop */
  width: 100%;
  height: 100%;
  cursor: grab;
}
```

### Optional hardening fix (prevents initial height inflation):

In the same file, add `min-height: 0` to `.canvas-container` (line 60):

```css
.canvas-container {
  flex: 1;
  min-height: 0;    /* ← ADD: prevent SVG intrinsic height from inflating flex item */
  position: relative;
  overflow: hidden;
}
```

This second fix addresses a separate issue where the container initially renders taller than its flex allocation (e.g., 1718px instead of ~788px) because the SVG's intrinsic size (from the viewBox) overrides the flex-allocated height via `min-height: auto`. Adding `min-height: 0` constrains the container to its flex-allocated size, though the tree graph content itself still looks correct due to the SVG viewBox scaling.

### What NOT to change:

- The ResizeObserver itself is fine — it correctly handles window resizing. The issue is that the SVG's inline display creates spurious resize events.
- The Dagre layout, viewBox computation, and `centerGraph()` logic are all correct — they're victims of the feedback loop, not its cause.

---

## Open Questions

1. **Should the initial height inflation be fixed too?** Even with `display: block`, the tree view's initial height exceeds the viewport (1718px vs ~788px expected) because the SVG's intrinsic size from the viewBox overrides the flex item's height via `min-height: auto`. The `min-height: 0` fix addresses this but may change the visual appearance of the graph. A developer should verify that the graph still looks correct when constrained to the viewport height.

2. **Performance on the live service:** With ~300 requestUpdate calls per 5 seconds and continuous DOM height growth, this bug causes real performance degradation for any user who opens tree view. The fix should be deployed promptly.

---

## Artifacts

Screenshots confirming the bug (in `/tmp/`):
- `tree-t0.png` through `tree-t8.png` — progression over 24 seconds
- `tree-exp1-block.png` — stable after `display: block` fix
- `tree-default-col.png` — reproduces on flat 4-task default collection

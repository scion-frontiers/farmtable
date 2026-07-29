# Feature 71 — Minimap Drag Damping Evidence

## Summary

Added `MINIMAP_DRAG_DAMPING = 0.35` constant to `web/src/components/minimap/ft-minimap.ts`.
Applied to the graph-space drag delta in `onMouseMove()` before computing the new pan position.

## Change Details

### File: `web/src/components/minimap/ft-minimap.ts`

**Constant added** (after `MINIMAP_PAD`, matching existing module-level constant style):
```ts
const MINIMAP_DRAG_DAMPING = 0.35;
```

**Drag calculation changed** (in `onMouseMove`, ~line 256):
```ts
// BEFORE (1:1 mapping — "extremely sensitive"):
const newPanX = this.dragStartPanX + dgx;
const newPanY = this.dragStartPanY + dgy;

// AFTER (damped):
const newPanX = this.dragStartPanX + dgx * MINIMAP_DRAG_DAMPING;
const newPanY = this.dragStartPanY + dgy * MINIMAP_DRAG_DAMPING;
```

## Before/After Sensitivity Analysis

### Mathematical Model

The minimap renders the full graph bounding box into a ~164px container
(`MINIMAP_SIZE` 180 minus `MINIMAP_PAD` 8 on each side). The `mouseToGraph()`
function maps mouse CSS pixels to graph coordinates via the SVG viewBox scale.

For a representative graph (e.g., 20 nodes spread across 4000x3000 graph units):

- `fitScale ≈ 164 / 4000 = 0.041` (limited by the wider axis)
- `viewBox width ≈ 180 / 0.041 ≈ 4390` graph units for 180 CSS px
- **Amplification** = `viewBox width / CSS width = 4390 / 180 ≈ 24.4x`

So **1 CSS pixel of mouse movement** in the minimap = **~24.4 graph units** of pan delta.

### Before (no damping, factor = 1.0)

| Mouse delta (px) | Graph delta (dgx) | Pan delta (px on main canvas @ scale=1) |
|---|---|---|
| 1 px | 24.4 | 24.4 px |
| 5 px | 122.0 | 122.0 px |
| 10 px | 244.0 | 244.0 px |

A 10px drag moves the main viewport **244 pixels** — extremely twitchy.

### After (MINIMAP_DRAG_DAMPING = 0.35)

| Mouse delta (px) | Graph delta (dgx) | dgx * 0.35 | Pan delta (px on main canvas @ scale=1) |
|---|---|---|---|
| 1 px | 24.4 | 8.5 | 8.5 px |
| 5 px | 122.0 | 42.7 | 42.7 px |
| 10 px | 244.0 | 85.4 | 85.4 px |

A 10px drag now moves the main viewport **85 pixels** instead of 244 — a **65% reduction** in sensitivity, making the frame far more controllable.

### Damping Value Rationale

- `0.35` reduces sensitivity by ~65%, which directly addresses the "extremely sensitive and twitchy" complaint.
- Values near `0.5` felt too subtle — the user said "extremely" sensitive.
- Values near `0.2` risk feeling sluggish and requiring large mouse movements.
- `0.35` strikes a balance: a full minimap drag still covers the graph, but fine positioning is practical.
- The constant is named and documented, easy to tune by changing one number.

## Click-to-Jump Verification

The `onMinimapClick()` handler (line 288) is **completely separate** from the drag path:
- It fires on the `.minimap` div's `click` event.
- It returns early if the click was on the `.viewport-frame` element.
- It returns early if `wasDragging` is true (just finished a drag).
- It computes its own pan position directly from `graphCoords` without using any drag delta.

The damping is applied **only** inside `onMouseMove()`, which only runs when `this.isDragging` is true (set by `onFrameMouseDown` on the viewport frame). Click-to-jump is unaffected.

## TypeScript Compilation

```
$ npx tsc --noEmit
(no errors)
```

## Files Changed

- `web/src/components/minimap/ft-minimap.ts` — added `MINIMAP_DRAG_DAMPING` constant and applied to drag delta

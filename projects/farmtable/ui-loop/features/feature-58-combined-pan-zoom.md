# F58: Combined Pan+Zoom Animation Fix

**Date:** 2026-07-22
**Branch:** `fix/f58-combined-pan-zoom-animation`
**Commit:** `8ae934f`

## Problem

After F56 (zoom-to-target-size on selection), selecting a task node in the
Tree or Dependency view caused a jarring viewport jump. The viewport would
snap instantly to center the node, then only the zoom animated smoothly.

## Root Cause

F56 replaced the original `animatePanTo()` (which interpolated `startPanX →
targetPanX`) with `animatePanZoomTo()` that derived pan from the node's
world-space position each frame:

```typescript
// Broken: ignores starting viewport position
this.panX = nodeX - curVbW / 2;
this.panY = nodeY - curVbH / 2;
```

On frame 0 (`easedT ≈ 0`), this set `panX` to center the node at the
starting scale — an instant jump from wherever the viewport actually was.
The `startPanX`/`startPanY` capture was removed in the F56 rewrite, so
the starting position was lost.

## Fix

Restored start-position capture and introduced viewport-center interpolation:

1. Capture `startPanX`, `startPanY`, `startScale` at animation start.
2. Compute `startCenterX/Y` — the current viewport center in world-space.
3. Each frame: interpolate the viewport center from `startCenter` toward
   `nodeX/nodeY` using the eased `t`, then derive pan from the interpolated
   center and interpolated scale.

```typescript
const curCenterX = startCenterX + (nodeX - startCenterX) * easedT;
const curCenterY = startCenterY + (nodeY - startCenterY) * easedT;
this.panX = curCenterX - curVbW / 2;
this.panY = curCenterY - curVbH / 2;
```

This gives smooth coordinated pan+zoom with no frame-0 discontinuity.

## Files Changed

- `web/src/components/tree/ft-tree-view.ts` — `animatePanZoomTo()`
- `web/src/components/dependency/ft-dependency-view.ts` — `animatePanZoomTo()`

## Verification

- **TypeScript:** `tsc --noEmit` passes
- **Vite build:** clean
- **Go build/test:** all pass
- **Boundary analysis:**
  - Frame 0 (`easedT=0`): `panX = startPanX` (no jump)
  - Final frame (`easedT=1`): drift guard sets exact targets (node centered)
  - Mid-animation: continuous, no discontinuities

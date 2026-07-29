# Feature 56: Zoom-to-Target-Size on Selection + More Prominent Highlight

## Summary

Implemented two enhancements to both the parent-child Tree view and the Dependency view:
1. Animated zoom-to-target-size when a task node is selected
2. More prominent highlight (halo effect) on the selected node

## Change 1: Zoom-to-Target-Size

### Formula

```
targetScale = (0.20 * containerWidthPx) / NODE_WIDTH
```

Where:
- `containerWidthPx` = pixel width of the SVG container element (tracked via ResizeObserver)
- `NODE_WIDTH` = 220 SVG units (existing constant)
- `0.20` = target fraction of viewport width (20%)

For a 1440px viewport: `targetScale = (0.20 * 1440) / 220 = 1.309`

### Clamp Bounds: 0.3 - 3.0

**Rationale**: These match the existing wheel zoom clamp bounds already used in both views' `onWheel()` handlers and `centerGraph()` methods. The bounds are well-tested:
- **0.3x minimum**: Prevents zooming out so far that nodes become illegible. At 0.3x, NODE_WIDTH renders at 66 SVG-units worth of viewport space — still barely readable.
- **3.0x maximum**: Prevents excessive zoom-in that would make the tree unusable for navigation. At 3.0x, a single node would occupy ~45% of a 1440px viewport.
- For the 20% target on a 1440px viewport, the computed scale is ~1.31 — comfortably within bounds.

### Animation Approach

Modified `animatePanTo()` → `animatePanZoomTo()` in both views to interpolate scale AND pan together:

1. Compute `targetScale` from the formula above
2. Compute `targetPanX/Y` using the target scale for centering
3. In each animation frame (750ms duration, ease-in-out):
   - Interpolate scale: `curScale = startScale + (targetScale - startScale) * easedT`
   - Recompute pan from the focal node position using the interpolated scale: `panX = nodeX - (containerWidth / curScale) / 2`
   - This ensures the node stays visually centered throughout the animation at every intermediate zoom level — no jumpy/janky artifacts

### Files Modified

- `web/src/components/tree/ft-tree-view.ts`: `centerOnNode()` and `animatePanZoomTo()` (renamed from `animatePanTo()`), plus `overflow="visible"` on selected foreignObject
- `web/src/components/dependency/ft-dependency-view.ts`: Same changes

## Change 2: More Prominent Highlight

### CSS Values

```css
.node.selected {
  border-color: var(--sl-color-primary-500);
  border-width: 3px;                                           /* was 2px */
  box-shadow: 0 0 0 3px transparent, 0 0 0 6px rgba(99, 102, 241, 0.45);
}
```

**Before**: `border: 2px; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4)`
**After**: `border: 3px; box-shadow: 0 0 0 3px transparent, 0 0 0 6px rgba(99, 102, 241, 0.45)`

The two-layer box-shadow creates a halo effect:
- First shadow (3px, transparent): creates a visible gap between the node border and the outer ring
- Second shadow (6px, semi-transparent indigo): creates the colored halo ring

Additionally, `overflow="visible"` was set on the SVG `foreignObject` for selected nodes in both views to prevent clipping of the box-shadow halo.

### File Modified

- `web/src/components/tree/ft-tree-node.ts`: `.node.selected` CSS rule (shared by both views)

## Verification Results

Measured using Playwright (headless Chromium, 1440x900 viewport):

| View             | Node Width (px) | Viewport Width (px) | % of Viewport |
|------------------|-----------------|---------------------|---------------|
| Tree View        | 281.6           | 1440                | **19.6%**     |
| Dependency View  | 281.6           | 1440                | **19.6%**     |
| Target           | —               | —                   | ~20%          |

The slight difference from exactly 20% is due to the 3px border width on the selected node (border-box sizing means the content width is slightly less than NODE_WIDTH).

Screenshots saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight/`

# Feature 51: Dependency View Layout Fixes

**Date:** 2026-07-22
**PR:** #128
**Branch:** `fix/f51-dependency-view-layout`

## What Changed

Fixed two layout bugs in the Dependency View (`ft-dependency-view.ts`):

1. **Layer-0 alignment**: Replaced dagre-driven layout with manual layout. Dagre's simplex ranking ignored pre-computed layer assignments, misplacing some unblocked tasks. Now uses `computeLayers()` directly for X positioning — all layer-0 nodes share the same X coordinate.

2. **Edge anchoring**: Replaced dagre's center-point edge paths with custom cubic bezier curves from right-edge of source to left-edge of target, preventing edges from routing through task boxes.

## Root Cause

Both bugs stemmed from the same root: reliance on dagre for layout when the component already had its own correct layering algorithm. Dagre ignored the `rank` property set on nodes and optimized for edge length instead. The fix was to bypass dagre entirely and use manual positioning.

## Key Decision

Removed dagre from this component (import removed, npm dep retained for ft-tree-view.ts). The manual layout is simpler, gives us full control, and eliminates a class of bugs where the layout engine disagrees with our layering semantics.

# Feature 41: Animated Tree-View Centering on Task Selection

## Summary

Added smooth 750ms ease-in-out animation to the tree view's centering
behavior when a task is selected, replacing the previous instant snap.

## What Changed

### `web/src/components/tree/ft-tree-view.ts`

1. **`animationFrameId` field** — new private field tracks the active
   `requestAnimationFrame` ID so in-progress animations can be cancelled.

2. **`easeInOut(t)` method** — quadratic ease-in-out curve used by the
   animation loop.

3. **`animatePanTo(targetPanX, targetPanY)` method** — drives a 750ms
   `requestAnimationFrame` loop that interpolates `panX`/`panY` from their
   current values to the target using the ease-in-out curve.

4. **`centerOnNode(taskId)` updated** — now computes the target pan
   coordinates and delegates to `animatePanTo()` instead of setting
   `panX`/`panY` directly.

5. **`disconnectedCallback()` updated** — cancels any in-progress animation
   frame to prevent orphaned callbacks.

## Design Decision: Rapid Re-selection (Cancel-and-Restart)

When `animatePanTo()` is called while an animation is already running:

- The current animation is cancelled via `cancelAnimationFrame()`.
- The current interpolated `panX`/`panY` are snapshot as the new start values.
- A fresh 750ms animation begins toward the new target.

This "cancel-and-restart from current position" approach gives smooth
redirect behavior — no jumping to the old target, no queueing animations.
The user sees the viewport smoothly change direction mid-flight.

## Code Review (Round 1 → Round 2)

### Round 1 Findings (all fixed in commit `28fc26f`)
1. **Important**: Manual pan (`onMouseDown`) didn't cancel animation → fixed with `cancelPanAnimation()`.
2. **Important**: Wheel zoom (`onWheel`) didn't cancel animation → fixed with `cancelPanAnimation()`.
3. **Important**: `centerGraph()` didn't cancel animation → fixed with `cancelPanAnimation()`.
4. **Suggestion**: Extracted `cancelPanAnimation()` helper method (DRY across 4+ sites).
5. **Suggestion**: Made `easeInOut` a `static` method (pure function, no `this` dependency).
6. **Suggestion**: Enhanced floating-point drift guard comment.
7. **Suggestion**: Added Lit reactive churn performance NOTE.

### Round 2 Verdict: **APPROVED** — all findings resolved, no new issues.

## What Was NOT Changed

- `centerGraph()` remains instant (no animation) — used only for initial
  full-graph framing.
- No changes to Kanban, Dashboard, or Ready-Queue views.
- SVG viewBox rendering approach unchanged.

## Verification Evidence

Screenshot sequences and viewBox data captured during Playwright testing are at:
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-41-tree-center-animation/`

- Animation 1 (click last node): viewBox progressively changed across 6 distinct
  values in 10 frames (~1s capture window). panX: -48 → -365, panY: -298 → -214.
- Animation 2 (click first node): 6 distinct viewBox values in 8 frames.
  panX: -364 → -268, panY: -215 → -354.
- Scale remained constant during both animations (zoom level preserved).
- Inspector Relationships tab visible but seed data had no relationship links.

## Files Modified

- `web/src/components/tree/ft-tree-view.ts` (+69 lines, -3 lines)

## Build Verification

```
$ cd web && npm ci --prefer-offline && npm run build
✓ tsc --noEmit (type check passed)
✓ vite build (337 modules, built in 2.93s)
```

## Commits

1. `918625e` — `feat(web): animate tree-view centering on task selection`
2. `28fc26f` — `fix(web): address review findings for tree-view animation`

# PR Review: feat/f56-zoom-and-highlight

**Branch:** `feat/f56-zoom-and-highlight` vs `origin/main`  
**Commit:** `ffafe33 feat(web): zoom-to-target-size on node selection + prominent highlight halo (F56)`  
**Files changed:** 3 (ft-tree-view.ts, ft-dependency-view.ts, ft-tree-node.ts)  
**Lines:** +83 / -30

---

## Executive Summary

Low-risk UI enhancement that adds animated zoom-to-target-size on node selection and a more prominent selection halo across both tree views. The implementation is clean, consistent between the two views, and the animation math is correct. Two minor code quality issues — dead variables and a subtle CSS side-effect on the left priority border — are worth addressing before merge.

---

## Review Summary

**Verdict:** APPROVE (with minor cleanup)

**Overview:** This is a well-structured feature change that touches animation logic and CSS styling in three files. The zoom animation approach (recomputing pan from focal point each frame) is the correct pattern for smooth zoom+pan transitions. The two views share identical animation logic, which is good for consistency. No correctness bugs found; findings are limited to dead code and a minor CSS interaction.

---

## Critical Issues

None.

---

## Important Issues

### 1. Dead variables: `startPanX` / `startPanY` in both animation functions

**Severity:** Important (code quality)  
**Files:** `ft-tree-view.ts:252-253`, `ft-dependency-view.ts:340-341`

Both `animatePanZoomTo()` implementations capture `startPanX` and `startPanY` but never reference them in the animation loop. The old `animatePanTo()` used these for linear pan interpolation, but the new focal-point approach computes pan purely from `nodeX`/`nodeY` and the interpolated scale:

```ts
// These are assigned but never read:
const startPanX = this.panX;  // line 252 (tree-view), line 340 (dependency-view)
const startPanY = this.panY;  // line 253 (tree-view), line 341 (dependency-view)

// Animation loop only uses nodeX/nodeY + curScale:
this.panX = nodeX - curVbW / 2;
this.panY = nodeY - curVbH / 2;
```

The behavior is correct (focal-point centering is the right approach), but the dead variables are confusing — a future maintainer might think they're needed.

**Suggested fix:** Remove the two dead variable declarations from both files.

```diff
  private animatePanZoomTo(...) {
    this.cancelPanAnimation();

-   const startPanX = this.panX;
-   const startPanY = this.panY;
    const startScale = this.scale;
```

---

### 2. `border-width: 3px` in `.node.selected` overrides the 5px left priority accent

**Severity:** Important (visual regression)  
**File:** `ft-tree-node.ts:81`

The base `.node` style sets `border-left: 5px solid var(--node-priority-color)` as a priority indicator. The new `.node.selected` rule adds `border-width: 3px`, which is a shorthand setting all four border widths. Because `.node.selected` has higher specificity (0,2,0) than `.node` (0,1,0), the left border shrinks from 5px to 3px when a node is selected.

Before this PR, `.node.selected` only set `border-color` — the left border kept its 5px width (color changed but accent thickness preserved). Now the left accent narrows on selection, which is a subtle visual regression.

Additionally, with `box-sizing: border-box`, the content area shifts by 1px on three sides (top, right, bottom go 2px→3px) and shifts 2px on the left side (5px→3px), causing a small layout jitter on selection.

**Suggested fix:** Either preserve the left border width explicitly:

```css
.node.selected {
  border-color: var(--sl-color-primary-500);
  border-width: 3px;
  border-left-width: 5px;
  box-shadow: 0 0 0 3px transparent, 0 0 0 6px rgba(99, 102, 241, 0.45);
}
```

Or, if the uniform 3px border is intentional, add an `outline` offset approach instead that avoids changing border widths at all:

```css
.node.selected {
  border-color: var(--sl-color-primary-500);
  outline: 3px solid rgba(99, 102, 241, 0.45);
  outline-offset: 3px;
}
```

---

## Suggestions

### 3. Consider extracting the target-size fraction (0.20) as a named constant

**Severity:** Suggestion  
**Files:** `ft-tree-view.ts:211`, `ft-dependency-view.ts:312`

The magic number `0.20` (20% of viewport width) appears in both files. Extracting it as a named constant (e.g., `TARGET_NODE_VIEWPORT_FRACTION`) would improve readability and make it trivial to tune later.

```ts
/** Fraction of viewport width the selected node should occupy after zoom. */
private static readonly TARGET_NODE_VIEWPORT_FRACTION = 0.20;
```

### 4. The `targetPanX`/`targetPanY` parameters are only used on the final frame

**Severity:** Suggestion (readability)  
**Files:** `ft-tree-view.ts:242-246`, `ft-dependency-view.ts:331-336`

`targetPanX` and `targetPanY` are passed to `animatePanZoomTo()` but only assigned on the very last frame (the `t >= 1` branch) as a floating-point drift guard. The intermediate frames compute pan from `nodeX`/`nodeY`. This is correct, but the function signature suggests they're used throughout the animation. A brief inline comment on the parameters would clarify their "final-frame-only" role. (The `nodeX`/`nodeY` doc comment partially covers this, but the distinction could be sharper.)

### 5. Halo overflow with dense graphs

**Severity:** Suggestion (UX edge case)  
**Files:** `ft-tree-view.ts:733`, `ft-dependency-view.ts:831`

Setting `overflow="visible"` on the selected `foreignObject` allows the 6px box-shadow halo to render outside the node bounds. In dense graphs where nodes are closely packed (especially in the dependency view with `NODE_GAP = 40`), the halo (extends ~6px each side) could visually overlap adjacent nodes. This is likely acceptable for the current layout, but worth testing with a highly populated view.

---

## What's Done Well

1. **Focal-point centering animation:** Computing pan from the node position and interpolated scale each frame (rather than linearly interpolating pan separately) is the correct approach. It keeps the node visually anchored at viewport center throughout the zoom transition, avoiding the "swim" artifact that linear pan+zoom interpolation produces.

2. **Consistent implementation across both views:** The `centerOnNode()` and `animatePanZoomTo()` logic is identical in both `ft-tree-view.ts` and `ft-dependency-view.ts`, including the same scale clamp range `[0.3, 3]`, animation duration (750ms), and easing function. This ensures users get the same experience regardless of which view they're in.

3. **Clean cancellation semantics:** The existing `cancelPanAnimation()` pattern is correctly reused — starting a new animation while one is running snapshots the current interpolated state and restarts cleanly. No race conditions or janky interruption behavior.

4. **Smart use of `overflow="visible"`:** Toggling foreignObject overflow only for the selected node keeps unselected nodes clipped (preventing paint-outside-bounds issues with CSS effects like shadows) while letting the selected node's halo render fully.

5. **Floating-point drift guard:** Explicitly setting exact target values on the final frame (`this.scale = targetScale; this.panX = targetPanX; this.panY = targetPanY;`) prevents cumulative floating-point errors from leaving the viewport slightly off-center after the animation settles.

6. **TypeScript compiles clean:** `tsc --noEmit` passes with no errors.

---

## Verification Story

- **Tests reviewed:** No test changes in this PR. No existing tests for these view components were found. This is expected for animation/CSS-only UI changes.
- **Build verified:** Yes — `tsc --noEmit` passes cleanly.
- **Lint/static analysis clean:** Yes (no TypeScript errors).
- **Security checked:** Yes — no user input handling, no network calls, no credential exposure in this change. Pure UI rendering.

---

## Final Verdict: APPROVE

The code is correct and well-implemented. The two Important findings (dead variables and the border-width side-effect on the priority accent) are minor cleanup items that don't block merge but should be addressed in a follow-up or squashed into this commit before landing. No Critical issues found.

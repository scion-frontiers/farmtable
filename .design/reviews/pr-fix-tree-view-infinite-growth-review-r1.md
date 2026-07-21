# Review: fix/tree-view-infinite-growth

**Commit:** b4ac5ac — `fix: add display:block to tree view SVG to stop infinite resize loop`
**File:** `web/src/components/tree/ft-tree-view.ts` (2 lines added)
**Reviewer:** Code Review Agent — R1
**Date:** 2026-07-20

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a minimal, well-targeted CSS fix for a real production bug — an infinite ResizeObserver → requestUpdate → re-render feedback loop caused by SVG inline-display baseline spacing. Both lines are standard CSS mitigations for well-known flexbox/SVG layout pitfalls and carry no functional risk.

---

## Analysis

### Root Cause Validation

The described root cause is correct and well-understood:

1. **SVG `display: inline` (the default)** renders the `<svg>` as an inline-replaced element. Per CSS spec, inline elements participate in baseline alignment, which adds descender spacing (~3-4px) below the SVG's content box. This extra space inflates the parent `.canvas-container`'s content height.

2. **ResizeObserver fires** on `.canvas-container` (line 158–166), picks up the new height, sets `this.containerHeight`, and calls `this.requestUpdate()`.

3. **LitElement re-renders**, the SVG re-lays-out, baseline spacing is added *again* to the now-taller container, and the loop repeats. Growth rate ~4px/frame at 60fps = ~240px/s — consistent with the reported ~250px/s.

### Fix Assessment

| Change | Purpose | Correctness |
|--------|---------|-------------|
| `svg { display: block; }` | Eliminates baseline alignment context. Block-level SVGs have no descender gap. This is the canonical fix for the "extra space below inline SVG" problem. | ✅ Correct and idiomatic |
| `.canvas-container { min-height: 0; }` | Prevents the flex child from using its content's intrinsic minimum height, which can cause unbounded growth when `flex: 1` and `overflow: hidden` interact with a content-sized SVG. Standard flexbox overflow pattern. | ✅ Correct and idiomatic |

Both properties together break the feedback loop at two points — the SVG no longer inflates its container, and the container no longer propagates content-height growth upward through the flex axis.

### Side Effect Analysis

**`display: block` on SVG:**
- The SVG already has `width: 100%; height: 100%` — it fills its container identically as block or inline. No visual change.
- Mouse events, viewBox, panning, and wheel zoom are unaffected by display mode.
- `cursor: grab` / `cursor: grabbing` work identically on block elements.

**`min-height: 0` on `.canvas-container`:**
- The container already has `overflow: hidden`, so content is clipped regardless. `min-height: 0` simply allows the flex algorithm to shrink the container below its content's intrinsic size — exactly the intent when using `flex: 1` to fill available space.
- This is the W3C-recommended pattern for flex items that contain overflowing content (the default `min-height: auto` is the common source of flex overflow bugs).

**No regressions identified.** Both properties are additive CSS declarations that don't alter the visual output when the layout is stable — they only prevent the unstable runaway case.

### Interaction with ResizeObserver

The ResizeObserver callback (lines 158–166) calls `this.requestUpdate()` on every resize. With the fix applied:
- Initial render sets a stable container size.
- SVG renders at that size with no extra spacing → container size unchanged → ResizeObserver does not fire again.
- The feedback loop is broken.

Note: the ResizeObserver callback does *not* debounce or guard against no-change events. This is acceptable because the fix eliminates the source of spurious size changes rather than masking them. A debounce guard would be a defense-in-depth improvement but is not necessary for this hotfix.

---

### Critical Issues

None.

### Important Issues

None.

### Suggestions

- **[ft-tree-view.ts:158–165] Defense-in-depth guard on ResizeObserver callback.** Consider adding a size-change threshold check to avoid re-renders on sub-pixel rounding differences. This is not required for the fix but would harden against future layout regressions.

  ```typescript
  this.resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w === this.containerWidth && h === this.containerHeight) return;
      if (w > 0) this.containerWidth = w;
      if (h > 0) this.containerHeight = h;
      this.requestUpdate();
    }
  });
  ```

### What's Done Well

- **Correct root cause analysis.** The fix targets the actual CSS layout behavior (`display: inline` baseline spacing) rather than applying a workaround (e.g., clamping height, debouncing the observer, or adding `overflow: hidden` to the SVG itself).
- **Minimal change surface.** Two additive CSS declarations, no logic changes, no new state — ideal for a production hotfix.
- **Both lines reinforce each other.** `display: block` eliminates the immediate trigger; `min-height: 0` prevents the flex container from propagating any residual content-height growth. This is belt-and-suspenders done right.
- **Commit message is clear and specific.** Describes both what and why.

### Verification Story

- Tests reviewed: No frontend unit tests exist for this component (no `.test.ts` or `.spec.ts` files found). This is pre-existing — the PR doesn't reduce coverage.
- Build verified: **Yes** — `tsc --noEmit` passes clean.
- Lint/static analysis clean: **Yes** — no TypeScript errors.
- Security checked: **N/A** — pure CSS change with no security surface.

# PR Review: feat/f41-tree-center-animation — Animated Tree-View Centering on Task Selection

**File:** `web/src/components/tree/ft-tree-view.ts` — 61 insertions, 3 deletions

## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** The animation implementation is well-structured — the rAF loop, easing math, cancel-and-restart logic, and lifecycle cleanup are all correct. However, there are two **Important** interaction bugs: manual panning and wheel-zoom can fight with a running animation, producing jittery or contradictory viewport movement, and a redundant final-value assignment in the animation loop. No critical / security issues.

---

### Critical Issues

None.

### Important Issues

#### 1. Manual pan does not cancel in-flight animation
**File:** `ft-tree-view.ts:409-427` (existing code, but the new animation creates the bug)

**Description:** `onMouseDown` / `handleMouseMove` directly sets `panX`/`panY` while `animatePanTo` is still scheduling rAF frames that also write to `panX`/`panY`. The result: during the 750 ms animation window, the user's drag and the animation fight each other frame-by-frame, producing a jittery back-and-forth pan.

**Failure scenario:** User clicks a task (triggering `centerOnNode` → animation starts), then immediately grabs the canvas and drags. The viewport oscillates between the user's drag position and the animation's interpolated position on alternating frames.

**Suggested fix:**
```ts
// In onMouseDown, cancel any running animation before starting a manual pan:
private onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  const tgt = e.target as Element;
  if (tgt.closest('ft-tree-node') || tgt.closest('foreignObject')) return;

  // Cancel any selection-centering animation so the user takes control.
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  this.isPanning = true;
  this.panStartX = e.clientX;
  this.panStartY = e.clientY;
  this.panStartViewX = this.panX;
  this.panStartViewY = this.panY;
  e.preventDefault();
}
```

#### 2. Wheel-zoom does not cancel in-flight animation
**File:** `ft-tree-view.ts:433-447` (existing code, same interaction class)

**Description:** `onWheel` recalculates `panX`/`panY` to keep the zoom centered on the cursor. If the animation is still running, the next rAF frame immediately overwrites those values with an interpolated position that was computed for the *old* scale, creating a visual jump and then a fight for the remaining animation frames.

**Failure scenario:** User selects a task, then immediately scrolls to zoom. The viewport snaps between the zoom-adjusted position and the animation's pre-zoom interpolation on every frame.

**Suggested fix:**
```ts
private onWheel(e: WheelEvent) {
  e.preventDefault();

  // Cancel any selection-centering animation — zoom takes priority.
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  // ... rest unchanged
}
```

#### 3. `centerGraph()` does not cancel in-flight animation
**File:** `ft-tree-view.ts:368-405`

**Description:** If `centerGraph()` fires (e.g. on a layout re-computation after structure change) while an animation from a previous selection is still running, `centerGraph()` sets `panX`/`panY` instantly but the rAF callback will overwrite them on the next frame. This is a narrower window than issues #1/#2 but still reachable: rapidly select a task, then toggle an expand/collapse (which clears `lastStructureKey` and triggers `needsCenter → centerGraph()`).

**Suggested fix:** Add the same cancellation guard at the top of `centerGraph()`:
```ts
private centerGraph() {
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
  if (this.layoutNodes.length === 0) return;
  // ... rest unchanged
}
```

Alternatively, extract the cancellation into a small `private cancelPanAnimation()` helper and call it from all four sites (the three above + `disconnectedCallback`).

---

### Suggestions

#### 4. Redundant final-value assignment on last frame
**File:** `ft-tree-view.ts:246-257`

**Description:** On the last iteration, when `t` reaches 1, `easeInOut(1) === 1`, so lines 247-248 already compute the exact target values (`startPan + (target - start) * 1 = target`). The explicit re-assignment on lines 254-255 is harmless but redundant — it exists "just in case" of floating point drift, but IEEE 754 `a + (b - a) * 1.0` is exact when `t` is exactly `1`. This is a minor readability nit; keeping the guard is fine as documentation of intent, but a comment explaining *why* would help future readers.

#### 5. Consider extracting `cancelPanAnimation()` helper
With four cancellation sites (issues #1-3 plus `disconnectedCallback`), the repeated three-line pattern would be cleaner as:
```ts
private cancelPanAnimation() {
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
}
```

#### 6. Lit reactive churn during animation
**File:** `ft-tree-view.ts:247-248`

**Description:** `panX` and `panY` are `@state()` properties. Each assignment triggers `this.requestUpdate()` → Lit's update cycle. During a 750 ms animation at 60 fps that's ~45 update cycles, each re-rendering the entire SVG template. This is *functionally correct* (Lit batches microtask updates, so you get at most one render per frame), but it's worth being aware of the performance cost for large trees. If this becomes a bottleneck, consider manipulating the SVG `viewBox` attribute directly via `this.renderRoot.querySelector('svg')?.setAttribute(...)` during animation and only syncing back to `@state()` on completion. Not blocking — Lit's diffing is efficient for attribute-only changes — but worth a `// NOTE:` comment.

#### 7. `easeInOut` could be `static`
**File:** `ft-tree-view.ts:217-219`

The method doesn't reference `this`. Making it `private static easeInOut(t: number)` or a module-level function is a minor correctness / style improvement — it signals to readers that the function is pure.

---

### What's Done Well

- **Cancel-and-restart semantics** are exactly right: snapshotting `panX`/`panY` at cancellation time means rapid re-selections animate smoothly from the current visual position instead of jumping. This is a detail many animation implementations get wrong.
- **Lifecycle cleanup** in `disconnectedCallback` prevents orphaned rAF callbacks — good hygiene.
- **`centerGraph()` left intentionally instant** — correct design call; animating the initial layout would feel sluggish.
- **Easing function** is the standard quadratic ease-in-out, correctly implemented and producing `0` at `t=0` and `1` at `t=1`.
- **Static duration constant** (`PAN_DURATION_MS`) is clean and discoverable.
- **JSDoc** on `centerOnNode` and `animatePanTo` is clear and documents the re-selection behavior.

---

### Verification Story

- **Tests reviewed:** No unit tests exist for this component (no `*.test.ts` or `*.spec.ts` found). The animation logic is purely visual/interaction-based, so automated testing would require a browser harness. Not blocking, but manual QA should specifically test the three interaction scenarios described above.
- **Build verified:** Not run (TypeScript web project — would need `npm run build`; instructions not in scope for this review).
- **Lint/static analysis:** No TypeScript errors visible in the diff. No unused variables. Types are correct.
- **Security checked:** No security concerns — this is purely client-side viewport animation logic with no user input, network calls, or DOM injection.

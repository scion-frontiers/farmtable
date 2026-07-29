# PR Review: feat/f37-scroll-to-item (Round 2)

## Review Summary

**Verdict:** APPROVE

**Overview:** This feature adds scroll-to-task navigation across three views (kanban, ready-queue, tree) and a dim overlay when the selected task isn't visible in the current view. The implementation is clean, well-scoped, and correctly addresses the Round 1 feedback. The dim overlay logic is properly lifecycle-managed with timer cleanup and listener teardown, and the per-view scroll behaviors use appropriate platform APIs.

## Executive Summary

Low risk. The change is a self-contained UI enhancement (~170 lines across 4 files) with no data-mutation paths, no new network calls, and no security surface. The code is well-structured, follows existing LitElement patterns, and correctly handles edge cases like overlay cleanup on disconnect and filter changes.

---

### Critical Issues

None.

### Important Issues

1. **[ft-app.ts:401] `onDimOverlayInteraction` swallows all clicks/keydowns while overlay is visible**

   The capture-phase click listener calls `hideDimOverlay()` but does not distinguish between interaction targets. While `pointer-events: none` on the overlay itself means clicks pass through to the underlying content, the capture-phase document listener fires *before* the target element's handler. Since `hideDimOverlay` only mutates the overlay boolean and removes the listener (no `preventDefault`, no `stopPropagation`), the click event continues to propagate normally, so this is functionally fine. However, the keydown listener will trigger on *any* keystroke — including typing into form fields — causing the overlay to dismiss on the first keypress, which is the intended UX. This is acceptable behavior but worth documenting.

   **Status:** Acceptable — the handler is intentionally a dismiss-on-any-interaction trigger. No fix needed.

2. **[ft-app.ts:375] `isTaskVisibleInCurrentView` doesn't account for tree-view collapsed nodes or focus-root filtering**

   If the tree view has a task collapsed under a parent node, or if `focusRootId` is set to limit the visible subtree, the task may not actually be rendered even though `isTaskVisibleInCurrentView` returns `true`. The dim overlay would not appear, and `centerOnNode` in `ft-tree-view` would silently no-op (since the node wouldn't be in `layoutNodes`). The user would see neither the task nor the overlay.

   This is a minor gap — collapsed/focused-root scenarios are niche interactions — but could cause confusion.

   **Suggested Fix (future iteration):** No blocking change needed, but consider surfacing this as a known limitation or expanding `isTaskVisibleInCurrentView` to check the tree's collapsed-ancestor state in a future PR.

### Suggestions

1. **[ft-app.ts:393-398] Consider extracting the dim-overlay show/hide check into a helper**

   The same 5-line pattern appears in `onViewChange`, `onFilterChange`, and `onTaskSelect`:
   ```typescript
   if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
     this.showDimOverlay();
   } else {
     this.hideDimOverlay();
   }
   ```
   Extracting this into a `private updateDimOverlay()` method would DRY up the code and ensure future call sites don't miss the else branch.

2. **[ft-kanban-column.ts:171] `scrollToSelectedCard` may fire unnecessarily for columns that don't contain the task**

   Every kanban column receives the `selectedTaskId` attribute. When it changes, all columns will enter `scrollToSelectedCard`, each awaiting `this.updateComplete`, and only the column containing the task will actually scroll. The early `hasTask` check mitigates the cost, but `await this.updateComplete` still runs in all columns before the check (since `updated` already ran, `updateComplete` resolves immediately — so this is negligible in practice).

   **Status:** No fix needed; the performance impact is nil.

3. **[ft-tree-view.ts:186-188] `centerOnNode` doesn't validate `containerWidth`/`containerHeight` are non-zero**

   If `centerOnNode` is called before `firstUpdated` (or if the container has zero dimensions), the calculation would produce invalid pan coordinates. In practice this can't happen because `updated` fires after `firstUpdated` and the ResizeObserver initializes dimensions, but a defensive guard would be cheap.

4. **[ft-app.ts:46-48] `dim-fade-in` animation has no fade-out**

   The overlay appears with a 0.2s fade-in but disappears instantly when removed from the DOM. For polish, consider using an opacity transition on the host or animating removal (though DOM removal in Lit makes this harder without `animate` directive or `willUpdate`).

### What's Done Well

- **Lifecycle hygiene is excellent.** The `disconnectedCallback` clears the timer and removes document listeners. The `requestAnimationFrame` deferral in `showDimOverlay` prevents the triggering event from immediately dismissing the overlay — a subtle but important detail.
- **`isTaskVisibleInCurrentView` mirrors the ready-queue's own `isReady()` logic precisely.** The blocked-by check uses the same semantics (skip unknown blockers, only block on non-CLOSED tasks), preventing false positives.
- **Each view uses the appropriate scrolling API.** Kanban uses `scrollIntoView` with `inline: 'nearest'` for horizontal board scrolling; ready-queue uses `block: 'nearest'` for vertical list scrolling; tree view directly manipulates `panX`/`panY` for its SVG viewport — each correctly matched to its rendering model.
- **The `void` prefix on async calls from `updated()`** correctly documents that the returned promise is intentionally not awaited, avoiding unhandled-promise-rejection noise from linters.
- **The commit history is clean** — a feature commit followed by a review-feedback fix commit, making the review delta easy to trace.

### Verification Story

- Tests reviewed: No new tests in this PR. The change is purely UI behavior (scroll + overlay), which is appropriate for manual/visual verification rather than unit tests in this project's current test infrastructure.
- Build verified: **Yes** — `tsc --noEmit && vite build` passes cleanly.
- Lint/static analysis clean: **Yes** — TypeScript compilation reports no errors.
- Security checked: **Yes** — no user input handling, no new network calls, no DOM injection. `pointer-events: none` on the overlay is correctly used. Document-level listeners use `capture: true` and are properly cleaned up to prevent leaks.

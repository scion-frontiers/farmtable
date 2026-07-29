# Review: feat/f37-scroll-to-item

**Verdict:** REQUEST CHANGES

**Overview:** This PR adds scroll-to-task behavior on navigation across kanban, ready-queue, and tree views, plus a dim overlay in `ft-app` when the selected task isn't visible in the current view. The implementation is clean and well-structured, but has one important correctness gap (overlay not dismissed on inspector close) and one logic gap in the ready-queue visibility check that should be addressed before merge.

---

## Critical Issues

None.

## Important Issues

### 1. Dim overlay not dismissed when inspector is closed

**File:** `web/src/components/ft-app.ts:436`

`onInspectorClose()` sets `selectedTaskId = null` but does not call `hideDimOverlay()`. If a user selects a task that isn't in the current view (triggering the overlay), then closes the inspector before the 2500ms timer expires, the dim overlay persists over the main view until the timer fires or the user interacts.

The auto-dismiss timer and interaction listeners mitigate this somewhat, but it's still a visible UX glitch — the overlay lingers after the task is deselected.

**Suggested Fix:**

```typescript
private onInspectorClose() {
  this.selectedTaskId = null;
  this.hideDimOverlay();
}
```

### 2. Ready-queue visibility check does not account for blocked tasks

**File:** `web/src/components/ft-app.ts:370-376`

`isTaskVisibleInCurrentView` checks phase (`OPEN` / `IN_PROGRESS`) for the ready-queue view, but the actual `ft-ready-queue-view` also filters out tasks that are blocked by non-closed tasks (the `isReady()` method checks `BLOCKED_BY` relationships). A task can be `OPEN` and blocked — this method would return `true` (no overlay), but the task would not actually appear in the ready-queue.

This results in a false-negative for the dim overlay: the user navigates to a blocked OPEN task from the inspector while on the ready-queue view, and the main panel shows no highlight because the overlay was suppressed.

**Suggested Fix:**

```typescript
// Ready-queue only shows OPEN / IN_PROGRESS tasks that are not blocked.
if (this.currentView === 'ready-queue') {
  if (task.phase !== TaskPhase.OPEN && task.phase !== TaskPhase.IN_PROGRESS) {
    return false;
  }
  // A ready-queue task must not be blocked by any non-closed task.
  for (const rel of task.relationships) {
    if (rel.type !== RelationshipType.BLOCKED_BY) continue;
    const blocker = this.taskStore.getTask(rel.targetTaskId);
    if (blocker && blocker.phase !== TaskPhase.CLOSED) {
      return false;
    }
  }
}
```

This would require importing `RelationshipType` in `ft-app.ts`.

---

## Suggestions

### 3. Overlay not re-evaluated on filter or view changes

**File:** `web/src/components/ft-app.ts:311-323`

When the user switches views via `onViewChange` or changes filters via `onFilterChange`, the dim overlay state is not re-evaluated. If the overlay is visible and the user switches to a view where the task IS visible (or vice-versa), the overlay state becomes stale.

This is lower-priority because the overlay auto-dismisses in 2500ms and responds to interaction, but for completeness:

```typescript
private onViewChange(e: CustomEvent) {
  // ... existing code ...
  this.currentView = view;
  if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
    this.showDimOverlay();
  } else {
    this.hideDimOverlay();
  }
}
```

### 4. `centerOnNode` is a no-op when the node is not in `layoutNodes`

**File:** `web/src/components/tree/ft-tree-view.ts:195-203`

If the selected task is filtered out (via `focusRootId`, `maxDepth`, or collapsed ancestors), `centerOnNode` silently does nothing. The early-return is correct (no crash), but the user gets no visual feedback that the task isn't in the visible tree. The dim overlay from `ft-app` partially addresses this, but only for phase/assignee filters — not for tree-specific filters like focus-root or depth limiting.

No action needed now, but worth noting for a follow-up.

### 5. Consider debouncing rapid `selectedTaskId` changes

**File:** `web/src/components/kanban/ft-kanban-column.ts:162-164`

If `selectedTaskId` changes rapidly (e.g. keyboard navigation through the inspector's dependency list), each change triggers `scrollToSelectedCard()` with `await this.updateComplete`. The `behavior: 'smooth'` scrolls will compete. This is unlikely to cause bugs (the browser will just jump to the final target), but if rapid navigation is expected, consider a small debounce or using `behavior: 'auto'` for rapid changes.

---

## What's Done Well

- **Clean separation of concerns:** The scroll-to logic lives in each view component where it belongs, while the cross-cutting dim overlay concern lives in `ft-app`. This is the right architecture.
- **Proper cleanup in `disconnectedCallback`:** The `hideDimOverlay()` call ensures no leaked timers or dangling event listeners when the component is removed.
- **Smart use of `requestAnimationFrame` for event listener registration:** Deferring `click`/`keydown` listener registration prevents the triggering event from immediately dismissing the overlay. This is a subtle but important detail.
- **`pointer-events: none` on the overlay:** Correctly prevents the overlay from blocking interaction with the main content underneath.
- **Arrow function for `onDimOverlayInteraction`:** Ensures stable `this` binding for the document event listener — critical for correct `removeEventListener` behavior.
- **`updateComplete` await before DOM queries:** Both `scrollToSelectedCard` and `scrollToSelectedRow` correctly wait for LitElement's render cycle before querying the DOM.

---

## Verification Story

- **Tests reviewed:** No new tests in this PR. The changes are pure UI behavior (scroll position, CSS overlay) which are difficult to unit test in a meaningful way. Acceptable for this scope.
- **Build verified:** Yes — `tsc --noEmit && vite build` passes cleanly with no type errors.
- **Lint/static analysis clean:** Yes — build produces no warnings relevant to this code.
- **Security checked:** Yes — no user input handling, no network calls, no credential exposure. The `setTimeout` / `addEventListener` patterns are safe.

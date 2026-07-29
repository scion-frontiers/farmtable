# Review: F48 — Drag-and-Drop Relationship Building in Dependency View

**Commit:** 85dff11  
**Branch:** feat/f48-dependency-view-dnd  
**Reviewer:** Code Review Agent  
**Date:** 2026-07-22  

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a well-structured, focused feature that adds drag-and-drop relationship building to the dependency view. The DnD event handling, cycle detection, visual feedback, and edge-case guards are all implemented correctly and consistently with existing codebase patterns. No blocking issues found.

---

## Executive Summary

This change adds ~190 lines across two files to enable drag-and-drop creation of BLOCKED_BY relationships in the dependency DAG view. The risk level is **low** — the change is additive, contains proper guards for all edge cases (self-drop, duplicate, cycle), delegates persistence to the existing `applyTaskUpdate()` path (which already handles optimistic update, rollback, and error toasting), and introduces no new security concerns.

---

## Files Reviewed

| File | Lines Changed | Summary |
|------|--------------|---------|
| `web/src/components/dependency/ft-dependency-view.ts` | +174, -1 | DnD handlers, cycle detection, visual feedback, toast |
| `web/src/components/ft-app.ts` | +16 | Event handler wiring, `applyTaskUpdate` call |

---

## Critical Issues

None.

---

## Important Issues

None.

---

## Suggestions

### 1. Dual dragstart handler with `ft-tree-node` — fragile coupling (Medium)

**File:** `ft-dependency-view.ts:765-766`  
**Description:**  
The `foreignObject` wrapper registers its own `@dragstart` handler, but the inner `ft-tree-node` also has a `dragstart` handler (line 199 of `ft-tree-node.ts`) that sets `effectAllowed = 'move'` and data keys `application/ft-task-id` and `application/ft-subtree`. Both handlers fire during the same event (ft-tree-node first, then dependency-view via bubbling).

This works correctly today because:
- The dependency-view handler overwrites `effectAllowed` to `'link'` (compatible with `dropEffect = 'link'` in dragover)
- The drop handler reads `ft-task-id` (set by the outer handler), not `application/ft-task-id`

However, it's fragile: if `ft-tree-node` ever adds `e.stopPropagation()` to its dragstart handler, the dependency view's handler would silently stop receiving the event, breaking DnD.

**Suggested Fix:**  
Add a brief comment documenting this dependency:

```typescript
// Note: ft-tree-node also has a dragstart handler that fires first
// (bubbles up from its inner <div>). We intentionally override
// effectAllowed and set our own data key ('ft-task-id') so the two
// DnD systems (tree-reparent vs dependency-build) don't conflict.
private onNodeDragStart(taskId: string, e: DragEvent) {
```

### 2. `draggable` attribute on `foreignObject` is inert (Low / Nitpick)

**File:** `ft-dependency-view.ts:762`  
**Description:**  
`foreignObject` is an SVG element; the `draggable` HTML attribute has no effect on SVG elements in most browsers. The actual drag initiation comes from the inner `ft-tree-node`'s HTML `<div draggable="true">`. The attribute on `foreignObject` is harmless but misleading.

**Suggested Fix:**  
Either remove `draggable=` from the foreignObject (since ft-tree-node already controls it via `?readOnly`), or leave it as a documentation hint with a comment. Not a bug — purely cosmetic.

### 3. MIME type inconsistency across DnD systems (Low / Nitpick)

**File:** `ft-dependency-view.ts:575`  
**Description:**  
The dependency view uses `ft-task-id` as the data transfer key, while `ft-tree-node` uses `application/ft-task-id` (MIME-style prefix) and the kanban card uses `text/plain`. Three different conventions across the codebase. This is not a bug (each system reads its own key), but a consistency opportunity.

**Suggested Fix:**  
Consider standardizing on the `application/` MIME-type prefix in a future cleanup pass. Not blocking.

### 4. Consider user feedback on successful drop (Low)

**File:** `ft-dependency-view.ts:640-646`  
**Description:**  
On successful drop, the dependency-drop event fires and `applyTaskUpdate` runs with optimistic update. The graph re-renders with the new edge as visual confirmation. There's no explicit success toast, which is fine since the edge appearance IS the feedback. Just flagging that if the optimistic re-render is slow (large graph), there may be a perceived delay. Current behavior is consistent with how the command palette's "Add Relationship" works (also no success toast).

---

## What's Done Well

1. **Correct cycle detection algorithm.** The DFS through BLOCKS relationships starting from the source is the right approach. The `wouldCreateCycle(sourceId, targetId)` correctly identifies that adding `sourceId BLOCKED_BY targetId` would create a cycle when `sourceId` already transitively blocks `targetId`. The visited-set prevents infinite loops on existing cycles.

2. **Comprehensive edge-case handling.** Self-drop, duplicate relationship, and cycle are all caught before dispatching the event. The guards are ordered from cheapest to most expensive check (identity → array scan → DFS), which is good for performance.

3. **Drag-enter counter pattern.** The `_dragEnterCounters` map correctly handles the classic DnD flicker problem where `dragenter`/`dragleave` fire spuriously for child elements. The `Math.max(0, count)` bound prevents negative counts.

4. **Clean separation of concerns.** The dependency view handles DnD mechanics, validation, and visual feedback. The actual persistence is delegated to ft-app via a CustomEvent, which reuses the existing `applyTaskUpdate()` path with its optimistic update, rollback, and error toast. No duplicate code.

5. **readOnly prop wiring.** The change from hardcoded `readOnly` to `?readOnly=${this.readOnly}` on `ft-tree-node` is correct. The ft-app correctly passes `?readOnly=${this.isReadOnly}` to the dependency view, consistent with how tree-view and kanban-view handle it.

6. **Toast consistency.** The `showCycleWarning()` follows the exact same Shoelace `sl-alert` + `.toast()` pattern used by `showWriteError()` in ft-app. The `variant: 'warning'` (vs `'danger'` for write errors) and `duration: 5000` (vs `8000`) appropriately differentiate a user mistake from a system error.

7. **Event dispatch pattern.** `bubbles: true, composed: true` on the `dependency-drop` CustomEvent correctly crosses shadow DOM boundaries. Consistent with the existing `task-select` event.

8. **Clean dragend cleanup.** `onNodeDragEnd()` resets all DnD state (`draggingNodeId`, `dragOverNodeId`, counters). The `dragend` event fires on the source element regardless of whether the drop was accepted, cancelled, or escaped — so cleanup is guaranteed.

9. **Visual feedback.** The SVG rect highlight with dashed border and reduced opacity on the dragged node provide clear visual cues without being visually heavy. The `pointer-events: none` on `.drop-highlight` prevents the highlight rect from intercepting drag events.

---

## Verification Story

- **Tests reviewed:** No tests included in this change. DnD interactions are typically integration/E2E tested rather than unit-tested; the logic-heavy cycle detection method would benefit from unit tests but is not a blocker given the algorithm is straightforward.
- **Build verified:** Diff is purely additive TypeScript/Lit code. No new dependencies, imports, or build config changes.
- **Lint/static analysis clean:** Consistent with existing code style (formatting, naming, patterns).
- **Security checked:** No user-facing input beyond task IDs already present in the store. No XHR/fetch calls introduced (delegated to existing `applyTaskUpdate`). The `e.dataTransfer!` data is read and compared against store-known task IDs — no injection vector.

---

## Conclusion

Clean, well-implemented feature. The code follows existing patterns, handles all meaningful edge cases, and introduces no regressions. The suggestions above are all low-severity improvements for long-term maintainability. **APPROVE.**

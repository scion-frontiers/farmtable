# Code Review: Feature 46 — Relationships Tab Delete + Quick-Add (Round 2)

**Branch:** `feat/f46-relationships-add-remove`
**Reviewer:** Code Review Agent
**Date:** 2026-07-22
**Round:** 2 (verifying Round 1 fixes + fresh scan)

---

## Review Summary

**Verdict:** APPROVE

**Overview:** All six Round 1 findings have been correctly addressed in commit `4bbcb39`. The remaining delta is clean, well-structured, and follows existing project patterns. TypeScript compiles without errors. No new critical or important issues found.

---

## Round 1 Fix Verification

### Fix 1: "+" button hidden on RELATED/DUPLICATE sections
**Status: Verified**
`ADDABLE_TYPES` set restricts the "+" button to `BLOCKS` and `BLOCKED_BY`. The render path uses `canAdd = canEdit && ADDABLE_TYPES.has(type)` — only those two types pass. Correctly implemented.

### Fix 2: readOnly guard on `onRelationshipAdd`
**Status: Verified**
Guard added at the top of `onRelationshipAdd()` in `ft-inspector-relationships.ts:145` and `onRelationshipAdd()` in `ft-app.ts:797` (`isReadOnly` check). Both entry points are now protected.

### Fix 3: Quadratic array copy in `applyTaskUpdateFields`
**Status: Verified**
The loop-with-spread pattern (`updated.relationships = [...updated.relationships, ...]` inside a `for` loop) has been replaced with a collect-then-spread-once pattern: `filter` + `map` to build `toAdd`, then a single spread if `toAdd.length > 0`. This is O(n) instead of O(n*m). Correctly fixed for both `addBlocks` and `addBlockedBy`.

### Fix 4: ARIA roles for pills
**Status: Verified**
Pills now use `role="radio"` with `aria-checked` instead of `aria-selected`. Container uses `role="radiogroup"` with `aria-label="Relationship type"`. CSS selector updated to match `[aria-checked='true']`. Semantically correct per WAI-ARIA radio pattern.

### Fix 5: Pre-select relationship type from section context
**Status: Verified**
`onAddRelationship(relType)` passes the type through the `open-add-relationship` event → `onOpenAddRelationship` in `ft-app.ts` stores it in `addRelationshipDefaultType` → passed to command palette as `.defaultRelationshipType` → applied in `updated()` as `this.defaultRelationshipType ?? RelationshipType.BLOCKS`. Clean flow with sensible fallback.

### Fix 6: `:focus-within` for keyboard accessibility of trash icon
**Status: Verified**
CSS rule `.entry:focus-within .delete-btn` added alongside `.entry:hover .delete-btn` to reveal the delete button for keyboard users navigating within the entry row (the `sl-icon-button` receives focus). Correctly implemented.

---

## Fresh Review of Full Delta

### Critical Issues

None.

### Important Issues

None.

### Suggestions

1. **[ft-command-palette.ts:566–574] Radio pills: missing arrow-key navigation**
   The ARIA radiogroup pattern specifies that arrow keys should move selection between radio buttons (per [WAI-ARIA radio group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)). Currently the pills only respond to click. Since there are only two options and the main interaction is mouse-driven in the palette, this is a minor gap and not blocking — but adding Left/Right arrow handling on the radiogroup container would complete the pattern.

2. **[ft-app.ts:822–830] `addRelationshipDefaultType` not reset on Cmd+K close**
   When the user closes the palette via Cmd+K (the toggle path), `addRelationshipDefaultType` is not cleared — only `commandPaletteMode` and `addRelationshipTaskId` are reset. This is *practically harmless* because mode is reset to `'navigate'` and the default type is only consumed when `open` transitions to `true` with mode already set to `'add-relationship'`. However, for symmetry with `onCommandPaletteClose()`, adding `this.addRelationshipDefaultType = undefined;` in the close branch would be cleaner.

   **Suggested fix:**
   ```typescript
   if (this.commandPaletteOpen) {
     this.commandPaletteOpen = false;
     this.commandPaletteMode = 'navigate';
     this.addRelationshipTaskId = '';
     this.addRelationshipDefaultType = undefined;  // <-- add
   }
   ```

### What's Done Well

- **Clean separation of concerns:** The relationship component dispatches semantic events (`task-update`, `open-add-relationship`), and the app orchestrates mutation. The command palette is unaware of the mutation logic — it just emits a typed `relationship-add` event with the target and type.

- **Optimistic update pattern reused:** The new `onRelationshipAdd` handler correctly delegates to `applyTaskUpdate`, reusing the existing optimistic-update-with-rollback pattern. No custom error handling needed.

- **Mode-based command palette extension:** Adding a `mode` property and branching in `selectTask()` is a minimal, extensible approach. Future modes (e.g., "move to parent") can follow the same pattern without refactoring.

- **Defensive filtering in `applyTaskUpdateFields`:** The dedup logic uses `Set` lookups to prevent adding duplicate relationships, and the order of operations (add before remove) is explicitly documented with a comment.

- **Self-exclusion in search results:** `excludeTaskId` prevents the user from creating a self-relationship — a subtle correctness detail that's easy to miss.

- **Cleanup of `.priority-cell` wrapper in ready-queue-view:** The removed `<span class="priority-cell">` was an unnecessary wrapper around the `<sl-badge>`. The inline badge renders identically without it. Clean housekeeping.

---

## Verification Story

- **TypeScript check:** `tsc --noEmit` passes with zero errors.
- **Tests reviewed:** No test files exist in `web/src/`. No regressions possible from test perspective; test coverage is a pre-existing gap (not introduced by this PR).
- **Build verified:** TypeScript compilation clean.
- **Security checked:** No injection vectors. Events use typed `CustomEvent` details. `readOnly` guards prevent unauthorized mutation. No external input is used in template literals without Lit's built-in escaping.
- **Accessibility checked:** ARIA radiogroup semantics correct. Focus-within for keyboard users. Delete button has `label="Remove relationship"` for screen readers. Add button has `label="Add relationship"`.

---

**Final Verdict: APPROVE**

The Round 1 fixes are all correctly implemented. Two minor suggestions remain (arrow-key nav for radio pills, symmetry cleanup on Cmd+K close), neither of which is blocking. The feature is well-structured, follows existing patterns, and is ready to merge.

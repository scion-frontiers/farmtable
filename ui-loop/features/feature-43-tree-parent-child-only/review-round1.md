# Review: Feature 43 — Tree Parent-Child Only

**Branch:** `feat/f43-tree-parent-child-only`
**Commit:** `3542914 feat(web): show only parent-child edges in tree view`
**File:** `web/src/components/tree/ft-tree-view.ts` (+4, -19)
**Reviewer:** Code Review Agent
**Date:** 2026-07-22

---

## Executive Summary

Low-risk, well-scoped removal of dependency-edge rendering from the tree view canvas. The change is clean and complete — all six sites that referenced dependency edges (import, type, CSS, layout, edge-mapping, render template) are consistently removed, and the Feature 41 animation code is completely untouched.

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This commit removes dependency/relationship edge rendering (dashed indigo BLOCKS lines) from the tree view, leaving only parent-child hierarchy edges (solid gray lines). The change is surgically clean — every trace of dependency-edge support in this component is removed in a consistent, type-safe manner, with no regressions to existing features including the F41 animated centering.

---

### Critical Issues

None.

---

### Important Issues

None.

---

### Suggestions

1. **[ft-tree-view.ts:25] `LayoutEdge.type` is now a single-value literal type**

   With `type: 'hierarchy'` as the only possible value, the `type` field on `LayoutEdge` and the `{ type: 'hierarchy' }` label on `setEdge` (line 327) are technically dead code — they carry no discriminating information. Removing them would simplify the interface and the edge-building code.

   However, keeping them is defensible: it documents intent ("these are hierarchy edges") and makes re-adding other edge types in the future a smaller diff. This is a style preference, not a correctness issue.

   **Recommendation:** No action required. Keep as-is for self-documentation.

2. **[ft-tree-view.ts:316] `multigraph: true` is no longer strictly necessary**

   The dagre graph was created as a multigraph to allow both a hierarchy edge (`'h'`) and a dependency edge (`'d'`) between the same pair of nodes. With only hierarchy edges remaining, a simple directed graph would suffice and the `'h'` name parameter on `setEdge` (line 327) could be dropped.

   However, removing `multigraph: true` is a behavioral change to the graph library configuration and should be done deliberately in a separate cleanup commit, not folded into this feature removal.

   **Recommendation:** Consider a follow-up cleanup PR to simplify the graph to `{ directed: true }` and drop the edge name parameter.

3. **[ft-tree-view.ts:353] `as const` assertion is redundant given the narrowed type**

   `type: 'hierarchy' as const` — since `LayoutEdge.type` is now the literal type `'hierarchy'`, the string literal `'hierarchy'` already satisfies it without `as const`. The assertion is harmless but unnecessary.

   **Recommendation:** No action required. Harmless and arguably makes intent explicit.

---

### What's Done Well

- **Complete and consistent removal.** All six sites where dependency edges were referenced are cleaned up in lockstep: import, interface type, CSS class, `structureKey()` cache key, `runLayout()` graph building, edge-object mapping, and render template. No orphaned code remains.

- **Type narrowing is correct.** Changing `LayoutEdge.type` from `'hierarchy' | 'dependency'` to `'hierarchy'` means TypeScript will now reject any attempt to assign `'dependency'` — the type system enforces the intent of this change.

- **`structureKey()` simplification is correct.** Removing `t.relationships.map(...)` from the cache key means layout will no longer recompute when only relationship metadata changes (which no longer affects the visual). This is a correct optimization: the cache key now tracks exactly the data that affects layout (task IDs, parent links, expansion state).

- **Feature 41 (animated centering) is fully preserved.** All animation-related code is untouched: `centerOnNode`, `animatePanTo`, `easeInOut`, `PAN_DURATION_MS` (750ms), `cancelPanAnimation`, and the `animationFrameId` lifecycle management. The `updated()` hook that triggers centering on `selectedTaskId` change is unchanged.

- **Scope is appropriately limited.** The `RelationshipType` import removal is correct — `RelationshipType` is still used by the Inspector, Kanban, Ready Queue, and app-shell components. Only the tree view's unused import was removed.

---

### Verification Story

- **Tests reviewed:** No test file changes in this commit. The tree view component does not appear to have dedicated unit tests (it's a canvas/SVG rendering component). Visual verification is the appropriate test method for this change.
- **Build verified:** Not run in this review (no `npm run build` available in review sandbox), but the change is syntactically and type-theoretically sound — no new imports, no signature changes, only removals and type narrowing.
- **Lint/static analysis clean:** The diff introduces no new patterns that would trigger standard Lit or TypeScript lint rules.
- **Security checked:** No security surface affected. This is a pure UI rendering change with no data flow, API call, or input handling modifications.

---

### Diff Summary

| Site | What Changed |
|------|-------------|
| Import (line 6, removed) | Removed `RelationshipType` value import |
| `LayoutEdge.type` (line 25) | Narrowed from `'hierarchy' \| 'dependency'` to `'hierarchy'` |
| CSS (lines 74-79, removed) | Removed `.edge-dependency` class (dashed indigo stroke) |
| `structureKey()` (line 295) | Removed `t.relationships.map(...)` from cache key |
| `runLayout()` (lines 326-330, removed) | Removed `BLOCKS` relationship edge insertion loop |
| Edge mapping (line 353) | Simplified to `type: 'hierarchy' as const` (was ternary on edge name) |
| Render template (line 649) | Hardcoded `class="edge-hierarchy"` (was ternary) |

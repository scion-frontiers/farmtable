## Review Summary (Round 2)

**Verdict:** APPROVE

**Overview:** All five findings from the R1 review have been addressed in the `fix: address toolbar filter review findings` commit. The dual-ownership anti-pattern is eliminated, the toolbar correctly disables filters in tree view mode, the loading state is surfaced, the UNSPECIFIED comment was added, and the redundant `getColumnTasks()` calls in `render()` are resolved via pre-computation. No new critical or important issues were introduced by the fix commit.

---

### Critical Issues

None.

---

### Important Issues

None.

---

### Suggestions

**1. [ft-app.ts:126-127] Filter props passed to `ft-tree-view` are currently unused**

`ft-app` now passes `.phaseFilter` and `.assigneeFilter` to `ft-tree-view`, but the tree-view component does not declare these as `@property()` (checked `web/src/components/tree/ft-tree-view.ts:98-105`). In Lit, setting an undeclared property is a silent no-op — it won't trigger re-renders or filtering.

This is harmless because the toolbar disables the filter dropdowns in tree view mode (line 84 of `ft-toolbar.ts`), so the user can never apply filters while viewing the tree. The prop pass-through is good forward preparation for when tree-view adds filter support.

No action required — just noting for future developers that tree-view will need to (a) declare the properties and (b) implement its own `matchesFilters()` to actually consume them.

**2. [ft-toolbar.ts:115-117] Loading placeholder option is selectable by keyboard**

The `<sl-option value="" disabled>Loading users...</sl-option>` uses `disabled` to prevent selection, which correctly blocks mouse clicks. However, Shoelace `<sl-option disabled>` still receives keyboard focus in some versions of the library. This is a minor UX polish point — if a user opens the dropdown while users are still loading, the keyboard-focused "Loading users..." item might confuse them momentarily. Consider conditionally rendering the entire option list only after loading completes, or this can be left as-is since the loading window is typically sub-second.

---

### R1 Findings — Disposition

| # | R1 Finding | Status | How Addressed |
|---|-----------|--------|---------------|
| 1 | Filters not wired to tree-view | **Fixed** | Option (C) implemented: toolbar disables filter dropdowns when `currentView === 'tree'` (ft-toolbar.ts:84). Filter props are passed to tree-view for future use (ft-app.ts:126-127). |
| 2 | Dual ownership of filter state | **Fixed** | Toolbar no longer mutates `this.phaseFilter`/`this.assigneeFilter` locally. Change handlers now read the current property values to compose the event detail and let the parent (`ft-app`) own all state mutations (ft-toolbar.ts:196-210). |
| 3 | No loading/error feedback for `listUsers()` | **Fixed** | Added `usersLoading` state with a disabled "Loading users..." placeholder option shown during the API call (ft-toolbar.ts:69-72, 115-117). Error case still silently shows only "Unassigned," which is acceptable. |
| 4 | Missing comment about UNSPECIFIED exclusion | **Fixed** | Comment added at ft-toolbar.ts:8: `// UNSPECIFIED is the protobuf default, not a user-selectable task phase.` |
| 5 | Redundant `getColumnTasks()` calls in render | **Fixed** | Both `boardColumns` and `onHoldColumns` are pre-computed once at the top of `render()` (ft-kanban-view.ts:283-291). `onHoldTotal` is derived from the pre-computed array. Column templates consume `.tasks` from the pre-computed objects instead of calling `getColumnTasks()` per column. |

---

### What's Done Well

1. **Clean fix commit** — All five R1 findings are addressed in a single focused commit with no unrelated changes. The diff between R1 and R2 is minimal and surgical.

2. **Correct state ownership after fix** — The toolbar's `onPhaseFilterChange` and `onAssigneeFilterChange` now properly read `this.phaseFilter` and `this.assigneeFilter` as current state without mutating them, then dispatch the composed detail upward. The parent round-trips the new values back as properties. This is the canonical Lit unidirectional data flow pattern.

3. **Consistent keyboard navigation under filters** — `onColumnNav()` (ft-kanban-view.ts:258) calls `this.getColumnTasks(target.stage).length`, which now applies filters via `matchesFilters()`. This means keyboard arrow navigation correctly skips empty (filtered-out) columns, staying consistent with what's visually rendered. This was not explicitly part of the filter feature but was handled correctly by the existing code structure.

4. **Pre-computed columns eliminate redundant work** — The `render()` method now computes `boardColumns` and `onHoldColumns` once, and both the column rendering and the `onHoldTotal` count derive from the same computed arrays. This eliminates the double-filtering that R1 flagged and also prevents any possible inconsistency between the count badge and the rendered columns.

5. **Staleness guard in `loadUsers()` is correctly placed** — The `userLoadToken` check wraps both the success and error paths, and the `usersLoading = false` reset is also guarded by the token check. This prevents a stale response from clobbering a more recent one, even on error.

6. **Sentinel value collision safety** — `UNASSIGNED_FILTER_VALUE = '__unassigned'` cannot collide with real user IDs, which are UUIDs generated server-side via `uuid.New()` in the Ent schema.

---

### Verification Story

- **Tests reviewed:** No tests added. The web frontend has no component test infrastructure (existing `TODO(test-coverage)` in ft-kanban-view.ts). `matchesFilters()` is pure logic that would benefit from unit tests as a follow-up, but the function is small and the branching is straightforward.
- **Build verified:** Yes — `tsc --noEmit` passes cleanly with zero errors.
- **Lint/static analysis clean:** No lint script configured in the project.
- **Security checked:** Yes — no new attack surface. Filter values are hardcoded enum integers and UUID strings rendered via Lit's auto-escaping template literals. `listUsers()` flows through the existing authenticated gRPC client. No credential exposure, no injection vectors.
- **R1 findings regression:** All five R1 findings verified as resolved in the current branch state.

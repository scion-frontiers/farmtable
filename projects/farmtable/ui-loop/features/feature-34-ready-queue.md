# Feature 34: Ready Queue View

## Summary

Added a Ready Queue view to the Farm Table web UI. This is a flat,
priority-sorted list of tasks that are actionable (not blocked by open
dependencies). It gives users a quick answer to "what can I work on next?"

## Ready Task Definition

A task is "ready" when:
1. Phase is OPEN (1) or IN_PROGRESS (2) -- excludes ON_HOLD and CLOSED.
2. No BLOCKED_BY relationship targets a non-CLOSED task. Tasks with no
   BLOCKED_BY relationships, or where all blockers are CLOSED, are ready.

## Key Decisions

- **Sort order**: Priority ascending (URGENT=1 first, LOW=4 last). Tasks
  with UNSPECIFIED priority (0) sort after LOW (treated as 5). Alphabetical
  name is the tiebreaker.
- **Blocks N badge**: For each ready task, count BLOCKS relationships where
  the target task exists and is not CLOSED. Shows as a warning pill badge
  when N > 0, helping users prioritize unblocking work.
- **Stage badge**: Rendered with a colored dot using existing `STAGE_COLOR`
  CSS custom properties and `STAGE_LABEL` mapping. Both OPEN stages
  (Triage, Backlog, Ready) and IN_PROGRESS stages (Working, In Review,
  In QA, Deploying) can appear since both phases qualify.
- **Placement in toolbar**: Added between Tree and Dashboard views since
  it's a task-oriented view, not an analytics view. Uses the `list-check`
  Shoelace icon.
- **Filter support**: Phase and assignee toolbar filters are applied via
  `matchesTaskFilters()`, consistent with kanban and tree views.
- **Short ID display**: Reuses the same `...lastSix` pattern from
  `ft-command-palette.ts` to keep rows compact.

## Files Changed

### Created
- `web/src/components/ready-queue/ft-ready-queue-view.ts` -- New Lit
  component with ~280 lines. Uses `TaskStoreController` for reactivity,
  `classMap` for selected row highlighting, `matchesTaskFilters` for
  toolbar filter integration.

### Modified
- `web/src/components/ft-app.ts` -- Added `'ready-queue'` to view type
  union, VALID_VIEWS set, and renderMainView() switch. Added import.
- `web/src/components/ft-toolbar.ts` -- Added radio button with
  `list-check` icon in view switcher. Updated `currentView` type.
- `web/src/index.ts` -- Added side-effect import for the new component.

## Backend Fix: Relationship Type Inversion (convert.go)

During screenshot verification, discovered a serialization bug in
`internal/server/convert.go`: when serializing TargetRelationships
(relationships where this task is the target of the record), the type
was not inverted. A BLOCKED_BY record where task T1 is the target
(meaning "T6 is BLOCKED_BY T1") was presented as T1 having a BLOCKED_BY
relationship to T6, rather than the correct BLOCKS relationship.

Added `invertRelationshipType()` function that flips BLOCKS↔BLOCKED_BY
while leaving symmetric types (RELATED, DUPLICATE) unchanged. Applied
in the TargetRelationships serialization loop. All Go tests pass.

This fix is required for the Ready Queue view to correctly identify
unblocked tasks, and also corrects the Inspector Relationships tab
groupings (Feature 25, PR #71).

## Code Review

**Reviewer**: Blind code-reviewer (--harness claude)
**Verdict**: APPROVE — no Critical or Important issues

Suggestions applied:
1. Removed unused `client` property (dead code in read-only view)
2. Added inline comment documenting the "unknown blocker = non-blocking"
   design decision in `isReady()`
3. Retained defensive `isLoading` check (reviewer noted it's redundant
   with parent guard but more defensive)

## Investigation Finding

Relationship data (BLOCKED_BY, BLOCKS) is **globally available** in the
TaskStore. Every Task object includes a `relationships` array loaded via
`full:true` in ListTasks and included in WatchTasks streaming. No new
backend RPC was needed for the Ready Queue view.

The backend's `GetReadyTasks` RPC exists but was not used because:
1. It only supports OPEN phase / READY stage (spec requires OPEN + IN_PROGRESS)
2. Client-side provides instant reactivity via WatchTasks
3. "Blocks N" badge requires client-side traversal regardless

## PR

- Branch: `feat/ready-queue-view`
- PR: https://github.com/scion-frontiers/farmtable/pull/83
- Commits: 3 (feat, review fixes, backend fix)
- Status: OPEN, CLEAN/MERGEABLE

## Build Status

Build passes with zero TypeScript/Vite errors. All Go tests pass.

# Feature 14: Filtered Task Count Badge

## What Was Built

Added a compact task count badge to the active filter chips row. When any task filter is active, the row now shows counts in the format `N of M tasks`, where `N` is the number of tasks matching the active filters and `M` is the total task count.

## Design Decisions

- Extracted the canonical filter predicate into `matchesTaskFilters()` so the kanban board and badge count use the same logic.
- Kept `ft-kanban-view`'s private `matchesFilters()` method as a small delegate to preserve the component's existing internal call shape.
- Placed the badge inside the existing chip row with `margin-left: auto` so it separates from active chips and remains compact.
- Reused the chip row visibility logic: no active filters means the whole row, including the badge, stays hidden.

## Files Changed

- `web/src/components/task-filters.ts`
- `web/src/components/kanban/ft-kanban-view.ts`
- `web/src/components/ft-app.ts`
- `web/src/components/ft-filter-chips.ts`

## Verification Results

- `cd /workspace/farmtable/web && npm run build` passed.
- Captured required Playwright screenshots using real UI clicks on the Shoelace filter controls:
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge/01-no-filters.png`
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge/02-one-filter.png`
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge/03-two-filters.png`
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge/04-after-clear.png`
- Screenshot MD5 checksums were distinct:
  - `5bad45e32f6b4d2a99714660708b98ae` 01-no-filters.png
  - `d9b03a125d56c21362bf21ad3008037f` 02-one-filter.png
  - `2dd30348437ef7bed7c45faf685001f1` 03-two-filters.png
  - `1ebe5291864e55045baa5581a7cce9f4` 04-after-clear.png

## Review Rounds

### Round 1 — APPROVE (1 finding fixed)
- **Suggestion #1**: `allTasks` getter array caching — already correct, no action
- **Suggestion #2**: Filter computation in render() — fine at current scale, no action
- **Suggestion #3**: Badge placement relative to Clear all — verified via screenshot, no action
- **Suggestion #4**: Use `@property({ attribute: false })` instead of `@property({ type: Number })` for count props → **Fixed** in commit 451b784

### Round 2 — APPROVE (non-blocking only, ship as-is)
- **Suggestion #1**: Filter computation in render() — repeated note, fine at scale
- **Suggestion #2**: Badge shows "0 of 0 tasks" when store empty — cosmetic, deferred
- **Suggestion #3**: Flex-wrap interaction at narrow viewports — worth verifying, not blocking
- **Suggestion #4**: Double iteration of allTasks — noted good pattern, no action

## Final State
- Branch: `feat/filtered-count-badge`
- Commits: 60e65ea (feature), 451b784 (R1 fix)
- PR: https://github.com/scion-frontiers/farmtable/pull/60

## Unaddressed Findings (all non-blocking)
- R2 Suggestion #1: Consider memoizing filter count at large scale
- R2 Suggestion #2: Hide badge when totalCount === 0 (cosmetic)
- R2 Suggestion #3: Verify flex-wrap at narrow viewports

## Suggested Next UI/UX Feature

Add per-column filtered count summaries in the kanban column headers, using the same shared `matchesTaskFilters()` predicate, so users can see where matching tasks are distributed without scanning every card.

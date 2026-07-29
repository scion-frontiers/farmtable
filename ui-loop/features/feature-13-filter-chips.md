# Feature 13: Active Filter Chips

## Built

- Added `<ft-filter-chips>` LitElement component (`web/src/components/ft-filter-chips.ts`)
- Renders nothing when no task filters are active (uses `this.hidden` + `:host([hidden])`)
- Shows removable `sl-tag` chips for active phase and assignee filters
- Phase chip maps `TaskPhase` enum to human labels: Open, In Progress, On Hold, Closed
- Assignee chip resolves user ID to display name (with fallback: name → email → raw ID)
- Handles `UNASSIGNED_FILTER_VALUE` sentinel for "Assignee: Unassigned"
- Shows "Clear all" `sl-button` only when 2+ filters are active
- Dispatches `filter-clear` events with `TaskFilterChangeDetail` shape from `task-filters.ts`
- Wired into `ft-app.ts` between toolbar and content area
- App-level user loading added (with stale-response token pattern) for assignee name resolution
- Uses `role="group"` with `aria-label="Active filters"` for accessibility

## Design Decisions

- Kept component purely presentational: data-down (props), events-up (CustomEvent)
- Reuses existing `TaskFilterChangeDetail` type — no new filter state introduced
- Reuses `onFilterChange` handler in ft-app for both `filter-change` (toolbar) and `filter-clear` (chips)
- Used `sl-tag size="small" removable` matching inspector-meta.ts precedent
- Used `sl-button variant="text"` for "Clear all" — visually lighter than a tag
- Added app-level `loadUsers()` (acknowledged duplicate with toolbar via TODO comment)

## Verification

- `cd /workspace/farmtable/web && npm run build` passed (TypeScript + Vite, zero errors)
- Captured Playwright screenshots against `go run ./cmd/ft dashboard --port 8090`:
  - `feature-13-filter-chips/01-no-filters.png` — no chip row visible
  - `feature-13-filter-chips/02-one-filter-chip.png` — "Phase: Open" chip, no Clear all
  - `feature-13-filter-chips/03-two-filters-clear-all.png` — both chips + "Clear all" visible
  - `feature-13-filter-chips/04-post-clear.png` — chips cleared, board restored

## Review Rounds

### Round 1 — APPROVE (all 4 findings fixed)
- **Important #1**: Duplicate `onFilterClear`/`onFilterChange` handlers → Fixed: removed `onFilterClear`, reuse `onFilterChange`
- **Suggestion #2**: Phantom 1px border when no filters → Fixed: added `this.hidden` + `:host([hidden]) { display: none !important }`
- **Suggestion #3**: Duplicate `listUsers()` RPC → Fixed: added TODO comment for future consolidation
- **Suggestion #4**: Missing `role="group"` on chips container → Fixed: added `role="group"`

### Round 2 — APPROVE (non-blocking only, ship as-is)
- **Important #1**: `this.hidden` in `render()` is a Lit style concern (Lit guards against re-entrancy) → deferred
- **Important #2**: Duplicate `listUsers()` consolidation → acknowledged via TODO, defer to follow-up
- **Suggestion #3**: `PHASE_LABELS` fallback is defensive dead code → fine as-is
- **Suggestion #4**: Could use `@state()` instead of `@property({ attribute: false })` → minor style, defer
- **Suggestion #5**: Comment about dual event names → minor, defer
- **Suggestion #6**: `userLoadToken` guard for single call → fine as forward-compatible

## Final State
- Branch: `feat/filter-chips`
- Commits: c87d2ec (feature), a45f33e (R1 fixes)
- PR: https://github.com/scion-frontiers/farmtable/pull/59

## Unaddressed Findings (all non-blocking)
- R2 Important #1: Move `this.hidden` from `render()` to `willUpdate()` (style concern)
- R2 Important #2: Consolidate `listUsers()` into single app-level call (has TODO)
- R2 Suggestion #4: `@state()` vs `@property({ attribute: false })` (minor style)
- R2 Suggestion #5: Comment for dual event → single handler mapping

## Suggested Next UI/UX Feature

Add a **task count badge / "N results" indicator** near the filter chips or toolbar showing how many tasks match the current filter criteria. When filters are active, users can see the chip labels but not how many tasks remain without scanning columns. A small "6 tasks" or "Showing 6 of 12" label next to the chips would provide immediate feedback about filter selectivity.

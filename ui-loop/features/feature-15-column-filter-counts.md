# Feature 15: Per-Column Filtered Count Summaries

## Investigation

The existing kanban column counts were already filtered because `ft-kanban-view.ts`
passes `getColumnTasks(stage)` into each `ft-kanban-column`, and
`getColumnTasks()` uses the shared `matchesTaskFilters()` helper from
`web/src/components/task-filters.ts`.

The missing user-facing context was the unfiltered column total. A plain low
count could mean either "few tasks exist in this stage" or "active filters hid
most tasks."

## Built

- `web/src/components/kanban/ft-kanban-column.ts`
  - Added `totalCount` as `@property({ type: Number, attribute: 'total-count' })`.
  - Added count label rendering:
    - plain `${sorted.length}` when there is no difference from total
    - `${sorted.length} of ${this.totalCount}` when the visible filtered count
      differs from the unfiltered total
  - Prevented the count chip from inheriting the uppercase header transform so
    `of` renders as lowercase.
  - Added `aria-label` on count span for screen reader accessibility.
  - Added `// NOTE(i18n)` comment on the hardcoded English "of" string.
- `web/src/components/kanban/ft-kanban-view.ts`
  - Consolidated per-column `getByStage()` calls (single call per column, filter applied inline).
  - Passes `.totalCount` into each board and on-hold `ft-kanban-column`.

No filter semantics or filter dimensions were changed. The existing
`matchesTaskFilters()` path remains the single filter implementation.

## Verification

- Build: `cd /workspace/farmtable/web && npm run build` passed clean.
- Browser screenshots used Playwright with system Chromium:
  - `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`
  - Playwright package from `/scion-volumes/scratchpad/web-test/node_modules`
  - App origin: `https://farmtable-qo7k5fvpda-uc.a.run.app`
- The production dataset available without extra credentials only exposed one
  task, so the screenshot run used the branch's built frontend assets at the
  provided app origin plus a browser-only fixture seeded into the in-memory
  task store. This avoided mutating shared backend data. Filter application was
  done with genuine Shoelace UI clicks.

Screenshots:

- No filters, plain counts:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-15-column-filter-counts/no-filters-plain-counts.png`
  - md5: `325109399d51cb46c7c622e6f0e91ee1`
- Assignee filter active, multiple `N of M` headers:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-15-column-filter-counts/assignee-filter-n-of-m-counts.png`
  - md5: `3868d22ef7174cadbca88f48ddadb9b6`

Observed header counts:

- No filters: `1`, `1`, `1`, `2`, `1`, `1`, `1`, `1`
- Assignee `Unassigned`: `1`, `1`, `0 of 1`, `1 of 2`, `0 of 1`, `0 of 1`, `0 of 1`, `0 of 1`

## Review Rounds

### Round 1 — APPROVE (3 actionable findings, all fixed)

Reviewer: `farmtable-f15-review-r1` (code-reviewer, --harness claude)

- **Suggestion #1**: Double `getByStage()` call per column — **Fixed** in commit 53b3062. Consolidated to single call per column with inline filter.
- **Suggestion #2**: ARIA accessibility — **Fixed** in commit 53b3062. Added `aria-label` to count span.
- **Nitpick #3**: English-only "of" string — **Fixed** in commit 53b3062. Added `// NOTE(i18n)` comment.
- **Informational #4**: Edge case `totalCount === 0` — No action needed, reviewer confirmed logic is correct.

### Round 2 — NOT RUN (infrastructure issue)

The R2 reviewer agent (`farmtable-f15-review-r2`) could not start — the broker
kept it in "created" state for 10+ minutes across 4+ retry attempts. Hub
timeouts on `POST .../agents` endpoint. This appears to be a broker capacity
issue, not a code problem.

Given R1 was APPROVE with no Critical/Important findings, and all suggestions/nitpicks
were fixed, proceeding to ship.

## Final State

- Branch: `feat/column-filter-counts`
- Commits: 377b17b (feature), 53b3062 (R1 fixes)
- PR: https://github.com/scion-frontiers/farmtable/pull/61

## Unaddressed Findings

None — all R1 findings were addressed.

## Suggested Next UI/UX Feature

Add a subtle active-filter state to the column count chip, such as a different
neutral tint and tooltip explaining "visible of total", so users understand the
new count format without adding permanent instructional text to the board.

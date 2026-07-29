# Brief: Engineering Manager — Feature 15: Per-Column Filtered Count Summaries

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** When ready, push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and summary.
  The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback — give it only the current repo/diff state.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
    "Fix" includes investigating a finding and concluding no change is
    needed if that's genuinely true — document why, don't just skip it.
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total. If round 5 still has significant
    findings, stop anyway and report the unresolved findings honestly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f15-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f15-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **Verify, don't assume.** Check the developer's actual git diff/commits
  and actual screenshots (real content, not stubs) before reporting done.
- **Screenshot integrity — use REAL UI interactions, not `page.evaluate()`.**
  Drive Playwright through genuine clicks on the real controls (Shoelace
  shadow DOM included). Verify screenshots are distinct via `md5sum` before
  reporting.

## Feature Spec — investigate before building

Suggested by the developer who built Feature 14 (filtered task count
badge, merged as PR #60, commit 055e2b0): per-column filtered count
summaries in kanban column headers.

**Important: check current behavior first.** Each column header
(`web/src/components/kanban/ft-kanban-column.ts`, `.count` span, ~line
259) already shows `sorted.length` — and since filtering already narrows
which cards get passed into each column, the count badge likely ALREADY
reflects the filtered count today. Confirm this by testing with a filter
active before writing any code.

If per-column counts already update correctly when filters are active,
the actual gap is more likely: **the column header count doesn't show
"N of M" (matching vs. total-in-that-column) the way Feature 14's global
badge does** — so a user can't tell from a column header alone whether
filtering is hiding cards in that column or whether the column is just
naturally empty/small. That's the enhancement to build:

- When no filters are active: column header shows the plain count as
  today (no change).
- When filters are active: column header shows `N of M` (e.g. "2 of 5"),
  where N = cards currently visible in that column, M = total cards that
  would be in that column with no filters applied.
- Reuse the shared `matchesTaskFilters()` predicate from
  `web/src/components/task-filters.ts` (added in Feature 14) — do not
  duplicate filter logic.
- Keep scope to this one feature — do not change filter semantics or add
  new filter dimensions.

If your investigation finds something different from what's described
above, that's fine — report what you actually found and adjust scope
sensibly, but stay within "per-column filter visibility," don't wander
into unrelated column-header changes.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #60) — use a fresh feature branch, PR to merge.
- Column rendering: `web/src/components/kanban/ft-kanban-column.ts`
  (`.count` span)
- Filter state/predicate: `web/src/components/task-filters.ts`
  (`matchesTaskFilters()`), `web/src/components/kanban/ft-kanban-view.ts`
  (passes tasks into columns)
- Feature 14's badge pattern to mirror: `web/src/components/ft-filter-chips.ts`,
  and its log:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify: no
  filters → plain counts; filters active → "N of M" per column, correctly
  reflecting matches. Real, distinct screenshots via genuine UI interaction
  required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-15-column-filter-counts.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots (genuine UI interaction) showing plain counts
   with no filters and "N of M" counts with filters active across multiple
   columns, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-15-column-filter-counts/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-15-column-filter-counts.md`
   with: what your investigation found about current behavior, what was
   built, each review round's findings and resolutions, final state,
   unaddressed nitpicks, and the developer's optional suggestion for the
   next most logical UI/UX feature.
4. A message to the coordinator with: PR URL, branch name, summary
   (including the investigation finding), final review outcome, and the
   developer's next-feature suggestion (if any).

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator
confirms the merge landed or explicitly tells you to clean up.

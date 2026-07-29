# Brief: Engineering Manager — Feature 16: Column Count Chip Filter State + Tooltip

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
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total.
  - If the broker/infra genuinely fails to start a review agent after
    several retries (as happened on Feature 15), it's acceptable to ship
    on a single thorough, clean review round — but retry a reasonable
    number of times first (3-4 attempts with brief waits) and document the
    failure explicitly in your report. Don't skip review as a first resort.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f16-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f16-review-rN --type code-reviewer
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
  Drive Playwright through genuine clicks. Verify screenshots are distinct
  via `md5sum` before reporting.

## Feature Spec

Suggested by the developer who built Feature 15 (per-column filtered
count summaries, merged as PR #61, commit d06d787): the "N of M" count
format introduced in Feature 15 has no visual distinction from a plain
count and no explanation — a first-time user might not realize what "N of
M" means or that a filter is currently narrowing the column.

- Give the column count chip a subtle, distinct but non-intrusive visual
  treatment when it's showing a filtered "N of M" value vs. a plain count
  (e.g. a different neutral background tint, not a loud/alarming color —
  this should read as informative, not as a warning or error state).
- Add a tooltip (Shoelace `sl-tooltip` is already used elsewhere in this
  codebase — check `ft-toolbar.ts`/inspector components for the pattern)
  on the count chip when filtered, explaining something like "N tasks
  visible in this column out of M total" — keep the wording concise.
- No tooltip / no special styling needed when showing a plain (unfiltered)
  count — only apply this treatment when a filter is actually active for
  that column's count.
- Keep scope to this one feature — do not change the counting logic itself
  (that's Feature 15's `totalCount`/filtered-count props) or other toolbar
  behavior.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #61) — use a fresh feature branch, PR to merge.
- Column header/count chip: `web/src/components/kanban/ft-kanban-column.ts`
  (the `.count` span and `totalCount`/filtered-count props added in
  Feature 15 — see its log for context:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-15-column-filter-counts.md`)
- Tooltip pattern precedent: search the codebase for existing `sl-tooltip`
  usage to match styling/placement conventions.
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify: plain
  count has no special styling/tooltip, filtered "N of M" count has the
  distinct tint AND shows the tooltip on hover. Real, distinct screenshots
  via genuine UI interaction required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-16-column-count-tooltip.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots showing: plain count (unstyled), filtered
   count with the new tint, and the tooltip visible on hover, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-16-column-count-tooltip/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-16-column-count-tooltip.md`
   with: what was built, each review round's findings and resolutions,
   final state, unaddressed nitpicks, and the developer's optional
   suggestion for the next most logical UI/UX feature.
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, and the developer's next-feature suggestion (if any).

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator
confirms the merge landed or explicitly tells you to clean up.

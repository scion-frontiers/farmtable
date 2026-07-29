# Brief: Engineering Manager — Feature 17: Per-Column Empty-Filter State Message

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
    3-4 retries with brief waits, it's acceptable to ship on a single
    thorough, clean review round — document the failure explicitly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f17-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f17-review-rN --type code-reviewer
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

Suggested by the developer who built Feature 16 (column count chip filter
tint + tooltip, merged as PR #62, commit 835b7eb): when a filter is active
and a column has zero visible matching tasks but DOES have tasks that are
simply hidden by the filter (i.e. `totalCount > 0` but filtered count is
0 — the "0 of M" case introduced in Feature 15/16), show a subdued inline
message in that column's body, like "No visible tasks match this filter."

- Only show this message when: a filter is active AND the column's
  filtered count is 0 AND its total count is > 0 (tasks exist but are all
  hidden). Do NOT show it for columns that are genuinely empty (0 of 0) —
  that's a different, pre-existing state and should look like it already
  does today (just an empty column).
- Keep the message visually subdued/secondary (muted text, small, doesn't
  compete with actual task cards) — this is informational, not an error.
- No message at all when no filters are active, regardless of whether the
  column is empty.
- Reuse the count/total-count props and filter-active detection already
  added in Features 15/16 — do not duplicate that logic.
- Keep scope to this one feature — do not change filtering behavior or
  other column rendering.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #62) — use a fresh feature branch, PR to merge.
- Column rendering: `web/src/components/kanban/ft-kanban-column.ts` (has
  the count/totalCount/filter-tint logic from Features 15 and 16 — read
  both logs for the exact prop names and filter-active detection):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-15-column-filter-counts.md`,
  `feature-16-column-count-tooltip.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify: a
  column with hidden tasks (0 of M, M>0) shows the message; a genuinely
  empty column (0 of 0) does not; a column with visible matches doesn't
  show it either. Real, distinct screenshots via genuine UI interaction
  required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-17-empty-filter-message.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots showing: column with hidden tasks (message
   visible), genuinely empty column (no message), column with visible
   matches (no message), saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-17-empty-filter-message/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-17-empty-filter-message.md`
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

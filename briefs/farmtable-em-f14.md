# Brief: Engineering Manager — Feature 14: Matching Task Count Badge

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
  - Hard cap: 5 review rounds total. If round 5 still has significant
    findings, stop anyway and report the unresolved findings honestly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f14-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f14-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **Verify, don't assume.** Check the developer's actual git diff/commits
  and actual screenshots (real content, not stubs) before reporting done.
- **Watch for silent stalls.** If you nudge a child agent and it doesn't
  respond with visible progress, check its actual output/files directly
  before assuming it's stuck — it may have finished without signaling.
- **Screenshot integrity — use REAL UI interactions, not page.evaluate():**
  Feature 13's first evidence attempt set filter state via
  `page.evaluate()` (direct JS injection) instead of clicking through the
  actual dropdown, which made the UI look inconsistent/broken in the
  screenshot even though the code was fine. Always drive Playwright through
  genuine clicks/keyboard input on the real controls (Shoelace `sl-select`/
  `sl-option` shadow DOM included) so screenshots reflect what a real user
  would see. Verify screenshots are distinct via `md5sum` before reporting.

## Feature Spec

Suggested by the developer who built Feature 13 (active filter chips,
merged as PR #59, commit 4a24415): add a small count badge showing how
many tasks currently match the active filters, displayed near the filter
chips row (e.g. "12 tasks" or "3 of 47 tasks").

- Only meaningful when at least one filter is active — reuse Feature 13's
  "no chips when no filters" pattern for when to show/hide it (e.g. only
  show the count when the chip row itself is showing, or always show a
  total count — developer's call on the exact placement/format, but keep
  it compact and consistent with the existing toolbar/chip row styling).
- The count should reflect the SAME filtered set the board is already
  showing (reuse the existing filtering logic/state from Features 12-13 —
  do not duplicate filter logic).
- Update live as filters change (add/remove a filter, clear all).
- Keep scope to this one feature — do not add new filter dimensions or
  other toolbar changes.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #59) — use a fresh feature branch, PR to merge.
- Filter chips / filter state: `web/src/components/ft-filter-chips.ts`,
  `web/src/components/task-filters.ts`, `web/src/components/ft-app.ts`,
  `web/src/components/kanban/ft-kanban-view.ts` — read Feature 13's log for
  exactly how the filtered task count is currently derived (if at all):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify the
  count updates correctly across: no filters, one filter, two filters,
  clear-all. Drive all interactions through real UI clicks (see the
  integrity note above). Real, distinct screenshots required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots (via genuine UI interaction) showing the
   count at different filter states, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-14-filtered-count-badge.md`
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

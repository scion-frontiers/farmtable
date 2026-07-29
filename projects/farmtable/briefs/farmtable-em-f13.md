# Brief: Engineering Manager — Feature 13: Active Filter Chips

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
  - Developer: `scion start farmtable-f13-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f13-review-rN --type code-reviewer
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
- **Screenshot integrity:** every screenshot you report as evidence must be
  genuinely distinct and actually capture the state it claims. Run `md5sum`
  on your own screenshots before reporting to the coordinator.

## Feature Spec

Suggested by the developer who built Feature 12 (functional toolbar
filters, merged as PR #58, commit 543f221): the Phase/Assignee dropdowns
already show their own selected value and have per-control `clearable` x
buttons, but there's no compact "active filters" summary near the board
content itself, and no single clear-all action.

- Add small chip(s) below/near the toolbar (or wherever fits the existing
  layout best) summarizing each active filter (e.g. "Phase: Open ×",
  "Assignee: Alice ×"). Clicking a chip's × clears just that filter.
- Add a "Clear all" action/chip when 2+ filters are active (not needed when
  only one filter is set — the per-chip × already covers that case).
- Only show the chip row when at least one filter is active; hide it
  entirely when no filters are set (don't reserve empty vertical space).
- Reuse the existing filter state (`task-filters.ts` / whatever
  `ft-toolbar.ts`/`ft-app.ts` uses from Feature 12) — do not introduce a
  second parallel filter state.
- Keep scope to this one feature — do not add new filter dimensions.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #58) — use a fresh feature branch, PR to merge.
- Filter state and toolbar: `web/src/components/ft-toolbar.ts`,
  `web/src/components/task-filters.ts`, `web/src/components/ft-app.ts`,
  `web/src/components/kanban/ft-kanban-view.ts` (see Feature 12's log for
  exactly how filter state flows):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-12-toolbar-filters.md`
- Chip pattern precedent (reuse Shoelace `sl-tag` styling, consistent with
  labels/assignees chips from Features 5/6):
  `web/src/components/inspector/ft-inspector-meta.ts`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify: no
  chips shown with no filters, chips appear when filters are set, removing
  one filter via its chip works, "Clear all" appears with 2+ filters and
  clears everything. Real, distinct screenshots required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots showing: no chips (no filters), one filter
   chip, both filters + clear-all, and post-clear-all state, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips.md`
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

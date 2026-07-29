# Brief: Engineering Manager — Feature 12: Functional Toolbar Filters

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
  - Developer: `scion start farmtable-f12-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f12-review-rN --type code-reviewer
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

Suggested by the developer who built Feature 11 (keyboard shortcut overlay,
merged as PR #57, commit 1795a5a): return to functional surface area. I
confirmed the gap myself: `web/src/components/ft-toolbar.ts` has `Phase`
and `Assignee` `<sl-select>` dropdowns (lines ~53, ~60) that are currently
decorative — no `<sl-option>` children populated, and no event wiring to
actually filter the board. This is the keyboard-accessibility arc's
developer noticing genuinely dead UI, not a new invented feature — treat
it with normal priority alongside the rest of the loop.

Scope:
1. **Populate options**: `Phase` should list the real `TaskPhase` enum
   values the board already uses (check `proto/farmtable.proto` and how
   `ft-kanban-column.ts`/`ft-kanban-view.ts` render phases/columns — reuse
   existing labels/colors, don't invent new terminology). `Assignee` should
   list real users — reuse the `listUsers()` client method added in
   Feature 6 (`web/src/gen/service.ts` / `grpc-client.ts`), plus an
   "Unassigned" option.
2. **Wire filtering**: selecting a Phase and/or Assignee should filter which
   tasks are visible on the Kanban board (client-side filtering of the
   already-loaded task list is fine — no new backend/proto RPC needed
   unless one already exists for server-side filtering and is trivial to
   use instead). Clearing a filter (the dropdowns already have `clearable`)
   should restore the full board.
3. Both filters should be combinable (AND semantics: Phase AND Assignee
   both apply if both are set).
4. Keep scope to wiring these two existing (empty) controls — do not add
   new filter dimensions (labels, priority, etc.) in this pass.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #57) — use a fresh feature branch, PR to merge.
- Toolbar: `web/src/components/ft-toolbar.ts` (the two empty `sl-select`
  controls)
- Board rendering / filtering target: `web/src/components/kanban/ft-kanban-view.ts`,
  `ft-kanban-column.ts`
- Data model: `proto/farmtable.proto` (`TaskPhase` enum), `Task.assignees`
- User listing: `web/src/gen/service.ts` (`listUsers()`, added Feature 6 —
  see `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-6-assignee-editing.md`)
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify:
  selecting a Phase filters the board to matching tasks, selecting an
  Assignee filters to that user's tasks, combining both works, and
  clearing restores the full board. Real, distinct screenshots required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-12-toolbar-filters.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots showing: unfiltered board, Phase-filtered,
   Assignee-filtered, and both combined, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-12-toolbar-filters/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-12-toolbar-filters.md`
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

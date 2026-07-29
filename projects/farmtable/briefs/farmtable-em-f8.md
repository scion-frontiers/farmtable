# Brief: Engineering Manager — Feature 8: Inspector Editor Reliability Pass

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
  - Developer: `scion start farmtable-f8-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f8-review-rN --type code-reviewer
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

## Feature Spec

Suggested by the developer who built Feature 7 (inspector priority editing,
merged as PR #53, commit b045c69): rather than adding more editable
surface area (the inspector now covers description, dates, labels,
assignees, and priority), fix accumulated interaction-quality gaps flagged
as follow-ups across Features 4-6:

1. **State leak across task switches** (noted in Feature 4's log — dates —
   and Feature 5's log — labels): if a user has an editor open (date
   picker, label input, etc.) and switches to a different task (clicking
   another card / selecting another task) without explicitly saving or
   canceling, the edit UI state persists incorrectly onto the new task's
   view. Fix: reset all in-progress edit state (editing flags, draft
   values) when the inspector's bound task identity changes — e.g. in a
   `willUpdate(changedProps)` lifecycle hook checking if `task.id` changed.
   Apply this consistently across ALL inspector editors: description,
   dates (due/start), labels, assignees, priority.
2. **Inconsistent dismiss semantics** (noted in Feature 5 and Feature 6
   logs): some editors dismiss via Escape only (no click-outside), the
   original blur-based approach was removed from labels due to a
   click/blur race (Feature 5, round 2 fix) but assignees still lack
   click-outside too. Establish ONE consistent, race-free dismiss pattern
   across all inspector editors (description, dates, labels, assignees,
   priority) — Escape key + explicit save/cancel controls at minimum;
   click-outside dismissal ONLY if it can be done without reintroducing
   the blur/confirm-button race that Feature 5 round 2 fixed (study that
   fix in `web/src/components/inspector/ft-inspector-meta.ts` before
   attempting — e.g. a capture-phase document click listener checking
   `event.composedPath()` against the editor's own DOM, rather than a
   `blur` event, may avoid the race).
3. Do NOT add new fields or new editing capabilities in this pass — this
   is purely a reliability/consistency fix across existing editors. Keep
   scope tight to these two issues.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #53) — use a fresh feature branch, PR to merge.
- Inspector components (all editors live here):
  `web/src/components/inspector/ft-inspector-desc.ts` (description),
  `web/src/components/inspector/ft-inspector-meta.ts` (dates, labels,
  assignees), `web/src/components/inspector/ft-inspector-header.ts`
  (priority, added in Feature 7), `web/src/components/inspector/ft-inspector.ts`
  (parent, passes `task`/`taskId` down)
- Prior feature logs documenting the exact gaps (read these before
  starting, they have the specifics):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-4-task-detail-panel.md` (state leak, S-5)
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-5-label-editing.md` (state leak S-1, blur/click race fix in R2)
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-6-assignee-editing.md` (no click-outside S-1)
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify: (a)
  opening an editor on task A, switching to task B without saving, editor
  state does NOT leak; (b) each editor dismisses consistently. Real
  screenshots/recording evidence required — this is a behavioral fix, so
  screenshots should show the before/after task-switch scenario clearly
  (e.g., annotate or caption which task is selected in each shot).
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-8-editor-reliability.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real screenshots demonstrating: (a) task-switch no longer leaks edit
   state for at least 2 of the affected editors, (b) consistent dismiss
   behavior, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-8-editor-reliability/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-8-editor-reliability.md`
   with: what was fixed and how, which editors were covered, each review
   round's findings and resolutions, final state, unaddressed nitpicks, and
   the developer's optional suggestion for the next most logical UI/UX
   feature.
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

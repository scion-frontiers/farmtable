# Brief: Engineering Manager — Feature 7: Inline Priority Editing in Inspector

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
  - Developer: `scion start farmtable-f7-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f7-review-rN --type code-reviewer
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

Suggested by the developer who built Feature 6 (assignee editing, merged as
PR #52, commit 8347b22): add inline priority editing to the task inspector
panel for parity with other fields (description, dates, labels, assignees
are all now editable in the inspector; priority is currently read-only
there).

Note: priority editing ALREADY EXISTS on the Kanban card itself (Feature 3,
PR #49 — a click-to-open `sl-select` dropdown). This feature is about
bringing that same capability into the inspector panel for consistency —
do not reinvent the mechanism, reuse the same `TaskPriority` enum, the same
update path (`applyTaskUpdateFields()` / `task-update` event), and ideally
extract/share logic with the card's priority editor from
`web/src/components/kanban/ft-task-card.ts` if it's a clean lift; a
reasonable amount of duplication is acceptable if sharing is awkward, but
avoid diverging behavior between the two entry points (same priority list:
No priority, Urgent, High, Normal, Low).

Scope:
- Add a clickable priority badge/select control in the inspector's
  overview area (near the existing Open/Triage/priority chips display, or
  wherever fits the current layout best — see
  `web/src/components/inspector/ft-inspector-meta.ts` or wherever priority
  is currently rendered read-only).
- Keep scope to this one feature — do not add other unrelated UI changes.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #52) — use a fresh feature branch, PR to merge.
- Web frontend: `/workspace/farmtable/web/src/`
- Reference implementation to mirror:
  `web/src/components/kanban/ft-task-card.ts` (existing priority editing UI
  from Feature 3)
- Inspector files: `web/src/components/inspector/ft-inspector-meta.ts`,
  `web/src/components/inspector/ft-inspector.ts`
- Update path: `web/src/gen/grpc-client.ts`, `web/src/gen/service.ts`
  (`applyTaskUpdateFields()`, `UpdateTaskFields` — priority field already
  wired for the card, should already support inspector use without new
  backend/proto work)
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify
  changing priority in the inspector persists and matches what the card
  shows — real screenshots required.
- Prior feature history for context/patterns:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit.md`
  (original priority editing), `feature-5-label-editing.md`,
  `feature-6-assignee-editing.md` (inspector chip/edit patterns)
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-7-inspector-priority-edit.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real screenshots showing priority editing in the inspector (before,
   dropdown open, after save), saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-7-inspector-priority-edit/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-7-inspector-priority-edit.md`
   with: what was built, each review round's findings and resolutions,
   final state, unaddressed nitpicks, and the developer's optional
   suggestion for the next most logical UI/UX feature. Ask the developer
   explicitly: since inspector now covers description/dates/labels/
   assignees/priority, is there a genuinely new feature left, or should the
   next suggestion revisit one of the deferred items (state leak across
   task switches, click-outside dismissal, phaseForStage placement, etc.
   from earlier feature logs)?
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, and the developer's next-feature suggestion.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator
confirms the merge landed or explicitly tells you to clean up.

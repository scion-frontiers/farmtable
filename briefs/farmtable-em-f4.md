# Brief: Engineering Manager — Feature 4: Task Detail/Inspector Panel

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
  - Developer: `scion start farmtable-f4-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f4-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **Verify, don't assume.** Check the developer's actual git diff/commits
  and actual screenshots (real content, not stubs) before reporting done.
- **Scope guardrail (important):** the underlying `Task` proto
  (`proto/farmtable.proto`) already has `description`, `assignees`,
  `labels`, `relationships`, `start_date`, `due_date`, etc. — so this isn't
  inventing backend fields, but the FULL feature (as suggested) is bigger
  than prior features. To keep this "one feature":
  - In scope: a detail panel that opens on card click (`task-select` event
    is already wired per the developer's suggestion) and displays all core
    fields read-only (description, priority, labels, dates, assignees,
    type, phase/stage).
  - In scope: inline editing for simple scalar fields already supported by
    the existing `updateTask` RPC — at minimum description; add labels
    and/or dates editing too if it's straightforward given what's already
    wired (title/priority editing already exists on the card from feature
    3 — don't duplicate it in the panel unless it's trivial to reuse).
  - OUT of scope for this pass: building new user-picker or task-picker UI
    for editing `assignees` or `relationships` — those need nontrivial
    selection/search UI. Display them read-only in the panel; do not build
    editing for them. Note this explicitly as a follow-up in your report.
  - If read/write RPCs needed for the in-scope fields don't already exist
    on the frontend client, adding a thin client method for an
    already-existing backend RPC is fine. If genuine new backend work would
    be required, stop and message the coordinator to redirect scope rather
    than doing backend/proto work yourself.

## Feature Spec

Suggested by the developer who built Feature 3 (inline card title/priority
editing, merged as PR #49, commit 9df3ed1): add a task detail/inspector
panel that opens when a card is clicked, showing full task information
beyond what fits on the compact Kanban card, with editing for the fields
called out as in-scope above.

- Panel can be a modal, drawer, or side panel — developer's call on what
  fits the existing Shoelace-based design system best.
- Should close on Escape / clicking outside / an explicit close control.
- Should not conflict with the existing inline card editing (title/priority
  edit-in-place should still work; clicking the card body elsewhere, not on
  an edit affordance, opens the detail panel).
- Keep scope to this one feature — do not add other unrelated UI changes.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47,
  #48, #49) — use a fresh feature branch, PR to merge.
- Web frontend: `/workspace/farmtable/web/src/`
- Relevant files from prior features:
  `web/src/components/kanban/ft-task-card.ts` (has `task-select` event
  already wired per the developer's suggestion — verify this and use it),
  `web/src/components/kanban/ft-kanban-view.ts`,
  `web/src/gen/grpc-client.ts`, `web/src/gen/service.ts`
- Data model source of truth: `proto/farmtable.proto` (see the `Task`
  message for full field list — description, assignees, labels,
  relationships, start_date, due_date, type, phase, stage, etc.)
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify the
  panel opens, displays real task data, and (for in-scope fields) saves
  edits — real screenshots required.
- Prior feature history for context/patterns:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui.md`,
  `feature-2-per-column-create.md`, `feature-3-inline-card-edit.md` (same
  directory)
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-4-task-detail-panel.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real screenshots showing the panel open with real task data, and (for
   in-scope editable fields) an edit-and-save flow, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-4-task-detail-panel/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-4-task-detail-panel.md`
   with: what was built, what was explicitly left read-only/out of scope
   (assignees/relationships editing), each review round's findings and
   resolutions, final state, unaddressed nitpicks, and the developer's
   optional suggestion for the next most logical UI/UX feature.
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, and the developer's next-feature suggestion (if any). If
   you had to redirect scope due to missing backend capability, say so
   explicitly.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern/scope-redirect reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator
confirms the merge landed or explicitly tells you to clean up.

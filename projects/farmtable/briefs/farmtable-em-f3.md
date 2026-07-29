# Brief: Engineering Manager — Feature 3: Inline Task Editing from Kanban Card

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
  - Developer: `scion start farmtable-f3-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f3-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **Verify, don't assume.** Check the developer's actual git diff/commits
  and actual screenshots (real content, not stubs) before reporting done.

## Feature Spec

Suggested by the developer who built Feature 2 (per-column create controls,
merged as PR #48, commit 7f7f913): add inline editing of a task directly
from its Kanban card, starting with title and priority, so users don't need
to open a full inspector/detail view for quick corrections.

- Add an inline edit affordance to each task card in
  `web/src/components/kanban/` (check `ft-kanban-column.ts` and any card
  component it renders — there may not yet be a dedicated card component;
  use your judgment on the cleanest way to add this without over-scoping).
- At minimum: allow editing the task title in place (click to edit, or an
  edit icon that reveals an input, save on enter/blur, cancel on escape).
- Also allow changing priority if a priority field/enum already exists on
  the task model (check `proto/farmtable.proto` and
  `web/src/gen/service.ts` / `grpc-client.ts` for what's already wired -
  don't invent a new field if none exists; if there's no priority field at
  all, scope this feature to title editing only and note that priority
  editing needs a schema change as a separate future feature — don't do
  proto/backend schema work in this pass, UI-only scope).
- Use the existing `UpdateTask` RPC if one exists in the gRPC client; if it
  doesn't exist yet, check whether adding a thin client method for an
  already-existing backend RPC is in scope (that's fine — it's still a UI
  feature enablement, not new backend logic) vs. needing new backend work
  entirely (if genuinely no update capability exists on the backend, stop
  and message the coordinator to redirect scope rather than inventing
  backend endpoints yourself).
- Keep scope to this one feature — do not add other unrelated UI changes.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PR #47
  and #48's work) — use a fresh feature branch, PR to merge.
- Web frontend: `/workspace/farmtable/web/src/`
- Relevant files from features 1 & 2:
  `web/src/components/kanban/ft-add-task-dialog.ts`,
  `web/src/components/kanban/ft-kanban-column.ts`,
  `web/src/components/kanban/ft-kanban-view.ts`,
  `web/src/gen/grpc-client.ts`, `web/src/gen/service.ts`
- Proto/data model source of truth: `proto/farmtable.proto`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify the
  inline edit flow works end-to-end (edit, save, see it persist/update on
  the board) — real screenshots required.
- Prior feature history for context/patterns:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui.md`,
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-2-per-column-create.md`
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real screenshots showing the inline edit flow (before edit, editing
   state, after save), saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit.md`
   with: what was built (and what was descoped, e.g. if priority editing
   wasn't possible), each review round's findings and resolutions, final
   state, any unaddressed nitpicks, and the developer's optional suggestion
   for the next most logical UI/UX feature.
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, and the developer's next-feature suggestion (if any). If
   you had to descope or redirect due to missing backend capability, say so
   explicitly in this message.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern/scope-redirect reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator
confirms the merge landed or explicitly tells you to clean up.

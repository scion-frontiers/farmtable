# Brief: Engineering Manager — Feature 2: Per-Column Inline Create Controls

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously. Start one, wait for it to finish, then the next.
- **You do NOT merge anything.** When ready, push the branch and open a PR
  with `gh pr create`, then message the coordinator with the PR URL and
  summary. The coordinator runs `gh pr merge --squash` to origin/main
  itself. Do not merge yourself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback. Never paste previous findings into its prompt or
  reference "what the last reviewer said" — give it only the current
  repo/diff state to review from scratch.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. If it finds anything
    significant/blocking, fix it and run another fresh review round.
  - Hard cap: 5 review rounds total. If round 5 still has significant
    findings, stop anyway and report the unresolved findings honestly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f2-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f2-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations within this
  feature. Only delete it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like a quota/rate-limit/"limits exceeded" issue, do NOT keep
  retrying. Use `scion look <agent>` to check its screen and message the
  coordinator immediately with what you observed. Do not spawn a
  replacement — wait for the coordinator.
- **Verify, don't assume.** Check the developer's actual git diff/commits
  and actual screenshots (real content, not stubs) before reporting done.

## Feature Spec

This feature was suggested by the developer who built Feature 1 (Add Task
UI, merged as PR #47, commit 97867f2): today's "+ Add Task" button always
creates tasks into the Triage column. Add the ability to create a task
directly into a specific column/phase instead of always defaulting to
Triage:

- Add a lightweight "+" / inline create control to each Kanban column
  header (Backlog, Ready, Working, In Review, In QA, Deploying, Completed,
  Triage — whichever set of phases the board currently renders, see
  `web/src/components/kanban/ft-kanban-view.ts`).
- Clicking a column's control should create a task pre-set to that column's
  phase — reuse the existing Add Task dialog/component from PR #47
  (`web/src/components/kanban/ft-add-task-dialog.ts`) rather than
  duplicating it; extend it to accept an initial/target phase.
- The global "+ Add Task" button in the header can remain as-is (defaulting
  to Triage or becoming a generic entry point — your call, keep it working).
- Keep scope to this one feature — do not add other unrelated UI changes.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (already includes
  PR #47's Add Task dialog work) — use a fresh feature branch, PR to merge.
- Web frontend: `/workspace/farmtable/web/src/`
- Relevant files from feature 1 to build on:
  `web/src/components/kanban/ft-add-task-dialog.ts`,
  `web/src/components/kanban/ft-kanban-view.ts`,
  `web/src/gen/grpc-client.ts` (has `createTask` RPC already wired)
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify each
  column's create control actually creates a task in that column — real
  screenshots required (Simulation Trap applies).
- Feature 1's full history for context/patterns used (review findings,
  screenshots): `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui.md`
  and the `feature-1-add-task-ui/` screenshots directory alongside it.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature (write your round-by-round log here):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-2-per-column-create.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real screenshots showing at least two different columns' create controls
   working, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-2-per-column-create/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-2-per-column-create.md`
   with: what was built, each review round's findings and resolutions,
   final state, any unaddressed nitpicks, and the developer's optional
   suggestion for the next most logical UI/UX feature (ask once their
   implementation is done — optional, just relay it).
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

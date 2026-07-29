# Brief: Engineering Manager — Feature 5: Inspector Label Editing

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
  - Developer: `scion start farmtable-f5-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f5-review-rN --type code-reviewer
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
  respond, don't just nudge again and go blocked indefinitely — after one
  nudge with no visible progress, check its actual output/files directly
  (it may have finished and just failed to signal completion) before
  concluding it's stuck.

## Feature Spec

Suggested by the developer who built Feature 4 (inspector description/date
editing, merged as PR #50, commit b099714): add focused label editing in
the task inspector panel using tag chips with explicit add/remove controls
(not a free-text full-list replacement box).

- The backend already supports labels as `repeated string labels` on the
  `Task` proto, and per Feature 4's notes, add/remove label RPC support
  already exists on the backend — verify this and use the existing update
  path (`UpdateTask` / `applyTaskUpdateFields()` from Feature 4) rather than
  inventing new backend/proto work.
- UI: render existing labels as chips/tags in the inspector (labels are
  already displayed read-only per Feature 4 — build on that). Add an
  affordance to remove an individual label (e.g. an "x" on each chip) and
  to add a new one (e.g. an input + enter, or a "+" chip that reveals an
  input).
- Keep scope to this one feature — do not add other unrelated UI changes,
  and do not build a full label-management/autocomplete system (no need
  for a global label picker with existing-label suggestions unless it's
  trivial — simple free-text add is fine for this pass).

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #50) — use a fresh feature branch, PR to merge.
- Web frontend: `/workspace/farmtable/web/src/`
- Relevant files: `web/src/components/inspector/ft-inspector-meta.ts`
  (labels currently rendered read-only here per Feature 4),
  `web/src/components/ft-app.ts` (task-update event handling),
  `web/src/gen/grpc-client.ts`, `web/src/gen/service.ts`
  (`applyTaskUpdateFields()`, `UpdateTaskFields`)
- Data model: `proto/farmtable.proto` (`repeated string labels = 17` on
  `Task`)
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify adding
  and removing a label actually persists — real screenshots required.
- Prior feature history for context/patterns:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-4-task-detail-panel.md`
  (and feature-1/2/3 logs in the same directory)
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-5-label-editing.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real screenshots showing: existing labels as chips, adding a new label,
   removing a label, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-5-label-editing/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-5-label-editing.md`
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

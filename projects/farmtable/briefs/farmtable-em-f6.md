# Brief: Engineering Manager — Feature 6: Inline Assignee Editing

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
  - Developer: `scion start farmtable-f6-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f6-review-rN --type code-reviewer
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

Suggested by the developer who built Feature 5 (label editing, merged as
PR #51, commit b129924): add inline assignee editing in the task inspector
panel. This is backed by existing backend capability:

- `ListUsers` RPC already exists (`proto/farmtable.proto` line ~980) for
  looking up available users.
- `UpdateTaskRequest` already has `repeated string assignee_ids` and
  `bool clear_assignees` fields (line ~563-565) for assignee management.
- `Task.assignees` is `repeated User` (already displayed read-only in the
  inspector per Feature 4).

Scope:
- Add a simple assignee picker to the inspector's Assignees row: a "+"
  control that reveals a dropdown/list of users (fetched via `ListUsers`),
  click to add as an assignee; each current assignee shown as a
  removable chip (mirror the label-chip pattern from Feature 5 —
  `web/src/components/inspector/ft-inspector-meta.ts` — for visual/UX
  consistency).
- A simple text filter on the dropdown list is nice-to-have if
  straightforward, but NOT required — do not build a fancy async-search
  autocomplete if `ListUsers` returns a small/reasonable full list that can
  just be filtered client-side.
- Keep scope to this one feature — do not add other unrelated UI changes.
- If `ListUsers` turns out to require pagination or auth complexity that
  makes this nontrivial, message the coordinator to discuss scope rather
  than building something elaborate.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #51) — use a fresh feature branch, PR to merge.
- Web frontend: `/workspace/farmtable/web/src/`
- Relevant files: `web/src/components/inspector/ft-inspector-meta.ts`
  (assignees currently read-only here; labels chip pattern from Feature 5
  lives here too — reuse the pattern), `web/src/gen/grpc-client.ts`,
  `web/src/gen/service.ts` (`applyTaskUpdateFields()`, `UpdateTaskFields`)
- Data model / RPCs: `proto/farmtable.proto` — `ListUsers` RPC, `User`
  message, `UpdateTaskRequest.assignee_ids` / `clear_assignees`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify adding
  and removing an assignee actually persists — real screenshots required.
- Prior feature history for context/patterns (especially Feature 5's label
  chip pattern to mirror):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-5-label-editing.md`
  (and feature-1 through feature-4 logs in the same directory)
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-6-assignee-editing.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real screenshots showing: assignee picker opening with a user list,
   adding an assignee, removing an assignee, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-6-assignee-editing/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-6-assignee-editing.md`
   with: what was built, each review round's findings and resolutions,
   final state, unaddressed nitpicks, and the developer's optional
   suggestion for the next most logical UI/UX feature.
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, and the developer's next-feature suggestion (if any).

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern/scope-question reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator
confirms the merge landed or explicitly tells you to clean up.

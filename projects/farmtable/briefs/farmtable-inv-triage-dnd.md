# Brief: Investigate — Can't Move Items Out of Triage Column (Kanban)

## Critical Constraints (read first)
- Use a dedicated git worktree if you need the repo: `git worktree add
  /workspace/farmtable-inv-triage -b explore/triage-dnd-investigation origin/main`
  (standing policy — avoids branch collisions with other in-flight work, incl.
  farmtable-deploy-12 which may currently be running).
- **This is investigation only — do not fix anything or open a PR.** Produce a findings
  report; the coordinator will decide whether to dispatch an architect/EM fix afterward.
- Use the live URL for reproduction since this is collection-specific behavior on
  production data — local seed data won't reproduce this collection's actual state.

## Context
ptone@google.com reported (2026-07-22 01:05, verbatim): "In project
https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=f7351b20-3c44-41b1-a253-e8dd6128b250&view=kanban
- why is it I can't move any items out from triage in the kanban view?"

## Task
1. Open that exact URL with Playwright/devtools and reproduce: try to drag a task out of
   the "Triage" (or equivalently-named first-stage) column into another column.
2. **First check the most likely explanation**: is this collection an external/passthrough
   collection (GitHub-backed, etc.)? Check its `platform` field and whether it has a
   LinkedAccount (`ft collection links f7351b20-3c44-41b1-a253-e8dd6128b250` or equivalent
   RPC/CLI check). PR #104 (B7, "UI read-only mode for external collections") intentionally
   makes external collections read-only in the UI — if that's what's happening here, this
   may be BY DESIGN, not a bug, and drag-and-drop being disabled across ALL columns (not
   just Triage) would confirm that theory. Check whether the freeze applies to some columns
   or literally everything you try to drag.
3. If it's NOT an external/read-only collection (i.e., a normal `platform: farmtable`
   collection where full CRUD should work), then investigate as a genuine bug:
   - Check browser console/network tab for errors when attempting the drag (failed
     mutation RPC calls, permission errors, etc.)
   - Check Cloud Run logs for server-side errors around the time of the attempt
     (`gcloud logging read` against project `deploy-demo-test`, service `farmtable`).
   - Check if this is specific to the Triage column (e.g. some validation/workflow rule
     preventing tasks from leaving Triage without some precondition — check
     `internal/store` or wherever task-phase-transition validation happens) or if
     drag-and-drop is broken more generally on this collection/view.
   - Check if there's something specific about the tasks IN Triage for this collection
     (e.g. missing required fields, a phase/status value the drag handler doesn't expect).
4. Determine root cause and classify: (a) intentional read-only behavior working as
   designed, (b) a genuine bug in drag-and-drop specific to this collection, or (c) a
   genuine bug in drag-and-drop generally (would affect all collections — check a different
   collection to confirm/rule this out).

## Deliverables
1. A findings report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/triage-dnd-investigation.md`:
   root cause classification (a/b/c above), evidence (console errors, logs, screenshots),
   and a recommendation (no action needed / needs a targeted fix / needs a broader fix).
2. A message to the coordinator with the root cause summary and recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST determine the root cause, produce the findings report, and message the
coordinator. Then signal task_completed.

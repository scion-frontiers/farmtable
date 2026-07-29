# Brief: Engineering Manager — Own Implementation of Auth Improvements Plan (Full Lifecycle)

## Critical Constraints (read first)

- **You own the full implementation lifecycle across all 6 stages / 62 tasks.** Spawn
  your own developers and reviewers directly for each task/subtask — only contact the
  coordinator when a stage is complete and ready, or you're genuinely blocked on something
  only the coordinator can resolve (infra, credentials, cross-project decisions).
- **This is NOT a blind exercise** — you have full context. Read everything below before
  starting.
- **Use a dedicated git worktree per task/stage**, not the shared `/workspace/farmtable`
  checkout — standing policy. Use a clear naming scheme (e.g.
  `/workspace/farmtable-auth-stageN-taskM`) since this will span many parallel/sequential
  pieces of work.
- **Use the live deployed instance** for reading/updating task status as you work (`ft`
  CLI with dual-header IAP auth — see `/workspace/agents.md`). Update task status
  (in-progress/completed) on the live "Auth Improvements" collection as you go, so
  progress is visible there, not just in your own internal tracking.
- **Follow the critical path**: Stage 1 → Stage 3 → Stage 4 → Stage 6 is the critical path
  per the collection's dependency graph; Stages 2/3 and 5/6 are parallelizable after their
  prerequisites. Respect the BLOCKS/BLOCKED_BY relationships already encoded in the
  collection — don't start a blocked task before its blockers are done.
- **Only one dev/reviewer agent runs at a time per task.** Standard blind-review process
  for each code change: fresh `code-reviewer` agent, Round 1 fix everything, Round 2+ stop
  on nitpicks only, cap 5 rounds.
- **Real evidence required for every task** — this project has a well-established, strict
  evidence bar (see recent history: Features 43-60 all required genuine before/after or
  quantitative proof, several got sent back for duplicate/fake screenshots). Hold yourself
  and your dev/reviewer agents to that same bar.
- **The coordinator will NOT independently re-read your diffs or re-open your
  screenshots** — your own verification (and your reviewers') is what stands.

## Context

`farmtable-architect-auth` designed a 6-stage auth improvements plan (approved by
ptone@google.com), which was decomposed into a Farmtable task collection, then refined
based on a blind-EM evaluation exercise (added missing context, scion-reference pointers,
decision tasks, deploy/verify tasks, and a cross-stage integration test). The plan is now
ready for implementation.

- **Design doc**: `/scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md`
  (6 stages, acceptance criteria, now includes a 10-pattern scion reference table with file
  paths/line numbers).
- **Current-state findings**: `/scion-volumes/scratchpad/projects/farmtable/auth-current-state.md`
- **Task collection**: "Auth Improvements", ID `9a16e171-59e6-4179-a79d-708b8e2adade`, on
  the live instance — 62 tasks (7 stage-epics + subtasks + deploy/verify tasks + decision
  tasks + integration test). Stage 0 (x-farmtable-token fix, PR #136) is already complete.
- **Scion reference source**: `/scion-volumes/scratchpad/scion-reference/` — a shallow
  clone of `GoogleCloudPlatform/scion`, referenced throughout the design doc and tasks for
  patterns to borrow (auth interceptors, RBAC, OAuth/IAP proxy patterns).
- **Blind-EM exercise learnings** (for context on why tasks are structured this way):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/task-decomposition-quality.md`,
  `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase1.md`,
  `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase2.md`
- **Task edit log** (what was added/why): `/scion-volumes/scratchpad/projects/farmtable/auth-tasks-refine-log.md`

## Task

1. Read the design doc, current-state findings, and the task collection in full (`ft task
   list -c 9a16e171-59e6-4179-a79d-708b8e2adade` and drill into each stage epic + its
   subtasks) before starting any implementation.
2. Work through the plan stage by stage, respecting dependency order. For each subtask:
   spawn a fresh developer agent (worktree per task), implement, get a blind code review,
   iterate to approval, open a PR, merge (you own merging for this workstream — unlike the
   UI feature loop, you have full authority here since this is your dedicated
   implementation lifecycle), update the task's status on the live collection, move to the
   next.
3. There are 3 open DECISION tasks (scope vocabulary, OAuth provider choice, encryption key
   management) — resolve these yourself using the design doc's guidance and your own
   judgment where the doc doesn't fully specify; if a decision genuinely needs
   ptone@google.com's input (not just your best judgment), message the coordinator to relay
   the question rather than guessing on something consequential.
4. There's a cross-stage integration test task — implement it after the relevant stages it
   covers are done.
5. Report to the coordinator after each STAGE completes (not each individual task) with a
   summary — the coordinator needs to track stage-level progress and may want to redeploy
   after each stage.
6. Redeploy is your own responsibility for this workstream too — dispatch deploy
   verification the same way the coordinator has for the UI feature loop (a `default`-type
   agent building+deploying+verifying `main`), OR ask the coordinator to handle deploys if
   you'd rather keep your own context focused on implementation — your choice, document it.

## Deliverables

Per stage:
1. All that stage's tasks merged to `main`, task collection updated to reflect completion.
2. Real evidence for each piece of work (screenshots, quantitative logs, live verification
   as appropriate — matching the bar this project has consistently held).
3. A message to the coordinator summarizing the completed stage, with PR links.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for stage-complete reports or
  genuine blockers only you can't resolve.
- Design questions: `scion message farmtable-architect-auth "<question>"` — available for
  clarification throughout.
- Do not message ptone@google.com directly — relay through the coordinator if their input
  is genuinely needed on a decision.

## Termination

You own this until all 6 stages (plus the integration test) are implemented, merged, and
the task collection reflects full completion. Message the coordinator after EACH stage
completes — don't batch everything into one final report. Signal task_completed only after
the entire plan is done.

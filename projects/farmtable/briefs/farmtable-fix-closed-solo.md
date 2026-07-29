# Brief: Fix — Dependency View Excludes CLOSED Tasks Even When Explicitly Selected/Soloed

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-fix-closed-solo -b fix-dependency-closed-solo origin/main`
- **Surgical fix only** — do NOT remove the CLOSED-task filter entirely from Dependency
  View. The filter exists intentionally to keep the graph focused on active work; the bug
  is specifically about the EXPLICITLY SELECTED/SOLOED task being excluded even when the
  user deliberately chose to look at it. Other unrelated CLOSED tasks should stay hidden.
- Read the full investigation report first — it already has verified line numbers and a
  recommended approach:
  `/scion-volumes/scratchpad/projects/farmtable/reports/beads-relationship-bug-investigation.md`

## Context
Bug reported by ptone: a task's Dependency View (in Solo mode) shows "no relationships"
even though the same task's Tree View inspector correctly shows 3 BLOCKS relationships.
Root cause (verified via live API inspection, not a data/import issue): the selected task
is CLOSED (phase=4). `ft-dependency-view.ts`'s `getVisibleTasks()` (~line 624-673) and
`getDirectedReachableIds()` (~line 100-138, the Solo-mode BFS) both unconditionally skip
CLOSED tasks — including the one the user explicitly selected and soloed. Since the BFS
can't even start from a CLOSED node, it returns an empty set. This is a general bug
(affects ANY collection, not just Beads imports) — the Beads importer itself is
confirmed correct.

Repro (live, for reference — may need to select a similarly-CLOSED task with real
relationships if the exact collection isn't reachable from your environment):
`https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7&view=dependencies&task=9f7731a8-a23d-493d-86eb-2ac5d39f5e7a&layoutdir=LR&solo=1`

## Task
1. Implement the fix per the investigation's recommended approach:
   - `getVisibleTasks()`: after building `involvedIds` via the main loop (which skips
     CLOSED tasks), add a solo-mode exception — if `isolateMode` is active and
     `selectedTaskId` refers to a CLOSED task, manually add that task and its direct
     relationship targets to `involvedIds`.
   - `getDirectedReachableIds()`: allow the BFS to START from a CLOSED task when it's the
     explicitly-selected task (not a node reached via traversal). Keep the CLOSED filter
     for all OTHER nodes encountered during traversal — i.e., don't let the BFS wander
     into unrelated closed tasks, only bypass the filter for the anchor/selected node
     itself.
   - Verify `computeLayers()` and edge-building logic handle a CLOSED task appearing in
     the task list correctly (the investigation report suggests this should already work
     since it's the general-purpose layer/edge computation, not phase-aware) — confirm
     this assumption, don't just trust it.
2. Verify NORMAL (non-solo) Dependency View behavior is unchanged — CLOSED tasks should
   still be hidden from the full graph view when Solo is OFF.
3. Verify with real screenshots on a real CLOSED task with real relationships (create a
   test collection locally if the exact production collection/task isn't reachable, but
   make sure to actually complete/close a task with BLOCKS relationships to reproduce the
   exact scenario — don't just reason about it).
4. Run `npx tsc --noEmit`.

## Deliverables
1. A PR against `main`.
2. Screenshots showing: (a) the bug reproduced on a local test case before the fix
   (Solo on a CLOSED task shows nothing), (b) the fix working (Solo on a CLOSED task
   shows its real relationships), (c) confirmation normal non-solo behavior still hides
   CLOSED tasks. Saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/closed-solo-fix-evidence/`.
3. A message to the coordinator with the PR link and summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST implement the surgical fix (exempt only the explicitly-selected CLOSED task, not
remove the filter entirely), verify with real before/after screenshots on an actual CLOSED
task with real relationships, confirm normal behavior is unaffected, open the PR, and
message the coordinator with the PR link. Then signal task_completed.

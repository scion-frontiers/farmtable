# Brief: Engineering Manager — Apply Blind-EM Learnings to Auth Task Collection + Add Scion Reference

## Critical Constraints (read first)

- **This is a task-editing/data task, not a code feature.** Your deliverable is an updated
  Farmtable collection — no PR/review cycle needed.
- **Use a dedicated git worktree if you need repo access**: `git worktree add
  /workspace/farmtable-auth-tasks-refine -b explore/auth-tasks-refine origin/main`
  (standing policy).
- **Use the live deployed instance** via the `ft` CLI with the dual-header IAP auth pattern
  — check `/workspace/agents.md`'s "Authenticating to the IAP-Protected Cloud Run Instance"
  section for exact usage. Collection: "Auth Improvements", ID
  `9a16e171-59e6-4179-a79d-708b8e2adade`.
- **This is NOT a blind exercise** — you have full context. Read everything referenced
  below before editing anything.

## Context (ptone@google.com, verbatim, 2026-07-23)

"we should capture the learnings of the EM. these will eventually feed into a skill for
agents to build DAgS let them know about the reference scion source. have them add and edit
the tasks with the improvements they suggested. then we will start a non blind EM to
oversee implementation. include the scion source reference in scratchpad if not in design
doc."

A blind-EM exercise (`farmtable-em-blind-auth-exercise`, now deleted — its reports remain)
evaluated the "Auth Improvements" task collection as a standalone execution plan: Phase 1
read ONLY the tasks (confidence 3/5 that a dev could execute from tasks alone), Phase 2
then read the design doc and identified gaps. Reports:
- `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase1.md`
- `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase2.md`

Phase 2's key findings (read the full report for complete detail, this is a summary): tasks
conveyed dependency structure, RBAC vocabulary, backward-compat and test requirements well,
but were MISSING: non-goals, architectural rationale, current-state context, references to
patterns borrowed from the scion reference source, and open questions. Top recommendation:
add 3-5 sentences of context per epic (stage task) bridging the design doc's rationale into
the implementation-level tasks.

Also relevant: there's a shallow reference clone of `GoogleCloudPlatform/scion` at
`/scion-volumes/scratchpad/scion-reference` (cloned earlier this session per
ptone@google.com's request specifically because "we want to borrow some of the auth
concepts from scion"). Check whether `design-auth-improvements.md` already references this
source for any of its 6 stages — if it does, good, make sure the corresponding Farmtable
tasks also carry that reference; if the design doc DOESN'T reference it where it should
(e.g. for OAuth/SSO patterns in Stage 5, or RBAC patterns in Stage 4), that's a gap to flag
back to `farmtable-architect-auth` (message them, don't just silently patch the design doc
yourself — that's their document).

## Task

1. Read both blind-EM exercise reports in full.
2. Read `/scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md` and
   check for existing scion-reference callouts.
3. For each of the 7 tasks representing a stage/epic in the "Auth Improvements" collection,
   edit its description to add the missing context the blind exercise identified:
   non-goals, brief architectural rationale (why this approach vs. alternatives, if the
   design doc explains it), and a pointer to relevant scion reference source patterns where
   applicable (e.g. `/scion-volumes/scratchpad/scion-reference/<relevant path>` — find the
   actual relevant files/dirs in that reference clone for auth/RBAC/OAuth patterns, don't
   just gesture vaguely at "check scion").
4. Where the blind exercise flagged specific subtask-level gaps (open questions, unclear
   acceptance criteria), edit those subtasks too — use judgment on scope, the goal is
   meaningfully closing the gaps the exercise found, not a token gesture.
5. If you find the design doc itself is missing a scion-reference callout where one clearly
   should exist, message `farmtable-architect-auth` with the specific gap rather than
   editing their doc yourself.
6. Document what you changed and why in a log.

## Key Locations

- Blind-EM exercise reports (read first):
  `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase1.md`,
  `/scion-volumes/scratchpad/projects/farmtable/exercise-blind-em-phase2.md`
- Design doc: `/scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md`
- Scion reference source: `/scion-volumes/scratchpad/scion-reference/`
- Auth task DAG breakdown log (for context on original structure):
  `/scion-volumes/scratchpad/projects/farmtable/auth-task-breakdown-log.md`
- IAP/Cloud Run access instructions: `/workspace/agents.md`
- Your scratchpad — create a running log:
  `/scion-volumes/scratchpad/projects/farmtable/auth-tasks-refine-log.md`

## Deliverables

1. Updated tasks in the live "Auth Improvements" collection (all 7 stage-epics at minimum,
   plus relevant subtasks) incorporating the blind-EM exercise's recommendations.
2. The running log documenting exactly what was added/changed per task and why.
3. If applicable, a message to `farmtable-architect-auth` flagging any design-doc gaps
   found (scion-reference callouts missing where they should exist).
4. A message to the coordinator with a summary of changes made, for tracking.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Design doc gaps: `scion message farmtable-architect-auth "<gap description>"`.
- Do not message ptone@google.com directly.

## Termination

You MUST apply the improvements to the task collection, produce the log, message
`farmtable-architect-auth` if design-doc gaps are found, and message the coordinator with a
summary. Then signal task_completed.

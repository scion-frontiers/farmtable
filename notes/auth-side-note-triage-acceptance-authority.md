# Side Note: Triage Acceptance Authority

**Date:** 2026-07-25
**Source:** Farm Table task state model review with ptone and c-phase
**Status:** Future authorization design input. Not immediate implementation work.

## Finding

The transition from `triage` to the proposed native pre-work state `accepted`
is an authorization and policy concern, not a core task-state data model
concern.

The task-state model should represent the assertion:

- `triage`: no actor has yet decided the task should be done.
- `accepted`: an authorized actor or process has decided the task should be
  done, but work has not started.

Who is allowed to make that assertion should be handled by authorization and
workflow policy, not by encoding human-vs-agent assumptions into the task
schema.

## Design Implication

The model should not assume the intake reviewer is always human. The accepting
actor may be a human, an agent, a supervisor/orchestrator, or another trusted
automation path.

The authorization model may eventually need an explicit capability such as
`task:accept`, `task:triage`, or equivalent. That capability would govern who
can move tasks from `triage` to `accepted`.

This should remain separate from normal task execution permissions. The actor
that accepts work into the queue and the actor that later claims or executes
the work may be different roles.

## Non-Urgent

This is only a finding for future authorization design. It does not need to be
acted on immediately for the current task-state model refactor.

If this raises concerns or overlaps with active auth design work, ptone asked
that questions be taken up with him in the existing auth-focused thread.

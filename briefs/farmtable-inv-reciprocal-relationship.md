# Brief: Investigate — Missing Reciprocal Relationship Display (BLOCKS ↔ BLOCKED_BY)

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-inv-reciprocal -b
  explore/reciprocal-relationship origin/main` (standing policy — farmtable-deploy-22 may
  be active in its own worktree, this avoids collision).
- **Investigation only — do not fix anything yet.** Produce findings; the coordinator will
  decide on a fix dispatch based on what you find (this could be a data-model issue, a
  query issue, or a display issue, each with different fix scope).
- Use the local-first verification protocol to reproduce
  (`/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`) — faster than
  live for this kind of investigation.

## Context
ptone@google.com reports (2026-07-22 15:13, verbatim): "why is adding a blocking
relationship not adding the reciprocal. If I add a 'blocks' relationship to task A saying
it Blocks B, then click on B, I would expect it to say blocked by A - have an investigator
look into this."

This touches the relationship data model (Feature 25's original Relationships tab, PR #71)
and Feature 46's add-relationship flow (PR #123, command palette in add-relationship mode)
and Feature 48's drag-and-drop relationship creation (PR #124) — any/all of these could be
implicated depending on where the actual bug lives.

## Task
1. **Reproduce**: create two tasks A and B locally. Add a "Blocks" relationship from A to
   B (A blocks B) via whatever UI path is easiest (Feature 46's command palette add flow,
   or Feature 48's drag-and-drop). Open B's Inspector Relationships tab — confirm whether
   it shows "Blocked by A" or not.
2. **Find the root cause** — investigate at each layer:
   - **Data model**: check `proto/farmtable.proto` and `internal/store/schema/` for how
     relationships are stored. Is a BLOCKS relationship stored as a single directional
     edge (A→B, type=BLOCKS) with the reverse (B→A, type=BLOCKED_BY) expected to be
     synthesized/queried on read? Or are both directions supposed to be written as two rows
     at creation time? This determines whether the bug is in the WRITE path (not creating
     the reciprocal row/reference) or the READ path (not querying/synthesizing the reverse
     direction when displaying a task's relationships).
   - **Write path**: check whatever RPC/mutation Feature 46's `addBlockedBy`/add-relationship
     flow calls (`applyTaskUpdate` or similar, referenced in Feature 48's log) — does it
     write one relationship record or two (one on each task)?
   - **Read path**: check how the Relationships tab queries/displays a task's relationships
     — does it query BOTH "where I am the subject" and "where I am the object" of a
     relationship, or only one direction?
   - Check if this bug is old (pre-existing since Feature 25, PR #71) or a regression from
     Feature 46/48's newer add-relationship code paths — check `git log` /
     `git blame` on the relevant query/mutation code.
3. Determine the precise fix location and scope: is this a one-line query fix (read BOTH
   directions), a write-path fix (write both directions atomically), or something in the
   Ent schema itself (e.g. missing an inverse edge definition)?

## Deliverables
1. A findings report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/reciprocal-relationship-investigation.md`:
   root cause, exact file/line, whether it's old or a regression, and a clear fix
   recommendation with scope estimate.
2. A message to the coordinator with the root cause summary and recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with findings.
- Do not message ptone@google.com directly.

## Termination
You MUST reproduce the issue, find the root cause, produce the report, and message the
coordinator. Then signal task_completed.

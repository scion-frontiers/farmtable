# Brief: Investigate Relationship Data Model — Single Edge vs Duplicated Entities (Long-Lived)

## Critical Constraints (read first)
- **This is an open-ended investigation/discussion, not a scoped fix task.**
  ptone@google.com wants to understand the actual data model and discuss it with you
  directly.
- **Contact ptone@google.com directly** via `scion message --non-interactive ptone@google.com
  --channel discord --thread-id 1528900732965748836 "<message>"` for the discussion itself
  — the coordinator is not a conduit for this conversation. Only message the coordinator
  for infra-level blockers or a milestone report.
- **You are a long-lived agent** — ptone@google.com explicitly asked you to "stick around
  for follow-up questions." Do not signal task_completed after your first report. The
  coordinator will not delete you without the user's explicit confirmation.
- Use a dedicated git worktree if you need to inspect the repo:
  `git worktree add /workspace/farmtable-inv-relmodel -b explore/relationship-model
  origin/main` (standing policy — a separate EM, farmtable-em-f49, is actively fixing an
  immediate-sync bug in its own worktree right now; this is safe and unrelated to what you're
  investigating).
- **Important context**: a related but DIFFERENT bug was just found and is being fixed
  (Feature 49, in progress): the FRONTEND had a caching/event-sync bug where adding a
  relationship didn't immediately update the OTHER task's local UI state until a reload.
  That's a client-side optimistic-update bug, not necessarily a data-model design question.
  ptone@google.com's question here is different and deeper: whether the underlying DATA
  MODEL itself needs a single graph edge (with perspective-dependent labeling) or whether
  it's actually storing/needing duplicate relationship entities. Read
  `/scion-volumes/scratchpad/projects/farmtable/reports/reciprocal-relationship-investigation.md`
  (the prior investigation) for context on what's already known, but your job is to go
  deeper on the SCHEMA/MODEL question specifically, which that report touched on but didn't
  fully resolve.

## Context (ptone@google.com, verbatim)

"I want an investigator to look into this reciprocal 'blocked by' and 'blocking'
relationship types. My understanding is that in a graph structure, it's a single edge that
connects two nodes, and the relationship type depends on the perspective of which node
you're looking at. We shouldn't need to create a fully reciprocal relationship entity in
the data model. Maybe I'm misunderstanding something."

## Task

1. **Read the actual schema** — `internal/store/schema/` (Ent schema definitions) for
   however Task-to-Task relationships (BLOCKS, BLOCKED_BY, PARENT, CHILD, RELATED,
   DUPLICATE_OF, etc.) are modeled. Determine precisely:
   - Is there ONE relationship table/edge type with a `type` field and a
     direction/subject/object pair (i.e., truly a single graph edge — the model
     ptone@google.com expects)?
   - Or are there actually TWO separate relationship types stored (e.g. a `BLOCKS` edge AND
     a separate `BLOCKED_BY` edge, requiring both to be written)?
   - Or is it a single edge type (e.g. just `BLOCKS`, A→B) with `BLOCKED_BY` being purely a
     DISPLAY-TIME label used when rendering from B's perspective (i.e., B's "Blocked by"
     list is populated by querying "which tasks have a BLOCKS edge pointing at me" — this
     would be the single-edge-with-perspective model ptone@google.com describes)?
2. **Trace the actual read and write paths** (proto/farmtable.proto, `internal/`,
   `convert.go` mentioned in the prior investigation) to confirm which of the above is
   actually implemented today. The prior investigation found "the backend read path IS
   correct — convert.go synthesizes reciprocal relationships on read" — dig into exactly
   HOW it synthesizes them: does it literally do the perspective-dependent single-edge
   query ptone@google.com describes, or does it do something else (e.g. write two rows at
   creation and then just correctly reads both back)?
3. **Answer directly**: is the current data model already the clean single-edge model
   ptone@google.com expects (in which case Feature 49's fix is purely a frontend
   caching/event bug, unrelated to the data model), or is there actual duplication/
   complexity in the schema that could be simplified? If the latter, describe what a
   cleaner single-edge model would look like and roughly what it would take to migrate to
   it (this is exploratory — don't write code, just describe the shape of the change).
4. Discuss findings with ptone@google.com directly and answer their follow-up questions as
   they come.

## Deliverables
1. A findings doc: `/scion-volumes/scratchpad/projects/farmtable/relationship-model-analysis.md`
2. Direct communication with ptone@google.com on Discord thread `1528900732965748836`.
3. A message to the coordinator with a brief summary once you've delivered your initial
   findings (for tracking purposes) — but stay alive for follow-up per the user's request.

## Direct Contact
- ptone@google.com: `scion message --non-interactive ptone@google.com --channel discord
  --thread-id 1528900732965748836 "<message>"` — your primary channel.
- Coordinator: `scion message coordinator "<message>"` for infra blockers only.

## Termination
Do NOT signal task_completed after your initial report — stay available for follow-up
discussion as explicitly requested. Only wind down if/when ptone@google.com or the
coordinator explicitly says this workstream is closed.

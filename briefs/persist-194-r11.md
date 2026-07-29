# Brief: Persistence Walk — adapter struct literal to taskToProto

## READ THIS FIRST — CONSTRAINTS

1. **NO BUILDS. NO go build, NO make, NO test suite, for any reason.** The host crashed
   on 2026-07-28 from concurrent Go builds and there is exactly one build token in this
   project; you do not hold it. This task is answerable from source alone. If your
   analysis seems to need a build, it does not — report that instead.
2. **READ ONLY AT COMMIT e6bda71. DO NOT READ THE WORKING TREE.**
   /workspace/farmtable has HEAD 633f8f2 on branch task-state-web-ui-v2, which has
   DIVERGED from e6bda71: merge-base 7a0f220, 39 commits one side and 26 the other,
   neither an ancestor of the other. Reading a file path in that working tree gives you
   WELL-FORMED CONTENT FROM THE WRONG TREE, which is worse than an error because nothing
   signals. Earlier tonight this exact mistake nearly produced a false accusation.
   Use: git -C /workspace/farmtable show e6bda71:PATH
3. **EVERY CITATION IN YOUR REPORT CARRIES THE SHA.** Write pointers as
   e6bda71:internal/path/file.go:NNN — never as a bare file:line. A file:line without a
   SHA is meaningless in this project.
4. **MODIFY NOTHING.** No writes anywhere except your one output file.
5. **DO NOT INFER WHICH ANSWER IS WANTED.** Both answers are useful and neither is a
   failure. Report what the source says.

## The question, stated neutrally

In the GitHub passthrough path, an adapter builds an in-memory Go struct literal roughly of
the form:

    t := ent.Task{ ... RemoteData: issueBuildRemoteData(owner, repo, issue) ... }

That RemoteData value eventually reaches the protobuf conversion function taskToProto in
internal/server/convert.go.

**ENUMERATE EVERY PATH from that struct literal to taskToProto, and for each path state
whether the RemoteData value undergoes any SERIALISATION ROUND-TRIP along the way** —
that is, any encode-then-decode step such as: JSON marshal/unmarshal, a database write
followed by a read, ent client Create/Save followed by a query, a cache put/get, gRPC
transit, or any other step where the value leaves Go memory and is reconstructed.

The property that matters is whether the value arriving at taskToProto is THE SAME GO
VALUE the adapter constructed, or a RECONSTRUCTION of it.

Why this is not a trivia question: a JSON round-trip normalises Go slice types — a
[]string becomes []any, and a []map[string]any becomes []any. So a value that has been
round-tripped has DIFFERENT DYNAMIC TYPES than the value the adapter built, even though it
carries identical data.

## What to do

1. Locate the passthrough construction site. Start at
   e6bda71:internal/platform/passthrough/passthrough.go and find the ent.Task literal.
2. Trace forward. Every function that receives that task or its RemoteData, until you
   reach taskToProto in e6bda71:internal/server/convert.go.
3. **Enumerate ALL paths, not the first one you find.** If the task can reach taskToProto
   by more than one route — a direct in-memory return AND a persisted-then-queried route,
   for example — both count and both must be reported separately. A single path reported
   as though it were the only one is the primary failure mode for this task.
4. For each path, classify: DIRECT (no round-trip, same Go value) or RECONSTRUCTED (state
   the exact step where encode or decode happens, with a SHA-pinned citation).
5. State explicitly whether you enumerated exhaustively or ran out of budget. An honest
   partial enumeration is worth more than a confident incomplete one.

## Traps specific to this walk

**The vacuous pass.** Finding no round-trip because you stopped tracing early looks
identical to finding no round-trip because there is none. Report the depth you reached and
the last function you inspected on every path.

**Interface boundaries.** If the value passes through an interface, a channel, or a
generic container, the concrete type may be obscured. Say so rather than assuming
continuity.

**Do not reason from function names.** Names have been wrong four separate times in this
project tonight, including a function whose name asserted a property it did not have.
Read bodies.

## Key locations
- Canonical repo, READ ONLY, never git gc or git prune: /workspace/farmtable
- All reads via: git -C /workspace/farmtable show e6bda71:PATH
- Relevant starting points at e6bda71:
    internal/platform/passthrough/passthrough.go
    internal/platform/github/graphql_queries.go
    internal/platform/beads/beads.go
    internal/server/convert.go
    internal/ent/entstore.go

## Deliverable

One markdown file at
  /scion-volumes/scratchpad/projects/farmtable/reports/persistence-walk-194-r11.md

It must contain: a numbered list of every enumerated path; for each, the ordered call
chain with SHA-pinned citations; the DIRECT or RECONSTRUCTED classification with the exact
encode/decode step named for every RECONSTRUCTED path; and a closing statement of whether
the enumeration is exhaustive or partial.

## Direct contact

Questions you cannot resolve from source go to the agent named "coordinator" via
scion message. Do NOT contact the user. Do NOT contact the eng-manager — it is mid-round
and this walk must not be shaped by it.

## Termination

You MUST write the completed report at the path above, confirm it is non-empty and names
every path you found, and then mark the task complete.

# Brief: Investigate Beads-Import Task — Relationships Missing in Dependency View

## Critical Constraints (read first)
- This is an **investigation only** — produce root-cause findings + a recommendation, do
  NOT implement a fix yet (the fix location is genuinely ambiguous: could be the Beads
  importer, could be Dependency View's relationship-reading logic — figure out which
  before anyone touches code).
- Use the LIVE production instance for reproduction — do not try to reproduce on a local
  build unless you first confirm the same collection/data exists there (it likely
  doesn't; this is a live-imported collection).

## User Report (verbatim, from ptone@google.com, via Discord)
"We need to investigate this bug or glitch in data model or presentation for our test
beads import. I have an issue I can see on tree view: [Tree View URL below]. In the
inspector it shows that it blocks three tasks. I can see those on tree view. But when I
leave the task above highlighted, and solo'd, then switch to dependency view - it does
not show up. [Dependency View URL below] This says there are no relationships"

## Repro URLs
- Tree View (shows the bug correctly working — 3 BLOCKS relationships visible):
  `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7&view=tree&task=9f7731a8-a23d-493d-86eb-2ac5d39f5e7a&layoutdir=LR&solo=1`
- Dependency View (shows the bug — claims no relationships):
  `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7&view=dependencies&task=9f7731a8-a23d-493d-86eb-2ac5d39f5e7a&layoutdir=LR&solo=1`

Collection `7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7` was imported via Feature 45 (Beads JSONL
import, `internal/.../beads*.go` or similar — search for it) — this is likely relevant
since it's a data-model/import question, not a hand-created-in-app collection.

## Task
1. Reproduce both URLs live. Confirm the discrepancy: Tree View inspector/Solo shows 3
   BLOCKS relationships for the task; Dependency View with the same task+solo shows none.
2. Inspect the actual relationship data for this task via the API/gRPC directly (e.g.
   `GetTask` or `ListRelationships` equivalent) — don't just trust either UI. Get the raw
   relationship records: type (BLOCKS/BLOCKED_BY/PARENT_CHILD/etc.), direction (source/
   target task IDs), and any other fields.
3. Compare against how a NATIVELY-created relationship (in a non-imported collection)
   looks in the same raw form — is there a structural difference (missing field, wrong
   type enum value, reversed direction, wrong task ID reference)?
4. Read the Beads importer code (Feature 45) — how does it map Beads' own relationship
   representation into farmtable's `Relationship` records? Look for a mapping bug (e.g.
   wrong RelationshipType enum, or writing only one direction of a bidirectional pair).
5. Read `ft-dependency-view.ts`'s `getVisibleTasks()` and `computeLayers()` — what
   relationship type(s)/field(s) do they filter on? Compare against what the Tree View
   inspector reads (probably a more permissive/raw read of `task.relationships`).
6. Identify the root cause: is it (a) the Beads importer writing malformed/incomplete
   relationship data that Tree View's more lenient read tolerates but Dependency View's
   stricter read rejects, or (b) Dependency View's filtering logic being incorrectly
   strict/buggy for a case that's actually valid data, or (c) something else entirely.
7. Recommend a fix location and approach (still just a recommendation, not code).

## Deliverables
1. A findings doc at
   `/scion-volumes/scratchpad/projects/farmtable/reports/beads-relationship-bug-investigation.md`
   with the raw relationship data you found, the code-level root cause, and a recommended
   fix location/approach.
2. A message to the coordinator with a one-paragraph summary of the root cause and
   recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with questions or the final summary.
- Do not contact ptone@google.com directly — the coordinator relays.

## Termination
You MUST reproduce the bug live, inspect the raw relationship data (not just trust either
UI), identify the actual root cause with code references, and recommend a fix location.
Then message the coordinator and signal task_completed.

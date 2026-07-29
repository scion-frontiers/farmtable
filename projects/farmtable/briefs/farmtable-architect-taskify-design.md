# Follow-up Brief: Decompose the External-Store Passthrough Design into a Task DAG on the Live Server

## Critical constraints (read first)
- This is data creation on the LIVE Cloud Run service (https://farmtable-qo7k5fvpda-uc.a.run.app),
  not local. Create a NEW collection for this — do not touch the `default` collection or
  any other existing collection (including the two test ones from prior experiments:
  `466c2baa-334e-439c-b9f9-abbe89eb8aae`, and the two from deploy-4's round-trip test).
- Get the API token the same way deploy briefs do:
  `TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)`,
  `export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443`, then use `ft` CLI
  commands with `--token "$TOKEN"` (or however your existing session has it configured).
- Do not write application code for this task — you're populating task data on the live
  service, not implementing the design itself.

## Context
ptone@google.com has reviewed and iterated with you on
`/scion-volumes/scratchpad/projects/farmtable/design-external-store-passthrough.md`. They
now want the design's implementation work turned into real, tracked tasks — on Farmtable
itself (dogfooding), on the live hosted server — decomposed with enough detail that each
task could be picked up and executed by a developer agent who has ONLY:
(a) the design doc's high-level overview, and
(b) that one task's own description.

This means each task must be genuinely self-contained: no task should require reading a
sibling task's details to understand its own scope, inputs, interfaces, or acceptance
criteria. If two tasks share an interface contract (e.g. one task defines a Go interface,
another implements it), state that contract explicitly in BOTH tasks' descriptions rather
than assuming the reader has seen the other task.

The user specifically asked for this to be structured as something "a managed DAG of
developer agents" could be assigned to — meaning real dependency structure, not just a flat
list or loose phase grouping. Farmtable's data model already supports this:
- `parent_task_id` for hierarchy (e.g. a phase as a parent, its work items as children)
- `Task.relationships` with `BLOCKS`/`BLOCKED_BY`/`RELATED`/`DUPLICATE` types for
  non-hierarchical sequencing (e.g. "task C can't start until task A and task B both merge,
  even though they're not parent/child")
Use both deliberately: hierarchy for organizational grouping (phases/categories), and
BLOCKS/BLOCKED_BY relationships for actual execution-order dependencies. A task with no
unmet BLOCKED_BY dependencies is "ready" — that's what makes this an assignable DAG rather
than just an outline.

## Task
1. Re-read your own design doc in full (you know it, but confirm nothing has drifted from
   the version at the path above — this may differ from your earlier
   `reports/design-external-store-brainstorm.md`, which was the exploratory brainstorm;
   the passthrough doc is the one to decompose).
2. Create a new collection on the live server for this project (e.g. name like "External
   Store Passthrough" or similar — your call, make it clearly identifiable).
3. Decompose the design's phased implementation plan into individual tasks:
   - Each task needs a clear title and a description with: exact scope (files/interfaces/
     components touched), inputs it can assume exist (from tasks it depends on), outputs/
     deliverables it must produce, and acceptance criteria (how would a reviewer know it's
     done correctly) — detailed enough to hand directly to a developer agent as its brief,
     without that agent needing anything beyond the design's overview + this description.
   - Group related tasks under a parent task per phase/category (using `parent_task_id`)
     for organizational clarity.
   - Set BLOCKS/BLOCKED_BY relationships between tasks with real sequencing dependencies
     (not just "everything in phase 2 blocks on everything in phase 1" if the real
     dependency is narrower — be precise, since a coarse DAG defeats the point of asking
     for one).
   - Use whatever priority/label/type fields the CLI supports to make the resulting board
     genuinely useful (not just a wall of identical tasks).
4. Create these via the `ft` CLI (or direct gRPC calls if needed) against the live server.
   Check `ft task create --help` / `internal/cli/` for exact flags for setting
   parent/description/relationships — if relationships can't be set at creation time, set
   them via a follow-up `ft task update`/relate-style command after creation.
5. Read back what you created (`ft task list` scoped to the new collection, and check the
   Relationships tab data via `GetTask`/relationships query) to confirm the DAG structure
   actually persisted the way you intended — don't just assume the CLI calls worked.

## Deliverables
1. The new collection's ID and name on the live service.
2. A brief write-up at
   `/scion-volumes/scratchpad/projects/farmtable/reports/design-passthrough-task-breakdown.md`
   listing every task created (title, parent if any, blocked-by relationships, one-line
   summary of its scope) so there's a readable index alongside the live data.
3. A message to ptone@google.com directly (same as your prior discussion pattern)
   summarizing what you created and inviting them to look at the collection live in the
   dashboard, plus a brief message to the coordinator noting completion for tracking.

## Direct contact
- ptone@google.com: report the completed task breakdown directly, as you've been doing.
- Coordinator: brief tracking ping once done.

## Termination
Create the collection and full task DAG on the live server, produce the write-up, message
the user directly with a summary, and message the coordinator. You do not need to stay
further engaged after this unless the user has follow-up — use your judgment same as
before, but do not delete yourself (standing instruction).

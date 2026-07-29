# Brief: Decompose a Design Doc into a Live Task DAG (First-Read Exercise)

## Critical constraints (read first)
- This is data creation on the LIVE Cloud Run service (https://farmtable-qo7k5fvpda-uc.a.run.app),
  not local. Create a NEW collection for this — do not modify or delete the `default`
  collection or ANY other existing collection you happen to see when listing collections on
  this server. If you notice other collections already present (there may be several from
  prior unrelated work) — just ignore them, don't inspect or use them as reference for this
  task. Your job is to work from the design doc alone.
- Get the API token the same way other work on this server does:
  `TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)`,
  `export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443`, then use `ft` CLI
  commands with `--token "$TOKEN"`.
- Do not write application code for this task — you're populating task data on the live
  service, not implementing the design itself.
- If, while working, you happen to find any existing report/document that appears to
  already contain a task breakdown or decomposition of this same design — IGNORE IT
  COMPLETELY. Do not read it, do not let it influence your breakdown. The point of this
  exercise is to see how a first-time reader independently decomposes the design with no
  prior reference. If you're unsure whether something is such a document, err on the side
  of not reading it and proceed from the design doc alone.

## Task
Read `/scion-volumes/scratchpad/projects/farmtable/design-external-store-passthrough.md`
in full — this is a design document for adding external task-store (e.g. GitHub issues)
support to Farmtable via a server-side passthrough mechanism, ephemeral SQLite caching, and
graph queries. It's a real, already-reviewed design; your job is not to critique or extend
it, but to turn its implementation plan into a concrete, assignable task breakdown.

Decompose the design's implementation work into individual tasks, with enough detail that
each task could be picked up and executed by a developer agent who has ONLY: (a) the design
doc's high-level overview, and (b) that one task's own description — no other task's
detail. Each task should be genuinely self-contained: state any shared interface/contract
explicitly in each task that touches it, don't assume the reader has seen a sibling task.

Structure this as a real dependency graph, not just a flat list or loose phase grouping:
- Use `parent_task_id` to group related tasks under a parent (e.g. by phase or component).
- Use `Task.relationships` with `BLOCKS`/`BLOCKED_BY` types to encode actual execution-order
  dependencies between tasks (a task with no unmet BLOCKED_BY dependencies is "ready" to
  start — that's what makes this a usable DAG for parallel assignment, not just an outline).
- Be precise about dependencies — don't default to "everything in phase 2 blocks on
  everything in phase 1" if the real dependency is narrower.
- Use whatever priority/label/type fields the `ft` CLI supports to make the board useful.

Create this as a new collection on the live Farmtable server via the `ft` CLI (check `ft
collection create --help`, `ft task create --help` for exact flags — check `internal/cli/`
in `/workspace/farmtable` if you need more detail on flag names). If relationships can't be
set at creation time, set them via a follow-up update/relate command after creation.

Read back what you created (`ft task list` scoped to your new collection, and check
relationship data) to confirm the DAG structure actually persisted as intended.

## Deliverables
1. The new collection's ID and name on the live service.
2. A write-up at
   `/scion-volumes/scratchpad/projects/farmtable/reports/design-passthrough-task-breakdown-trial2.md`
   listing every task you created: title, parent (if any), blocked-by relationships, and a
   one-line summary of its scope — a complete, readable index of the full task list, not
   just a phase-level summary.
3. A message to the coordinator with: the collection ID/name, task count, and a short note
   on how you approached the decomposition (what grouping/phasing logic you used, any parts
   of the design that were ambiguous or hard to decompose cleanly).

## Direct contact
- Coordinator: `scion message coordinator "<message>"` when done, or if blocked.
- Do not message ptone@google.com directly.

## Termination
Create the collection and full task DAG on the live server, produce the complete write-up
at the path above, and message the coordinator with the summary. Then mark the task
complete.

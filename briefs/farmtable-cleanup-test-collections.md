# Brief: Delete Test Collections (name contains "test")

## Critical Constraints (read first)
- This mutates real state on the LIVE Cloud Run service — be careful and precise.
- **Only delete collections whose NAME contains "test" (case-insensitive)** — do not
  delete based on ID, description, or any other field. When in doubt about whether a match
  is a genuine throwaway test collection vs. something load-bearing, list it and ask the
  coordinator rather than deleting silently.
- **List everything first, log it, THEN delete** — don't delete inline as you enumerate.
  Produce a clear before-list so there's an audit trail.
- Note: `farmtable-em-passthrough-write` is actively working on Phase 2 in its own
  worktree right now and may have live test collections in use (e.g. anything tied to the
  `scion-frontiers/scion-roadmap` test repo, or a collection literally named with "test"
  for its Phase 1 verification). If you find a collection that looks like it's from that
  active work, message `farmtable-em-passthrough-write` directly first
  (`scion message farmtable-em-passthrough-write "<question>"`) to confirm it's safe to
  delete before doing so, rather than guessing.

## Context
ptone@google.com asked: "can we have a quick default agent delete the pure test
collections. (test in their name)" — this is straightforward data cleanup on the live
Farmtable Cloud Run service.

## Task
1. Get the Farmtable API token and connect to the live service (same pattern as other
   ops tasks — check `/scion-volumes/scratchpad/projects/farmtable/reports/` for prior
   examples, e.g. `gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test`,
   `FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443`).
2. List all collections (`ft collection list` or equivalent RPC).
3. Filter to those whose name contains "test" (case-insensitive substring match).
4. Log the full list of matches (name + ID) before doing anything.
5. Check if any match looks tied to the active passthrough-write-Phase-2 work per the
   constraint above — if so, confirm with that EM first.
6. Delete each confirmed match (`ft collection delete <id>` or equivalent).
7. Verify deletion (`ft collection list` again, confirm they're gone).

## Deliverables
1. A short report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/test-collection-cleanup.md`
   listing exactly what was found and what was deleted (name + ID for each).
2. A message to the coordinator with the same summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with results or if you're unsure
  about any match.
- Do not message ptone@google.com directly.

## Termination
You MUST list, log, delete the matching collections, verify, and message the coordinator
with the full before/after summary. Then signal task_completed.

# Brief: Deploy latest `main` to Cloud Run (deploy-45) — Performance Phase 1

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-45 -b deploy-45-snapshot origin/main`
  (standing policy).
- **IMPORTANT — this deploy closes a real gap**: both the dev and an independent
  reviewer explicitly flagged that Phase 1's "~21s→~128ms" performance claim was based on
  a SYNTHETIC benchmark, not a live end-to-end measurement, because neither had a browser/
  large collection available. YOU must get the real live measurement — find an existing
  large (~10k-task) collection on the live instance (check recent decomposer
  model-comparison test collections — gemma/flash/haiku-decomposer runs referenced in
  `/scion-volumes/scratchpad/projects/farmtable/reports/large-collection-perf-investigation.md`)
  before creating a new one from scratch. This is not optional — it's the primary
  verification goal of this deploy, not a secondary nice-to-have.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-44, revision `farmtable-00051-l7d` (commit `e521853`). Since then,
PR #149 merged to `main` (squash commit `7b94440b5878b03c6ee8301f0d9f1dc4336788ce`) —
Performance Phase 1: `getChildren()` O(n²)→O(1) via a maintained Map cache, plus a default
depth limit (maxDepth=3) for collections >500 tasks with a "N deeper levels hidden"
indicator and Level-dropdown override. Code correctness was independently reviewed and
confirmed sound (cache invalidation traced through every mutation path). The only
remaining open item is a live measurement.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `e521853`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-44.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **THE CORE TASK — live performance measurement**:
   a. Find or identify a large (~10k task, or as close as available) collection.
   b. Load it in Tree View, measure actual wall-clock time from navigation/data-load to
      interactive (page responsive, not frozen) — both BEFORE this deploy's effect would
      apply is not possible to measure now (can't un-deploy), so instead: measure the
      CURRENT (post-fix) load time directly, and compare against the investigation
      report's baseline figure (~17-25s pre-fix) to compute the real-world improvement.
   c. Confirm the default depth-limit kicks in for this large collection (fewer nodes
      rendered initially, with the "N deeper levels hidden" indicator visible).
   d. Confirm the Level dropdown override still works (user can expand to see more depth).
   e. Confirm small/medium collections are visually unaffected (spot check one).
5. Basic regression check: confirm Solo mode, Dependency View, and other recently-shipped
   features (Features 62-65) still work normally.
6. Report every check's pass/fail explicitly, with the ACTUAL measured load time for the
   large collection (not an estimate).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. The real measured load time for a large collection, compared against the
   investigation's baseline. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-45/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-45.md`.
4. A message to the coordinator with revision ID, commit SHA, and the real measured
   performance figure plus pass/fail on the other checks.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, obtain a REAL measured load time for a large collection (not an
estimate), verify the other checks, produce the log, and message the coordinator with the
actual numbers. Then signal task_completed.

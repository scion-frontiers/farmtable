# Brief: Developer — Task State Phase 1 Predeploy Data Migration

## Context
Phase 1 core was merged in PR #177 at `e522e04c3021cd90714b707f7a87c4c3f692c0f2`, but live deployment is held.

The coordinator requested evidence that existing live data is actually migrated. Manager verification against a 4,044-task copy of `/workspace/.farmtable/farmtable.db` found:

- old stages still present before startup: `ready=15`, `backlog=4`, `blocked=5`;
- starting the Phase 1 backend added `hold_reason` and `rank` columns;
- old stage rows remained unchanged after startup;
- zero `task_state_migration` change records were created.

This violates the live-deploy requirement: import/export migration exists, but existing persisted DB rows are not migrated.

## Workspace
Work only in `/workspace/farmtable-task-state-predeploy` on branch `task-state-predeploy-migration`.

Do not use `/workspace/farmtable` for edits.

## Authoritative Contract
Follow `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`, especially Section 7 migration rules.

## Required Implementation
- Add an idempotent persisted data migration that runs during store startup/schema migration for existing task rows.
- Migrate existing persisted stages:
  - `backlog` -> `accepted`
  - `ready` -> `accepted`
  - `waiting_for_input` -> `accepted`, `hold_reason=waiting_for_input`
  - `deferred` -> `accepted`, `hold_reason=deferred`, except future `start_date` clears deferred hold
  - `scheduled` -> `accepted`, preserve `start_date`; if no `start_date`, set `hold_reason=deferred`
  - `blocked` with unsatisfied blocker evidence -> `accepted` with no hold
  - `blocked` without unsatisfied blocker evidence -> `accepted`, `hold_reason=waiting_for_input`
- Recompute native `phase` from migrated stage for native rows.
- Write persistent lossy migration notes as `changes.field_name='task_state_migration'` authored by the migration/system actor, with compact JSON old/new payloads matching the import migration shape.
- Preserve source fidelity fields such as `native_label`/remote data.
- Make the migration idempotent: a second startup must not duplicate notes or mutate already-migrated rows.
- Update low-severity doc/API-comment drift from R3 if cheap: dependency satisfaction is completed-only, not broad closed-phase.

## Required Realistic Evidence
Use a copied DB, never mutate the original:

```bash
cp /workspace/.farmtable/farmtable.db /tmp/farmtable-predeploy-migration.db
```

Run the new startup/migration path against that copy and record:

- pre-migration task count and old-stage counts;
- post-migration stage/hold counts;
- count and sample payloads of `task_state_migration` change records;
- second-run idempotency evidence;
- any ambiguous rows and how they were classified.

The copied DB currently has 4,044 tasks and at least 24 old-stage rows. If this changes, record the actual counts.

## Required Tests
- Unit/integration coverage for persisted DB migration separate from import/export tests.
- Matrix tests for ready, backlog, blocked with/without blockers, scheduled with/without start date, waiting_for_input, deferred with future start date.
- Idempotency test proving repeated startup/migration does not duplicate migration notes.
- Regression test that no old native stage rows remain after migration.

## Required Verification
- `PATH="/home/scion/go/bin:$PATH" go generate ./internal/store/ent` if generated code changes.
- `PATH="/home/scion/go/bin:$PATH" go test ./...`
- `PATH="/home/scion/go/bin:$PATH" go build ./...`
- `npm run build` in `web/` if web/generated files change.
- `govulncheck ./...` if available or installed.
- `git diff --check origin/main...HEAD`
- strict removed native stage constant search.

## Deliverables
1. Commit all code/test/docs changes on `task-state-predeploy-migration`.
2. Write project log `.design/project-log/task-state-model-phase1-predeploy-migration.md` with realistic DB evidence and verification results.
3. Send the manager the final commit hash, migration evidence summary, and any residual risk.

## Termination
You MUST commit the implementation and project log, send the manager the summary/evidence, and then mark the task complete.

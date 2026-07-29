# Task State Model Phase 1 Predeploy Test Review R2

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: `APPROVE`

## Summary

R2 addresses the R1 stale migration replay finding from a test perspective. The branch now has focused regression tests for stale snapshot replay, conditional note creation, and duplicate-note prevention, while the original old-stage migration matrix continues to pass.

## Coverage Findings

- `migratePersistedTaskState` takes the Postgres advisory lock before listing old persisted stage rows and delegates to the transactional migration body after the query: `internal/store/entstore.go:113`.
- The row update is conditional on task ID, the stale old stage, and membership in the old persisted stage set; rows with `n == 0` skip note creation: `internal/store/entstore.go:156`.
- Migration notes are checked and inserted only after a successful affected-row update: `internal/store/entstore.go:171`.
- `acquireTaskStateMigrationLock` uses `pg_advisory_lock` only for Postgres and no-ops for SQLite: `internal/store/entstore.go:223`.
- `TestStartupMigration_StaleReplayDoesNotOverwritePostMigrationClaim` proves replaying a stale pre-migration snapshot cannot move a claimed task out of `in_progress/working`: `internal/store/entstore_migration_test.go:16`.
- `TestStartupMigration_ConditionalWriteNotesOnlyActuallyUpdatedRows` proves notes are created only for rows actually changed by the conditional update: `internal/store/entstore_migration_test.go:58`.
- `TestStartupMigration_DoesNotDuplicateExistingMigrationNote` proves second startup or pre-existing note cases do not duplicate `task_state_migration` notes: `internal/store/entstore_migration_test.go:116`.
- `TestStartupMigration_PersistedOldTaskStates` still covers the old-stage conversion matrix and second-start idempotency: `internal/store/entstore_test.go:80`.
- The web fallback availability predicate prefers server availability, excludes holds and future starts, and treats only `completed` blockers as satisfied: `web/src/utils/task-ready.ts:8`.

## Cloud SQL Proof Assessment

The recorded Cloud SQL Postgres proof is credible for the deploy gate:

- It used a real Cloud SQL Postgres instance and a scratch schema.
- Schema creation ran through `store.NewEntStore(... Dialect:"postgres", Migrate:true)`.
- The verifier seeded 4,045 rows, including a dogfood-scale task set plus blocker fixture.
- Pre-migration old native rows were `backlog=4`, `blocked=5`, and `ready=15`.
- First startup reduced old native rows to `0` and created exactly `24` migration notes.
- Second startup kept old native rows at `0`, migration notes at `24`, and state counts unchanged.
- The proof does not show simultaneous lock contention, but the R2 row-conditional tests cover correctness if a stale snapshot is replayed.

## Accepted Gaps

- No live Postgres integration test was run by this agent; this pass relies on the manager's Cloud SQL evidence.
- No automated advisory-lock contention test exists yet.
- Audit-note payload checks should eventually parse JSON instead of relying partly on string containment.
- Frontend availability fallback behavior is not covered by a dedicated frontend unit test suite.

## Verification

- `PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration -count=1` - pass.
- `git diff --check origin/main...HEAD` - pass.
- `PATH="/home/scion/go/bin:$PATH" go test ./...` - pass.
- `PATH="/home/scion/go/bin:$PATH" go build ./...` - pass.
- `npm run build` in `web/` - pass; Vite reported the existing large chunk warning.
- Removed native old-stage constant scan with `rg` - pass; no matches outside migration compatibility/tests.

## Recommendation

Approve deployment. The R2 tests cover the stale-replay failure mode that blocked R1, and the recorded Cloud SQL run is adequate production-dialect evidence for this predeploy migration.

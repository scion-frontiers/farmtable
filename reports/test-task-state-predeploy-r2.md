# Test Review R2: Task State Predeploy Migration

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: `APPROVE`

## Test Coverage Analysis

### Current Coverage

- R2 adds deterministic regression coverage for the R1 stale-replay bug in `internal/store/entstore_migration_test.go`.
- `TestStartupMigration_StaleReplayDoesNotOverwritePostMigrationClaim` captures an old-stage snapshot, runs migration once, claims the task, then replays the stale snapshot. It verifies the task remains `in_progress/working` and only one `task_state_migration` note exists.
- `TestStartupMigration_ConditionalWriteNotesOnlyActuallyUpdatedRows` verifies a stale snapshot migrates and notes only rows still carrying the exact old persisted stage at write time.
- `TestStartupMigration_DoesNotDuplicateExistingMigrationNote` verifies an old-stage row with a pre-existing migration note is normalized without a duplicate note.
- Existing old-stage matrix coverage still exercises `ready`, `backlog`, `waiting_for_input`, `deferred` with future start, `scheduled` with date, `scheduled` without date, `blocked` with blocker evidence, and `blocked` without blocker evidence in `TestStartupMigration_PersistedOldTaskStates`.
- Second-start idempotency remains covered by reopening the migrated SQLite DB and asserting migration-note count is unchanged.
- Web compatibility remains covered by typecheck/build and shared fallback predicate review; there is still no frontend unit test script for `isReady()`.

### Findings

No blocking findings.

The R2 tests prove the specific stale migration replay class reported in R1. The implementation makes the write conditional on `id`, the stale old `stage`, and membership in the old persisted stage set before recording a note. That means a task changed after the first migration is skipped by a replaying migration snapshot, and skipped rows do not receive audit notes.

The Postgres advisory lock itself is not covered by an automated integration test in this review environment, but the code path is straightforward and production-specific: `acquireTaskStateMigrationLock` uses `pg_advisory_lock` for `dialect.Postgres`, while SQLite returns a no-op unlock. The manager's Cloud SQL proof is credible for the deploy gate because it created schema through `store.NewEntStore(... Dialect:"postgres", Migrate:true)`, seeded a dogfood-scale dataset, rewrote old persisted stages, then ran the real startup migration path twice against Cloud SQL Postgres.

### Accepted Gaps

- No live Postgres integration test was run by this agent; I relied on the manager's recorded Cloud SQL proof in `.design/project-log/task-state-model-phase1-predeploy-migration.md`.
- The Cloud SQL proof validates sequential first/second startup idempotency at dogfood scale, not a live two-process lock-contention test. The row-conditional regression tests cover stale replay safety even if another process had an old snapshot.
- Migration note assertions partly use string containment rather than parsed JSON equality. This is sufficient for the deploy gate but weaker than a schema-level assertion of the audit payload.
- The web package has no dedicated frontend test runner for `web/src/utils/task-ready.ts`; `npm run build` verifies type safety and bundling only.

### Recommended Follow-Up Tests

1. **Postgres advisory lock contention integration test** - run two `migratePersistedTaskState` calls against the same Postgres database and assert the second waits or observes no old rows after the first completes.
2. **Parsed migration note payload test** - unmarshal `old_value` and `new_value` and assert exact fields for all matrix cases.
3. **Frontend `isReady()` unit tests** - cover server availability preference, held tasks, future-start tasks, and completed-only dependency satisfaction.

### Priority

- Critical: none.
- High: add Postgres advisory-lock contention coverage when a reliable Postgres integration fixture is available.
- Medium: add parsed audit-note assertions and frontend `isReady()` tests.
- Low: seed explicit non-migrated `triage` and terminal rows in the startup migration matrix.

## Verification Commands

```bash
PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration -count=1
```

Expected: all startup migration tests pass.

Actual: passed.

```bash
git diff --check origin/main...HEAD
```

Expected: no whitespace errors.

Actual: passed.

```bash
PATH="/home/scion/go/bin:$PATH" go test ./...
```

Expected: full untagged Go suite passes.

Actual: passed.

```bash
PATH="/home/scion/go/bin:$PATH" go build ./...
```

Expected: all Go packages build.

Actual: passed.

```bash
cd web && npm run build
```

Expected: TypeScript check and Vite production build pass.

Actual: passed. Vite emitted the existing large chunk warning for the main JS bundle.

```bash
rg -n "TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|stage_(backlog|ready|blocked|waiting_for_input|deferred|scheduled)" . -g '!web/node_modules/**' -g '!web/dist/**' -g '!internal/store/entstore_test.go' -g '!internal/store/entstore_migration_test.go' -g '!internal/store/entstore.go'
```

Expected: no stale generated/native old-stage constant references outside compatibility and tests.

Actual: no matches.

## Root Cause Closure

The R1 root cause was that startup migration could apply stale decisions after a concurrent startup had already migrated a row and a user/agent had changed it. R2 closes that path in two layers:

- Production Postgres startup serializes the migration body with an advisory lock before listing old rows.
- The per-row update is conditional at write time, so stale snapshots cannot overwrite a task that no longer has the old persisted stage, and migration notes are only inserted after an affected row.

This is sufficient for predeploy approval.

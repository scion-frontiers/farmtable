## Security Audit Report

Verdict: APPROVE

### Summary
- Critical: 0
- High: 0
- Medium: 0
- Low: 0

### Findings

No Critical, High, Medium, or Low security findings were identified in the R2 changes. The R1 High issue is fixed.

### R1 High Closure

The R2 implementation closes the concurrent startup stale-replay issue:

- **Postgres advisory lock:** `migratePersistedTaskState` acquires a Postgres session advisory lock before listing old-stage tasks and releases it with a deferred unlock/connection close. A second startup instance blocks before it can take its stale snapshot, then re-runs the query after the first migration has removed the old stages.
- **Blocking behavior:** `pg_advisory_lock($1)` is the blocking form, which is appropriate for deployment serialization. A startup that cannot obtain the lock due to context cancellation fails closed with `migrating persisted task state`.
- **Unlock/lifecycle:** the dedicated `*sql.Conn` stays open for the full migration body, so the session lock remains held even though Ent writes use the normal pool. The deferred unlock uses `context.Background()` and then closes the connection, so cancellation of the startup context does not leave cleanup dependent on the canceled context.
- **Row-conditional writes:** each task update is constrained by `id`, the exact stale old `stage`, and the removed old-stage set. If the row was claimed or otherwise changed after the stale snapshot, the update affects zero rows and no note is created.
- **Migration note safety:** migration notes are inserted only after `n > 0`, and an existing `task_state_migration` note is checked after the successful row update to avoid duplicates. There is no public create-change RPC; normal task edits use fixed diff field names, and import requires collection admin scope while format v2 rejects removed native stages.
- **Postgres proof:** the recorded Cloud SQL scratch-schema proof in `.design/project-log/task-state-model-phase1-predeploy-migration.md` ran the real Postgres startup path twice against dogfood-scale seeded data. It showed 24 old-stage rows migrated, 24 migration notes, no old-stage rows remaining, and no duplicate notes on the second run.

Key reviewed locations:

- `/workspace/internal/store/entstore.go:113` - advisory lock wraps listing and migration.
- `/workspace/internal/store/entstore.go:156` - affected-row update predicates.
- `/workspace/internal/store/entstore.go:171` - note creation is skipped when no row was updated.
- `/workspace/internal/store/entstore.go:179` - duplicate migration note gate.
- `/workspace/internal/store/entstore.go:223` - Postgres lock acquisition, unlock, and connection close.
- `/workspace/internal/store/entstore_migration_test.go:16` - stale replay does not overwrite a post-migration claim.
- `/workspace/internal/store/entstore_migration_test.go:58` - only actually updated rows receive notes.
- `/workspace/internal/store/entstore_migration_test.go:116` - existing notes are not duplicated.

### Positive Observations

- The R2 tests directly cover the exploitable stale-snapshot scenario from R1, not just second-run idempotency.
- The row predicate is defensive even if the helper is invoked without the outer advisory lock.
- The migration note and row update remain in the same Ent transaction.
- Existing Cloud SQL proof covers the deploy-blocking Postgres requirement that SQLite-only testing could not satisfy.
- Dependency hygiene checks were clean for called Go code and production web dependencies.

### Verification

- `PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration -count=1` - pass
- `PATH="/home/scion/go/bin:$PATH" go test ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" go build ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" go run golang.org/x/vuln/cmd/govulncheck@latest ./...` - pass; no called or imported-package vulnerabilities; 15 required-module vulnerabilities reported as not called
- `npm audit --omit=dev` in `web/` - pass; 0 vulnerabilities
- `npm run build` in `web/` - pass; Vite emitted the existing chunk-size warning
- `git diff --check origin/main...HEAD` - pass

### Recommendations

- Keep the Cloud SQL scratch-schema proof attached to the deployment record because advisory locks cannot be validated meaningfully by SQLite tests.
- Consider adding a Postgres integration test for advisory lock blocking if the project gets a stable CI Postgres fixture, but this is not a merge blocker for the current R2 fix.

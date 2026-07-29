# Task State Model Phase 1 Predeploy Security Audit R2

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: APPROVE

## Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- R1 High status: fixed

## Findings

No Critical, High, Medium, or Low security findings were identified in R2.

## R1 High Closure Notes

- `migratePersistedTaskState` now takes a Postgres session advisory lock before reading old persisted task-state rows, so concurrent production startup instances serialize before snapshotting migration candidates.
- The lock is held on a dedicated `*sql.Conn` for the full migration body and released in a deferred cleanup path that also closes the connection.
- Each per-task update requires the task ID, the exact old stale stage, and membership in the removed persisted-stage set. A changed row is skipped rather than overwritten.
- Migration notes are written only after an affected-row count greater than zero.
- Existing `task_state_migration` notes are checked after a successful row update, preventing duplicate notes while still allowing old rows to be normalized.
- There is no public create-change RPC; the import path requires collection admin scope and format v2 rejects removed native stages, so the startup migration note gate is not exposed as a practical external spoofing path.
- The Cloud SQL scratch-schema proof recorded in `task-state-model-phase1-predeploy-migration.md` satisfies the deploy-blocking Postgres requirement: the real Postgres startup migration ran twice, migrated 24 old-stage rows, left 0 old-stage rows, and kept migration notes at 24 after the second run.

Reviewed anchors:

- `internal/store/entstore.go:113` - migration lock scope.
- `internal/store/entstore.go:156` - conditional update.
- `internal/store/entstore.go:171` - skip note on zero-row update.
- `internal/store/entstore.go:179` - duplicate-note gate.
- `internal/store/entstore.go:223` - advisory lock lifecycle.
- `internal/store/entstore_migration_test.go:16` - stale replay regression.
- `internal/store/entstore_migration_test.go:58` - conditional note regression.
- `internal/store/entstore_migration_test.go:116` - existing note de-duplication regression.

## Verification

- `PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration -count=1` - pass
- `PATH="/home/scion/go/bin:$PATH" go test ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" go build ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" go run golang.org/x/vuln/cmd/govulncheck@latest ./...` - pass; 0 called vulnerabilities, 0 imported-package vulnerabilities, 15 required-module vulnerabilities not called
- `npm audit --omit=dev` in `web/` - pass; 0 vulnerabilities
- `npm run build` in `web/` - pass; existing Vite chunk-size warning only
- `git diff --check origin/main...HEAD` - pass

## Positive Observations

- R2 tests reproduce the stale replay condition from the R1 finding and prove that a post-migration claim remains `in_progress/working`.
- The affected-row predicate provides defense in depth for helper-level stale snapshots, independent of the advisory lock.
- Migration note creation is transactional with the task update.
- The manager's Cloud SQL proof exercises the real production dialect and closes the previous deploy gate.

## Recommendation

Keep the Cloud SQL scratch-schema evidence with the deployment record. A future Postgres integration test for advisory lock blocking would be useful once a stable CI Postgres fixture exists, but no security change is required for this R2 branch.

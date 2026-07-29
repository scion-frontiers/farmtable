## Review Summary

**Verdict:** APPROVE

**Overview:** R2 directly addresses the R1 security finding by serializing the Postgres startup migration before stale rows are listed, then making each task migration conditional on the row still having the same old persisted stage. Risk is LOW after review: I found no blocking correctness, security, or performance issues in the R2 delta, and the regression tests cover the prior stale replay failure mode.

### Critical Issues
- None.

### Important Issues
- None.

### Suggestions
- None.

### What's Done Well
- [internal/store/entstore.go:113] The advisory lock is acquired before querying old-stage rows, so concurrent Postgres startup instances cannot both make migration decisions from stale snapshots.
- [internal/store/entstore.go:156] The task update now includes `id`, exact stale `stage`, and the old-stage set predicate, which prevents a delayed migration pass from overwriting a task that was claimed or otherwise moved after another instance migrated it.
- [internal/store/entstore.go:179] Migration-note creation is gated behind a successful row update and an existing-note check, preventing duplicate audit notes while still normalizing an old row if a note already exists.
- [internal/store/entstore_migration_test.go:16] The new tests reproduce stale replay after a claim, conditional row skipping, and existing-note deduplication, which are the critical behaviors requested in the R2 brief.

### Verification Story
- Tests reviewed: yes. `TestStartupMigration_StaleReplayDoesNotOverwritePostMigrationClaim`, `TestStartupMigration_ConditionalWriteNotesOnlyActuallyUpdatedRows`, and `TestStartupMigration_DoesNotDuplicateExistingMigrationNote` exercise the former overwrite/duplicate-note bug and the new row-conditional behavior.
- Build verified: yes. `go build ./...` passed.
- Lint/static analysis clean: partial. `git diff --check origin/main...HEAD` passed; no separate Go lint command is documented in `CLAUDE.md`.
- Security checked: yes. The R2 Postgres advisory lock is session-scoped and the held connection is closed after explicit unlock; SQLite remains on the prior no-op lock path. `go run golang.org/x/vuln/cmd/govulncheck@latest ./...` reported 0 called vulnerabilities and 0 imported-package vulnerabilities. `npm audit --omit=dev` reported 0 vulnerabilities.

### Verification Commands
- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db; go test ./internal/store -run TestStartupMigration -count=1` - pass
- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db; go test ./...` - pass
- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db; go build ./...` - pass
- `npm run build` in `web/` - pass; Vite emitted the existing large chunk warning
- `npm audit --omit=dev` in `web/` - pass; 0 vulnerabilities
- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH; go run golang.org/x/vuln/cmd/govulncheck@latest ./...` - pass; 0 called vulnerabilities, 0 imported-package vulnerabilities
- `git diff --check origin/main...HEAD` - pass

## Executive Summary

LOW risk. The R2 delta fixes the stale replay/concurrent startup issue with both a Postgres migration-wide advisory lock and row-level conditional writes, and I found no remaining blocker in the requested review scope.

## Critical Issues

None.

## Observations

None requiring changes before merge.

## Positive Feedback

The fix uses layered protection rather than relying on one mechanism: Postgres startup instances are serialized, stale row writes are skipped, and audit notes are created only after a real migration update. The Cloud SQL scratch-schema evidence in `.design/project-log/task-state-model-phase1-predeploy-migration.md` is credible for the production dialect because it exercised `store.NewEntStore(... Dialect:"postgres", Migrate:true)` twice against a real Postgres schema and showed unchanged row/note counts on the second run.

## Final Verdict

APPROVE

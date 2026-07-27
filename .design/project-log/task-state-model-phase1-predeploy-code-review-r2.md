# Task State Model Phase 1 Predeploy Code Review R2

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: APPROVE

## Executive Summary

LOW risk. R2 fixes the prior concurrent startup/stale replay migration issue, and I found no Critical or Important findings in the requested delta.

## Critical Issues

None.

## Important Issues

None.

## Suggestions

None.

## Review Notes

- `migratePersistedTaskState` now acquires the Postgres advisory lock before listing old persisted task states, so the migration body is serialized across rolling startup instances.
- SQLite behavior remains valid because the advisory-lock helper returns a no-op unlock function for non-Postgres dialects.
- Per-task updates now require the row to still match the stale snapshot's old stage and the old-stage set, preventing stale migration replays from overwriting post-migration claims or other live state changes.
- Migration notes are created only after an affected-row update and are skipped when a `task_state_migration` note already exists.
- The new regression tests cover stale replay after claim, mixed stale/current rows, and pre-existing migration-note deduplication.
- The Cloud SQL scratch-schema proof recorded in `.design/project-log/task-state-model-phase1-predeploy-migration.md` is sufficient for this gate: it used a real Postgres schema through the startup migration path, showed all old persisted stages removed, produced 24 migration notes, and confirmed the second startup was idempotent.

## Verification

- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db; go test ./internal/store -run TestStartupMigration -count=1` - pass
- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db; go test ./...` - pass
- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db; go build ./...` - pass
- `npm run build` in `web/` - pass; Vite emitted the existing large chunk warning
- `npm audit --omit=dev` in `web/` - pass; 0 vulnerabilities
- `export PATH=/workspace/.farmtable/bin:/home/scion/go/bin:$PATH; go run golang.org/x/vuln/cmd/govulncheck@latest ./...` - pass; 0 called vulnerabilities, 0 imported-package vulnerabilities
- `git diff --check origin/main...HEAD` - pass

## Final Verdict

APPROVE

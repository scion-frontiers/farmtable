# Task State Model Phase 1 Predeploy Test Review

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: `APPROVE`

## Summary

I reviewed the predeploy migration and UI compatibility evidence against `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md` and the developer/manager log in `.design/project-log/task-state-model-phase1-predeploy-migration.md`.

The branch is deploy-ready from a test perspective. The startup migration has focused coverage for all removed persisted stages and the requested blocker/date/idempotency paths, and the manager's 4,044-task dogfood DB run is credible evidence for the live-risk path.

## Coverage Findings

- Startup migration runs inside `store.NewEntStore` after schema creation, which is the production startup path when `Migrate` is enabled: [internal/store/entstore.go](/workspace/internal/store/entstore.go:71).
- `TestStartupMigration_PersistedOldTaskStates` seeds persisted old-stage rows, reopens through `NewEntStore`, and verifies conversion to `open/accepted`, expected hold reason, preserved start date, one migration note per row, zero old-stage rows, and second-start idempotency: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:80).
- The synthetic matrix covers `ready`, `backlog`, `waiting_for_input`, `deferred` with future start date, `scheduled` with start date, `scheduled` without start date, `blocked` with blocker evidence, and `blocked` without blocker evidence: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:129).
- Existing Phase 1 availability tests cover triage, held, future-start, and dependency-blocked tasks, and verify unavailable tasks cannot be claimed: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:541).
- Existing dependency tests cover terminal edge behavior: only `completed` satisfies dependencies; `wont_fix`, `cancelled`, and `duplicate` keep dependents unavailable: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:589).
- The UI shared availability fallback now prefers server availability, excludes held and future-start tasks, and uses `TaskStage.COMPLETED` rather than broad closed phase for dependency satisfaction: [web/src/utils/task-ready.ts](/workspace/web/src/utils/task-ready.ts:8).
- Visible queue labels now say `Available` / `Available Queue`, and command palette stage labels are based on the current `TaskStage` enum: [web/src/components/ft-dashboard-view.ts](/workspace/web/src/components/ft-dashboard-view.ts:230), [web/src/components/ft-toolbar.ts](/workspace/web/src/components/ft-toolbar.ts:357), [web/src/components/ready-queue/ft-ready-queue-view.ts](/workspace/web/src/components/ready-queue/ft-ready-queue-view.ts:263), [web/src/components/ft-command-palette.ts](/workspace/web/src/components/ft-command-palette.ts:44).

## Gaps Accepted For Predeploy

- The migration note test checks old stage and new reason via string containment, not full parsed JSON equality. This leaves some audit payload drift possible, but manager evidence includes representative old/new payloads and the implementation writes the requested fields.
- The migration test does not explicitly seed representative non-migrated `triage` and terminal rows to assert they stay untouched. The migration query is limited to old-stage values and existing availability tests cover their contract behavior.
- The web package has no test script beyond typecheck/build, so UI predicate behavior is not guarded by automated frontend unit tests. The build passed, and the manager web smoke against the migrated dogfood DB reached the available queue.
- The 4,044-task dogfood DB evidence included `backlog`, `blocked`, and `ready`, but not `waiting_for_input`, `deferred`, or `scheduled`; those are covered synthetically.

## Verification

```bash
PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration_PersistedOldTaskStates -count=1
```

Result: passed.

```bash
PATH="/home/scion/go/bin:$PATH" go test ./...
```

Result: passed.

```bash
PATH="/home/scion/go/bin:$PATH" go build ./...
```

Result: passed.

```bash
cd web && npm run build
```

Result: passed. Vite emitted the existing large chunk warning.

```bash
rg -n "TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|stage_(backlog|ready|blocked|waiting_for_input|deferred|scheduled)" . -g '!web/node_modules/**' -g '!web/dist/**' -g '!internal/store/entstore_test.go' -g '!internal/store/entstore.go'
```

Result: no matches.

## Dogfood Evidence Assessment

The manager's 4,044-task dogfood DB evidence is sufficient for the live deploy gate:

- Pre-migration: 4,044 tasks; old native stage rows `backlog=4`, `blocked=5`, `ready=15`; existing `task_state_migration` notes `0`.
- First startup via `cmd/farmtable-server` completed successfully.
- Post-migration: old native stage rows `0`; migration notes `24`, matching the transformed row count.
- Second startup: migration notes remained `24` and state counts were unchanged.
- Web smoke against the migrated DB reached `ft-ready-queue-view`; the only reported network error was `/api/auth/session` 404 in open-access mode.

## Recommendation

Approve deployment. Track follow-up tests for full JSON audit-note assertions, explicit non-migrated row preservation, and frontend `isReady()` unit coverage.

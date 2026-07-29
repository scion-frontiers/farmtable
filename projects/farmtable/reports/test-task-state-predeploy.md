# Task State Phase 1 Predeploy Test Review

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: `APPROVE`

## Coverage Findings

No blocking test coverage gaps found for predeploy readiness.

### Current Coverage

- Startup path is exercised through `store.NewEntStore(... Migrate: true)` rather than an isolated helper: [internal/store/entstore.go](/workspace/internal/store/entstore.go:71), [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:80).
- The removed persisted stages `ready`, `backlog`, `waiting_for_input`, `deferred`, `scheduled`, and `blocked` are seeded through direct persisted-row mutation and verified after reopen: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:129).
- Rows with blockers and without blockers are covered for old `blocked`, including the split between dependency-derived unavailability and `hold_reason=waiting_for_input`: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:136), [internal/store/entstore.go](/workspace/internal/store/entstore.go:219).
- Future `start_date`, missing `start_date`, and `deferred` plus future `start_date` cases are covered: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:132), [internal/store/entstore.go](/workspace/internal/store/entstore.go:201).
- One `task_state_migration` note per transformed row is verified, including zero UUID author, old stage, new reason, total note count, and second-start idempotency: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:185), [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:220).
- Old native stage rows are verified absent after migration: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:210).
- Existing Phase 1 store coverage verifies availability reasons for triage, held, future-start, and dependency-blocked tasks; claim rejects unavailable tasks: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:541).
- Existing dependency coverage verifies only `completed` satisfies blockers; `wont_fix`, `cancelled`, and `duplicate` remain blocking in v1: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:589), [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:643).
- UI fallback predicates now prefer server `task.availability`, exclude held and future-start tasks, and use `TaskStage.COMPLETED` for dependency satisfaction: [web/src/utils/task-ready.ts](/workspace/web/src/utils/task-ready.ts:8).
- Ready/available labels were updated in dashboard, toolbar, and ready queue visible text: [web/src/components/ft-dashboard-view.ts](/workspace/web/src/components/ft-dashboard-view.ts:230), [web/src/components/ft-toolbar.ts](/workspace/web/src/components/ft-toolbar.ts:357), [web/src/components/ready-queue/ft-ready-queue-view.ts](/workspace/web/src/components/ready-queue/ft-ready-queue-view.ts:263).
- Command palette stage labels use current `TaskStage` enum keys, removing old numeric labels for Backlog/Ready/Blocked/Waiting/Deferred/Scheduled: [web/src/components/ft-command-palette.ts](/workspace/web/src/components/ft-command-palette.ts:44).
- Strict removed native stage constant search found no old enum constants or generated stage references outside the migration/test compatibility paths.

### Residual Gaps

1. **Migration note payload exactness is lightly asserted.** The test checks one note per migrated row plus old stage and new reason substrings, but it does not parse and assert the complete JSON payload (`phase`, `native_label`, `start_date`, `has_blocker`, and `hold_reason` when present). The implementation and manager evidence show useful payloads, so this is not a deploy blocker, but a focused follow-up would make the audit trail contract tighter.
2. **Unchanged triage and terminal rows are implicit, not explicit, in the migration test.** The query only targets old persisted stages, and adjacent Phase 1 tests cover terminal/triage availability behavior. A small explicit non-migration assertion would improve regression proof for the "terminal/triage edge cases behave per contract" acceptance bullet.
3. **Frontend verification is build plus manual/smoke evidence only.** `web/package.json` has no unit test script, so `isReady()` and visible-label behavior are not guarded by automated frontend tests. The TypeScript build passed and manager Playwright smoke evidence is credible for predeploy.
4. **The 4,044-task dogfood DB did not contain every old-stage variant.** Manager evidence covered `backlog=4`, `blocked=5`, and `ready=15`; synthetic startup tests cover `waiting_for_input`, `deferred`, and `scheduled`.

## Commands Run

### Focused Startup Migration Test

Command:

```bash
PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration_PersistedOldTaskStates -count=1
```

Expected: package passes.

Actual:

```text
ok  	github.com/farmtable-io/farmtable/internal/store	0.097s
```

### Full Go Test Suite

Command:

```bash
PATH="/home/scion/go/bin:$PATH" go test ./...
```

Expected: all packages pass.

Actual: all tested packages passed, including `internal/store`, `internal/server`, `internal/mcp`, `internal/platform/beads`, and `internal/platform/github`.

### Full Go Build

Command:

```bash
PATH="/home/scion/go/bin:$PATH" go build ./...
```

Expected: build completes with exit code 0.

Actual: build completed with exit code 0.

### Web Build

Command:

```bash
cd web
npm run build
```

Expected: TypeScript and Vite production build pass.

Actual: build passed. Vite emitted the existing large chunk warning for the main JS bundle.

### Removed Native Stage Constant Search

Command:

```bash
rg -n "TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|stage_(backlog|ready|blocked|waiting_for_input|deferred|scheduled)" . -g '!web/node_modules/**' -g '!web/dist/**' -g '!internal/store/entstore_test.go' -g '!internal/store/entstore.go'
```

Expected: no matches outside intentional migration/test compatibility paths.

Actual: no matches.

## Dogfood DB Evidence Assessment

The manager evidence recorded in `.design/project-log/task-state-model-phase1-predeploy-migration.md` is credible and sufficient for deploy readiness:

- It used a 4,044-task copy of `/workspace/.farmtable/farmtable.db`.
- Pre-migration old rows were counted as `backlog=4`, `blocked=5`, `ready=15`.
- Startup through `cmd/farmtable-server` completed against the copied DB.
- Post-migration old native stages were `0`.
- Exactly 24 `task_state_migration` notes were recorded for 24 transformed rows.
- A second startup left note count and state counts unchanged.
- The web smoke reached `ft-ready-queue-view` against the migrated DB, with only `/api/auth/session` 404 observed in open-access mode.

The evidence does not prove real-world `scheduled`, `deferred`, or `waiting_for_input` rows because that DB copy had none. The synthetic startup test covers those branches.

## Root Cause Analysis

The deploy risk was persisted rows containing removed native stage strings after Phase 1 narrowed the durable workflow vocabulary. Without a startup migration, those rows could fail enum validation, present stale UI labels, or keep derived availability as asserted state. This branch addresses the root cause by running an idempotent startup migration after Ent schema creation, translating old rows to Phase 1 primitives, preserving scheduling data, deriving blocker cases from relationships, and writing audit notes.

## Recommended Follow-Ups

1. Add JSON-structured assertions for the full `task_state_migration` note payload.
2. Add an explicit unchanged-row assertion for representative `triage`, active, and terminal rows.
3. Add frontend unit tests for `isReady()` once the web package has a test runner.

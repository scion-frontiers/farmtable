## Test Review: task-state-core

Verdict: REQUEST CHANGES

Scope reviewed: `/workspace` branch `task-state-core` against `origin/main` (`a2442ffa98fefc6fbb408e774344960e991f58cb` merge-base). The brief's host path `/workspace/farmtable-task-state-core` is mounted as `/workspace` in this container.

## Commands Run

- `go test ./internal/store ./internal/server ./internal/platform/beads ./internal/platform/github`
  - Expected: focused backend/state tests pass.
  - Actual: PASS.
- `go test ./internal/cli ./internal/mcp`
  - Expected: CLI and MCP packages compile and tests pass.
  - Actual: PASS.
- `go test ./...`
  - Expected: full Go suite passes.
  - Actual: PASS.
- `git diff --check origin/main...HEAD`
  - Expected: no whitespace errors.
  - Actual: PASS, no output.
- `cd web && npm install && npm run build`
  - Expected: TypeScript and Vite build pass.
  - Actual: PASS. npm also reported 1 high severity audit finding; Vite reported the existing large chunk warning.

## Findings

### 1. New-format imports are not tested to reject removed native stages

The contract requires old export formats to be migrated, but new format imports must reject removed native stages. The current import parser accepts format versions 1 and 2 at [internal/server/export_import.go](/workspace/internal/server/export_import.go:300), and the stage parser still accepts `backlog`, `ready`, `blocked`, `waiting_for_input`, `deferred`, and `scheduled` without knowing the format version at [internal/server/export_import.go](/workspace/internal/server/export_import.go:852). The migration path then normalizes those values at [internal/server/export_import.go](/workspace/internal/server/export_import.go:651).

Existing coverage only proves old-format migration because `minimalImportDoc` always emits `"format_version": 1` at [internal/server/export_import_test.go](/workspace/internal/server/export_import_test.go:569), including the migration matrix test at [internal/server/export_import_test.go](/workspace/internal/server/export_import_test.go:297). There is no test that sets `format_version: 2` with `stage: "ready"` or `stage: "blocked"` and expects `INVALID_ARGUMENT`.

Recommended test: `TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages`, table-driven over every removed stage. Expected: `codes.InvalidArgument`; actual with current code path: import would be accepted and migrated.

### 2. Terminal dependency semantics are only partially covered

The store now treats only `completed` as satisfying blockers at [internal/store/entstore.go](/workspace/internal/store/entstore.go:833), and `ComputeAvailability` uses that policy at [internal/store/entstore.go](/workspace/internal/store/entstore.go:872). That matches the v1 subset for `completed`, `wont_fix`, and `cancelled`, but the contract also requires duplicate-with-canonical behavior to be testable. No persisted canonical duplicate primitive exists on `Task`, despite `CloseTaskRequest.duplicate_of_task_id` existing in proto at [proto/farmtable.proto](/workspace/proto/farmtable.proto:642), and `CloseTask` ignores it at the store boundary [internal/store/entstore.go](/workspace/internal/store/entstore.go:972).

Current tests cover only the happy resolved case where a blocker closes as `completed` at [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:372) and [internal/server/server_test.go](/workspace/internal/server/server_test.go:1240). There are no assertions that `wont_fix` and `cancelled` continue blocking, or that `duplicate` does not satisfy without a canonical replacement.

Recommended tests: add table coverage for blocked dependents after blocker closes as `completed`, `wont_fix`, `cancelled`, and `duplicate` without `duplicate_of_task_id`. Add a separate pending/implemented test for `duplicate` with canonical replacement once the persistence model exists.

### 3. Beads adapter round-trip mapping has an untested regression

`statusToPhaseStage("blocked")` and `"deferred"` both normalize to `StageAccepted` at [internal/platform/beads/beads.go](/workspace/internal/platform/beads/beads.go:301), but `phaseStageToStatus` has two identical `stage == task.StageAccepted` branches at [internal/platform/beads/beads.go](/workspace/internal/platform/beads/beads.go:319). The first branch always returns `"blocked"`, making the `"deferred"` branch unreachable and causing any accepted task exported through this helper to become `blocked`.

Existing Beads integration tests cover inbound status normalization at [internal/platform/beads/beads_integration_test.go](/workspace/internal/platform/beads/beads_integration_test.go:512), but they do not cover `phaseStageToStatus` round-trip/export behavior after the new state model.

Recommended test: cover `phaseStageToStatus` for accepted/open, accepted/on_hold with deferred fidelity, and working/closed statuses. This should currently fail for accepted open tasks because the helper returns `blocked`.

### 4. Migration notes are tested for presence and JSON validity, not content fidelity

The migration test counts seven `task_state_migration` changes and checks JSON validity at [internal/server/export_import_test.go](/workspace/internal/server/export_import_test.go:363), while implementation writes old phase/stage/native_label/start_date/has_blocker and new stage/reason/hold_reason at [internal/server/export_import.go](/workspace/internal/server/export_import.go:757). This misses the contract's data-loss guard: tests should assert the note includes the old `phase`, old `stage`, old `native_label`, scheduling/dependency snapshot, new `stage`, new `hold_reason`, and migration reason for each lossy case.

Recommended test: decode each migration note and assert exact old/new payloads for `ready`, `blocked` with blockers, `blocked` without blockers, `scheduled` with start date, `scheduled` without start date, `deferred` with future start date, and adapter-origin `blocked`.

## Coverage Summary

Covered:
- Native store schema removes deleted stages and adds `hold_reason`/`rank`: [internal/store/schema/task.go](/workspace/internal/store/schema/task.go:24), generated Ent migration schema at [internal/store/ent/migrate/schema.go](/workspace/internal/store/ent/migrate/schema.go:208).
- API/store hold-reason rules and deferred + future start-date handling on create/update: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:388).
- Computed availability reasons for triage, held, future start date, and dependency blockage: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:301).
- Store-level claim rejection for unavailable tasks: [internal/store/entstore_test.go](/workspace/internal/store/entstore_test.go:366), enforced by `ClaimTask` at [internal/store/entstore.go](/workspace/internal/store/entstore.go:904).
- RPC claim-on-behalf rejection is implemented at [internal/server/server.go](/workspace/internal/server/server.go:714); focused tests were present in the server/identity suites and the package passed.
- Import/export format version bump and old-state migration test exists: [internal/server/export_import.go](/workspace/internal/server/export_import.go:131), [internal/server/export_import_test.go](/workspace/internal/server/export_import_test.go:297).
- CLI native stage parser removes deleted stages: [internal/cli/enums.go](/workspace/internal/cli/enums.go:23).
- Proto/generated types remove deleted stage enum names and add availability/hold/rank fields: [proto/farmtable.proto](/workspace/proto/farmtable.proto:49), [web/src/gen/types.ts](/workspace/web/src/gen/types.ts:21).

Gaps:
- New-format import rejection for removed stage vocabulary.
- Exact migration-note payload assertions and import warnings for lossy migrations.
- Terminal dependency matrix for `wont_fix`, `cancelled`, and `duplicate`.
- Duplicate canonical replacement persistence/semantics.
- Adapter export/round-trip tests for accepted versus blocked/deferred fidelity.
- MCP vocabulary still describes `task_search` as "open phases" and `task_ready` as "ready to work on" at [internal/mcp/server.go](/workspace/internal/mcp/server.go:142) and [internal/mcp/server.go](/workspace/internal/mcp/server.go:157); consider a schema/help snapshot test for agent-facing wording.

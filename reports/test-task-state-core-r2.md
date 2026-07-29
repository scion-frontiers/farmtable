# Test Review R2: task-state-core

Date: 2026-07-27
Reviewer role: Test Engineer
Branch: `task-state-core`
Workspace: `/workspace`
Base: `origin/main`
Merge-base: `a2442ffa98fefc6fbb408e774344960e991f58cb`

Verdict: APPROVE

## Scope

Reviewed the current `task-state-core` test coverage against the authoritative contract at `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`, with specific R2 focus on the gaps from the prior review reports.

## Commands And Results

### Focused import/ready RPC tests

Command:

```bash
go test ./internal/server -run 'TestRPC_ImportCollection_MigratesOldTaskStatesWithNotes|TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages|TestRPC_GetReadyTasksIncludeUnblockedOpenIncludesUnavailableReasons'
```

Expected: pass; proves old-state migration notes, v2 rejection, and IncludeUnblockedOpen behavior.

Actual: pass.

### Focused store availability/claim tests

Command:

```bash
go test ./internal/store -run 'TestComputeAvailability_ReasonsAndTerminalDependencies|TestComputeAvailability_TerminalDependencyMatrix|TestClaimTask'
```

Expected: pass; proves availability reasons, terminal dependency matrix, and core claim behavior.

Actual: pass.

### Focused Beads adapter tests

Command:

```bash
go test ./internal/platform/beads -run 'TestStatusMapping|TestTaskToIssue_StatusProjection'
```

Expected: pass; proves inbound Beads status normalization and outbound status projection.

Actual: pass.

### Focused GitHub adapter tests

Command:

```bash
go test ./internal/platform/github -run 'TestComputeBlocked_DoesNotTreatAcceptedAsBlocked|TestComputeBlocked_ExternalUnavailableLabelAndOpenChildren|TestIssueUnavailableForClaim|TestMapLabelsToStage'
```

Expected: pass; proves treewalk read behavior no longer treats plain accepted issues as blocked and verifies helper-level claim unavailability rules.

Actual: pass.

### Full Go suite

Command:

```bash
go test ./...
```

Expected: pass.

Actual: pass.

### Whitespace check

Command:

```bash
git diff --check origin/main...HEAD
```

Expected: no output.

Actual: pass, no output.

## Coverage Findings

### 1. V2 import rejection is now covered

Status: covered.

Evidence:
- `TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages` tables over `backlog`, `ready`, `blocked`, `waiting_for_input`, `deferred`, and `scheduled`, sets `format_version = 2`, and asserts `codes.InvalidArgument` at `internal/server/export_import_test.go:437`.
- The implementation rejects removed stage values unless `formatVersion == 1` at `internal/server/export_import.go:667`, `internal/server/export_import.go:672`, `internal/server/export_import.go:678`, `internal/server/export_import.go:687`, and `internal/server/export_import.go:696`.

Root cause of prior gap: prior tests only exercised old-format migration. R2 now has a direct negative test for new-format native imports.

### 2. Exact migration-note JSON payloads are now covered

Status: covered.

Evidence:
- `TestRPC_ImportCollection_MigratesOldTaskStatesWithNotes` asserts exact old/new decoded JSON maps for ready, blocked with blocker, blocked without blocker, scheduled with start date, scheduled without start date, deferred with future start date, and adapter-origin blocked at `internal/server/export_import_test.go:371`.
- It asserts compact valid JSON and fails on unexpected or missing `task_state_migration` notes at `internal/server/export_import_test.go:410` and `internal/server/export_import_test.go:432`.
- The implementation records old phase/stage/native_label/start_date/has_blocker plus new stage/hold_reason/reason at `internal/server/export_import.go:775`.

Root cause of prior gap: prior coverage checked note presence and JSON validity only. R2 now checks payload fidelity.

### 3. Terminal dependency outcomes are now covered for the implemented v1 semantics

Status: covered, with canonical-duplicate behavior documented as residual risk.

Evidence:
- `TestComputeAvailability_TerminalDependencyMatrix` asserts `completed` satisfies dependencies, while `wont_fix`, `cancelled`, and `duplicate` without canonical replacement remain dependency blockers at `internal/store/entstore_test.go:388`.
- `terminalStageSatisfiesDependency` currently returns true only for `completed` at `internal/store/entstore.go:833`.

Root cause of prior gap: only the completed happy path was tested before. R2 now guards unsuccessful terminal outcomes and duplicate-without-canonical.

### 4. Beads status projection is now covered

Status: covered.

Evidence:
- `TestStatusMapping` asserts Beads `blocked` imports as `accepted + hold_reason=waiting_for_input`, `deferred` imports as `accepted + hold_reason=deferred`, and plain `open` imports as accepted with no hold at `internal/platform/beads/beads_integration_test.go:516`.
- `TestTaskToIssue_StatusProjection` asserts outbound accepted/open -> `open`, waiting hold -> `blocked`, deferred hold -> `deferred`, working -> `in_progress`, and closed -> `closed` at `internal/platform/beads/beads_integration_test.go:555`.
- `phaseStageToStatus` implements the same projection at `internal/platform/beads/beads.go:335`.
- The Beads JSONL converter emits format v2 `accepted` plus hold reason instead of deleted native stages at `internal/server/beads_import.go:99`, with format/version/native state checks at `internal/server/beads_import_test.go:290`.

Root cause of prior gap: outbound projection was not tested and accepted tasks could regress to external `blocked`. R2 now covers the round-trip-sensitive cases.

### 5. GitHub treewalk read behavior is now covered; pass-through claim is covered at helper level

Status: mostly covered.

Evidence:
- `TestComputeBlocked_DoesNotTreatAcceptedAsBlocked` proves plain accepted issues are not reported as blocked at `internal/platform/github/passthrough_test.go:103`.
- `TestComputeBlocked_ExternalUnavailableLabelAndOpenChildren` proves explicit legacy unavailable labels and open children still produce blocked read-model entries at `internal/platform/github/passthrough_test.go:117`.
- `computeBlocked` implements that behavior at `internal/platform/github/treewalk.go:118`.
- `TestIssueUnavailableForClaim` covers accepted, triage, legacy blocked/deferred labels, and open-child claim gating at `internal/platform/github/passthrough_test.go:130`.
- `GitHubPassThroughStore.ClaimTask` calls `issueUnavailableForClaim` before label mutation at `internal/platform/github/passthrough.go:534`.

Residual: there is no focused `GitHubPassThroughStore.ClaimTask` test with a fake GraphQL client proving a triage/blocked/open-child claim returns `store.ErrUnavailable` and does not call `removeLabels`/`addLabels`. The helper-level test covers the decision rule, but the mutation boundary itself is not directly exercised.

### 6. IncludeUnblockedOpen is now covered

Status: covered.

Evidence:
- `TestRPC_GetReadyTasksIncludeUnblockedOpenIncludesUnavailableReasons` proves default ready results exclude triage, held, and dependency-blocked tasks, while `IncludeUnblockedOpen` includes unblocked triage and held tasks with availability reasons and still excludes dependency-blocked tasks at `internal/server/server_test.go:1277`.
- Server request plumbing passes `IncludeUnblockedOpen` into the store at `internal/server/server.go:1512`.
- Store filtering uses `IncludeUnblockedOpen` to broaden the initial query and later excludes dependency-blocked rows at `internal/store/entstore.go:2261` and `internal/store/entstore.go:2297`.

Root cause of prior gap: implementation previously ignored the flag. R2 now has API-level assertions for both default and compatibility behavior.

### 7. Claim atomicity has best-available coverage, but no deterministic race test

Status: acceptable for R2, with residual risk.

Evidence:
- `ClaimTask` now runs in a transaction at `internal/store/entstore.go:921`.
- The final update predicate requires open/accepted/no assignee/no hold/no future start and adds `noUnsatisfiedBlockerPredicates()` at `internal/store/entstore.go:960` and `internal/store/entstore.go:970`.
- `TestComputeAvailability_ReasonsAndTerminalDependencies` asserts unavailable triage, held, future-start, and dependency-blocked tasks cannot be claimed at `internal/store/entstore_test.go:301`.

Residual: there is no deterministic concurrent test that pauses between availability read and claim write while another transaction changes a blocker. The final SQL predicates are inspectable and the focused tests cover the policy inputs, but a race harness would provide stronger regression evidence.

## Residual Test Risks

- GitHub pass-through claim policy should get a boundary-level fake GraphQL test to verify no label mutation occurs for unavailable issues.
- Claim atomicity lacks a deterministic concurrent interleaving test; current coverage is policy-level plus implementation predicate inspection.
- Duplicate-with-canonical dependency satisfaction remains untested because the branch still has no persisted canonical duplicate replacement primitive. Current tests cover duplicate-without-canonical as blocking.
- Postgres-tagged integration tests were not run; the full untagged Go suite passed.

## Final Verdict

APPROVE. The R2 branch now covers the previously reported contract-critical test gaps well enough for Phase 1 core, with the residual risks above suitable for follow-up hardening rather than merge-blocking test gaps.

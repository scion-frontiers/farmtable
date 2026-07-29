# Test Review R3: task-state-core

Date: 2026-07-27
Reviewer role: Test Engineer
Branch: `task-state-core`
Workspace: `/workspace`
Base: `origin/main`
Merge-base: `a2442ffa98fefc6fbb408e774344960e991f58cb`
Reviewed HEAD: `d4a8ffdb437bdebe7971b9195054161cdce2c904`

Verdict: APPROVE

## Scope

Fresh R3 QA review of the latest `task-state-core` fixes against the authoritative contract at `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.

R3 focused on:

- `GetBlockedTasks` terminal dependency matrix.
- Format v2 import rejection for invalid hold-state combinations.
- Direct create/update rejection of `stage=working`.
- Vulnerability/dependency updates where testable.

## Commands And Results

### Focused store terminal matrix

Command:

```bash
go test ./internal/store -run 'TestGetBlockedTasks_TerminalDependencyMatrix|TestComputeAvailability_TerminalDependencyMatrix'
```

Expected: pass; proves `GetBlockedTasks` and computed availability use the same terminal dependency satisfaction policy.

Actual: pass.

### Focused server R3 regression suite

Command:

```bash
go test ./internal/server -run 'TestRPC_GetBlockedTasks_TerminalDependencyMatrix|TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState|TestRPC_CreateTaskRejectsDirectWorkingStage|TestRPC_UpdateTaskRejectsDirectWorkingStage'
```

Expected: pass; proves the RPC surface rejects invalid v2 hold state and direct working-stage writes, and exposes the blocked terminal matrix.

Actual: pass.

### Dependency version check

Command:

```bash
go list -m golang.org/x/net golang.org/x/text
```

Expected: patched dependency versions.

Actual:

```text
golang.org/x/net v0.55.0
golang.org/x/text v0.39.0
```

### Full Go suite

Command:

```bash
go test ./...
```

Expected: pass.

Actual: pass.

### Vulnerability scan

Command:

```bash
/home/scion/go/bin/govulncheck ./...
```

Setup note: `govulncheck` was not initially installed on `PATH`; installed it with `go install golang.org/x/vuln/cmd/govulncheck@latest`, then ran the command above.

Expected: no reachable vulnerabilities.

Actual:

```text
No vulnerabilities found.

Your code is affected by 0 vulnerabilities.
This scan also found 0 vulnerabilities in packages you import and 15
vulnerabilities in modules you require, but your code doesn't appear to call
these vulnerabilities.
```

### Whitespace check

Command:

```bash
git diff --check origin/main...HEAD
```

Expected: no output.

Actual: pass, no output.

## Coverage Findings

### Current Coverage

- Covered: `GetBlockedTasks` terminal dependency behavior at store and RPC levels.
- Covered: format v2 invalid hold-state import rejection at RPC import boundary.
- Covered: direct create/update rejection of `stage=working` at RPC boundary.
- Covered: dependency patch levels and reachable vulnerability scan.

### 1. `GetBlockedTasks` terminal matrix is covered

Status: covered.

Evidence:

- `TestGetBlockedTasks_TerminalDependencyMatrix` tables over `completed`, `wont_fix`, `cancelled`, and `duplicate`, asserting only `completed` clears the dependent from blocked results.
- `TestRPC_GetBlockedTasks_TerminalDependencyMatrix` repeats the same matrix through the gRPC service.
- `GetBlockedTasks` now calls `terminalStageSatisfiesDependency`; the helper returns true only for `completed`, matching the current v1 contract where duplicate-without-canonical does not satisfy blockers.

Root cause of prior risk: the blocked read model previously used broad closed-phase resolution, which hid dependents blocked by unsuccessful terminal outcomes. The R3 tests would fail if that regression returned.

### 2. Format v2 invalid hold-state imports are covered

Status: covered.

Evidence:

- `TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState` covers hold on `triage`, hold on terminal `completed`, and `hold_reason=deferred` combined with a future `start_date`.
- The test asserts `codes.InvalidArgument`, which is the contract-relevant API behavior for native format v2 imports.

Root cause of prior risk: import bypassed normal write validation. The current coverage exercises the import path directly rather than relying on create/update tests.

### 3. Direct `working` create/update rejection is covered

Status: covered.

Evidence:

- `TestRPC_CreateTaskRejectsDirectWorkingStage` asserts `CreateTask(stage=working)` returns `InvalidArgument` and includes `ClaimTask` guidance.
- `TestRPC_UpdateTaskRejectsDirectWorkingStage` creates held accepted work, attempts `UpdateTask(stage=working)`, and asserts the same error class and guidance.

Root cause of prior risk: direct writes to `working` could bypass claim semantics. The tests pin the native API route to use `ClaimTask` for start/self-assignment behavior.

### 4. Dependency and vulnerability updates are testable and verified

Status: covered for reachable code and module selection.

Evidence:

- `go.mod` resolves `go 1.26.5`, `golang.org/x/net v0.55.0`, and `golang.org/x/text v0.39.0`.
- `go list -m` confirmed the selected module versions.
- `/home/scion/go/bin/govulncheck ./...` reported 0 vulnerabilities affecting code and 0 vulnerabilities in imported packages.

Root cause of prior risk: prior scans found reachable vulnerabilities. The current scan reports no reachable findings after the module/toolchain update.

## Recommended Tests

1. **GitHubPassThroughStore_ClaimTask_DoesNotMutateUnavailableIssue** - boundary-level fake GraphQL test proving unavailable claim attempts do not remove/add labels.
2. **ClaimTask_ConcurrentBlockerChangeRejected** - deterministic interleaving test around claim final predicates if the store test harness gains transaction control.
3. **Postgres task-state R3 matrix** - tagged integration repeat of terminal blocker and direct working rejection paths when a live Postgres service is available.

## Priority

- Critical: none open from the R3 focus.
- High: no merge-blocking coverage gaps found.
- Medium: add the GitHub pass-through boundary test and deterministic claim race test for hardening.
- Low: repeat R3 matrices under Postgres integration when infrastructure is available.

## Residual Test Risks

- Postgres-tagged integration tests were not run because no live Postgres instance was available in this review.
- Duplicate-with-canonical dependency satisfaction remains out of scope because Phase 1 core still lacks a persisted canonical duplicate replacement primitive. Existing tests cover duplicate without canonical replacement as blocking.
- `govulncheck` reports required modules still contain 15 known vulnerabilities, but none are reachable or imported by this code according to the scan.

## Final Verdict

APPROVE. The R3-specific fixes have direct, behavior-level coverage and the focused plus full verification commands pass.

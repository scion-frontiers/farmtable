## Security Audit Report

Date: 2026-07-27
Branch: `task-state-core`
Workspace reviewed: `/workspace` (container mount for host `/workspace/farmtable-task-state-core`)
Base: `origin/main`
Head: `d4a8ffdb437bdebe7971b9195054161cdce2c904`
Verdict: `APPROVE`

### Summary
- Critical: 0
- High: 0
- Medium: 0
- Low: 0

### Findings

No security findings requiring changes were identified in R3.

### R3 Verification

#### Direct working-stage create/update bypass
- **Location:** `internal/server/server.go:108`, `internal/server/server.go:115`, `internal/server/server.go:526`, `internal/server/server.go:531`
- **Result:** Fixed. Native `CreateTask` rejects `stage=working` before store create, and native `UpdateTask` rejects `stage=working` before transition authorization and store update. The generic write path no longer starts execution without the claim gate.
- **Evidence:** `TestRPC_CreateTaskRejectsDirectWorkingStage` and `TestRPC_UpdateTaskRejectsDirectWorkingStage` passed.

#### Claim self-assignment and availability gate
- **Location:** `internal/server/server.go:701`, `internal/server/server.go:722`, `internal/server/server.go:727`, `internal/store/entstore.go:921`, `internal/store/entstore.go:945`, `internal/store/entstore.go:954`, `internal/store/entstore.go:960`
- **Result:** Acceptable. The RPC rejects `ClaimTaskRequest.assignee_id`, derives the assignee from the authenticated actor, and calls the store claim path. The Ent claim transaction checks computed availability, rejects already-assigned tasks, and uses final update predicates for `open`, `accepted`, no hold reason, no future start date, no assignee, and no unsatisfied blockers.
- **Evidence:** Focused claim/server/store tests passed.

#### GetBlockedTasks dependency semantics
- **Location:** `internal/store/entstore.go:833`, `internal/store/entstore.go:876`, `internal/store/entstore.go:2385`, `internal/store/entstore.go:2416`, `internal/store/entstore.go:2433`
- **Result:** Fixed. `GetBlockedTasks` now uses the same `terminalStageSatisfiesDependency` policy as computed availability. `completed` satisfies a blocker; `wont_fix`, `cancelled`, and `duplicate` without canonical replacement remain unresolved blockers.
- **Evidence:** `TestGetBlockedTasks_TerminalDependencyMatrix` and `TestRPC_GetBlockedTasks_TerminalDependencyMatrix` passed.

#### Import/export trust boundaries and migration actor semantics
- **Location:** `internal/server/export_import.go:362`, `internal/server/export_import.go:396`, `internal/server/export_import.go:472`, `internal/server/export_import.go:653`, `internal/server/export_import.go:719`, `internal/server/export_import.go:806`, `internal/server/export_import.go:887`, `internal/server/export_import.go:896`
- **Result:** Acceptable. Format v2 imports reject removed native stages, while format v1 is the explicit migration path. Imported hold state is validated before store import. Lossy migrations persist `task_state_migration` changes authored by the `system:migration` service account.
- **Evidence:** `TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages` and `TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState` passed.

#### Adapter normalization
- **Location:** `internal/platform/beads/beads.go:308`, `internal/platform/beads/beads.go:322`, `internal/server/beads_import.go:99`, `internal/platform/github/labels.go:12`, `internal/platform/github/passthrough.go:517`, `internal/platform/github/passthrough.go:575`
- **Result:** Acceptable. Beads `blocked`/`deferred` normalize to `accepted` plus `hold_reason`; Beads `open` normalizes to `accepted`. GitHub valid stage mappings no longer include removed native stages, and pass-through claim rejects existing assignee, non-accepted stages, holds, legacy unavailable labels, and open sub-issues before label mutation.
- **Evidence:** Focused Beads and GitHub tests passed.

#### Go/toolchain/module vulnerability hygiene
- **Location:** `go.mod:3`, `go.mod`, `go.sum`
- **Result:** Acceptable. The branch now resolves to Go `1.26.5`, `golang.org/x/net v0.55.0`, and `golang.org/x/text v0.39.0`. `govulncheck ./...` reported zero reachable vulnerabilities.

### Positive Observations
- Removed native stage constants are absent from proto/API, internal Go code, web generated types, and `DRAFT-schema.json`.
- The explicit claim RPC is now the only native API path reviewed that starts execution.
- Store-level availability recomputation is transactional for Ent-backed claim-by-ID, which materially reduces race exposure.
- Import validation treats exported task state as untrusted input and fails closed for invalid format v2 native state.
- Dependency satisfaction is now centralized enough that ready, blocked, availability, and claim checks agree for terminal blocker semantics.
- Dependency hygiene is materially improved from R2; `govulncheck` reports no reachable vulnerabilities.

### Recommendations
- Keep `UpdateTask(stage=working)` and `CreateTask(stage=working)` regression tests in the merge gate; they protect the central claim invariant.
- Before a release, decide whether non-reachable `govulncheck` advisories in required modules should be tracked as a dependency maintenance item even though they do not currently affect reachable code.
- Document the external GitHub pass-through race as adapter residual risk because GitHub label/sub-issue reads and mutations cannot be made transactional like the Ent store claim path.

### Commands and Results
- `git status --short --branch` -> `## task-state-core...origin/main [ahead 10]`.
- `git rev-parse HEAD && git merge-base HEAD origin/main && git diff --check origin/main...HEAD` -> head `d4a8ffdb437bdebe7971b9195054161cdce2c904`; merge-base `a2442ffa98fefc6fbb408e774344960e991f58cb`; diff check passed.
- `git diff --stat origin/main...HEAD` -> 79 files changed, 4002 insertions, 1384 deletions.
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' api proto internal web/src DRAFT-schema.json` -> no matches.
- `rg -n 'ready stage|stage ready|triage and backlog|backlog|scheduled|ON_HOLD|on_hold|Open/Blocked|OnHold|Deferred' .agents/skills/farmtable docs/architecture.md internal/server internal/platform internal/cli internal/mcp README.md agents.md` -> remaining matches are compatibility `ON_HOLD`, explicit legacy format-v1 migration/tests, GitHub legacy unavailable-label detection, and valid hold/dependency terminology.
- `which govulncheck || true; go version; go list -m golang.org/x/net golang.org/x/text` -> `govulncheck` not bundled; Go resolved to `go1.26.5`; `golang.org/x/net v0.55.0`; `golang.org/x/text v0.39.0`.
- `go test ./internal/server -run 'TestRPC_CreateTaskRejectsDirectWorkingStage|TestRPC_UpdateTaskRejectsDirectWorkingStage|TestRPC_GetBlockedTasks_TerminalDependencyMatrix|TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState|TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages|TestRPC_ClaimTask'` -> pass.
- `go test ./internal/store -run 'TestClaimTask|TestComputeAvailability|TestTaskStateValidation|TestGetBlockedTasks_TerminalDependencyMatrix'` -> pass.
- `go test ./internal/platform/github -run 'Test.*Claim|TestComputeBlocked|TestComputeReady|TestIssueUnavailableForClaim|TestMapLabels|TestIssueToPhaseStage'` -> pass.
- `go test ./internal/platform/beads -run 'TestStatusMapping|TestTaskToIssue|TestBeadsSyncIntegration|TestBeadsStatusToPhaseStage'` -> pass.
- `go test ./internal/mcp ./internal/cli` -> pass.
- `go test ./...` -> pass.
- `go list -m -json -mod=readonly all >/tmp/farmtable-go-modules-r3.json && echo PASS` -> pass.
- `cd web && npm audit --omit=dev` -> found 0 vulnerabilities.
- `go install golang.org/x/vuln/cmd/govulncheck@latest && $(go env GOPATH)/bin/govulncheck ./...` -> no vulnerabilities found; code affected by 0 vulnerabilities; scan also found 0 vulnerabilities in imported packages and 15 vulnerabilities in required modules not reached by this code.

### Residual Risk
- I did not run Postgres-tagged integration tests; the untagged full Go suite passed.
- GitHub pass-through claim still depends on a pre-mutation issue snapshot. A concurrent GitHub sub-issue or label change between read and mutation can race because the external API does not provide the Ent store's transactional predicate semantics.
- Duplicate-with-canonical dependency satisfaction remains out of phase-1 scope because there is no persisted canonical replacement field; current behavior keeps `duplicate` unresolved unless future canonical proof is implemented.

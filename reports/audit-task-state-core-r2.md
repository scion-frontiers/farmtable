## Security Audit Report

Date: 2026-07-27
Branch: `task-state-core`
Workspace reviewed: `/workspace` (container mount for host `/workspace/farmtable-task-state-core`)
Base: `origin/main`
Head: `9894398734ffe29a0f2a4535327d49560ba51fc5`
Verdict: `REQUEST CHANGES`

### Summary
- Critical: 0
- High: 1
- Medium: 1
- Low: 0

### Findings

#### [HIGH] Direct write paths can start execution without the claim gate
- **Location:** `internal/server/server.go:479`, `internal/server/server.go:522`, `internal/server/server.go:529`, `internal/server/server.go:534`, `internal/server/server.go:728`, `internal/server/transitions.go:100`, `internal/store/entstore.go:544`, `internal/store/entstore.go:590`, `internal/store/entstore.go:613`, `internal/store/entstore.go:921`
- **Description:** The R2 claim path itself now enforces availability and self-assignment, but `UpdateTask` can still set `stage=working` through the generic write path. `UpdateTask` first requires `task:write`, then only checks `TransitionScope(existing.Stage, working)`, which maps to `task:claim`. After that it calls `store.UpdateTask`, which validates the stage/hold/start-date shape but does not compute claim availability, reject existing assignment, enforce self-assignment, or clear hold reason as a claim side effect. `CreateTask` has the same pattern for direct creation in `working`: it requires `task:write` and the triage-to-working transition scope, which currently resolves to `task:accept` because the accept rule is ordered before the working rule.
- **Impact:** A caller with ordinary write plus lifecycle scopes can mark unavailable accepted work as executing without satisfying the contract's claim invariant. This bypasses dependency, hold, future-start, already-assigned, and self-assignment controls. It can corrupt the work queue and audit trail because "assigned plus active stage implies an active claim" but the transition can occur with no assignee, the wrong assignee, or while dependency-blocked.
- **Proof of concept:** Create an accepted task with `hold_reason=waiting_for_input`, a future `start_date`, or an open blocker. Call `UpdateTask` with `stage=TASK_STAGE_WORKING` using a token that has `task:write` and `task:claim`. The server authorizes the stage change through `TransitionScope`, then `EntStore.UpdateTask` persists `working`; the guarded `EntStore.ClaimTask` path at `internal/store/entstore.go:921` is never invoked.
- **Recommendation:** Treat any native transition into `working` as a claim operation, not as a generic update. The safest v1 fix is to reject `UpdateTask(stage=working)` and direct `CreateTask(stage=working)` with `INVALID_ARGUMENT`, directing callers to `ClaimTask`. If direct update compatibility must remain, route that transition through the same store claim policy and require the authenticated actor to become the assignee.

```go
// In UpdateTask, before building store.UpdateTaskParams.
if req.Stage != nil && convert.StageFromProto(*req.Stage) == task.StageWorking {
    return nil, status.Error(codes.InvalidArgument,
        "stage=working starts execution; use ClaimTask so availability and self-assignment are enforced")
}

// In CreateTask, reject direct active-start creation for native tasks.
if req.Stage != nil && convert.StageFromProto(*req.Stage) == task.StageWorking {
    return nil, status.Error(codes.InvalidArgument,
        "cannot create directly in working; create accepted work, then claim it")
}
```

If preserving `UpdateTask(stage=working)` is mandatory, the implementation must call `s.store.ClaimTask(ctx, id, actorID, version)` for that transition and reject any simultaneous task mutations in the same request unless they are explicitly modeled and tested.

#### [MEDIUM] Reachable Go dependency and toolchain vulnerabilities remain in the build
- **Location:** `go.mod:3`, `go.mod:68`, `go.mod:70`
- **Description:** `govulncheck` reports reachable vulnerabilities in the configured Go toolchain (`go 1.26.2`) and indirect modules `golang.org/x/net v0.52.0` and `golang.org/x/text v0.35.0`. Reported reachable issues include HTTP/2 infinite loop risk (`GO-2026-4918`), `html/template` escaping bypasses (`GO-2026-4980`, `GO-2026-4982`), TLS/X.509/textproto issues in the standard library, `x/net/idna` punycode handling (`GO-2026-5026`), and `x/text` invalid-input infinite loop (`GO-2026-5970`).
- **Impact:** The exact exploitability depends on deployment surface and inputs, but the scanner found reachable call paths through HTTP clients/server code, GitHub transport, IAP JWKS refresh, template execution, and migration/schema code. At minimum this is a release hygiene blocker for a security-sensitive branch touching task state and external adapters.
- **Recommendation:** Upgrade the Go toolchain and affected indirect modules, then rerun `govulncheck ./...`.

```bash
go get go@1.26.5
go get golang.org/x/net@v0.55.0 golang.org/x/text@v0.39.0
go mod tidy
go test ./...
$(go env GOPATH)/bin/govulncheck ./...
```

### Prior Blocker Verification
- GitHub pass-through claim bypass: fixed for the reviewed path. `GitHubPassThroughStore.ClaimTask` now rejects already assigned tasks and calls `issueUnavailableForClaim`, which requires accepted stage, no hold reason, no legacy unavailable label, and no open sub-issues before label mutation.
- Ent claim availability race: substantially fixed for the reviewed dependency race. `EntStore.ClaimTask` recomputes availability in a transaction and uses final predicates for open/accepted/no hold/no future start/no unsatisfied blocker before mutating to `working`.
- Beads accepted-to-blocked projection: fixed. Beads status projection now uses `hold_reason`; plain accepted/open exports as `open`, waiting-for-input exports as `blocked`, and deferred exports as `deferred`.

### Positive Observations
- Native `ClaimTask` rejects request-level `assignee_id`, preserving self-assignment semantics for the explicit claim RPC.
- Format v2 imports reject removed native stage strings, while format v1 remains an explicit migration path with `task_state_migration` change records.
- Store validation rejects hold reasons on triage and terminal stages, and normalizes or rejects contradictory deferred/future-start combinations.
- GitHub treewalk no longer treats every accepted issue as blocked; blocked read-model entries now come from open sub-issues or explicit legacy unavailable labels.
- Focused adapter, import, claim, and availability tests passed, and full `go test ./...` passed.

### Recommendations
- Block merge until `UpdateTask` and `CreateTask` cannot bypass the claim/start invariant.
- Add regression tests proving unavailable accepted tasks cannot be moved to `working` through `UpdateTask`, and tasks cannot be created directly in `working` unless the product intentionally defines a privileged start-on-create operation.
- Patch the Go toolchain and vulnerable indirect modules before release.
- Consider documenting that `working` transitions are reserved for claim/start semantics, while assignment-only routing remains available on unavailable work.

### Commands and Results
- `pwd && git status --short --branch && git rev-parse --abbrev-ref HEAD && git rev-parse HEAD && git merge-base HEAD origin/main` -> `/workspace`; branch `task-state-core`; head `9894398734ffe29a0f2a4535327d49560ba51fc5`; merge-base `a2442ffa98fefc6fbb408e774344960e991f58cb`.
- `git diff --stat origin/main...HEAD` -> 74 files changed, 3583 insertions, 1350 deletions.
- `git diff --check origin/main...HEAD` -> pass.
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' api proto internal web/src DRAFT-schema.json` -> no matches.
- `rg -n 'ready stage|stage ready|triage and backlog|backlog|scheduled|ON_HOLD|on_hold|Open/Blocked|OnHold|Deferred' .agents/skills/farmtable docs/architecture.md internal/server internal/platform internal/cli internal/mcp README.md agents.md` -> remaining matches are compatibility `ON_HOLD`, explicit legacy migration/tests, GitHub legacy unavailable-label detection, and valid hold/dependency terminology.
- `go test ./internal/store ./internal/server ./internal/platform/github ./internal/platform/beads ./internal/mcp ./internal/cli` -> pass.
- `go test ./internal/server -run 'TestScopedToken|TestRPC_ClaimTask|TestTransitionScope|TestRPC_GetReadyTasksIncludeUnblockedOpen|TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages|TestRPC_ImportCollection_MigratesOldTaskStatesWithNotes'` -> pass.
- `go test ./internal/store -run 'TestClaimTask|TestComputeAvailability|TestTaskStateValidation'` -> pass.
- `go test ./internal/platform/github -run 'Test.*Claim|TestComputeBlocked|TestComputeReady|TestIssueUnavailableForClaim|TestMapLabels|TestIssueToPhaseStage'` -> pass.
- `go test ./internal/platform/beads -run 'TestStatusMapping|TestTaskToIssue|TestBeadsSyncIntegration|TestBeadsStatusToPhaseStage'` -> pass.
- `go test ./...` -> pass.
- `go list -m -json -mod=readonly all >/tmp/farmtable-go-modules.json && echo PASS` -> pass.
- `cd web && npm audit --omit=dev` -> found 0 vulnerabilities.
- `go tool govulncheck ./...` -> not bundled in this toolchain (`go: no such tool "govulncheck"`).
- `go install golang.org/x/vuln/cmd/govulncheck@latest && $(go env GOPATH)/bin/govulncheck ./...` -> found 9 reachable vulnerabilities from the Go standard library and 2 modules; key upgrade targets are Go `1.26.5`, `golang.org/x/net v0.55.0`, and `golang.org/x/text v0.39.0`.

### Residual Risk
- I did not run Postgres-tagged integration tests; the untagged full Go suite passed.
- The GitHub pass-through claim check relies on the issue snapshot returned before label mutation; a concurrent GitHub sub-issue or label change between list and mutation can still race because the external API does not provide the same transactional predicate as Ent. The current fix is acceptable for the previous pass-through bypass but should be documented as external-adapter residual risk.
- Duplicate-with-canonical dependency satisfaction remains out of phase-1 scope because there is no persisted canonical replacement field; the current behavior that duplicate does not satisfy blockers without canonical proof is covered by tests.

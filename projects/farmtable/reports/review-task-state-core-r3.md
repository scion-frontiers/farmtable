# Task State Core R3 Review

Date: 2026-07-27
Branch: `task-state-core`
Workspace: `/workspace`
Base: `origin/main`
Merge-base: `a2442ffa98fefc6fbb408e774344960e991f58cb`
Head: `d4a8ffd` (`docs: record task state r2 fixes`)
Verdict: `APPROVE`

## Executive Summary

Risk level: LOW. The R2 blockers are fixed in the reviewed delta: blocked-read terminal semantics now share the completed-only dependency predicate, v2 import rejects invalid hold/start-date state, native RPC create/update paths reject direct `working`, and the Go/module vulnerability updates clear reachable `govulncheck` findings.

The remaining issue is documentation/API-comment drift around dependency satisfaction wording, not executable behavior. I recommend cleaning it up before publishing generated docs, but it is not a merge blocker for the core implementation.

## Critical Issues

None.

## High

None.

## Medium

None.

## Low

- [proto/farmtable.proto:1102](/workspace/proto/farmtable.proto:1102) and [docs/architecture.md:306](/workspace/docs/architecture.md:306) still describe dependency resolution as blockers being resolved by the `CLOSED` phase or "closed tasks." The implemented policy and contract say only `completed` satisfies blockers in v1; `wont_fix`, `cancelled`, and `duplicate` without canonical proof continue blocking. This is documentation/API-comment drift, but it can mislead generated API docs and agent-facing guidance.

Suggested Fix:

```diff
- // resolved (CLOSED phase). The primary "what should I work on next?" query
+ // resolved by completed blockers. The primary "what should I work on next?" query
```

For `docs/architecture.md`, replace "closed tasks" with "completed tasks" or "tasks whose stage satisfies the dependency policy."

## Observations

- R2 blocker fixed: [internal/store/entstore.go:2416](/workspace/internal/store/entstore.go:2416) and [internal/store/entstore.go:2433](/workspace/internal/store/entstore.go:2433) now use `terminalStageSatisfiesDependency`, which currently returns true only for `completed` at [internal/store/entstore.go:833](/workspace/internal/store/entstore.go:833).
- R2 blocker fixed: v2 import now calls `validateImportedTaskState` before constructing the store import task at [internal/server/export_import.go:719](/workspace/internal/server/export_import.go:719), and rejects holds on triage/terminal plus `deferred` with future `start_date` at [internal/server/export_import.go:806](/workspace/internal/server/export_import.go:806).
- R2 blocker fixed: native RPC `CreateTask` and `UpdateTask` reject direct `stage=working` with ClaimTask guidance at [internal/server/server.go:115](/workspace/internal/server/server.go:115) and [internal/server/server.go:531](/workspace/internal/server/server.go:531).
- R2 blocker fixed: `go.mod` now uses Go `1.26.5`, `golang.org/x/net v0.55.0`, and `golang.org/x/text v0.39.0` at [go.mod:3](/workspace/go.mod:3), [go.mod:18](/workspace/go.mod:18), and [go.mod:71](/workspace/go.mod:71); reachable `govulncheck` findings are gone.

## Positive Feedback

- The R2 fixes are covered by focused regression tests for `GetBlockedTasks` terminal dependency semantics, v2 invalid hold-state import rejection, and direct RPC `working` rejection.
- The Ent claim path still uses a transaction plus final SQL predicates for accepted/no-assignee/no-hold/no-future-start/no-unsatisfied-blocker, which is the right invariant boundary for concurrent claim races.
- The removed native stage constants are gone from proto/generated Go, CLI, MCP parser maps, web generated types, Ent schema, and the draft JSON schema.

## Test Coverage

Tests reviewed: yes. Focused tests now cover the R2 blocker areas:

- `TestGetBlockedTasks_TerminalDependencyMatrix` and `TestRPC_GetBlockedTasks_TerminalDependencyMatrix`.
- `TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState`.
- `TestRPC_CreateTaskRejectsDirectWorkingStage`, `TestRPC_UpdateTaskRejectsDirectWorkingStage`, and RBAC laundering coverage for direct update into `working`.

Remaining coverage risk: GitHub pass-through claim is still covered mainly at helper/policy level rather than a full fake GraphQL mutation-boundary test, matching the R2 residual risk.

## Backward Compatibility

Format version 2 exports include the new native primitives (`hold_reason`, `rank`) and reject removed native stages on v2 import. Format version 1 still migrates removed native stages with persistent `task_state_migration` notes.

Wire `TASK_PHASE_ON_HOLD` remains compatibility-only, which matches the contract. Removed native task stage enum values are no longer present in generated proto/web/CLI/MCP stage surfaces.

## Verification Commands

- `git status --short --branch` -> `## task-state-core...origin/main [ahead 10]`.
- `git merge-base HEAD origin/main` -> `a2442ffa98fefc6fbb408e774344960e991f58cb`.
- `git log --oneline --max-count=30 origin/main..HEAD` -> 10 commits, head `d4a8ffd docs: record task state r2 fixes`.
- `git diff --stat origin/main...HEAD` -> 79 files changed, 4002 insertions, 1384 deletions.
- `git diff --check origin/main...HEAD` -> pass.
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' api proto internal web/src DRAFT-schema.json .agents docs README.md agents.md` -> no matches.
- `go test ./internal/store ./internal/server ./internal/platform/beads ./internal/platform/github ./internal/mcp ./internal/cli` -> pass.
- `go build ./...` -> pass.
- `go test ./...` -> pass.
- `go generate ./internal/store/ent` -> pass; worktree stayed clean.
- `cd web && npm run build` -> pass; Vite emitted the existing >500 kB chunk-size warning.
- `go version && go list -m -json -mod=readonly all >/tmp/farmtable-go-modules-r3.json && echo PASS` -> `go version go1.26.5 linux/amd64`; pass.
- `go tool govulncheck ./...` -> unavailable in toolchain (`go: no such tool "govulncheck"`).
- `go install golang.org/x/vuln/cmd/govulncheck@latest && $(go env GOPATH)/bin/govulncheck ./...` -> pass; 0 reachable vulnerabilities.
- `cd web && npm audit --omit=dev` -> 0 vulnerabilities.
- `buf generate` -> not run; `buf` is not installed (`zsh:1: command not found: buf`).

## Residual Risks

- Postgres-tagged integration tests were not run because no live Postgres service was provided; the full untagged Go suite passed.
- GitHub pass-through claim remains bounded by GitHub API snapshot/mutation behavior and cannot be transactional like Ent.
- API/docs wording should be corrected from "closed phase/closed tasks" to completed-only dependency satisfaction before generated docs are published.

## Final Verdict

APPROVE. The R2 blockers are resolved and the remaining documentation drift is a low-severity cleanup recommendation.

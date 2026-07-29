# Task State Model Phase 1 Test Review R3

Date: 2026-07-27
Reviewer role: Test Engineer
Branch: `task-state-core`
Workspace: `/workspace`
Base: `origin/main`
Merge-base: `a2442ffa98fefc6fbb408e774344960e991f58cb`
Reviewed HEAD: `d4a8ffdb437bdebe7971b9195054161cdce2c904`

## Summary

Completed R3 QA/test coverage review for the Phase 1 core task state model changes against `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.

Verdict: APPROVE.

The latest fixes are covered by direct tests: `GetBlockedTasks` now has terminal dependency matrix coverage at store and RPC levels, format v2 import rejects invalid hold-state combinations, direct `CreateTask`/`UpdateTask` writes to `working` are rejected with `ClaimTask` guidance, and patched dependency versions plus reachable vulnerability status were verified.

## Verification

- `go test ./internal/store -run 'TestGetBlockedTasks_TerminalDependencyMatrix|TestComputeAvailability_TerminalDependencyMatrix'`: PASS
- `go test ./internal/server -run 'TestRPC_GetBlockedTasks_TerminalDependencyMatrix|TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState|TestRPC_CreateTaskRejectsDirectWorkingStage|TestRPC_UpdateTaskRejectsDirectWorkingStage'`: PASS
- `go list -m golang.org/x/net golang.org/x/text`: PASS, resolved `golang.org/x/net v0.55.0` and `golang.org/x/text v0.39.0`
- `go test ./...`: PASS
- `go install golang.org/x/vuln/cmd/govulncheck@latest`: PASS, required because `govulncheck` was not initially on `PATH`
- `/home/scion/go/bin/govulncheck ./...`: PASS, 0 vulnerabilities affecting code and 0 vulnerabilities in imported packages
- `git diff --check origin/main...HEAD`: PASS

## Deliverables

- R3 test review report written to `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core-r3.md`.

## Residual Risks

- Postgres-tagged integration tests were not run in this review.
- GitHub pass-through claim gating still deserves a future boundary-level fake GraphQL test to prove unavailable claims do not mutate labels.
- Claim atomicity still lacks a deterministic concurrent interleaving test; current evidence is final predicate inspection plus policy-level tests.
- Duplicate-with-canonical dependency satisfaction remains out of scope until the data model has a persisted canonical duplicate replacement primitive.

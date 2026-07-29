# Task State Model Phase 1 Security Audit R3

Date: 2026-07-27
Branch: `task-state-core`
Base: `origin/main`
Reviewed head: `d4a8ffdb437bdebe7971b9195054161cdce2c904`
Verdict: `APPROVE`

## Scope

R3 re-audited the phase-1 task state core against the authoritative contract at `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md` and verified the R2 security findings against the current branch.

Focus areas:

- Direct `CreateTask`/`UpdateTask` bypass into `working`.
- `GetBlockedTasks` terminal dependency semantics.
- Format v2 import validation and lossy migration records.
- Claim self-assignment and availability gates.
- Migration actor semantics.
- Beads and GitHub adapter normalization.
- Go/toolchain/module vulnerability hygiene.

## Result

Approved from a security-audit perspective. No Critical, High, Medium, or Low findings remain.

R2 blockers were verified closed:

- Native `CreateTask(stage=working)` is rejected with guidance to create accepted work and then call `ClaimTask`.
- Native `UpdateTask(stage=working)` is rejected with guidance to call `ClaimTask`.
- `ClaimTask` rejects request-level `assignee_id`, self-assigns from authenticated identity, and uses the transactional Ent claim gate.
- `GetBlockedTasks` uses the same `completed`-only dependency satisfaction policy as computed availability.
- Format v2 import rejects removed native stages and invalid hold-state combinations.
- Lossy import migration notes are persisted as `task_state_migration` changes authored by `system:migration`.
- Beads and GitHub normalization paths no longer reintroduce deleted native stages as Farm Table native state.
- `govulncheck ./...` reports no reachable vulnerabilities.

## Evidence

Commands run:

- `git status --short --branch`
- `git rev-parse HEAD && git merge-base HEAD origin/main && git diff --check origin/main...HEAD`
- `git diff --stat origin/main...HEAD`
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' api proto internal web/src DRAFT-schema.json`
- `rg -n 'ready stage|stage ready|triage and backlog|backlog|scheduled|ON_HOLD|on_hold|Open/Blocked|OnHold|Deferred' .agents/skills/farmtable docs/architecture.md internal/server internal/platform internal/cli internal/mcp README.md agents.md`
- `go test ./internal/server -run 'TestRPC_CreateTaskRejectsDirectWorkingStage|TestRPC_UpdateTaskRejectsDirectWorkingStage|TestRPC_GetBlockedTasks_TerminalDependencyMatrix|TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState|TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages|TestRPC_ClaimTask'`
- `go test ./internal/store -run 'TestClaimTask|TestComputeAvailability|TestTaskStateValidation|TestGetBlockedTasks_TerminalDependencyMatrix'`
- `go test ./internal/platform/github -run 'Test.*Claim|TestComputeBlocked|TestComputeReady|TestIssueUnavailableForClaim|TestMapLabels|TestIssueToPhaseStage'`
- `go test ./internal/platform/beads -run 'TestStatusMapping|TestTaskToIssue|TestBeadsSyncIntegration|TestBeadsStatusToPhaseStage'`
- `go test ./internal/mcp ./internal/cli`
- `go test ./...`
- `go list -m -json -mod=readonly all >/tmp/farmtable-go-modules-r3.json && echo PASS`
- `cd web && npm audit --omit=dev`
- `go install golang.org/x/vuln/cmd/govulncheck@latest && $(go env GOPATH)/bin/govulncheck ./...`

Results:

- Head: `d4a8ffdb437bdebe7971b9195054161cdce2c904`.
- Merge-base: `a2442ffa98fefc6fbb408e774344960e991f58cb`.
- Diff check: pass.
- Branch diff: 79 files changed, 4002 insertions, 1384 deletions.
- Removed native stage constant search: no matches.
- Vocabulary follow-up search: remaining matches are compatibility `ON_HOLD`, explicit legacy format-v1 migration/tests, GitHub legacy unavailable-label detection, and valid hold/dependency terminology.
- Focused Go tests: pass.
- Full `go test ./...`: pass.
- Module readonly resolution: pass.
- `npm audit --omit=dev`: found 0 vulnerabilities.
- `govulncheck ./...`: no reachable vulnerabilities; 0 vulnerable imported packages; 15 vulnerable required modules not reached by this code.

## Residual Risks

- Postgres-tagged integration tests were not run in this audit pass.
- GitHub pass-through claim has unavoidable external-adapter race exposure between issue snapshot read and label mutation because GitHub does not provide the transactional predicates used by the Ent store.
- Duplicate-with-canonical dependency satisfaction remains out of phase-1 scope until a persisted canonical replacement field exists.

## Report

Full R3 security report written to `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core-r3.md`.

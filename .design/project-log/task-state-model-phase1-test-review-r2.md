# Task State Model Phase 1 Test Review R2

Date: 2026-07-27
Reviewer role: Test Engineer
Branch: `task-state-core`
Workspace: `/workspace`

## Summary

Completed R2 QA/test coverage review for the Phase 1 core task state model changes against `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.

Verdict: APPROVE.

The R2 follow-up closes the major prior coverage gaps: v2 import rejection, exact migration-note payloads, terminal dependency outcomes, Beads status projection, GitHub treewalk behavior, IncludeUnblockedOpen, and best-available claim atomicity evidence all have focused tests or direct predicate evidence.

## Verification

- `go test ./internal/server -run 'TestRPC_ImportCollection_MigratesOldTaskStatesWithNotes|TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages|TestRPC_GetReadyTasksIncludeUnblockedOpenIncludesUnavailableReasons'`: PASS
- `go test ./internal/store -run 'TestComputeAvailability_ReasonsAndTerminalDependencies|TestComputeAvailability_TerminalDependencyMatrix|TestClaimTask'`: PASS
- `go test ./internal/platform/beads -run 'TestStatusMapping|TestTaskToIssue_StatusProjection'`: PASS
- `go test ./internal/platform/github -run 'TestComputeBlocked_DoesNotTreatAcceptedAsBlocked|TestComputeBlocked_ExternalUnavailableLabelAndOpenChildren|TestIssueUnavailableForClaim|TestMapLabelsToStage'`: PASS
- `go test ./...`: PASS
- `git diff --check origin/main...HEAD`: PASS

## Deliverables

- R2 test review report written to `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core-r2.md`.

## Residual Risks

- GitHub pass-through claim gating is tested through `issueUnavailableForClaim`; add a future boundary-level fake GraphQL test to prove unavailable claims do not mutate labels.
- Claim atomicity is supported by transactional final predicates, but there is no deterministic concurrent interleaving test.
- Duplicate-with-canonical dependency satisfaction is still out of scope until a persisted canonical duplicate primitive exists.
- Postgres-tagged integration tests were not run in this review.

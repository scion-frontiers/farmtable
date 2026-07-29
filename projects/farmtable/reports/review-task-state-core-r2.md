# Task State Core R2 Review

## Executive Summary

Risk level: MEDIUM. The branch fixes the first-round blockers for atomic Ent claim gating, GitHub pass-through claim gating, Beads normalization, GitHub treewalk accepted-status handling, v2 removed-stage rejection, migration-note assertions, and stale ON_HOLD docs, but two correctness gaps remain in the dependency/import read and write surfaces.

Verdict: REQUEST CHANGES.

## Critical Issues

None.

## High

- [internal/store/entstore.go:2416](/workspace/internal/store/entstore.go:2416) `GetBlockedTasks` still treats every `phase=closed` blocker as resolved. The new dependency policy is encoded in `terminalStageSatisfiesDependency` at [internal/store/entstore.go:833](/workspace/internal/store/entstore.go:833) and the terminal matrix tests assert that only `completed` satisfies blockers, while `wont_fix`, `cancelled`, and `duplicate` without a canonical replacement continue blocking. However, the blocked read model filters blockers with `blocker.Phase != task.PhaseClosed` at [internal/store/entstore.go:2416](/workspace/internal/store/entstore.go:2416) and [internal/store/entstore.go:2433](/workspace/internal/store/entstore.go:2433), so a task blocked by a `wont_fix`, `cancelled`, or `duplicate` task is unavailable but disappears from `GetBlockedTasks`.

Suggested Fix:

```go
if !terminalStageSatisfiesDependency(blocker.Stage) {
    blockers = append(blockers, BlockerInfoResult{
        TaskID: blocker.ID,
        Name:   blocker.Title,
        Phase:  blocker.Phase,
        Stage:  blocker.Stage,
    })
}
```

Add RPC/store coverage for `GetBlockedTasks` with blockers closed as `completed`, `wont_fix`, `cancelled`, and `duplicate`; only `completed` should remove the dependent from blocked results.

## Medium

- [internal/server/export_import.go:653](/workspace/internal/server/export_import.go:653) and [internal/store/entstore.go:1892](/workspace/internal/store/entstore.go:1892) v2 imports can persist invalid hold-state combinations that create/update now reject. `migrateTaskState` accepts native v2 stages and copies `hold_reason` without checking that the hold applies only to accepted/active stages or that `hold_reason=deferred` does not coexist with a future `start_date`; `EntStore.ImportCollection` then writes those fields directly and bypasses `validateTaskStateForWrite`. This lets a format v2 import persist `stage=triage, hold_reason=waiting_for_input` or `stage=accepted, hold_reason=deferred, start_date=<future>`, violating the contract's integrity rule.

Suggested Fix:

```go
phase, stage, holdReason, migrationReason, err := migrateTaskState(...)
if err != nil {
    return store.ImportTask{}, nil, err
}
if err := validateImportedTaskState(stage, holdReason, t.StartDate); err != nil {
    return store.ImportTask{}, nil, err
}
```

Use the same rules as `validateTaskStateForWrite`, either by moving that validation to a shared package or by validating before `ImportCollection` constructs `store.ImportTask`. Add v2 import rejection tests for hold-on-triage/terminal and deferred plus future start date.

## Low

None.

## Observations

- The first-round Beads adapter regression is fixed: accepted tasks now export as `open`, deferred holds as `deferred`, and waiting holds as `blocked` at [internal/platform/beads/beads.go:335](/workspace/internal/platform/beads/beads.go:335).
- The GitHub treewalk no longer treats every accepted issue as blocked; explicit unavailable labels and open sub-issues are separated at [internal/platform/github/treewalk.go:126](/workspace/internal/platform/github/treewalk.go:126).
- `IncludeUnblockedOpen` now has distinct semantics and carries availability reasons for triage/held/future-start accepted tasks while still excluding dependency-blocked tasks from the compatibility result.

## Positive Feedback

- Ent claim is now wrapped in a transaction and the final update includes task-row predicates plus `NOT EXISTS` blocker predicates, closing the main claim race identified in R1.
- GitHub pass-through `ClaimTask` now rejects already assigned, triage/non-accepted, held/external-unavailable, and open-sub-issue cases before mutating labels.
- The old export migration matrix now asserts exact compact JSON old/new payloads, and format v2 rejects the removed native stages.
- Generated Ent/proto/web client surfaces no longer expose the removed native stage constants.

## Test Coverage

Tests reviewed: yes. Coverage now includes Beads projection, GitHub pass-through/treewalk checks, terminal dependency availability, v2 removed-stage import rejection, and migration-note payload assertions. Remaining gaps are `GetBlockedTasks` terminal dependency matrix coverage and v2 import validation for invalid hold-state combinations.

## Backward Compatibility

Format version 2 is introduced for native exports, while format version 1 remains accepted for old-stage migration. The wire `ON_HOLD` phase remains for compatibility, but native stage values removed from v2 imports are rejected.

## Verification Commands

- `git status --short --branch` -> `## task-state-core...origin/main [ahead 8]`.
- `git merge-base HEAD origin/main` -> `a2442ffa98fefc6fbb408e774344960e991f58cb`.
- `git diff --stat origin/main...HEAD` -> 74 files changed, 3583 insertions, 1350 deletions.
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' api proto internal web/src DRAFT-schema.json .agents docs README.md agents.md` -> no matches.
- `git diff --check origin/main...HEAD` -> pass.
- `go test ./internal/store ./internal/server ./internal/platform/beads ./internal/platform/github ./internal/mcp ./internal/cli` -> pass.
- `go build ./...` -> pass.
- `go test ./...` -> pass.
- `go generate ./internal/store/ent` -> pass and left no working-tree diff.
- `cd web && npm run build` -> pass; Vite reported the existing chunk-size warning.
- `buf generate` -> not run, `buf` is not installed (`zsh:1: command not found: buf`).

## Residual Risks

- I did not run Postgres-tagged integration tests because no live Postgres service was provided; untagged Postgres helper tests were not part of the default suite.
- GitHub pass-through claim availability remains an external snapshot check before label mutation, so it cannot be as strongly atomic as the Ent SQL claim path.

## Final Verdict

REQUEST CHANGES. Fix `GetBlockedTasks` to use the same dependency-satisfaction predicate as availability, and reject or normalize invalid hold-state combinations during v2 import before merge.

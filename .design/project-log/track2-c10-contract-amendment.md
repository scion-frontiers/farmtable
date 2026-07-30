# Track 2 — C-10 Contract Amendment: Duplicate Does Not Satisfy Dependency

**Date:** 2026-07-30
**Author:** farmtable-dev-c10-amend
**Branch:** fix/track2-c10-contract-amendment

## Context

The C-10 contract criterion (design-task-state-model-contract.md, line 750)
previously stated that duplicate satisfies a dependency "only with canonical
replacement." An owner ruling (2026-07-30T16:34Z) clarified the intended
semantics: a task closed as duplicate **never** satisfies a dependency. It is
the blocked item owner's responsibility to remove the blocking relationship if
the duplicate status resolves the blocking condition.

The existing code already implements the correct behaviour —
`terminalStageSatisfiesDependency` returns `false` for `StageDuplicate`. This
change amends the contract text and test documentation to match the code and
the ruling.

## Changes

1. **Contract criterion amended** — Updated the terminal dependency behaviour
   criterion in `design-task-state-model-contract.md` to state that duplicate
   does not satisfy a dependency, with a dated annotation citing the owner
   ruling.

2. **Test comment fixed** — The `StageDuplicate` row in
   `TestComputeAvailability_TerminalDependencyMatrix` previously said "without
   a persisted canonical replacement" and scoped the behaviour to "v1". Updated
   to reflect that this is intended permanent behaviour, not a version-scoped
   limitation.

3. **Dedicated test added** — `TestDuplicateDoesNotSatisfyDependency` in
   `entstore_test.go` creates a blocker and a blocked task, closes the blocker
   as duplicate, and asserts the blocked task remains blocked with
   `BLOCKED_BY_DEPENDENCY`. This test will go red if anyone changes
   `terminalStageSatisfiesDependency` to return true for `StageDuplicate`.

## Verification

`go test ./internal/store/...` — all tests pass.

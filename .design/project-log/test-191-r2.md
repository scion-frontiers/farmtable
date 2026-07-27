# test-191-r2 — independent test re-review of the terminal-predicate round-2 fixes

Reviewer: test engineer, independent of the developer and of the round-1 reviewer's conclusions.
Subject: `terminal-predicate-r2` @ `d7314cf`, three commits on top of `d5db8c4`.

Verdict: **APPROVE**. Both round-1 findings closed with mutation evidence. Two new Low
coverage-erosion findings, neither blocking.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-191-r2.md`.

## Round-1 findings

| Finding | Status |
|---|---|
| F1 — `treewalk.go` fifth hand-copy, un-consolidated and untested | **CLOSED** |
| F2 — `ClaimTask` assertion vacuous w.r.t. the terminal predicate | **CLOSED** |
| F3 — frontend `isReady` shares the masking shape | Open, correctly out of scope (`web/` untouched) |
| F4 — one test excluded by a `-run Terminal` filter | Open, cosmetic |

## What the re-review added beyond the developer's own evidence

**The consolidation is genuine, not cosmetic.** A call to `store.IsTerminalStage` proves nothing on
its own if the caller does not actually depend on the result. Neither round 1 nor the developer ran
the mutation that settles it: dropping `StageCancelled` from the shared predicate now fails in five
places across two packages, including `TestComputeReady_TerminalParentIsNotReady/cancelled`. Before
round 2 the tree walk was silent under that mutation. One predicate, five sites, all bound.

**F2's fix is right for a subtle reason worth recording.** The `ClaimTask` assertion still does not
exercise the terminal predicate — hardwire `IsTerminalStage` to false and it still passes. What
changed is that it no longer claims to. It pins `ErrAlreadyClosed`, which is real behaviour (guard
ordering: `PhaseClosed` runs before `computeAvailability`), and the comment states that the terminal
arm is defence-in-depth on the claim path. Verified load-bearing by changing which error the guard
returns. Diagnosing the unreachability and documenting it beat papering over it.

**Two mutation attempts were discarded as invalid.** The literal edits to `treewalk.go` orphan the
new `internal/store` import, so the package fails to compile. A build error is not a test kill.
Re-run in a form keeping the call site referenced. The developer independently hit and reported the
same trap; both of us discarded it rather than banking the kill.

## Self-built oracle check (standing defect class)

Clean in both new test files. Expectations are hardcoded literals; `store.IsTerminalStage` appears
only as the subject of an assertion, never to derive a `want`.

Recorded because the obvious future tidy-up is a trap: deriving `terminalStages` from
`store.IsTerminalStage` would be the defect class *and* would destroy real coverage. If the
predicate broke for a stage, the driver list would shrink to match and the availability tests would
silently stop covering it. **The hardcoding is load-bearing — do not "simplify" it.**

## New findings

- **N1 (Low, undisclosed).** The `terminalStages` driver var can lose a stage with no test failing
  anywhere in the store package. It drives the EntStore and MultiStore availability tests, so
  coverage erodes silently — including on the masked MultiStore path where only an exact-reason
  assertion catches regressions. Fix by cross-checking it against the `ClassifiesEveryStage` table's
  `want: true` rows, *not* by deriving it from the predicate.
- **N2 (Low, disclosed by the developer, independently confirmed).** The new exhaustiveness guard is
  blind to a stage added to the proto enum without updating `convert.StageFromProto`, whose
  `default: return task.StageTriage` maps it to an already-classified stage. Nothing in the repo
  guards `StageFromProto` exhaustiveness. Inherited from the `transitions_internal_test.go` idiom
  this mirrors, so both copies share it. The guard does work for a complete data-model addition,
  which is the realistic case.
- **N3 (Info).** The `TestWatchTasks_*` timeouts are pre-existing. Three cleared-cache full-suite
  runs on each of branch and base failed 2/3 on both, same tests, same 5.01s deadline. The
  developer's analysis is accurate; it needs its own ticket.
- **N4 (Info).** `allStages` is duplicated across two test packages. Acceptable given Go's
  cross-package helper constraints, but fixing N2 means fixing both copies.

## Verification

`go build ./...` exit 0. `gofmt -l` clean on all four touched files. `-count=2 -race` green across
store, github and server. `go vet` reports four findings, all pre-existing and identical on base
`d5db8c4`. Working tree clean before and after every mutation; no probe artefacts left behind.
Integration tests not run (no live Postgres); the predicate is pure Go over an in-memory field with
no dialect surface.

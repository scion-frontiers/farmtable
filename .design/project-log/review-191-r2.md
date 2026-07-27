# review-191-r2 — round-2 re-review of the terminal-stage predicate

Independent re-review of `terminal-predicate-r2` @ `d7314cf` (3 commits on top of
round-1 HEAD `d5db8c4`). Same reviewer as round 1. Full report:
`scratchpad/projects/farmtable/reports/review-191-r2.md`.

**Verdict: APPROVE.** Both round-1 Important findings are genuinely closed and were
verified by re-running pre-registered mutations rather than by reading the dev's
transcript. Two new Medium findings, both non-blocking, neither affecting behaviour.

## Round-1 findings

| Finding | Status |
|---|---|
| `treewalk.go` fifth hand-copy, never enumerated | **closed** |
| `TestIsTerminalStage_ClassifiesEveryStage` not exhaustive | **closed** |
| Doc overclaim "single source of truth for the terminal arm" | **closed** |
| Move `IsTerminalStage` to `store.go` | not closed (suggestion, not tasked) |
| Disambiguate from `terminalStageSatisfiesDependency` | not closed |
| Named consumer roster will go stale | partially closed — and it went stale in-PR |

Round 1 pre-registered mutation **M8** (delete a row from the classification table)
as the acceptance test for the exhaustiveness finding, recording that it SURVIVED at
`d5db8c4` and had to flip. **At `d7314cf` M8 is KILLED.** M1–M7 unchanged. M11 and
M12 re-run independently against the consolidated tree walk: both KILLED, where M11
survived the whole `internal/platform/github` suite in round 1.

Pre-registering the acceptance criterion at round 1 turned the re-review into an
objective before/after rather than a second opinion. Worth repeating on invariant
work.

## What round 2 established about the claim path

Chasing a comment added in `3bef89c` turned up a three-layer picture that was not
previously written down anywhere. A terminal task is blocked from being claimed by
three independent mechanisms in `EntStore.ClaimTask`:

| Layer | Location | Fires when |
|---|---|---|
| 1. `PhaseClosed` guard | `entstore.go:1197` → `ErrAlreadyClosed` | task was closed via `CloseTask` |
| 2. availability terminal arm | `entstore.go:1201` → `ErrUnavailable` | terminal stage, phase still open |
| 3. CAS `StageEQ(accepted)` + `n==0` recheck | `entstore.go:1221`, `:1263` → `ErrUnavailable` | always |

Layer 2 is **reachable**, contrary to the new comment's claim that it is not:
`UpdateTask` (`entstore.go:807-830`) sets `Phase` and `Stage` from independent
pointers with no coupling, so a terminal stage with an open phase is representable at
the store layer, and claiming it returns `ErrUnavailable` from the terminal arm. The
gRPC `UpdateTask` RPC does couple them via `phaseForStage` (`server.go:543`), so the
state is not reachable through the API — but the comment is a store-level claim.

Layer 2 is nonetheless never load-bearing here, because layer 3 blocks independently.
That is why **no claim-path assertion for the terminal arm can be made non-vacuous** —
verified by writing the obvious strengthening and watching it pass with
`IsTerminalStage` hardwired to false. This vindicates the decision to pin
`ErrAlreadyClosed` and document the situation rather than chase a stronger assertion.

The accurate framing is "reachable, but never load-bearing on the claim path", not
"unreachable".

## Residual gap in the new exhaustiveness guard

`allStages` derives stages via `convert.StageFromProto`, which has
`default: return task.StageTriage`. A new stage added to proto and ent but missed in
`StageFromProto` therefore never appears in `allStages`, the coverage loop stays
silent, and `IsTerminalStage` returns false for it — the original failure mode in a
narrower form. Inherited from the `transitions_internal_test.go` pattern this was
modelled on, so both copies have it.

Closed by asserting the proto→stage mapping is injective: a fallthrough to the default
produces a duplicate. Verified passing today (injective over 10 stages) and firing on a
simulated proto-only addition.

## Pre-existing flake, verified not ours

`TestWatchTasks_*` timeouts under full-suite load were checked against a worktree at
base `d5db8c4`: **failed 3/3 full-suite runs** there. Unrelated to this change; the
only file touched outside the store/github test paths is a doc comment. Deflaking the
5s streaming deadline belongs in a separate issue.

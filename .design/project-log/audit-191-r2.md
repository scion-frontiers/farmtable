# audit-191-r2 — independent security re-review of the terminal predicate

Branch `terminal-predicate-r2` @ `d7314cf`, three commits on top of r1 head `d5db8c4`.
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-191-r2.md`.

## Verdict: APPROVE

No new findings above Low. Both round-1 findings that were in scope are closed. The two
round-1 HIGH findings remain open and are correctly deferred.

## The question that mattered

Availability gates claiming, so the predicate is authorization-adjacent. The question was
whether the consolidated `IsTerminalStage` can be made to report a terminal task as available,
or an available task as terminal.

Answered by mutation rather than by inspection. `IsTerminalStage` was hardwired in both
directions and the affected packages run each time (repo restored and verified clean after
each):

| Mutation | Result |
|---|---|
| `return false` — terminal reported available | Killed at all 5 availability sites + the predicate test |
| `return true` — available reported terminal | Killed at all 5 sites + 8 further tests |

The security-relevant delta from round 1: `treewalk.go` **survived** the `return false`
mutation in round 1 and now kills it. That site backs `GetReadyTasks`, so it was the one
un-consolidated, untested copy of the rule on a user-facing queue.

## What was verified

- `entstore.go` change is comment-only — no executable line altered.
- `treewalk.go:105` consolidation is semantics-preserving (identical stage set); new
  `internal/store` import introduces no cycle.
- The r2 `ErrAlreadyClosed` correction is accurate: `ClaimTask`'s `PhaseClosed` guard
  (`entstore.go:1199`) runs before `computeAvailability` (`:1202`), and `CloseTask` sets
  `PhaseClosed`. **This corrects an imprecision in the round-1 audit report**, which had said
  the terminal arm gates the claim path without noting the phase guard pre-empts it.
- The terminal arm is still load-bearing, though: it catches any terminal-stage/non-closed-phase
  desync. All known desync paths are closed today (`server.go:542`, `export_import.go:657`
  both derive phase from stage), but `EntStore.UpdateTask` sets phase and stage independently,
  so a future direct store caller could desync them. Keeping the arm is correct.
- `gofmt` clean on all touched files; `go build ./...` clean.

## New findings (all Low)

- **R2-L1** — the new proto-derived exhaustiveness guard has a silent-fallback hole:
  `StageFromProto` ends in `default: return task.StageTriage`, so a proto stage with no `case`
  maps to an already-classified stage and the guard stays quiet. The helper's
  `task.StageValidator` check cannot catch this, since `triage` is always valid. Narrower than
  the round-1 issue — it fires correctly for a full data-model addition — and **the developer
  found and disclosed it independently**, in both their report and this log. Recorded only
  because a complete fix is three lines: assert the proto name round-trips
  (`"TASK_STAGE_" + strings.ToUpper(string(stage)) == name`). Validated against all ten real
  stages, zero mismatches, and it fires for a simulated unmapped value.
- **R2-L2** — `computeReady`'s `includeUnblocked` branch checks only the terminal arm: unlike the
  accepted branch above it, it does not exclude triage or held tasks. Pre-existing, but the new
  `TestComputeReady_NonTerminalParentIsReady` now pins triage-as-ready. Diverges from
  `EntStore.GetReadyTasks`, which under the same flag relaxes only `BlockedByDependency`
  (`entstore.go:2553`). Low: the flag is opt-in, off by default, and labels its output
  "candidate for ready". The test comment should say this is current behaviour being pinned,
  not desired behaviour.
- **R2-L3** — `allStages` is now byte-identical in `internal/store/terminal_availability_test.go`
  and `internal/server/transitions_internal_test.go`. A helper that exists to stop a stage list
  from drifting is itself a duplicated stage list. Move it to `internal/testutil`.

## Round-1 findings, per-item status

| # | Finding | Status |
|---|---|---|
| HIGH-1 | GitHub label overrides closed state, forges `available=true` | Open — deferred, documented |
| HIGH-2 | `CloseTask` leaves stale stage label ⇒ closed tasks report available | Open — deferred, documented |
| MEDIUM-1 | Fifth un-consolidated copy in `treewalk.go` | **Closed** |
| MEDIUM-2 | Pass-through `ClaimTask` non-atomic / fails open | Open — deferred |
| MEDIUM-3 | Hardcoded `ft:` prefix in hold check | Open — deferred |
| MEDIUM-4 | Advertised availability ≠ enforced availability | Open — deferred |
| LOW-1 | `..._ClassifiesEveryStage` did not cover every stage | **Closed**, residual R2-L1 |
| LOW-2 | `noComputeStore` fragile if `ComputeAvailability` joins `Store` | Open — not in the deferral list |
| LOW-3 | Reopen leaves `ClosedAt` set | Open — not in the deferral list |

Deferring the HIGHs was the right call: they are label-vs-truth defects in the pass-through's
trust model, a different failure class from one rule hand-copied five times, and fixing them
inside a behaviour-preserving PR would have cost the reviewability of both. **They must still be
filed before the Phase 2 client ships**, since that client trusts server availability absolutely
and HIGH-2 fires on the ordinary claim-then-close path.

## Note on test flakiness

`internal/server` flakes non-deterministically on this commit (`TestWatchTasks_NoInitial`,
`_UpdatedEvent`, `_ClosedEvent`, and a separate-looking `TestListUsers` "total = 3, want 2"),
then passes on an immediate re-run of the same commit. Not caused by this diff — it contains
zero `internal/server` files. Slightly more prevalent than the dev report's table records: it
reproduces running just the three affected packages, not only the full suite. Worth its own
issue; a flaky gate erodes trust in exactly the signal these new tests provide.

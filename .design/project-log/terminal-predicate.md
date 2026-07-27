# terminal-predicate — issue #191

Pin and consolidate the terminal-stage availability rule.

Branch `terminal-predicate`, based on `origin/main` @ `7a0f220`. Deliberately a
small standalone PR against live Phase 1 backend code; no Phase 2 branch merged
in, no web/frontend files touched.

## Why this existed

The contract requires server-computed availability to exclude terminal tasks,
and Phase 2's web client was ruled to trust it absolutely (issue #189). The
invariant was load-bearing for two phases, **untested**, and hand-copied across
four implementations.

It looked covered three separate times and was not:

- `TestComputeAvailability_ReasonsAndTerminalDependencies` — four-case table
  (`triage`, `held`, `future`, `dependency`). No terminal case.
- `TestComputeAvailability_TerminalDependencyMatrix` — tests whether a terminal
  *blocker* satisfies a *dependency*. A different property entirely.
- `web/src/utils/task-ready.test.ts` (main's head commit, "Harden fallback
  availability tests") — hardened the *frontend* fallback, one layer away.

"Terminal" in the first two names refers to dependency semantics. Naming and
adjacency manufactured the appearance of coverage. That is the whole reason the
mutation evidence below matters more than usual here.

## What changed

`isTerminalStage` → exported `store.IsTerminalStage`, with a doc comment stating
what it is *not*, and consolidated onto the four availability sites only.

| Site | Concept | Action |
|---|---|---|
| `entstore.go:1075` | canonical availability predicate | **exported** |
| `entstore.go:1279` `CloseTask` | valid *close target* stage | left alone |
| `multistore.go:247` | availability (fallback) | **consolidated, see below** |
| `convert.go:61` `phaseForStage` | stage→phase projection | left alone |
| `convert.go:127` `basicAvailabilityForTask` | availability | **consolidated** |
| `passthrough.go:618` | availability | **consolidated** |
| `treewalk.go:103` `computeReady` | availability ("still live enough to surface as ready") | **consolidated in round 2** |
| `labels.go:422` `phaseForStage` | stage→phase projection | left alone |
| `export_import.go:656`, `:901` | enumerate all ten stages | left alone |

The four left-alone sites merely share the same four stages *today*. Coupling
them to the availability predicate would invent a dependency that does not
exist: "valid close stage" and "stage→phase projection" are free to diverge from
"terminal for availability" and should be.

### treewalk.go — the fifth copy, found in round 2

The round-1 scope analysis missed it, and all three reviewers flagged it. It is
consolidated, and the reasoning is worth recording because it is the one site
where the LEAVE/CONSOLIDATE call was not obvious.

It asks *the same question* as availability — "is this work still live enough to
surface as ready" — and merely packages the answer as a `readyResult` instead of
an `AvailabilityReason`. Packaging is not concept. That is what separates it
from the genuine LEAVE sites (`CloseTask`'s close-target validation,
`phaseForStage`), which differ in what question they answer, not in how they
return it.

`treewalk.go` needed a new `internal/store` import. Go imports are per-file, so
the package already depending on `store` via `passthrough.go` was not enough.
No cycle: same package, existing dependency.

**The consolidation was the less important half.** This site had *zero*
coverage — round 1's mutation M11 (`isTerminal := false`) left the entire
`internal/platform/github` suite passing. Consolidating an untested line only
moves it. `TestComputeReady_*` now pins both directions, and M11 is killed.

### multistore.go — both local quirks preserved

That site was never a plain copy of the rule. Two things are unique to it and
both survive byte-for-byte in behaviour:

1. **The `PhaseClosed` arm.** It treats `Phase == PhaseClosed` as terminal even
   when the stage is not. Written as
   `IsTerminalStage(t.Stage) || t.Phase == task.PhaseClosed` — *not* a bare
   `IsTerminalStage`, which would have silently dropped it.
2. **The stricter `Available` conjunction.**
   `len(reasons) == 0 && t.Phase == task.PhaseOpen && t.Stage == task.StageAccepted`
   makes this implementation strictly stricter than the other three. Untouched.

Both are now pinned by dedicated tests
(`..._ClosedPhaseIsTerminal`, `..._RequiresOpenAccepted`) so neither can be
refactored away silently later.

## Coverage added

Four honest tests, one per implementation, named so they cannot be confused with
the two dependency-semantics tests ("OwnTerminalStage", not "Terminal"):

- `internal/store/terminal_availability_test.go` — EntStore canonical (via real
  `CloseTask` + `ClaimTask` rejection), MultiStore fallback, plus
  `IsTerminalStage` classifying all ten stages.
- `internal/server/terminal_availability_test.go` — `basicAvailabilityForTask`.
- `internal/platform/github/terminal_availability_test.go` — pass-through store.
- `internal/platform/github/treewalk_test.go` (round 2) — `computeReady`, both
  directions of the predicate plus the accepted branch, which is excluded from
  the `includeUnblocked` arm because it is handled earlier, *not* because it is
  terminal.

The MultiStore fallback branch is reached with `struct{ store.Store }`, which
promotes every `Store` method *without* supplying `ComputeAvailability`, so
MultiStore's type assertion fails and its own code runs.

Assertions require terminal to be the **sole** reason, not merely present. This
matters: see mutation 2.

## Mutation evidence

Six mutations, each applied alone and reverted. All kill.

| # | Mutation | Killed by |
|---|---|---|
| 1 | entstore terminal arm → `if false` | `..._OwnTerminalStageBlocksClaim` (all 4 stages), `available = true, want false` |
| 2 | multistore terminal-*stage* arm dropped | `..._OwnTerminalStageBlocksClaim`, `reasons = [], want exactly [terminal]` |
| 3 | convert terminal arm → `if false` | `TestBasicAvailabilityForTask_...`, `available = true` |
| 4 | passthrough terminal arm → `if false` | `TestPassThroughComputeAvailability_...`, `available = true` |
| 5 | multistore → bare `IsTerminalStage` (the trap) | `..._ClosedPhaseIsTerminal` |
| 6 | multistore stricter conjunction dropped | `..._RequiresOpenAccepted` |

Mutation 1 shows the actual production hazard directly: with the terminal arm
broken a completed task reports `Available: true`.

**Mutation 2 is the one worth remembering.** Dropping multistore's terminal arm
left `Available` *already* false, because the stricter open+accepted conjunction
masked it. Only the exact-reason assertion caught the regression. An assertion
of `Available == false` alone would have passed against broken code — the same
failure mode as the tests this issue exists to fix.

Mutation 5 is the trap called out in the brief: replacing the condition with a
bare `IsTerminalStage` drops the `PhaseClosed` arm and changes live behaviour.

### Round 2 mutations

| # | Mutation | Result |
|---|---|---|
| 11 | `treewalk.go` predicate → `isTerminal := false` | **KILLED** by `..._TerminalParentIsNotReady`, all 4 stages (survived in round 1) |
| 12 | `treewalk.go` predicate → always terminal | **KILLED** by `..._NonTerminalParentIsReady`, all 5 stages |
| 13 | simulated new data-model stage `archived` | **KILLED** by the new exhaustiveness guard |
| 14 | `ClaimTask`'s `PhaseClosed` guard removed | **KILLED** — `err = task unavailable, want ErrAlreadyClosed` |
| 15 | `IsTerminalStage` → `return false` | **KILLED** by the `ComputeAvailability` assertion, *not* by the `ClaimTask` one |

Mutation 12 exists because 11 alone would be satisfied by "return no results".

**Mutation 15 is round 2's mutation 2.** It kills at the `ComputeAvailability`
assertion and leaves the `ClaimTask` assertion passing. That is the direct proof
that `ClaimTask` never reaches the terminal arm — the guard ordering means
`ErrAlreadyClosed` fires first — and it is why that assertion now pins a
specific error instead of `err != nil`. Mutation 14 confirms the ordering from
the other side: remove the `PhaseClosed` guard and the terminal arm does run,
returning `ErrUnavailable`.

Mutation 13 was applied by genuinely adding a stage to the ent enum, its
validator, and `StageFromProto`, then reverting. Worth noting *why* the cheap
version does not work: adding a value to the proto enum alone falls through
`StageFromProto`'s `default` to `triage`, which is already classified, so the
guard would not fire. It defends against a full data-model addition, which is
the case that matters.

## Verification

- `go build ./...` — exit 0.
- `go test ./...` — exit 0, testcache cleared, all 10 packages ok.
- `gofmt -l` clean on all seven touched files.
- Behaviour-preserving: the four new tests were written and passing **before**
  the consolidation, then re-run green after. The refactor changed no behaviour.

## Not done, and why

- **Two pre-existing HIGH defects in the GitHub pass-through path.** Found by
  round 2's security audit, both real, both outside this diff, neither blocking
  it. Deliberately left for separate issues rather than widening a small,
  behaviour-preserving PR:
  - **HIGH-1, `labels.go:374-384`.** For a closed issue, labels are consulted
    before real GitHub state, so an `accepted` label forges `available=true`
    with an empty reason list.
  - **HIGH-2, `passthrough.go:579-606`.** `CloseTask` never swaps stage labels,
    unlike `UpdateTask:348` and `ClaimTask:548`. A claimed-then-closed task
    keeps `ft:stage/working` and reports available on the ordinary happy path.

  Both are label-vs-truth defects: the pass-through trusts labels over GitHub
  state. That is a different failure mode from this PR's, which was one rule
  hand-copied five times. Fixing them here would mean changing pass-through
  behaviour in a PR whose entire claim is that it changes none.
- **Also deferred:** MEDIUM-2 (`ClaimTask` non-atomic / fails open), MEDIUM-3
  (hardcoded `ft:` prefix), MEDIUM-4 (advertised ≠ enforced availability).
- **`phaseForStage` is duplicated** across `internal/server/convert.go:61` and
  `internal/platform/github/labels.go:422`. **Confirmed behaviourally
  identical**: both map the four closed stages → `PhaseClosed`, the four
  in-flight stages → `PhaseInProgress`, everything else (including `triage`,
  `accepted`, and unknown) → `PhaseOpen`. `convert.go` lists triage/accepted
  explicitly where `labels.go` lets them fall to the default; same result for
  all ten stages and for unrecognised input. Out of scope per the brief — fixing
  it would widen a deliberately small PR touching live Phase 1 code. Same defect
  class as frontend issue #190. Left for the EM to file.
- **`CloseTask`'s stage validation not consolidated.** It answers "is this a
  valid close target", which is a different question that happens to have the
  same answer today. Binding it to the availability predicate would mean a
  future change to one silently changes the other.
- **`export_import.go:656`/`:901` untouched.** They enumerate all ten stages for
  validation; not this rule.
- **No frontend change.** The Phase 2 client's trust in server-computed
  availability (#189) is now backed by real tests, but nothing in `web/` was
  touched.
- **Integration tests not run.** `go test ./... -tags integration` needs a live
  Postgres; not available in this workspace. Nothing here is dialect-specific —
  the predicate is pure Go over an in-memory struct field.

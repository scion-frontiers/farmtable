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
| `labels.go:422` `phaseForStage` | stage→phase projection | left alone |
| `export_import.go:656`, `:901` | enumerate all ten stages | left alone |

The four left-alone sites merely share the same four stages *today*. Coupling
them to the availability predicate would invent a dependency that does not
exist: "valid close stage" and "stage→phase projection" are free to diverge from
"terminal for availability" and should be.

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

## Verification

- `go build ./...` — exit 0.
- `go test ./...` — exit 0, testcache cleared, all 10 packages ok.
- `gofmt -l` clean on all seven touched files.
- Behaviour-preserving: the four new tests were written and passing **before**
  the consolidation, then re-run green after. The refactor changed no behaviour.

## Not done, and why

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

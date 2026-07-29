# Code Review — Issue #191, `terminal-predicate` @ d5db8c4

**Reviewer:** independent code review (parallel with security audit + test review; no coordination)
**Base:** `git diff origin/main...HEAD`, merge-base `7a0f220` — real single-commit diff, 8 files, +482/-7
**Scope reviewed:** the delta only.

---

## Review Summary

**Verdict: APPROVE** — with two Important recommendations for a follow-up cleanup pass. No Critical issues.

**Overview:** The consolidation is genuinely behaviour-preserving at all four availability sites, not merely test-passing — I verified this by reading and by an independent 7-mutation battery, all killed. The two Important findings are about *completeness of the invariant's protection*, not about the change being wrong: a fifth hand-copy of the same four stages exists in `treewalk.go` and was never enumerated in the scope analysis, and the new `TestIsTerminalStage_ClassifiesEveryStage` does not actually verify exhaustiveness despite its name — while a proto-derived exhaustiveness pattern already exists in this repo and would.

---

## 1. Behaviour preservation — VERIFIED EXACT

I treated this as the primary question, since the change touches live Phase 1 production code.

| Site | Before → After | Verdict |
|---|---|---|
| `entstore.go:1085` | `isTerminalStage` → `IsTerminalStage` | rename only; body byte-identical |
| `entstore.go:1103` | `isTerminalStage(t.Stage)` → `IsTerminalStage(...)` | identical |
| `server/convert.go:126` | 4-case `switch` → `if store.IsTerminalStage(t.Stage)` | identical |
| `github/passthrough.go:617` | 4-case `switch` → `if store.IsTerminalStage(t.Stage)` | identical |
| `store/multistore.go:250` | see below | identical |

**`multistore.go:250` — the subtle one. Both quirks survive.**

```go
// before
if t.Phase == task.PhaseClosed || t.Stage == task.StageCompleted || ... || t.Stage == task.StageCancelled {
// after
if IsTerminalStage(t.Stage) || t.Phase == task.PhaseClosed {
```

The `PhaseClosed` arm survives. The operands are reordered, but every operand is a
pure comparison on an already-dereferenced `*ent.Task` — no side effects, no
short-circuit-dependent nil deref — so `||` reordering is semantically free. The
truth table is unchanged.

`multistore.go:259`'s stricter `Available` conjunction
(`&& t.Phase == PhaseOpen && t.Stage == StageAccepted`) is untouched, confirmed
by direct read.

**Consolidation is complete for the availability concept.** `grep` for
`AvailabilityReasonTerminal` returns exactly four emission sites
(`entstore.go:1104`, `multistore.go:251`, `server/convert.go:127`,
`passthrough.go:618`) and all four now route through `IsTerminalStage`. No
site was missed, and no stale `isTerminalStage` reference remains.

**Independent mutation battery (mine, not the dev's) — 7/7 killed:**

| # | Mutation | Killed by |
|---|---|---|
| M1 | drop `\|\| t.Phase == PhaseClosed` from `multistore.go:250` | `..._ClosedPhaseIsTerminal` (`terminal_availability_test.go:118`) |
| M2 | drop `&& PhaseOpen && StageAccepted` from `multistore.go:259` | `..._RequiresOpenAccepted` (3 subtests) |
| M3 | `IsTerminalStage` drops `StageCancelled` | `..._ClassifiesEveryStage/cancelled` + `..._OwnTerminalStageBlocksClaim/cancelled` |
| M4 | `IsTerminalStage` always false | `..._ClassifiesEveryStage` |
| M5 | passthrough terminal arm never fires | `TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim` |
| M6 | server `basicAvailabilityForTask` terminal arm never fires | `TestBasicAvailabilityForTask_OwnTerminalStageBlocksClaim` |
| M7 | `IsTerminalStage` always true | `TestClaimTask`, `TestComputeAvailability_*` |

M1 and M2 killing confirms something worth stating explicitly: the
`noComputeStore` helper really does drive execution into the MultiStore
fallback branch. Those two mutations live *only* in that branch, so their
death is positive proof the branch is exercised — not just an assumption from
reading the helper. I separately confirmed the mechanism is sound: `Store`
(`internal/store/store.go`) does **not** declare `ComputeAvailability`, so
embedding the interface promotes no such method and MultiStore's type
assertion fails as the comment claims.

Build: exit 0. `go vet ./...`: 4 findings, all in `internal/server/server.go`
(protobuf lock-copy), all pre-existing and untouched by this diff. Targeted
tests for all three affected packages: pass. Working tree clean after my
mutations were reverted.

---

## 2. Scope discipline — mostly correct, one unenumerated site

**Your LEAVE calls were all correct.** I checked each and agree:

- `entstore.go:1289` (`CloseTask`) — "valid close *target*" is an input-validation
  whitelist, not a claimability predicate. Free to diverge (e.g. if `duplicate`
  ever became settable only via a merge flow). Correctly left.
- `server/convert.go:67` and `github/labels.go:425` (`phaseForStage`) — a
  stage→phase projection. Coupling it to availability would be a category error.
  Correctly left.
- `server/export_import.go:656`, `:901` — ten-stage validity enumerations, the
  *superset*, not the terminal subset. Not the same concept at all. Correctly left.
- `server/transitions.go:27` (`stagesTerminal`) — not in your table, but this one
  is fine: it's a transition→scope authorization group, already exhaustiveness-
  guarded by `TestStageGroupsPartitionAllStages`. Correctly left (see Suggestion 2
  for a doc nit arising from it).

### Important 1 — `internal/platform/github/treewalk.go:104` is a fifth hand-copy that was never enumerated

```go
if includeUnblocked && !hasOpenChildren && node.Stage != task.StageAccepted {
    isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
        node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
    if !isTerminal && len(node.Children) > 0 {
        results = append(results, readyResult{Node: node, Reason: "all sub-issues closed (candidate for ready)"})
    }
}
```

This is not in the nine-row table in `.design/project-log/terminal-predicate.md`,
so it looks like a gap in enumeration rather than a considered LEAVE. It matters
more than the other unswept sites because:

- It is the same four stages, hand-copied, **in the same package** that this PR
  already converted (`passthrough.go`), with the `store` import already present.
- The local variable is literally named `isTerminal` — the same name as the
  helper this PR just exported.
- It guards the same *intent*: "do not surface terminal work as ready."
  `computeReady` feeds `passthrough.go:778`, i.e. the GitHub ready-listing path
  that agents consume.
- It carries exactly the drift risk this PR exists to eliminate: add a terminal
  stage tomorrow and this site silently keeps surfacing it as a ready candidate.

I do not think this is a blocker — one can argue the tree-walk heuristic is a
distinct concept from the availability contract, and it emits a `readyResult`
rather than an `AvailabilityReason`. But that argument should be made explicitly
rather than by omission.

**Suggested fix** (safe, same package, import already present):

```go
if includeUnblocked && !hasOpenChildren && node.Stage != task.StageAccepted {
    if !store.IsTerminalStage(node.Stage) && len(node.Children) > 0 {
        results = append(results, readyResult{...})
    }
}
```

If you prefer to leave it, add a one-line comment at `treewalk.go:104` saying
why, and add the row to the design-log table so the next reader does not have to
re-derive the decision.

---

## 3. `store.IsTerminalStage` as cross-package API

**Name: good.** `IsTerminalStage` is the right name — predicate-shaped, reads
correctly at all four call sites, and `store.IsTerminalStage` is unambiguous
from outside the package.

### Important 2 — `TestIsTerminalStage_ClassifiesEveryStage` does not verify what its name claims

`internal/store/terminal_availability_test.go:25` hardcodes a 10-row table.
`IsTerminalStage` uses `switch ... default: return false`. Combined, these mean:
**adding a new stage to the data model produces a silently-claimable stage and
this test still passes.** The test name asserts exhaustiveness that nothing
structurally enforces.

This is the one finding that goes to the PR's own premise. The design log's
best argument is that this invariant "looked covered three separate times and
was not" — that naming and adjacency manufactured the appearance of coverage.
`ClassifiesEveryStage` is the same failure mode one level up: a name that
promises total coverage over a list that is only as total as whoever last
edited it. Given Phase 2 was just ruled to trust server availability with **no
client-side defensive check**, a new stage defaulting to claimable is precisely
the unguarded path.

**This repo already solved this.** `internal/server/transitions_internal_test.go:13`
has `allStages(t)`, derived from the proto enum, with the comment "so a stage
added to the data model shows up here without touching this test" — and
`TestStageGroupsPartitionAllStages` uses it to guard `transitions.go`'s
`stagesTerminal` group. The result is an asymmetry worth naming: **add
`StageArchived` today and `TestStageGroupsPartitionAllStages` fails while
`TestIsTerminalStage_ClassifiesEveryStage` passes.** The weaker guard is the one
protecting the load-bearing invariant.

**Suggested fix.** `terminal_availability_test.go` is already `package
store_test` (external), so it can import `pb` and `internal/convert` directly.
I verified there is no import cycle (`go list -deps internal/convert` does not
include `internal/store`) and that this compiles and passes from
`internal/store`:

```go
// Derived from the proto enum so a stage added to the data model shows up here
// without touching this test. Mirrors allStages in
// internal/server/transitions_internal_test.go.
func allStages(t *testing.T) []task.Stage {
	t.Helper()
	var stages []task.Stage
	for value, name := range pb.TaskStage_name {
		if name == pb.TaskStage_TASK_STAGE_UNSPECIFIED.String() {
			continue
		}
		stage := convert.StageFromProto(pb.TaskStage(value))
		if err := task.StageValidator(stage); err != nil {
			t.Fatalf("proto stage %s does not map to a valid task stage: %v", name, err)
		}
		stages = append(stages, stage)
	}
	return stages
}
```

Then close the loop in `TestIsTerminalStage_ClassifiesEveryStage`, after the
existing table loop:

```go
// The table above must classify every stage in the data model. IsTerminalStage
// returns false by default, so a stage missing here would be silently claimable
// — the exact failure this predicate exists to prevent.
covered := make(map[task.Stage]bool, len(tests))
for _, tt := range tests {
	covered[tt.stage] = true
}
for _, stage := range allStages(t) {
	if !covered[stage] {
		t.Errorf("stage %q is not classified by this test; add it to the table "+
			"and confirm IsTerminalStage treats it correctly", stage)
	}
}
```

This is additive, needs no production change, and makes the test's name true.

### Suggestion 1 — placement: `entstore.go` is the wrong file now

`IsTerminalStage` sits at `entstore.go:1085`, inside a ~1300-line file dedicated
to the `EntStore` implementation. It is no longer EntStore-specific: it is
package-level shared vocabulary consumed by `internal/server` and
`internal/platform/github`. `internal/store/store.go` already holds exactly this
kind of thing — `AvailabilityReason`, `TaskAvailability`, `HasReason`, the
`Store` interface. Moving the function (and its doc comment) there costs one
cut-and-paste and makes it discoverable next to the reason constants it feeds.

Non-blocking, and a pure move — but worth doing while the context is fresh,
because the current location invites the next reader to assume it is an EntStore
internal.

### Suggestion 2 — two small inaccuracies in the doc comment

`entstore.go:1075-1084`. The comment is a genuinely good idea and mostly well
executed, but:

**(a) "single source of truth for the terminal arm of availability ... (EntStore,
MultiStore's fallback, ...)" is not quite true for MultiStore.** MultiStore's
terminal arm is `IsTerminalStage(t.Stage) || t.Phase == task.PhaseClosed` — the
predicate is one of two disjuncts there, not the whole rule. A reader who trusts
the doc literally could conclude the `PhaseClosed` arm is redundant and delete
it, which is the precise regression this PR is guarding against. Suggest:

> ...shared by every availability implementation. Note that MultiStore's
> fallback ORs this with a `PhaseClosed` check; it is the only site where the
> terminal arm is broader than this predicate.

**(b) It disambiguates from the two distant concepts but not the adjacent one.**
The comment warns against confusion with `CloseTask`'s close-target check and
`phaseForStage` — both in other files — while
`terminalStageSatisfiesDependency` sits fourteen lines above it at
`entstore.go:1071`, shares the word "terminal", and means something completely
different (only `StageCompleted` satisfies a dependency). That is the collision
a reader will actually hit. The new tests handle this well in their own comments;
the production doc should too. Worth one clause, plus optionally a nod to
`transitions.go`'s `stagesTerminal`.

**(c) Minor:** enumerating the four consumers by name will go stale. Consider
"every availability implementation" without the parenthetical roster, or accept
the maintenance cost knowingly.

---

## What's Done Well

- **`multistore.go:247-249` is the highest-value line in the diff.** The comment
  names the trap ("Do not reduce this to a bare `IsTerminalStage` call") *and*
  the change pairs it with `..._ClosedPhaseIsTerminal`, so the warning is
  enforced rather than merely stated. I mutated exactly that arm and the test
  caught it with a precise message. Comment-plus-test on a footgun is the right
  pattern and it was applied to the one place that needed it.
- **Pinning `..._RequiresOpenAccepted` was not asked for by the bug and is the
  best judgement call in the PR.** The stricter `Available` conjunction is
  untouched by this diff, so nothing forced its coverage — but it is the other
  thing a future "let's unify these four implementations" refactor would
  flatten. Its assertion that unavailable cases must have *empty* reasons is
  well-designed: it proves the conjunction is doing the work, not a reason.
- **Test naming discipline.** `OwnTerminalStage...` versus the pre-existing
  `...TerminalDependencyMatrix` directly addresses the root cause the design log
  identifies — that adjacency and naming manufactured a false appearance of
  coverage. The header comments on `terminalStages` and each test reinforce it.
  This is the kind of fix that prevents the *next* instance of the bug.
- **`assertTerminalUnavailable` requires terminal to be the *sole* reason**, so a
  broken terminal arm cannot be masked by an incidental second reason. Easy to
  get wrong; got right in all three packages.
- **`noComputeStore`** is a neat, minimal way to force the fallback branch, and
  the comment explains the interface-embedding mechanism rather than leaving it
  as folklore.
- **`.design/project-log/terminal-predicate.md`** is exemplary — the nine-row
  site table with an explicit action per row makes scope discipline auditable
  instead of trusting the diff. It is the reason I could confirm `treewalk.go`
  was an omission rather than a decision.

---

## Verification Story

- **Tests reviewed:** yes. They test the right property (the task's *own* stage),
  at the right layer (all four implementations independently, not just the
  canonical one), with sole-reason assertions. The MultiStore fallback is
  provably exercised. Gap: exhaustiveness (Important 2).
- **Build verified:** yes — `go build ./...` exit 0.
- **Tests run:** yes — `internal/store`, `internal/server`,
  `internal/platform/github` all pass.
- **Independent mutation testing:** yes — 7 mutations of my own design across all
  four sites and both MultiStore quirks; 7/7 killed, each by the intended test.
- **Static analysis:** `go vet ./...` clean for all touched files; the 4 findings
  are pre-existing in untouched `server.go`.
- **Security checked:** yes. No new attack surface — no new inputs, no I/O, no
  concurrency, no credentials, no allocations in a hot path. One export
  broadening `internal/store`'s API, within an already-internal module. The
  security-relevant question here is availability-invariant integrity, and that
  is covered under Important 2.
- **Behaviour preservation:** verified by read *and* by mutation, at all four
  sites. This is the objective the PR set for itself and it is met.

---

## Addendum — finding 2 demonstrated empirically (M8)

Added after the initial report, while preparing for the agreed re-review pass.

The mutation battery is now saved as a reusable script at
`review-191-mutations.sh` (run from the repo root; it applies each mutation,
runs the relevant package tests, restores the file, and asserts the expected
KILLED/SURVIVED result). Anchors are checked for uniqueness, so a mutation whose
anchor has drifted reports SKIPPED rather than silently passing.

It carries one new mutation, **M8**, which mutates the *test* rather than
production code: it deletes the `{task.StageCancelled, true}` row from the
classification table in `terminal_availability_test.go`, simulating a stage the
table never gained.

**Result at `d5db8c4`: M8 SURVIVED.** The full suite for `internal/store` still
reports `ok` with a terminal stage missing from the table.

This converts finding 2 from an argument into a measurement. The claim was that
`TestIsTerminalStage_ClassifiesEveryStage` cannot detect a stage missing from its
own table; M8 shows it does not. Note that `StageCancelled` remains covered
elsewhere via the `terminalStages` var, so M8 isolates precisely the gap in
question — the *classification table's* exhaustiveness — rather than terminal
coverage generally.

M8 is pre-registered as the acceptance test for finding 2: **once the
proto-derived coverage assertion lands, M8 must flip to KILLED.** If it still
survives, the fix is not doing its job. The script encodes this expectation, so
the re-review is a single command with a before/after that cannot be fudged.

Full battery at `d5db8c4`: M1–M7 KILLED, M8 SURVIVED, 0 unexpected results.

---

## Recommendations for the follow-up pass

Neither blocks merge. In priority order:

1. `treewalk.go:104` — consolidate onto `store.IsTerminalStage`, or add an
   explicit LEAVE comment plus a design-log row.
2. `terminal_availability_test.go:25` — add the proto-derived exhaustiveness
   assertion (verified to compile and pass from `internal/store`).
3. Move `IsTerminalStage` from `entstore.go` to `store.go`.
4. Doc-comment fixes (a), (b), (c) on `entstore.go:1075`.

# test-194-r7 — independent TEST REVIEW of #194 round 7 (combined)

**Tree** `/workspace` · **branch** `label-write-scope-r7` · **HEAD**
`1d4442f1982b6e03233f1517106d0c369af1afe6` · base `6ced24e`

Ancestry verified in this tree: `6ced24e`, `cc953e4`, `4df2d1e`, `15b7247` are
all ancestors of HEAD; `633f8f2` is not. Surface excluding `.design/`
independently measured: **16 files, +1185 / −117** — matches the brief exactly.

Prediction file: `test-194-r7-predictions.md`, written before the corresponding
measurements (three sections, each timestamped by ordering: base predictions
before batch 1, addendum before batch 2, batch-3 section before batch 3).

---

## VERDICT

**Round 7's new tests are overwhelmingly live, and leg B's four repairs are
verified to have worked.** 20 of 23 scored mutations landed exactly on the
predicted count, including the two headline replications (M5 = 29, M6 = 2).
This is not a tree full of inert tests.

**Two real gaps found, both of the "guard nobody guards" shape the brief
pointed at, and neither is a re-find of §1's known instance:**

- **F-1 (High).** `writeLabelSwap`'s **error propagation — the only behaviour
  the round-7 refactor actually introduced — is unpinned repo-wide.** Swallowing
  both of its error returns leaves `go test ./...` GREEN, exit 0, 0 failures.
- **F-2 (Medium).** `RestrictLabelWriteToSnapshot` **stopping case-folding is
  unpinned**, because the one test covering case variants absorbs the
  divergence into a `t.Logf`, not a failure.

Both are fixed by the test file I wrote and committed (additive, test-only).

### Gates

| gate | result |
|---|---|
| `make web` | 0 |
| `go build ./...` | 0 |
| `go test ./...` | 0, zero `FAIL` lines |
| `make race` | 0 |
| `go vet ./...` | exits **1** on **exactly 4** pre-existing `copylocks` in `internal/server/server.go` (lines 1737, 1847, 2055, 2232) — brief confirmed, not mine to fix |

All four re-run GREEN after adding my test file. The `WatchTasks` flake did
appear — twice across 9 full-suite runs (`TestWatchTasks_CreatedEvent` under
M2w, `TestWatchTasks_Heartbeat` under M10). Re-ran `TestWatchTasks` 3× on a
clean tree: **green 3/3**. Treated as the known flake and excluded from every
count below, as instructed.

---

## Mutation table — predicted vs actual

Every mutation content-addressed; every anchor verified unique before use;
every revert verified with `git diff --quiet`, not by trusting the write.
Harness aborts on absent anchor, non-unique anchor, or RED baseline.

| id | mutation | scope | predicted | **actual** | ✓ |
|---|---|---|---|---|---|
| M1 | `writeLabelSwap`: `add,remove = nil,nil` | github | RED 3 | **RED 3** | ✓ |
| M2 | `writeLabelSwap`: `remove = nil` | github | GREEN 0 | **GREEN 0** | ✓ |
| M2w | same, widened | `./...` | RED 10, all `internal/server` | **RED 10** (+1 flake) all `internal/server` | ✓ |
| M3 | `writeLabelSwap`: `add = nil` | github | RED 3, same 3 | **RED 3, same 3** | ✓ |
| **M4** | **both error returns swallowed** | `./...` | **GREEN 0** | **GREEN 0** | ✓ **F-1** |
| M5 | `authorizationStage` → `("",false)` | github | RED **29** | **RED 29** | ✓ |
| M5r | …restricted to `resolver_test.go` | github | **1 of 3** | **1 of 3** | ✓ |
| M6 | A-4 control reverted (server call site) | `./...` | RED **exactly 2**, both named | **RED 2, exactly those** | ✓ |
| M7 | M-2 guard disabled | `./...` | RED 1, named | **RED 1, that one** | ✓ |
| M8 | M-1 reverted (resolver passes `nil`) | `./...` | RED 1, named | **RED 1, that one** | ✓ |
| M9 | github `RestrictLabelWriteToSnapshot` inert | `./...` | RED 2, same two | **RED 2, same two** | ✓ |
| M10 | pkg-level helper never dispatches | `./...` | RED 2 | **RED 2** (+1 flake) | ✓ |
| M11 | `MultiStore` helper never dispatches | `./...` | RED 2 | **RED 2** | ✓ |
| **M14** | **`RestrictLabelWriteToSnapshot` stops folding case** | `./...` | **GREEN 0** | **GREEN 0** | ✓ **F-2** |
| MSWEEP | `labelNamesToIDs` → `nil` (every label write dead) | github | RED 8–11 | **RED 7** | ✗ over by 1 |
| C1 | delete `cancelled` row from `ownershipTruthTable` | github | RED, row-count pin | **RED, row-count pin** | ✓ |
| C2 | …and set `wantOwnershipRows = 9` | github | RED, `allStages` check naming `cancelled` | **RED, exactly that message** | ✓ |
| M4bis | both returns swallowed, **new tests present** | github | RED 2, named | **RED 2, those** | ✓ |
| M4a | remove-side return swallowed | github | RED 2 | **RED 2** | ✓ |
| M4b | add-side return swallowed | github | RED 1 | **RED 1** | ✓ |
| M2bis | `remove = nil`, **new tests present** | github | RED **1** | **RED 3** | ✗ under by 2 |
| M1bis | whole component dead, new tests present | github | RED 3+ | **RED 6** | ✓ |

**20 / 23 exact. Two misses, disclosed:**

- **MSWEEP predicted 8–11, actual 7.** I over-counted the CloseTask
  positive-assertion set; the per-stage close rows I expected to be separate
  top-level tests are subtests of tests already in the list.
- **M2bis predicted 1, actual 3.** My own `requireSwapErrorSurfaces` helper's
  `attempts == 0` guard fired in the two error-reporting tests: with `remove =
  nil` no removal mutation is issued, so the helper correctly refuses to
  conclude anything. The extra 2 REDs are a fail-closed harness guard working,
  not accidental coverage. I did not anticipate my own guard.

### Notable confirmations

- **M5 = 29 exactly.** Derived statically as 27 (dev leg's round-6 number) + 1
  for leg B's rewritten `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader`
  + 1 for the new `TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore`.
  The ownership test **is** in the RED list. **Leg B's T-F2 fix is verified: the
  test that "could not fail" now fails.** Same for T-F5 — M10/M11 show both
  `RestrictLabelWriteToSnapshot` dispatch arms are pinned.
- **C1/C2: `requireOwnershipTableIsTotal` is a genuine guard, NOT a "guard
  nobody guards".** I went looking for exactly the shape the brief predicted and
  it is not there. Both capability probes fire, and C2 produces the intended
  diagnostic naming `cancelled`. Neutering it in a green suite is a tautology —
  every assertion survives neutering in a green suite — so I probed capability
  instead, which is the only question that distinguishes a guard from decoration.

---

## §3 — can leg A's and leg B's new tests fail?

### §3a — `authz_label_write_scope_test.go` (+342): how many lines notice A-4's revert?

**Exactly two top-level tests, ≈120 of the 344 added lines.**

- `TestUpdateTask_FreeRemovalCannotDestroyALabelTheGateNeverSaw` — RED
- `TestUpdateTask_FreeAdditionCannotRestoreALabelTheGateNeverSaw` — RED

Breakdown of the +344: ≈120 lines are the two A-4 tests (sensitive); ≈60 lines
are the `interleave` mock machinery, which is infrastructure *for* those two and
has no independent assertions; ≈160 lines are `newNativeTaskFixture` plus the
M-2 test, insensitive to A-4 and sensitive to M-2 instead (M7 → RED 1).

**This is the right answer, not a shortfall.** A-4 is one control and it has two
directions; two tests for two directions, each with a differential and a harness
self-check, is proportionate. The `interleaves()` counter is doing real work —
it is what stops the tests passing when the second actor never runs.

### §3b — `resolver_test.go` (+187): is "exactly one of three" right?

**Yes, and the other two are pinning real things.**

- `TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore` — the only
  one sensitive to `authorizationStage` (M5), because it is the only one that
  constructs a label. It is also the **only** test in the repo that catches M-1
  (M8 → RED 1).
- `TestNewPlatformResolver_DeclinesNonGitHubPlatforms` and
  `..._RejectsAMalformedRemoteID` pin the two pre-existing fall-through arms —
  the platform check and `ParseOwnerRepo`. Insensitivity to `authorizationStage`
  is correct: they never build a label. They are guarding the signature change
  from disturbing arms it had no business touching, which is a legitimate and
  cheap regression pin.

So "one of three" is not a coverage complaint. Nothing to do here.

---

## §1 sweep — the bypass shape, swept across the package

**Instrument.** `labelNamesToIDs → return nil` (MSWEEP). This kills *every*
label write in the package, including `CloseTask`'s inline swap — which is
important, because **`CloseTask` does not route through `writeLabelSwap`** and
is therefore structurally invisible to any `writeLabelSwap` mutation. A sweep
built only on M1 would have mis-classified six CloseTask tests as suspicious.

**Scope.** All 168 top-level tests in `internal/platform/github`, narrowed to the
13 that both drive a store write and assert on label state.

**Result: one new instance, plus two "immune for the right reason" and four
"not instances".**

| test | GREEN under MSWEEP? | classification |
|---|---|---|
| `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` | GREEN | the **known** instance (§1), not re-found |
| **`TestPassThroughCloseTask_LabelWriteFailureStillCloses`** | **GREEN** | **NEW INSTANCE — see F-3** |
| `TestPassThroughCloseTask_LabelIndexFailureStillCloses` | GREEN | immune for the right reason: asserts `addCalls==0 && removeCalls==0`, observing the component directly |
| `TestPassThroughCloseTask_CloseFailureTouchesNoLabel` | GREEN | same — asserts the counters |
| `TestPassThroughClaimTask_ClosedIssueIsNotClaimable` | GREEN | not an instance: outcome observed via `errors.Is(err, ErrUnavailable)`; the label check is a redundant belt-and-braces |
| `TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable` | GREEN | same |
| `TestSingularSinksAreBlindToTheTerminalTiebreak` | GREEN | not an instance: its `hasLabel` use is a *fixture-integrity* check ("fixture lost %q"); its outcomes are the ClaimTask refusal and `ComputeAvailability`, both directly observed |
| 6 others | RED | positive "the label landed" assertions — live |

### F-3 (Low, pre-existing, not round 7) — `TestPassThroughCloseTask_LabelWriteFailureStillCloses`

Sets `failLabelWrites = true`, then asserts the stale label survived. It never
asserts that a label mutation was **attempted**. Under MSWEEP — zero label
mutations issued — it stays GREEN. So "the write was attempted and rejected" is
indistinguishable from "no write was ever attempted", which makes it
indistinguishable from its own sibling `LabelIndexFailureStillCloses`, whose
whole reason for existing is that it is the *other* case.

Its sibling gets this right: it asserts `addCalls == 0 && removeCalls == 0`.
This one should symmetrically assert the opposite.

**Fix (one line, exactly parallel to §1's known instance):**

```go
if fake.removeCalls == 0 {
    t.Fatal("no label mutation was attempted, so failLabelWrites never ran and " +
        "this row is indistinguishable from LabelIndexFailureStillCloses")
}
```

The fake increments `removeCalls` **before** consulting `failLabelWrites`
(`close_label_swap_test.go:223-224`), so the counter is available. **I did not
apply this** — it is a pre-existing test outside round 7's surface and the
developer should decide. Reproduce with: apply MSWEEP, run
`go test ./internal/platform/github/ -run TestPassThroughCloseTask_LabelWriteFailureStillCloses`
→ exit 0.

---

## §2 — the `writeLabelSwap` locality question, answered

**The brief asked: is coverage-two-packages-away acceptable, or should
`internal/platform/github` pin its own helper? Answer: pin it — but the
locality observation is not the important part, and following it is what led me
to F-1.**

I replicated the dev leg's numbers exactly (M2 = 0 in-package, M2w = 10 in
`internal/server`, M3 = 3, M1 = 3). The locality claim is correct and it is
correctly *not* a hole: the removal path **is** pinned.

But asking "which behaviour of this helper is pinned *anywhere*" rather than
"where does the pin live" turns up something the locality frame hides:

### F-1 (High) — `writeLabelSwap`'s error propagation is unpinned repo-wide

`writeLabelSwap`'s own doc comment states its purpose: it "applies a label swap
to an issue and **REPORTS its failures**", replacing ten sites that discarded
the error into `_`. That error reporting **is the entire behavioural change of
the round-7 refactor.** Everything else — which labels get written, in which
order — is unchanged from round 6.

**Measured (M4):** swallowing both error returns, while still performing the
writes, leaves `go test ./...` at **exit 0, zero failures**. Also GREEN
individually (M4a, M4b — measured after the fix, by re-running against the new
tests; before the fix both were GREEN).

**Root cause, and it is structural rather than an oversight:**

1. `failLabelWrites` — the fake's only knob that makes a label mutation fail —
   is set at exactly **4 sites, all in `close_label_swap_test.go`, all driving
   `CloseTask`**.
2. `CloseTask` does **not** use `writeLabelSwap`. It kept its own inline swap
   that swallows errors *on purpose*, because the close already succeeded.
3. So the one path exercised with a failing label write is the one path
   contractually required to ignore it, and the two paths that must report it —
   `UpdateTask`, `ClaimTask` — were never driven with a failing write at all.
4. `internal/server` cannot cover it either: its httptest mock always answers
   `addLabelsToLabelable` / `removeLabelsFromLabelable` with success.

**Impact.** A regression re-introducing `_ =` at any of the six
`writeLabelSwap` call sites ships silently. The consequence is the one the
helper's own comment describes: `UpdateTask` returns the issue as though the
swap landed, and the event its callers publish describes a state GitHub was
never put into. On `ClaimTask` it is worse — the claim is recorded while
`ft:stage/working` never reached the issue, leaving it claimable by the next
agent.

### Recommended tests — written, and proven capable of failing

Committed as **`internal/platform/github/write_label_swap_test.go`** (new file,
**additive, test-only, no production code touched**). Three top-level tests:

| test | closes |
|---|---|
| `TestWriteLabelSwap_UpdateTaskReportsALabelWriteFailure` (`remove_half`, `add_half`, positive control) | F-1, UpdateTask path, both arms separately |
| `TestWriteLabelSwap_ClaimTaskReportsALabelWriteFailure` (+ positive control) | F-1, ClaimTask path |
| `TestWriteLabelSwap_RemovalHalfIsPinnedInThisPackage` | §2 locality — the remove half, in-package |

**Proven capable of RED, not merely green:**

| mutation | before the new file | after |
|---|---|---|
| both error returns swallowed | GREEN 0 | **RED 2** |
| remove-side return swallowed | GREEN 0 | **RED 2** |
| add-side return swallowed | GREEN 0 | **RED 1** |
| `remove = nil` (in-package) | GREEN 0 | **RED 3** |
| whole component dead | RED 3 | **RED 6** |

Each error-reporting test carries a positive control (same call, write allowed →
must succeed *and* stamp the label) and an attempt-count guard that fails closed
when no mutation was issued.

---

## F-2 (Medium) — a case-folding regression in `RestrictLabelWriteToSnapshot` is absorbed by a `t.Logf`

`RestrictLabelWriteToSnapshot`'s comment is explicit that case-folding is
load-bearing and shared with `applyLabelDelta`:

> "The two must agree on when two names are the same label… so both go through
> `labelMatchKey`, and neither uses exact string equality.
> `remove_labels=["FT:Stage/Wont_Fix"]` **does** strip `ft:stage/wont_fix`…"

**Measured (M14):** changing the query side of both loops from
`labelMatchKey(l)` to raw `l` — i.e. the write side stops folding case, while
`present` stays keyed by `labelMatchKey` — leaves `go test ./...` at **exit 0,
zero failures**.

**Why nothing catches it.** The only case-variant coverage is
`TestUpdateTask_RemovingATerminalLabelIsDeniedWhateverTheCase`. Its probe
removes with `task:accept` and computes `reaches`; when the removal no longer
lands it takes the `if !reaches` branch, which is a
`t.Logf("OVER-PREDICTION (fail-closed): …")` — a log line, not a failure. That
branch was written for a real and deliberate divergence (`applyLabelDelta` trims
surrounding whitespace, `labelNamesToIDs` does not), and it is correct that the
whitespace row logs rather than fails. But it also swallows the
`strings.ToUpper` and `strings.ToTitle` rows, which are exactly the case-folding
property the comment says is load-bearing.

**Direction of the defect is fail-closed** (a legitimate removal silently
becomes a no-op rather than an unauthorized write landing), which is why this is
Medium and not High. It is still a silent, unpinned behaviour change to a
control this workstream spent a round building.

**Recommendation (not written — it belongs in the server package's fixture,
outside my additive test-only remit, and the developer may prefer to fix it by
splitting the whitespace row out instead).** Split the three spellings: assert
`reaches == true` for `ToUpper`/`ToTitle` rather than logging, and keep the
`t.Logf` for the whitespace-padded spelling only, where the divergence is real.
Reproduce with M14 + `go test ./...` → exit 0.

---

## What I could NOT verify

- **`cmd/farmtable-server/main.go`'s `log.Fatalf` on invalid GitHub config
  (M-1's server half) has no test and I did not write one.** M8 only covers the
  resolver's `cfg` threading. The `main()` decision to fail fast rather than
  fall back to defaults — the part the comment argues hardest for — is
  unexercised. Testing it needs `main()` refactored to a testable seam; that is
  a production change and out of my remit. **Flagging as a recommendation, not a
  finding.**
- **Integration tests.** `go test ./... -tags integration` needs a live
  Postgres; not available. Not run.
- **`TestPassThroughCloseTask_BestEffortFailuresAreLogged`** went RED under
  MSWEEP; I did not investigate whether its logging assertions are themselves
  well-formed. Out of budget, low value.
- **The 6 non-github packages' tests** were only ever run as part of `./...`
  totals; I did not sweep them for the bypass shape. The §1 sweep was scoped to
  `internal/platform/github` as the brief framed it.
- **`SameStageSet` stage-collapse and the 12-cell custom-prefix write matrix**
  are r8 known-open; I deliberately did not probe them.

## Void runs — disclosed in full

**None.** No harness run was voided. Specifically:

- No run had a RED baseline — the harness aborts on one and never did.
- No anchor was absent or non-unique at apply time — all 14 were verified unique
  in a separate pass *before* the prediction file was written, and re-verified
  at apply time.
- No mutation failed to revert — `git diff --quiet` was asserted after every
  single mutation, and `git status --porcelain` is clean of production changes.
- Zero mutations produced a build error (which the harness would have flagged as
  `BUILD_ERROR`).

The two prediction misses (MSWEEP, M2bis) are **wrong predictions against sound
measurements**, not void runs. Both are explained above.

---

## WHERE THIS BRIEF IS WRONG

**1. §4's anchor hazard is real but mis-stated, and the stated mitigation is
aimed at the wrong string.**

The brief says leg A's `RestrictLabelWriteToSnapshot` "has the same
`x, ok := ...; if !ok { return ... }` shape as `LabelDeltaLifecycleStages`" and
that "a content anchor that was unique on the pre-merge tree is not unique
here." **Measured in this tree:** the natural anchor for that arm —

```
	if !ok {
		return addLabels, removeLabels
	}
```

— is **UNIQUE** in `internal/store/store.go`. It does not collide with
`LabelDeltaLifecycleStages`, whose arm returns `current, current, nil`, nor with
`LifecycleStages`, whose arm returns `[]task.Stage{...}, nil`. The three
`if !ok {` *headers* collide (3 occurrences), but the return bodies are all
distinct, so any anchor including one line of the body is already safe.

The brief's advised mitigation — "anchor on the full body including
`current := []task.Stage{LifecycleStage(ctx, s, t)}`" — is advice for anchoring
on **`LabelDeltaLifecycleStages`**, which is not the function §4 warns is newly
ambiguous. Following it literally would not have helped anyone mutating
`RestrictLabelWriteToSnapshot`. The *general* rule ("abort if your anchor is not
unique") is right and I enforced it; the specific collision claim is not
reproducible here.

**2. §2's "10 failures" is 10 real + 1 flake, and the brief's flake rate is
understated.** M2w produced 11 REDs; the 11th was `TestWatchTasks_CreatedEvent`.
The brief cites the `WatchTasks` flake at ~0.06%. I saw it in **2 of 9**
full-suite runs (~22%) under mutation load. It is still a flake — 3/3 green on
re-run — but a reviewer budgeting against 0.06% will mis-read it as a finding
when it lands mid-batch, which is what happened to me twice before I checked.
Worth re-measuring the rate.

**3. The brief's central hypothesis is right this round, but its specific target
is wrong.** §"A warning about the hypothesis" directs me to hunt "the assertion
that everything else depends on and nothing checks," and last round that was a
function guarding eleven fixture tables. The natural candidate here is
`requireOwnershipTableIsTotal`, which gates all 20 cells of the rewritten
ownership test. **I probed it (C1, C2) and it is sound** — both capability
probes fire, with the intended diagnostic. The guard-with-no-guard *shape* was
present, but it was in production code, not test scaffolding: F-1, an error path
that ten call sites were refactored to use and that nothing anywhere exercises.

**4. Minor.** §1 says a one-line `if fake.removeCalls == 0 { t.Fatal(...) }`
closes the known vacuous test. Correct — and the same one-liner closes F-3, a
second instance eleven lines away in a sibling file, which the brief implies the
sweep might not find. It did.

---

## Recommendations (for the manager to route; I have not acted on these)

| # | severity | item | owner |
|---|---|---|---|
| F-1 | **High** | `writeLabelSwap` error propagation unpinned — **closed by my committed test file**; developer should review | dev |
| F-2 | Medium | case-folding regression in `RestrictLabelWriteToSnapshot` absorbed by `t.Logf`; split the three spellings | dev |
| F-3 | Low | `TestPassThroughCloseTask_LabelWriteFailureStillCloses` — add the `removeCalls == 0` guard (pre-existing) | dev |
| §1 known | Low | the known vacuous `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` — one-line fix, still open | dev |
| — | Low | `cmd/farmtable-server` `log.Fatalf` on invalid config has no test; needs a testable seam | dev / r8 |
| — | — | re-measure the `WatchTasks` flake rate; 0.06% is understated | EM |

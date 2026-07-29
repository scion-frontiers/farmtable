# Independent Test Review — #191 "Pin and consolidate terminal-stage availability rule"

**Reviewer:** test engineer (independent; no coordination with code-review or security-audit)
**Workspace:** `/workspace` (the briefed path `/workspace/farmtable-test-191` does not exist — see Note 0)
**Branch / commit:** `terminal-predicate` @ `d5db8c4`
**Base diff:** `git diff origin/main...HEAD` (merge-base `7a0f220`, origin = local path `/workspace/farmtable`)
**Date:** 2026-07-27

---

## Verdict

**The new tests are real. This is not a fourth convincing-looking layer.**

Every assertion that matters is load-bearing. I applied **11 independent mutations** to production
code — I did not take the dev's 6 on trust, and I added 5 the dev did not run. **All 10 mutations
within the diff's scope were killed.** The one that survived (M11) is in code the diff does not
touch, and it is the most useful finding in this report.

Critically, I independently reproduced the vacuity hazard the EM flagged, and then found a
**second, undisclosed instance of the same hazard inside the new tests themselves** (F2) — an
assertion that passes with the terminal predicate entirely disabled.

Recommendation: **approve and merge**, with F1 filed as a follow-up and F2 fixed or removed in this
PR (one line; it is currently misleading rather than wrong).

---

## Confirming the premise

Both premises in the brief check out, verified against the actual tree rather than the narrative:

| Claim | Verification | Result |
|---|---|---|
| `store.AvailabilityReasonTerminal` asserted nowhere before this change | `git grep -n "AvailabilityReasonTerminal" origin/main -- "*_test.go"` | **zero matches** — confirmed |
| The two "Terminal"-named tests concern dependencies, not own-stage | read `TestComputeAvailability_ReasonsAndTerminalDependencies`, `..._TerminalDependencyMatrix` | confirmed; both assert blocker→dependency satisfaction |

The gap was genuine. The invariant did look covered three ways and was covered zero ways.

---

## Mutation testing — my own runs

Harness: apply exactly one mutation, run targeted tests, `git checkout` to revert. Working tree
verified clean before and after (`git status --short` empty).

| # | Target | Mutation | Result | Killed by |
|---|---|---|---|---|
| M1 | `entstore.go` `computeAvailability` | drop terminal arm | **KILLED** | `..._OwnTerminalStageBlocksClaim` — `available = true` |
| M2 | `multistore.go` fallback | drop `IsTerminalStage` arm | **KILLED** | `reasons = [], want exactly [terminal]` — *masked; boolean would not catch* |
| M3 | `multistore.go` fallback | drop `PhaseClosed` arm | **KILLED** | `..._ClosedPhaseIsTerminal` — *also masked* |
| M4 | `multistore.go` | drop `open && accepted` conjunction | **KILLED** | `..._RequiresOpenAccepted` |
| M5 | `server/convert.go` | drop terminal arm | **KILLED** | `TestBasicAvailabilityForTask_...` — `available = true` |
| M6 | `github/passthrough.go` | drop terminal arm | **KILLED** | `TestPassThroughComputeAvailability_...` |
| M7 | `IsTerminalStage` | silently drop `StageCancelled` | **KILLED in all 4 impls** | every `cancelled` subtest |
| M8 | `IsTerminalStage` | always `true` | **KILLED** | negative-side tests across 3 packages |
| M9 | `IsTerminalStage` | always `false` | **KILLED** | all 4 impls |
| M12 | `IsTerminalStage` always `true`, MultiStore tests only | **KILLED** | `..._RequiresOpenAccepted` |
| **M11** | **`github/treewalk.go:104`** | **`isTerminal := false`** | **SURVIVED** | **nothing — see F1** |

M7, M8, M9, M11, M12 are mutations the dev did not report. M7 is the most valuable addition: it
proves per-stage coverage rather than merely "some terminal stage is handled".

### M7 — single-stage regression, killed in all four implementations

```
-	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
+	case task.StageCompleted, task.StageWontFix, task.StageDuplicate:

--- FAIL: TestIsTerminalStage_ClassifiesEveryStage/cancelled
        IsTerminalStage(cancelled) = false, want true
--- FAIL: TestComputeAvailability_OwnTerminalStageBlocksClaim/cancelled
        available = true, want false; reasons = []
--- FAIL: TestMultiStoreComputeAvailability_OwnTerminalStageBlocksClaim/cancelled
        reasons = [], want exactly [terminal]
FAIL	github.com/farmtable-io/farmtable/internal/store
--- FAIL: TestBasicAvailabilityForTask_OwnTerminalStageBlocksClaim/cancelled
        available = true, want false; reasons = []
FAIL	github.com/farmtable-io/farmtable/internal/server
--- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim/cancelled
        available = true, want false; reasons = []
FAIL	github.com/farmtable-io/farmtable/internal/platform/github
```

A one-stage omission is caught in all four layers, each naming the exact stage. This is the
strongest single piece of evidence that the coverage is real.

---

## The masking finding — independently reproduced, and it is worse than reported

The EM asked me to pressure-test the claim that a boolean-only assertion passes against broken
MultiStore code. **Confirmed.** I wrote my own naive probe (asserting only `Available == false`),
applied M2, and ran it against the broken implementation:

```
=== RUN   TestNaiveBooleanOnly_MultiStoreTerminal/completed
    observed available=false reasons=[]
=== RUN   TestNaiveBooleanOnly_MultiStoreTerminal/wont_fix
    observed available=false reasons=[]
=== RUN   TestNaiveBooleanOnly_MultiStoreTerminal/duplicate
    observed available=false reasons=[]
=== RUN   TestNaiveBooleanOnly_MultiStoreTerminal/cancelled
    observed available=false reasons=[]
--- PASS: TestNaiveBooleanOnly_MultiStoreTerminal (0.01s)
ok  	github.com/farmtable-io/farmtable/internal/store
```

A plausible-looking test **passes against a non-functioning terminal predicate**. The real test
kills the same mutation only because `assertTerminalUnavailable` requires *exactly* `[terminal]`.

### Masking audit across all four implementations

| Implementation | `Available` expression | Masked? | New test pins reason exactly? |
|---|---|---|---|
| `EntStore.computeAvailability` | `len(reasons) == 0` | No | Yes (`assertTerminalUnavailable`) |
| **`MultiStore` fallback** | `len(reasons)==0 && Phase==Open && Stage==Accepted` | **Yes — both arms** | **Yes** |
| `server.basicAvailabilityForTask` | `len(reasons) == 0` | No | Yes |
| `github` pass-through | `len(reasons) == 0` | No | Yes |

**Masking is unique to MultiStore, and it affects *two* arms, not one.** The dev's log documents
the terminal-stage arm (their mutation 2) but does not note that the **`PhaseClosed` arm is masked
by the identical mechanism**. My M3 confirms it — dropping `|| t.Phase == task.PhaseClosed` leaves
`Available` already `false` (because `Phase != PhaseOpen`), and the kill message is again
`reasons = [], want exactly [terminal]`, never `available = true`.

Both masked arms are correctly pinned by `assertTerminalUnavailable`. **No new test asserts only
the boolean on a masked path.** The one test that does assert a bare boolean
(`..._RequiresOpenAccepted`) is testing the conjunction itself, where the boolean *is* the
behaviour under test — and it additionally asserts `reasons` is empty, which is what makes M12 kill.
That is correct design, not a hollow assertion.

---

## Is the MultiStore fallback branch authentically reached?

Yes, established two independent ways:

1. **Statically** — `store.Store` (`internal/store/store.go:295`) does **not** declare
   `ComputeAvailability`. I read the full interface. So `noComputeStore{store.Store}` promotes no
   such method, the type assertion in `MultiStore.ComputeAvailability` fails, and control reaches
   the fallback. (Had the interface declared it, the embedded nil would have panicked rather than
   silently passing — so this construct fails loudly if the premise ever changes. Good.)
2. **Dynamically** — M2, M3 and M4 mutate *only* the fallback body and all three flip tests from
   pass to fail. Code that does not execute cannot change test outcomes. This is conclusive.

The `struct{ store.Store }` trick is legitimate, not a fake.

---

## Findings

### F1 — MEDIUM: a fifth terminal-stage enumeration was not consolidated, and it is untested

`internal/platform/github/treewalk.go:104` re-derives the terminal set inline:

```go
isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
    node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
```

This is readiness semantics — it gates whether a node becomes a "candidate for ready" in
`computeReady`, reached from `GetReadyTasks` via `passthrough.go:778`. It is the same invariant the
PR claims a single source of truth for, and it was left behind.

It also has **zero coverage**. Mutation M11:

```
-			isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
-				node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
+			isTerminal := false

ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.024s
RESULT: ***SURVIVED***
```

The entire `internal/platform/github` suite passes with the check destroyed.

**Why this rates Medium rather than Low.** It is pre-existing and outside the diff, so it is not a
regression. But the PR's doc comment asserts `IsTerminalStage` is "the single source of truth for
the terminal arm of availability, shared by every availability implementation", and the project log
has a careful "Not done, and why" section listing `phaseForStage`, `CloseTask`, and
`export_import.go` — **`treewalk.go` is absent from that list.** The stated invariant is therefore
slightly overclaimed, and this is precisely the drift the PR exists to prevent: add a fifth terminal
stage tomorrow, update `IsTerminalStage`, and the GitHub ready-queue silently disagrees with every
other layer.

*Recommendation:* file a follow-up to either route this through `store.IsTerminalStage` or document
it in the "Not done" list, and add a `computeReady` test covering a terminal node with children.
Do not expand this PR.

### F2 — LOW/MEDIUM: the `ClaimTask` assertion is vacuous with respect to the terminal predicate

`internal/store/terminal_availability_test.go:85-87`, the closing assertion of
`TestComputeAvailability_OwnTerminalStageBlocksClaim`:

```go
if _, err := s.ClaimTask(ctx, created.ID, uuid.New(), ""); err == nil {
    t.Fatalf("ClaimTask on %s task succeeded, want rejection", stage)
}
```

This never exercises the terminal arm. `ClaimTask` (`entstore.go:1189`) rejects on a `PhaseClosed`
guard that fires **before** `computeAvailability` is ever called:

```go
if old.Phase == task.PhaseClosed {
    _ = tx.Rollback()
    return nil, ErrAlreadyClosed      // ← returns here
}
availability, err := computeAvailability(ctx, old, tx.Task.Get)   // ← never reached
```

Since `CloseTask` sets `SetPhase(task.PhaseClosed)` (`entstore.go:1321`), the test's task is always
`PhaseClosed` by the time it claims. Probe on **unmutated** code:

```
claim error = task already closed | ErrAlreadyClosed=true ErrUnavailable=false   (× all 4 stages)
```

Proof of vacuity — I disabled the predicate entirely (`IsTerminalStage` → always `false`) and ran an
isolated reproduction of just this assertion:

```
=== M10: terminal predicate fully disabled (always false) ===
=== Running CLAIM-ONLY assertion against BROKEN code ===
--- PASS: TestProbe_ClaimOnlyAssertion/completed
--- PASS: TestProbe_ClaimOnlyAssertion/wont_fix
--- PASS: TestProbe_ClaimOnlyAssertion/duplicate
--- PASS: TestProbe_ClaimOnlyAssertion/cancelled
ok  	github.com/farmtable-io/farmtable/internal/store
```

**The assertion passes with the feature under test switched off.** The test's own name —
`OwnTerminalStageBlocksClaim` — advertises coverage this line does not provide. The test as a whole
still kills every mutation via `assertTerminalUnavailable` (which runs first and aborts the
subtest), so **no mutation escapes because of this** and severity is limited. But it is the exact
species of trap this PR exists to eliminate, reproduced inside the fix.

*Recommendation (one line):* pin what actually happens —
`if !errors.Is(err, store.ErrAlreadyClosed) { t.Fatalf(...) }` — or delete the line. Do **not**
change it to assert `ErrUnavailable`; that would fail today.

*Related observation, not a defect:* because of this guard ordering, `EntStore`'s terminal
availability arm is unreachable through `ClaimTask` in normal operation. It still matters —
`ComputeAvailability` is exposed directly for availability display and over the API — but the arm is
defence-in-depth on the claim path, not the primary gate. Worth knowing before someone "simplifies"
it away on the grounds that claims are already blocked.

### F3 — INFO: the frontend fallback shares the masking structure

`web/src/utils/task-ready.ts` `isReady()` has no explicit terminal-stage check; terminal tasks are
excluded only because `task.phase !== TaskPhase.OPEN` returns early. Same masking shape as
MultiStore, and being boolean-only it cannot pin a reason at all. Pre-existing, hardened in `7a0f220`,
untouched here, and correctly listed as out of scope. Noting only so the fifth layer is on record —
if the terminal set ever grows, this layer is the one with no way to express the distinction.

### F4 — INFO: one new test is excluded by a `-run Terminal` filter

`TestMultiStoreComputeAvailability_RequiresOpenAccepted` does not contain "Terminal", so it is
skipped by the natural `go test -run Terminal` invocation used throughout the project log. It runs
under the full suite, so there is no real gap — but since it is the sole guard for M4 and M12,
anyone spot-checking with that filter gets a misleadingly narrow picture.

---

## Answers to the specific questions asked

**Does the masking risk exist in the other three implementations?**
No. Only `MultiStore` carries the extra conjunction. `EntStore`, `server`, and `github` all compute
`Available: len(reasons) == 0`, so a dropped terminal arm flips `Available` to `true` and a boolean
assertion would suffice there — verified by M1/M5/M6, all of which kill with `available = true`.
**But MultiStore's masking affects two arms, not the one reported** (F-note above, M3).

**Does every new test pin the reason exactly?**
Yes, on every path where it matters. All four "terminal" tests assert
`len(Reasons) == 1 && Reasons[0] == AvailabilityReasonTerminal`. `assertTerminalUnavailable` in the
store package enforces terminal is the *sole* reason, which also prevents a future unrelated reason
from silently propping the test up. No hollow boolean-only assertion exists on a masked path.

**Are all four implementations genuinely covered, or only reachable ones?**
All four are genuinely reached and genuinely covered — M7 kills in all four independently. The
MultiStore fallback is authentically entered (proven statically and dynamically). Coverage is
per-stage, not per-implementation-only. The gap is that there is a **fifth** site (F1) neither
covered nor disclosed.

**Do the new test names avoid the naming trap?**
Yes, and deliberately. `OwnTerminalStageBlocksClaim` is unambiguous against the pre-existing
`TerminalDependencyMatrix` / `ReasonsAndTerminalDependencies`. The `terminalStages` var carries an
explicit comment distinguishing own-stage from blocker-satisfies-dependency, and each new file
repeats the distinction in its doc comments. This directly addresses the root cause. The only
caveat is F2: `...BlocksClaim` promises slightly more than the test delivers.

---

## Verification performed

```
go build ./...                                          exit 0
go test ./...                                           exit 0, all 10 packages ok
go test <3 pkgs> -run 'Terminal|RequiresOpenAccepted' -count=2 -race    ok (store 1.49s, server 1.36s, github 1.06s)
git status --short                                      clean, before and after all mutations
```

`-count=2 -race` confirms the new tests are order-independent, repeat-safe, and free of shared
mutable state. Each `multiStoreFallbackAvailability` call builds its own store with `t.Cleanup`.

Integration tests (`-tags integration`) not run — no live Postgres in this workspace. Not a concern:
the predicate is pure Go over an in-memory struct field with no dialect surface. I agree with the
dev's reasoning here.

All temporary probe files I created (`zz_naive_probe_test.go`, `zz_claim_probe_test.go`,
`zz_claimonly_probe_test.go`) were removed; the tree is clean at `d5db8c4`.

---

## Severity summary

| Severity | Finding |
|---|---|
| Critical | none |
| High | none |
| **Medium** | **F1** — `treewalk.go:104` un-consolidated *and* untested (mutation survived); absent from the "Not done" list while the doc comment claims completeness |
| **Low/Medium** | **F2** — `ClaimTask` assertion vacuous w.r.t. the terminal predicate; passes with the feature disabled |
| Info | F3 — frontend fallback shares the masking shape (out of scope) |
| Info | F4 — one new test excluded by `-run Terminal` |

Neither F1 nor F2 blocks the merge. F2 is a one-line fix worth taking now; F1 should be a
follow-up ticket, not scope creep into this PR.

---

## Note 0 — workspace discrepancy

The brief specified `/workspace/farmtable-test-191`, which does not exist. The repository is at
`/workspace` directly, on branch `terminal-predicate` @ `d5db8c4` with `origin` →
`/workspace/farmtable`, matching the brief in every other respect. I reviewed there. Flagging in
case a per-reviewer isolated worktree was intended and did not get created — if the code reviewer
and security auditor are operating on the same checkout concurrently, my "tree clean" assertions
cover only my own mutations, and concurrent edits by another agent during my run would not have been
distinguishable. My before/after `git status` checks were clean throughout, so I have no evidence of
interference.

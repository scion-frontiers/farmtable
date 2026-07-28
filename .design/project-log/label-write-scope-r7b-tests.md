# #194 round 7, leg B — tests that could not fail

**Branch:** `label-write-scope-r7b` · base `6ced24e` · commit `3f1be61`
**Scope:** four test files plus one comment hunk in `labels.go`. No production
logic changed anywhere in this leg.

## Why this leg existed

Round 6 shipped four assertions that pass under every possible defect. Three of
them were found by `test-194-r6` **by mutation**; two other legs read the same
code and found none of them. That is the standing lesson of this workstream and
it is now nine instances deep in one defect class:

> A check that derives from the thing it is checking cannot falsify it.

Instance #9 is the first one a **production doc comment advertised as a
guarantee** — which is worse than no guarantee, because the next maintainer
budgets against it.

## The four

### T-F2 — the self-confirming ownership test (blocking)

`TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader` computed its
expected value from `m.authorizationStage(label)` and its actual value from
`m.StageLabelSwap(...)`. Since round 6, `StageLabelSwap`'s ownership predicate
*is* a call to `authorizationStage`. The test asked a function to agree with
itself.

**Measured:** `authorizationStage` forced to `return "", false` →
**27 top-level tests in the package RED, this one GREEN, exit 0.**

The fix is a hand-written `ownershipTruthTable`: 10 stages × 2 spelled-out
string literals, with the ownership answer written down (prefixed → ours, bare →
not ours; that is B6, stated rather than asked of the code). Reader and writer
are each checked against the literal, separately. This is strictly stronger than
the comparison it replaces: divergence between the two is still caught, because
one of them must then disagree with the literal, **and** a change that moves both
together is caught — which the round-6 version could not see even in principle.

Completeness is a `Fatal` precondition checked against `allStages` in both
directions, with the row count pinned to a literal. Verified by adding a real
`archived` stage to the ent enum, `StageValidator` and `allStages`: round-6 test
**GREEN**, rewritten test **RED**, naming the missing stage.

`labels.go` claimed the old test "enumerates both spellings of every stage and
fails if the two ever diverge again". Corrected, with the M8 number recorded
inline so the next reader gets evidence instead of reassurance.

The `if checked == 0` guard could not fire either (10 literals, `checked`
reached 18). Now an exact cell-count pin.

### T-F3 — a positive control that controlled nothing

`TestLifecycleStageSetStager_EmptySideIsDetectable` asserted `len(nil) != 0` and
`0 != 0`, and on that basis licensed a 96-cell sweep. It now drives
`AllTerminalLabelStages` — which really does return `nil` on six of the sweep's
own inputs — and then requires the store to answer non-empty on the *same*
input. The sweep's green is therefore measurably *the guard working*, not the
target being unreachable. Two mutations that left the old version GREEN now turn
it RED.

**On the sweep itself: the target is unreachable by construction.** Verified by
reading `passthrough.go`, not assumed — every relevant return is a length-1
literal or a slice behind a `len(...) > 0` guard. **Kept anyway**, because
"unreachable" is maintained by three separate two-line guards that nothing in
the type system holds in place, and deleting one turns the sweep RED. What
changed is the justification: its docstring claimed to be a search, and as a
search it was finished before it ran. It now says it is a regression tripwire and
cites the mutation proving it can fire.

### T-F4 — a mis-attributed assertion

The `winnersSeen` block claimed to pin `terminalStagePrecedence`. It is written
in terms of that slice's *own* last element, so it holds under every permutation
of it. **Measured:** reversing the order leaves the whole test GREEN.

This was **not a coverage hole** and no coverage was added:
`TestTerminalLabelStage_Cardinality` spells the expected winner of each terminal
pair as a literal and goes RED under the same reversal. Three comments corrected
— the docstring, the block heading, and the file-header MUT-5 row, which
recorded three greens without noting where the mutation *is* caught. Each now
names that test, with an explicit "do not add a precedence assertion here".

Worth keeping: the file-header table was *honest* about MUT 5 being green. What
it lacked was the sentence distinguishing "these gates are order-blind" from "no
test sees this mutation". A green mutation row needs both readings closed off,
or the next comment written near it will assume the wrong one — which is exactly
what happened.

### T-F5 — comparing a thing to itself

Two call sites passed one slice header as both `before` and `after` to
`SameStageSet`. Both now check each endpoint against a literal.

They were **not equivalent**, and the brief assumed they were. The native-store
site stood alone with no literal and was genuinely unfalsifiable: mutating the
non-implementer arm to answer `[cancelled]` for both endpoints left it GREEN.
The MultiStore site paired the self-comparison with a literal check on `before`,
which made the pair load-bearing — it was already RED under the same mutation.
Tightened both; recorded the distinction in the test rather than claiming two
kills.

## Method notes worth reusing

- **Ten predictions written to a file before the first measurement. Ten
  confirmed**, including r6's exact count of 27. Predicting first is what turns
  "the mutation went red" into evidence rather than a rationalisation.
- **Positive control before any negative claim.** `StageLabelSwap` forced to
  `return nil, nil` → RED, exit 1. A harness that has never reported RED is
  worth nothing.
- **Every prerequisite is an abort**, not a warning: non-unique content anchor,
  sha256 restore mismatch, non-green baseline, and — the one that catches void
  harnesses — a mutation that fails to compile is aborted, never scored RED.
- **Exit codes read from the child process object**, never through a pipe. This
  bit us immediately and instructively: the very first `go build ./... | head`
  in this session printed `BUILD_EXIT=0` while the build was failing on the
  missing `web/dist` embed.
- **Edited by content anchor throughout.** The line ref in the source report had
  already drifted (`labels.go:369-371` → 361); the anchor was unique and the
  number never used.

## Corrections fed back to the EM

1. The brief's tree path `/workspace/farmtable-194-r7b` **does not exist**; the
   worktree is `/workspace` itself.
2. T-F3's "exercises no code from either package" is slightly overstated — it
   also called `store.IsTerminalStage` as a link check. Conclusion unaffected.
3. T-F5 was right about one of the two call sites, not both (above).
4. The T-F3 `[CLAIM]` about `passthrough.go` is **correct**, verified by reading.

## Limits

Named in full in `reports/dev-194-r7b.md`. The ones that matter for the next
leg: no integration tests (no Postgres); no measurement against `dev-194-r7a`'s
concurrent `internal/server/**` changes, so M8's 28-test blast radius needs
re-measuring after the merge; T-F2's completeness check is anchored to
`allStages` rather than to the `task.Stage` enum, so a stage added to the enum
alone would still slip through; and this was a per-item mutation run, not a
sweep — I cannot claim the tests I did not touch are falsifiable.

## Pre-existing, not mine, not fixed

- `TestWatchTasks_NoInitial` flaked once (known task #23). 5× re-run of
  `./internal/server/` clean, subsequent full `go test ./...` exit 0.
- **`go vet ./...` exits 1** on four `assignment copies lock value to ephReq`
  findings in `internal/server/server.go` (1664/1774/1982/2159). Confirmed
  pre-existing by stashing and re-running — byte-identical output. Flagged
  because it means `go vet ./...` is not currently a usable gate on this branch.

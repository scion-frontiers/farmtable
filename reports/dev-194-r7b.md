# dev-194-r7b — tests that cannot fail, and a production comment that lied

**Branch:** `label-write-scope-r7b` · **Commit:** `3f1be61` on top of `6ced24e`
**Tree:** `/workspace` (see "Corrections to the brief" #1 — the path in the brief does not exist)
**Not pushed, not merged.**

---

## Summary

All four items fixed and each verified by mutation. Ten probes, **ten
predictions written down before measuring, ten confirmed** — including r6's
exact count of 27.

The headline: T-F2's guarantee is real now. Breaking `authorizationStage`
used to leave that test GREEN while taking 27 other tests down with it. It
goes RED.

---

## Mutation table

`BEFORE` = tree at `6ced24e`, tests unmodified. `AFTER` = commit `3f1be61`.
Exit codes taken from the child process object (`subprocess.run(...).returncode`),
never through a pipe.

| # | Item | Mutation | Probe | BEFORE | AFTER |
|---|------|----------|-------|--------|-------|
| M8 | T-F2 | `authorizationStage` → always `("", false)` | `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader` | **GREEN** exit 0 | **RED** exit 1 |
| M8 | T-F2 | same | whole `./internal/platform/github/` | RED, 27 top-level | RED, **28** top-level |
| MNEW | T-F2 | add a real stage `archived` to the `task.Stage` enum, `StageValidator` and `allStages` | `…OwnershipMatchesTheAuthorizationReader` | **GREEN** exit 0 | **RED** exit 1 |
| MS1 | T-F3 | delete the `len(stages) > 0` guard from `GitHubPassThroughStore.LifecycleStages` | `TestLifecycleStageSetStager_EmptySideIsDetectable` | **GREEN** exit 0 | **RED** exit 1 |
| MS1 | T-F3 | same | `TestLifecycleStageSetStager_NeverReturnsAnEmptySide` (the 96-cell sweep) | RED | RED |
| MA1 | T-F3 | `AllTerminalLabelStages` returns `[completed]` instead of `nil` when nothing is present | `TestLifecycleStageSetStager_EmptySideIsDetectable` | **GREEN** exit 0 | **RED** exit 1 |
| M9 | T-F4 | `terminalStagePrecedence` reversed | `TestSingularSinksAreBlindToTheTerminalTiebreak` | GREEN | GREEN *(intended — see below)* |
| M9 | T-F4 | same | `TestTerminalLabelStage_Cardinality` | RED | RED |
| MCA | T-F5 | `store.LabelDeltaLifecycleStages` non-implementer arm → `[cancelled]` for **both** endpoints | `TestLifecycleStageHelpers_NonImplementerIsAnsweredNotRejected` | **GREEN** exit 0 | **RED** exit 1 |
| MCB | T-F5 | `MultiStore.LabelDeltaLifecycleStages` unrouted arm → `[cancelled]` for both endpoints | `TestMultiStore_UnroutedCollectionStillGetsTheOneElementAnswer` | RED | RED |

### Harness prerequisites, all enforced as aborts

- **Baseline GREEN** for both packages before any mutation. Abort otherwise.
- **Positive control**: `StageLabelSwap` forced to `return nil, nil` →
  `TestStageLabelSwap_DoesNotDeleteLabelsFarmTableDoesNotOwn` **RED, exit 1**.
  The harness is demonstrably capable of reporting failure before any negative
  claim is made with it.
- **Content-anchor edits only.** A non-unique or absent anchor is `sys.exit(99)`,
  not a guess. No line numbers used anywhere.
- **Restore verified by sha256** against an out-of-repo pristine copy after
  every probe; a mismatch aborts.
- **Build check**: a mutation that fails to compile aborts rather than being
  scored RED. (This is how a void harness prints confident wrong numbers.)
- Tree confirmed restored and GREEN at the end of the run.

---

## Per-item detail

### Item 1 — T-F2, the self-confirming ownership test (BLOCKING) ✅

**How EXPECTED became independent of the mapper.** A package-level
`ownershipTruthTable`: 10 rows, each a `task.Stage` plus two spelled-out string
literals (`"ft:stage/wont_fix"`, `"wont_fix"`). The expected ownership answer is
a literal `true` for the prefixed spelling and `false` for the bare one — the B6
rule, written down rather than asked of the code. `authorizationStage` is still
called, but as a *subject*, compared against the literal, alongside
`StageLabelSwap` compared against the same literal. Divergence between reader
and writer is therefore still caught (one of them must disagree with the
literal), and a change that moves **both together** — which the old test could
not see even in principle — is caught as well.

**How "add a stage without updating the table" fails.** `requireOwnershipTableIsTotal`
runs first and is `Fatal`. It checks the table's domain against `allStages` in
both directions, pins the row count at a literal 10, rejects duplicate rows,
and requires the two spellings of a row to differ. Verified for real rather than
argued: MNEW added `StageArchived` to the ent enum, to `StageValidator` and to
`allStages`. The round-6 test stayed **GREEN** (the new stage simply agreed with
itself); the rewritten test went **RED** with

> `stage "archived" is in allStages but has no row in ownershipTruthTable.`

**Baseline guard against a fictional table.** Each row asserts
`m.StageToLabel(target.stage) == target.prefixed`. That reads the *writer's*
spelling, not the predicate under test, so M8 does not spuriously trip it — but
it stops the table drifting into describing a deployment that does not exist.

**The `checked == 0` guard.** Confirmed unfireable (10 literals, `checked`
reached 18 — brief correct). Replaced with `checked != 2 * len(table)`, an exact
cell count, so a `continue` added to the loop is a failure rather than a smaller
number nobody reads. Now 20 cells: the rewrite skips no rows, because each row
swaps to the *next* row's stage instead of to one fixed target.

**`labels.go`.** Comment text only — `git diff` on that file is a pure comment
hunk, verified. The false sentence is replaced with what the test now
guarantees, and the M8 measurement is recorded inline so the next maintainer
gets the evidence, not a reassurance.

### Item 2 — T-F3, the positive control that controlled nothing ✅

Rewritten to call real code, in two parts:

1. `AllTerminalLabelStages` is driven with six label sets the sweep itself uses
   (`nil`, `{}`, `{"bug","help wanted"}`, `{"duplicate"}`,
   `{"other:stage/completed"}`, `{"ft:stage/accepted"}`) and required to return
   empty. The empty value the sweep hunts is real package output, not a Go
   language fact.
2. The **same** inputs go through `GitHubPassThroughStore.LifecycleStages`,
   which must answer `[accepted]`. So the sweep's green is measurably *the
   guard working*, not the target being unreachable in principle.

MA1 kills part 1; MS1 kills part 2. Both left the old version GREEN.

The now-unused `internal/store` import was dropped. The removed
`store.IsTerminalStage` linkage check is the one point where the brief overstates
— see corrections #2.

### Item 3 — T-F4, the mis-attributed assertion ✅

No coverage added, as instructed. The `winnersSeen` block is written entirely in
terms of `terminalStagePrecedence`'s own last element, so it is invariant under
every permutation of that slice — M9 confirmed GREEN, and **GREEN is the correct
answer for that test**, because its actual claim is that the two gates are blind
to the tiebreak. What it really pins is now stated: the pair enumeration is
total, three distinct winners were genuinely exercised, the tiebreak behaves like
a total order, and a terminal stage missing from `terminalStagePrecedence` is
caught. Three comments corrected: the docstring's false
"the winnersSeen assertion fails if that ever stops holding", the block's
"COVERAGE PIN" heading, and the file-header MUT-5 row, which recorded three
greens without noting that `TestTerminalLabelStage_Cardinality` catches the same
mutation. Each now names that test as the place the order *is* pinned, with an
explicit "do not add a precedence assertion here to fix this".

### Item 4 — T-F5, comparing a thing to itself ✅

Both call sites now check each endpoint against a literal instead of against the
other endpoint. The two sites turned out **not to be equivalent** — see
corrections #3.

---

## Corrections to the brief

**1. The tree path is wrong.** `/workspace/farmtable-194-r7b` does not exist.
The worktree on `label-write-scope-r7b` at `6ced24e` is `/workspace` itself
(`git worktree list` → `/workspace 6ced24e [label-write-scope-r7b]`). I worked
there. Worth fixing before the next brief, since a leg that created the missing
directory would have worked on the wrong tree.

**2. T-F3 [MEASURED] is slightly overstated.** The brief says the control
"exercises no code from either package". It asserted `len(nil) != 0` and
`0 != 0` as described, but it also called `store.IsTerminalStage(task.StageWontFix)`
as a link check — one line of real code from `internal/store`. The conclusion is
unaffected (a link check cannot fail in a compiled binary, and it says nothing
about the sweep's subject), but the sentence as written is not accurate.

**3. T-F5 [MEASURED] is right about one of the two call sites, not both.** Both
did pass one slice header twice. But the MultiStore site paired it with
`SameStageSet(before, []task.Stage{task.StageInReview})`, and that literal makes
the pair load-bearing: MCB was **RED before my change**. Only the native-store
site (`SameStageSet(before, after)` standing alone, no literal) was genuinely
unfalsifiable — MCA GREEN → RED. I tightened both anyway and recorded the
distinction in the test comment rather than letting the commit imply I fixed two
dead assertions.

**4. The T-F3 [CLAIM] you asked me to verify is CORRECT.** I read
`passthrough.go`. Every return on the relevant paths is either a
`[]task.Stage{...}` literal of length 1 or a slice already behind a
`len(...) > 0` guard: `LifecycleStages` (guard + `{t.Stage}`),
`LabelDeltaLifecycleStages` (nil-mapper arm returns two 1-element literals,
otherwise delegates), `lifecycleStagesForLabels` (guard + `{stage}` from
`IssueToPhaseStage`, which is total). The empty-stage-set case cannot occur.

**Keep-or-delete recommendation for the 96-cell sweep: KEEP.** Reason, with
evidence rather than taste: unreachable-by-construction is a property of three
separate two-line guards that nothing in the type system holds in place, and MS1
shows the sweep goes RED the moment one is removed. 96 cells at ~0 ms each is a
cheap tripwire on a security-relevant fail-closed path. What I changed is the
*justification*: its docstring claimed to be a search, and as a search it was
finished before it ran. It now says it is a regression tripwire and cites the
mutation that proves it can fire.

**5. `labels.go:361` is right for the anchor text in this tree.** The brief
warned the line ref had drifted from 369-371 to 361. The content anchor
`spellings of every stage and fails if the two ever diverge again` was unique;
I edited by anchor and never used the number.

---

## Verification

| check | result |
|-------|--------|
| `make web` | EXIT 0 (required — `go build ./...` fails without it, brief correct) |
| `go build ./...` | **EXIT 0** |
| `go test ./...` | **EXIT 0** |
| `gofmt -l` on both packages | clean |
| files changed | exactly the 5 owned files, `git status` verified |
| `internal/server/**`, `passthrough.go`, `resolver.go`, `cmd/**`, `label_stage_collision_test.go` | untouched |
| production logic changed | **none** — `labels.go` diff is one comment hunk |

**Two failures I did not cause and did not fix:**

- `TestWatchTasks_NoInitial` — "timed out waiting for event" — failed on the
  first full run. This is the known task #23 flake in the WatchTasks subscribe
  path. Re-ran `./internal/server/` **5×, all exit 0**; the subsequent full
  `go test ./...` was exit 0. I touched no server file. Not investigated
  further, per the brief.
- `go vet ./...` exits 1 on four pre-existing
  `assignment copies lock value to ephReq` findings in
  `internal/server/server.go` (lines 1664/1774/1982/2159). Confirmed
  pre-existing by stashing my changes and re-running: **byte-identical output**.
  Not my file and not my leg; flagging it because `go vet ./...` is not
  currently a usable gate on this branch.

---

## LIMITS — what I did not verify

1. **No integration tests run.** `go test ./... -tags integration` needs a live
   Postgres; none available. Nothing I touched is Postgres-dependent, but I did
   not run them and cannot say they pass.
2. **The r7a interaction is unmeasured.** `dev-194-r7a` is changing
   `internal/server/**` concurrently. My measurements are against `6ced24e`
   only. If r7a alters `authorizationStage`'s callers or the transition table,
   M8's 28-test blast radius will change and should be re-measured after the
   merge. I did not look at r7a's tree.
3. **T-F2's completeness check is anchored to `allStages`, not to the enum.** A
   stage added to `task.Stage` but *not* to `allStages` would not fail the test.
   I judged that acceptable — the mapper builds no lookup for such a stage, so
   it has no ownership answer to get wrong — but it is a real gap in the
   "a new stage must fail the test" guarantee and I am naming it rather than
   letting the commit message imply totality over the enum. MNEW added the stage
   to both, so my measurement does not distinguish the two cases.
4. **Mutation coverage is per-item, not exhaustive.** I ran the 10 probes above.
   I did not attempt a full mutation sweep of either package, so I cannot claim
   the tests I *did not touch* are all falsifiable. Three of the four defects in
   this brief were found by r6 doing exactly that; more likely remain.
5. **I did not re-verify r6's other claims** about these files — e.g. the MUT
   1-5 table at the head of `lifecycle_stage_consumers_test.go`. I only measured
   MUT 5 (as M9). The other four rows are inherited on trust.
6. **The `checked` = 18 figure is inherited.** I confirmed the guard could not
   fire by reading the loop (10 stages, 1 skipped, ×2 spellings = 18), and the
   rewrite makes the count explicit, but I did not run the old test verbosely to
   observe 18 printed.
7. **Item 3's fix is comments only.** No assertion changed, so "the attribution
   is now correct" is a claim about English, not something a mutation can
   confirm. The mutation evidence (M9 GREEN here, RED in `Cardinality`) supports
   the *content* of the new comments; it cannot prove they are well worded.
8. **`terminalStagePrecedence` totality.** The winnersSeen block catches a
   terminal stage missing from that slice — I argued this from the code and did
   not mutate to confirm it. `TestTerminalStagePrecedence_CoversEveryTerminalStage`
   is cited in `labels.go` as covering it; I did not verify that test either.

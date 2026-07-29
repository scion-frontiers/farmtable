# dev-194-combine-r7 — the round-7 combine, and the seam between the two legs

**Branch:** `label-write-scope-r7` · **HEAD:** `1d4442f` · **Tree:** `/workspace`
**Not pushed.** Base `6ced24e` + leg A `cc953e4` (5 commits) + leg B `4df2d1e` (2 commits).

> **Re-running `merge-verify-r7.sh` at HEAD will ABORT — expected.** The verified
> merge point is **`15b7247`**; HEAD is `1d4442f`, which adds only
> `.design/project-log/label-write-scope-r7-combine.md` on top. The script then
> sees 10 commits over base where it demands 9 and aborts on commit arithmetic,
> which is it working correctly. To reproduce the clean pass, run it with the
> tree at `15b7247`. `git diff --name-only 15b7247 HEAD -- ':!.design'` is empty:
> **no code file changed after verification.** Gates re-confirmed at HEAD:
> `go build ./...` 0, `go test ./...` 0.

---

## Headline

The merge is textually trivial and I verified it by content anyway. The real
result is Job 2, and **the prediction was exactly right at the SET level, not
just the count: M8's blast radius went 28 → 29, and the one added test is the
one I named in advance.** Nothing dropped out, which was the direction that
would have been alarming.

The Job 4 answer is a genuine finding and **my prediction there was WRONG** — in
a way whose explanation is more interesting than the prediction would have been.
Details in §4.

---

## Job 1 — the combine, verified by content

Script: `em-tooling/merge-verify-r7.sh`, adapted from the round-6
`merge-verify.sh`. Four changes from the original, all because the original
would have been unsound here:

1. the round-6 script hardcodes `R=/workspace/farmtable-194-combined`, which does
   not exist — it would have aborted at `cd`;
2. round-7 SHAs;
3. it now asserts `merge-base(legA,legB) == BASE` rather than assuming it;
4. **the positive control was strengthened.** The round-6 version picked
   `head -1` of the sorted changed-file list as its control. On this round that
   is `.design/project-log/label-write-scope-r7a-authz.md`, an *added* file, so
   `git rev-parse BASE:$file` returns `MISSING` and the control only proves the
   comparator can say "absent" — not that it can say "these two blobs differ".
   I select a `--diff-filter=M` file instead, and run the control on both legs.

### Results

| check | result |
|---|---|
| `merge-base --is-ancestor 6ced24e cc953e4` | exit 0 |
| `merge-base --is-ancestor 6ced24e 4df2d1e` | exit 0 |
| neither leg an ancestor of the other | both exit 1, as required |
| true `merge-base(legA,legB)` | `6ced24e` — identical to the briefed base |
| commit arithmetic | 5 + 2 + 2 merge commits = 9 ✓ |
| **commit SHA sets** | leg commits absent from merged history: **none**; non-merge commits from neither leg: **none** |
| changed-file sets | legA 12, legB 6, overlap **0**, union 18, merged 18 |
| union == merged, both directions | ✓ (no extra file, no dropped file) |
| **blob identity** | **18 / 18 byte-identical to owning leg, 0 mismatches** |
| **untouched-file cross-check** | **451 / 451 byte-identical to base, 0 drift** |
| **positive control (leg A side)** | `cmd/farmtable-server/main.go` merged `457cd7d7` vs base `304d754f` → **MISMATCH reported** ✓ |
| **positive control (leg B side)** | `empty_stage_set_contract_test.go` merged `d5e0b6c4` vs base `33cdc735` → **MISMATCH reported** ✓ |

Neither harness run examined 0 files. The harness aborts on a 0-file checked
count, on a `CHK != union` count, on a dirty tree, and on a failed control.
I re-ran the whole thing **after** all mutation work finished; still 18/18 and
451/451, which is how I know the mutation harness left nothing behind.

Both merges were clean, `--no-ff`, no conflicts.

---

## Job 2 — M8's blast radius, re-measured

### The prediction, written first

`em-tooling/combine-r7-artifacts/blast-radius-prediction.txt`, sha256
`bdcb736418e0de00…`, sealed 2026-07-28T06:00:57Z, a read-only copy alongside it.
Written from a static read only — no test was run on this tree before it
existed. (`make web` and the gates came after.)

**Static derivation.** `authorizationStage` has exactly three production
callers: `StageLabelSwap` (labels.go:392), `TerminalLabelStage` (labels.go:652),
`AllTerminalLabelStages` (terminal_label_stages.go:166). I read every leg A
change in `internal/platform/github` and `internal/store` for a new or removed
edge to those three and found **none**: `RestrictLabelWriteToSnapshot` matches
on `labelMatchKey` only, `writeLabelSwap` is a pure write primitive, the
`internal/store` changes are purely additive, and `LabelDeltaLifecycleStages` is
byte-unchanged in both store files.

The only new consumer is leg A's **test** file. `resolver_test.go` adds three
top-level tests; exactly one of them,
`TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore`, reaches
`authorizationStage` — via `LifecycleStages` → `AllTerminalLabelStages`. Under
M8 that returns nil for every label set, so `LifecycleStages` falls through to
`[]task.Stage{t.Stage}` = `[accepted]`; the `len(stages)==0` contract guard is
*not* tripped (len is 1), and three of the five cells fail on the terminal
assertion. The other two resolver tests never build a mapper answer.

> **Predicted: 28 + 1 = 29 top-level failures. Direction: UP by exactly one.**

### The measurement

Harness `em-tooling/combine-r7-artifacts/mutate-r7.py`. Content-addressed
anchors only, abort on a non-unique anchor, compile-check before scoring, revert
verified by sha256 against an out-of-repo pristine copy plus a `git status`
check, abort on a run that parses 0 top-level tests, exit codes from
`subprocess.run(...).returncode`.

Baseline: `internal/platform/github` 150 top-level tests, exit 0;
`internal/store` 121, exit 0.

**Harness positive control** (leg B's own): `StageLabelSwap` → `return nil, nil`
→ `TestStageLabelSwap_DoesNotDeleteLabelsFarmTableDoesNotOwn` **RED exit 1**,
14 top-level failures. The harness is demonstrably able to report failure.

| mutation | probe | probe result | package blast radius |
|---|---|---|---|
| PC | `…DoesNotDeleteLabelsFarmTableDoesNotOwn` | **RED** exit 1 | 14 / 150 |
| **M8** | `…OwnershipMatchesTheAuthorizationReader` | **RED** exit 1 | **29 / 150** |
| MS1 | `…EmptySideIsDetectable` | **RED** exit 1 | 4 / 150 |
| MA1 | `…EmptySideIsDetectable` | **RED** exit 1 | 9 / 150 |
| MCA | `…NonImplementerIsAnsweredNotRejected` | **RED** exit 1 | 1 / 121 |
| MCB | `…UnroutedCollectionStillGetsTheOneElementAnswer` | **RED** exit 1 | 1 / 121 |

### Predicted vs actual: 29 vs 29 — and the set matches too

A matching count is the failure mode this workstream has been bitten by, so I
did not stop at 29. I built a throwaway worktree at leg B's tip, re-measured M8
there myself rather than trusting the report, and diffed the **sets**:

```
legB M8 set size    : 28          (independently reproduced, not taken on trust)
combined M8 set size: 29
IN COMBINED, NOT IN LEG B:  + TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore
IN LEG B, NOT IN COMBINED:  (none)
set equality of the shared 28: True
```

The delta is exactly the single test I named in the prediction. Leg B's package
has 147 top-level tests, the combined 150 — the difference is precisely leg A's
three new ones, and precisely one of the three is M8-sensitive, as predicted.

**Explanation of the difference: +1, and it is the healthy direction.** Leg A
added no production edge to `authorizationStage`. It added a *test* that reaches
it through a path nothing previously exercised at that layer — the resolver.
That is the M-1 regression test doing its job: it asserts that a resolver-built
store honours the operator's configured prefix, and prefix-honouring is
implemented by `authorizationStage`, so breaking `authorizationStage` must break
it. Radius up by one is the correct answer, not a side effect.

**The radius did NOT go down.** Nothing stopped depending on
`authorizationStage`. §3 of the brief does not apply.

### The other mutations: which I re-ran, and why

Selection rule: re-run every leg-B mutation whose target code is in a file leg A
changed, **or** whose target function is newly consumed by a leg A test.

- **MS1** (guard deleted from `GitHubPassThroughStore.LifecycleStages`) — target
  function lives in `passthrough.go`, a file leg A changed, and is the exact
  function leg A's new test calls. **Re-ran.**
- **MA1** (`AllTerminalLabelStages` invents `[completed]`) — leg A did not change
  that file, but leg A's new test consumes the function. **Re-ran.**
- **MCA** (`store.LabelDeltaLifecycleStages` non-implementer arm) — `store.go` is
  a file leg A changed. **Re-ran.**
- **MCB** (`MultiStore.LabelDeltaLifecycleStages` unrouted arm) — `multistore.go`
  is a file leg A changed. **Re-ran.**
- **MNEW** (add `archived` to the enum, `StageValidator`, `allStages`) — **not
  re-run.** Leg A touched none of the generated enum, `StageValidator` or
  `allStages`, and no leg A test reads `allStages`; there is no leg-A edge into
  what MNEW perturbs. Cost is also high (hand-editing generated code).
- **M9** (reverse `terminalStagePrecedence`) — **not re-run.** Leg A did not touch
  `labels.go` at all. `terminalStagePrecedence` is reached only via
  `TerminalLabelStage`; leg A's new test reaches `AllTerminalLabelStages`, which
  deliberately does *not* consult that slice (documented at
  terminal_label_stages.go:158-162). No new leg-A path exists into it.

**Two new cross-leg dependencies that leg B could not have measured**, both
predicted in advance and both confirmed:

- Under **MS1**, leg A's `TestNewPlatformResolver_…` also goes RED — and via a
  *different* assertion than under M8. With the guard gone, `LifecycleStages`
  returns an empty slice for the two negative cells, which trips leg A's
  `len(stages) == 0 → t.Fatalf("…which its contract forbids")` guard rather than
  the terminal comparison. Leg A's test is now a second, independent pin on that
  guard.
- Under **MA1**, the same test goes RED on its two negative cells, which see an
  invented `[completed]` and report terminal where they demand non-terminal.

MCA and MCB were unchanged from leg B (1 failure each, the named probe). As
predicted, leg A's `store.go` addition introduced an **anchor-collision hazard**
— the new package-level `RestrictLabelWriteToSnapshot` has the same
`x, ok := …; if !ok { return … }` shape as `LabelDeltaLifecycleStages`, so a
short anchor that was unique on leg B's tree is not unique here. I anchored on
the full four-line body including
`current := []task.Stage{LifecycleStage(ctx, s, t)}` and the harness confirmed
uniqueness. **Anyone re-running leg B's mutation set on this tree with leg B's
original anchors should check this first.**

Tree restored and GREEN afterwards; `grep -rn MUTANT` → 0.

---

## Job 3 — gates on the combined tree, exit codes from the child process

| gate | expected | **actual** | notes |
|---|---|---|---|
| `make web` | 0 | **0** | 4109 files, exactly as briefed. `web/dist` was absent; `go build` does fail without it. |
| `go build ./...` | 0 | **0** | |
| `go test ./...` | 0 | **0** | run twice, exit 0 both times. **Did not hit the WatchTasks flake.** |
| `make race` | 0 | **0** | `ok internal/platform/github 1.257s` |
| `go vet ./...` | exits 1, 4 copylocks | **exit 1, exactly 4** | same four request paths |

**No gate that both legs passed separately fails on the combined tree.** Nothing
to route.

On the vet finding, the usable signal rather than the exit code: still exactly
4, still `GetReadyTasksRequest` / `GetBlockedTasksRequest` /
`GetCriticalPathRequest` / `GetBottlenecksRequest`, all `assignment copies lock
value to ephReq` in `internal/server/server.go`. Leg B recorded them at lines
1664/1774/1982/2159; they are now at 1737/1847/2055/2232 — a **uniform +73 on
all four**, and `server.go` grew from 2445 to 2518 lines, which is +73. The
offset being identical for all four and equal to the file's total growth is
positive evidence that leg A's insertions are entirely above the first finding
and that nothing between them moved. Same four findings, relocated, not new ones.

---

## Job 4 — the bypass-assertion shape in leg B's tests

Prediction written first:
`em-tooling/combine-r7-artifacts/job4-prediction.txt`.

**Short answer: leg B's own assertions do NOT have the shape. I found one
instance in a file leg B edited, but in a function leg B did not write or
touch — it is pre-existing round-6 work. And the hunt turned up a larger,
separate finding.**

### 4.1 Leg A's literal defect is not present here — measured, not assumed

The `internal/platform/github` fake (`close_label_swap_test.go`, not a leg B
file) answers label mutations with the production selection set
`{"data":{"addLabelsToLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`, not
with `{"clientMutationId":null}`. Leg A said as much; I verified it and then
tested the property rather than the payload.

**Probe J4-PC** injected leg A's exact defect into this package's fake — both
mutation responses changed to `{"clientMutationId":null}`, fake state mutation
left in place. Three tests went **RED**
(`TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal`,
`…ClearingTheStaleLabelRestoresClaimability`, `…ListsOnlyOpenIssues`, plus
`TestSingularSinksAreBlindToTheTerminalTiebreak_PositiveControl`). That is a
built-in positive control: this package's tests **would** have caught leg A's
defect had it been present here.

### 4.2 The instance I did find — and my wrong prediction

`TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` is the only test in leg
B's four files that drives real code through a fake and observes the outcome via
the fake's own state (`fake.hasLabel("duplicate")`).

I predicted it would go **RED** under J4-PC. **It went GREEN.** I also predicted
that killing the production removal path (J4-A, `writeLabelSwap` ignores
`remove`) would leave it green but redden *other* package tests. **It reddened
nothing — 0 of 150.**

Both predictions were wrong for the same reason, and the reason is the finding.
I instrumented the fake's counters directly with a throwaway probe (written,
measured, deleted; tree clean afterwards):

```
StageLabelSwap(current=[ft:stage/wont_fix duplicate], new=wont_fix) -> add=[] remove=[]
fake counters after UpdateTask: addCalls=0 removeCalls=0 updateCalls=1
```

**The test issues no label mutation at all.** Its fixture puts the issue in
`ft:stage/wont_fix` and then asks `UpdateTask` to set the stage to `wont_fix` —
the label is already correct, so the swap computes an empty add and an empty
remove and `writeLabelSwap` makes zero GraphQL calls. The assertion "the stock
`duplicate` label survived" is therefore **vacuously true**: it cannot
distinguish "the code correctly declined to delete a third-party label" from
"the code attempted no label write whatsoever."

Its in-test CONTROL block does not rescue it, and this is the precise shape the
brief describes. The control calls `fake.removeLabelByID(…)` **directly,
in-process**, which proves the *fake* can drop a label — not that the
*production path* can reach it. The control bypasses exactly the component whose
liveness it exists to establish. The fake already tracks `removeCalls`, so
`if fake.removeCalls == 0 { t.Fatal(...) }` would have closed it for one line.

**Attribution, which matters here:** this test is present at base `6ced24e` and
leg B did not modify its body — `git diff 6ced24e 4df2d1e` on that file adds no
top-level test and removes none. It is round-6 work in a file leg B edited for
other reasons. **Leg B did not write this and did not make it worse.** Every
assertion leg B *did* rewrite goes RED under the mutation that neutralises its
subject — I re-confirmed all four (M8, MS1, MA1, MCA, MCB above).

### 4.3 The larger finding: the removal half of `writeLabelSwap` is unpinned in this package

Chasing 4.2 produced something bigger. **Positive control first**, because this
is a negative claim:

| variant of `writeLabelSwap` | package failures |
|---|---|
| `add = nil` (add half dead) | **3** — control passes, the harness can redden this function |
| `add, remove = nil, nil` (both dead) | **3** — the *same* 3 |
| `remove = nil` (remove half dead) | **0** |

Killing the add half reddens 3 tests, so the harness demonstrably works through
this function. Killing the remove half reddens **nothing** in
`internal/platform/github`, and killing both reddens exactly the same 3 as
killing the add half alone — so the removal half contributes zero detection in
leg B's package.

**Scope, before anyone over-reads this.** I widened to `go test ./...` with the
removal path dead: **10 tests fail, all in `internal/server`**, including leg A's
own A-4 regression `TestUpdateTask_FreeRemovalCannotDestroyALabelTheGateNeverSaw`
and `TestUpdateTask_RemovingATerminalLabelRequiresAcceptToReopen`. So the repo
does pin the removal path — **leg A's package covers exactly the gap in leg B's
package.** This is a coverage-locality observation, not a live hole. It is worth
knowing because `writeLabelSwap` is new this round, is the shared primitive all
10 previously-discarded error sites now route through, and a future change to it
would be caught only by tests two packages away.

**Not fixed**, per the brief. Routed to you.

---

## What I could not verify

1. **No integration tests.** `go test ./... -tags integration` needs a live
   Postgres; none available. Same limit both legs declared.
2. **`make race` only covers `internal/platform/github`** — that is what the
   Makefile target does, by deliberate design (documented in the Makefile). The
   combined tree's `internal/server` and `internal/store` changes are not
   race-tested by any gate in the brief's table.
3. **I did not re-run MNEW or M9**, so leg B's numbers for those are carried on
   trust. My justification for skipping is a static call-graph argument (§2), not
   a measurement.
4. **I did not verify leg B's inherited claims** — the MUT 1-5 table, the
   `checked = 18` figure, or the round-6 rows either leg took on trust.
5. **The 4 `copylocks` findings are confirmed same-count and same-paths, not
   byte-identical**, because the line numbers necessarily moved. Both legs
   confirmed byte-identity against their own bases; I confirmed the +73 uniform
   offset instead, which is the strongest available check once a file has grown.
6. **Job 4 covers leg B's four files.** I did not sweep all 150 package tests for
   the bypass shape; §4.3 found one unpinned production path and there may be
   others.
7. **Nothing measured against real GitHub.** Everything is against the fake.

## Void runs

**None.** Every harness aborts on a 0-file or 0-test count and none aborted.
Baselines were GREEN before every mutation; no mutation was scored RED without
compiling first; every revert was verified by re-reading rather than by trusting
the write; `grep -rn MUTANT` is 0 and `git status --porcelain` is empty. The
merge verification was re-run after all mutation work and still reports 18/18
and 451/451.

One near-miss worth recording: my very first `git merge` was piped to `tail`, and
I printed `exit=0` from `tail`, not from `git` — while `git` had in fact failed
on a missing committer identity. I caught it because the merge output was an
identity error, set the identity, and re-ran capturing `$?` directly. Every exit
code in this report comes from the child process. The brief's bar is there for a
reason and I tripped over it once inside five minutes.

---

## WHERE THIS BRIEF IS WRONG

**1. `authorizationStage` is not in `labels.go`.** The brief says M8 "forces
`authorizationStage` to return `("", false)`" and leg B's report discusses it
alongside `labels.go`, whose comment block at :359-366 describes it at length.
The function is defined in
**`internal/platform/github/terminal_label_stages.go:46`**. `labels.go` only
*calls* it. Anyone building the M8 anchor from the brief plus a glance at
`labels.go` will not find the function; anyone anchoring on the comment text
will mutate a comment and measure nothing — which would score M8 GREEN and look
like a finding. This is the highest-value correction here.

**2. "Leg A contributes 5 commits, leg B its own" understates the arithmetic
trap.** Leg B contributes 2. With two `--no-ff` merges the combined history has
5 + 2 + **2** = 9 commits over base. The round-6 script `merge-verify.sh` hard-codes
`NA_C + NB_C + 1` because it combined via a single merge; run unmodified against
a two-merge combine it aborts with "commit arithmetic off". I changed it to `+2`
and said so in the script header.

**3. The round-6 `merge-verify.sh` the brief points to cannot run as-is** — its
`R=/workspace/farmtable-194-combined` does not exist, so it dies at `cd` before
any check. The brief says "use it, adapt it, or write your own", so this is not
strictly an error, but the pointer is to a script that aborts immediately. More
substantively, **its positive control is weaker than it looks**: `head -1` of the
sorted file list is an added file this round, so the control would have compared
a real blob against `MISSING` and passed while only demonstrating the comparator
can detect absence. Fixed in `merge-verify-r7.sh`.

**4. Job 4's framing presumes the shape would be leg B's if present.** "Check
whether **leg B's** tests contain the same shape … Leg B did not know about this
defect when it wrote them." The one instance is in a file leg B edited but in a
function that predates leg B and that leg B never touched. Had I answered the
question as posed I would have filed a true observation under a false
attribution. The useful question is "does this shape exist in the files this
round touched", not "did leg B introduce it".

**5. Minor — the vet line numbers in the brief are stale by construction.** The
brief asks to verify "still exactly 4 and still those 4" and cites the four
RPC names, which is the right test; but leg B's report records lines
1664/1774/1982/2159 and on the combined tree they are 1737/1847/2055/2232.
Anyone verifying by line number concludes the findings changed. The brief is
right to name the paths rather than the lines — I am flagging it only because
the two documents disagree numerically and the next reader will hit that.

**6. Not wrong, but the brief's own framing was validated the hard way.** "Zero
file overlap is not semantic independence" turned out to be exactly right, and
not only in the direction anticipated: beyond M8's radius changing, leg A's
purely *additive* `store.go` change silently broke the uniqueness of a content
anchor leg B had used. Two legs with no shared files invalidated each other's
mutation tooling.

---

## Deliverables

1. Branch **`label-write-scope-r7`** at `15b7247`, committed locally, not pushed.
2. Prediction file, written and sealed before measurement:
   `em-tooling/combine-r7-artifacts/blast-radius-prediction.txt`
   (sha256 `bdcb736418e0de00…`, plus `job4-prediction.txt`).
3. This report.
4. Project-log entry committed in `.design/project-log/`.

Artifacts: `em-tooling/merge-verify-r7.sh` + `.out`,
`em-tooling/combine-r7-artifacts/{mutate-r7.py,job4-probe.py,job4-control.py,
mutation-results.json,m8-set-diff.txt,*.out}`.

**I did not start the three-way review.** That is yours to launch.

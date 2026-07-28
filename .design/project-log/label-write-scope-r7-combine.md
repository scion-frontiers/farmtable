# #194 round 7 — combining leg A and leg B, and measuring the seam

Branch `label-write-scope-r7` at `15b7247`. Base `6ced24e`, leg A `cc953e4`
(5 commits, production authorization), leg B `4df2d1e` (2 commits, test
quality). Two `--no-ff` merges, no conflicts.

## The merge lost nothing, verified by content

The two legs touch **zero files in common** — leg A 12, leg B 6, overlap empty.
That makes the textual merge trivial and is exactly why "no conflicts" was not
allowed to stand in for "nothing was lost". Verified with
`em-tooling/merge-verify-r7.sh`:

- `6ced24e` asserted to be the true `merge-base` of both legs, not assumed
- commit arithmetic 5 + 2 + 2 merge commits = 9, and the commit **SHA sets**
  match exactly in both directions (counts alone have passed here before while
  the commits were wrong)
- all **18** changed blobs byte-identical to their owning leg
- all **451** untouched blobs byte-identical to base
- positive controls on both legs: a merged blob compared against its *base*
  blob reports MISMATCH, so the comparator is known to be able to say no

Re-run after all mutation work; still 18/18 and 451/451.

## M8's blast radius: 28 → 29, predicted before measuring

Leg B disclosed that it could not measure the r7a interaction. Leg A did change
that neighbourhood, so M8 (`authorizationStage` → `("", false)`) was
re-measured on the combined tree.

Prediction written and sealed **before** any test ran on this tree, derived from
a static read: `authorizationStage` has exactly three production callers
(`StageLabelSwap`, `TerminalLabelStage`, `AllTerminalLabelStages`), and leg A
adds **no production edge to any of them** — `RestrictLabelWriteToSnapshot`
matches on `labelMatchKey`, `writeLabelSwap` is a pure write primitive, and the
`internal/store` changes are purely additive with
`LabelDeltaLifecycleStages` byte-unchanged. The only new consumer is leg A's
*test* file. Predicted 28 + 1 = **29**.

Measured **29**, and the set matches, not just the count: leg B's 28 was
independently re-measured in a throwaway worktree rather than taken on trust,
and the diff is exactly

```
+ TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore
- (nothing)
```

The radius went **up**, which is the healthy direction. Leg A's M-1 regression
test asserts that a resolver-built store honours the operator's configured
prefix; prefix-honouring *is* `authorizationStage`, so breaking it must break
that test. Nothing stopped depending on `authorizationStage`.

Two cross-leg dependencies leg B could not have measured, both predicted and
confirmed: leg A's resolver test also goes RED under **MS1** (via its
`len(stages) == 0` contract guard, a different assertion than M8 trips) and
under **MA1** (its two negative cells). MCA/MCB unchanged at 1 failure each.
MNEW and M9 deliberately not re-run — no leg-A edge reaches what they perturb.

**Tooling hazard for anyone re-running leg B's mutations here:** leg A's
purely additive `store.go` change introduced a second
`x, ok := …; if !ok { return … }` block, so a short content anchor that was
unique on leg B's tree is no longer unique. Anchor on the full four-line body
including `current := []task.Stage{LifecycleStage(ctx, s, t)}`.

## Gates

`make web` 0 (4109 files) · `go build ./...` 0 · `go test ./...` 0 (twice, no
WatchTasks flake) · `make race` 0 · `go vet ./...` exits 1 with exactly the 4
pre-existing `copylocks` findings on the same four ephemeral request paths.
Their line numbers moved by a **uniform +73**, which equals `server.go`'s total
growth (2445 → 2518) — same findings relocated, not new ones.

**No gate that both legs passed separately fails on the combined tree.**

## `writeLabelSwap`'s removal half is unpinned in its own package

Looking for leg A's bypass-assertion shape in leg B's tests turned up a
separate, controlled finding. With a positive control first:

| `writeLabelSwap` variant | failures in `internal/platform/github` |
|---|---|
| add half dead | **3** (control: the harness can redden this function) |
| both halves dead | **3** — the same 3 |
| remove half dead | **0** |

Widening to `go test ./...`, a dead removal path fails **10 tests, all in
`internal/server`**, including leg A's own A-4 regression. So the path is
pinned — just entirely from another package. `writeLabelSwap` is new this round
and is the shared primitive all 10 previously-discarded error sites now route
through, so a future change to it is caught only two packages away. Coverage
locality, not a live hole. Not fixed; routed to the EM.

Separately, `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` is vacuous:
its fixture sets the stage to the stage the issue already carries, so
`StageLabelSwap` returns an empty add and empty remove and the test issues **no
label mutation at all** (measured: `addCalls=0 removeCalls=0`). Its "the stock
label survived" assertion cannot distinguish correct restraint from a dead write
path, and its control calls `fake.removeLabelByID` directly, in-process, proving
only that the *fake* can delete a label. The fake already tracks `removeCalls`;
one assertion on it would close this.

**This test predates leg B** (present at `6ced24e`, body untouched by leg B).
Every assertion leg B actually rewrote goes RED under the mutation that
neutralises its subject. Leg A's literal `{"clientMutationId":null}` defect is
**not** present in this package's fake — verified by injecting it, which
correctly reddened three ClaimTask tests.

## Not done here

No integration tests (no Postgres). `make race` covers only
`internal/platform/github`, by the Makefile's design, so the combined tree's
`internal/server` and `internal/store` changes are race-tested by no gate. The
fresh three-way review is the EM's to launch.

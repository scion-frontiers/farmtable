# #194 close-label-swap — round 5: scoping label writes, and un-picking the tiebreak

Round 4 closed the **read** side: `TerminalLabelStage` scans the whole label set
instead of a precedence-collapsed projection, so a masking label no longer hides
a maintainer's `ft:stage/wont_fix`. Round 4 is kept, unchanged.

This round closes three things on top of it, all at the same call site in
`UpdateTask`:

- **B1** — a label edit that moves the lifecycle stage now costs what the
  equivalent stage change costs.
- **B5** — authorization reads the **set** of stages a task names, not the one
  a tiebreak selects.
- **B6** — only a label carrying the configured push prefix may feed an
  authorization or terminal-stage answer.

Commits: `806b164`, `b37269c`, `a98d162`, `7ae69ff`.

## The invariants

1. If authorization reads a value, **every write path to that value** must be
   guarded by the same authorization. (B1)
2. An authorization decision **must not depend on which of several equally
   present values a tiebreak happens to select**. (B5)
3. A label may contribute to an authorization or terminal-stage determination
   **only if it carries the configured push prefix**. Prefix-tolerant matching
   is a display affordance. (B6)

## What was open, and what each control closes

### B1 — the write side of the label-derived stage

`add_labels` / `remove_labels` were guarded by nothing but the blanket
`task:write`, and the transition-scope gate lived inside the `if req.Stage != nil`
arm, so a label-only request never reached it. Two self-service chains, one
token, no second actor:

```
DIRECTION 1  reopen -> DENIED (task:accept) | remove_labels[ft:stage/wont_fix] -> ALLOWED | reopen -> ALLOWED
DIRECTION 2  close  -> DENIED (task:close)  | add_labels[ft:stage/completed]    -> ALLOWED | stage=completed -> ALLOWED (from == to)
```

**The payload is step 1, measured, not step 3**: the label write alone flips
`Available=true -> false`. The restamp only launders the result. So the control
is on the label write, gated on the transition the edit *induces*
(`before != after`), not on "a stage label was touched".

Round 4 is what made direction 2 work — a *correct* terminal scan promotes an
attacker-supplied label into the authorization source. That is not an argument
against round 4; it is the argument that the label is the wrong place to read
from in either direction (#203).

### B5 — stop picking one of several present stages

Comparing two tiebreak **winners** is blind to an edit that swaps one of several
present terminal labels for another, and "nothing changed" is exactly the answer
that costs nothing. Two shapes, both measured:

| shape | round 4 | now |
| --- | --- | --- |
| `add_labels[Y]` on a task labelled `X` (12 ordered pairs) | 6 gated | **12 gated** |
| `UpdateTask(stage=Y)` on a task labelled `[X, Y]`, no label write at all (12 ordered pairs) | 6 gated | **12 gated** |

The six that converted in the second shape were exactly the reported set —
`wont_fix→completed`, `duplicate→completed`, `duplicate→wont_fix`,
`cancelled→completed`, `cancelled→wont_fix`, `cancelled→duplicate` — reproduced
independently here by mutation (MUT-B5 below).

**No ordering fixes this.** A conversion exists iff `rank(dest) < rank(start)`,
so the rank-0 element is reachable from every other terminal stage, and every
total order has a rank-0 element. A reorder only moves *which* stage is free.
`terminalStagePrecedence` is untouched.

### B6 — the configured prefix is required for authorization inputs

Round 4 **introduced** this. Round 3's precedence collapse hid every bare
stage-named label behind any ordinary stage label; scanning the whole set —
correctly — promoted GitHub's stock `duplicate`, appliable with triage rights,
into an authoritative terminal signal. The narrowing measured by the test leg
holds: stock `wontfix` (no underscore) does **not** map, so the real exposure is
`duplicate` plus independently created labels, not all four.

`MapLabelsToStage`, the display projection, is deliberately left
prefix-tolerant. Only the two terminal-stage readers changed.

## What changed

| file | change |
| --- | --- |
| `internal/store/store.go` | new `LifecycleStageSetStager` + `LifecycleStages` / `LabelDeltaLifecycleStages` / `SameStageSet` helpers, alongside `LifecycleStager` |
| `internal/store/multistore.go` | routing for both methods |
| `internal/platform/github/passthrough.go` | `LifecycleStages`, set-valued `LabelDeltaLifecycleStages`, `lifecycleStagesForLabels`, `applyLabelDelta` |
| `internal/platform/github/terminal_label_stages.go` | **new**: `AllTerminalLabelStages`, `authorizationStage`, `matchPrefix` |
| `internal/platform/github/labels.go` | two surgical edits: the scan predicate in `TerminalLabelStage`, and `stripForMatch` sharing `matchPrefix` |
| `internal/server/server.go` | both gates in `UpdateTask` read stage sets |

`TerminalLabelStage`'s signature and its two callers are unchanged.
`AllTerminalLabelStages` went in a new file, not `labels.go`, to avoid a
collision with the separately sequenced tiebreak work.

Two properties `AllTerminalLabelStages` deliberately does **not** share with
`TerminalLabelStage`: membership is decided by `store.IsTerminalStage` rather
than by presence in `terminalStagePrecedence` (so it never inherits that loop's
fail-open behaviour), and ordering is by stage name (total by construction, so
no future reorder can change an authorization answer through it).

## Exactly which sinks, cardinalities and prefixes are covered

**Sinks covered.**

> **CORRECTION (#194 round 6, leg A).** This paragraph originally read: *"the
> two gates inside `UpdateTask` (`server.go`), and, through
> `store.LifecycleStage(s)`, the readers that already consumed round 4's seam:
> `ComputeAvailability` and `ClaimTask`."* The `(s)` made one token stand for
> two different functions — `LifecycleStage` (singular) and `LifecycleStages`
> (the set) — and thereby conflated B5 with B6. **B5 does not reach
> `ComputeAvailability` or `ClaimTask`; B6 does.** Per-control ground truth:

| Control | `UpdateTask` gates | `ComputeAvailability` | `ClaimTask` |
| --- | --- | --- | --- |
| B1 — label write gate | yes | n/a | n/a |
| B5 — set-valued source | yes | **no** — singular `LifecycleStage` | **no** — singular `LifecycleStage` |
| B6 — prefix required | yes | yes | yes |

B6 reaches both readers because `TerminalLabelStage` now calls
`authorizationStage`. B5 does not reach them: both go through
`GitHubPassThroughStore.LifecycleStage`, which collapses to one terminal stage.
That collapse is **deliberate and safe**, and round 6 records why where it can
rot loudly (see A1 in the round-6 leg-A entry): each of those two consumers
reduces every terminal stage to one boolean, so the tiebreak cannot change
their answer. A consumer that branches on *which* terminal stage must use
`LifecycleStages`, and
`TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer` fails
if one starts discriminating.

**Sinks NOT covered:**

- `ft ready` scheduling — `GetReadyTasks` → `buildIssueTree` →
  `MapLabelsToStage` (`treewalk.go:36`) → `computeReady` (`:92`, `:105`). It
  asks terminal-ness of the precedence-collapsed winner and never goes through
  the seam. 7 of 12 probed label sets bypass. Sequenced separately; not touched.
- `hasExternalUnavailableLabel` in the same file, which hardcodes `"ft:"` and
  `"stage/"` and can see neither `m.enabled` nor the configured prefix. Same
  prefix theme as B6. Not touched.
- `CreateTask` / `InsertTasksAfter`, which pass caller-supplied labels straight
  to the new issue. `CreateTask(stage=completed)` is denied; `CreateTask(labels=[ft:stage/completed])`
  is allowed with `task:write` and the label lands. Pinned as current behaviour
  in `TestCreateTask_TerminalStageLabelAtCreationIsUngatedToday`.
- Label writes made **on GitHub directly**. This guards Farm Table's write path
  only; a maintainer with triage rights edits labels outside it entirely.
- There is still **no audit trail** on GitHub-backed tasks.

**Label-set cardinalities covered** at the two `UpdateTask` gates:

| terminal stages named | behaviour |
| --- | --- |
| 0 | unchanged from round 4 — single-member set from `t.Stage` / `IssueToPhaseStage` |
| 1 | unchanged from round 4 — restamp stays `task:write`, reopen costs `task:accept` |
| 2 | **new**: every (from, to) pair charged; conversions and no-write re-assertions closed |
| 3–4 | same rule, exercised at cardinality 4 only at the unit level (`AllTerminalLabelStages`), not end to end |

**Prefix configurations covered**: `ft:` (default), `acme:` (custom), and empty.
Empty means the default `ft:`, **not** "no prefix required" — `StageToLabel`
writes `ft:stage/...` under an empty config, so any other reading would make the
deployment that pushes our own labels the one that also honours everyone else's.

## Accepted cost

Twelve cells lose their terminal reading: a task carrying only a stock or
independently created label now reads as live, available and claimable. Per the
coordinator's ruling this is the safe direction — wrongly available, not wrongly
privileged — and the interim cost of closing a live authorization hole.

**Not covered by B6**: a deployment that configures custom terminal aliases in
`LabelConfig.Stages` (e.g. `shipped: completed`) must now spell them with the
prefix for them to be authoritative. No such configuration exists in-tree.

> **CORRECTION (#194 round 6, leg A).** The remediation sentence above was
> ambiguous in the one way that matters, and the reading an operator is most
> likely to take is the one that breaks the alias outright. "Spell them with the
> prefix" means spell the prefix on the **GitHub label**, leaving the config
> **key bare**. Putting the prefix in the config *key* produced a
> **fully dead** alias as of round 5 — dead for display as well as for
> authorization — because `buildLabelMapper` stored the key verbatim while
> `stripForMatch` strips the prefix before the lookup, so the key could never be
> hit. Measured at `ea8ac39` (test review T-1, reproduced in round 6 by
> `TestConfiguredStageAliases_KeySpellingIsNormalised`):
>
> | config key | GitHub label | lifecycle | available | display |
> | --- | --- | --- | --- | --- |
> | `shipped` | `shipped` | `accepted` | true | `completed`, true |
> | `shipped` | `ft:shipped` | `completed` | false | `completed`, true |
> | `ft:shipped` | `ft:shipped` | `accepted` | true | `""`, false |
> | `ft:shipped` | `shipped` | `accepted` | true | `""`, false |
>
> Round 5's only working spelling was row 2: **bare key, prefixed label.**
> Round 6 removes the trap rather than documenting it — alias keys are now
> normalised through the same `stripForMatch` path used for lookup, so a key
> works whether or not the operator wrote the prefix, and rows 3 and 4 behave
> like rows 1 and 2. Row 1 (bare key, bare label) remains deliberately
> non-authoritative: that is B6 working as designed, not a defect. See
> `.design/project-log/label-prefix-terminal-set-r6a.md`.

## Tests

New file `internal/server/authz_label_write_scope_test.go` (per the brief);
`internal/platform/github/terminal_label_stages_test.go` for the unit cells.

- 28 removal cells, 24 addition cells, 12 add-swap cells, 12 no-write restamp
  cells, 3 case spellings, both chains end to end, 7 hygiene rows (label edits
  that induce no stage change stay `task:write`), 4 native-task inertness rows.
- REV9 landed **passing**: `from == to` is a genuine no-op today, and the doc
  comment names the load-bearing assumption — `passthrough.go` never writes
  `p.Phase`, so `UpdateTask` never closes or reopens an issue. `closeCalls == 0`
  is asserted, not assumed.
- The closed-issue floor is pinned: `state:CLOSED` / `ClosedAt` survives label
  stripping, and `state_reason` is recovered from `RemoteData` so that stripping
  labels off a closed `not_planned` issue is not misread as `wont_fix→completed`.
- B6 varies `push_prefix`, which **no test in the repository had ever done** —
  the mapper configuration was a constant every fixture inherited from
  `DefaultConfig`, so a value B6 makes load-bearing for security was untested.

### Two tests INVERTED, none deleted

- `TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable` loses its bare
  `"duplicate"` row to a new `..._BareStockLabelIsNotATerminalSignal`, which
  asserts the opposite. The four prefixed rows stay as its positive control.
- `TestUpdateTask_UnprefixedTerminalLabelIsHonouredToday` →
  `..._IsNoLongerHonoured`, with the prefixed spelling added as the control that
  stops it passing on a dead scan. Its own failure message had invited exactly
  this. Note that the ruling it recorded (key off closed state + `state_reason`
  instead of reading labels) is **not** what landed and is still open; B6 is
  narrower.
- `TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose` moved from
  pinning 6 to pinning 12. The old count measured the tiebreak, not the control;
  it is kept as a count so a regression to winner-comparison shows up as 6
  rather than as a silent pass.

No test was deleted, and none has no successor.

`TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite` is unedited
and green.

## F7 — measured, not inherited

The audit claimed B6 would also fix `StageLabelSwap` deleting a human's stock
label during an ordinary stage change. **It does not.**

```
StageLabelSwap([duplicate bug], working)  ->  add=[ft:stage/working] remove=[duplicate]
```

B6 changed the two terminal-stage **readers**, where authorization answers come
from. `StageLabelSwap` is a **writer** and still decides ownership with the
prefix-tolerant `stripForMatch`. One label, two answers, in the same mapper.
Pinned as current behaviour in `TestStageLabelSwap_StillDeletesAHumansStockLabel`,
with the contrast asserted. **Not fixed** — out of scope for this round.

## B3 — answered by measurement: NO

Can a native, Ent-backed task hold `stage=<terminal>` with `phase=open`? Not
through any RPC. Every server-side write path derives phase from stage in the
same expression: `CreateTask` (`server.go:126`), `UpdateTask` (`server.go:559`),
and `migrateTaskState` (`export_import.go:657`), which ignores a caller-supplied
phase. `TestNativeTask_TerminalStageAlwaysCarriesAClosedPhase` drives
create/update/close × 4 terminals plus `ImportCollection` with a deliberately
conflicting `phase: "open"`; all produce `phase=closed`.

Honest limit, documented in the test: `store.UpdateTaskParams` has independent
`Phase`/`Stage` pointers and `EntStore.UpdateTask` sets each only if non-nil, so
an *internal* caller could construct the state. Not reachable from any RPC today.

## Prove-it: both controls measured by mutation

Committed first; backups outside the repo; content-addressed mutations that
abort unless the anchor is unique; after each restore, `git status --porcelain`
empty **and** the restored property positively asserted.

**MUT-B5** — collapse both set-valued readers back to the round-4 single
tiebreak winner:

- `..._SwappingOneTerminalLabelForAnother`: **6 of 12** fail — `completed→wont_fix`,
  `completed→duplicate`, `completed→cancelled`, `wont_fix→duplicate`,
  `wont_fix→cancelled`, `duplicate→cancelled`.
- `..._ReAssertingATerminalStageOnAMultiTerminalTask`: **6 of 12** fail —
  `wont_fix+completed`, `duplicate+completed`, `duplicate+wont_fix`,
  `cancelled+completed`, `cancelled+wont_fix`, `cancelled+duplicate`. **Exactly
  the independently reported Z4C set.**
- `..._StockLabelBesideATerminalLabelIsDeniedButNotByB5`: **2 of 3** fail — the
  two prefixed cells, and *not* the stock-label cell. That is the disclosure in
  that test's doc comment confirmed by execution: the stock-label cell is denied
  by B6 plus the ordinary `any→terminal` rule, and B5 never runs on it.

**MUT-B6** — drop the prefix requirement: `TestTerminalStageInput_RequiresTheConfiguredPrefix`
(3 rows), `TestAllTerminalLabelStages_...` (2 rows),
`TestLabelWriteScope_StockLabelBesideAnAcceptedTaskStaysReadyWork`,
`TestUpdateTask_StockLabelBesideATerminalLabelIsDeniedButNotByB5`,
`TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal`,
`TestUpdateTask_UnprefixedTerminalLabelIsNoLongerHonoured`, and the F7 pin all
fail. The negative controls — hygiene rows, native inertness, the closed-issue
floor, REV9, the seam-agreement pin, B3 — stayed green under **both** mutations,
so the suite does not merely deny everything.

One nil-pointer panic in `TestUpdateTask_PropagatesActorID` appeared during the
MUT-B5 run at `identity_test.go:250` (an ignored `CreateUser` error). It is a
run artefact, not a signal: the test passes 3/3 on the clean tree and the
mutation does not touch that path.

## Gate

Exit codes captured from the child process, never through a pipe.

```
GO_BUILD_EXIT=0
GO_VET_EXIT=1     # exactly the 4 pre-existing copies-lock findings; 0 other lines
GO_TEST_EXIT=0
MAKE_RACE_EXIT=0
```

> **Correction, round 6.** `GO_BUILD_EXIT=0` above was measured against a tree
> whose `web/dist` was a **stub**. `assets.go` embeds `all:web/dist`, which is
> gitignored, so a fresh clone does not build until `make web` has run: measured
> at `ea8ac39`, `go build ./...` exits **1** before `make web` and **0** after.
> The number was true of the tree it was run on. What it does not support is the
> sentence *"the branch builds,"* which nobody had measured at the time. The stub
> does not affect `internal/platform/github/` behaviour and **no round-5
> label-authorization finding is invalidated by it.** Three round-5 agent reports
> carry the same unqualified claim (`review-194-r5:27`, `audit-194-r5:47`,
> `test-194-r5:277`). See
> `.design/project-log/label-prefix-terminal-set-r6a.md`.

## Where I pushed back on the brief

- **B1's sketch called the reconstruction twice, once per endpoint.** I made it
  one seam returning both, so a reconstruction error cancels out for the
  `from == to` case, and I declined to source "before" from round 4's
  `LifecycleStage` — that reads `t.Stage` as its fallback and cannot model a
  hypothetical label set, so mixing the two sources would report spurious
  transitions, which at this gate are denial-of-work bugs.
  `TestLifecycleStageForLabels_AgreesWithLifecycleStageOnTheTasksOwnLabels`
  (14 fixtures) pins the two readings against each other.
- **B5's arrival forced a consistency fix on the already-committed B1.** B1
  compared two single stages, so B1's own decision depended on the tiebreak —
  the thing B5's invariant forbids. Both gates now read sets.
- **B6 required editing `labels.go`**, which Addendum 1 had fenced off. I read
  that fence as covering the fail-open tiebreak loop and made two surgical
  edits: the scan predicate in `TerminalLabelStage`, and `stripForMatch` sharing
  `matchPrefix` so the requirement and the lookup cannot drift.
- **B6 also required editing `authz_terminal_reopen_test.go`**, which the
  original brief had fenced off. The fenced test is precisely one of the tests
  Addendum 3 says to invert, and it could not move without a larger edit to that
  file. Inverted in place.
- **The stock-label no-write cell is reported as closed by B6, not by B5.**
  Attributing it to B5 would be a claim about a code path that does not execute;
  MUT-B5 confirms it stays denied with B5 disabled.
- **Case-folding.** `mergeLabels` is exact-string, but GitHub resolves both add
  and remove through a lowercased name→node-ID index, so
  `remove_labels=["FT:STAGE/WONT_FIX"]` really strips the label.
  `applyLabelDelta` matches case-insensitively; 2 of 3 probed spellings are
  live and the third over-predicts, which fails closed and is logged rather
  than skipped.

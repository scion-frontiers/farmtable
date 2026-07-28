# label-prefix-terminal-set-r6a — issue #194, round 6, leg A

Leg A of a two-leg parallel round on the label-write authorization scope.
Branch `label-write-scope-r6a`, based at `ea8ac39`. Leg A owns
`internal/platform/github/`, `push_prefix` config parsing, and the project-log
corrections. Leg B (`label-write-scope-r6b`) owns `internal/server/` and
`internal/store/`. Neither leg pushed; the EM combines.

## The defect class this round kept finding

Round 3 named it: **a check that derives from the thing it is checking cannot
falsify it.** Round 6 found four more instances, and three of them were inside
work done to fix the first three:

1. A fixture that cannot express the input (the `Stages:`-invariant alias tests).
2. A hand-picked table that cannot express the cell that matters (my own F3 pair
   table, below; and my four-case seam walk, below).
3. A correct check answering a question nobody meant to ask.
4. A comment asserting a precondition with nothing enforcing it.

Every one of them produced a *clean* answer. None was carelessness. The
recurring remedy is the same: root the table in the enum, and run a mutation
that should turn it red.

---

## Cross-round correction: "the branch builds" was never measured

**This is a process defect, not a build defect, and the record needs it.**

Three round-5 agent reports state a green `go build ./...`:

- `review-194-r5`, line **27**
- `audit-194-r5`, line **47**
- `test-194-r5`, line **277**

A fourth copy reached the permanent record:
`.design/project-log/close-label-swap-r5-label-write-scope.md` line **314**
(`GO_BUILD_EXIT=0`), which now carries a correction note pointing here.

All four were run against a tree whose `web/dist` was a **stub**. `assets.go`
embeds `all:web/dist`, and `web/dist` is gitignored, so a fresh clone does not
build until `make web` has run. Measured in round 6 on a clean clone at
`ea8ac39`: `go build ./...` **exits 1** before `make web` and **0** after.

Severity, stated narrowly and deliberately:

- `BUILD=0` **was true of the stubbed tree** those agents had.
- The stub **does not affect `internal/platform/github/` behaviour**.
- **No label-authorization finding from round 5 is invalidated by it.**
- What *is* invalidated is the sentence **"the branch builds,"** which nobody
  had measured until round 6 ran `make web`.

The failure mode is worth naming because it is the same one as everything else
here: three independent agents reported the same true-of-their-tree fact, and
the agreement read as corroboration.

---

## A1 — the precondition that was documented backwards, now enforced

`TerminalLabelStage` picks ONE terminal stage. The round-5 comment said
privilege-path callers use the set-valued reader instead. That is **false of
both actual callers**: `LifecycleStage` has exactly one production caller and
its result reaches exactly two consumers, and both are privilege paths —
`issueUnavailableForClaim` (claim gate) and `ComputeAvailability` (availability
gate).

It is nonetheless safe, for a reason nothing in the type system holds up:
**neither consumer branches on which terminal stage it is.** Each collapses
every terminal stage to one boolean, so the tiebreak is unobservable — for
exactly as long as that stays true. Add a consumer with a distinct denial
reason for `wont_fix` versus `duplicate` — entirely natural — and
`terminalStagePrecedence`'s ordering silently becomes an access-control
parameter.

Replaced the false comment with the true one and gave the precondition a
tripwire: `TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer`
drives both consumers with each terminal stage from the enum and fails if any
two answers differ.

## A2 — the tiebreak blindness pairs

Landed the reviewer's `TestSingularSinksAreBlindToTheTerminalTiebreak`, adapted
to drive two terminal labels through `ClaimTask`/`ComputeAvailability`.

**My first version of this test was an instance of the defect class it exists to
catch.** It used three hand-picked label pairs and did not catch MUT2 (the
availability gate skipping terminal for `wont_fix`), because with
`terminalStagePrecedence = [completed, wont_fix, duplicate, cancelled]` none of
the three picked pairs had `wont_fix` as tiebreak winner. Replaced with all 12
ordered pairs enumerated from the enum, plus a `winnersSeen` coverage pin that
fails if a non-last terminal stage never wins a tiebreak.

The tripwire's first positive control was likewise too weak to catch MUT4
(a claim gate refusing unconditionally): `control != want` is a struct
comparison satisfied by one field moving. Now asserted field by field.

Mutation record, showing the division of labour is real and not asserted:

| MUT | defect injected | tripwire | F3 pairs | F3 control |
| --- | --- | --- | --- | --- |
| 1 | claim gate returns false for `StageDuplicate` | RED | RED | green |
| 2 | availability gate skips terminal for `StageWontFix` | RED | RED | green |
| 3 | `LifecycleStage` falls back to `t.Stage` when >1 | green | RED (12) | green |
| 4 | claim gate refuses unconditionally | RED | green | RED |
| 5 | `terminalStagePrecedence` reversed | green | green | green |

MUT3 is invisible to the tripwire; MUT4 is invisible to the pairs. **MUT5
staying green is a positive result** — order-independence — and it is meaningful
only because MUT3 shows the same tests do move when the answer really moves.
This is the probe the round-5 reviewer ran, saw pass, and correctly refused to
read as evidence.

## A3 — configured alias keys, and what normalising them cost

Alias keys are now normalised through the same `stripForMatch` used for lookup,
so a key works whether or not the operator wrote the prefix. Round 5's
remediation prose told operators to spell the prefix; spelling it in the config
*key* produced a **fully dead** alias — dead for display as well as for
authorization — reachable only as a double prefix. The `Stages:`-varying fixture
subsumes audit A-5.

**See M2 below. This fix has a cost, it was measured, and it is not documented
away.**

## A4 / A6 — the push prefix as a security parameter

`push_prefix` is a security parameter since B6. A whitespace-only value disarmed
B1, B5 and B6 together, because `matchPrefix` defaulted only on the empty
string. Both halves fixed as one — reader-only would leave the writers emitting
`" stage/completed"`, which the reader then rejects as not ours. One
`resolvePushPrefix`, shared, replacing three copies of the `"ft:"` literal;
`Validate` rejects a whitespace-only prefix at parse time rather than silently
substituting a value the operator did not write.

**The padded case was unmeasured at `ea8ac39`.** The auditor measured
whitespace-**only** and generalised. `" acme:"` — whitespace-**padded** around a
real prefix — is a real addition to A-2's scope and another instance of a table
that could not express the input. Same fix covers it; the record should not
imply it was tested.

## A5 / F7 — the writer now asks the reader's question

Measured end to end at `ea8ac39`:

```
labels = [ft:stage/wont_fix, duplicate], UpdateTask(stage=wont_fix)
-> allowed, and afterwards labels = [ft:stage/wont_fix]
```

A no-op stage update silently destroyed a human's stock GitHub label. Farm Table
was refusing to **believe** `duplicate` on the grounds that it is not ours, while
claiming the right to **delete** it — the worst available pairing, because it
means we destroy precisely the labels we have decided we are not entitled to
trust. `StageLabelSwap` now asks `authorizationStage`, the same predicate the
reader uses, and `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader`
enumerates both spellings of all ten stages so the two cannot diverge again.

Cost, stated rather than buried: a bare human-applied stage label now survives a
stage change, so an issue can carry a stale display reading. Same trade round 4
accepted on the read side, now consistent in both directions. It is also
strictly the safe direction for a write — it can only ever delete fewer labels.

**A5 IS BENIGN RATHER THAN CLOSED.** `TransitionScope("wont_fix", "wont_fix")`
still short-circuits to `ScopeTaskWrite` at `transitions.go:124`; the call is
still permitted. What A5 removes is the **harm**, not the gate. This must not be
read as "F7 fixed."

## A7 — the fourth terminal-label sink, and the hold prefix

Two things, both in the tree walk.

**`hasExternalUnavailableLabel` stripped the hardcoded `"ft:"`,** not the
configured prefix. Under `push_prefix: "acme:"` an operator's `acme:blocked` was
**ignored** and the task handed to an agent, while `ft:blocked` — a namespace
that deployment does not own — was honoured. Exactly backwards. It now accepts
the configured prefix, the default prefix, and no prefix.

It stays **prefix-tolerant on purpose**, which is the opposite of what B6 did to
the readers, and the difference is load-bearing: `authorizationStage` answers
"may this label GRANT something?" and must refuse anything a third party can
apply; this answers "does anyone want this held back?" and can only ever
**withhold**. Widening a withhold-only predicate is monotone and grants nothing.
*"Make it consistent with `authorizationStage`"* is the plausible-sounding wrong
fix here.

**`computeReady` was a fourth consumer of the round-3 masking defect and no
round had counted it.** It decided readiness from `node.Stage`, which comes from
`MapLabelsToStage`, the display collapse — and `stagePrecedence` ranks every
non-terminal stage above every terminal one. Measured on an open parent whose
only child is closed:

| labels | `node.Stage` | offered as ready? |
| --- | --- | --- |
| `[ft:stage/completed]` | `completed` | no |
| `[ft:stage/completed, working]` | `working` | **YES** |
| `[ft:stage/completed, ft:stage/accepted]` | `accepted` | **YES** |

Row two is the one that matters: `working` carries no push prefix, so under B6
it is a label **anyone** can apply and nothing may trust, and applying it took a
completed task and handed it back to an agent as ready work.

It was missed because every enumeration looked for *authorization gates*, and
this is a *scheduler*. It is not a gate. It answers the same question off the
same labels. The walk now asks `AllTerminalLabelStages`, so the answer cannot
depend on what else the issue is labelled; this is a withhold, therefore safe to
widen, and it makes the walk agree with `ComputeAvailability`, which already
treated a terminal label as unavailable. Two views of "can this be worked on"
that disagreed.

## A8 — small true things

`F4`'s wrong round tags corrected; the stale `T-5` comment corrected; the `F2`
log table landed. The `multistore.go` note in `passthrough.go` is now a
**cross-reference**: leg B pinned `MultiStore` with a compile-time assertion in
the same round, so both implementers are covered and it is not an open item.

One mechanical patch of test call sites wrongly rewrote a *historical narrative*
comment at `reopen_test.go:336`, which describes round-3 code and must not track
the current signature. Reverted that line specifically.

---

## Cross-leg findings

### B4 / A5: COMPLEMENTARY, verified against leg B's real code

My first verdict here was reached against the EM's **prose description** of
`a2cced0`, because inter-clone git remotes pointed at a host path that cannot
exist inside the container. I said so explicitly rather than presenting the
inference as a measurement, and the EM re-issued the diffs on shared disk.

Re-verified against `legB-store-full.diff:414-425` and `:446-461`:

```go
if len(stages) == 0          -> ErrEmptyLifecycleStageSet    // LifecycleStages
if len(b) == 0 || len(a) == 0 -> ErrEmptyLifecycleStageSet   // LabelDeltaLifecycleStages
```

Both predicates are **strictly empty**. No `len < 2`. No nil-vs-empty
distinction (`len()` on nil is 0). Non-implementers are *answered*, not errored.
B4 closes the empty-set fail-open; A5 addresses the non-empty-but-equal case;
the F7 input yields the singleton `{wont_fix}` — because B6 already denies the
bare stock label any authority — so B4's guard is unreachable on it. **They do
not overlap and they do not leave a gap.**

### The disabled-mapper combine-gate item, measured not reasoned

A pass-through store with label mapping **off** was the input most likely to hand
B4 an empty side, and neither leg could test it alone.
`TestLifecycleStageSetStager_NeverReturnsAnEmptySide` sweeps 3 configs (default,
mapping disabled, custom prefix) × 8 label sets × 4 deltas, plus the nil-mapper
path and a detectability control. **No input produces an empty side.**
`AllTerminalLabelStages` returns nil early when disabled, and all three paths
below it supply a fallback. `ErrEmptyLifecycleStageSet` is not reachable from
this implementer.

### The swap seam: my "no seam" verdict was wrong, and here is why

I walked four cases and concluded that any terminal label the swap removes named
a stage that was in the before set and was therefore charged. **The reasoning is
valid. Its unstated premise — one label per stage — is false**, and the four
cases could not express the input that breaks it.

`server.go` charges the stronger scope only when
`!store.SameStageSet(before, after)`, and both sides are **sets keyed by stage**
(`terminal_label_stages.go:176`). Two distinct labels resolving to the same
stage collapse to one element. `StageLabelSwap` deletes one, the reported set is
byte-identical, the gate never fires, **and the label is destroyed for free**.

Measured:

```
labels [ft:completed ft:stage/completed], UpdateTask(stage=completed)
-> remove=[ft:completed]  before=[completed]  after=[completed]  SameStageSet=TRUE
```

The destroyed label is one the reader **counts** — it carries the prefix. This
is not A5's surviving stock label; it is one of our own, deleted under a
`task:write` charge because the gate compares stages and the edit is over
labels. Pinned by `TestSpellingCollision_IsInvisibleToTheStageSetGate`, which
asserts the **defective** behaviour on purpose so r7 cannot close it silently.

**No claim is made anywhere in this round that the swap path is fully gated.**
It is not. The fix needs a delta over labels rather than resolved stages, which
spans both domains, and is r7's.

### M1 — is the seam reachable out of the box? YES

Executed, not read off the map literal. Under `DefaultConfig()`, with zero
configuration, **every one of the ten stages has four authorized spellings**:

```
completed  4: ft:completed  ft:stage/completed  ft:priority/completed  ft:priority:completed
```

The collision is **not in the config table** — `DefaultConfig` ships an empty
`Stages` map, pinned separately by
`TestDefaultConfig_ShipsNoConfiguredStageAliases`. It is in `stripForMatch`,
which strips an optional path segment and is therefore many-to-one *by
construction*. The two readings give opposite answers and both are recorded,
because conflating them miscaps the severity in either direction:

| reading | default config |
| --- | --- |
| configured-alias collisions | **none** — config-gated |
| spelling collisions | **all ten stages** — out of the box |

The pair is not exotic. `StageToLabel` **writes** the `stage/` spelling; the
short one is what a human applies and what round 5's own prose used. **r7 is
urgent, not ordinary.**

A side observation from the same sweep, not chased this round:
`ft:priority:completed` — a label spelled in the *priority* namespace —
authorizes as the terminal *stage* `completed`, because `stripForMatch` removes
priority segments before a stage lookup.

### M2 — does A3 create new collisions? YES. It is my own fix's cost.

Two keys an operator wrote as distinct now address **one** map entry, because
the normalisation that fixed the dead alias also merged the key space:
`shipped`, `ft:shipped` and `ft:stage/shipped` were three keys before A3 and are
one after.

Where they name the same value that is a harmless dedup. Where they name
**different** values, one is silently discarded — and with `range` over a map,
by randomised iteration order. Measured on
`Stages: {shipped: completed, ft:shipped: wont_fix}`:

```
500 mappers built from ONE unchanged config:
   ft:shipped -> completed  60
   ft:shipped -> wont_fix  440
```

**at an authorization gate.** Pre-A3 this was deterministic, because only the
unprefixed key was ever reachable. **A3 traded a dead alias for a coin flip.**
That is a real regression introduced by a fix, and it is recorded here rather
than adjusted away.

Closed in both directions:

- `Validate` **rejects** keys that normalise together while naming different
  values, naming both keys and both values so an operator can act on it.
  Same-value keys stay legal — rejecting those would be a false positive.
- `NewLabelMapper` iterates `Stages`/`Priorities`/`Types` in **sorted key
  order**, so a mapper built without `LoadConfig` is at least reproducible.
  Backstop, not a fix: a deterministic arbitrary winner is still one the
  operator did not choose. 500/500 after the change.

Separately, A3 revives aliases for operators who wrote the key **with** the
prefix — precisely the population round 5's remediation text created. Those
deployments had a dead alias and now have a live one, which is one more label
resolving onto one stage. A3 is still the right fix; it does hand r7 additional
reachable inputs.

---

## Limitations

Forward-referenced from
`TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer`.

- **The tripwire pins two consumers, not "all consumers."** It does not prove no
  third consumer of `LifecycleStage` exists. A new one is not caught unless it
  is added to the test — which is why the doc comment directs new callers to
  `LifecycleStages`. A7 is the proof that this limitation is not theoretical: the
  tree walk was a consumer nobody had enumerated, and it was found by treewalk,
  not by the tripwire.
- **`stripForMatchSegments` is a copy of `stripForMatch`'s segment list.** A
  fidelity test fails if a listed segment stops being stripped. It cannot catch
  a segment *added* to `stripForMatch` and not added here — that direction makes
  the measured collision counts *lower*, so it can understate M1 but never
  invent it.
- **The swap seam is open.** Pinned, measured, not fixed. See above.
- **A5 is benign, not closed.** The scope gate still charges `task:write` for
  `wont_fix -> wont_fix`.
- **`make race` covers `internal/platform/github/` only** (Makefile:19-20). Most
  of this leg's tests land there, so it is meaningful for leg A; it says nothing
  about leg B's additions.
- **The `TestWatchTasks` family is a known load-sensitive flake** (subscribe-
  before-publish ordering, classified by leg B). It is not in this leg's domain.
  A known flake is a licence to dismiss a red run, and dismissing a red run is
  how a real regression gets through — so the exact failing test is named before
  anything is attributed to it.

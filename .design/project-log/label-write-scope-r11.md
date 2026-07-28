# #194 label-write scope — round 11

Branch `label-write-scope-r11`, off `label-write-scope-r10` at
`6d8f19e11f4ddbfdc313301199006d3f7c76eb1c`. Base for every differential:
`06f01d7d6555a311fcd0728eac40335e654c1de6`. Tree confirmed by
`git rev-parse --show-toplevel` and `git rev-parse HEAD` before any edit, as the brief
asked; the branch name was not treated as the identifier.

**Deliverable 9 — probe cells left dirty after restore: ONE, and it was mine.**
It was not left in the worktree, which is where I was looking. See "Process defect" at
the end. Every other mutation and probe was reverted and `git status --porcelain`
asserted empty after each group.

---

## Deliverable 1 first, because it decided the shape of the fix

> *What actually constructs an authoritative lifecycle-stage label, and what is the
> complete set of spellings `authorizationStage` will honour as authoritative, across
> the configurations a deployment can legally hold?*

**What constructs one.** `StageToLabel`, and it is not a convention someone remembered.
Measured for every stage under every `push_prefix` tried — `ft:` `ft2:` `""` `"  "`
`FT:` `acme/` `ft-` `ft.` `ft_` `a:b:` `team/ft:` and a U+200B zero-width space — it
emits exactly

```
pushPrefix + "stage/" + stage.String()
```

with no exceptions. That is where `lifecycleMarker = "stage/"` comes from, and
`TestLifecycleMarker_IsWhatStageToLabelActuallyEmits` fails if it ever stops being true.
The ruling's "the `stage/`-shaped segment that the internal convention actually uses" is
therefore a measured referent, not a guess.

**What `authorizationStage` honours is a much larger and differently-shaped set, and
this is the interesting part the brief predicted would be there.** `stripForMatch` trims
segments SEQUENTIALLY — prefix, then `stage/`, then `priority/`, then `priority:` —
which accepts **eight** segment sequences, only four of which contain `stage/` at all.
Measured under `DefaultConfig`:

```
|labelToStage| = 10 keys  x  8 accepted segment sequences  =  80 authoritative cells
  of those 80, 40 carry NO "stage/" segment          e.g. ft:completed
                                                          ft:priority:completed
                                                          ft:priority/completed
  only 10 of the 80 are spellings StageToLabel ever emits
  with one configured alias the count is 88
  at enabled=false the count is 0
```

**This is what stopped the fix being wrong.** The ruling says "price a label when it
carries a recognised category-segment marker". Applied to the whole write claim, that
would have made the claim set NARROWER than the read set on 40 of 80 cells — a fail-open
gap opened by a fix aimed at closing one, which is round 10's failure mode entered from
the opposite side. So the marker requirement is applied **only to the prefix-VALUE-blind
branch**; the today's-config branch is untouched and is what holds the superset
invariant up. `TestLifecycleStageClaim_IsASupersetOfAuthorizationStage` pins the whole
grid, so a future edit that moves the marker rule into the first branch fails there
rather than in production.

**`ft2:completed` — the spelling the brief explicitly flagged as unmeasured.** It is
**not** authoritative under `push_prefix: "ft2:"` via `StageToLabel`, which never emits
it, and not via a configured alias. It is authoritative via **`stripForMatch`** — the
prefix is stripped and the bare remainder `completed` hits `labelToStage`. So the audit
leg's table row was right about the outcome and the brief was right to distrust the
mechanism.

Its consequence is a **forced residue**, and I want it recorded plainly rather than
buried: `ft2:completed` and `release:completed` are the **same string shape** —
`<namespace><delimiter><bare stage name>` — because `release:` is itself a legal
`push_prefix`. No predicate can price the first and free the second. Round 10 priced
both and denied legitimate work (B2). Round 11 frees both and leaves the residue.
Reaching the residue requires an operator to change `push_prefix` to the exact foreign
prefix already planted. The axis-2 comment now says **NARROWED, not CLOSED**, and names
the residue inline with its measurement.

**Cardinality, since the brief asked and refused to supply one:** 80 under
`DefaultConfig`, 88 with one alias, 0 at `enabled=false`. Ten of the 80 are constructed
spellings; the other 70 are honoured but never emitted.

---

## Open pass, and the diff against the EM's list

**Recorded as contaminated, and I said so at the time.** The EM's dispatch said "read
the brief in full before anything else"; the brief says "do not consult my item list
until you have written the open pass down". Those conflict. I followed the EM's
instruction, so my open pass is **not blinded** and its value as an independent check is
correspondingly reduced. I wrote it down before measuring anything, and I flag below
which items are genuinely not on the list.

| # | open-pass finding | on the EM's list? |
|---|---|---|
| O1 | `lifecycleStagesForLabels` widens BOTH endpoints of a set-difference price; a widened BEFORE collapses onto AFTER and the write prices at nothing | yes — B1 |
| O2 | `canonicalLifecycleLabels` rewrites a non-authoritative label into the local authoritative spelling **in the BEFORE set too**, so the price is computed from a state the system does not believe. This is the *mechanism* of O1 | **the mechanism is not on the list.** B1 names the widened predicate; canonicalisation reaching BEFORE is the specific step, and it is also the round-4 seam breach (below) |
| O3 | `writeViewMapper` mutates `m.writeView` unlocked on a shared cached mapper | yes — B5 |
| O4 | nil-receiver asymmetry: `authorizationStage` panics, `lifecycleStageClaim` allows | yes — B8 |
| O5 | `view.AllTerminalLabelStages` vs `s.mapper.AllTerminalLabelStages` both compile | yes — B9 |
| O6 | `authorizationStage` honours 40 spellings with no `stage/` segment; a marker requirement applied everywhere would DROP them from the claim ⇒ fail-open | **NOT ON THE LIST.** The brief asked for the spelling set as Deliverable 1 but did not connect it to the ruling's marker rule. This is the finding that changed the implementation |
| O7 | a config alias with an **empty key** (`Stages: {"": "completed"}`) puts `""` into `labelToStage` | **NOT ON THE LIST.** Measured at round-11 HEAD below; largely defused by this round's narrowing, not fixed, flagged |
| O8 | `canonicalLifecycleLabels` replaces a claimed label wholesale, destroying any priority/type meaning it also carried | **NOT ON THE LIST.** Measured harmless *for pricing*: the canonicalised set feeds stage computation only |

**Diff against the EM's list, stated as a null where it is one.** The open pass found
**nothing the list missed that is a live defect of the shipped code**. O6 is a defect of
the *fix the brief specified*, caught before it was written — which is the case the
brief was worried about, arriving in the predicted shape. O2 is a sharpening of B1, not
a new one. O7 and O8 are genuine additions and both measure out as non-issues today. The
list was, this time, complete on the things that were actually broken. That is a
measured null and I am reporting it as one.

**O7 measured**, round-11 HEAD, `Enabled: true, PushPrefix: "ft:", Stages: {"":
"completed"}`:

```
labelToStage gains the empty key                            len 11
  ""            claim=(completed,true)  auth=(,false)
  "ft:"         claim=(completed,true)  auth=(completed,true)   <- bare local prefix
  ":"           claim=(,false)          auth=(,false)
  "anything:"   claim=(,false)          auth=(,false)
```

At round 10 the last two would have claimed a stage, because "strip any `<x>:` and match
the remainder" made every namespaced label a candidate and the empty key matched the
empty remainder. This round's marker requirement removes that. What survives is the bare
local prefix `ft:` reading as `completed` — a config-authoring hazard reachable only by
an operator who writes an empty alias key, and its remedy is a load-time check in
`checkLifecycleKeyCollisions`, not a write-time control. **Not fixed here**: it is axis-3
shaped and the brief scopes axis-3 remedies out. Flagged for tracking.

---

## The seam: NO STOP REQUIRED, and the seam was already broken by something else

**What round 4 actually protects**, read from the code rather than from the summary of
it: a **stock GitHub label must not decide a Farm Table privilege question**. It is
enforced by the `push_prefix` requirement in `authorizationStage` — the READ side.

**Does delimiter-agnostic marker recognition undo it? No, and the reason is directional.**
The claim governs the WRITE side. Claiming more there can only ever REFUSE a write.
Refusing is not deciding a privilege question in anyone's favour, so a wider claim cannot
hand a stock label the authority round 4 took away from it. The ruling and the audit
leg's observation are about different positions exactly as the EM guessed — the audit's
slash is *inside the prefix segment before a colon*, the ruling's is *the delimiter
itself*. **They do not conflict, so there is nothing to stop on.**

**But the seam was already broken at round-10 HEAD, by a mechanism the audit did not
name.** `canonicalLifecycleLabels` rewrote a label the deployment does not honour into
the local authoritative spelling and handed the result to the READ predicate —
laundering a mere claim into authority, on the endpoint that decides how much the caller
owes. The `push_prefix` requirement was intact the whole time and simply bypassed
upstream of itself. That is why B1 and the seam are the *same* defect seen from two
directions, and why the pin for them is one file.

**The regression pin** is `internal/server/authz_masked_before_endpoint_test.go`. Every
row asserts three things at once: the write is priced; the write did not land; and **the
READ side did not move**. The third is there because the tempting way to fix the price is
to widen the read predicate, and that would take tasks out of `ft ready` on the strength
of a label any drive-by contributor can apply — round 4's harm, re-inflicted while
passing round 4's test.

---

## B1 — the Critical. What the fix is, and why this one is monotone

**Shape chosen:** floor the BEFORE endpoint at the read side's answer, and make AFTER a
**union**. Not `max(readPrice, writePrice)` over two whole price computations.

Why: the endpoint split makes the invariant a property of the *seam*, so every consumer
of `LabelDeltaLifecycleStages` inherits it. Computing two prices and maxing them makes it
a property of the *caller*, which the next caller does not inherit and no compiler
enforces. The brief said either is monotone by construction and offered a free choice;
the two differ in who has to remember.

```go
before = s.currentLifecycleStages(t, t.Labels)                  // base, byte for byte
rawAfter := applyLabelDelta(t.Labels, addLabels, removeLabels)  // delta FIRST
after = unionStages(
    s.currentLifecycleStages(t, rawAfter),                      // what this deployment will believe
    writeView.claimedStages(..., canonicalAdditions(rawAfter, t.Labels, addLabels)),
)                                                               // what any deployment could
```

**The property test found two real defects in my own fix before it shipped, and neither
was reachable by any example table.** Both are recorded here because the second one is a
result about set-difference pricing that the next round will need.

**Violation 1 — canonicalisation must happen AFTER the delta, not before.**
Canonicalising the caller's additions first hands `applyLabelDelta` a spelling the caller
never sent, and a `remove_labels` entry then cancels an addition the real write still
performs. MEASURED, `DefaultConfig`, CLOSED issue carrying stock `duplicate`:

```
add=[stage/completed]  remove=[ft:stage/completed]
  read predicate    duplicate -> completed    task:close
  shipped draft     duplicate -> duplicate    FREE
```

`canonicalAdditions` now applies the delta to the labels the caller named and rewrites
only entries the caller genuinely contributes — keys already on the task are excluded,
because rewriting *those* is the round-10 Critical itself.

**Violation 2 — a wider AFTER predicate is fail-CLOSED for ENTERING a stage and
fail-OPEN for LEAVING one.** This is the general result. Because the price is a
*difference*, over-claiming on AFTER can make a departure look like a no-op. MEASURED,
`push_prefix " "`, OPEN issue carrying `ft:stage/completed`:

```
add=[stage/completed]  remove=[ft:stage/completed]
  read predicate     completed -> accepted     task:accept
  claim-only AFTER   completed -> completed    FREE          <-- fail-open
```

The write really does reopen the task — afterwards the deployment renders it as
`accepted` — and the claim-only AFTER priced the reopen at nothing because it still
recognised a stage label the deployment does not honour. **"The write predicate
recognises more, therefore it charges more" is false in both directions and I had
written the comment asserting it.** That is the same non-sequitur as B7.1, one level
down, in my own draft. The union removes it: BEFORE is fixed at base, AFTER contains
base's AFTER as an operand, so `writePrice ⊇ readPrice` is a theorem about a cross
product with a fixed left factor and a monotonically growing right factor.

**The pin is a property, and it asserts SET CONTAINMENT, not the brief's
`scopeRank(post) >= scopeRank(pre)`.** `task:claim`, `task:accept` and `task:close` are
independent grants; the codebase has no implication table among them. A rank would have
to invent an ordering, and the pin would then be agreeing with its own invention.
Containment needs no ordering and is strictly stronger — it forbids *swapping*
`task:close` for `task:accept` as well as dropping a charge.

`TestLabelWritePrice_IsMonotoneInThePredicate`: **7200 cells** = 6 configs × 10 label
sets × 15 deltas × 4 stages × 2 closed states. **What it holds FIXED**, since the brief
asks for that and not just the count: one issue, one task, no config *change* mid-cell
(the config axis is swept across cells, not within one), no concurrency, and the
reference arm pinned to the unexported helper the seam itself uses so it cannot drift
into agreeing with a copy of the policy. Its positive control is
`TestLabelWritePrice_MonotonicityPinCanFail`.

*(Correction to my own commit message on `e993b4a`: it says "6720 cells". The correct
count is 7200; the test asserts the product itself, so the code was right and the prose
was a transposition.)*

---

## B2–B9, briefly, with what is worth knowing about each

**B2 — live denial dissolved for four of the brief's five rows, and the fifth must not
dissolve.** Measured at round-11 HEAD: `status:duplicate`, `kanban:working`,
`release:completed` and `epic:cancelled` all claim nothing and are allowed again;
`stage/completed` still claims `completed` and is still charged, **correctly** — the
marker is at position 0, which is a segment boundary, so the ruling requires it priced.
See brief-wrongness item 5. The brief was right that
`TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages` could not fail for the reason
it was written; **eight** rows added, five of which are the free namespaced spellings and
one of which — `ft-stage/completed` — is a positive control that is *charged*, so the
table cannot pass by freeing everything.

**B3 — delimiter gap closed for 7 of the brief's 10 spellings; 2 are the forced residue
above; the axis-2 comment now reads NARROWED with the residue named inline and measured.**

**B4 — `push_prefix` constrained in `Validate()` to the delimiter class the claim
recognises.** The coordinator's zero-operational-cost ruling is cited **and scoped to
this deployment in the comment**, not restated as a general claim. The error message says
what to do. `TestPushPrefixDelimiterClass_MatchesWhatTheClaimRecognises` drives both
directions, so "every legal prefix is recognised" is true by construction.

**B5 — the view is built eagerly in `NewLabelMapper`.** `LabelMapper` is immutable again,
which is why there is no mutex rather than a mutex someone has to remember. The comment
names the *worse* race the audit found (a read of the new mapper's config field racing
construction, every outcome of which biases toward pricing a write free) because that is
the one a future reader will not re-derive.

**B6a — the brief's claim verified by mutation, not accepted.** Removing `registerLabel`
reports "POSITIVE CONTROL IS HOLLOW" on exactly **3 of 5** axes — the same three the
brief tabulates. **B6b** — the `absent` oracle now reads `row.add`/`row.remove`; because
`containsLabel` is exact-match, the case-split row needed `containsLabelFold` or the
"fix" would have *weakened* the assertion. **B6c** — `executed++` moved inside `t.Run` in
both counters.

**B7 — all six false comments corrected**, plus the round-10 log (below). Where a comment
made a true measurement and drew a false conclusion, the measurement is kept and the
conclusion is scoped rather than deleted.

**B8 — `assertStageWriteAllowed` refuses when `s.mapper == nil`**, at the gate and not in
the predicate: a predicate that answers "not a stage" for a nil mapper is answering a
question it cannot answer. The comment records *how it was found* — by reading two
functions side by side, after two sweeps of 8400 cells and 204 pairs both missed it,
because a sweep varies inputs and this is a property of the receiver.

**B9 — `type writeView struct{ *LabelMapper }`, with `claimedStages` declared only on
`writeView`.** `s.mapper.claimedStages(...)` does not compile. The comment names the
mechanism, per the brief's warning about inert structural controls on a sibling branch:
**the receiver type is genuinely checked by the compiler**, which is the difference
between this and a control that merely looks structural.

---

## Deliverable 5 — the differential against base, and which arm fired

Method: hold the round-11 tests constant, revert the production files to round-10
content, enumerate failing **subtest names**. Nine subtests fail, and each fails with the
message belonging to the arm it is testing:

| subtest | arm that fired at r10 |
|---|---|
| `…APresentLabelCannotDiscountALifecycleWrite/stock_github_duplicate_masks_nothing` | "A LIFECYCLE WRITE WAS FREE" |
| `…/bare_english_stage_name_masks_nothing` | "A LIFECYCLE WRITE WAS FREE" |
| `…/foreign_prefix_does_not_launder_into_local` | "A LIFECYCLE WRITE WAS FREE" |
| `…/control_nothing_present`, `…/control_ordinary_label_present` | **pass at both** — the controls discriminate |
| `…PriorityAndTypeAxesDoNotPriceStages/foreign_namespace_{status_duplicate,kanban_working,release_completed,epic_cancelled,while_disabled}_is_free` | "DENIAL OF LEGITIMATE WORK" |
| `…/marker_at_a_boundary_is_charged_positive_control` (`ft-stage/completed`) | free at r10, charged here |
| `TestUpdateTask_ThePricedLifecycleWriteStillLands` (all 5) | **passes at both** |

So B1's arm and B2's arm fire in opposite directions in the same differential, and both
controls hold — which is what distinguishes "the fix changed the price" from "the fix
denied or freed everything".

**One honest limit on this method, per the brief's own rule about checking a RED is not a
build failure.** The github-package property test **cannot** be differentiated this way:
it uses unexported helpers introduced by the fix, so reverting the production files makes
the package fail to build, and a build failure is not a measurement. Its differential
evidence is instead the two violations it *found* during development (both measured
above, both in code I had already written and believed) plus its own positive control.

---

## Deliverable 6 — gates, re-measured, with `-race`

| gate | result |
|---|---|
| `go build ./...` | **0** |
| `go vet ./...` | **1** — exactly the four pre-existing copylocks at `server.go:{1782,1892,2100,2277}`, no new messages, zero `web/dist` messages |
| `go test ./... -count=1 -skip 'TestWatchTasks'` | **0**, tripwire grep for `TestWatchTasks` in the output: **0 hits** |
| `go test -race ./internal/platform/github/ ./internal/server/ -count=1` | **0**, no `DATA RACE` |
| `go test -race ./... -count=1 -skip 'TestWatchTasks'` | **0**, no `DATA RACE`, tripwire **0 hits** |
| `git status --porcelain` | empty |

`web/dist` was built first, so the vet run is the four-copylock run and not the quiet
`pattern all:web/dist` run that exits 1 for the wrong reason. No gate command whose exit
code I read was piped. **`-race` is added to this package's gate set** as B5 requires.

---

## Round-10 project log: corrected, and its arm table re-measured

Three narrative citations in D1 read `labels.go:393` for `MapLabelsToStage`. That line is
`StageLabelSwap`, which is not on the price path at all; the same document's D2 guard
table had it right at `labels.go:249`. Corrected in place.

The arm table was **re-run from scratch** at base `06f01d7` in a throwaway worktree
rather than taken from either document. Verified guard locations at that SHA:
`AllTerminalLabelStages` `terminal_label_stages.go:198`, `authorizationStage`
`terminal_label_stages.go:70`, `MapLabelsToStage` `labels.go:249`.

| arm | priced | agrees with r10? |
|---|---|---|
| positive control, `enabled=true` | 7/8 | yes |
| A baseline | 0/8 | yes ("8/8 collapse") |
| B unguard `:198` only | 0/8 | yes |
| C unguard `:70` only | 0/8 | yes |
| D both | 5/8 — all five terminal shapes; both non-terminal still collapsed | yes |
| E D + `labels.go:249` | 7/8 — identical to the control | yes ("full parity") |

**No row disagreed.** The round-10 conclusion — three independent suppressors, no proper
subset sufficient — reproduces exactly.

---

## Deliverable 8 — everywhere this brief is wrong. Required, so here it is.

1. **"Corrected, arm E reportedly moves from 4/8 to 6/8 full parity."** Wrong on both
   numbers. Measured: D is **5/8** and E is **7/8**. Parity is 7/8 and not 8/8 because
   `add_unrelated` is correctly free in every arm including the positive control, so the
   brief's "6/8" is not even the right shape of number. The brief flagged this one as
   unverified and asked me to measure it; I did, and it was wrong. It says it propagated
   this into two briefs.
2. **"Assert `scopeRank(postPrice) >= scopeRank(prePrice)` pointwise" (B1).** Presumes a
   total order on the scope vocabulary that does not exist. `task:claim`, `task:accept`
   and `task:close` are independent grants with no implication table anywhere in the
   codebase. Implementing this literally would have required inventing a rank and then
   pinning the fix against my own invention. Shipped as set containment, which is
   strictly stronger.
3. **"Floor the BEFORE endpoint at the read side's answer, or charge
   `max(readPrice, writePrice)`. Either is monotone by construction" (B1).** The first
   half is not sufficient on its own. Flooring BEFORE while leaving AFTER as the claim
   answer alone is **not** monotone — measured above, `push_prefix " "`, an
   `accept`-priced reopen going FREE, because a wider AFTER is fail-open for *leaving* a
   stage. The union is required. The brief's "either is monotone by construction" is the
   same premise-true/conclusion-false step it correctly diagnoses in B7.1.
4. **"`lifecycle_claim.go:166` (`stripAnyLifecyclePrefix`)" (B2)** — a single named
   locus for a behaviour that lives in `stripForMatch`'s sequential trimming plus the
   claim's branch structure. The brief's own failure-mode 2 predicts this, and narrowing
   to that one function would have produced a fix that broke the superset invariant on 40
   of 80 cells. This is the item where the brief's targeting could still have steered a
   leg wrong even though every sentence in it is true.
5. **B2's table lists `stage/completed` among the denials that "should dissolve" under
   the ruling's marker requirement. It must not, and it does not.** `stage/completed`
   carries the marker at position 0, which is a segment boundary, so the ruling
   *requires* it priced — it is the marker spelling itself, minus a prefix. Measured at
   round-11 HEAD: the other four rows claim nothing and are allowed; this one claims
   `completed` and is charged. A leg implementing B2 literally, treating the five-row
   table as a set of regressions to clear, would have freed the one label the ruling most
   clearly says to charge, and the B2 table would have gone green while doing it. The
   other four rows are correct.
6. **B6a's table is right and its explanation is incomplete.** Verified by mutation: 3 of
   5 axes go hollow, exactly the three tabulated. But the brief attributes it to
   `labelNamesToIDs` alone; the assertion also has to be **case-insensitive**, because
   `containsLabel` is exact-match and one axis round-trips the label through
   `strings.ToUpper`. Following B6a literally would have added a landed-assertion that
   *weakened* that row.
7. **"`ft2:completed` … I do not know whether it comes from `StageToLabel`, from a
   configured alias, or from `stripForMatch`" (Deliverable 1).** Correctly flagged as
   unmeasured; the answer is `stripForMatch`. Recorded here because the brief said its
   answer decides whether the fix loses a real spelling, and it does: it forces the
   residue in B3, which no predicate can remove.
8. **The dispatch and the brief give conflicting instructions.** "Read the brief in full
   before anything else" cannot be obeyed together with "do not consult my item list
   until you have written the open pass down". The open pass is contaminated as a result
   and I have marked it so. This is a defect in the *instructions*, not in either
   document alone, and it degrades exactly the control the brief says it most wants.
9. **Not a wrongness, a note: the environment section is accurate and it saved time.**
   `web/dist`, the vet-exits-1-for-the-wrong-reason trap and the
   `go build ./... | tail` exit-code trap all reproduced as described. The
   `TestWatchTasks` flake did not fire in any run this round.

---

## Process defect: the one dirty cell, and why my check could not see it

Commit `bc93200` was meant to carry test-side work only. It also carried
`config.go`, `lifecycle_claim.go` and `passthrough.go` still reverted to round-10
content, because that revert was the **differential probe** running at the time and
`git commit` picked it up with everything else.

I checked for dirty probe cells the way the round-10 log describes — restore, then
`git status --porcelain` — and it was clean, because the restore had already run. **The
check looked at the worktree and the dirty cell was in the commit.** A restore that
happens after the commit leaves no trace a status check can find.

Measured rather than asserted: a detached worktree at `bc93200` fails the three attack
rows of the round-4 seam pin with "A LIFECYCLE WRITE WAS FREE" and passes both controls —
i.e. the commit was live-broken with the round-10 Critical, and the pin written this round
caught it. Repaired in `93ae124`, restoring the three files to their `e993b4a` content
byte-for-byte (`git diff e993b4a -- <each>` empty, checked per file). No new work was
smuggled into the repair.

**The lesson for the next round, since this is the kind of thing that recurs:** when a
differential is run by reverting production files in the working tree, `git commit`
during that window is unsafe, and the post-hoc worktree check cannot detect the mistake.
Either run differentials in a separate worktree — which is what I did for the arm table
and why the arm table has no such problem — or diff the *commit* against the last good
commit for the files the probe touched.

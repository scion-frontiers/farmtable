# RULING — #194 PRICING SEMANTICS: WHAT A LABEL EDIT MUST COST

**Author:** `dev-194-pricing` · **Track:** `farmtable-em-hardening` · **Date:** 2026-07-29

**Status:** RULING **+ IMPLEMENTED AND MEASURED.** Oracle committed RED before
this was written; implementation deliberately not written at time of ruling, by
instruction. **§13 is the execution record and was appended afterwards** — the
ruling above it stands as written, with every statement the measurements later
overtook **struck in place rather than edited away.** Three such strikes: the
CreateTask reroute (§5), the D2a coupling claim (§6), and my own stop rule (§8).
**Read the strikes; two of them are worth more than the corrections.**

---

## 0. ARTEFACT AND PROVENANCE

Every figure below is labelled with the tree it was measured on. A fresh checkout
proves you measured the commit; it does not prove you measured the right thing,
so the artefact is named too.

| | |
|---|---|
| **ARTEFACT** | Go test binaries for `internal/server` and `internal/platform/github` in module `github.com/farmtable-io/farmtable` |
| **NOT the artefact** | `ft dashboard` (Dockerfile) and `farmtable-server` (Dockerfile.server, the live binary per deploy logs). No claim here is about a container or a deployed image. The gate code compiles into `farmtable-server`, but I measured the package, not the image. |
| **BASE** | `2cbbd92` = `refs/preserve/194-r11/branch` — the round-11 work under judgment |
| **ORACLE BRANCH** | `2ffc22a` = `refs/preserve/194-oracle/branch` |
| **MY BRANCH** | `dev/194-pricing-ruling`, tip **`1253e12`**. Full commit list in §13. |
| **MAIN** | `43bd206`. **Not my base.** Main does not contain the r11 symbols at all, so no figure about r11 can be taken there. |
| **PUSHED** | Nothing. Only the EM pushes. |

---

## 1. THE RULING IN ONE SENTENCE

> **A safety margin must never live inside a set difference.**
>
> The price of a label edit is **two independent set differences — departures and
> entries — computed with different predicates**, not one equality comparison and
> not a cross product.

Round 11 is not wrong about its machinery. It is wrong about the **shape** of the
price function. That distinction is the whole ruling, and it is why my
recommendation is **repair r11 surgically, NOT abandon it** — a reversal of my own
first position, forced by measurement, documented in §4.

---

## 2. THE DEFECT, STATED PROPERLY

The price is computed as a difference between a BEFORE stage set and an AFTER
stage set. Round 11 widens the AFTER endpoint with a config-blind "claim view"
union, to satisfy the round-10 ruling that a label must be priced against what it
could *ever* mean, not what today's config says.

**A wider AFTER endpoint is not uniformly safe. It is directional:**

| | effect of widening AFTER |
|---|---|
| **ENTERING** a stage (`entered = after \ before`) | **fail-CLOSED** — a wider minuend charges more |
| **LEAVING** a stage (`departed = before \ after`) | **fail-OPEN** — a wider subtrahend charges less |

Round 11 states this sentence in its own docblock and then unions the single
AFTER endpoint anyway, forcing one set to do both jobs. The widened AFTER
restores the very stage the caller is removing, the departure difference collapses
to empty, and **leaving a lifecycle stage costs nothing.**

Its monotonicity theorem (`writePrice ⊇ readPrice`) is **true and does not help.**
It bounds the new price below by the old price. For the departure vector both are
zero, and zero ⊇ zero.

**This single sentence explains the round-10 Critical, the round-11 union, and D1
together.** Eleven rounds treated them as three problems.

---

## 3. THE PRICING SEMANTICS — THE OPERATIVE RULE

For a label edit on a task, with `narrow(·)` = the READ predicate
(`AllTerminalLabelStages`, falling back to `IssueToPhaseStage` on the labels
given) and `wide(·)` = narrow ∪ the config-blind claim view:

```
departed = narrow(before)  \  narrow(after)        # READ predicate BOTH sides
entered  = wide(after)     \  narrow(before)       # claim view on the AFTER side ONLY

price = ⋃ scopeToLeave(f) for f ∈ departed
      ∪ ⋃ scopeToEnter(t) for t ∈ entered
```

Four consequences, each deliberate:

1. **No equality gate.** `SameStageSet` is deleted from the decision path. An
   edit is priced by what changed, not by whether anything changed.
2. **No cross product.** r11 charges `|before| × |after|` pairs. Most such pairs
   are not transitions — both endpoints persist across the edit. The cross
   product is a **source of over-denial**, and removing it charges strictly
   fewer scopes. This matters: four of nine items on this track were
   over-denial.
3. **The claim view stays, confined to the entry difference.** It is
   load-bearing (§4) and only in the wrong place.
4. **`task:write` remains the free pass** where the transition table says so.
   I am not touching the table.

### The boundary — checked explicitly

The standing test is: does this alter **WHO IS AUTHENTICATED**, **WHAT THEY MAY
DO**, or **HOW THAT IS DECIDED**?

- **Scope vocabulary:** unchanged. **Transition table:** unchanged. **Who holds
  what:** unchanged. **Authentication:** untouched.
- What changes is **which transitions a given edit is recognised as performing**
  — a correctness fix to the *input* of an unchanged decision procedure.
- The one behavioural change is that a departure that is currently free stops
  being free. That is the assigned defect, not a scope expansion. **I flag it
  rather than assume it:** if the EM reads "a currently-permitted operation
  becomes denied" as crossing the line even when the permission is the bug,
  stop me before the implementation lands.

---

## 4. WHY NOT SIMPLY DELETE THE UNION — MEASURED

Two-sided mutation experiment. **Tree deliberately dirty; a mutation is dirt by
definition and the dirt is the point.** ROOT=`/workspace/farmtable-194-pricing`,
commit `2ffc22a`, artefact = `internal/server` + `internal/platform/github` test
binaries. Mutation = delete the union from the AFTER endpoint of
`LabelDeltaLifecycleStages`.

| | union present (baseline) | union deleted |
|---|---|---|
| D1 free-removal | RED | **green** |
| D3 | RED | **green** |
| `TestLabelWriteScope_IsBlindToTodaysConfig` | green | **RED — 4 falsifying cells** + its own vacuity guard |
| `TestLabelWriteScope_PriorityAndTypeAxesDoNotPriceStages` | green | **RED — 2 positive controls** |

The 4 falsifying cells: `axis1_enabled_false`, `axis2_foreign_push_prefix`,
`axis2_foreign_prefix_and_disabled`, `axis3_configured_alias_while_disabled`.

**Conclusion: the union is LOAD-BEARING.** Deleting it is the obvious fix and it
regresses the round-10 ruling. This measurement is what reversed my initial
"abandon r11" recommendation. The machinery is right; only the shape is wrong.

This tension is now pinned permanently by
`TestLabelWritePrice_ChargesBothDirectionsInOneBuild` (`3604b1e`), which asserts
**both directions in one build** so no future round can satisfy it by trading one
for the other. At `3604b1e`, fresh detached checkout, clean tree:

| arm | predicted | observed |
|---|---|---|
| `departure_is_charged` | RED | **RED** ✓ |
| `entry_under_a_foreign_prefix_is_charged` | GREEN | **GREEN** ✓ |

Predictions pre-registered in `912188e`, which contains no observations.
The departure arm's read-back is `[completed wont_fix] -> [completed]`,
`wont_fix still present? false`: **the write is not merely permitted, it is
effective.**

---

## 5. THE THREE GATE SITES — THE COUNT, NOT JUST THE LOCATION

**THERE ARE THREE.** A prior brief scoped this to one of three and both review
legs called that its most material error. All three are in `internal/server/server.go`
at `2ffc22a`, and all three today share the same broken equality-gate shape.

| # | site | today | under this ruling |
|---|---|---|---|
| 1 | **CreateTask** (~199-215) | prices `stage -> to` per `to` | ~~route through the split~~ → **UNCHANGED as shipped.** See the correction below. |
| 2 | **InsertTasksAfter** (~383-397) | **rejects** with `InvalidArgument` | **UNCHANGED. Deliberately.** See §6. |
| 3 | **UpdateTask** (~841-861) | cross product `before × after` | the full directional split. This is where D1 and D2 live. **The only site repriced.** |

**CORRECTION, MADE AT `0904a22`, STRUCK NOT DELETED.** I planned to route
CreateTask through the split too, for the stated reason that one code path beats
two. I did not, and the reason is a better one than tidiness: **CreateTask cannot
be driven with a removal.** `remove_labels` is not a field on its request
message, and its BEFORE endpoint is a synthetic task carrying no labels, so
`departed` is identically empty there. Rerouting it would have been a
behaviour-neutral refactor of a security gate, performed in the same commit as a
security fix, with no oracle that could tell the two apart if I got it wrong.
The narrower change is the one that can be reviewed. The cost is honest and
recorded: **two gate shapes now coexist**, which is why the census was made
additive rather than switched over.

`TestPricingGateSiteCensus` (AST-based) pins this population, and as of `0904a22`
it pins **which gate function each RPC routes through** as well as that the site
exists. It is not a guard on my say-so — see §13 for the three liveness arms that
made it go red for the three distinct reasons it exists.

---

## 6. DISPOSITION OF D1 / D2 / D3 — THE REQUIRED ANSWER

### D1 — free removal of a lifecycle stage · **DISCHARGED**
Computing `departed` with the READ predicate on **both** endpoints removes the
union's fail-open effect from the departure direction. The claim view no longer
reaches the subtrahend.

### D2 — order sensitivity · **DISCHARGED**
Both `D2a` (`SameStageSet` is elementwise while named as a set comparison) and
`D2b` (authorization depends on canonical stage order) fall out. `SameStageSet`
leaves the decision path entirely; set differences are order-insensitive by
construction.

~~**The coupling fact in my brief is confirmed and superseded.** Making
`SameStageSet` a real set comparison *would* turn D2 green **and widen D1** —
which is exactly why I am not doing that. Removing the comparison from the
decision path discharges D2 without touching D1's exposure.~~

> **STRUCK AT `1253e12`. THE PARAGRAPH ABOVE IS WRONG IN ITS SECOND HALF AND THE
> ERROR IS WORTH MORE THAN THE CORRECTION.**
>
> I did make `SameStageSet` a real set comparison — D2a demands it on its own
> merits and it shipped in `0904a22`. What I had not appreciated is **how** the
> brief's coupling fact bites. It does not "widen D1" in the sense of making the
> gate more permissive by degrees. Measured at `037a626` with **only** the
> set-semantic hunk applied and no directional split:
>
> ```
> masked removal of `completed`  ->  ALLOWED
> read-back: [wont_fix completed] -> [wont_fix]   completed still present? FALSE
> ```
>
> **D2a's fix is a REGRESSION ON ITS OWN.** The elementwise comparison had been
> catching that vector **by accident of where `unionStages` appended the restored
> element** — an ordering artefact, not a pricing decision. Making the comparison
> honest removes the accident, and without the directional split nothing replaces
> it.
>
> Hence: **THE TWO HALVES OF ROUND 12 ARE COUPLED AND LAND TOGETHER OR NOT AT
> ALL.** That is not a request in a document. It is enforced — see §13.

### D3 — `InsertTasksAfter` over-denies stock GitHub labels · **NOT DISCHARGED. LEFT OPEN, AND RULED UNSOUND AS WRITTEN.**

I am not discharging D3, and I rule that **it should not be discharged in its
current form**. Three independent grounds, any one sufficient:

1. **Its premise is measurably false.** D3 asserts its label set "names no
   lifecycle stage." At `2ffc22a`: `MapLabelsToStage("duplicate") = (duplicate,
   true)`, and `closed` ⇒ `duplicate`. The label *does* name a lifecycle stage.
   An oracle whose premise is false cannot be turned green honestly.
2. **It demands PERMIT under `agentScopes()`**, which is
   `{task:read, task:write, task:claim, collection:read}` — **no `task:accept`,
   no `task:close`**. Granting it creates a **triage bypass** the moment
   `InsertTasksAfter` is implemented for the pass-through store.
3. **It is out of scope by the standing test.** It alters **WHAT THEY MAY DO**.

The coupling fact in my brief holds: deleting the `InsertTasksAfter` rejection
turns D3 green **and breaks the existing control**
`TestInsertTasksAfter_RejectsLifecycleStageLabels`. Trading a real control for an
unsound oracle is a net loss.

**D3 is predicted RED after my change, and that prediction is recorded in advance
(`912188e`) so it cannot later read as an unexpected casualty of my fix.**
The EM has independently ruled D3 abandoned twice over; this ruling reaches the
same place from the measurements, and I state it as my own finding.

---

## 7. "D4" — DEAD. LATENT HAZARD, NOT A LIVE DEFECT.

I reported a fourth defect **before writing its oracle**. Then I wrote the oracle
and **it passed.** I retracted it unprompted. Recorded here because a retraction
that does not travel with its claim is worthless.

- **MEASURED.** Two predicates genuinely disagree at `2ffc22a`:
  `authorizationStage` (`terminal_label_stages.go:116-125`) **requires** the push
  prefix; `MapLabelsToStage` (`labels.go:279-291`) does **not**. For `"duplicate"`:
  `MapLabelsToStage=(duplicate,true)`, `authorizationStage=("",false)`,
  `AllTerminalLabelStages=[]`.
- **NOT MEASURED / FALSE.** My claimed mechanism — that `currentLifecycleStages`
  falls back to stale `t.Stage`, making both endpoints identical. **It does not.**
- **THE COMPENSATING CONTROL, NAMED.** `currentLifecycleStages`
  (`passthrough.go:1230-1236`) falls back to
  `IssueToPhaseStage(taskIssueState(t), taskStateReason(t), labels)` — **on the
  labels it was handed**, not on `t.Stage`. Each endpoint resolves from its own
  label set through the same parser the read path uses, so the divergence never
  reaches the subtraction.
- **PRECONDITIONS for it to bite:** that fallback would have to be changed to use
  `t.Stage` or `authorizationStage`. Checked: it currently does neither.

The oracle is retained as a **labelled negative result** and renamed
`authz_194_label_spelling_negative_result_test.go` — an unlabelled passing oracle
is read as a guard by the next person. It now also guards the compensating
control: if someone changes that fallback, this test tells them.

**DO NOT UNIFY THE PARSER.** I recommended it; the EM ruled it; **the ruling was
reversed on my own reasoning** — it is a refactor of the authorization predicate
with no demonstrated defect behind it, and it risks turning currently-permitted
transitions into denied ones. Filed as backlog **A9 with the retraction attached**.

---

## 8. TWO-SIDED ACCEPTANCE — MANDATORY, PRE-REGISTERED, **NOW RUN (see §13.3)**

Two-sidedness is a **precondition for landing**, not a post-hoc check. The remedy
must still DENY what must be denied **and still PERMIT what a legitimate user may
do.** Written before the implementation exists:

**MUST STILL DENY** — departure of a lifecycle stage without `task:accept`/`task:close`
(D1, masked or plain); entry under a foreign push prefix; entry while the mapper
is disabled; entry via a configured alias while disabled; the existing
`InsertTasksAfter` lifecycle-label rejection.

**MUST STILL PERMIT** — priority and type label edits (they price no stage: 2
positive controls in `PriorityAndTypeAxesDoNotPriceStages`); any edit whose
narrow stage set is unchanged in both directions; `working → handoff` on
`task:write`; every create currently accepted by `CreateTask`; all
non-lifecycle label churn.

**Standing commitment:** the cross-product removal makes the permit side strictly
*more* permissive, which is the direction that needs the most scrutiny for
under-denial, and the deny list above is where I look for it. ~~**If any
currently-permitted transition becomes denied, I STOP and report before
committing**~~ — corrected by the EM, and the correction was necessary: **the
free departure becoming denied IS THE DELIVERABLE**, so the rule as I wrote it
would have halted me on the intended effect. Operative rule: **STOP IF ANY
TRANSITION OTHER THAN THE FREE DEPARTURE BECOMES DENIED.** I do not ship it
because it is more correct.

---

## 9. WHAT I AM ROUTING, NOT FIXING

**Ungated label path on main — `43bd206`.** Self-verified via `git show > /tmp/…`
with no checkout, ROOT=`/workspace/farmtable`.

- **MEASURED.** Exactly **2** `TransitionScope` call sites (lines 122, 538), both
  keyed on `req.Stage`. **8** label expressions, all bare assignments — none
  priced. Positive control: **29** `RequireScope` sites found, so the instrument
  was working. `labels.go:96` self-registers stage names; `MapLabelsToStage`
  (line 157) does not require a prefix.
- **NOT MEASURED.** A working exploit. I did not build or run one.
- **PRECONDITIONS.** Requires a caller able to reach the label-write path on the
  main-line store with `task:write` alone. Not checked.

Routed at that strength, structural/inferred split intact. **Not mine to fix.**

**Credential exposure.** A live GitHub PAT is emitted by `git remote -v` in
`/workspace/farmtable`. I reported it by location and did not reproduce the
value. It is a **new instance of a known exposure**, on the owner's ledger,
**ACCEPTED RISK BY OWNER INSTRUCTION — NOT RESOLVED.** It is not handled, not
mitigated, not fixed, and nothing here makes it safe.

---

## 10. INSTRUMENT ERRORS I MADE, AND HOW THEY WERE CAUGHT

Recorded because a ruling that hides its own misfires is not auditable.

1. **"0 files on main"** — artefact of a missing ref, not an absent symbol. `main`
   does not exist in the oracle tree; `2>/dev/null | wc -l` returned 0 for *ref
   absent*, which I read as *symbol absent*. Re-measured at `43bd206` with
   positive controls. Self-caught.
2. **Same error, second time, caught by a control I had added because of the
   first.** Probing the manifest at `43bd206` from a clone that does not contain
   that ref. The positive control (`git cat-file -t 43bd206` → not present) fired
   and I discarded the result instead of reporting "main has no manifest."
3. **Wrong artefact via persistent shell cwd.** An earlier `cd /workspace/farmtable`
   persisted; three subsequent commands ran against main's tree. One was a `mv`
   joined by `&&`, so it short-circuited and **`go vet` never ran** while printing
   an exit code that looked like a vet result. All three discarded and re-run
   pinned to an explicit ROOT. **This is the EM's "clean instrument, wrong target"
   hazard reproduced exactly, by me, an hour after being warned about it.**
4. **D4 reported before its oracle was written.** §7.

**The generalisation:** every one of these is *confident answer to a question I
never checked*. Instrument hygiene does not catch it — only naming the artefact
in the same sentence as the result does.

---

## 11. PRE-EXISTING, NOT INTRODUCED, NOT FIXED

`go vet ./internal/server/ ./internal/platform/github/` at ROOT=`/workspace/farmtable-194-pricing`,
commit `2ffc22a`: **4** copylock findings in `internal/server/server.go` (1782,
1892, 2100, 2277). This is the quartet already fixed on main at `43bd206`; it
appears here only because my base predates that fix. None are in my files; my
commits add test files only. Not fixed inside this change, gate not weakened.

**Manifest.** `.github/` at `2ffc22a` contains only `ISSUE_TEMPLATE/bug_report.md`
and `PULL_REQUEST_TEMPLATE.md` — **no workflow, no `expected-go-tests.txt`.** At
`43bd206` the manifest exists (501 lines, `<import path>\t<TestName>`). I am
**not** creating it on this branch: authoring a 501-line manifest to make a gate
pass is regeneration by another name. The two lines to append at merge, by
whoever lands this:

```
github.com/farmtable-io/farmtable/internal/server	TestLabelWritePrice_ChargesBothDirectionsInOneBuild
github.com/farmtable-io/farmtable/internal/platform/github	TestLabelWritePrice_DoesNotDependOnLabelSpelling
```

*NOT MEASURED:* whether the gate keys on subtest names too. If it does, more
lines are needed. I did not read the matcher.

---

## 12. SEQUENCING ATTESTATION

`/scion-volumes/scratchpad/projects/farmtable/reports/architect-194-ruling.md` was
**ABSENT** at the moment this ruling was committed (checked by `test -e`, not
opened). This ruling was reached independently. I have not messaged, briefed, or
woken that agent.

---

## 13. ROUND-12 EXECUTION RECORD — WHAT WAS BUILT AND WHAT IT MEASURED

**ARTEFACT for everything in this section:** the `internal/server`,
`internal/platform/github` and `internal/store` **test binaries**, module
`farmtable`. Not a container image; not `ft dashboard`; not `farmtable-server`;
not `Dockerfile` and not `Dockerfile.server`. Nothing here is a statement about
the deployed service.

**COMMITS** (branch `dev/194-pricing-ruling`, clone
`/workspace/farmtable-194-pricing`, base `2ffc22a` on `2cbbd92` = r11, **NOT
main**). **NOTHING IS PUSHED. Only the EM pushes.**

| SHA | contents |
|---|---|
| `912188e` | pre-registration, results-free |
| `3604b1e` | the two RED oracles |
| `7b392b1` | project log |
| `037a626` | pre-registration + the direct oracle, results-free |
| `99d5df8` | pre-registration, arms L1/L2/L3, results-free |
| `598014c` | pre-registration, arm L2b, results-free |
| `1c48795` | pre-registration, arm L3b, results-free |
| **`0904a22`** | **the fix — BOTH HALVES + the additive census** |
| **`1253e12`** | **the `priceOf` repoint + the struck original** |

### 13.1 THE THREE-POINT MEASUREMENT THAT DECIDED IT

The question: does the real gate charge the vector `priceOf` complained about,
or was the copy right? An inference was refused as the instrument. Vector:
`labels=[ft:stage/wont_fix ft:stage/completed]`, `add=[stage/completed]`
(markerless, ignored by this deployment), `remove=[ft:stage/completed]`, scopes
`{task:read task:write task:claim collection:read}` — **no `task:accept`, no
`task:close`**.

| arm | tree | result | **cause** |
|---|---|---|---|
| 1 | `037a626`, **fresh clean checkout**, no impl | DENIED | **the ordering accident.** `completed` sorts first, `unionStages` appended behind `wont_fix`, orderings disagreed, elementwise compare charged it |
| 2 | `037a626` + **only** the set-semantic `SameStageSet` hunk | **ALLOWED** | the accident is gone and nothing replaced it. Read-back `[wont_fix completed] -> [wont_fix]`, `completed` present? **FALSE** — **effective, not merely permitted** |
| 3 | `0904a22`, both halves | DENIED | **the departure mechanism** |

**Arms 1 and 3 are both GREEN AND THEY ARE NOT THE SAME GREEN.** That is the
finding, and no composition over passing tests could have produced it: a
composition cannot distinguish "denied for the right reason" from "denied by an
artefact", because both present as green. Arm 2 is also the **non-vacuity proof**
for the direct oracle — it can go red for the reason it exists.

**HOW ARM 1 WAS CAUGHT.** My pre-registration bound GREEN to "proceed". I got
GREEN. I then ran a positive control I did not strictly need — the oracle at a
checkout where **the implementation does not exist** — and it was **GREEN THERE
TOO.** A test green with and without the fix carries no information about the
fix, and I had been about to spend that green on the one decision I had been
told not to make on a weak instrument.

### 13.2 GUARDS, AND THE ARMS THAT PROVE THEY ARE ALIVE

Every arm below was **predicted in writing, in a results-free commit, before it
was run.** A guard only ever seen green is a green light with unknown wiring.

| arm | mutation | predicted | observed |
|---|---|---|---|
| **L1** | a 4th gate site with no oracle | RED | **RED** — names the unlisted RPC |
| **L2** | the `gate` column lies about CreateTask | RED, *different message* | **RED** — population intact, routing mismatched |
| **L2b** | the tempting swap: drop `SameStageSet` from the recognised set instead of appending | RED | **RED** — population collapses to `[UpdateTask]`, 1 site where it should see 3 |
| **L3** | drop the **entry** vector inside the REAL `PriceLabelWrite` | RED | **RED — 64 cells** |
| **L3b** | drop the **departure** vector inside the REAL `PriceLabelWrite` | RED | **RED — 108 cells** |

**L2b and L3b were not in the original registration and I added them because
they were missing, each in its own results-free commit before running.** L2b
tests the EM's actual condition (ADDITIVE ONLY) rather than merely that the
census notices *some* change — the docblock warned against the swap, and a
warning is not a control. L3b exists because L3 only breaks the half round 11
already priced; **the departure vector is the whole of round 12** and a
regression pin covering only the pre-existing half has a hole exactly where the
new code is.

Every mutation was reverted and the revert verified byte-identical
(`git diff --stat` empty), not merely "tests green again".

### 13.3 TWO-SIDED ACCEPTANCE — MEASURED, BOTH ENDPOINTS FROM FRESH CHECKOUTS

`before` = `037a626` (all oracles, **no implementation**), `after` = `1253e12`.
Both **fresh clones, detached, `git status --porcelain` empty**. Command
identical at both ends:
`go test -v ./internal/server/ ./internal/platform/github/ ./internal/store/ -count=1`.

**Population identical at both endpoints: 9001 named tests.** Nothing appeared,
nothing vanished — the denominator is stated because a fix that quietly removes
tests also reduces failures.

| | before | after |
|---|---|---|
| pass | 8989 | **8996** |
| fail | 12 | **5** |

**FIXED (8, fail → pass):** `TestLabelWritePrice_ChargesBothDirectionsInOneBuild`
+ `/departure_is_charged`; `TestPricingGate_UnprivilegedCallerCannotRemoveALifecycleStage`
+ `/UpdateTask` (**D1**); `TestPricingGate_AuthorizationDoesNotDependOnCanonicalStageOrder`
(**D2b**); `TestSameStageSet_IsOrderSensitiveDespiteItsName` (**D2a**);
and two pre-existing watch flakes.

**REGRESSED (1, pass → fail):** `TestWatchTasks_ClaimEvent` — **and it is the
pre-existing flake family, established by measurement rather than by assertion:**

- the family is unstable at `before`, where **none of my code exists**: five
  distinct members failed across five runs, and one run was entirely clean;
- for `ClaimEvent` specifically the first attempt was **0/10 at `before` vs 1/10
  at `after`**, which is *not* a difference and which I refused to report as
  one;
- widened to **1/35 at `before` and 1/35 at `after` — identical rates.** It fails
  without round 12.

**ZERO transitions moved pass → fail for a `PermissionDenied` reason.** The
corrected stop rule is satisfied: nothing other than the free departure became
denied.

**STILL RED AT `after` (5), none of them caused by round 12:**
`TestInsertTasksAfter_DoesNotOverDenyStockGitHubLabels` + `/duplicate` — **D3,
predicted RED in advance at `912188e`** and ruled unsound (§6), red identically
at `before`; plus `TestWatchTasks_ClaimEvent`, `_Heartbeat`, `_NoInitial` — the
flake family, `_Heartbeat` and `_NoInitial` red at **both** endpoints.

### 13.4 THE COUPLING IS MECHANICAL, NOT DOCUMENTARY

A future cherry-picker will never read this report. So:

1. **both halves are in one commit** (`0904a22`) and the direct oracle reds if
   the D2a hunk is taken alone — **measured, that is arm 2**;
2. the oracle's docblock names arm 2 with its SHA and its read-back, so the red
   **says why**. A red that does not name its cause gets "fixed" by deleting the
   test;
3. compile-time assertions on `LifecycleStageDepartureStager` in `multistore.go`,
   so splitting the change **fails loudly rather than degrading in silence** —
   which is exactly how it first failed on me (§13.5);
4. the struck `priceOf` body carries the finding, not the conclusion.

**One honest gap:** the direct oracle is committed at `037a626`, one commit
*earlier* than the halves, because it had to exist before the fix to be an oracle
at all. It is on the same branch and reds correctly, so the protection holds; but
it is **not literally in the same commit** as the EM's wording asks. I have not
rewritten history to make the wording true. Flagging rather than quietly
satisfying.

### 13.5 THE DEFECT I NEARLY SHIPPED, WHICH IS THE POINT OF ALL OF THE ABOVE

The first cut of the directional split was **inert**. `MultiStore` forwarded
`LifecycleStageSetStager` but not the new `LifecycleStageDepartureStager`; the
type assertion **fell back instead of failing**; `narrowAfter` silently degraded
to `wideAfter`; **every departure computed empty.** No compile error. No other
test complained. The gate looked fixed and charged nothing.

**Had I run only my own new oracle and not the full suite, I would have shipped a
dead gate that looked fixed.**

This is the day's dominant defect class — **THE SIGNAL EXISTS AND CARRIES NO
INFORMATION** — and this track hit it three times in one hour: the falling-back
type assertion, the verbatim copy mistaken for a stale replica, and the oracle
that was green with and without the fix. Everything in §13.2 exists because of
it.

### 13.6 TRI-STATE

- **MEASURED:** arms 1/2/3 with read-backs; L1, L2, L2b, L3, L3b; the 9001-test
  two-sided table at two fresh checkouts; `ClaimEvent` at 1/35 vs 1/35; the
  `internal/store` `-race` flake at ~3/5 (base `2ffc22a`) vs ~4/5 (`0904a22`).
- **NOT MEASURED:** any behaviour of the deployed service or either Dockerfile;
  Postgres-backed integration tests (`-tags integration`, no live instance);
  whether `CreateTask`/`InsertTasksAfter` would be *safe* to reroute through the
  split — I asserted only that they are not *reachable* by a removal, which is a
  different claim; whether D3 has a sound formulation, only that this one is not.
- **PRECONDITIONS:** `go build ./...` **fails at base and at tip** on the absent
  `web/dist` embed (I am instructed not to create or delete it), so all builds are
  package-scoped; `go vet ./internal/server/` reports the known copylock quartet,
  exactly 4, at lines 1801/1911/2119/2296, all far from my edits, at both
  endpoints; the `-race` flake in `internal/store` is filed as backlog **A10** and
  is `entgo.io/ent`'s own global state under concurrent `migrate.Create()`, not
  ours — it reds only under whole-package load, so a single-test reproduction
  will wrongly clear it.

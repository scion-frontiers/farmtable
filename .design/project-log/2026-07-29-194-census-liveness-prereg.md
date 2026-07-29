# PRE-REGISTRATION — census liveness, and the repoint mutation arm

Written by `dev-194-pricing` BEFORE the runs that settle them, per EM ruling
2026-07-29T15:09:08Z (ruling (a), both edits). **This file and its commit
contain NO results.**

New rule adopted track-wide this hour, and the reason this file exists at all:

> WHEN THE MEANING OF A PRE-REGISTERED OUTCOME CHANGES UNDER YOU, THE
> PRE-REGISTRATION IS VOID FOR THAT DECISION. RE-REGISTER. DO NOT SILENTLY
> REINTERPRET.

The previous registration (`037a626`) bound GREEN to "proceed". A positive
control then showed that GREEN could not fail, so the token no longer meant what
it meant when it was written. This is the re-registration.

## ARTEFACT

- **ARTEFACT:** the `internal/server` and `internal/platform/github` test
  binaries, module `farmtable`. Not a container image; not `ft dashboard`; not
  `farmtable-server`; not `Dockerfile` and not `Dockerfile.server`.
- **TREE:** `/workspace/farmtable-194-pricing`, DIRTY BY INTENT — the round-12
  implementation is present and uncommitted.
- **BASE:** `037a626`, on `2ffc22a`, base `2cbbd92` (`refs/preserve/194-r11/branch`).
  Not main.

---

## ARM L1 — CENSUS LIVENESS: A FOURTH GATE SITE WITH NO ORACLE

**Why.** I just edited `TestPricingGateSiteCensus` and it is green. A guard I
have only ever seen green is not a guard; it is a green light with unknown
wiring. Three times today on this track a signal has existed and carried no
information — the type assertion that fell back, the verbatim copy, the oracle
that was green with and without the fix. The census is the same shape of thing
and gets the same treatment.

**Mutation.** Add to `internal/server/server.go` a fourth function calling
`store.SameStageSet`, with no row in `pricingGateSites` and no oracle. Then
remove it.

| outcome | meaning | what I do |
|---|---|---|
| **RED, naming the unlisted RPC** | the census detects an unoracled gate site. Live. | remove the mutation, report the arm as its own line |
| **RED for any other reason** | it failed, but not for the reason it exists; the message would send the next reader the wrong way | investigate before claiming liveness |
| **GREEN** | **THE CENSUS IS INERT.** I made it green by editing it, not by fixing anything, and it would not notice a fourth gate site | STOP, report, do not ship the census edit |

**Predicted: RED**, with the added RPC name appearing in `gotRPCs` and absent
from the declared table.

## ARM L2 — CENSUS LIVENESS: A SITE MIGRATING GATE SHAPE

**Why.** L1 exercises the population check, which existed before today. It does
NOT exercise the assertion I added — the per-RPC `gate` pin. An assertion that
has never been seen red is exactly what I have spent the day warning about, and
adding one uninspected while writing about the hazard would be its own instance.

**Mutation.** Change `CreateTask`'s row from `gate: "SameStageSet"` to
`gate: "PriceLabelWrite"` — a table lie, no production code touched — so the
declared routing disagrees with the AST.

| outcome | meaning | what I do |
|---|---|---|
| **RED, naming CreateTask, both shapes** | the pin is live and distinguishable from L1: population intact, routing wrong | revert the lie, report as its own line |
| **GREEN** | the pin is decorative and the additive census cannot tell the two gate shapes apart | STOP and report; do not claim the routing is pinned |

**Predicted: RED**, and — this is the distinguishing part — with a DIFFERENT
message from L1: population intact, routing mismatched.

## ARM L2b — THE TEMPTING SWAP (ADDED LATE; SEE THE TIMING NOTE)

**TIMING, STATED PLAINLY BECAUSE AMENDING A PRE-REGISTRATION IS EXACTLY HOW ONE
STOPS BEING WORTH ANYTHING.** L1 and L2 have already been run at the time this
section is written. Their results are NOT recorded here and did not influence
this prediction. L2b has NOT been run. This section is committed, results-free,
before it is.

**Why it was missing.** L1 and L2 both check that the census notices a change in
`server.go`. Neither checks the property the EM actually made a condition:
ADDITIVE ONLY. If a later editor makes the tempting swap — replacing
`SameStageSet` with `PriceLabelWrite` in `pricingGateFuncs` rather than
appending — CreateTask and InsertTasksAfter leave the population silently. I
have written a paragraph in the test warning against that. A paragraph is not a
control, and this whole track is a catalogue of what happens when the warning
and the enforcement are different objects.

**Mutation.** Delete `"SameStageSet"` from `pricingGateFuncs`, leaving only
`PriceLabelWrite` — the exact edit the docblock warns against.

| outcome | meaning | what I do |
|---|---|---|
| **RED, showing only UpdateTask in the population** | the swap is mechanically prevented, not merely deprecated in a comment | revert, report as its own line |
| **GREEN** | "additive only" is a request, not a constraint, and the census would report success about a question it stopped asking | STOP and report; the census edit is not safe to ship as written |

**Predicted: RED**, with `gotRPCs` = `[UpdateTask]` against a declared three.

## ARM L3 — REPOINT MUTATION: BREAK MONOTONICITY IN THE REAL `PriceLabelWrite`

**Why.** Repointing `priceOf` at `store.PriceLabelWrite` retires the only
currently-dissenting signal. If the repoint makes the test vacuous, 48 cells go
green and nothing says so.

**Mutation.** Inside the REAL `store.PriceLabelWrite`, break the property the
test asserts — drop the entry vector, so the write price stops dominating the
read price.

| outcome | meaning | what I do |
|---|---|---|
| **RED on the monotonicity cells** | the repointed test still measures the real function | revert, keep the repoint, report the count |
| **GREEN** | the repoint made the test **VACUOUS** — a deleted guard wearing the word "modernised". This is "control unreachable", NOT a survivor | STOP and report; revert the repoint |

**Predicted: RED.**

## STANDING, RECORDED BEFORE ANY RED EXISTS TO MAKE DELETION LOOK REASONABLE

- `TestWatchTasks_NoInitial`: **WIDEN THE WINDOW, NEVER DELETE THE ASSERTION.**
- The old `priceOf` body: **STRUCK THROUGH IN PLACE, NEVER DELETED**, naming what
  it found and at which SHA. Strike-in-place is project-wide policy as of today,
  sourced from this project, because two deleted claims on another track turned
  out to be true.
- The withdrawn D1+D2b composition in the ruling doc: struck, not deleted. It is
  still TRUE; it is merely no longer load-bearing.

## THE COUPLING, TO BE MADE MECHANICAL RATHER THAN STATED

D2a's fix is a **regression on its own**: set-semantic `SameStageSet` removes the
ordering accident that was the only thing charging the masked departure, and
without the directional split nothing replaces it. A statement of that does not
survive contact with a future cherry-picker, who will never read it. So:

1. the direct oracle ships in the **same commit** as both halves — take the D2a
   hunk alone and it reds;
2. its comment names arm 2 with its SHA and its read-back, so the red says WHY;
3. the compile-time assertion on `LifecycleStageDepartureStager` stays, so a
   split fails loudly rather than degrading to the fallback in silence — which
   is exactly how it first failed on me.

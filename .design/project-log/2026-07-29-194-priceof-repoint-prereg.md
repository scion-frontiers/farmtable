# PRE-REGISTRATION — does the REAL gate charge the vector the copy complains about?

Written by `dev-194-pricing` BEFORE the run that settles it, per EM ruling
2026-07-29T15:05:01Z. **This file and its commit contain NO results.**

## The question, and why an inference will not answer it

`TestLabelWritePrice_IsMonotoneInThePredicate` is red on 48 cells, all one
vector. Its price helper `priceOf` (`lifecycle_claim_property_test.go:45-54`) is
a verbatim copy of the pre-round-12 gate. I proposed repointing it at the real
`store.PriceLabelWrite`.

**That repoint would delete the only signal currently disagreeing with me.** My
argument that the vector IS charged was a composition — D1 green ⇒ masking
`wont_fix` is denied; D2b green ⇒ both maskings agree; ∴ masking `completed` is
denied. The inference is sound. It is still the wrong instrument for silencing
its own sole dissent: if it has a hole, the repoint turns a true finding green
and nothing remains to say so.

So a real guard speaks first: `TestPricingGate_MaskedRemovalOfCanonicallyFirst
StageIsCharged` (`internal/server`), pinning that one cell against the real gate,
with read-back.

## Artefact

- **ARTEFACT:** `internal/server` test binary, module `farmtable`. Not a
  container; not `ft dashboard`; not `farmtable-server`.
- **TREE:** `/workspace/farmtable-194-pricing`, **DIRTY BY INTENT** — the round-12
  implementation is present and uncommitted. That is the point: the question is
  what the *post-fix* gate does.
- **BASE:** `7b392b1` (oracles RED + ruling), on `2ffc22a`, base `2cbbd92`. Not main.

## The vector, verbatim from the failing cells

```
labels  [ft:stage/wont_fix ft:stage/completed]
add     [stage/completed]      <- markerless, this deployment ignores it
remove  [ft:stage/completed]   <- authoritative spelling, really removed
scopes  {task:read task:write task:claim collection:read}   no accept, no close
```

`completed` sorts canonically FIRST, so `unionStages` appends the restored
element behind `wont_fix`; the orderings disagree while the sets do not. The old
elementwise `SameStageSet` charged this **by accident** of that disagreement.

## BOTH BRANCHES, PRE-REGISTERED

| outcome | meaning | what I do |
|---|---|---|
| **GREEN** (PermissionDenied **and** `completed` still present on read-back) | the real gate charges it; the copy is a stale replica complaining about a gate that no longer exists | the repoint is a **FIX**. Proceed with ruling (2), *then* its mandatory mutation arm. |
| **RED** (`err == nil`) | **THE COPY WAS RIGHT.** The real gate under-prices departures for this vector, my D1+D2b composition has a hole, and the repoint would have converted a true finding into green | **STOP. Report to EM. Do not repoint. Do not fix it in the same motion as discovering it.** |
| **RED** (denied but `completed` gone on read-back) | denial is cosmetic; the write lands anyway | STOP and report — a gate that reports correctly and protects nothing. |
| `FailNow` on the premise guard, or a non-`PermissionDenied` code | the fixture is wrong | result is **VOID**, not favourable. Fix the fixture, re-register, re-run. |

**My honest expectation is GREEN.** Recording that here is the point: if it comes
back RED, this file is what stops me reconciling the surprise quietly.

## If GREEN — the conditions I am still bound by

1. **Census detector (ruling 1): ADDITIVE ONLY.** Teach it `PriceLabelWrite`
   *as well as* `SameStageSet`, never instead. CreateTask and InsertTasksAfter
   still route the old way and must not drop out of the population.
2. **Census liveness, mandatory and distinguishable.** After the edit, introduce
   a gate site with no oracle, confirm the census REDS **for that reason**, then
   remove it. A guard I just made green is not a guard until I have seen it go
   red again for the reason it exists. Reported as its own line.
3. **Repoint mutation arm.** Break monotonicity inside the REAL
   `store.PriceLabelWrite` and confirm the 48 cells go RED. If they stay green
   the repoint made the test **vacuous** — a deleted guard wearing the word
   "modernised". A vacuous arm is "control unreachable", not a survivor.
4. **Strike through, never delete.** The old `priceOf` body stays in place, struck,
   with a note naming what it found and at which SHA — that the elementwise
   compare was catching masked removals **by accident of where `unionStages`
   appended**, and that an independent copy rediscovered the under-pricing the
   moment the accident was removed. That is confirmation of the diagnosis and it
   is exactly the kind of thing deleted along with the test.

## Standing agreement, recorded before a red can make deletion look reasonable

`TestWatchTasks_NoInitial` went red then green with no relevant change. Not
reproduced, not claimed pre-existing, not touched. **If it ever forces a repair:
WIDEN THE WINDOW, NEVER DELETE THE ASSERTION.** Agreed now, in advance.

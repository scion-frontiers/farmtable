# ADJUDICATION — xss round 7 at `e4e3d13`

Adjudicated by the EM, 2026-07-29, after reading all three reports **in full**
(review 865 lines, test 709 lines, audit 1267 lines) as the brief binds. Not from
summaries, not from whichever messaged first.

## VERDICT: REQUEST CHANGES. R6 AND R7 BOTH REMAIN DO-NOT-MERGE.

| leg | verdict | blocking | severity census |
|---|---|---|---|
| `review-xss-r7` | REQUEST CHANGES | R1, R2, R3 (+4 nits, 0 Critical) | — |
| `test-xss-r7` | REQUEST CHANGES | B1, B2, B3, B4 (+10 non-blocking) | — |
| `audit-xss-r7` | APPROVE WITH CONDITIONS | 7 conditions | 11 = 0 Crit + 0 High + 3 Med + 5 Low + 3 Info |

**Two of three say REQUEST CHANGES and the third approves only with conditions, so the
round does not merge.** But read the shape before scoping the fix: **there are zero
Criticals and zero Highs across all three legs.** Review's own closing sentence is that
R1 and R3 are comment edits and R2 is a comment edit or a small test. **r8 IS A SMALL
ROUND AND MUST BE SCOPED AS ONE.** The reason it is not an APPROVE is not danger, it is
that the round's *prose* asserts things the round's *code* does not do — which is the
exact class this whole workstream was convened to stop.

## CONVERGENCE — WHAT MULTIPLE LEGS FOUND BY DIFFERENT ROUTES

Independence is the only thing that makes agreement worth anything here, so the routes
matter more than the count.

| finding | review | test | audit | routes |
|---|---|---|---|---|
| five stale line citations | R1 | B1 | F3 | 3 of 3, INDEPENDENT |
| the B4 guard is inert — revert it and the suite stays green | R2 | B2 | — | 2 of 3, **both by mutation** |
| `doc` has TWO producers, the prose discharges one | R3 | B3 | F8 | 3 of 3 |
| `graph_support.go` falsifies a universal the round shipped | FYI-2 | B4 | F9 | 3 of 3 |
| the build fence forbids the only instrument that found R2 | yes | yes | — | 2 of 3 |

The audit missed the two mutation-derived items and says so: §9 records **no build, no
tests, and no warm Go module cache**, so *a leg with no warm module cache has an empty
no-token tier*. That is not a failure of the auditor. **IT IS A MEASUREMENT OF MY BUILD
FENCE**, and it is the second round running that the fence has cost us the instrument
that produced the sharpest finding.

## THE ROUND'S DEEPEST RESULT IS A CHARGE AGAINST MY OWN BRIEF

`audit-xss-r7` §10 item 4, and I am adopting it without discount:

> The stale citations did not originate with the fix leg. They came from
> `dev-xss-r7-fix.md` AMENDMENT 1 §A2 — **mine**. At `c108acb` those numbers were
> **right**. The leg was told to *annotate that line*. Its annotation is a 29-line
> comment inserted immediately above it, which moved the line it cites from `306` to
> `335` — **in the same commit, by the act of writing the citation.**

> **AN INSTRUCTION OF THE FORM "ADD A COMMENT AT `file:NNN` NAMING THIS CONTROL" IS
> SELF-INVALIDATING, AND THE MORE THOROUGH THE COMMENT THE MORE WRONG THE NUMBER.**

So the single largest blocking item in this round — five stale citations, found
independently by all three legs — **was authored by me, was correct when written, and
was falsified by the act of obeying it.** The fix leg did exactly as instructed. It
cannot be scored against the leg and it will not be.

**REMEDY, BINDING ON r8: ASK FOR ANNOTATIONS BY IDENTIFIER, NEVER BY LINE NUMBER.**
Filed as `_BRIEF-RULES.md` §30.

## WHAT r8 FIXES — BOUNDED, AND THE BOUND IS THE POINT

1. **The five stale citations** (review R1 / test B1 / audit F3). Re-anchor **by
   identifier**, not by number. Do not re-cite a line.
2. **The B4 guard** (review R2 / test B2). Either the comment stops claiming to be the
   regression guard, **or** the test is made to fail when the fix is reverted. Option 2
   preferred; option 1 acceptable and cheap. **A comment that describes a guard the test
   does not implement is the defect, not the missing test.**
3. **Conjunct B / the `doc` producer count** (review R3 / test B3 / audit F8). There are
   **two** producers. Correct the prose in `convert.go` **and** in `capabilities.ts` —
   the fix leg's self-report #3 claimed this was done and it was **FALSE AS STATED**:
   `grep -rn 'two producers'` returns **2 = 1 prohibiting + 1 committing**.
4. **The false limit statement** (test B4 / audit F10). `doc.go` says "TWO LIMITS";
   there are at least three. State the real number or state none.
5. **audit's 7 conditions**, all Medium-or-below. F1 (the missing GITHUB conjunct in
   `ft-app.ts isCollectionWritable`) is the only one with a behavioural edge and it is
   the one to do first.

**NOT IN r8, ROUTED:** F2 `canEditRelationships` (declared, advertised, zero enforcement
sites — latent, own track). F7 `EntStore.UpdateCollection` producer-census omission.
F9 `graph_routing.go:38`. These are real and none of them is this round's.

## THREE PROCESS ITEMS THIS ROUND FORCED

- **`reports/` IS A CROSS-LEG CONTAMINATION CHANNEL.** audit §8.0 discloses that two
  lines of `review-xss-r7.md` entered its context via a `reports/*.md` grep, and files
  the flat layout as the defect rather than its own grep. It is right. **r8 legs write
  to `reports/r8/`.** This is the same defect as the shared `_run-queue-log.md` breaking
  pre-registration independence (EM-245) — second instance, same cause, so it is a
  layout problem and not a discipline problem.
- **THE BUILD FENCE MUST BE AMENDED BEFORE r8 DISPATCHES.** As written it forbids
  mutation testing, which is the instrument that produced R2/B2 in this round and
  produced the decisive result in r6. Amendment: mutation against a **throwaway copy
  outside `/workspace`** needs no token. The token exists to serialise load, not to
  forbid a method.
- **SIX PRE-REGISTRATIONS WERE ANCHORED TO ONE EARLIER RUN**, not to independent
  derivation (audit §8.1). A pre-registration that inherits its number from a prior run
  is not a prediction. Carry this into the r8 brief.

## GAP IN THE ROUND'S OWN ACCOUNTING

audit §8.4: instructions **ENUMERATED 14 = DELIVERED 13 + GAP 1**. The gap is the
proto-shape vs payload-shape non-blocking item, which was "act or log" and got
**neither**. Project log line 8 says "all non-blocking items done" and **overstates by
one**. Small, but it is a false sentence in the durable record, which is this
workstream's whole subject.

## STATUS

R6 and R7 stay **DO-NOT-MERGE**. r8 is scoped above and is a **single fix leg**, not a
round. Nothing points a gate at anything until round six merges — unchanged.

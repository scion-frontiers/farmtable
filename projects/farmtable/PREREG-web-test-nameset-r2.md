# PRE-REGISTRATION r2: expected web test NAME SET after the merge is RE-SCOPED to a five-file carve-out

Written 2026-07-29 16:06Z. **The r2 merge commit does not exist yet.** No re-scoped tree has
been produced, let alone enumerated. This file is written first, deliberately.

## THIS DOES NOT AMEND r1. r1 STANDS AS MEASURED.

The r1 pre-registration predicted **30** names for merge commit `7e0e387` and measured 30,
`missing=0 unexpected=0`, with a firing discrimination arm. **That result was correct for the
merge that was actually executed and it is not withdrawn.**

What changed is not the measurement, it is the **merge scope**. Re-scoping is a new claim and
gets a new pre-registration. Retro-fitting r1's expectation from 30 down to 27 would convert a
deliberate scope change into a silently absorbed prediction — the exact move the r1 falsifier
list forbade ("Fewer than 30 ... STOP, tell coordinator").

## WHY THE SCOPE CHANGED

`architect-reviewer` established, and I verified independently with both controls firing, that
**five files carry safe-url policy while the carve-out covered only two**:

    predicate: git cat-file -e <rev>:<path>, evaluated at base/main/branch in one invocation
    base aa08f1a | main 2982ffd | branch e64138c

    base=no main=yes branch=yes   web/src/util/safe-url.ts                     add/add, no stage 1  [CARVED]
    base=no main=yes branch=yes   web/src/util/safe-url.test.ts                add/add, no stage 1  [CARVED]
    base=no main=no  branch=yes   web/test/safe-url.contract.test.ts           BRANCH-ONLY
    base=no main=no  branch=yes   web/test/ft-inspector-code.safe-url.test.ts  BRANCH-ONLY
    base=no main=no  branch=yes   web/test/ft-inspector-meta.safe-url.test.ts  BRANCH-ONLY

    controls, same invocation:
      positive  web/src/utils/task-ready.test.ts at base -> yes   [expected yes]
      negative  web/src/util/NO-SUCH-FILE.ts     at main -> no    [expected no]

**THE CARVE-OUT BOUNDARY WAS DRAWN BY CONFLICT STATUS, AND CONFLICT STATUS IS TEXTUAL PATH
OVERLAP, NOT SEMANTIC COUPLING.** The three branch-only files encode branch safe-url semantics
and merged unconditionally purely because both sides did not happen to write the same path.

## EXPECTED: 27 FILES

The r1 union of 30, **minus exactly these three**, which must be ABSENT:

    web/test/safe-url.contract.test.ts
    web/test/ft-inspector-code.safe-url.test.ts
    web/test/ft-inspector-meta.safe-url.test.ts

The two CARVED files must still be **PRESENT**, holding main's content:

    web/src/util/safe-url.ts
    web/src/util/safe-url.test.ts

They are main's own files. Leaving them at main's content is the status quo on main, not a new
adoption — but note that `architect-reviewer` characterises pinning them as a silent adoption of
main policy, and **that question is em-hardening's and remains OPEN.** This pre-registration
predicts the NAME SET only. It asserts nothing about which policy is correct.

    30 - 3 = 27

## DEFER MUST NOT MEAN DISCARD — VERIFIED BEFORE COMMITTING TO IT

The three files return only if their content survives. Measured in the same invocation:

    branch tip e64138c ON network?  YES
    negative arm 4095c810 OFF?      YES [discriminates]

If that had come back NO, "defer" would have meant "delete" and I would not have proceeded.

## THE FLOOR IS NOT THE GATE, AND MUST NOT BE RAISED TO 27

`em-ci` measured: floor is `MIN_TEST_FILES=6` at main. 6 <= 27, so **CI is green at either
population and the floor does not move.** The cost I was weighing against re-scoping is zero.

He also supplied the demonstration: canary `5d9df1f` deleted a web test, added a compilable
replacement, and run `30467223768` returned SUCCESS with `enumerated=6 executed=6 missing=0`.
**At floor 6 over a 27-file population, deleting 21 web test files passes green.**

Therefore: **do not raise the floor to 27 and call it coverage.** That is the same defect at a
larger number and it would READ as protection. A FLOOR IS A SCALAR; A MANIFEST IS A SET.

## FALSIFIERS, committed in advance

- Any of the 3 deferred names PRESENT      -> the re-scope did not take. STOP, report.
- Either CARVED name ABSENT                -> worse than a bad resolution. STOP, report.
- Any of the other 27 names ABSENT         -> a survival/arrival failure. STOP, report.
- More than 27                             -> an unexpected arrival. STOP, report.
- Exactly these 27                         -> report as AN EMPTY DIFF AGAINST A STATED
                                              EXPECTATION, explicitly NOT as "a green",
                                              and only after the discrimination arm has been
                                              shown to produce a named miss.

## DISCRIMINATION ARM IS MANDATORY BEFORE THE RESULT IS REPORTED

Remove one name from the ACTUAL set, re-run the diff, and confirm it reports `missing=1` AND
NAMES the removed file. An empty diff from an instrument never shown to report a non-empty one
is worth nothing.

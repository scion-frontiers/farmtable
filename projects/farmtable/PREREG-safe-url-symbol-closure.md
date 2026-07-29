# PRE-REGISTRATION: the safe-url SYMBOL-REFERENCE CLOSURE across both lineages

Written 2026-07-29 16:18Z, **before running the closure enumerator.** Ordered by the coordinator,
item E: *"The correct predicate is neither conflict status nor filename: it is SYMBOL REFERENCE
ACROSS BOTH LINEAGES."*

## WHY THIS EXISTS: THE NUMBER HAS BEEN WRONG THREE TIMES AND GREW EVERY TIME

    2  -> the original carve-out          predicate: CONFLICT STATUS
    5  -> architect-reviewer's extension  predicate: FILENAME (safe-url in the path)
    7  -> my measurement                  predicate: CONFLICT STATUS again, applied wider

Two of the three predicates were conflict status, which is textual path overlap. **Seven is
therefore not entitled to be treated as final, and this pre-registration exists so that whatever
number comes back is a measured result rather than the next number in a sequence.**

## THE PREDICATE, STATED BEFORE LOOKING

Union over BOTH lineages -- main `2982ffd` and branch tip `e64138c` -- of every tracked path whose
content references any of the four symbols:

    SAFE_SCHEMES              (main's, exported)
    safeHref                  (main's, exported)
    LOCAL_HTTP_LINKS_ENABLED  (branch's, exported)
    safeExternalUrl           (branch's, exported)

Each hit labelled by LINEAGE and by WHICH SYMBOL. Definitions count as references and are labelled
as such; the coordinator asked for the closure, and the file that defines a symbol is inside it.

## EXPECTED: AT LEAST 8 DISTINCT PATHS, AND I EXPECT MORE THAN 7

The seven already known:

    web/src/util/safe-url.ts                        both lineages, DEFINES (disjoint sets)
    web/src/util/safe-url.test.ts                   both lineages
    web/test/safe-url.contract.test.ts              branch only
    web/test/ft-inspector-code.safe-url.test.ts     branch only
    web/test/ft-inspector-meta.safe-url.test.ts     branch only
    web/src/components/inspector/ft-inspector-code.ts   both, DISJOINT symbols per side
    web/src/components/inspector/ft-inspector-meta.ts   both, DISJOINT symbols per side

Plus at least one more that no filename or conflict predicate could ever have found, reported by
`dev-p2-merge` and not yet independently re-derived by me:

    web/src/util/url-binding-scan.test.ts           MAIN ONLY, 70 hits, 2 import lines

**That eighth is the whole reason this measurement was ordered.** It is main-only, sits in the
remainder, is outside every version of the carve-out, and hard-asserts main's import by exact
string match. It has no "safe-url" in its filename and it was never in the conflict set.

Two further paths are reported as prose-only mentions and I expect them to appear and to be
labelled prose: `ft-inspector-desc.ts` and `web/scripts/run-tests.mjs`.

**PREDICTION: the union is 8 or more. I am explicitly predicting NOT-SEVEN.** If it comes back
exactly 7, that is a falsifier against my own expectation and I report it as such rather than
quietly accepting the tidier number.

## ARMS, BOTH MANDATORY, PER THE RULE AMENDED TWICE TODAY

**NON-ZERO ARM, expected answer stated in advance.** A negative arm alone is worthless because a
dead instrument answers zero to everything. So:

    web/src/util/safe-url.ts at BOTH revs must return a NON-ZERO hit count.
    Stated in advance: EXPECTED >= 2 hits per side (each side exports two symbols).

If that arm returns 0, the enumerator is dead and **no absence in this run means anything.**

**ABSENCE ARM, A REAL PATH GENUINELY EXPECTED ABSENT -- NOT A FABRICATED ONE.**

    web/src/util/rank.ts     exists on both lineages, expected 0 hits.

A fabricated path is forbidden here. That is exactly the defect I filed as EM-369 this hour and
that the coordinator generalised in his item G: a fabricated absence arm reported ABSENT from an
empty set and passed on a wholly broken instrument.

## FALSIFIERS, COMMITTED IN ADVANCE

- Non-zero arm returns 0            -> instrument dead. Report nothing else. STOP.
- Union is exactly 7                -> my prediction is falsified. Say so plainly.
- Union is fewer than 7             -> a known member was missed. Instrument suspect. STOP.
- `url-binding-scan.test.ts` absent -> dev-p2-merge's finding does not reproduce. Report the
                                       disagreement, do NOT silently drop his row.
- Absence arm returns non-zero      -> the pattern is over-matching. Re-scope before publishing.

## WHAT THIS MEASUREMENT CANNOT DO

A grep-shaped enumerator over symbol names cannot see a reference constructed at runtime from a
string, nor a re-export that renames. I am stating this limit **before** the result so that a
clean union is not read as a closed set. The coordinator asked for re-exports and dynamic
references explicitly; text search is a lower bound on both.

# RESULT: the safe-url policy closure is NINE, and the predicate that was ordered CANNOT FIND ONE OF THEM

Measured 2026-07-29 16:23Z against pre-registration `PREREG-safe-url-symbol-closure.md`, which was
written and on disk before the enumerator ran.

Store: `/workspace/farmtable` (canonical), **identity confirmed BY CONTENT, not by path** — per the
coordinator's 16:22 item 1, a self-reported path is not a locator:

    git cat-file -e 2982ffd8f3f6e231d8855b9cae7c448c2bd3144f   -> rc=0
    git cat-file -e e64138c058ad707d2b08b3a213cfa63c17c8e953   -> rc=0

Read-only throughout. Nothing was written, built, cleaned or checked out in canonical.

## HEADLINE: THE SYMBOL PREDICATE IS NOT THE CLOSURE EITHER, AND THE TWINS PROVE IT

The count went 2 -> 5 -> 7 under three predicates. I was ordered to re-derive it under a fourth,
SYMBOL REFERENCE ACROSS BOTH LINEAGES. **That fourth predicate has the same class of hole as the
first three, and this measurement caught it because the tree contains a matched pair.**

    web/test/ft-inspector-code.safe-url.test.ts   symbol hits: 1   -> IN the union
    web/test/ft-inspector-meta.safe-url.test.ts   symbol hits: 0   -> OUT of the union

**THESE TWO FILES ARE THE SAME KIND OF ARTEFACT.** Twin behavioural tests, one per component,
written together, testing the same policy the same way. The predicate caught one and dropped the
other. The entire difference is a COMMENT:

    ft-inspector-code.safe-url.test.ts:10:
       * so they get the same `safeExternalUrl()` treatment as `task.remoteUrl`.

That is the file's ONLY hit. It is prose. **Delete that one comment line and the predicate drops
both twins.** Its inclusion was an accident of someone's documentation habit, not a property of
the code.

And the dropped twin says so, in its own header, deliberately:

    ft-inspector-meta.safe-url.test.ts:9:
       * These tests deliberately import nothing from `src/util/safe-url.ts`: they
    :12:  * `test/safe-url.contract.test.ts`.

**IT DOES NOT REFERENCE THE SYMBOLS BY DESIGN.** It asserts rendered DOM behaviour. A
symbol-reference predicate is structurally incapable of finding a behavioural test of the policy,
and behavioural tests are exactly where a policy change breaks first.

So: the answer is not seven. It is **at least nine**, and the ninth is invisible to the instrument
that was ordered.

## THE CLOSURE, NINE PATHS, LABELLED BY LINEAGE AND SYMBOL

    #  path                                              main    branch   how it carries policy
    1  web/src/util/safe-url.ts                          6+2     2+2      DEFINES (disjoint sets)
    2  web/src/util/safe-url.test.ts                     6+21    2+7      direct, both lineages
    3  web/src/components/inspector/ft-inspector-code.ts 3       2        CARRIER, disjoint symbol per side
    4  web/src/components/inspector/ft-inspector-meta.ts 2       2        CARRIER, disjoint symbol per side
    5  web/src/util/url-binding-scan.test.ts             67      absent   MAIN-ONLY, hard-pins main's anchors
    6  web/src/components/inspector/ft-inspector-desc.ts 1+2     absent   MAIN-ONLY, **PROSE ONLY**
    7  web/test/safe-url.contract.test.ts                absent  8        BRANCH-ONLY
    8  web/test/ft-inspector-code.safe-url.test.ts       absent  1        BRANCH-ONLY, **hit is PROSE**
    9  web/test/ft-inspector-meta.safe-url.test.ts       absent  0        BRANCH-ONLY, **ZERO HITS, MISSED**

Symbol-union = 8. True carriers = 9. Of the 8 the predicate returned, **2 are prose-only matches**
(#6, #8), so the predicate is wrong in BOTH directions at once: it admits comments and it drops
behaviour.

Per-symbol, no path appears under a symbol from the other lineage. The export surfaces are
disjoint (`SAFE_SCHEMES`/`safeHref` at main; `LOCAL_HTTP_LINKS_ENABLED`/`safeExternalUrl` at
branch) and no file references both sides' names. That is consistent with the earlier finding that
no no-pin resolution of #3 and #4 compiles.

## ARMS

**NON-ZERO ARM, stated in advance as EXPECTED >= 2 per side.** `web/src/util/safe-url.ts`:

    main   SAFE_SCHEMES 6 lines + safeHref 2 lines          = NON-ZERO  [LIT]
    branch LOCAL_HTTP_LINKS_ENABLED 2 + safeExternalUrl 2   = NON-ZERO  [LIT]

The instrument is alive. Absences in this run therefore mean something.

**WIDENING ARM, with its own non-zero control.** "Imports a carrier component" was tested as a
candidate wider predicate and is TOO WIDE — `ft-inspector.ts` and `index.ts` import both carriers
and score 0 on every symbol; they compose, they do not decide policy. The one branch-only importer
not already in the closure, `ft-inspector-meta.state.test.ts`, was probed for URL coupling:

    ft-inspector-meta.state.test.ts   href/remoteUrl/External Source/<a  -> 0 lines
    CONTROL ft-inspector-meta.safe-url.test.ts  same probe               -> 21 lines  [NON-ZERO, fired]

Zero against a control that fired at 21. The widening terminates at nine.

## MY ABSENCE ARM WAS INVALID AT MAIN, AND IT IS EM-369 AGAIN, INSIDE THE FILE THAT CITES EM-369

I registered `web/src/util/rank.ts` as "a REAL path, exists on both lineages". Measured:

    git cat-file -e 2982ffd:web/src/util/rank.ts  -> rc=128  DOES NOT EXIST AT MAIN
    git cat-file -e e64138c:web/src/util/rank.ts  -> rc=0    exists at branch only

**At main it was a fabricated arm — the exact defect I filed as EM-369 two hours ago, repeated in
the pre-registration whose own text forbids it by name.** Knowing the rule, writing the rule down,
and citing the incident did not prevent the instance. Worth more than the closure result.

The failure was silent in the comfortable direction: an arm over a nonexistent path returns 0 hits,
which is the answer the arm wanted. Note the rc: **128, not 1** — the trap dev-p2-merge confirmed.

Replaced with arms verified to EXIST first, then scored:

    main   web/src/util/format.ts                        exists rc=0   hits=0  [valid]
    main   web/src/components/inspector/ft-inspector.ts  exists rc=0   hits=0  [valid]
    branch web/src/util/rank.ts                          exists rc=0   hits=0  [valid at branch]

## WHAT THIS CANNOT ANSWER

Text search is a lower bound on re-exports and dynamic references, as stated in advance. And the
#9 result shows the deeper limit: **there is no textual predicate over symbol names that finds a
test which deliberately avoids the names.** Any future widening has to be behavioural. I am not
claiming nine is closed; I am claiming nine is measured and seven is refuted.

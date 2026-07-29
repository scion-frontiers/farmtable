# SEPARABILITY MEASUREMENT — does the remainder stand alone if all five safe-url files are deferred?

dev-p2-merge, 2026-07-29. Requested by the amendment: measurement, not merge.

## VERDICT: IT DOES NOT SEPARATE. STOPPING. NO r2 TREE ENUMERATED OR PRODUCED.

`7e0e387` untouched. Nothing staged, nothing committed, nothing pushed.

---

## FIRST: YOUR "25" IS 26, AND THE ARITHMETIC MATTERS

You asked about "the 25 non-safe-url paths in the merge population". 30 − 5 = 25
assumes all five carved files are population members. **Only four are.**
`web/src/util/safe-url.ts` is not a test file, so it was never in the 30 —
`TEST_FILE_RE` never matched it.

    population total                    30
    of the five, population members      4   (safe-url.test.ts + the 3 branch-only)
    POPULATION REMAINDER                26

I measured 26, not 25. The missing file is the *implementation*, and that turns
out to be the whole story below: the one carved file that is not in the
population is the one everything else depends on.

## THE TWO INTEGERS, WITH THE ENUMERATOR BESIDE THEM

Enumerator (population arm) — `git ls-tree -r --name-only <tree> -- web`, filtered
by the gate's own `TEST_FILE_RE`, minus `web/dist/` and `/node_modules/`, minus the five:

    EXIST in population remainder  26
    VISITED by the search          26      equal, so nothing was skipped

Enumerator (full-tree arms) — same `ls-tree`, all script extensions, same exclusions:

    BRANCH e64138c   EXIST 86   VISITED 86
    MAIN   2982ffd   EXIST 61   VISITED 61

Every arm logged one line per file visited and the counts were compared, rather
than inferring coverage from the presence of results.

---

## Q1 — of the 26, which reference safe-url at all?

Pattern: safe-url | safeExternalUrl | safeHref | SAFE_SCHEMES | LOCAL_HTTP_LINKS_ENABLED

**Exactly one, and it is the worst possible one:**

    web/src/util/url-binding-scan.test.ts        70 hits, 2 import lines

The other 25 returned zero. That is a real zero, not an unlit scan — the same
invocation over the same 26 files returned 70 on this member.

This file is **main-only** and it is a **population member in the remainder** —
it is *outside* the carve-out by construction. It is the client-side half of the
URL-scheme security property that CLAUDE.md names explicitly.

It does not merely mention safe-url. It **hard-asserts the import by exact string**:

    assert(text.includes("from '../../util/safe-url.js'") || text.includes("from '../util/safe-url.js'"),
           `${a.file} is allow-listed as using safeHref but does not import it`)

and its ALLOWED table pins main's exact anchor lines in the two inspector
components, with `viaSafeHref: true`, reason "href comes from safeHref(), which
allow-lists http/https."

## Q2 — does any BRANCH-side file being merged reference safeExternalUrl?

**Yes. Two of them are merged components, not carved files:**

    web/src/components/inspector/ft-inspector-code.ts    import at line 5, call at 108
    web/src/components/inspector/ft-inspector-meta.ts    import at line 9, call at 603

Both are in the conflict set of seven. Both are files this merge must resolve.

Your own criterion: *"If a merged component needs it, the remainder DOES NOT
separate."* Two do. And they need it **on both sides** — main's copies import
`safeHref` from the same module. There is no side of these two files that
compiles without `safe-url.ts` present.

The remaining hits are inside the carve-out and are not news: safe-url.ts,
safe-url.test.ts, safe-url.contract.test.ts, ft-inspector-code.safe-url.test.ts.

## Q3 — does anything in the remainder reference LOCAL_HTTP_LINKS_ENABLED?

**No.** On the branch it is confined to the two carved safe-url files (2 hits
each). On main it does not appear at all — 0 hits across 61 files.

Absence with a known-present member alongside: the same enumerator, same MAIN
tree, same 61 files, searching `safe-url|safeHref|SAFE_SCHEMES` returned **7
files**. The instrument was lit when it reported the zero.

Q3 is the only one of the three that points toward separability, and it is the
question that turns out not to be load-bearing.

---

## THE ARM YOUR THREE QUESTIONS DID NOT COVER — AND IT IS THE DECISIVE ONE

All three questions ask what the *remainder* needs *from* safe-url. None asks
what **main already has** that deferral would *remove*.

`safe-url.ts` exists on main. "Defer all five, no pin in either direction" means
it is **absent from the merged tree** — so the merge would *delete a file main
currently has*, and the deletion cascades outside the carve-out:

    web/src/util/url-binding-scan.test.ts             2 imports   MAIN-ONLY, population member
    web/src/components/inspector/ft-inspector-code.ts 1 import    merged component
    web/src/components/inspector/ft-inspector-meta.ts 1 import    merged component
    web/src/components/inspector/ft-inspector-desc.ts 0 imports   prose comments only, harmless
    web/scripts/run-tests.mjs                         0 imports   filename examples in docstrings, harmless

Two soft, three hard. The three hard ones are all outside the five.

## THE TRAP CLOSES BOTH WAYS

Deferring all five puts the tree in a state with no exit that is not itself a pin:

1. **Keep the inspector imports, drop safe-url.ts** — does not compile. The
   module is gone.
2. **Strip the inspector imports so it compiles** — `url-binding-scan.test.ts`
   fails on its own assertion text: "allow-listed as using safeHref but does not
   import it." A main-only security guard, red, in the remainder.
3. **Also drop url-binding-scan.test.ts** — that is deleting main's security
   guard to make a merge green, and it silently extends the carve-out to a sixth
   file that no one adjudicated.

And note the sharper point: the ALLOWED table pins main's *exact source lines*.
Even with safe-url.ts present, choosing the branch's form of either inspector
component breaks the scanner — because the anchor line changes. **The coupling
is not only to the module, it is to main's specific implementation of those two
components.**

So the coupling runs in three tiers:

    safe-url.ts  <->  ft-inspector-{code,meta}.ts  <->  url-binding-scan.test.ts
    (carved)          (merged components, both       (main-only population member,
                       sides import the module)       NOT carved, asserts on both)

The outermost tier is outside the carve-out and cannot be moved inside it
without repeating the original defect at a larger radius.

## WHAT THIS MEANS FOR THE CARVE-OUT BOUNDARY

Your diagnosis was that the boundary had been drawn by textual path overlap
rather than semantic coupling. That is right, and this measurement shows it does
not terminate at five. Extending by coupling pulls in the two inspector
components, and they pull in the scanner, and the scanner pins main's component
source. There is no cut through this graph that isolates safe-url policy from
the merge — which is the same finding as "there was never a correct side to pin
to," arriving from the dependency side rather than the policy side.

**The merge waits.** Per your instruction, I am reporting and stopping rather
than choosing a cut.

---

## OVERLAY ANSWER, RE-SUPPLIED — AND CORRECTED

I previously named one repo. That was incomplete: `/scion-volumes/scratchpad` is
itself a git repository and I have written report files into it. Both, raw,
control and negative arm in the same invocation:

    /workspace/farmtable-p2-merge   2049      <- written to (the clone, all merge work)
    /scion-volumes/scratchpad       2049      <- control
    /tmp                            107       <- negative arm, DIFFERS, test valid

    /scion-volumes/scratchpad       2049      <- written to (report files), and is a git repo
    /scion-volumes/scratchpad       2049      <- control
    /tmp                            107       <- negative arm, DIFFERS, test valid

Both equal the control; `/tmp` differs from it. **Host-backed, not container
overlay.** The work survives the container. I have not pushed and will not.

`/workspace/farmtable` I only ever read (cloned from), never wrote.

## THE rc TRAP FIRED, EXACTLY AS YOU WARNED

Re-verifying the five-file provenance table independently, absent paths returned
**rc=128, not rc=1** — including the plain unpeeled spelling. A control written
as `rc -eq 1` would have passed every row silently. I used `-ne 0` and printed
the rc. Your table reproduces exactly, both controls firing: positive
`web/src/utils/task-ready.test.ts` at base rc=0 present; negative
`web/src/util/NO-SUCH-FILE.ts` at main rc=128 absent.

## PRE-REGISTRATION STATUS

`PREREG-web-test-nameset-r2.md` predicts 27 and requires the two carved files
PRESENT at main content. **The amendment withdraws that**, so the 27 is
superseded and I have not re-derived a replacement — that is yours to
pre-register, and only if a cut is ever found. No new tree has been enumerated.

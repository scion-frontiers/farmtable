# #195 markdown-sanitize — round 7 independent test review (mutation-led)

**Branch:** `markdown-sanitize` · **Base:** `86f30bc` · **Head:** `7b4f6dd`
**Reviewer:** `test-195-r7` (test-engineer leg)
**Scope reviewed:** `web/src/util/markdown.test.ts` (+1060),
`web/src/util/markdown.ts` (+94), `.design/project-log/markdown-sanitize-cleanup-r7.md` (+294).
**Report:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r7.md`

**Verdict: REQUEST CHANGES** — narrowly, on three small items, against the
strongest measured round on this workstream.

**Method:** the tests were not reviewed by reading them. **105 scored mutations**
were run against production code, the scanned source tree, `web/package.json`,
`web/index.html` and the test file's own rule implementations, and the suite was
asked which ones it noticed. Reading was used only to attribute a result to a
named assertion, never to reach a verdict. Harness lived entirely outside the
repository (`/tmp/mut/`), mutations were content-addressed with uniqueness
pre-validation, aborted rather than reporting green on any failed prerequisite,
and took every verdict from `spawnSync().status` of the `npm` child.

**Tree hygiene:** every mutation reverted from an in-memory byte-exact copy in a
`finally` block with the restore re-read and verified; the file-level runner
re-checked `git status --porcelain` after every spec and would have exited 3 on
a dirty tree. Final state: `npm test` exit **0** (75 checks / 122 assertions),
`git status --porcelain` empty, HEAD unchanged at `7b4f6dd`. Nothing pushed.

**No production code was modified except transiently.**

---

## Result: 103 of 105 caught

| Group | Target | Runs | Result |
|---|---|---|---|
| PC | positive control + null control + 3 abort controls | 5 | as predicted |
| A/B | each `FORBID_TAGS` / `FORBID_ATTR` entry, one at a time | 14 | 13 RED, 1 equivalent mutant |
| C/D | checkbox renderer, private `Marked` instance | 6 | all RED |
| E/F | non-string guard, four arity spellings | 5 | all RED |
| G/W/Y | the `sanitize` call and 13 config axes | 16 | 15 RED, 1 equivalent mutant |
| H | sink binding R1–R9 against the real components | 12 | all RED |
| K | all 8 `BANNED_SINKS` patterns + `index.html` | 10 | all RED |
| I | the test file's own rules and fixture tables | 20 | 16 RED, **4 GREEN** |
| N/T/Z | count pins, scope pin, tree changes, evisceration | 9 | 8 RED, **1 GREEN** |
| J | dependency floor + sunset clause + 2 controls | 8 | 6 RED, 2 GREEN (intended) |
| X | isolating `Function.length` as sole falsifier | 3 | as predicted |

### The round's three headline claims are confirmed by measurement

- **C2-e is closed** (H12). The exact three-part replay — shrink `REQUIRED_SINKS`,
  `\u`-escape the alias, render raw — that was GREEN at 68 checks is now RED from
  two independent directions: the scope pin `EXPECTED_REQUIRED_SINKS`, and R7
  promoted tree-wide. Both halves are load-bearing; neutering R7 alone (I9) is
  also RED, so the promotion is not redundant.
- **The private-`Marked` pin is real and specific** (D1). Swapping
  `new Marked({…})` for `marked.use({…})` on the shared singleton is RED, and
  *only* `renderMarkdown does not use the shared marked singleton` fires. Its
  inline positive control (asserting the poisoning took, before asserting it did
  not leak) genuinely runs.
- **`SANITIZE_DOM: false` reddens** (Y2), as does every other config axis I could
  weaken — `ALLOW_UNKNOWN_PROTOCOLS`, `ADD_ATTR`, `ADD_TAGS`, `ALLOWED_URI_REGEXP`,
  `WHOLE_DOCUMENT`, `KEEP_CONTENT`, `ALLOW_ARIA_ATTR`, `SANITIZE_NAMED_PROPS`.

### The pinned totals are predictions, not post-hoc tallies

The brief predicted sub-form 5 ("a count computed from the run, presented as a
prediction") was especially likely here. **It is absent.** All four totals are
hard literals and each was reproduced from a static read of the source, with the
runner's output never consulted:

- `EXPECTED_CHECK_CALL_SITES = 74` = `grep -cE '^\s+check\('` → 74.
- `EXPECTED_CHECKS` = 74 + (`REQUIRED_SINKS.length` − 1) = 75.
- `EXPECTED_ASSERTIONS = 122` = 120 textual `assert*` occurrences − 6 definitions
  = 114 call sites, −2 for the two inside `assertSvgStyleStripped`, +6 because
  three checks call that helper, +4 because the non-string loop runs its single
  `assertEqual` five times.
- `EXPECTED_SOURCE_FILES = 51` = 50 scannable files under `src/` + `index.html`.

Each was also shown to *fire* when contradicted (Z1, T3, N1/N5, H11). This is the
strongest single property of the round.

### Audit LOW-2 verified by exercise, not by reading

`web/index.html` is genuinely in the scanned set: an `innerHTML = location.hash`
(K9) and a `document.write` (K10) placed in its inline `<script>` both redden.

---

## Findings

**F-1 (blocking) — `fixtureTableViolation` is the unguarded guard.**
All 11 fixture tables are protected from silent shrinkage by exactly one
function, and it is the only predicate in the file with no positive control of
its own. Neutering it to always return `null` is **GREEN at 75/122** (I11), and
it re-opens every table: I11 + emptying `ARITY_EVASIONS` (I18), `OWNERSHIP_EVASIONS`
(I19) or `SINK_EVASIONS` (I20) are each GREEN. Individually those emptyings are
RED (I15/I16/I17), so the size pins work — what is missing is the one-level-out
control. The docblock above `fixtureTableViolation` opens "EVERY FIXTURE TABLE IN
THIS FILE IS EMPTYABLE, AND THAT IS THE SAME DEFECT THE TABLES WERE ADDED TO
FIX"; the fix it introduced now has that same shape, one level further out.
Coverage hole, not a mis-attributed assertion. Not exploitable from a component
file — it takes two deliberate edits to the test file. Fix is one `check()`
asserting the helper at a wrong length in both directions, plus bumping
`EXPECTED_CHECK_CALL_SITES` 74 → 75.

**F-2 (blocking) — this round's "correction 1" is itself measurably false.**
The r7 log and `markdown.ts:140-144` both state "there is no measured arity
SPELLING for which [`renderMarkdown.length === 1`] is the falsifier … every form
that survives `tsc` leaves `.length` at 1 by definition." `Function.length` stops
counting at the first **defaulted or rest** parameter, not the first *optional*
one, and TypeScript erases `?`. Measured: `(md, opts?: { inline?: boolean })`
compiles clean and yields `length = 2`. Isolated with a control triple — the
declaration scan blinded so `.length` was the only remaining arity assertion:
unmutated GREEN (X3), defaulted `opts = {}` GREEN (X1), `opts?: T` **RED** (X2).
The error is conservative — the pin is stronger than documented, and in the
shipped configuration that spelling is caught twice — but the failure message it
drives attributes the divergence to "stale build, bundler transform, or a
re-export", which misdirects on the one spelling where the assertion is
load-bearing. Three places to correct: `markdown.ts:140-144`,
`markdown.test.ts:616-627`, `markdown-sanitize-cleanup-r7.md:41-47`.

**F-3 (blocking, weakest of the three) — the EXACT-over-floor rationale is
refuted by one mutation.** The `EXPECTED_ASSERTIONS` docblock chooses exact over
a floor because "a floor is satisfied by adding two assertions somewhere new and
deleting two somewhere load-bearing." Measured: the **exact** count is satisfied
by precisely that. T1 (hollow the `slot` check + revert `slot` from `FORBID_ATTR`)
is RED at 120 ≠ 122 — the fix works — but T2, the same mutation plus two
assertions added to `headings render`, is **GREEN at 75/122**. An exact total
catches *net* change, not *compensated* change, and neither does a floor. Keep
the choice (exact is still strictly stronger); restate the reason to match
measurement.

**Correction 2 of the r7 log — VERIFIED ACCURATE.** The `ALLOW_UNKNOWN_PROTOCOLS`
block was test-only: `86f30bc:markdown.test.ts` lines 246/253/257, now 298/305/309,
and `86f30bc:markdown.ts` contains zero occurrences. Line numbers as claimed.

**Two GREENs that are NOT coverage holes.** Dropping `'formaction'` from
`FORBID_ATTR` (B-formaction) and adding `ADD_URI_SAFE_ATTR: ['formaction']` (Y10)
are both GREEN, and both were shown to be **equivalent mutants** rather than
gaps: a 24-payload differential probe reported BEHAVIOUR UNCHANGED for each (the
same probe reported CHANGED for `'slot'` on the next run), and `formaction`
appears nowhere in the installed DOMPurify bundle, so it is dropped with or
without our rule. The test at `markdown.test.ts:151-160` already discloses this
asymmetry correctly. One GREEN is latent-only: an unused second unsanitized
export in `markdown.ts` (W3) is invisible, and reddens the instant a sink calls
it (W4) — the right boundary.

---

## Void runs (disclosed)

Six, two of them the reviewer's own fault:

1. The harness was first written to `web/.mut/` — inside the tree the suite
   scans. Caught and moved to `/tmp/mut/` before the first run; no result in this
   review came from that location.
2. C3 v1: over-escaped `︎` in shell quoting produced a no-op edit. **The
   abort path prevented a false "the variation selector is unpinned" finding.**
3. T1/T2 v1: hand-typed multi-line anchors did not match; aborted twice. Anchors
   thereafter sliced programmatically out of the file.
4. I4 and 5. I10: neutering two rules by prefix-`return` broke TypeScript
   narrowing (`TS18047`), so `tsc` rejected the mutation and no test was
   exercised — scored RED-TSC and **void**, not RED. Re-done as shadowing shims
   (I12/I13): both RED. Group I's honest count is 9 scored, 2 void, not 11/11.
6. Y8: the reviewer predicted `SANITIZE_NAMED_PROPS: true` was a no-op and was
   wrong — it makes DOMPurify rename rather than drop clobbering props, and the
   suite correctly went RED. Recorded as a void prediction rather than relabelled.

## Where the brief was wrong

Its central risk hypothesis — "1060 lines of tests that cannot fail" — did not
survive contact. 103 of 105 mutations were caught by a named, correctly-worded
assertion. The two genuine gaps are (a) one 14-line helper everything else
depends on and nobody pointed a fixture at, and (b) a claim in the project log,
which is not test code. A leg hunting inert tests would have found F-1 and missed
F-2. The next brief on this workstream should say "find the one guard nobody
guards" rather than "assume the tests are inert."

## Not verified

No `node_modules` existed in-container, so `npm install` (not `npm ci`) was used
and `web/package-lock.json` is absent from the tree: **the installed DOMPurify
was never verified against the declared floor**, and the floor check reads
`package.json` only — it says so itself. No Lit component was rendered, so every
sink result is a source-level property of the guard. Only `npm test` and `tsc`
were re-run; the Vite and Go gates were taken from the r7 log.

## Non-blocking recommendations

- Retitle `dompurify declares a floor at or above the advisory line` to say
  *equals* — the predicate is string equality, so **raising** the floor is also
  RED (J3). Stronger than the title in the safe direction, but loose in the
  confusing direction.
- Carry the "untestable by construction" note from `markdown.test.ts:151-159`
  onto the `formaction` entry in `markdown.ts` itself.
- There is no signal for "DOMPurify's default `ALLOWED_ATTR` changed under us",
  which is the event that would convert `formaction` from defence-in-depth into
  load-bearing overnight. Out of scope for this round; worth an issue.

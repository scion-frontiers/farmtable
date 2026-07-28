# markdown sanitize round 8 — independent code review

Issue #195. Branch `markdown-sanitize-r8`, HEAD `3f6a695`, base `7b4f6dd`.
Independent code-review leg, run in parallel with an audit leg and a test leg on
the same SHA; no cross-visibility.

**Verdict: REQUEST CHANGES.** Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r8.md`.

## Setup asserted before reviewing

- `7b4f6dd` is an ancestor of `3f6a695`; negative control `1d4442f` is not.
- Surface excluding `.design/`: `web/src/util/markdown.ts` +79/−34,
  `web/src/util/markdown.test.ts` +514/−59. Matches the brief exactly.
- Working tree left clean. No production code modified. All mutation work done on
  a copy at `/tmp/probe` with `node_modules` symlinked, each run with
  `rm -rf .tmp-test` and a positive control.

## Gates

`npm ci` 0 · `npm test` 0 (**78 checks passed, 123 assertions**) ·
`npx tsc --noEmit` 0 · `npm run build` 0. Exit codes read from the child process.

## Blocking findings

**C1 (Critical) — the arity pin is live-bypassed again, by the round's own
replacement.** `stripInertText` deliberately preserves template literals, and a
TypeScript *template-literal type* is legal in a parameter type position. Two
spellings pass all three gates on the shipped tree with a real, usable defaulted
second parameter:

- ``md: string | `)` `` truncates `balancedDeclarationParameterLists` to one
  parameter (one-token attribution: the same declaration without the template, and
  with a template containing no `)`, are both RED);
- ``md: string | `(` `` inflates depth so the list is never terminated, and the
  returned tail splits to exactly one parameter with no depth-0 default.

The second case also falsifies `markdown.test.ts:1696-1698` — "an UNTERMINATED
list … the caller reports something rather than passing". Measured: it passes.

**R1 (Required) — the B4 parenthetical is a new false sentence.** The provenance
series counts *checks run*, not call sites: `EXPECTED_CHECKS` is 54 / 59 / 61 / 69
at the round-3/4/5/6 heads, and the round-6 project log records "69 checks passed".
`Moved 61 -> 69` is correct. Round 7's error was only the endpoint (should be
`69 -> 75`); round 8 re-based the last two entries into call-site units without a
marker and, from that mismatch, declared a correct line broken.

**R2 (Required) — B3a has no positive control.** Replacing `markdown.ts` verbatim
with the round-7 version (process-global DOMPurify, exploitable) is GREEN at
78/123 on a clean rebuild; a `slot`-revert control on the same harness is RED. The
`marked` half got a behavioural pin in round 7 for exactly this reason.

**R3 (Required) — "all eleven" is stale in four places.** `ARITY_EVASIONS` has
thirteen entries and `fixtureTableViolation` guards thirteen tables; both grew in
this round. The derived claim survives — I compiled all thirteen and read
`Function.length` back: exactly three (C7-d=2, C7-j=0, C7-k=0) are off 1.

## Claims verified as true

- **B3a is a genuine fix.** Round-7 code with singleton
  `setConfig({ADD_TAGS:['script'],ADD_ATTR:['onerror']})` emits
  `<img src="x" onerror="alert(1)"><script>alert(2)</script>`; round-8 code is
  unaffected. The quoted capture in `markdown.ts` is byte-accurate.
- **B1's ablation claim is exactly right.** With the declaration scan blinded and
  both arity tables emptied (ablated baseline still green), `opts?: T` is caught by
  `renderMarkdown.length === 1` and by nothing else, and `opts = {}` stays green.
- **B5b reproduces on the shipped tree.** Compensated shrinkage (−2/+2) is green at
  78/123 with `slot` protection removed and the attribute rendering intact.
- **B4's arithmetic** (68 → 74 → 77 call sites; six then three checks added, by
  name-diff) reproduces exactly. Only the unit is wrong.
- **No rendering change** from the private DOMPurify instance: the round-8 suite is
  green against the round-7 implementation.

## Where the brief was wrong

1. Judgement call 3's premise — the round-6 `61 -> 69` line is not wrong; the
   ruling installs the fifth false sentence in the chain.
2. B2 is described as guarding "eleven fixture tables"; it guards thirteen.
3. The C7-l hunting hint points at a `)` inside a *string* literal, which
   `stripInertText` blanks. The live vector is a *template* literal, which the same
   function preserves deliberately.

## Recommendation beyond this round

C1 is the third consecutive round in which this pin has been defeated by a
construct the file's own tokenizer documentation names. Worth deciding whether to
keep repairing it in place or to bring forward the type-aware lint rule tracked
under #204.

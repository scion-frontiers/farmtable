# #195 round 8 (`markdown-sanitize-r8` @ `3f6a695`): comment corrections, private DOMPurify instance, arity-pin rewrite — Review

Reviewer: independent code-review leg. Base `7b4f6dd` (asserted ancestor; negative
control `1d4442f` asserted *not* an ancestor). Surface excluding `.design/`:
`web/src/util/markdown.ts` +79/−34, `web/src/util/markdown.test.ts` +514/−59 — matches
the brief exactly. Working tree left clean; no production code modified. All mutation
work was done on a copy at `/tmp/probe` with `node_modules` symlinked.

## Executive Summary

Risk: **HIGH**. The round's headline repair — replacing the truncating `[^)]*` parameter
scanner with a depth counter — is itself bypassed on the shipped tree by two spellings I
measured green on all three gates, and its own docblock contains a sentence I measured
false. Separately, the B4 "correction" declares a *correct* round-6 provenance line wrong
and thereby installs the fifth false sentence in the chain the brief warned about, and the
round's real security fix (the private DOMPurify instance) ships with no positive control —
reverting it to the exploitable round-7 form is green at 78/123.

## Gates

Run in `web/`, exit codes taken from the child process.

| gate | expected | measured |
|---|---|---|
| `npm ci` | 0 | **0** |
| `npm test` | 0, 78 checks / 123 assertions | **0**, `markdown sanitizer: 78 checks passed (123 assertions)` |
| `npx tsc --noEmit` | 0 | **0** |
| `npm run build` | 0 | **0** |

## Critical

### C1. `balancedDeclarationParameterLists` is defeated by a template-literal type — the arity pin is live-bypassed again, one level down

`web/src/util/markdown.test.ts:1700-1719` (function), `:1666-1697` (docblock).

`stripInertText` blanks comments, quoted strings and regex bodies, and **deliberately
preserves template literals** (its own docblock, `:1189-1192`, says so). A TypeScript
*template-literal type* is legal in a parameter type position and its contents survive
into the scanned view. The depth counter counts every `(` and `)` in that surviving text.

Two spellings, both measured on the shipped tree with the whole real suite:

**Shape A — truncation.** `` md: string | `)` ``

```ts
export function renderMarkdown(md: string | `)`, opts: { inline?: boolean } = {}): string {
  if (typeof md !== 'string') return '';
  if (opts.inline === true) return md;
  ...
```

`balancedDeclarationParameterLists` captures `` md: string | ` `` — one parameter, no
default, no rest → `renderMarkdownArityViolation` returns `null`. `Function.length` is 1
because the second parameter is defaulted. `string | ")"` reduces to `string`, so the
first parameter is fully usable and `opts` is a real, usable configuration channel.

| gate | result |
|---|---|
| `npm test` | **exit 0** — `78 checks passed (123 assertions)` |
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | **exit 0** |

One-token attribution, same body, same second parameter:

| variant | `npm test` |
|---|---|
| `md: string` (no template) | **exit 1** — `renderMarkdown declares 2 parameters` |
| ``md: string \| `x` `` (template, no `)`) | **exit 1** — `renderMarkdown declares 2 parameters` |
| ``md: string \| `)` `` | **exit 0** |

The single character `)` inside the template is what does the work.

**Shape B — depth inflation / unterminated capture.** `` md: string | `(` `` is **also
green at 78/123**. Here the counter never returns to depth 0, the function falls into its
`depth === 0 ? i - 1 : code.length` branch and returns the entire tail of the file as the
parameter list; `splitTopLevelParameters` then sees the function body's `{` raise depth
and reports **one** parameter, and `hasTopLevelDefault` finds no depth-0 `=`. Simulated
directly:

```
FIRST PARAM: md: string | `(`
  captured : "md: string | `(`, opts: { inline?: boolean } = {}): string {\n  if (typeof md ..."
  n params : 1        -> renderMarkdownArityViolation returns null
```

That falsifies this sentence at `:1696-1698`:

> An UNTERMINATED list is not silently skipped — it is returned as-is, so
> `splitTopLevelParameters` sees the whole tail and the caller reports something rather
> than passing.

Measured: the caller passes.

**Suggested fix.**
1. Give this scan a view in which template literals are blanked too — either a
   `stripInertText(src, { strings: true, templates: true })` option, or a local blanking
   pass applied only to the declaration scan. Templates are preserved because `html`…``
   bodies hold the real sinks; that reason does not apply to `markdown.ts`'s declaration.
2. Make an unterminated list a **violation**, not a returned tail. Return a sentinel and
   have `renderMarkdownArityViolation` report `renderMarkdown's parameter list is
   unterminated in the scanned view`.
3. Add both spellings to `ARITY_EVASIONS` as C7-n / C7-o and bump the table pin from 13
   to 15. Add a false-positive mirror to `ARITY_LEGITIMATE` (a template-literal *type*
   with balanced parens, e.g. ``md: string | `a(b)` ``) so the repair does not red-light
   correct code.
4. Correct the `:1696-1698` sentence to match whatever behaviour ships.

Note the shape: the round-7 defect was "a check that stops at the first thing it finds
cannot see the second", and the round-8 docblock names it. The round-8 defect is "a
character-level counter that does not model the lexer cannot see what the lexer hides" —
and the file already documents, in `stripInertText`, exactly which construct it hides.

## Required

### R1. The `Moved 61 -> 69` parenthetical (B4) is a new false sentence — the round-6 line is correct

`web/src/util/markdown.test.ts:3618-3621`, echoed at
`.design/project-log/markdown-sanitize-cleanup-r8.md:147`.

> (The round-6 line above says 61 -> 69. Round-6 head `86f30bc` measures 68, so one of
> those two endpoints is wrong. …)

Neither endpoint is wrong. The provenance series is written in units of **checks run**
(`EXPECTED_CHECKS`, the number the suite prints and the number the project log records) —
not call sites. Measured across the whole series:

| revision | `grep -cE '^\s+check\('` | `EXPECTED_CHECKS` |
|---|---|---|
| `9932eff` (round-3 head) | 53 | **54** |
| `ca1a26e` (round-4 head) | 58 | **59** |
| `3b5312b` (round-5 head) | 60 | **61** |
| `86f30bc` (round-6 head) | 68 | **69** (`68 + (REQUIRED_SINKS.length − 1)`, `REQUIRED_SINKS.length === 2`) |
| `7b4f6dd` (round-7 head) | 74 | 75 |
| `3f6a695` (this tree) | 77 | 78 |

- `Moved 54 -> 59` ✓ in checks-run units (call sites would be 53 → 58)
- `Moved 59 -> 61` ✓ in checks-run units (call sites 58 → 60)
- `Moved 61 -> 69` ✓ in checks-run units (call sites 60 → 68)

Independent corroboration: `.design/project-log/markdown-sanitize-cleanup-r6.md:6` records
the round-6 gate as "**69 checks passed**". Two endpoints matching in the same unit, plus
two earlier entries matching in the same unit, plus the round-6 log, is not coincidence.

What round 7 actually got wrong was only the *endpoint*: `Moved 69 -> 73` should have been
`Moved 69 -> 75` (six checks added, not four). Round 8 instead silently re-based the last
two entries into **call-site** units (`68 -> 74`, `74 -> 77`) and, from that unit mismatch,
declared a correct line broken and left it "unreconciled" for future readers.

This is precisely the failure the brief's preamble warned about, and it means judgement
call #3 has the wrong premise: the question is not whether a code comment is the right
place for the flag, it is that there is nothing to flag.

**Suggested fix.** Delete the parenthetical. Either (a) restate the two new entries in the
series' existing units — `Moved 69 -> 75 in round 7 — SIX checks`, `Moved 75 -> 78 in
round 8 — THREE checks` — keeping the measurement command but applying
`+ (REQUIRED_SINKS.length − 1)`; or (b) keep call-site units and add one explicit line
saying the series changed unit at round 7 and that entries above it count checks run.
Do not leave two units on adjacent lines with no marker.

### R2. B3a — the private DOMPurify instance — ships with no positive control

`web/src/util/markdown.ts:130`.

The fix is real. I reproduced the round-7 vulnerability end-to-end and confirmed round 8
closes it (see Positive Feedback). But nothing in the suite asserts the property.

Measured, clean rebuild (`rm -rf .tmp-test`), `web/src/util/markdown.ts` replaced verbatim
with `git show 7b4f6dd:web/src/util/markdown.ts` — i.e. the process-global singleton, zero
occurrences of `createDOMPurify`, compiled artifact confirmed to contain
`DOMPurify.sanitize` at line 158:

```
npm test EXIT=0    markdown sanitizer: 78 checks passed (123 assertions)
```

Harness positive control, same procedure, `slot` reverted from `FORBID_ATTR`:

```
npm test EXIT=1    slot attribute stripped …: slot attribute survived
```

So the revert is genuinely invisible, and the reverted code is measurably exploitable —
under it, singleton `setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] })` makes
`renderMarkdown` emit `<p><img src="x" onerror="alert(1)"><script>alert(2)</script></p>`.

This is the same shape as B2, the item this very round added to close the
`fixtureTableViolation` hole: a security property with no test that reddens when it is
removed. `markdown.ts:116-118` says "A pattern-matching guard cannot own a global. Only
ownership can, which is what the line below now does" — and nothing pins the line below.
The `marked` half got a behavioural pin in round 7 for exactly this reason
(`markdown.ts:71-76`); the DOMPurify half got the fix without the pin.

**Suggested fix.** Add a check mirroring `renderMarkdown does not use the shared marked
singleton`: import the `dompurify` default export, snapshot `renderMarkdown(payload)`,
call `setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] })`, assert the output is
unchanged, and assert the poisoning took as an inline positive control (e.g. that
`DOMPurify.sanitize(payload)` *does* change). Unlike `marked.use`, this is reversible —
`DOMPurify.clearConfig()` — so it needs no ordering constraint and no new section.
Bump `EXPECTED_CHECK_CALL_SITES` and `EXPECTED_ASSERTIONS` accordingly.

### R3. "all eleven" is stale in three places — the round that made it false is this one

The four-places arity sentence the brief asked me to check is **consistent across all four
sites and its content is correct**, with one exception: the denominator.

- `web/src/util/markdown.ts:176` — "Measured on this tree, all eleven `ARITY_EVASIONS`…"
- `web/src/util/markdown.test.ts:636` — "Measured over all eleven `ARITY_EVASIONS`…"
- `.design/project-log/markdown-sanitize-cleanup-r7.md` (round-8 retro-edit block)

`ARITY_EVASIONS` has **thirteen** entries on this tree, pinned at 13 by
`fixtureTableViolation('ARITY_EVASIONS', ARITY_EVASIONS, 13)`. C7-l and C7-m were added by
commit `4b430c6` in this same round.

The derived claim survives — I compiled all thirteen with `tsc` and read `.length` back:

```
 1 C7-a   1 C7-b   1 C7-c   2 C7-d   1 C7-e2  1 C7-g   1 C7-h
 1 C7-i   0 C7-j   1 C7-f   0 C7-k   1 C7-l   1 C7-m
OFF-1 COUNT: 3  ->  C7-d, C7-j, C7-k
```

So "three (C7-j, C7-k, C7-d)" is exactly right; only "eleven" is wrong. Say **thirteen**.

Same defect at `web/src/util/markdown.test.ts:3205`: "All eleven fixture tables are
protected from silent shrinkage by exactly one function". There are **thirteen** distinct
tables passed to `fixtureTableViolation` on this tree — the two new ones,
`DYNAMIC_IMPORT_EVASIONS` and `DYNAMIC_IMPORT_LEGITIMATE`, were added by `4333278` in this
round. (It was eleven at `7b4f6dd`.) `:3217` "all eleven arity bypasses unprotected" is a
past measurement and defensible, but reads as present tense next to a table of 13.

**Suggested fix.** Change to "thirteen" in all four places; at `:3205`, prefer a form that
cannot go stale ("every fixture table in this file").

## Nit / Optional

- **Optional — `markdown.test.ts:32`** still says "see the last check in `taskLists()`".
  This round moved that check out of `taskLists()` into `sharedMarkedSingleton()`; the
  section header at `:757-770` argues at length that comment-enforced ordering is the
  defect being fixed, and then leaves a comment pointing at the old home. Point it at
  `sharedMarkedSingleton()`.
- **Optional — measurement numbers presented as "on this tree" that are one commit stale.**
  `markdown.test.ts:1685` and the C7-l fixture comment (`:1573-1576`) say "78 checks / 122
  assertions"; `:2507` and `:3216` say "GREEN 77/122"; `:3665-3672` says "GREEN at 78
  checks / 122 assertions" and "red here at 120". On the shipped tree the pins are 78/123,
  so the compensated mutation lands at 78/**123** and the uncompensated half at **121**.
  Every one of these is a true measurement at an intermediate commit, presented with the
  words "Measured, on this tree". Given that this whole round exists to stop measurements
  being read as properties, either re-state them against `3f6a695` or name the commit.
  (I re-ran the B5b mutation against the shipped tree — see Positive Feedback — so the
  substance holds; only the digits are stale.)
- **Nit — `markdown.test.ts:3633`.** Item 5 of the round-7 enumeration is listed as
  `dompurify declares a floor equal to the advisory line`, but the enumeration claims to be
  "a name-diff between the same two revisions" (`86f30bc`, `7b4f6dd`). At `7b4f6dd` the
  check was named `…floor at or above the advisory line`; the current name was introduced
  by this round. The name-diff I ran returns the old name. Use the name the diff produced,
  or note the rename.
- **Nit — `markdown.test.ts:2609`.** `lineOf(code, code.indexOf(arg))` finds the *first*
  textual occurrence of the argument, not the offending call. Two identical dynamic
  imports in one file both report the first one's line. Track the match index from
  `callArguments` instead, or drop the line number rather than print a wrong one.
- **Consider — the tree-wide R6b promotion (judgement call #2): keep it, with one caveat.**
  The reasoning holds and the rule is properly fixtured against two new tables rather than
  against a vacuous tree, which is the right call. The cost is real and foreseeable
  though: it bans the canonical Vite code-splitting spelling
  ``import(`./locales/${lang}.js`)`` tree-wide, and `npm run build` on this very tree is
  emitting `825.07 kB … Some chunks are larger than 500 kB … Consider using dynamic
  import()`. The rule and the bundler are now giving opposite advice. The offender message
  explains the *why* but offers no route forward. Add one clause naming the escape hatch
  (a reviewed allowlist entry, or a `// r6b-allow:` marker pinned by its own fixture) so
  the first developer who hits it does not delete the rule.

## FYI

- **Judgement call #1 — does `createDOMPurify(window)` change rendering?** No. I ran the
  round-8 suite (all 78 checks, 123 assertions, including the full payload corpus) against
  the round-7 `markdown.ts` on a clean rebuild: green. Output is byte-identical for the
  probe payloads. Nothing else in the tree adds hooks or config to the singleton.
- **Judgement call #1 — is `window` the right argument everywhere?** For this tree, yes.
  `markdown.ts` is imported only by `ft-inspector-comments.ts` and `ft-inspector-desc.ts`,
  both Lit components; there is no SSR entry, no `--ssr` build, and no worker. `vite build`
  never evaluates the module. The test constructs a JSDOM and assigns `globalThis.window`
  before importing, so bare `window` resolves.
  One nuance the comment at `:123-129` does not state: the *failure mode* did change. With
  no `window`, dompurify@3.4.12's default export still constructs (`isSupported === false`)
  and only fails later — I measured `TypeError: d.sanitize is not a function` at call time.
  `createDOMPurify(window)` throws `ReferenceError` at module load instead. So "That cost
  was already being paid in full … it does not introduce one" is true of the *dependency*
  and incomplete about the *failure point*. Fail-fast is the better of the two, and no
  consumer is affected — but one clause saying so would make the sentence unambiguously
  true. Not blocking.
- **`hasTopLevelDefault`** — rename and the `=>` skip are correct. I checked the
  neighbouring shapes: `(x) => x` as a default value still reports `true`; `<T>(x: T) => T`
  is handled by the `<`/`>` depth counting; both are pinned in `ARITY_LEGITIMATE`.
- **`stripImportStatements`** — `(?!\s*[.(])` is correct for all three productions I could
  construct: `import ('x')` (space before paren) is excluded from the statement rule and is
  not matched by the bare-specifier rule either, so R6b sees it; `import 'polyfill';` is
  still wiped; `import.meta` still survives. The docblock's refusal to re-assert "all three
  productions are handled" without checking is the right instinct.

## Positive Feedback

Not manufactured — these are the claims I set out to falsify and could not.

- **B3a is a genuine, correctly-described security fix.** I reproduced the round-7 hole
  end-to-end. Against `7b4f6dd`'s `markdown.ts`, after singleton
  `setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] })`:
  `baseline "<p><img src=\"x\"></p>"` → `captured "<p><img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script></p>"`.
  Against `3f6a695`: **no effect**. The comment's quoted capture at `markdown.ts:99-102` is
  byte-accurate (modulo a trailing newline). I also confirmed the round-7 rationale it
  overturns: under `setConfig({ FORBID_TAGS: [], FORBID_ATTR: [] })` the old code really
  does return `<h1>hi <form><input></form></h1>` while leaving `<script>` stripped — so
  the round-7 measurement was right and its generalisation was wrong, exactly as stated.
- **B1's ablation claim is exactly true, and it is the hardest claim in the round.** I
  blinded `renderMarkdownArityViolation`, emptied both arity tables and relaxed their size
  pins (ablated baseline still green at 78/123, so the ablation is neutral). Then:
  `opts?: { inline?: boolean }` → **exit 1, one failure, the `.length` assertion, `got "2"`**;
  `opts: { inline?: boolean } = {}` → **exit 0**. "Caught by `.length === 1` and by nothing
  else, while `opts = {}` under the same ablation stays green" is verbatim correct. This is
  the sentence the brief says it nearly got wrong, and the leg got it right.
- **B5b's refutation of the old `EXPECTED_ASSERTIONS` rationale reproduces on the shipped
  tree.** Reverting `slot` from `FORBID_ATTR`, hollowing `slot attribute stripped` with an
  early return (−2) and padding `style attribute stripped` (+2): **exit 0, 78 checks / 123
  assertions**, with `renderMarkdown('<div slot="footer">x</div>')` returning
  `<div slot="footer">x</div>` intact. The honest replacement paragraph — that exact-vs-floor
  is a *review* property, not a detection property — is correct and is the kind of
  correction that is easy to skip.
- **B4's arithmetic is right where it is right.** 68 → 74 → 77 call sites reproduce with the
  stated command, and the name-diffs return exactly six added checks between `86f30bc` and
  `7b4f6dd` and exactly three between `7b4f6dd` and `3f6a695`, matching both enumerations.
  The two `dependencyPolicy()` checks really were omitted by round 7. Only the *unit* is
  wrong (R1).
- **B2 is the right move.** `fixtureTableViolation` guarding thirteen tables with no
  positive control was a genuine level-out hole, and the new check tests all four
  directions including LENGTHENED.

## Test Coverage

New code paths are covered with the exception of the two that matter most:

- `balancedDeclarationParameterLists` — fixtured against C7-l/C7-m but **not** against the
  template-literal shapes that defeat it (C1).
- `createDOMPurify(window)` — **not covered at all** (R2). This is the round's only
  production-behaviour change.
- `dynamicImportSpecifierOffenders` — well covered: 5 evasions, 5 false-positive mirrors,
  the loop calls the predicate by name rather than asking whether "some rule fired", and
  `import.meta` is pinned as a non-offender to catch the interaction with the widened
  `stripImportStatements` lookahead. Good.
- `hasTopLevelDefault` — covered by the two new `ARITY_LEGITIMATE` entries.
- `fixtureTableViolation` — now covered in all four directions.

## Backward Compatibility

No wire-format, proto, or Go-side changes. `renderMarkdown`'s exported signature is
unchanged. No new dependency (`dompurify@3.4.12` already present; `createDOMPurify` is the
same module's default export used as a factory). `npm ci` reports 0 vulnerabilities.

## What I could not verify

- The claim at `markdown.ts:111-114` and `markdown.test.ts:2585-2589` that
  `import('dompur' + 'ify')` appears "verbatim in the shipped bundle", that Rollup resolves
  it to the same chunk, and that
  `(await import('dompur'+'ify')).default === (await import('dompurify')).default`. I
  verified the load-bearing half — that poisoning the singleton from *anywhere* in-process
  defeats the round-7 sanitizer — directly in Node. The bundler half I did not rebuild.
- The B3b attribution measurement ("GREEN 75/122 with `tsc` exit 0" for the `import(spec)`
  block appended to `src/util/format.ts`, with two red controls). The fixture is present in
  `INDIRECTION_EVASIONS` and the suite exercises it, so the *rule* is controlled; I did not
  re-run the tree-level attribution.
- Whether all eight `ARITY_LEGITIMATE` entries compile under `tsc` (not claimed anywhere;
  they are exercised as source text only).
- Any behaviour of the two Lit sink components at runtime in a browser.

## My void runs

Recorded per the standing bar.

1. First two mutation runs piped `npm test` through `tail` and read `${PIPESTATUS[0]}`,
   which came back empty because the tool resets the shell working directory between
   invocations. No verdict was drawn from them; every result above comes from a direct
   `npm test > log; echo $?`.
2. First round-7 differential reused a stale `.tmp-test/` output directory, so I could not
   prove `tsc` had rebuilt the swapped `markdown.ts`. Discarded and re-run with
   `rm -rf .tmp-test`, plus a grep of the compiled artifact (`DOMPurify.sanitize` present,
   `createDOMPurify` absent) and a `slot`-revert positive control that reddened.
3. My first fixture-extraction regex parsed 13 `ARITY_EVASIONS` entries but only 7 of 8
   `ARITY_LEGITIMATE` entries (one label uses double quotes). Caught because 7 disagreed
   with the pinned 8; re-counted by reading the table.

## WHERE THIS BRIEF IS WRONG

1. **§"Judgement calls I want", item 3 — the premise is false.** The brief states the
   round-6 `Moved 61 -> 69` line "has a wrong endpoint" and rules KEEP on the leg's
   parenthetical saying so. Measured across five revisions plus the round-6 project log:
   both endpoints are correct in the series' own units (checks run). The ruling installs
   the fifth false sentence in the chain — the exact outcome the brief's own preamble
   asked me to hunt. See R1.
2. **§"What round 8 changed", B2 — "the single function guarding eleven fixture tables".**
   It guards **thirteen** on this tree; two were added by `4333278` in this same round.
   The brief carries the same stale number the code does. See R3.
3. **§"C7-l" — the pointer is aimed one construct off.** The brief says "a depth counter
   that mishandles a `)` inside a **string literal** has the identical shape one level
   down". `stripInertText` blanks string literals, so that vector is closed. The live
   vector is a **template literal**, which the same function preserves *deliberately* and
   documents doing so. Following the brief's wording literally would have found nothing.
   See C1.

Everything else in the brief checked out: base ancestry and the negative control, the
measured surface (+79/−34 and +514/−59), the three gate expectations including 78/123, and
the `npm ci`-not-`npm install` instruction.

## Final Verdict

**REQUEST CHANGES**

Blocking: **C1** (live arity bypass in the round's own replacement, plus a false sentence
in its docblock), **R1** (new false sentence declaring a correct line wrong), **R2** (the
round's production security change has no positive control), **R3** (stale "eleven" in
four places).

The round's substance is good and most of its hardest claims survived adversarial
measurement. Recommend one more round rather than a rewrite. Given that C1 is the third
consecutive round in which the arity pin has been defeated by a construct the file's own
tokenizer documentation names, I would also recommend the dispatcher consider whether this
pin should keep being repaired in-place or be replaced by the type-aware lint rule already
tracked under `#204`.

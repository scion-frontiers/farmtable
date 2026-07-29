# Prediction file 2 — probe cases, mutation table, ablation

Written BEFORE running the probe, any mutation, or the ablation.
Baseline already measured and recorded in predictions-01: GREEN, 78 checks, 123
assertions, tsc 0, build 0. Nothing below has been executed yet.

Mutations are CONTENT-ADDRESSED via `.mutate.py`, which aborts if an anchor is
not unique, aborts on a non-GREEN/non-78/123 baseline, aborts on a green run it
cannot parse a check total from, and restores + re-verifies `git status` after
every run.

---

## Part 1 — probe of `balancedDeclarationParameterLists` under quoting

The probe is the five arity-pin functions (`stripInertText`,
`splitTopLevelParameters`, `balancedDeclarationParameterLists`,
`renderMarkdownArityViolation`, `hasTopLevelDefault`) extracted VERBATIM from
markdown.test.ts by anchor, compiled with the project's own tsc.

Reasoning behind the predictions: `renderMarkdownArityViolation` runs the scan
over `stripInertText(src, { strings: true })`. That view blanks line comments,
block comments, quoted-string CONTENTS and regex-literal BODIES — but it
DELIBERATELY PRESERVES TEMPLATE LITERALS ("`html`…`` bodies are live code in this
codebase"). `balancedDeclarationParameterLists` counts raw `(`/`)` over that
view. So a `)` that survives into the view truncates the capture.

| # | case | prediction |
|---|---|---|
| P1 | the real sound declaration | violation `null` |
| P2 | `md: string \| ')'` + `opts: {inline?:boolean} = {}` (STRING literal type) | CAUGHT — `)` blanked, 2 params seen |
| P3 | ``md: string \| `)` `` + `opts: {inline?:boolean} = {}` (TEMPLATE literal type) | **NOT CAUGHT — violation `null`. A live bypass of the same shape as C7-l.** |
| P4 | `opts = { re: /\)/ }` (regex literal) | CAUGHT — regex body blanked |
| P5 | `md: string, // )` newline `opts = {}` (line comment) | CAUGHT — comment blanked |
| P6 | `md: string /* ) */, opts = {}` (block comment) | CAUGHT |
| P7 | ``opts = { s: `)` }`` (template literal in a DEFAULT) | CAUGHT — the truncation lands after the top-level comma, so 2 params are still seen |
| P8 | C7-l verbatim (regression) | CAUGHT |
| P9 | ``md: `(` , ...rest: unknown[]`` (unbalanced `(` in a template) | CAUGHT — list never closes, whole tail returned, >1 params |
| P10 | `export function renderMarkdown (md: string, opts = {})` (space before paren) | CAUGHT (the `\s*` in the regex) |

## Part 2 — mutation table

`GREEN` means exit 0 at 78 checks / 123 assertions unless stated.
"RED via X" names the check I expect to report, which is the claim being tested —
"something caught it" and "this rule caught it" are different claims.

### Group A — `balancedDeclarationParameterLists` (the §2 target)

| ID | mutation | prediction |
|----|----------|------------|
| A1 | whole function reverted to the pre-round-8 `/export function renderMarkdown\s*\(([^)]*)\)/g` capture | **RED**, exactly one check fails — `fixture: the arity pin catches every known widening and rejects nothing correct` — listing `SURVIVED: C7-l …` and `SURVIVED: C7-m …` and no other survivor |
| A2 | one-token version: delete `if (c === '(') depth += 1;` | **RED**, same check, same two survivors |
| A3 | delete `else if (c === ')') depth -= 1;` | **RED** — list never closes on any input, the real markdown.ts scan returns the whole tail; both `renderMarkdown accepts exactly one parameter` and the arity fixture fail |
| A4 | return after the first declaration (drop the `while` over further matches) | **RED** via `SURVIVED: C7-e2 …` (overloads) |
| A5 | drop `\s*` from `/export function renderMarkdown\s*\(/g` | **GREEN**. Then verified against probe P10: I predict the mutant FAILS SAFE (decls.length 0 -> "could not find a declaration" violation), i.e. this is a green mutation that did **not** weaken the guard. Reported as such, not as a hole. |
| A6 | delete `re.lastIndex = i;` | **GREEN**, and predicted semantically inert (no input in this file can put a second `export function renderMarkdown(` inside the first one's parameter list) |
| A7 | unterminated fallback `code.length` -> `i - 1` | **GREEN**, predicted a no-op (when unterminated, `i === code.length`) |

### Group B — the docblock's UNTERMINATED claim

| ID | mutation | prediction |
|----|----------|------------|
| B1 | make the unterminated branch push nothing (silently skip) | **GREEN** — nothing in the suite feeds this function an unterminated list, so the docblock sentence "An UNTERMINATED list is not silently skipped" is unfixtured. Low. |

### Group C — the other half of the arity pin

| ID | mutation | prediction |
|----|----------|------------|
| C1 | `renderMarkdownArityViolation`: `stripInertText(src, { strings: true })` -> `{ strings: false }` | **GREEN** -> finding: the string-blanking half of rule A is unpinned, and the two ARITY_LEGITIMATE entries advertised as its mirrors do not exercise it |
| C2 | same call -> raw `src` (no stripping at all) | **RED** via `FALSE POSITIVE: a comment inside the parameter list` (so COMMENT blanking is pinned, string blanking is not) |
| C3 | `hasTopLevelDefault`: drop the `param[i + 1] !== '>'` guard | **RED** via `FALSE POSITIVE: a function-typed sole parameter` and `… generic function-typed sole parameter` — confirms round 8's B-fix is now genuinely reachable |
| C4 | `splitTopLevelParameters`: remove `<` and `>` from the depth characters | **RED** via `FALSE POSITIVE: a comma inside a type argument` |

### Group D — the LIVE bypass I expect to find (the C7-l shape, re-entered through the one token stripInertText preserves)

Applied to the REAL `web/src/util/markdown.ts`, with a genuinely usable second
parameter that reconfigures the sanitizer — the exact configuration channel the
pin exists to deny.

```
export function renderMarkdown(md: string | `x)y`, opts: { inline?: boolean } = {}): string {
  if (typeof md !== 'string') return '';
  return purifier.sanitize(parser.parse(md) as string, {
    FORBID_TAGS: opts.inline ? [] : FORBID_TAGS,
    FORBID_ATTR: opts.inline ? [] : FORBID_ATTR,
  });
}
```

| ID | mutation | prediction |
|----|----------|------------|
| D1 | as above | **GREEN 78 checks / 123 assertions, `tsc --noEmit` exit 0, `npm run build` exit 0** — a live bypass at HEAD |
| D2 | one-token control: `` `x)y` `` -> `'x)y'` (quoted) | **RED** — strings are blanked, the `)` disappears, 2 params are seen |
| D3 | one-token control: the `\| \`x)y\`` term deleted entirely | **RED** — a plain two-parameter declaration |

D2 and D3 together are the attribution: the BACKTICK is what does the work, not
the block's shape.

### Group E — §3, B2's positive control for `fixtureTableViolation`

| ID | mutation | prediction |
|----|----------|------------|
| E1 | neuter `fixtureTableViolation` to `return null` unconditionally | **RED**, and **exactly one** check fails: `fixture: the table-size pin fires on a changed table length`, reporting all three of "silent on a SHORTENED table", "silent on an EMPTIED table", "silent on a LENGTHENED table". No other check fires. |
| E2 | E1 **and** empty `ARITY_EVASIONS` on top | **RED**, still only B2's control. Reproduces the leg's "stayed green with a table emptied" measurement in its post-fix form. |
| E3 | `fixtureTableViolation`: `table.length === expected` -> `table.length >= expected` (floor) | **RED** via `the table-size pin is silent on a LENGTHENED table` only |
| E4 | `fixtureTableViolation`: compare `table.length === table.length` (self-derived) | **RED** via B2's control (all three directions) |

Together these answer §3(a) fires when neutered, (b) for the right reason, (c) it
does not fire on a healthy tree (the baseline is green).

### Group F — the §2 ablation, reproduced independently

Ablation: insert `return null;` as the first statement of
`renderMarkdownArityViolation`; empty `ARITY_EVASIONS` and `ARITY_LEGITIMATE`;
set their two `fixtureTableViolation` expected counts to 0. Verify the ablated
tree is GREEN 78/123 FIRST (that is the ablation's own positive control — if the
ablated tree is red, the ablation is not isolating anything). Then apply each of
the THIRTEEN ARITY_EVASIONS spellings to the real `markdown.ts` declaration and
record RED/GREEN, separating "RED via the suite" from "RED via tsc".

Predicted survivors/catches under ablation (only `renderMarkdown.length === 1`
remains):

| spelling | `.length` | prediction |
|---|---|---|
| C7-a `(md, opts: R = {})` | 1 | GREEN (survives) |
| C7-b `(md, ...rest)` | 1 | GREEN |
| C7-c `(md, {inline} = {})` | 1 | GREEN |
| C7-d `(md, opts?: T)` | 2 | **RED via `.length`** |
| C7-e2 overloads + `(md, opts = {})` | 1 | GREEN |
| C7-g comment + `(md, opts = {})` | 1 | GREEN |
| C7-h string + `(md, opts = {})` | 1 | GREEN |
| C7-i `({md, inline})` | 1 | GREEN |
| C7-j `(...md: string[])` | 0 | **RED via `.length`** |
| C7-f arrow const `(md, opts = {})` | 1 | GREEN |
| C7-k `(md: string = '')` | 0 | **RED via `.length`** |
| C7-l parenthesised type + `opts = {}` | 1 | GREEN |
| C7-m function type + `opts = {}` | 1 | GREEN |

**PREDICTION: `.length === 1` has unique coverage under ablation for THREE
spellings — C7-d (UP), C7-j (DOWN) and C7-k (DOWN) — not one.**

That matters, because the round-8 sentence at markdown.test.ts:644 says the
assertion "is a backstop for exactly the UP direction, plus source/artifact
divergence". If C7-j and C7-k also redden under the ablation and are caught by
nothing else, "exactly the UP direction" is FALSE — it is a backstop for both
directions. I predict that sentence is wrong. (I do NOT predict the brief's
alternative — that `.length` has no unique coverage at all.)

Corroboration: a direct `renderMarkdown.length` read-back for all thirteen
spellings, independent of the suite.

### Group G — fixture tables that `fixtureTableViolation` does NOT guard

Thirteen NAMED tables are guarded. The `fixture: sanitizer ownership holds
against every route to the singleton` check also loops over THREE INLINE arrays
that no `fixtureTableViolation` call covers.

| ID | mutation | prediction |
|----|----------|------------|
| G1 | empty the inline `for (const clean of [ … ])` array (4 false-positive controls) in the ownership check | **GREEN 78/123** — an unguarded, silently-emptyable fixture table, which is the exact defect `fixtureTableViolation` exists to prevent |
| G1b | empty the inline `for (const laundered of [ … ])` array (3 R9 positives) | **GREEN 78/123** |
| G1c | empty the inline `for (const asset of [ … ])` array (2 inert-asset controls) | **GREEN 78/123** |
| G2 | empty the inline `for (const bad of [undefined, null, 42, {}, []])` in `inputContract` | **RED** via the assertion total (123 -> 118) — contrast case showing the assertion pin does cover the inline table that runs assert\* helpers |

### Group H — round-8's promoted tree-wide checks: is the CALL SITE controlled?

Both promoted rules are vacuous against the tree today (to be verified by grep
first). Their PREDICATES are fixtured; their tree-wide CALL SITES may not be.

| ID | mutation | prediction |
|----|----------|------------|
| H0 | grep: does any file in the scanned set contain a dynamic `import(` or a `\u`/`\x` escape outside a string? | predicted: none of either |
| H1 | neuter the body of `tripwire: every dynamic import specifier is a plain quoted literal` (B3c, round 8) to a no-op | **GREEN** — the tree-wide call site has no red-on-revert of its own |
| H2 | neuter the body of `tripwire: no file spells an identifier with a unicode or hex escape` (round 7) to a no-op | **GREEN** — same |

## Part 3 — the two docblock-history items from brief §4

Already measured statically before this file was written (recorded here so the
prediction and the measurement are not confused):

- The round-6 "GREEN at 69 checks" figures: the file itself already flags the
  61->69 line as unreconciled at markdown.test.ts:3618-3621. Prediction: the
  remaining "green at 69" figures are unanchored prose. Low at most.
- The r7-log "round 6 landed three production changes, not four": not yet
  examined.

**Newly predicted (from a static read, not yet cross-checked against git): four
"eleven" sentences introduced THIS ROUND are wrong at HEAD.** Verified counts
already taken: ARITY_EVASIONS has 13 entries at HEAD (11 at 7b4f6dd and at
1e4ac81/2e663b1; 4b430c6 took it to 13); the number of named tables guarded by
`fixtureTableViolation` is 13 at HEAD and was already 13 at 4333278.

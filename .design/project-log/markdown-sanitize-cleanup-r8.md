# markdown sanitize cleanup — round 8

Issue #195. Branch `markdown-sanitize-r8`, based on round-7 head `7b4f6dd`.

Three independent review legs returned REQUEST CHANGES on round 7 with **0
Critical, 0 High and no live vulnerability found**. The round's entire production
delta was comments. The blocking findings were false claims *in* those comments,
plus one missing control and one guard hole.

Round 8 was worked as a **single leg** deliberately: every item lived in the same
three files, and splitting by file is what produced the gap on a sibling issue.

Final state: **78 checks / 123 assertions**, `tsc --noEmit` and `vite build`
clean, all exit codes read from the child process.

---

## The round-7 defect, in one sentence

Round 7 replaced false claims with new false claims, because each correction was
verified in the direction the corrector was looking.

The clearest case is B1. The sentence

> every form that survives `tsc` leaves `.length` at 1 by definition

was falsified by **two** round-7 legs in **opposite** directions — one measured
`Function.length` going to 0, one measured it going to 2 — and neither found the
other's case. Fixing either half alone would have shipped a new false sentence in
the commit that fixed the old one.

The rule, stated in both directions and now written that way in all four places
it appears: **`Function.length` stops at the first DEFAULTED-OR-REST parameter,
not at the first OPTIONAL one.** TypeScript erases `?`, so `(md, opts?: T)`
emits a genuine two-parameter function and `.length` reads **2**; `(...md: T[])`
and `(md = '')` read **0**. Three of the eleven `ARITY_EVASIONS` (C7-d, C7-j,
C7-k) put it off 1.

A correction the brief itself did not anticipate: `.length === 1` is still not
the *reporter* for those three, because the declaration scan runs first and
throws. Its unique coverage was established by **ablation** — scan blinded, both
arity tables emptied — under which `opts?: T` is caught by `.length === 1` and
nothing else, while `opts = {}` stays green. Backstop for the UP direction, plus
source/artifact divergence. Anything stronger would have been the fourth false
sentence in the chain.

## Production changes (two, both security)

**1. The sanitizer owns a private DOMPurify instance.** Round 7 recorded the
`marked`-private / DOMPurify-singleton asymmetry as *accepted* (audit INFO-2), on
two stated grounds, both measured false in round 8:

- *"the phishing form and the spoofing overlay come back, `alert(1)` does not"* —
  false. `setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] })` on the
  singleton returns `<img src="x" onerror="alert(1)"><script>alert(2)</script>`.
  The round-7 measurement was of *one* config (`FORBID_TAGS: [], FORBID_ATTR: []`,
  which does leave `<script>` stripped) generalised to all of them. `ADD_TAGS` is
  not a weakening of our policy but an addition to DOMPurify's own allowlist, and
  it reaches script execution.
- *"nothing can reach the singleton today"* — false. R8/R9 own the **contiguous
  quoted literal** `'dompurify'`, so `import('dompur' + 'ify')` in any scanned
  non-sink component named nothing either rule could match. Verified end-to-end:
  all gates green, the capture verbatim in the shipped Rollup bundle, and
  `(await import('dompur'+'ify')).default === (await import('dompurify')).default`.

Those two sentences were the entire stated justification for deferring the fix,
so the deferral rested on nothing. The claimed cost — "moves a `window`
dependency to module-load time" — was already being paid: `import DOMPurify from
'dompurify'` binds `globalThis.window` at module evaluation, which is why
`markdown.test.ts` has constructed a JSDOM before importing since round 1.

A pattern-matching guard cannot own a global. Ownership can. **Bonus: the private
instance also closes V23** (the `addHook` capture), previously closed only by the
R8 name-guard.

**2. Nothing else.** `renderMarkdown`'s behaviour is otherwise unchanged.

## Guard changes

- **R6b promoted tree-wide.** Per EM ruling, the per-file-only scope was an
  oversight, not a deliberate choice. Both scopes share one predicate
  (`dynamicImportSpecifierOffenders`) so they cannot drift; the per-file half is
  kept because `SINK_EVASIONS` V9b exercises it (R3 precedent).
- **`stripImportStatements`: `(?!\s*\.)` → `(?!\s*[.(])`.** The round-7 claim
  that the docblock "names all three" productions named **two**. This was the
  fourth instance of that same defect, and the comment now says so, with a
  warning not to restate "all three are handled" without checking.
- **`fixtureTableViolation` has a positive control** — it was the one guard with
  none. Neutered, it was green at 77/122; neutered *and* with `ARITY_EVASIONS`
  emptied, still green at 77/122.
- **`splitTopLevelDefault` → `hasTopLevelDefault`**, and `=>` is no longer read as
  a default.

## What the non-blocking list was hiding: C7-l

The brief listed the `ARITY_LEGITIMATE` fixture as a cheap tidy-up. Taking it
surfaced a **live bypass of the load-bearing half of the arity pin**.

`renderMarkdownArityViolation` captured its parameter list with `[^)]*`, which
stops at the first `)` — **and a parameter type may contain one**:

```ts
export function renderMarkdown(
  md: string | ((x: string) => string),
  opts: { inline?: boolean } = {},
): string
```

captured as `md: string | ((x: string` → one parameter, no default, no rest →
`null`. **Green at 78 checks / 122 assertions with `tsc --noEmit` clean**, against
an implementation taking a real, usable second parameter — the configuration
channel into the sanitizer that the pin exists to deny. `Function.length` was
blind too (the second parameter is defaulted), so **both halves missed the same
declaration**.

Third instance in this one pin of the defect its own docblock names: *a check
that stops at the first thing it finds cannot see the second.* Fixed with
`balancedDeclarationParameterLists`; pinned as C7-l and C7-m.

**How it stayed hidden for three rounds:** the arrow-type false positive was
*unreachable* through the truncating regex, so the two bugs masked each other.
Adding the fixture with only the rename applied left the suite green — the
control **failed to go red**, and that is what exposed the truncation. A green
control is a finding, not a pass.

## Two false rationales corrected

- **B4.** The provenance line read `Moved 69 -> 73` while annotating a constant of
  74 and naming four checks. Both endpoints were wrong: round-6 head `86f30bc`
  measures **68**, round-7 head `7b4f6dd` measures **74**, and **six** checks
  landed — the two `dependencyPolicy()` checks were omitted entirely, which is how
  a line annotating 74 came to read "-> 73".
- **B5b.** `EXPECTED_ASSERTIONS` justified EXACT over a floor by saying a floor
  "is satisfied by adding two assertions somewhere new and deleting two somewhere
  load-bearing". An exact count is satisfied by precisely that, since
  `122 - 2 + 2 = 122`. Measured: revert `slot` from `FORBID_ATTR`, hollow the
  check that pins it, pad another — green at 78/122 with the slot attribute
  round-tripping live. **EXACT is kept; only the reason changed.** What it
  actually buys is that a floor's slack grows monotonically while an exact count
  is re-baselined every commit, so the window for silent shrinkage is one commit
  wide and the number appears in a diff a reviewer reads. A review property, not
  a detection property — and the docblock now says compensated shrinkage is *not*
  closed by any total.

## Known, unreconciled, deliberately left

The round-6 provenance line reads `Moved 61 -> 69`. Round-6 head `86f30bc`
measures **68**, so one of those endpoints is wrong. It is **out of this round's
delta and was left as written**, with a parenthetical above it recording that it
is unverified so the next reader does not take it on trust. No figure was
changed. Whoever picks this up should re-measure both ends rather than assume the
head is the wrong one.

## Still open, unchanged by this round

- **F-4** — build config is unscanned; `vite.config.ts` can inject a script into
  `dist/index.html`, and adding it to `EXTRA_SCANNED_FILES` would **not** catch
  it. Do not "fix" it that way.
- **F-7** — `marked` has no dependency floor.
- **#204** (the typescript-eslint AST rule) and the allow-list inversion.
- CSP / Trusted Types, and CI.
- No component-rendering test; sink binding is still a static scan.
- The check total is still blind to a `REQUIRED_SINKS` shrink by construction —
  `EXPECTED_REQUIRED_SINKS` is the pin for that.

## Method note

Every negative claim in this round has a positive control; every mutation was
content-addressed with a uniqueness assertion that aborts rather than guesses
(several fired, including two on my own newly-written prose); every count was
predicted from a static read before being measured (all exact); exit codes were
read from the child process, never through a pipe. Two predictions were wrong —
mutations #6 and #9 — and both were the ones that found the bypass.

Full report, including the mutation table with predicted-vs-actual, which
`[MEASURED-BY-…]` claims were re-verified versus taken on trust, and void runs:
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-r8.md`.

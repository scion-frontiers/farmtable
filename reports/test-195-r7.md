# test-195-r7 — independent test review of #195 round 7

**Tree:** `/workspace` (detached `7b4f6dd`). The brief's path
`/workspace/farmtable-195-r7-test` is a host path and does not exist in this
container; the EM confirmed mid-run. `git worktree list` shows exactly one
worktree, `/workspace 7b4f6dd (detached HEAD)`. I did not create the missing
directory.

**Range:** `86f30bc..7b4f6dd`. `git merge-base --is-ancestor 86f30bc 7b4f6dd`
exits 0; `git merge-base --is-ancestor 89306d0 7b4f6dd` exits 1. The brief is
right about the base. Range is `+1379/-69` across three files
(`markdown.test.ts` +1060, `markdown.ts` +94, the r7 log +294).

**Method:** I did not review the tests by reading them. I ran **105 scored
mutations** against production code, the scanned source tree, `package.json`,
`index.html` and the test file's own rule implementations, and recorded which
tests noticed. Reading was used only to *attribute* a result to a named
assertion, never to reach a verdict.

**Baseline before and after:** `npm test` exit **0**, `75 checks passed (122
assertions)`. `git status --porcelain` empty at the end. Every mutation reverted;
`runfiles.mjs` re-ran `git status --porcelain` after each file-level mutation and
would have hard-aborted the batch on a dirty tree. It never did.

---

## 1. VERDICT

**REQUEST CHANGES** — narrowly, and against a body of work that measured far
stronger than the brief's prior suggested.

103 of 105 mutations landed as predicted. Every behavioural pin, every
sink-binding rule, every banned-sink pattern, both count pins, the scope pin, the
dependency floor and the sunset clause fire, and I could name the assertion that
fired in each case. The three r7 claims the brief asked me to verify are
**confirmed by measurement**, and the historically-green `C2-e` bypass is now
red. This is not 1060 lines of tests that cannot fail.

Three things block, and all three are small:

| # | Finding | Class | Fix size |
|---|---------|-------|----------|
| **F-1** | `fixtureTableViolation` — the single function guarding all 11 fixture tables against silent shrinkage — has **no positive control of its own**. Neutering it is GREEN, and it re-opens every table to emptying. Demonstrated end-to-end three times. | Sub-form 1 (a check that cannot falsify what it checks), one level out | ~1 fixture check |
| **F-2** | The r7 log's **correction 1** states "There is no measured arity SPELLING for which [`renderMarkdown.length === 1`] is the falsifier … every form that survives `tsc` leaves `.length` at 1 by definition." **Measurably false.** `opts?: T` survives `tsc` and leaves `.length` at **2**. Same wording is in `markdown.ts`, and the failure message it drives is misleading. | Sub-form 3 (a correct check answering a question nobody meant to ask) — inverted: the check is *stronger* than claimed | 2 comment edits + 1 message edit |
| **F-3** | The `EXPECTED_ASSERTIONS` docblock argues EXACT-over-floor because "a floor is satisfied by adding two assertions somewhere new and deleting two somewhere load-bearing." Measured: **the exact count is satisfied by exactly that too** (T2, GREEN). The reasoning given for the choice does not distinguish the two options. | Stated rationale refuted by measurement | 1 comment edit |

F-1 is the only one that changes what the suite can catch. F-2 and F-3 are
documentation, and on this workstream an inaccurate disclosure has been the seed
of the next round's defect nine times — which is the whole reason they block
rather than being filed as nits.

---

## 2. MUTATION TABLE

Anchors are content-addressed. The harness (`/tmp/mut/mutate.mjs`,
`run2.mjs`, `runfiles.mjs`) **ABORTS (exit 3) and writes nothing** if an anchor
is absent, non-unique, or byte-identical to its replacement; ABORT is scored in
its own column and is never PASS or FAIL. Suite verdicts come from
`spawnSync().status` of the `npm` child. No verdict anywhere in this report came
through a pipe.

### 2.0 Controls (run first)

| ID | Mutation | Predicted | Actual |
|---|---|---|---|
| PC1 | drop `'form'` from `FORBID_TAGS` | RED | **RED** — `form tag stripped: credential-phishing form survived` |
| PC0 | null mutation: reword one comment line, nothing else | GREEN | **GREEN** 75/122 |
| PC-A1 | replacement byte-identical to anchor | ABORT | **ABORT** "no-op mutation" |
| PC-A2 | anchor absent | ABORT | **ABORT** "anchor not found" |
| PC-A3 | anchor `const ` (occurs many times) | ABORT | **ABORT** "anchor is NOT unique" |

The harness reported RED before it was trusted for any GREEN, and it refuses
three distinct classes of bad prerequisite.

### 2.1 `FORBID_TAGS` / `FORBID_ATTR`, one entry at a time (13)

| ID | Anchor content | Weakened | Pred. | Actual | Caught by |
|---|---|---|---|---|---|
| A-input | `FORBID_TAGS` line, `'input'` removed | password field | RED | RED | `password input stripped` |
| A-button | ditto `'button'` | submit control | RED | RED | `submit button stripped` |
| A-select | ditto `'select'` | select control | RED | RED | `select and option stripped` |
| A-textarea | ditto `'textarea'` | textarea | RED | RED | `textarea stripped` |
| A-option | ditto `'option'` | option | RED | RED | `select and option stripped` |
| A-dialog | ditto `'dialog'` | fake modal overlay | RED | RED | `dialog stripped (no fake modal)` |
| A-style | ditto `'style'` | `<svg><style>` CSS injection | RED | RED | 5 checks, incl. all three container cases (list/blockquote/table) |
| A-form | ditto `'form'` | phishing form | RED | RED | `form tag stripped` (= PC1) |
| B-style | `FORBID_ATTR`, `'style'` removed | inline overlay | RED | RED | `style attribute stripped` |
| B-class | ditto `'class'` | CSS-reuse comment forgery | RED | RED | `class attribute stripped` **and** `code blocks render` (`language-js` returns) |
| B-action | ditto `'action'` | attacker origin on a permitted tag | RED | RED | `action attribute stripped from a tag that survives` |
| B-download | ditto `'download'` | filename spoof | RED | RED | `download attribute stripped` |
| B-slot | ditto `'slot'` | slot projection | RED | RED | `slot attribute stripped` |
| **B-formaction** | ditto `'formaction'` | — | RED | **GREEN** | **nothing** — see below |

**B-formaction — NOT a coverage hole. Equivalent mutant.** Verified two
independent ways rather than asserted:

1. `probediff.mjs` re-rendered a 24-payload corpus with and without the entry
   (including `<div formaction=…>`, `<a … formaction=…>`, `<button formaction=…>`,
   `<input type=image formaction=…>`) and reported **BEHAVIOUR UNCHANGED**. The
   same harness on the very next run reported **BEHAVIOUR CHANGED** for `'slot'`
   (`<div>x</div>` → `<div slot="footer">x</div>`), so it is not a probe that
   always says "unchanged".
2. `formaction` does not appear **anywhere** in `node_modules/dompurify/dist/purify.cjs.js`
   — it is not in the default `ALLOWED_ATTR`, so it is dropped with or without
   our rule.

The test at `markdown.test.ts:160`, `formaction cannot survive because its host
tag is stripped`, **names this in its own title** and the comment above it
(lines 151-159) states the asymmetry correctly and says it "remains a tag-rule
assertion only". This is a disclosed residue that measurement confirms, not a
finding. The entry stays in `FORBID_ATTR` as defence against a future DOMPurify
default change — which nothing can test today, and the file says so.

### 2.2 Checkbox renderer and the private `Marked` instance (6)

| ID | Weakened | Pred. | Actual | Caught by |
|---|---|---|---|---|
| C1 | swap checked/unchecked glyph outputs | RED | RED | `nested task lists keep their state` (`☑︎</span> outer` missing) + the singleton pin |
| C2 | drop `aria-label` from both glyphs | RED | RED | `task list state is exposed to assistive technology` |
| C3 | drop the `︎` escape | RED | RED | 4 checks, incl. the exact-pairing assertion |
| C4 | `role="img"` → `role="presentation"` | RED | RED | `task list state is exposed to assistive technology` |
| C5 | emit a bare glyph — no span, role or aria | RED | RED | 4 checks |
| **D1** | `new Marked({…})` → `marked.use({…})` on the shared singleton (2 edits: import + construction) | RED | **RED** | `renderMarkdown does not use the shared marked singleton`: *"a renderer installed on the shared marked singleton reached renderMarkdown: found `<img`"* |

**Brief item 3, first half — CONFIRMED by making it fire.** r7 claims the swap
"was green at 69 checks before this pin existed; it is now red, and red only
there." I performed the swap. It is red, and the only check that fires is that
one. The inline positive control inside that check (poisoning the singleton and
asserting the poisoning took) is real: it is an `assertContains(poisoned,
'onerror', …)` and it runs before the negative assertions.

### 2.3 Input contract: arity and input domain (5)

| ID | Weakened | Pred. | Actual | Caught by |
|---|---|---|---|---|
| E1 | delete `if (typeof md !== 'string') return '';` | RED | RED | `renderMarkdown does not throw on non-string input` — *"threw on undefined input (marked(): input parameter is undefined or null)"* |
| F1 | `(md, opts: {…} = {})` | RED | RED | `renderMarkdown accepts exactly one parameter` — *"declares 2 parameters"* |
| F2 | `(md, ...rest: unknown[])` | RED | RED | same |
| F3 | `(md, { inline = false }: {…} = {})` | RED | RED | same |
| F4 | comment above quoting the old 1-arg signature + real `(md, opts?: {…})` | RED | RED | same |

F4 is the round-6 bypass (a *comment* satisfying the declaration scan). It is
closed: the scan reads a comment-and-string-blanked view and requires exactly one
match. **Brief item — the two r6 bypasses are dead.**

### 2.4 The `DOMPurify.sanitize` call and its config axes (13)

| ID | Weakened | Pred. | Actual | Caught by |
|---|---|---|---|---|
| G1 | drop `FORBID_ATTR` from the config | RED | RED | 6 checks |
| G2 | drop the whole config object | RED | RED | 18 checks |
| G3 | bypass `sanitize` entirely, return raw `marked` output | RED | RED | 39 checks |
| W1 | `parser.parse` → `parser.parseInline` | RED | RED | 8 checks |
| W2 | swap the `FORBID_TAGS`/`FORBID_ATTR` bindings | RED | RED | 12 checks |
| Y1 | add `ALLOW_UNKNOWN_PROTOCOLS: true` | RED | RED | `unknown URL schemes are dropped` — the message even asks *"has ALLOW_UNKNOWN_PROTOCOLS been enabled?"* |
| **Y2** | add `SANITIZE_DOM: false` | RED | **RED** | `DOM-clobbering id/name attributes stripped` |
| Y3 | add `ADD_ATTR: ['target']` | RED | RED | `target attribute stripped (no tabnabbing)` |
| Y4 | add `ADD_TAGS: ['script']` | RED | RED | `script tag stripped` |
| Y5 | widen `ALLOWED_URI_REGEXP` to `/.*/` | RED | RED | 5 URI checks incl. both SVG ones |
| Y6 | add `WHOLE_DOCUMENT: true` | RED | RED | 5 positive-rendering checks |
| Y7 | add `KEEP_CONTENT: false` | RED | RED | `dialog stripped (no fake modal)` — the *content-preserved* half |
| Y9 | add `ALLOW_ARIA_ATTR: false` | RED | RED | `task list state is exposed to assistive technology` |
| Y8 | add `SANITIZE_NAMED_PROPS: true` | GREEN (mine) | **RED** | **my prediction was wrong, not the suite's.** `true` makes DOMPurify *rename* rather than drop `id`/`name`, so `name=` survives; `DOM-clobbering id/name attributes stripped` caught it. |
| **Y10** | add `ADD_URI_SAFE_ATTR: ['formaction']` | RED | **GREEN** | **equivalent mutant**, verified: `probediff` → BEHAVIOUR UNCHANGED. `ADD_URI_SAFE_ATTR` exempts an attribute from *URI* checking; it does not add it to `ALLOWED_ATTR`, and `FORBID_ATTR` still strips it. Not a coverage hole. |

**Brief item 3, second half — CONFIRMED.** `SANITIZE_DOM` (r7's "last
unsignalled config axis") has a red-on-revert. I additionally found no config
axis I could weaken that the suite does not notice.

### 2.5 The scanned tree — sink binding R1–R9 (12)

All against the **real** production components, not fixtures.

| ID | Mutation to the tree | Pred. | Actual | Rule that fired |
|---|---|---|---|---|
| H1 | comments sink: `unsafeHTML(c.body)` | RED | RED | sink-binding + `every unsafeHTML call site passes nothing but renderMarkdown output` |
| H2 | desc sink: `unsafeHTML(this.description)` | RED | RED | same |
| H3 | `const rawHtml = unsafeHTML;` + `rawHtml(…)` | RED | RED | sink-binding (R3/R4) + call-site count + indirection tripwire |
| H4 | `const rawHtml = unsafeHTML;` + `rawHtml(…)` | RED | RED | sink-binding + call-site count + **escape tripwire (R7)** |
| H5 | `unsafeHTML(renderMarkdown(x) + '<br>')` | RED | RED | R5 via `sinkArgumentIsSanitized` |
| H6 | `unsafeHTML(wrap(renderMarkdown(x)))` | RED | RED | R5 |
| H7 | desc file imports `DOMPurify` and calls `sanitize` itself | RED | RED | R8/R9 `the sanitizer exclusively owns its own dependencies` |
| H8 | desc file merely imports `marked` | RED | RED | R8/R9 |
| H9 | `el.innerHTML = s` in the desc file | RED | RED | banned-sink tripwire |
| H10 | `document.write(s)` in the desc file | RED | RED | banned-sink tripwire |
| **H11** | shrink `REQUIRED_SINKS` by one | RED | **RED** | `sink scan actually reads the source tree` → **`requiredSinkScopeViolation`**. Note the check total moved 75 → 74 and the check-total pin stayed silent, exactly as documented — the scope pin is what fires. |
| **H12** | **C2-e replay**: shrink `REQUIRED_SINKS` + `\u`-escape alias + render raw | RED | **RED** | scope pin **and** the tree-wide escape tripwire |

**H12 is the headline confirmation.** This exact three-part mutation was GREEN at
68 checks before this round. It is now red from two independent directions
(`EXPECTED_REQUIRED_SINKS`, and R7 promoted tree-wide). Both halves of r7's fix
are load-bearing, and I confirmed R7's promotion is not redundant by neutering it
separately (I9, below).

### 2.6 Brief item 4 — is every banned sink actually exercised? (10)

Each of the 8 `BANNED_SINKS` patterns, injected into a **real scanned file**:

| ID | Form | Actual | Pattern named in the failure |
|---|---|---|---|
| K1 | `el.outerHTML = s` | RED | innerHTML/outerHTML assignment |
| K2 | `el['innerHTML'] = s` | RED | innerHTML/outerHTML **indexed** assignment |
| K3 | `el.innerHTML \|\|= s` | RED | innerHTML/outerHTML assignment (the `\|\|=` operator class works) |
| K4 | `el.insertAdjacentHTML(…)` | RED | insertAdjacentHTML |
| K5 | `el.setHTMLUnsafe(s)` | RED | setHTMLUnsafe |
| K6 | `range.createContextualFragment(s)` | RED | createContextualFragment |
| K7 | `unsafeSVG(s)` | RED | lit unsafeSVG directive |
| K8 | `unsafeStatic(s)` | RED | lit unsafeStatic directive |
| K9 | `document.body.innerHTML = location.hash` inside `web/index.html`'s inline `<script>` | RED | innerHTML/outerHTML assignment **in `index.html`** |
| K10 | `document.write(location.hash)` in the same block | RED | document.write **in `index.html`** |

**All 8 patterns exercised against the real tree; none is dead regex.** Audit
LOW-2 is real: `index.html` is genuinely in the scanned set, and I confirmed it
by putting a sink in it rather than by reading `EXTRA_SCANNED_FILES`.

### 2.7 Brief item 1 — can the fixture tables express a failing input? (20)

I fed each rule and each table a failing input.

| ID | Mutation to the test file's own rules | Pred. | Actual | Caught by |
|---|---|---|---|---|
| I1 | neuter the `document.write` regex (`wrIIte`) | RED | RED | `fixture: every banned raw-HTML sink form is actually detected` — **both** quantifier directions fired |
| I2 | delete the `setHTMLUnsafe` entry from `BANNED_SINKS` | RED | RED | table-size pin, 7 ≠ 8 |
| I3 | delete one `BANNED_SINK_POSITIVES` entry | RED | RED | table-size pin, 14 ≠ 15 |
| I5 | `renderMarkdownArityViolation` → always `null` | RED | RED | arity fixture: `SURVIVED: C7-a … C7-b … C7-c …` |
| I6 | `sourceFileCountViolation` → always `null` | RED | RED | `fixture: the tree-wide count pins fire on a changed count` — *"silent at 50 … silent at 52"* |
| I7 | `requiredSinkScopeViolation` → always `null` | RED | RED | same fixture, scope arm |
| I8 | `sinkCountViolation` → always `null` | RED | RED | same fixture, sink-count arm |
| I9 | `escapeInCodeOffenders` → `[]` (the promoted R7) | RED | RED | `fixture: every known indirection form is caught` — 4 escape fixtures |
| I12 | `sinkArgumentIsSanitized` → always accept (shim) | RED | RED | `fixture: every known sink-binding evasion is caught` — V6, V6b, V11 |
| I13 | `directiveIndirectionOffenders` → `[]` (shim) | RED | RED | indirection fixture, 16 forms |
| I14 | `sanitizerOwnershipViolations` → `[]` (shim) | RED | RED | ownership fixture, 10 routes to the singleton |
| I15 | empty `ARITY_EVASIONS` | RED | RED | table-size pin, 0 ≠ 11 |
| I16 | empty `OWNERSHIP_EVASIONS` | RED | RED | table-size pin, 0 ≠ 10 |
| I17 | empty `SINK_EVASIONS` | RED | RED | table-size pin, 0 ≠ 24 |
| **I11** | **neuter `fixtureTableViolation` → always `null`** | RED | **GREEN 75/122** | **nothing** |
| **I18** | I11 **+** empty `ARITY_EVASIONS` | RED | **GREEN 75/122** | **nothing** |
| **I19** | I11 **+** empty `OWNERSHIP_EVASIONS` | RED | **GREEN 75/122** | **nothing** |
| **I20** | I11 **+** empty `SINK_EVASIONS` | RED | **GREEN 75/122** | **nothing** |

**F-1, stated precisely.** Every one of the 11 fixture tables is protected from
silent shrinkage by exactly one function, `fixtureTableViolation`
(`markdown.test.ts:2305`), and that function is the only rule in this file with
**no positive control**. Every other predicate — `sinkArgumentIsSanitized`,
`renderMarkdownArityViolation`, `directiveIndirectionOffenders`,
`sanitizerOwnershipViolations`, `escapeInCodeOffenders`, and all three count
pins — reddens when neutered, because something asserts the predicate directly at
a wrong input. `fixtureTableViolation` is never called with a wrong input.

This is **a coverage hole, not a mis-attributed assertion**: the table-size pins
themselves are correctly attributed and correctly worded, and they *do* fire
(I2, I3, I15, I16, I17). What is missing is the one-level-out control that the
docblock above `fixtureTableViolation` — the one that opens "EVERY FIXTURE TABLE
IN THIS FILE IS EMPTYABLE, AND THAT IS THE SAME DEFECT THE TABLES WERE ADDED TO
FIX" — argues for. The fix it introduced now has the shape it was written to
diagnose, one level further out again.

**Suggested fix (developer's call, not mine):** one check asserting
`fixtureTableViolation('X', [1,2], 2) === null` and
`fixtureTableViolation('X', [1], 2) !== null` and
`fixtureTableViolation('X', [1,2,3], 2) !== null` — the same treatment the count
pins got in `fixture: the tree-wide count pins fire on a changed count`. That
costs one `check()` call site and lands under the existing check-total pin.

**Exploitability, stated honestly:** two deliberate edits to the test file are
required. This is not reachable from a component file, and it is not a live
vulnerability. It is a guard-integrity defect of exactly the class this
workstream tracks.

### 2.8 Count pins and evisceration (7)

| ID | Mutation | Pred. | Actual | Caught by |
|---|---|---|---|---|
| Z1 | delete an entire `check()` call site (`base tag stripped`) | RED | RED | `check total pinned: expected 75 … 74 did` |
| T3 | hollow the `slot` check body to `return;` (production untouched) | RED | RED | `assertion total pinned: expected 122 assertions to run, 120 did` |
| **T1** | **the T-4 mutation**: hollow the `slot` check **and** revert `slot` from `FORBID_ATTR` | RED | **RED** | assertion total, 120 ≠ 122 |
| N1 | add `src/legacy-widget.ts` with `el.innerHTML = s` | RED | RED | source-file count (52 ≠ 51) **and** the sink tripwire |
| N2 | N1 with `EXPECTED_SOURCE_FILES` bumped to 52 (isolates the tripwire) | RED | RED | sink tripwire alone |
| N4 | add `src/legacy-widget.html` with an inline `innerHTML` sink | RED | RED | count **and** tripwire — `.html` is genuinely off `INERT_EXTENSIONS` |
| N5 | delete a scanned source file (`src/capabilities.ts`) | RED | RED | count (50 ≠ 51) + 3 downstream |
| N6 | **R6**: park `export { unsafeHTML as rawHtml }` in a `*.test.ts` (excluded from the scan) and import it at the sink | RED | RED | sink-binding + ownership + call-site count |
| **T2** | **compensated evisceration**: hollow the `slot` check, revert `slot` from `FORBID_ATTR`, **and add two assertions to `headings render`** | RED | **GREEN 75/122** | **nothing** |

**T1 confirms r7's fix works.** The historically-green T-4 mutation is now red.

**F-3: T2 refutes the stated rationale for the fix, not the fix.** The docblock at
`EXPECTED_ASSERTIONS` (`markdown.test.ts:3239-3245`) chooses EXACT over a floor
on this ground: *"a floor is satisfied by adding two assertions somewhere new and
deleting two somewhere load-bearing, and 'silent shrinkage masked by unrelated
growth' is exactly the failure … this was changed from a floor to an exact count
to catch."* Measured: **the exact count is satisfied by precisely that
manoeuvre.** A global exact total catches *net* change; it does not catch
*compensated* change, and neither does a floor. Exact is still strictly stronger
than a floor (it also catches unmasked growth), so **keep the choice** — but the
sentence justifying it describes a property the count does not have. On this
workstream, that is the sentence the next round builds on.

**Suggested fix:** replace that paragraph with the measured statement — "an exact
total catches net assertion change; a body hollowed out and compensated by
assertions added elsewhere is invisible to it, and there is no per-check total
here that would see it."

### 2.9 Brief item 2 — the sunset clause and the dependency floor (8)

| ID | Mutation to `web/package.json` | Pred. | Actual | Caught by |
|---|---|---|---|---|
| J1 | `dompurify: ^3.4.12` → `^3.0.0` | RED | RED | `dompurify declares a floor at or above the advisory line` |
| J2 | → `*` | RED | RED | same |
| J3 | → `^3.5.0` (**raising** the floor) | RED | RED | same — the predicate is string equality, and the message says so ("Raising the floor is fine — update this string in the same commit") |
| J4 | declare `eslint` | RED | RED | `sunset clause: #204 tooling absent…` — *"THIS IS NOT A DEFECT — it is the clause firing as designed"* |
| J5 | declare `@typescript-eslint/parser` | RED | RED | same |
| J6 | declare `typescript-eslint` | RED | RED | same |
| J7 | **negative control**: declare `prettier` | GREEN | **GREEN** | — |
| J8 | **near-miss control**: declare `@typescript-eslint` (no slash) | GREEN | **GREEN** | — |

**Both fire, and neither over-fires.** J1/J2 are the security direction and both
redden. On J3: the check is *equality*, not a semver comparison, so it is
strictly stronger than its title in the safe direction — there is **no string
below the advisory line that passes**. The title (`at or above`) is looser than
the code (`exactly ^3.4.12`); the error message reconciles them. Worth one word
in the title; not a defect.

J8 is a near-miss control rather than a gap: `@typescript-eslint` is not a
published package, only `@typescript-eslint/*` is.

### 2.10 Brief item 5 — the two corrections to round 6 (3 + a documentary check)

**Correction 2 — VERIFIED ACCURATE.** r7 claims the round-6 "URI policy pinned"
item was **test-only** and gives line numbers. Measured:

```
git show 86f30bc:web/src/util/markdown.test.ts | grep -n ALLOW_UNKNOWN_PROTOCOLS
  246, 253, 257                        <- r7 says "246-257". Correct.
grep -n ALLOW_UNKNOWN_PROTOCOLS web/src/util/markdown.test.ts  (at 7b4f6dd)
  298, 305, 309                        <- r7 says "298-309". Correct.
git show 86f30bc:web/src/util/markdown.ts | grep -c ALLOW_UNKNOWN_PROTOCOLS
  0                                    <- test-only. Correct.
```

**Correction 1 — MEASURABLY FALSE (F-2).** It says:

> There is no measured arity *spelling* for which [`renderMarkdown.length === 1`]
> is the falsifier, because a required second parameter is rejected by `tsc`
> before the suite runs and every form that survives `tsc` leaves `.length` at 1
> by definition.

`Function.length` stops counting at the first **defaulted or rest** parameter —
not at the first *optional* one. TypeScript erases `?`, so `(md, opts?: T)`
compiles to a plain two-parameter function.

Direct measurement (`probe.mjs`, printing `renderMarkdown.length` after
recompiling each mutant):

```
F1  (md, opts: {…} = {})                        length = 1
F2  (md, ...rest: unknown[])                    length = 1
F3  (md, { inline = false }: {…} = {})          length = 1
F4  (md, opts?: { inline?: boolean })           length = 2      <-- tsc clean
```

Isolated with a control triple. I blinded the declaration scan
(`renderMarkdownArityViolation` shimmed to `null`, both arity tables emptied,
`fixtureTableViolation` neutered so the tables' own pins stay quiet) so that
`renderMarkdown.length === 1` was the *only* remaining arity assertion:

| ID | Arity spelling under the blinded scan | Pred. | Actual |
|---|---|---|---|
| X3 | **unchanged** (control) | GREEN | **GREEN** — the blinding itself is silent, so X2 is not an artefact of the blinding |
| X1 | F1 `opts: T = {}` | GREEN | **GREEN** — `.length` is genuinely not the falsifier here |
| **X2** | F4 `opts?: T` | RED | **RED** — `renderMarkdown accepts exactly one parameter` |

So `.length === 1` **is** the sole falsifier for one natural spelling. The error
is **conservative** — the pin is stronger than advertised, not weaker — and in
the shipped configuration F4 is caught twice (declaration scan *and* `.length`).
What makes it worth fixing is the **diagnostic**: the message that fires says

> the artifact this suite imported has diverged from the source the scan above
> read (stale build, bundler transform, or a re-export from a different module)

which, on the `opts?: T` spelling, sends the reader hunting a stale build for a
second parameter that is sitting in the declaration. The same false claim is in
`markdown.ts:140-144` and in the r7 log at lines 41-47.

**Suggested fix:** change "no measured spelling" to "no *defaulted or rest*
spelling — an **optional** parameter (`opts?: T`) does leave `.length` at 2 and is
caught here", and add that spelling to the failure message's list of causes.

### 2.11 Latent, bounded — reported for completeness (2)

| ID | Mutation | Actual | Assessment |
|---|---|---|---|
| W3 | add a second **unsanitized** exported renderer to `markdown.ts` (`renderMarkdownInline`, returns raw `marked` output), **unused** | **GREEN** | Not a defect. Dead code; nothing renders it. |
| W4 | W3 **and** the desc sink calls it | **RED** | R2/R4/R5 fire: `unsanitized unsafeHTML sink(s): … unsafeHTML(renderMarkdownInline(this.description))`. |

The docblock in `markdown.ts` tells a future author to "export a second named
function that also ends in a `DOMPurify.sanitize` call **and add it to the
guard**". W3/W4 measure the consequence of ignoring the first half: the export
is invisible while unused and caught the instant it reaches a sink. That is the
right boundary; I record it only so nobody reads W3's GREEN as a hole.

### 2.12 Are the pinned totals PREDICTIONS or POST-HOC TALLIES?

The brief flags sub-form 5 as especially likely. **It is not present.** All four
totals are hard literals in source, and I reproduced each from a **static read of
the source, never from the runner's output**:

| Pinned constant | Value | Independent static derivation | Match |
|---|---|---|---|
| `EXPECTED_CHECK_CALL_SITES` | 74 | `grep -cE '^\s+check\(' markdown.test.ts` → **74** | ✔ |
| `EXPECTED_CHECKS` | 75 | `74 + (REQUIRED_SINKS.length − 1)` = 74 + 1 | ✔ (runtime prints 75) |
| `EXPECTED_ASSERTIONS` | 122 | 120 textual `assert*` occurrences − 6 definitions = **114** call sites; **−2** for the two inside the local helper `assertSvgStyleStripped`, **+6** because three checks call it; **+4** because `for (const bad of [undefined, null, 42, {}, []])` runs its single `assertEqual` five times. 114 − 2 + 6 + 4 = **122** | ✔ |
| `EXPECTED_SOURCE_FILES` | 51 | `find src -type f \| grep -v <INERT_EXTENSIONS> \| grep -v '\.test\.'` → **50**, plus `index.html` from `EXTRA_SCANNED_FILES` = **51** | ✔ |
| `EXPECTED_REQUIRED_SINKS` | 2 | literal array length, and independent of the derived total | ✔ |

Each is a prediction that can be reproduced without running the suite, and each
was shown to fire when contradicted (Z1, T3, N1/N5, H11). The r7 claim that it
"pinned the assertion total, not just the check total" is **substantiated**.

---

## 3. C-A — WHAT I COULD NOT VERIFY

1. **The installed DOMPurify, as opposed to the declared range.** There was no
   `node_modules` in this container; I ran `npm install` (not `npm ci`) against
   `web/package.json`, so my runs used whatever the caret ranges resolved to
   *today*, and `web/package-lock.json` is not in this tree. The
   `dompurify declares a floor…` check reads `package.json` only — the check's own
   message says this — so **neither it nor I verified the artifact**. A lockfile
   or a patched `node_modules` below the floor passes everything in this report.
   The r7 log claims a lockfile refresh in round 6; I could not confirm it here.
2. **Whether the behavioural pins hold on other DOMPurify versions.** All results
   are for the version my install resolved. A DOMPurify release that adds
   `formaction` to its default `ALLOWED_ATTR` would turn my B-formaction
   "equivalent mutant" into a real coverage hole overnight, and nothing in the
   suite would report the transition.
3. **`unsafeHTML` semantics at runtime.** I never rendered a Lit component. Every
   sink result is a *source-level* property of the guard. The claim "attacker
   markdown reaches the DOM" in any mutation description is the guard's model,
   not something I observed in a browser.
4. **`npm run build`, `go build ./...`, `go test ./...`.** The r7 log claims exit
   0 for all four gates. I ran only `npm test` and `tsc -p tsconfig.test.json`
   (both exit 0, repeatedly). I did not re-verify the Go or Vite gates.
5. **The remaining ~55 mutation vectors implied by the file's own V1–V25 / C-series
   vocabulary.** I ran 105 mutations chosen for coverage of the enumerated rule
   set; I did not run every historical vector by its original ID, so I cannot say
   "all previously-recorded bypasses are closed" — only that the ones the brief
   named, plus C2-e and T-4, are.
6. **Multi-file compensated evisceration beyond T2.** I demonstrated the
   compensation hole once. I did not search for the minimal or most natural
   version of it.

---

## 4. C-B — THE FINDING I AM LEAST SURE ABOUT

**F-3, the `EXPECTED_ASSERTIONS` rationale.**

Not the measurement — T2 is GREEN and reproducible. What I am unsure about is
whether it deserves to block.

The argument against my calling it: exact **is** strictly stronger than a floor,
so the *decision* is right, and one could read the disputed sentence as loose
prose about a real (if differently-shaped) advantage. Requiring a comment edit
for that is close to pedantry, and I am aware that a reviewer who has just run
105 mutations is motivated to find something.

The argument I went with: this file's whole method is that a comment stating a
property the code does not have is how the next defect gets built. The r7 log
opens by correcting exactly that failure in r6, and the docblock in question is
*itself* part of this round's new work. A round whose thesis is "measure your
disclosures" should not ship a disclosure that its own tooling refutes in one
mutation.

I would not object if the EM downgraded F-3 to a follow-up. **F-1 and F-2 I hold
to.** F-2 in particular is not a style point: the failure message actively
misdirects on the one spelling where that assertion is load-bearing.

Second-least sure: my classification of **B-formaction** as an equivalent mutant
rather than a coverage hole. I verified it two ways (corpus diff + absence from
the DOMPurify bundle) and the test's own title concedes it, but "no behaviour
change over *my* 24-payload corpus" is not "no behaviour change". A corpus is a
fixture, and a fixture that cannot express the failing input is sub-form 2 — I
may have committed the very defect I was hunting. I mitigated it with the
`purify.cjs.js` grep, which is corpus-independent, and that is what I actually
lean on.

---

## 5. VOID RUNS — experiments I discarded

Six. Disclosed in full, including the two that were my own harness's fault.

1. **`.mut/` inside the scanned tree (discarded before it ran).** I first wrote
   the harness to `/workspace/web/.mut/mutate.mjs`. `.mjs` is not in
   `INERT_EXTENSIONS`, so — had it been under `src/` — it would have moved
   `EXPECTED_SOURCE_FILES` and reddened the suite for a reason that had nothing
   to do with any mutation. I caught it before the first run and moved everything
   to `/tmp/mut/`. Every number in this report comes from a harness living
   entirely outside the repository. Had I not caught it, my first "positive
   control" would have gone red for the wrong reason and I would have trusted a
   harness that was measuring itself.

2. **C3 v1 — ABORT, escaping bug.** My first attempt to remove the `︎`
   escape used `"\\\\uFE0E"` in a shell-quoted `node -e`, which is *two*
   backslashes plus `uFE0E` and matches nothing. The harness aborted on "no-op
   edit". **This is the abort path doing its job**: without it the run would have
   written an unchanged file, gone GREEN, and I would have reported "the U+FE0E
   variation selector is unpinned" — a false negative finding. Re-run with the
   anchor extracted programmatically from the file: RED, four checks.

3. **T1/T2 v1 — ABORT, hand-typed anchor.** I hand-typed the `slot` check body
   into a shell heredoc and got the quoting wrong; anchor not found, twice.
   Re-run with both anchors sliced out of the file by `indexOf`/`indexOf("\n  });")`.
   After this I stopped hand-typing multi-line anchors entirely.

4. **I4 — `sinkArgumentIsSanitized` neutered by prefix-return: RED-TSC, VOID.**
   I inserted `return true;` at the top of the function. `tsc` then failed with
   `TS18047: 'head' is possibly 'null'` — the early return killed a control-flow
   narrowing further down. That is **`tsc` rejecting my edit, not a test catching
   the weakening**, so scoring it RED would have been a false positive in the
   suite's favour. Discarded and re-run as **I12** using a shadowing shim (stub
   defined above the real function, renamed `…Real`), which preserves the original
   body untouched. I12: RED, and it names V6/V6b/V11.

5. **I10 — `directiveIndirectionOffenders` neutered the same way: RED-TSC, VOID.**
   Same failure mode, five `TS18047`s. Re-run as **I13** with the shim: RED.

   Both of these matter because a lazy reading of the first batch would have
   scored 11/11 RED for group I. The honest count was 9 scored, 2 void — and the
   two voids are exactly the two rules an attacker would most want neutered.

6. **Y8 — my prediction was wrong, the suite was right.** I predicted
   `SANITIZE_NAMED_PROPS: true` would be a behaviour-neutral no-op probe and
   expected GREEN. It went RED. The flag makes DOMPurify *prefix* `id`/`name`
   rather than drop them, so `name=` survives the sanitizer, and the T-7
   DOM-clobbering check caught it. I am recording this as a void *prediction*
   rather than quietly relabelling it, because the whole value of a predicted
   column is that it is written before the run.

**Not void, but worth flagging as a limit of method:** `probediff.mjs` reported
BEHAVIOUR UNCHANGED for B-formaction and Y10, and I lean on those two results to
classify both as equivalent mutants rather than coverage holes. That probe ranges
over a 24-payload corpus I wrote. Its positive control (B-slot → CHANGED) proves
it can report a difference; it does not prove the corpus is complete. For
B-formaction I have the independent `purify.cjs.js` grep; **for Y10 I have only
the corpus and the DOMPurify semantics I read**, so Y10's classification is the
weaker of the two.

---

## 6. WHERE THIS BRIEF IS WRONG

Four things, one of them material.

1. **The tree path is wrong.** `/workspace/farmtable-195-r7-test` does not exist
   in this container; the working tree is `/workspace` itself. The EM sent a
   correction mid-run and I had already located the right tree. Noted only
   because the brief is the artifact of record. (`git worktree list` → a single
   entry, `/workspace 7b4f6dd (detached HEAD)`.)

2. **The brief's central risk hypothesis did not survive contact — and this is
   the material one.** It says "the danger is not missing coverage, it is 1060
   lines of tests that cannot fail." Measured, that is **not** where the risk was.
   103 of 105 mutations were caught, most of them by a *named, correctly-worded*
   assertion. The two genuine gaps are not in the 1060 new lines' ability to fail;
   they are (a) one 14-line helper that the new lines all depend on and nobody
   pointed a fixture at, and (b) a claim in the **project log**, which is not test
   code at all. A leg that had spent its budget looking for inert tests would have
   found F-1 and missed F-2 entirely. I flag this because the brief's framing was
   *almost* right — the defect class was correct, the location prediction was not
   — and the next brief will be more useful if it says "find the one guard nobody
   guards" rather than "assume the tests are inert."

3. **Sub-form 5 was predicted as "especially likely here." It is absent.** The
   brief asks me to determine whether the totals are read off the run or predicted
   from source. They are predicted: 74, 75, 122, 51 and 2 are all hard literals,
   and I reproduced every one of them by static analysis of the source
   (§2.12) — including the awkward 122, which requires knowing that
   `assertSvgStyleStripped` is a helper called three times and that one loop runs
   five iterations. This is the strongest single thing in the round and the brief
   guessed the opposite.

4. **"The sink guard is regex-based and there is untested surface in its
   banned-sink list historically" — historically true, currently false.** All
   eight patterns are exercised, both by the `BANNED_SINK_POSITIVES` fixture
   (which additionally asserts the *reverse* quantifier: every pattern must be hit
   by some positive) and, in my runs, against the real tree (K1–K10). Neutering
   any one pattern is red (I1). The correct current statement is that the list is
   a **closed enumeration that is fully fixtured** — its residue is the forms it
   does not name (`Object.assign(el, {innerHTML})`, computed keys), which the file
   already records as deliberate.

**Where the brief was right, for the record:** items 1, 2 and 3 all pointed at
real work that I confirmed by making it fire (H12, T1, D1, Y2, J1–J6). The
instruction to mutate rather than read is what produced F-1 — I had read
`fixtureTableViolation` earlier in the session and found nothing wrong with it.
And the standing bar "verify that a green mutation actually weakened the thing"
is what stopped B-formaction and Y10 from being written up as two coverage holes
that do not exist.

---

## 7. RECOMMENDATIONS (developer's call — I did not fix anything)

**Blocking**

1. **F-1** — add one `check()` giving `fixtureTableViolation` a positive control
   at a wrong table length in both directions, mirroring
   `fixture: the tree-wide count pins fire on a changed count`. Bump
   `EXPECTED_CHECK_CALL_SITES` 74 → 75 in the same commit.
2. **F-2** — correct the arity claim in three places (`markdown.ts:140-144`,
   `markdown.test.ts:616-627`, `markdown-sanitize-cleanup-r7.md:41-47`): an
   **optional** `opts?: T` survives `tsc` and leaves `.length` at 2, so
   `renderMarkdown.length === 1` *is* the falsifier for that spelling. Add it to
   the failure message's list of causes so the diagnostic stops pointing at stale
   builds.
3. **F-3** — restate the EXACT-over-floor rationale to match measurement:
   compensated shrinkage is invisible to both. Keep exact.

**Non-blocking**

4. Retitle `dompurify declares a floor at or above the advisory line` to say
   *equals*, matching the predicate. The current title is looser than the code in
   the safe direction, which is the confusing direction to be loose in.
5. Consider recording that `formaction` in `FORBID_ATTR` is **untestable by
   construction** against DOMPurify's current defaults — the comment at
   `markdown.test.ts:151-159` says this for the *check*; the entry in
   `markdown.ts:49` does not carry the same note.
6. The suite has no signal for "DOMPurify's default `ALLOWED_ATTR` changed under
   us", which is the event that would silently convert `formaction` from
   defence-in-depth into load-bearing. Out of scope for this round; worth an issue.

---

## Appendix — reproduction

```bash
cd /workspace/web && npm install --no-audit --no-fund   # no node_modules in-container
npm test                                                # exit 0, "75 checks passed (122 assertions)"

# harness (outside the repo, so it is never in the scanned set)
#   /tmp/mut/mutate.mjs    single content-addressed mutation, ABORTs on bad prerequisite
#   /tmp/mut/run2.mjs      multi-edit batches; verdict from spawnSync().status
#   /tmp/mut/runfiles.mjs  file create/delete; re-checks `git status --porcelain` after each
#   /tmp/mut/probediff.mjs behaviour-diff probe, to tell "no coverage" from "no behaviour change"
#   /tmp/mut/predict.mjs   static, source-only prediction of the pinned totals
node /tmp/mut/run2.mjs /tmp/mut/specI2.json     # F-1: I18/I19/I20 GREEN
node /tmp/mut/run2.mjs /tmp/mut/specX.json      # F-2: X3 GREEN, X1 GREEN, X2 RED
node /tmp/mut/run2.mjs /tmp/mut/specT.json      # F-3: T1 RED, T2 GREEN
node /tmp/mut/predict.mjs                       # 74 check sites, 114 assert sites -> 122
```

Tree left at `7b4f6dd`, `git status --porcelain` empty. Nothing pushed. No
production file modified except transiently, and every mutation reverted from an
in-memory byte-exact copy in a `finally` block with the restore verified by
re-read.

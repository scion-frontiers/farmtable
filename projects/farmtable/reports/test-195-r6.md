# TEST REVIEW — #195 markdown-sanitize, round 6

**VERDICT: REQUEST CHANGES**

**Target:** `86f30bcdc699367681ccffbc4fde1e40006fd754`, branch `markdown-sanitize`.
Verified: `git rev-parse HEAD` = `86f30bc…`, `git status --porcelain` empty at
start and at end.
**Gate reproduced independently:** `cd /workspace/web && npm test` → exit 0,
`markdown sanitizer: 69 checks passed`; `npx tsc --noEmit` → exit 0.
**Leg:** test review. I did not read the other two legs' reports or working files.
**Scratch:** `/scion-volumes/scratchpad/projects/farmtable/salvage/r6-test-195/`.

No live vulnerability. Both real sinks are correctly wrapped at this SHA, and
nothing below changes that. Everything here is about whether the *guard* can
still falsify the things it claims to pin.

Three findings block. Two of them are this workstream's signature defect
recurring **inside the fixes this round shipped for it**:

* the declaration scan added to close T1 (because `Function.length` "stops at
  the first defaulted parameter") itself stops at the first regex match, and
  reads raw bytes rather than the comment-blanked view the same file builds
  400 lines below;
* the positive fixture table added to close F2 (because `BANNED_SINKS` was
  emptyable with the suite green) is itself emptyable with the suite green.

---

## Severity table

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| **T-1** | **High** | The arity pin — this round's headline fix — is GREEN for three ordinary TypeScript spellings of a second parameter | BY EXECUTION |
| **T-2** | **Medium** | Deriving `EXPECTED_CHECKS` from `REQUIRED_SINKS.length` removed the only cross-check on the guard's own scope; measured, r6 now absorbs a scope shrink that r5 caught | BY EXECUTION + counterfactual |
| **T-3** | **Medium** | Every fixture table is emptyable, and single entries are droppable, with the suite green at 69 — F2/T4a reproduced one level up | BY EXECUTION |
| T-4 | Low | The check total pins *deletion* of a check but not *evisceration* of one | BY EXECUTION |
| T-5 | Low | The `Function.length` half of the arity pin has no unique coverage on any measured form; the docblock's "neither is sufficient alone" is not what the measurement shows | BY EXECUTION |
| T-6 | Info | The `^3.4.12` dependency floor has no red-on-revert and cannot get one in this suite | BY EXECUTION |
| T-7 | Info | `SANITIZE_DOM: false` is the one measured DOMPurify-config widening with no signal | BY EXECUTION |
| T-8 | Info | The private `Marked` instance — called a security property in `markdown.ts` — has no pin; swapping it for the shared singleton is green | BY EXECUTION |

**Confirmed, not findings:** Leg 3's GREEN→RED control reproduced in full (4/4,
both halves, right rule each time); no test cell disappeared with `IGNORE_MARKER`;
all eight new checks have unique coverage; `slot`, the non-string guard and the
URI policy each have a red-on-revert. Details in "Charge-by-charge" below.

---

## Method

`salvage/r6-test-195/mut.py` (and `mut2.py`, the same file parameterised on tree
root). Properties, per the standing bars:

* **Content-addressed only.** Every mutation is `{file, find, replace}`; the
  driver counts occurrences of `find` and **aborts the mutation** unless the
  count is exactly 1. No line numbers anywhere.
* **Exit codes from the child.** `subprocess.run(...).returncode`, never through
  a pipe. Where a mutation touches a file `tsc -p tsconfig.test.json` does not
  compile, the spec sets `"tsc": true` and `npx tsc --noEmit` is run as a second
  child and its code folded in.
* **Backups outside the repo**, under `salvage/r6-test-195/`. After every run
  each touched file is restored and re-verified by **sha256 against the
  out-of-repo copy**, and `git status --porcelain` must be empty. Both assertions
  are hard `assert`s; a failure aborts the batch.
* **Controls both ways.** `CTRL-0` (untouched tree) GREEN and `CTRL-1`
  (`EXPECTED_CHECK_CALL_SITES = 99`) RED were run first, so the driver is known
  to be able to see both colours.
* **Pristine set** (sha256 recorded before any mutation, re-verified after all
  of them):

  ```
  3c9ed48c…a87ed  web/src/util/markdown.ts
  1572e7b2…75304  web/src/util/markdown.test.ts
  493f2fb1…1a66d5 web/src/components/inspector/ft-inspector-comments.ts
  050fb42b…4a1c56 web/src/components/inspector/ft-inspector-desc.ts
  e3f55255…3c489e web/package.json
  ```

  All five UNCHANGED at the end of the review. "Clean" was not treated as
  "unchanged": both were checked.

62 mutations across 6 batches, plus the round-5 control tree. Raw results:
`salvage/r6-test-195/logs/spec*.results.json`.

---

## T-1 — HIGH — the arity pin is defeated by an overload, by a comment, and by a string literal

**BY EXECUTION.** `web/src/util/markdown.test.ts:559-577`, specifically the
declaration scan at `:566-576`.

```ts
const src = readFileSync(join(findWebRoot(), 'src', 'util', 'markdown.ts'), 'utf8');
const decl = /export function renderMarkdown\s*\(([^)]*)\)/.exec(src);
if (decl === null) { throw … }
if (/[,=]/.test(decl[1])) { throw … }
```

Two defects, both in one line. `.exec` returns the **first** match and nothing
rejects a second; and the scan runs over **raw bytes**, not over
`stripInertText(src, { strings: true })` — the comment-and-string blanking this
same file builds, documents at length, and applies to every other source scan
in it.

### Reproduction

```
python3 salvage/r6-test-195/mut.py salvage/r6-test-195/spec2.json
```

| mutation of `web/src/util/markdown.ts` | `npm test` | `tsc --noEmit` |
|---|---|---|
| `C7-a` `(md, opts: Record<string,unknown> = {})` | **RED** (correct) | — |
| `C7-b` `(md, ...rest: unknown[])` | **RED** (correct) | — |
| `C7-c` `(md, { inline }: {inline?: boolean} = {})` | **RED** (correct) | — |
| `C7-f` `export const renderMarkdown = (md, opts = {}) =>` | **RED** (correct) | 0 |
| **`C7-e2` two overload signatures + defaulted impl** | **GREEN, 69 checks** | **0** |
| **`C7-g` prior-art comment naming the old signature** | **GREEN, 69 checks** | **0** |
| **`C7-h` string literal naming the old signature** | **GREEN, 69 checks** | **0** |

`C7-e2` in full — a *fully usable two-argument public API*:

```ts
export function renderMarkdown(md: string): string;
export function renderMarkdown(md: string, opts: { inline?: boolean }): string;
export function renderMarkdown(md: string, opts: { inline?: boolean } = {}): string {
```

`Function.length` is 1 (the implementation's second parameter is defaulted);
`.exec` matches the first overload signature and reads `md: string`, which has
no `,` and no `=`. Both ends of the "both ends" pin report clean.

`C7-g` is the cheaper and far more likely one — no overloads needed:

```ts
// Historical signature, kept for the changelog:
//   export function renderMarkdown(md: string): string
export function renderMarkdown(md: string, opts: Record<string, unknown> = {}): string {
```

The comment matches first. `markdown.ts` already carries an 18-line docblock
*about this signature* immediately above the declaration; a future line of prose
quoting the old form is not an adversarial contrivance, it is the normal way
people annotate a signature change. `C7-h` is the same thing in an exported
string constant.

**Why this is High and not Critical.** The sink-side half of the T1 closure is
intact: `sinkArgumentIsSanitized`'s top-level-comma rejection does go red for
`renderMarkdown(this.description, { inline: true })` at the live sink (measured:
`L3-T1`, RED via both the per-file rule and the tree-wide argument check). So a
*call* passing a second argument from either enumerated sink file is still
caught. What is not caught is the sanitizer growing the configuration channel in
the first place — which is the thing `inputContract` exists to deny, and which
the round's log lists as closed "from three sides".

**Costly-disclosure check (charge 7).** The developer's disclosure is accurate
and their disagreement with the brief was correct: `renderMarkdown.length === 1`
alone does not catch `(md, opts = {})` — I measured that directly (T-5). The fix
they wrote instead is materially better than the briefed one-liner. It is also
the same shape of mistake one layer out: `Function.length` stops at the first
defaulted parameter; `.exec` stops at the first match. The credit is due; the
fix is not finished.

**Recommended fix** (`markdown.test.ts:566-576`):

```ts
const src = stripInertText(
  readFileSync(join(findWebRoot(), 'src', 'util', 'markdown.ts'), 'utf8'),
  { strings: true },
);
const decls = [...src.matchAll(/export function renderMarkdown\s*\(([^)]*)\)/g)];
if (decls.length !== 1) {
  throw new Error(
    `expected exactly one renderMarkdown declaration, found ${decls.length} — an overload ` +
    'signature satisfies a first-match scan while the implementation takes a second parameter',
  );
}
if (/[,=]/.test(decls[0][1])) { … }
```

and add `C7-e2`/`C7-g` to the acceptance vectors. Note the fixture cannot be a
string table here, because the scan reads a fixed path — either parameterise the
scan on its input text (preferred; it is then fixturable like every other rule
in the file) or accept that this one rule stays tree-only and say so.

---

## T-2 — MEDIUM — the `EXPECTED_CHECKS` derivation absorbs a shrink of the guard's own scope

**BY EXECUTION, with the counterfactual measured.** `markdown.test.ts:2391-2392`,
`REQUIRED_SINKS` at `:831-834`, R7 at `:1520-1533`.

This is charge 2's question answered in the affirmative, and charge 1's answer:
**`REQUIRED_SINKS` is the collection whose cardinality is now pinned by nothing
except a tree-wide tripwire that it also feeds.**

Round 5 had `const EXPECTED_CHECKS = 61;` (verified at `53296af:1943`). Round 6
has:

```ts
const EXPECTED_CHECK_CALL_SITES = 68;
const EXPECTED_CHECKS = EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1);
```

`REQUIRED_SINKS` is the enumerated set that mechanism (a) — the **sound**,
closed-world half — is closed over. Shrinking it removes R2 and R7 from a file
entirely. Under r5 that shrink moved the check total and turned the suite red.
Under r6 the arithmetic moves with it.

### Reproduction

`C2-e` (`spec1.json`) — three content-addressed edits:

1. `markdown.test.ts`: delete `'src/components/inspector/ft-inspector-desc.ts',`
   from `REQUIRED_SINKS`.
2. `ft-inspector-desc.ts:3`:
   `import { unsafeHTML as rawHtml } from 'lit/directives/unsafe-html.js';`
3. `ft-inspector-desc.ts:233`:
   `${unsafeHTML(renderMarkdown(this.description))}` → `${rawHtml(this.description)}`

Result: **`npm test` exit 0, `markdown sanitizer: 68 checks passed`,
`npx tsc --noEmit` exit 0** — with the task description rendered raw into the
inspector's shadow root.

Counterfactuals, both measured, which is what makes this a claim about *this
round's change* rather than about the guard in general:

| | result |
|---|---|
| `CF-1` identical mutation, `EXPECTED_CHECKS` restored to a hard literal `69` | **RED** — `check total pinned` |
| `CF-2` identical mutation without the `u` escape (plain `unsafeHTML as rawHtml`) | **RED** — tree-wide `tripwire` |
| `C2-d` shrink `REQUIRED_SINKS` alone, leave the file correct | RED — `unsafeHTML call sites are still found` |
| `C2-f` empty `REQUIRED_SINKS` | RED — same single check |
| `C2-c` add a third entry | RED — per-file rules + sink count |

`CF-2` isolates the mechanism precisely: **R7 (the unicode-escape ban) is the
only rule the shrink removes that the tree-wide scan does not duplicate**, and
R7's scope *is* `REQUIRED_SINKS`. `CF-1` isolates the regression: with r5's
literal, the same three edits are caught.

So after the shrink the residual signal is `sinkCountViolation` — a
`\bunsafeHTML\s*\(` regex count, i.e. mechanism (b), which the file itself
labels "a TRIPWIRE, NOT A PROOF" — and it is satisfied automatically the moment
the removed file stops spelling `unsafeHTML(`. The closed-world guarantee's own
scope is now pinned only by the open-world half.

The developer's log presents the derivation purely as convenience ("a third sink
costs one edit instead of three… there is no sentence left to drift"), and the
new failure message goes further, actively reassuring the reader that
`REQUIRED_SINKS` changing length needs no action: *"the total moves on its own
and nothing here needs editing."* The convenience is real. The signal traded for
it was not disclosed.

**Recommended fix.** Keep the derivation; restore the lost gate as one line
under the same doctrine as every other count pin in the file:

```ts
const EXPECTED_REQUIRED_SINKS = 2;   // never change merely to make a red suite go green
```

asserted inside the existing `sink scan actually reads the source tree` check
(no new `check()` call site, so `EXPECTED_CHECK_CALL_SITES` is untouched). Fix
the failure-message sentence at `:2408-2410` to match. Separately, consider
promoting R7 to the tree-wide scan — it is a two-line rule and `CF-2` shows it is
the only per-file rule with no tree-wide counterpart.

---

## T-3 — MEDIUM — every fixture table is emptyable with the suite green

**BY EXECUTION.** `markdown.test.ts:1884, 1916, 1937, 1980, 2111, 2288`.

F2/T4a this round was: *`BANNED_SINKS` could be emptied with the suite green,
because its only fixtures were negative controls.* The remedy was
`BANNED_SINK_POSITIVES`. That table has exactly the property the thing it fixed
had, and so does every other fixture table in the file.

| mutation | result |
|---|---|
| `T-EMPTY-1` empty `BANNED_SINK_POSITIVES` | **GREEN, 69** |
| `T-EMPTY-2` empty `SINK_EVASIONS` | **GREEN, 69** |
| `T-EMPTY-3` empty `INDIRECTION_EVASIONS` | **GREEN, 69** |
| `T-EMPTY-4` empty `OWNERSHIP_EVASIONS` | **GREEN, 69** |
| `E6` empty `LEGITIMATE_SOURCE` | **GREEN, 69** |
| `E7` empty `INERT_PROSE` | **GREEN, 69** |
| `T-DROP-2` drop the single entry `'document.write(body);'` | **GREEN, 69** |
| **`D5c` neuter the `document.write` pattern **and** drop its positive** | **GREEN, 69** |

`D5c` is the one to act on. Two content-addressed edits, both one line:

```
  { name: 'document.write', pattern: /document\.write\s*\(/ },
→ { name: 'document.write', pattern: /document\.writeZZZ\s*\(/ },

    'document.write(body);',
→   (deleted)
```

That is F2 restored for one sink pattern, at a two-line cost, with the suite
green at 69. Each half alone is red (`D5b` RED, `T-DROP-2` GREEN only because it
removes coverage rather than detection) — it is the pair that closes.

There is a second, independent weakness in the same check
(`:2000-2008`): it asks whether **any** `BANNED_SINKS` pattern matches each
positive. Per-pattern coverage is therefore incidental rather than asserted —
today it happens to hold one-to-one, so `D5b` alone is red, but nothing keeps it
that way.

**Recommended fix.** Both are cheap and neither adds a `check()` call site:

1. Pin each table's length beside `EXPECTED_CHECKS` under the same doctrine
   (`BANNED_SINK_POSITIVES.length === 15`, `SINK_EVASIONS.length === 24`, …), or
   at minimum assert every table is non-empty inside its own check.
2. In `fixture: every banned raw-HTML sink form is actually detected`, invert the
   quantifier: assert that **every `BANNED_SINKS` entry is matched by at least one
   positive** as well as that every positive is matched by at least one pattern.
   That makes the coverage relation itself the assertion and kills `D5c` without a
   length literal.

---

## T-4 — LOW — the check total pins deletion, not evisceration

**BY EXECUTION.** `markdown.test.ts:34-41`, `:2404-2413`.

`checks += 1` happens before `fn()` runs, so a `check()` whose body asserts
nothing counts toward the total.

| mutation | result |
|---|---|
| `C2-a` delete a whole `check()` call site | RED — `check total pinned` (correct) |
| `C2-b` duplicate a `check()` call site | RED (correct) |
| `E1` replace the body of `slot attribute stripped` with a comment | **GREEN, 69** |
| `E1b` `E1` **and** remove `'slot'` from `FORBID_ATTR` | **GREEN, 69** |

`E1b` is the shape that matters: a production rule reverted and its test hollowed
out, count unchanged, suite green.

The file states the mirror residue honestly for predicates ("a fixture catches a
NEUTERED predicate, not a DELETED call site. Deleting a whole `check()` is caught
by `EXPECTED_CHECKS`"). The converse — `EXPECTED_CHECKS` catches a deleted check
but not a hollowed one — is not stated, and charge 2 makes the count
load-bearing.

**Recommended fix.** Cheapest honest option is a sentence in the
`EXPECTED_CHECKS` docblock recording it. A real one: count assertions as well as
checks — have the `assert*` helpers bump a counter and pin
`assertions >= EXPECTED_ASSERTIONS` (113 today, measured). A floor is defensible
here where it was not for the file count, because the failure mode being guarded
is removal, not addition.

---

## T-5 — LOW — the `Function.length` half of the arity pin has no unique coverage

**BY EXECUTION.** `markdown.test.ts:560-565`.

The docblock says the arity is "Pinned from BOTH ends, because neither is
sufficient alone." Measured against the project's own gate (`npm test` **and**
`tsc`), that is half right.

| mutation | result |
|---|---|
| `A22` ablate the `Function.length` assertion alone | GREEN (expected — nothing else broken) |
| `A21` ablate the declaration scan alone | GREEN (expected) |
| `A22` + `(md, opts = {})` | **RED** — the declaration scan fires |
| `A21` + `(md, opts = {})` | **GREEN** |
| `A21` + `(md, ...rest)` | **GREEN** |
| `A21` + `(md, {inline} = {})` | **GREEN** |
| `A21` + `(md, opts: Record<string,unknown>)` **required** | RED — **exit 2, from `tsc`**, not from the check |
| `A21`+`A22` + `(md, opts = {})` | GREEN (control) |

There is no measured arity form for which `Function.length` is the falsifier. A
*required* second parameter is rejected by the type checker before the check runs
— all ~40 behavioural call sites pass one argument, so `tsc -p tsconfig.test.json`
emits 14 × TS2554 and `npm test` never reaches node. Every form that survives
`tsc` (defaulted, optional, rest) leaves `Function.length` at 1 by definition.

This is not a request to delete the assertion — it costs one line and it does
cover source/artifact divergence, which nothing else does. It is a request to
correct the docblock: the declaration scan is sufficient for every measured form,
`Function.length` for none, and the reason is that `tsc` is already the second
gate. Standing bar 8 — a narrower true claim beats a broader unverified one — and
this is the file that just spent a round removing a false "neither is
load-bearing on its own" style claim from `FORBID_TAGS`/`FORBID_ATTR`.

---

## T-6 — INFO — the dependency floor has no red-on-revert, and cannot have one here

**BY EXECUTION.** `P3`: `web/package.json`, `"dompurify": "^3.4.12"` → `"^3.0.0"`.
Suite **GREEN, 69 checks**.

Stating it plainly as the brief asks: **the `^3.4.12` floor is not covered and is
not coverable by this suite.** Nothing in `markdown.test.ts` reads
`package.json`, and the behavioural checks exercise whatever version the lockfile
resolved, which the revert does not change. A test that installed an old
DOMPurify would be a different kind of test entirely.

Do not let this ride as covered. Two options, in preference order: (a) put the
floor in CI as a dependency-audit step, which is also where the V25-rationale
scan the shared brief flags as "enforced by nothing" belongs; (b) if you want a
signal in this suite, a five-line check that reads `package.json` and asserts the
declared `dompurify` range's floor is `>= 3.4.12` — worth it only if someone will
maintain the literal, and it is a *bookkeeping* pin, not a security one.

---

## T-7 — INFO — `SANITIZE_DOM: false` is the one measured config widening with no signal

**BY EXECUTION.** Charge 1 asked whether the DOMPurify config object is a
constant every fixture inherits. It is — nothing varies it — but unlike
`BANNED_SINKS`, it turns out to be well covered *behaviourally*, because the
checks name the properties it controls:

| config mutation in `markdown.ts` | result |
|---|---|
| `P5` empty `FORBID_TAGS` | RED — 11 checks |
| `P6` empty `FORBID_ATTR` | RED — 6 checks |
| `CFG-1` `ADD_ATTR: ['onerror']` | RED — `inline event handler stripped` |
| `CFG-2` `ALLOWED_URI_REGEXP: /^.+$/` | RED — 5 checks |
| `CFG-4` `ADD_TAGS: ['iframe']` | RED — `iframe srcdoc stripped` |
| `CFG-5` config object dropped entirely | RED — 11 checks |
| `CFG-6` return `parser.parse(md)` unsanitized | RED — 11 checks |
| **`CFG-3` `SANITIZE_DOM: false`** | **GREEN, 69** |

`SANITIZE_DOM: false` re-enables DOM-clobbering. Exploitability through this
pipeline is low — the classic primitives need `<form>`/`<input>`, both in
`FORBID_TAGS` — so this is Info, not a finding I would block on, and it is
adjacent to M1 which is out of scope. Recording it because charge 1 asked the
question and this is the honest answer: the config is covered on every axis the
behavioural checks name, and on no axis they do not.

---

## T-8 — INFO — the private `Marked` instance has no pin

**BY EXECUTION.** `markdown.ts:66-73`.

`E8`: `import { Marked }` → `import { marked }`, `new Marked({renderer:{…}})` →
`marked.use({renderer:{…}})`. **GREEN, 69 checks, `tsc --noEmit` 0.**

`markdown.ts`'s own comment calls this a security property — "A private Marked
instance keeps this off the shared `marked` singleton" — and R8's docblock cites
it as the sibling hazard that motivated R8. R8 protects it from *other files*
naming `'marked'`; nothing protects it from `markdown.ts` itself dropping it,
after which any future `marked.use(…)` anywhere reconfigures the renderer that
feeds the sanitizer.

Cheaply pinnable, and — unusually for this file — pinnable by *effect* rather
than by name, because the test file is excluded from the scanned set and may
therefore import `marked` itself:

```ts
check('the sanitizer does not use the shared marked singleton', async () => {
  const { marked } = await import('marked');
  marked.use({ renderer: { checkbox: () => '<img src=x onerror=alert(1)>' } });
  assertNoEventHandlers(renderMarkdown('- [x] done\n'), 'shared marked singleton reached the sanitizer');
});
```

That would also be the first check in this file that observes an effect rather
than a name — a small piece of what the Phase 2 harness is otherwise carrying
alone.

---

## Charge-by-charge

**1 — what inputs can these fixtures not express?** Answer: **`REQUIRED_SINKS`
(T-2)** and **the fixture tables themselves (T-3)**. `REQUIRED_SINKS` is the set
the sound half is closed over, it is never varied by any fixture, and this round
removed the incidental cross-check that used to notice when it moved. The
fixture tables are the collection one level up from the rule lists this round
fixtured. Candidates I checked and cleared:

* *Two sinks in one file / two calls on one line* — `S1` (a second, raw
  `unsafeHTML(` appended to the same template line in `desc.ts`) is RED via three
  checks. `callArguments` iterates all occurrences; the per-file R5 loop and the
  count pin both hold at cardinality 2 in one file.
* *A sink nested in an IIFE, or with a nested call in its argument* — `S2`, `S3`
  both GREEN. Correct: these are false-positive controls, and the guard passes
  them. `callArguments`' unbalanced-paren path pushes the tail of the file and
  therefore fails closed.
* *The DOMPurify config* — a constant every fixture inherits, but behaviourally
  covered on every axis the checks name; see T-7.
* *`SINK_BINDINGS` (2), `RAW_DIRECTIVES` (3), `SANITIZER_DEPENDENCIES` (2),
  `INERT_EXTENSIONS` (15)* — `E2`, `E3`, `E4`, `E5` all RED. These four are
  properly fixtured.
* *`renderMarkdown`'s return* — consumed as a string by exactly one caller shape;
  `CFG-5`/`CFG-6` show the shape is pinned behaviourally.

**2 — can the derived `EXPECTED_CHECKS` still go red?** Partly. Deleting a
`check()` (`C2-a`) and duplicating one (`C2-b`) are both RED. Adding a sink
(`C2-c`) and removing one (`C2-d`, `C2-f`) are RED, but **via
`sinkCountViolation`, not via the total** — the arithmetic absorbs the count
change by design. That absorption is exactly the hole `C2-e` walks through
(T-2). And the total does not notice an eviscerated check body (T-4).

**3 — independently reproduce Leg 3's control.** Done, both halves, on a
round-5 tree extracted **out of the repo** (`git archive 53296af web`, node_modules
symlinked; r5 baseline reproduced at `61 checks passed`, `EXPECTED_CHECKS = 61`
confirmed as a hard literal at `53296af:1943`). Same four mutations, same
content-addressed anchors, run against both trees:

| real-tree mutation | r5 `53296af` | r6 `86f30bc` | r6 fires via |
|---|---|---|---|
| control, untouched tree | GREEN | GREEN | — |
| T1 arity at the live sink (`desc.ts`) | **GREEN** | **RED** | per-file R5 + tree-wide argument check |
| F1 semicolon-less import swallowing a value alias | **GREEN** | **RED** | R4 (`unsafeHTML` non-called position) + tripwire |
| T3 marker laundering via `inspector-shared-styles.ts` | **GREEN** | **RED** | tripwire (`as`-rename, re-export, non-called) |
| T2 unterminated `<!--` hiding an `innerHTML` write | **GREEN** | **RED** | `BANNED_SINKS` tripwire |

**The developer's Leg 3 claim is confirmed by measurement, right rule each time.**
Their 16 revert-the-fix mutations were re-run in substance (`D5`, `D5b`, `D6`,
`D7`, `D8`, `D17`, `D18`, `D20`, `A21`, `A22`, `P1`, `P1b`, `P2`, `P4`, `P5`,
`P6`) — all RED except where recorded above as a finding.

**4 — are any of the new checks deletable-green?** **No.** Each of the eight is
the *sole* falsifier for the defect it targets; there is no redundancy of the
round-5 "seven checks with no unique coverage" kind:

| defect | checks that fail |
|---|---|
| revert `slot` | 1 — `slot attribute stripped` |
| revert `action` | 1 — `action attribute stripped from a tag that survives` |
| revert the non-string guard | 1 — `renderMarkdown does not throw on non-string input` |
| `ALLOW_UNKNOWN_PROTOCOLS: true` | 1 — `unknown URL schemes are dropped` |
| empty / neuter `BANNED_SINKS` | 1 — `fixture: every banned raw-HTML sink form…` |
| neuter either count predicate | 1 — `fixture: the tree-wide count pins fire…` |
| disable `opts.strings` blanking | 1 — `fixture: a string literal naming the sink identifiers…` |
| add a defaulted second parameter | 1 — `renderMarkdown accepts exactly one parameter` |

The one redundancy found is *within* a check, not between checks: the
`Function.length` assertion (T-5).

**5 — did a cell disappear with `IGNORE_MARKER`?** **No.** Verified by cells, not
by names:

* Assertion cells (`assertNoElement|assertElement|assertNotContains|assertContains|assertEqual|assertNoEventHandlers` call texts), r5 vs r6: **zero present in r5 and absent in r6**. Count 105 → 113.
* Fixture-table string entries, r5 vs r6: **zero lost**.
* `SINK_EVASIONS` labels, r5 vs r6: **zero lost**.
* One check was **renamed**: `fixture: comments and marked lines cannot turn the
  suite red` → `fixture: comments cannot turn the suite red`. `INERT_PROSE` went
  5 → 4 entries, and the missing entry —
  `"const ADVICE = 'never do el.innerHTML = userInput'; // raw-sink-scan: ignore-line"`
  — is present in `BANNED_SINK_POSITIVES` at `:1997`. The cell **changed polarity
  from negative to positive**, which is a strengthening, and it is the correct
  handling: it now goes red if anyone re-honours the marker. The
  `OPT-OUT HONOURED` assertion in the ownership fixture survived too (`:2330`).

**6 — red-on-revert for the four production items.** `slot` **RED** (`P1`);
non-string guard **RED** (`P2`); URI policy **RED** (`P4`); dependency floor
**GREEN — no coverage, and none possible here** (`P3`, T-6). I also checked the
`action` addition the same way: **RED** (`P1b`). The developer's standing-bar-5
work on `action`/`slot`/`formaction` against a DOMPurify-defaults control
reproduces: `P6` (empty `FORBID_ATTR`) turns both the `action` and `slot` checks
red, so `FORBID_ATTR` is load-bearing for both and neither check is a no-op.

**7 — verify the costly disclosure.** Verified and, on the specific point,
upheld: `A21` + `(md, opts = {})` is **GREEN**, so `Function.length` alone —
the briefed one-liner — would indeed have left T1 open against the spelling a
real commit would use. The developer was right to refuse it. The fix they wrote
instead is nonetheless incomplete (T-1). The two-argument case **is already in
the acceptance vectors**: V11 in `SINK_EVASIONS` (`:2258-2261`), and it is also
red against the real `desc.ts` (`L3-T1`). Requested additions:
`C7-e2` (overload) and `C7-g` (comment decoy).

---

## Disclosures, limitations, and what I did NOT establish

* **Independence.** I read the shared brief, my leg brief, the target source, and
  `.design/project-log/markdown-sanitize-cleanup-r6.md`. I did not read the other
  legs' reports or working files, `reports/dev-195-vectors.json`, or any file
  whose header discussed this round's findings. No file I opened turned out to
  have been written by a concurrent leg. My harness was written this round from
  scratch — no prior-round harness was reused, so there is no inherited-sha256
  question.
* **I did not establish that any of this is exploitable in the running app.**
  `C2-e` and the T-1 mutations are *guard* failures. `C2-e` renders
  `this.description` through the raw directive and is a real regression by
  inspection of the mutated source, but I did not instantiate the component —
  same limitation the suite itself has, and the same reason (no component
  harness).
* **`C2-e` and `D5c` require editing `markdown.test.ts`.** Under the amended
  criterion — scoped to the two sink files — they are formally out of bounds, and
  I am not claiming they violate it. The claim is narrower and is about this
  round specifically: `C2-e` was **red under `53296af` and is green under
  `86f30bc`** (`CF-1`), and `D5c` is the defect this round filed as F2, at a
  two-line cost, inside the fix for F2. Both are regressions in signal introduced
  by the round, whatever the criterion says about who may edit what.
* **What my harness could not express.** (a) Anything requiring the two Lit
  components to be *loaded* — V23, V25 and T-8's effect-side are all unreachable
  from a `node` script with no custom-element registry, so I re-confirmed nothing
  about the Phase 2 survivors and take them as disclosed. (b) Multi-file
  refactors: every mutation is a set of exact-text substitutions, so I could not
  test "split `markdown.ts` into two modules" or "move a sink to a new component"
  beyond the single-file shapes above. (c) `npm ci` with a different resolved
  DOMPurify — I never varied the installed dependency, only the declared range,
  so T-6 is a statement about coverage, not about 3.0.0's behaviour. (d)
  Concurrency: not applicable, the suite is a single synchronous script.
* **I did not audit the sanitizer's XSS boundary.** No new payload vectors were
  run; the round-5 audit's 69 + 10 are taken as given. My `CFG-*` mutations
  exercise the *guard's ability to notice a config change*, not the config's
  correctness.
* **Out-of-scope items were not re-filed.** M1, CSP/Trusted Types, #204, V25, and
  the bare non-relative specifier are recorded at their known severity and I
  found nothing suggesting any is materially worse than recorded. T-7 is
  M1-adjacent and is filed as Info for that reason.
* **Sample bias.** 62 mutations is not a proof of absence for anything. Where a
  mutation was GREEN I have said what it means; where it was RED I have named the
  check that fired, because "the suite went red" and "the right rule fired" are
  different claims and only the second one is worth anything here.

---

## What would clear this review

1. **T-1** — `matchAll` + exactly-one-declaration, over `stripInertText(…, {strings:true})`. Add `C7-e2` and `C7-g` as vectors.
2. **T-2** — one-line `EXPECTED_REQUIRED_SINKS` pin inside the existing tree-scan check; correct the `:2408-2410` failure message; consider promoting R7 tree-wide.
3. **T-3** — invert the quantifier in the `BANNED_SINKS` positives check, and pin (or non-empty-assert) the six fixture tables.

T-4 through T-8 are recommendations. T-6 in particular should be written into the
log as *explicitly uncovered* rather than left to read as covered.

Reproduction for everything above:

```
cd /workspace && git rev-parse HEAD    # 86f30bcdc699367681ccffbc4fde1e40006fd754
S=/scion-volumes/scratchpad/projects/farmtable/salvage/r6-test-195
python3 $S/mut.py  $S/spec1.json    # charge 2 + charge 7
python3 $S/mut.py  $S/spec2.json    # overload/decoy variants, counterfactuals, table ablations
python3 $S/mut.py  $S/spec3.json    # production reverts + rule ablations
python3 $S/mut.py  $S/spec4.json    # arity-half pairs, DOMPurify config, sink shapes
python3 $S/mut.py  $S/spec5.json    # evisceration, rule-list emptying, marked singleton
MUT_REPO=$S/r5tree MUT_NOGIT=1 python3 $S/mut2.py $S/spec_leg3.json   # round-5 control
python3 $S/mut2.py $S/spec_leg3.json                                   # round-6 control
```

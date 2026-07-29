# #195 `markdown-sanitize` — Code Review leg, round 5 (final)

**SHA reviewed and tested: `53296afe36b718a8664be5ab748879a18f289b66`**
Clone: `/workspace` (the brief's `/workspace/farmtable-review-195` does not exist; `/workspace`
is the clone, on branch `markdown-sanitize`, at the stated SHA, clean at start and at end).
Diff base: `7a0f220..53296af`.

Every claim below is labelled **BY EXECUTION** (I ran it and the output is pasted) or
**REASONED** (I read the code / a spec and argued it).

---

## Gate result

**BY EXECUTION.** `npm ci` then `npm test`, in `web/`, exit code read directly from the
child process (no pipe):

```
$ cd /workspace/web && npm test > /tmp/final.log 2>&1; echo "FINAL_NPM_TEST_EXIT=$?"
FINAL_NPM_TEST_EXIT=0

> farmtable-web@0.0.1 test
> tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js

markdown sanitizer: 61 checks passed
```

Supporting runs, all **BY EXECUTION**, all exit code read directly:

| command | exit | note |
|---|---|---|
| `npm ci` (web) | 0 | |
| `npm test` (web) | 0 | 61 checks |
| `npx tsc --noEmit` (web) | 0 | |
| `go build ./...` | 0 | zero Go changes in the branch |
| `go test ./...` | 0 | |
| `git status --porcelain` after all work | empty | verified at start, after every mutation, and at end |

Pin arithmetic independently recomputed **BY EXECUTION**: 50 scannable source files under
`web/src` (matches `EXPECTED_SOURCE_FILES`); `grep -cE '^\s+check\(' = 60` literal call
sites; `60 + (REQUIRED_SINKS.length - 1) = 61` matches `EXPECTED_CHECKS` and the runtime
count. The comment at lines 1924–1929 is correct.

### Harness self-check (standing bar 3)

Before trusting any negative result I proved the harness can express a failure. Control
mutation, content-addressed, of R1's own literal:

```
[CONTROL-R1 (expect RED)] exit=1 :: Error: 3 of 61 markdown sanitizer checks failed
[CONTROL-R1 (expect RED)] restored, tree clean, matches backup
```

A second control proved the check-total pin fires on a deleted check:

```
[M4 delete one check() call] exit=1 :: Error: 1 of 60 markdown sanitizer checks failed
  - check total pinned: expected 61 checks to run, 60 did
```

All mutations were driven by a content-addressed driver that aborts unless the anchor
occurs exactly once (it did abort once, correctly, on an ambiguous anchor), restores with
`git checkout --`, and then asserts **both** `git status --porcelain` empty **and**
byte-equality against an out-of-repo backup taken before the first run. Driver and probes
are salvaged to
`/scion-volumes/scratchpad/projects/farmtable/salvage/review-195-r5/`.

---

## Executive Summary

The production sanitizer, `web/src/util/markdown.ts`, is correct and its comments are
substantially accurate — I verified the three specific claims you named and two of the
three hold exactly as written. The blocking problems are both in the guard, and both are
instances of the defect class this workstream has been chasing: **`stripImportStatements`
can be defeated, and made to reject correct code, by omitting a semicolon** (F1, verified
to defeat *both* the "sound" half and the tripwire), and **the entire `BANNED_SINKS` list
can be emptied with the suite green at 61/61** (F2, the vacuity failure the file itself
names three times and fixed everywhere except here). Risk level: **MEDIUM** — no live XSS
on this tree, but the round-5 claim of soundness over bindings does not currently hold.

---

## Critical

None. I found no live XSS on this tree, and I specifically did not reproduce or re-file
V25 / R-eval / R-globalThis / R-newFunction / R-bareSpecifier. I accept all five as
correctly accepted; see FYI-3 for the one place I think the *acceptance wording* overreaches.

---

## Required

### F1 — `stripImportStatements` sweeps real code across statement boundaries; its docblock claims the opposite. `web/src/util/markdown.test.ts:909-922`

**BY EXECUTION.** The docblock at lines 909–916 states:

> "`[^;]` cannot cross a statement boundary, so a value alias sharing a line with an
> import — `import { html } from 'lit'; const raw = unsafeHTML;` — is still scanned."

That claim is true for the one example given and **false in general**. `[^;]` matches
newlines. If an import statement lacks its terminating semicolon, the regex extends
forward to the *next* statement that ends `from '…';` — blanking everything in between,
including a value alias.

I drove the guard's own predicates directly (the module exports nothing, so I appended
exports to a copy of the compiled output):

```
C0 all semicolons + alias     (want CAUGHT)   (a) CAUGHT  (b) CAUGHT
C1 no semicolons + alias      (want CAUGHT)   (a) MISSED  (b) MISSED   <-- FALSE NEGATIVE
C2 import no semi, alias semi (want CAUGHT)   (a) CAUGHT  (b) CAUGHT
C4 all semicolons, no alias   (want CLEAN)    (a) MISSED  (b) MISSED
C5 no semicolons, no alias    (want CLEAN)    (a) CAUGHT  (b) CAUGHT   <-- FALSE POSITIVE
```

C1 is this file:

```ts
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
const rawHtml = unsafeHTML
import { renderMarkdown } from '../../util/markdown.js';
const t = unsafeHTML(renderMarkdown(this.body));
```

`sinkBindingViolations()` returns `[]` and `directiveIndirectionOffenders()` returns `[]`.
The stripped view is:

```
"                                                          \n                          \n                                                        \nconst t = unsafeHTML(renderMarkdown(this.body));"
```

Line 2 — the alias — is blanked. This is **V3**, the evasion the docblock at lines 1106–1110
calls "the rule that generalises… and it is why this is not round 5's problem," defeated by
deleting two semicolons. It defeats mechanism (a), the half the round-5 docblock declares
*sound*, and mechanism (b) simultaneously.

C5 is the mirror image and is arguably worse for the guard's survival: a **correct** sink
file written without semicolons is rejected with a message accusing it of aliasing. Line 722
of this same file warns "a guard that rejects correct code gets deleted."

This is not a novel defect class to the author — line 1306 records exactly it, for the
re-export regex: *"`[^;]` matches newlines, so an adjacent semicolon-less line used to be
swept in."* That fix (`[^;\n]`) was applied at line 1307 and never carried back to
`stripImportStatements`, which feeds R3, R4 and the tree-wide non-called-position rule.

**Against the amended criterion:** dropping a semicolon is a style variance, not an
adversarial payload; the regression is the alias, and aliasing is the first item the
amended claim says it defends. F1 is squarely inside the amended scope, not outside it.

**Suggested fix** (validated **BY EXECUTION** on all seven cases in the salvaged matrix —
it fixes C1 and C5 and preserves C0, C2, C4, plus multi-line imports, side-effect imports
and the same-line-alias case the docblock cites):

```ts
function stripImportStatements(code: string): string {
  const wipe = (m: string): string => m.replace(/[^\n]/g, ' ');
  return code
    // `[^;'"]` cannot cross a specifier, so one import can never swallow the next;
    // `;?` makes the terminator optional so an ASI-style import is still blanked.
    .replace(/\bimport\b[^;'"]*?\bfrom\b\s*(['"])[^'"]*\1\s*;?/g, wipe)
    .replace(/\bimport\s*(['"])[^'"]*\1\s*;?/g, wipe);
}
```

and add the case to `SINK_EVASIONS` so it is pinned:

```ts
{
  label: 'V10 value alias hidden by a semicolon-less preceding import',
  find: "    \"import { unsafeHTML } from 'lit/directives/unsafe-html.js';\",",
  replace: "    \"import { unsafeHTML } from 'lit/directives/unsafe-html.js'\",\n" +
           "    'const rawHtml = unsafeHTML',",
},
```

Also correct the docblock: the property is "one import statement cannot swallow the next,"
not "`[^;]` cannot cross a statement boundary."

---

### F2 — the whole `BANNED_SINKS` list can be emptied with the suite green at 61/61. `web/src/util/markdown.test.ts:1035-1047`, fixtures at `1596-1630`

**BY EXECUTION**, three independent mutations, each restored and verified:

```
[M1 neuter innerHTML sink pattern]     exit=0 :: markdown sanitizer: 61 checks passed
[M2 delete insertAdjacentHTML entry]   exit=0 :: markdown sanitizer: 61 checks passed
[M3 empty the whole BANNED_SINKS list] exit=0 :: markdown sanitizer: 61 checks passed
```

M1 replaced the `innerHTML/outerHTML assignment` pattern with `/ZZZ_NEVER_MATCHES_ZZZ/`.
M3 rebound `BANNED_SINKS` to `[]` while leaving the eight entries in an unused constant.
Neither the check total nor any check moved.

The only fixtures that touch `BANNED_SINKS` are `LEGITIMATE_SOURCE` (1581) and
`INERT_PROSE` (1610), and both are **negative** controls — they assert the patterns do
*not* fire. There is no positive table. Nothing in the suite asserts that
`el.innerHTML = x` is actually detected, so every one of the eight patterns is untested
detection logic.

This is the exact failure the file diagnoses three separate times and fixed everywhere else:

- 1571–1573: *"The `lit/static-html.js` false-positive control that previous rounds cited
  as deliberate passed VACUOUSLY: no file in the repo imports it, so nothing ran."*
- 1840–1845: *"R8 is satisfied vacuously today… so the rule is pinned against a table
  instead of against the tree."*
- 383–387: *"emptying the list left the suite green at the same total."*

`directiveIndirectionOffenders` got `INDIRECTION_EVASIONS`. `sinkBindingViolations` got
`SINK_EVASIONS`. R8/R9 got `OWNERSHIP_EVASIONS`. `BANNED_SINKS` got nothing.

**Severity rationale:** not Critical — mechanism (b) is explicitly declared a tripwire, not
a proof, and the sound half still holds independently. But an untested detector is not a
tripwire, and a developer "simplifying" or typoing one of these regexes removes it with no
signal. That is innocent-looking regression, which is what the amended claim promises to
catch.

**Suggested fix** — mirror `OWNERSHIP_EVASIONS`, one new `check()` (bump `EXPECTED_CHECKS`
to 62 and the arithmetic comment at 1929):

```ts
const BANNED_SINK_POSITIVES = [
  'el.innerHTML = body;', 'el.outerHTML += body;', 'el.innerHTML ||= body;',
  "el['innerHTML'] = body;", 'el.insertAdjacentHTML("beforeend", body);',
  'document.write(body);', 'el.setHTMLUnsafe(body);',
  'range.createContextualFragment(body);', 'return unsafeSVG(body);',
  'return unsafeStatic(body);',
];
check('fixture: every banned raw-HTML sink form is actually detected', () => {
  const missed = BANNED_SINK_POSITIVES.filter((f) => {
    const code = stripInertText(f, { strings: false });
    return !BANNED_SINKS.some(({ pattern }) => pattern.test(code));
  });
  if (missed.length > 0) throw new Error(`banned sink no longer detected: ${missed.join(' | ')}`);
});
```

---

## Nit / Optional

### C1 (Consider) — the amended criterion is the right *scope* stated in the wrong *vocabulary*

You asked whether you defined the problem down to fit the solution. **My answer is no, and
I have a measurement rather than an opinion.**

The test I applied: *can the amended criterion still fail the implementation that was built
to satisfy it?* If a criterion has been narrowed to fit its solution, it cannot. This one
can, and it does — **F1 is a failure of the amended criterion, not of the original one.**
The amended claim's first named item is "aliasing," at the two enumerated sinks, and I
produced an alias at an enumerated sink that both mechanisms miss. A criterion that is
still violable by the artifact it measures has not been defined down. That is the most
direct evidence available that the amendment was honest, and it is stronger than my
agreeing with your reasoning would be.

The reasoning is also correct on its own terms (**REASONED**): the original criterion
quantified over *all* mutations of a file that a committer controls, and that committer
also controls the guard. It was unsatisfiable by construction. Amending it was mandatory,
not convenient.

Where I do push back is the **vocabulary**, and this matters more than it sounds:

> "This guard defends against **innocent-looking regression**…"

"Innocent-looking" is a property of the author's *intent*, not of the *artifact*. It is not
decidable from a diff, which means it cannot adjudicate a future dispute — the only job an
exit criterion has. Concretely: is `const raw = unsafeHTML` (V3, in scope) innocent-looking?
Nobody writes that by accident either. The real, checkable boundary is not intent; it is
**what is visible in the scanned view**. Restate it in artifact terms:

> For the two enumerated sink files, any change that leaves a raw-HTML directive reachable
> **under a different name or through a different call shape**, where that change is
> **visible in the scanned source view** (comments and string literals blanked, templates
> and regex literals resolved), must turn the suite red. Changes that preserve every name
> and call shape while altering runtime **effect** — prototype patching, global
> reconfiguration, runtime-assembled references — are out of scope and routed to the Phase 2
> harness.

Same coverage. But it is decidable by reading a diff, it makes "rules can own a NAME, not
an EFFECT" the operative clause rather than a footnote, and — the point — **F1 is
unambiguously a violation under this wording**, whereas under "innocent-looking" someone
could argue that omitting semicolons is adversarial. Do not let the criterion be the thing
that lets F1 be argued away.

One small overclaim in the same vocabulary: the list ends "and capture of the sanitizer's
own configuration." R8 defends capture *by naming a module specifier the scanner can see*.
It does not defend capture via a bare specifier (R-bareSpecifier, disclosed) or by effect
(V25, disclosed). Qualify it.

**Verdict on the question you actually asked: the amended claim is worth stating, is not
too weak, and should be reworded from intent to artifact.**

### C2 (Consider) — the guard is over-built, but the answer is a split, not wholesale replacement by #204

You invited "this is over-built and #204 should replace it wholesale." I will not go that far,
and here is the line I would draw.

Measured shape (**BY EXECUTION**): 1971 lines total, 683 comment lines (34%). Split at the
mechanism boundary: the behavioural half (1–517) is 517 lines, 18% comment, ~35 checks; the
guard half (519–1943) is 1425 lines, **41% comment**.

- **The behavioural half is not over-built.** It is the highest value-per-line in the change:
  it pins the actual XSS boundary, needs no tokenizer, has no vacuity risk, and every check
  is a payload. Keep unconditionally.
- **R1 and R5** (`unsafeHTML(renderMarkdown(` present; the argument is that call and nothing
  else) are cheap, high-signal, and do not depend on the hand-rolled tokenizer. Keep.
- **Everything that depends on `stripInertText` / `stripImportStatements`** — R3, R4, R7,
  `directiveIndirectionOffenders`, `BANNED_SINKS` — is a hand-rolled JS/TS tokenizer plus a
  hand-rolled module resolver, i.e. a regex reimplementation of pieces of the TypeScript
  compiler. This is the part #204 subsumes exactly, the part with the non-converging defect
  rate (five rounds; F1 is round six), and the part the file itself says is "asking the wrong
  question."

The concrete move: **mark that subset for deletion in the file, conditional on #204 landing.**
Right now the docblock argues #204 is the correct technique but nothing schedules the removal
of what it replaces, and a 1425-line guard with no sunset clause becomes permanent. One
comment block naming the functions and rules that #204 retires costs nothing now and is the
difference between "interim scaffolding" and "the way we do it here."

I am not recommending removing any of it *in this branch*. F1 and F2 are cheap to fix and
the guard has demonstrably caught real bypasses. But do not let round 7 happen.

### C3 (Consider) — adding a third sink costs three red runs and three constant edits, and the last failure message is misleading

You asked what happens when someone adds a third sink component. **BY EXECUTION** — I added
a correct `src/components/inspector/ft-inspector-note.ts` with a properly sanitized sink and
ran the suite after each repair step (file removed and tree verified clean afterwards):

```
STEP 1 (new file, no test change)      exit=1, 2 of 61 failed:
  - expected to scan exactly 50 source files, found 51 …
  - expected exactly 2 unsafeHTML call sites, found 3 — update REQUIRED_SINKS deliberately …
STEP 2 (REQUIRED_SINKS + count fixed)  exit=1, 1 of 62 failed:
  - check total pinned: expected 61 checks to run, 62 did — a check was added or silently removed
STEP 3 (EXPECTED_CHECKS = 62)          exit=0, 62 checks passed
```

The first two messages are excellent — they name the action and the reason the pin exists.
The third is wrong for this scenario: no check was added or removed; the `REQUIRED_SINKS`
loop emitted one more. A developer hitting it after already editing `REQUIRED_SINKS` gets
told to look for a phantom edit. It also requires updating the prose arithmetic at line 1929
by hand, which is drift waiting to happen.

**Suggested fix** — put the arithmetic in code instead of a comment, which removes one of the
three edits and the drift risk entirely:

```ts
const EXPECTED_CHECK_CALL_SITES = 60; // grep -cE '^\s+check\('
const EXPECTED_CHECKS = EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1);
```

and extend the failure message with "…if you added or removed a REQUIRED_SINKS entry, update
`EXPECTED_CHECK_CALL_SITES` only if you also added a literal `check(` call."

### C4 (Consider) — `id` is not in `FORBID_ATTR`, and the diff's own argument for `class` covers it

**REASONED**, with **BY EXECUTION** confirmation that `id` survives:
`renderMarkdown('<div id="content">x</div>')` → `<div id="content">x</div>`.

`markdown.ts:31-37` justifies forbidding `class` because "both sinks inject this HTML inside
the Lit shadow root that carries the component's own stylesheet, so attacker-chosen class
names resolve against real component CSS." That argument is symmetric in `id`: an `#id` rule
in either component's stylesheet would be a forgery primitive on the same channel. Today it
is inert — I checked both components and their styles use only class and tag selectors, and
their `querySelector` calls target custom-element tag names (`sl-textarea`, `sl-details`)
which DOMPurify strips (**BY EXECUTION**: `<sl-details summary="x">hi</sl-details>` →
`<p>hi</p>`). So this is not a live issue, only an asymmetry between the stated rationale and
the list. Either add `id` (markdown never emits it; zero collateral, same as `class`) or add
one clause to the comment saying why `id` was deliberately left in.

---

## FYI

**FYI-1 — the three `markdown.ts` claims you asked me to check.**

| claim | verdict |
|---|---|
| "A private `Marked` instance keeps this off the shared `marked` singleton" (`markdown.ts:56`) | **TRUE, and stronger than stated** |
| "role/aria-label … both survive `FORBID_ATTR`" / output is inert (`markdown.ts:47-54`) | **TRUE** |
| U+FE0E rationale (`markdown.ts:48-53`) | **TRUE for U+2611; inapplicable to U+2610** |

*Private instance* — **BY EXECUTION**, both directions:

```
singleton BEFORE importing markdown.js: "<ul>\n<li><input checked=\"\" disabled=\"\" type=\"checkbox\"> done</li>…"
singleton AFTER  importing markdown.js: "<ul>\n<li><input checked=\"\" disabled=\"\" type=\"checkbox\"> done</li>…"   (identical)
a brand-new Marked() instance:          "<ul>\n<li><input checked=\"\" disabled=\"\" type=\"checkbox\"> done</li>…"   (identical)
after marked.use({renderer:{checkbox:…}}) on the singleton, renderMarkdown still says:
  "<ul>\n<li><span role=\"img\" aria-label=\"Completed\">☑︎</span> done</li>…"
```

Confirmed against `marked@15.0.12` source: `Marked` declares `defaults = _getDefaults()` as
an instance field (`marked.cjs:1895`), `_getDefaults()` returns a fresh object literal
(`:56-69`), `use()` mutates only `this.defaults` (`:1948-2024`), and the renderer is built
from `this.defaults.renderer || new _Renderer(this.defaults)` (`:2005`). The isolation is
mutual — the comment only claims outbound, and inbound also holds. No leak path on any
consumer.

*Checkbox inertness* — **BY EXECUTION**, post-sanitize DOM walk of the task-list output:

```
el UL
el LI
el SPAN role=img aria-label=Completed
el LI
el SPAN role=img aria-label=Not completed
```

`span` is in DOMPurify's default allowlist; `role` and `aria-label` are allowed and are in
neither `FORBID_ATTR` nor `FORBID_TAGS`; nothing else survives; no event handlers. Renderer
signature verified against `marked.cjs:1543` (`checkbox({ checked })`), so the destructuring
in `markdown.ts:59` matches the installed major — this would have silently rendered every
item unchecked on a signature mismatch, and it does not.

*U+FE0E* — **BY EXECUTION** against Node 20 / ICU Unicode data:

```
U+2611 BALLOT BOX WITH CHECK  Emoji=true   Emoji_Presentation=false  Ext_Pictographic=true
U+2610 BALLOT BOX             Emoji=false  Emoji_Presentation=false  Ext_Pictographic=false
U+FE0E                        Default_Ignorable=true  Variation_Selector=true
span codepoints after sanitize+serialise: U+2611 U+FE0E
```

So: the rationale is **correct for U+2611** — it is `Emoji=Yes, Emoji_Presentation=No`, which
is exactly the class of character that vendors widely render in colour despite the default,
and VS-15 is the standard remedy. It is **inapplicable to U+2610**, which is not an emoji
character at all; `U+2610 U+FE0E` is not a defined variation sequence and the selector is a
default-ignorable no-op there. The comment says "the two glyphs render consistently," which
reads as though both need it; only one does. Harmless, but it is the "true for one, stated
for all" pattern you asked me to watch for. Separately, "(or as tofu on font stacks that lack
it)" is loose — VS-15 cannot conjure a missing glyph; it can only steer font selection toward
the text face. Suggest: "U+2611 is `Emoji=Yes, Emoji_Presentation=No`, so vendors often render
it in colour beside the plain outline of U+2610; VS-15 pins it to text presentation. It is
inert on U+2610, which is not an emoji character, and is written on both for symmetry."
The escape-not-literal justification is correct and good practice.

**FYI-2 — `web/tsconfig.test.json` and `web/package.json`.** Both correct.

- `tsconfig.test.json:7` adds `"src/util/markdown.test.ts"` to `include`. Correct and minimal;
  `tsc` pulls in `src/util/markdown.ts` transitively (**BY EXECUTION**: `.tmp-test/util/`
  contains both `markdown.js` and `markdown.test.js`). Note for the record that this config
  does **not** typecheck the two sink components — they are covered by `npm run build` /
  `npm run typecheck`, which I ran clean. Nothing guards against a future test file being
  written and forgotten out of this list, but that is pre-existing and out of the delta.
- `package.json` adds `jsdom@^26.1.0` and `@types/jsdom@^28.0.3` as **devDependencies** and
  chains the new runner onto `test`. The version skew is deliberate and the reasoning at
  `markdown.test.ts:13-20` is sound (DefinitelyTyped has no 22–26 major).
- **BY EXECUTION**, the lockfile diff is a pure addition — zero removed lines — of 46
  packages, and **all 46 carry `"dev": true`**. The production dependency closure is
  unchanged; `marked@15.0.12` and `dompurify@3.4.12` were already present on the base and
  were not bumped by this branch. No production supply-chain delta.

**FYI-3 — one qualification on the disclosed acceptances.** I agree with accepting all five,
including V25, and with routing effect-observation to Phase 2. The wording I would tighten is
at `markdown.test.ts:1382`: *"the suite stays green at 61/61."* That number is now load-bearing
in three places and will drift the moment F2's fixture or a third sink lands. Say "the suite
stays green" and drop the count; the count belongs only next to `EXPECTED_CHECKS`.

**FYI-4 — smaller things I checked and found clean.** `callArguments` paren-balancing is
correct over the strings-blanked view (**REASONED**, plus V6/V6b/V6c fixtures cover it).
`stripInertText`'s regex-literal tracking is correct for the V7/V7b cases and correctly
resolves `//` and `/*` before considering a regex. `resolveRelativeImport` re-derives the
extension rather than trusting `.js`, which is right for TS-source imports. R7 runs over
`code` rather than `outside`, which is deliberate and correct (V8b depends on it) — the only
residue is that template-literal bodies are preserved, so a future `css`/`html` template
containing a `\u` or `\x` escape in one of the two sink files would false-positive; not
present today. `stripIgnoredLines` is correctly *not* honoured by mechanisms (a) and (c), and
the `OPT-OUT HONOURED` fixture pins that.

---

## Positive Feedback

Specific and earned, not manufactured:

- **`markdown.ts` is genuinely good production code.** 71 lines, no branching, one exported
  function, and every non-obvious decision carries a comment that states *why* rather than
  *what*. The `<svg><style>` reasoning at lines 18–25 — that DOMPurify allows `style` in the
  SVG namespace and that this outranks the inline `style` attribute already forbidden below —
  is the kind of finding that only comes from reading the sanitizer's namespace handling
  rather than its README, and the "markdown never emits `<style>`, so there is no collateral"
  clause is exactly the collateral check that usually gets skipped.
- **The `<dialog>` rationale** (lines 12–16) is the best comment in the change: it correctly
  identifies that the HTML Standard's default rendering hands an attacker
  `position: absolute` + opaque `background-color: Canvas` with no `style` attribute at all,
  which is precisely the thing forbidding `style` is meant to deny. That is a real, non-obvious
  overlay primitive.
- **The checkbox renderer is the right call.** `FORBID_TAGS` would have made `- [x] done` and
  `- [ ] todo` indistinguishable — a silent correctness regression in ordinary content, caused
  by a security fix. Substituting an inert glyph that keeps the state *and* keeps it announced
  to assistive technology, rather than dropping the feature, is the disciplined answer.
- **Section 4, `ordinaryMarkdown()`.** A sanitizer that breaks normal rendering is its own
  outage, and pinning the exact output of headings, lists and code blocks is what makes future
  `FORBID_*` edits safe to make.
- **The check-total pin works and is worth its cost.** I verified it catches a deleted check
  (M4). Given that this suite's whole failure mode is "a rule stops running," this is the right
  primitive.
- **Costly disclosure, repeatedly.** `markdown.test.ts:124-130` ("both `FORBID_ATTR` entries
  can be deleted with this suite fully green — they are deliberate defence in depth and are
  not testable in isolation"), 1571–1573 (the vacuous static-html control), 1840–1845 (R8 is
  vacuous on the tree) and the V25 disclosure all make the author's own work look worse and are
  the reason this review could be targeted rather than exploratory. F2 is an instance of a
  defect class the author *documented* and then missed in one place — which is a much better
  position to be in than not having named the class at all.

---

## Test Coverage

Behavioural coverage of `markdown.ts` is strong: every `FORBID_TAGS` entry, every
`FORBID_ATTR` entry that is reachable through `renderMarkdown`, both checkbox states, nesting,
and the positive-rendering shapes. The two `FORBID_ATTR` entries that are unreachable
(`formaction`, `action`) are explicitly labelled as untestable-in-isolation rather than
quietly claimed as covered — correct handling.

Gaps, both filed above: **F2** (the eight `BANNED_SINKS` patterns have no positive detection
test at all) and **F1** (no fixture covers a semicolon-less import, which is why the sweep
survived five rounds).

One residual worth stating plainly, already routed and not a finding: nothing in this suite
observes the sanitizer's *effect* after loading the sink modules, so V23/V25 remain open until
the Phase 2 harness. Everything here is either a direct call to `renderMarkdown` or a static
read of source text.

---

## Backward Compatibility

No wire-format changes, no proto changes, no Go changes (`go build ./...` and `go test ./...`
both exit 0). The only user-visible behaviour changes are in rendered markdown, and all are
intentional hardening: `class` is stripped from rendered output (marked's `language-*` on code
blocks is the only real-world loser; verified no consumer — no syntax highlighter in the repo),
`<dialog>` and `<style>` are stripped, and task-list checkboxes render as a glyph rather than a
disabled `<input>`. No new production dependency and no production dependency bump.

---

## Final Verdict

**REQUEST CHANGES**

Blocking: **F1** and **F2**. Both are in `web/src/util/markdown.test.ts`, both have validated
fixes above, and together they are perhaps 30 lines plus two fixture entries plus an
`EXPECTED_CHECKS` bump.

The production sanitizer itself — the thing a defect in which would be a live XSS on a real
origin — I would approve as-is. The blockers are entirely in the guard, and F1 in particular
means the round-5 claim that mechanism (a) is *sound over bindings* is not currently true as
written.

C1–C4 are non-blocking and should be forwarded to a cleanup pass. C1 (reword the criterion
from intent to artifact) and C2 (mark the tokenizer-dependent rules for sunset on #204) are
the two I would most want not to be dropped.

---

### Method disclosures (standing bar 7)

- The brief names the clone as `/workspace/farmtable-review-195`; no such path exists. I
  verified `/workspace` itself is at `53296af` on `markdown-sanitize` and clean, and reviewed
  there. If the intent was a separate clone, my SHA is still the one the brief specifies.
- My first mutation run reported `RESTORE FAILED` because I had left a scratch `web/.probe/`
  directory inside the repo. The restore had in fact succeeded; my cleanliness assertion was
  correct and my scratch hygiene was not. I moved all probes under `web/node_modules/.probe`
  (gitignored) and re-ran the control from a verified-clean tree before trusting any result.
- My first attempt at the R4-semicolon experiment mutated `SOUND_SINK_FILE` in a way that also
  broke two `SINK_EVASIONS` anchors, so the run was red for the wrong reason and would have
  supported the opposite conclusion. The driver's uniqueness check caught a related
  ambiguous-anchor case and aborted. I discarded that attempt and re-derived the result by
  driving the guard's predicates directly, which is the evidence quoted in F1. A prose-only
  version of that first attempt would have been a confident false negative.
- I did not run `go test ./... -tags integration` (no live Postgres, and zero Go delta).
- I did not read the other two legs' reports and did not coordinate with them.

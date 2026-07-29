# TEST REVIEW — farmtable #195 `markdown-sanitize`, round 5

**SHA reviewed:** `53296af`
**Leg:** test review (independent; other legs' reports not read)
**Verdict:** **REQUEST CHANGES**

One finding (T1) is a plausible, accidental-looking regression that leaves a
production sink rendering attacker markup completely raw with `npm test` green
at 61/61 **and** `tsc --noEmit` clean. It sits on two of the seven axes the
amended claim explicitly enumerates. It is runtime-verified, not reasoned.

> **Note on paths.** The brief names the clone `/workspace/farmtable-test-195`;
> that directory does not exist. `/workspace` itself is the clone, at `53296af`,
> clean. All work below was done there and the tree was returned byte-identical.

---

## Method and its self-checks

Everything below labelled BY EXECUTION was run. Harness, vectors and raw output
are salvaged as **files** at
`/scion-volumes/scratchpad/projects/farmtable/salvage/test-195-r5/`:

| file | what |
|---|---|
| `mutdrv.py` | mutation/ablation driver |
| `probe-under-mutation.py` | apply one mutation, run an arbitrary command, restore |
| `probe-sanitizer.mjs` | runtime probe of the compiled sanitizer under jsdom |
| `vectors-*.json` | 5 vector sets, 74 vectors total |
| `run-*.txt`, `run-*.txt.d/` | per-vector full output |
| `baseline.txt`, `probe-baseline.txt` | unmutated baselines |
| `pristine-backup/` | pre-run copies of all four files touched |

Bars from the shared brief, and how each was met:

- **Bar 5, content-addressed only.** Every step names an `anchor` string.
  `mutdrv.py` counts occurrences and **aborts the vector** if the count is not
  exactly 1. No line numbers anywhere.
- **Bar 6, back up outside the repo, positively assert the restore.** Backups in
  `/tmp/r5bak` (copied to salvage). After every vector the driver asserts *both*
  `git status --porcelain` empty *and* that the sha256 of each touched file
  equals its pristine sha256.
- **Bar 4, "clean" is not "unchanged".** The tree was already at HEAD and clean
  before the first run, so there was no uncommitted work to lose. The sha256
  check exists precisely because the porcelain check is blind to it.
- **Bar 3, a harness that cannot express an input cannot test it.** `mutdrv.py`
  **fails closed**: before running any vector it applies a deliberate breakage
  (`EXPECTED_CHECKS 61 -> 62`), and `sys.exit`s if that tree still returns 0.
  Every run below begins `[self-check] deliberately-broken tree -> exit 1 OK`.
  For the one *negative* multi-step claim I make (T2), I ran a positive control
  proving the harness can express the detection — see T2.
- **Real exit codes.** `subprocess.run(capture_output=True)`; the child's own
  status, never a pipeline's.

The driver also validated itself the hard way: mid-run it aborted with
`FATAL: git status --porcelain not empty after restore: ?? web/.r5probe.mjs` —
my own scratch file. It refused to produce results from a tree it could not
account for. That is the behaviour bar 4 asks for.

**Baseline** (BY EXECUTION):

```
$ npm test ; echo "EXIT=$?"
> tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js
markdown sanitizer: 61 checks passed
EXIT=0
```

Final state after all 74 vectors: `git status --porcelain` empty, and

```
8015903827ec…  src/util/markdown.test.ts        == markdown.test.ts.orig
413d0d5418e0…  src/util/markdown.ts             == markdown.ts.orig
050fb42ba5e8…  ft-inspector-desc.ts             == desc.orig
493f2fb13dc6…  ft-inspector-comments.ts         == comments.orig
markdown sanitizer: 61 checks passed
```

---

## Findings

### T1 — HIGH — `renderMarkdown`'s arity is unconstrained by R5 and unreachable by any test

`web/src/util/markdown.test.ts:965` (`sinkArgumentIsSanitized`),
`web/src/util/markdown.ts:66` (`renderMarkdown` signature),
`web/src/util/markdown.test.ts:94-517` (every behavioural check).

**BY EXECUTION.** `sinkArgumentIsSanitized` asserts the `unsafeHTML` argument is
"a single `renderMarkdown(…)` call and NOTHING else" — but it only counts
parentheses. It places **no constraint on what is between them**, so
`renderMarkdown(this.description)` and
`renderMarkdown(this.description, { inline: true })` are indistinguishable to
it. Separately, all 40-odd behavioural checks call `renderMarkdown` with exactly
one argument, so **no fixture in the suite can express a two-argument call.**

Together those two facts admit an ordinary-looking feature addition — "render
inline markdown for one-line fields" — that reopens the whole bug class:

```ts
// web/src/util/markdown.ts
export function renderMarkdown(md: string, opts: { inline?: boolean } = {}): string {
  // Inline fields are one-liners; marked's inline lexer emits no block-level
  // HTML, so the output is already safe.   <-- plausible, and wrong.
  if (opts.inline) return parser.parseInline(md) as string;
  return DOMPurify.sanitize(parser.parse(md) as string, { FORBID_TAGS, FORBID_ATTR });
}

// web/src/components/inspector/ft-inspector-desc.ts:233
${unsafeHTML(renderMarkdown(this.description, { inline: true }))}
```

Result (`vectors-r5-hunt.json` → `G3-arity-inline`):

```
G3-arity-inline   exit=0  green  expect=red  !! MISMATCH   markdown sanitizer: 61 checks passed
```

Runtime-verified through the compiled sanitizer under the suite's own jsdom
bootstrap — this is the effect, not an inference:

```
### mutation applied: G3-arity-inline
--- arity: the input domain no fixture supplies ---
safe  renderMarkdown(XSS)                    [1 arg, the only shape tested]
        "<p><img src=\"x\"></p>\n"
RAW   renderMarkdown(XSS, { inline: true })  [2 args, unreachable by any fixture]
        "<img src=x onerror=alert(1)><script>alert(2)</script>"
### child exit = 0
```

It also survives the *other* automated gate — `npm run build` runs
`tsc --noEmit`:

```
### mutation applied: G3-arity-inline
### child exit = 0        # tsc --noEmit
```

The isolating control `G3b-arity-sink-only` (extra argument at the sink,
`markdown.ts` otherwise untouched) is also green, which pins the guard half of
the defect independently of the `markdown.ts` half.

**Why this is in scope, not a scope quibble.** The amended claim enumerates
seven axes. This lands on two of them:

- *argument-shape drift* — the shape of the sink's argument changed and R5 said
  nothing;
- *capture of the sanitizer's own configuration* — a second parameter **is** a
  configuration channel into the sanitizer, opened from the sink file. R8 was
  built to deny other files the ability to reconfigure DOMPurify by taking away
  the module specifier. An options parameter reconfigures it through the front
  door, and R8 has nothing to match.

**Why five rounds missed it.** Every one of V1–V25 mutates a *binding*, a *call
site spelling*, or a *module specifier*. Not one changes an **arity**. This is
the exact blindness the standing bar predicts: mutation testing proves your
tests are bound to your code, and a fixture that cannot express a two-argument
call cannot be mutated into failing on one. The defect was reachable only by
asking "what inputs can these tests not express?", not by asking "what mutation
survives?".

**Suggested fixes** (both cheap; developer's call):

1. In `markdown.ts`, make the signature un-extendable by accident — or at
   minimum give the behavioural suite a check that pins the arity, e.g.
   `assertEqual(String(renderMarkdown.length), '1', …)`. A `.length` pin is a
   one-line check that turns any new parameter red.
2. In `sinkArgumentIsSanitized`, require the inner call to contain no top-level
   comma. That closes the sink half without an enumeration treadmill.

---

### T2 — MEDIUM — an unterminated `<!--` inside a lit template blinds the tree-wide scan to end of file

`web/src/util/markdown.test.ts:827-833`.

```ts
if (c === '<' && src.startsWith('<!--', i)) {
  const end = src.indexOf('-->', i + 4);
  const to = end === -1 ? src.length : end + 3;   // <-- blanks to EOF
  blank(i, to);
```

**BY EXECUTION.** In a non-sink scanned component, an unterminated `<!--` inside
a template literal blanks everything after it from every view the guard uses, so
R8, R9, the indirection tripwire and `BANNED_SINKS` all see spaces:

```
G1-htmlcomment-blind      exit=0  green  expect=red  !! MISMATCH   markdown sanitizer: 61 checks passed
```

**Positive control — this is the bar-3 self-check, and it passed.** The *same*
`el.innerHTML = body` write with the comment removed is caught:

```
G1b-htmlcomment-control   exit=1  red  expect=red  OK
  - tripwire: no listed raw-HTML sink other than unsafeHTML is present:
    raw-HTML sink outside renderMarkdown in: src/components/inspector/inspector-shared-styles.ts
    (innerHTML/outerHTML assignment)
```

and a *position* control — byte-identical write, moved to **before** the
comment — is also caught:

```
### mutation applied: G1c-write-before-comment
  - tripwire: no listed raw-HTML sink other than unsafeHTML is present: … (innerHTML/outerHTML assignment)
### child exit = 1
```

So the detection is expressible and it is the comment's blanking span that
suppresses it. This is a blind spot, not an inexpressible input. `tsc --noEmit`
is also clean under it (exit 0).

**Why this is worse than V14** (the unterminated `/*`, already in the table): an
unterminated block comment is a TypeScript syntax error, so `tsc` catches it. An
unterminated `<!--` inside a template literal is *valid TypeScript* and compiles
clean. There is no second gate.

Honest rating: creating the blind spot is accidental (commenting out part of a
lit template is routine); *weaponising* it needs deliberateness, because a
browser would also swallow the rest of the template unless the closing `-->` is
smuggled in via interpolation, as my vector does. I rate it MEDIUM on that
basis, not HIGH. Fix is one line: treat an unterminated `<!--` as a violation
rather than as a blanking instruction, the same way an unterminated regex
literal already returns `-1`.

---

### T3 — MEDIUM — the ignore-line marker disarms the *only* rule protecting 48 of the 50 scanned files

`web/src/util/markdown.test.ts:889-906` (`IGNORE_MARKER`, `stripIgnoredLines`).

**BY EXECUTION.** The docblock's reasoning is that the marker is safe because it
is "deliberately NOT honoured by the per-file rules in `sinkBindingViolations`",
so "disarming the sound half must require editing this test file". That
reasoning holds for the two `REQUIRED_SINKS` files. Mechanism (a) does not run
on the other 48 scanned files at all, so for them the tripwire **is** the whole
guard — and the tripwire honours the marker:

```
G2-ignore-launder   exit=0  green  expect=red  !! MISMATCH   markdown sanitizer: 61 checks passed
```

```ts
// inspector-shared-styles.ts  (scanned, not a REQUIRED_SINK)
import { unsafeHTML } from 'lit/directives/unsafe-html.js'; // raw-sink-scan: ignore-line
export const rawHtml = unsafeHTML;                          // raw-sink-scan: ignore-line

// ft-inspector-desc.ts  (a REQUIRED_SINK — every rule R1–R9 still passes)
import { iconButtonFocusStyles, rawHtml } from './inspector-shared-styles.js';
…
${unsafeHTML(renderMarkdown(this.description))}<div>${rawHtml(this.description)}</div>
```

R6 is satisfied because `./inspector-shared-styles.js` **does** resolve into the
scanned set — the laundering file is scanned, it is simply not *sounded*.
`tsc --noEmit` clean (exit 0).

This is the disclosed V7 vector moved one file to the left. V7 put the marker
inside a `REQUIRED_SINKS` file, where mechanism (a) caught it; the prior art
concluded the marker was contained. That conclusion is scoped to two files and
the docblock does not say so.

Rating MEDIUM, not HIGH: it needs a developer to type a documented opt-out
marker twice, so it is not the accidental mutation the charge asked for. But the
marker's stated safety argument is wrong as written, and "grep for the marker in
review" is a review-dependent control being counted as a mechanical one.

**BY REASONING (labelled):** the final rendering step — that
`rawHtml(this.description)` injects raw HTML into the shadow root — is not
runtime-verified here, because it needs the two Lit components instantiated,
which is the Phase 2 harness. It is true by construction (`rawHtml` *is*
`unsafeHTML`), but I am not claiming execution for it.

---

### T4 — MEDIUM — the 61-check pin is not vacuous, but 7 of its checks can be deleted with the suite green

**BY EXECUTION**, `vectors-ablation.json` (19 ablations) +
`vectors-redundancy.json` (18 paired mutation×ablation cases). Each ablation
neuters exactly one rule and runs the full suite.

```
ABL-R1                exit=0  green   !! MISMATCH
ABL-R2                exit=1  red     OK   - fixture: every known sink-binding evasion is caught: … V1c
ABL-R3                exit=0  green   !! MISMATCH
ABL-R4                exit=1  red     OK   - fixture: … V1d
ABL-R5                exit=1  red     OK   - fixture: … V6 | V6b
ABL-R6                exit=1  red     OK   - fixture: … V9
ABL-R6b               exit=1  red     OK   - fixture: … V9b
ABL-R7                exit=1  red     OK   - fixture: … V8
ABL-R8                exit=1  red     OK   - fixture: sanitizer ownership … import DOMPurify from 'dompurify';
ABL-R9                exit=1  red     OK   - fixture: sanitizer ownership … LAUNDERED: …
ABL-TREE-filecount    exit=0  green   !! MISMATCH
ABL-TREE-sinkcount    exit=0  green   !! MISMATCH
ABL-TREE-tripwire     exit=1  red     OK   - fixture: every known indirection form is caught …
ABL-TREE-banned       exit=0  green   !! MISMATCH
ABL-TREE-argcheck     exit=0  green   !! MISMATCH
ABL-STRIP-regex       exit=1  red     OK   - fixture: … V7
ABL-STRIP-strings     exit=0  green   !! MISMATCH
ABL-STRIP-comments    exit=1  red     OK   - fixture: comments and marked lines cannot turn the suite red
ABL-IGNORE            exit=1  red     OK   - fixture: comments and marked lines cannot turn the suite red
ABL-IMPORTSTRIP       exit=1  red     OK   - ft-inspector-comments.ts binds its markdown sink to the sanitizer
```

**First, credit where it is due, and it is a lot.** R2, R4, R5, R6, R6b, R7, R8,
R9, the indirection tripwire, regex tracking, comment stripping and the ignore
marker are all **individually detectable on deletion** — and every single red
above is raised by a `fixture:` check with a *specific named vector*, never by
the tree. The fixture tables have genuine per-rule discriminating power. The
R8 fixture the dev added for exactly this reason works. That answers the charge's
premise: **R9 does not have R8's problem** — `ABL-R9` is red, caught by the
`LAUNDERED:` entries. The tables are the reason nine rules are not decoration.

**Second, the gap.** Seven checks are deletable with the suite green. Pairing
each with the mutation it exists for separates two very different reasons:

| check | deletion detected? | unique coverage? | verdict |
|---|---|---|---|
| **R1** (required sink literal) | no | **no** | dead weight |
| **R3** (local re-bind) | no | **no** | dead weight (disclosed) |
| **tree arg-check** (`markdown.test.ts:1536`) | no | **no** | dead weight |
| file-count pin (`:1441`) | no | yes | live, unfixtured |
| sink-count pin (`:1508`) | no | yes | live, unfixtured |
| `BANNED_SINKS` tripwire (`:1549`) | no | yes | live, unfixtured |
| string blanking (`:865`) | no | yes | live, unfixtured |

Evidence for "no unique coverage":

```
MX-sinkgone                  red    (R1 and the sink-count pin both fire)
MX-sinkgone+R1               red    (sink-count still fires)
MX-sinkgone+SINKCOUNT        red    (R1 still fires)
MX-sinkgone+R1+SINKCOUNT     green  !! MISMATCH   <- neither is individually load-bearing
MX-shadow+R3                 red    (R4 catches it)  <- R3 redundant, as documented
MX-concat+R5                 red    (tree arg-check catches it)
MX-concat+ARGCHECK           red    (R5 catches it)
MX-concat+R5+ARGCHECK        red    (the SINK_EVASIONS fixture still catches it)
```

R1 and the tree-wide arg check are therefore fully subsumed. R3's redundancy is
already documented at `markdown.test.ts:1111` and I confirm it.

Evidence for "live, unfixtured" — each of these is the *only* thing standing
between the tree and a real regression, and deleting it is silent:

```
MX-innerhtml                        red   - tripwire: no listed raw-HTML sink other than unsafeHTML is present
MX-innerhtml+BANNED                 green !! MISMATCH
MX-newfile                          red   - sink scan actually reads the source tree: … found 51
MX-newfile+FILECOUNT                green !! MISMATCH
MX-newsink-existing-file            red   - unsafeHTML call sites are still found: … found 3
MX-newsink-existing-file+SINKCOUNT  green !! MISMATCH
MX-prosestring+STRINGS              red   - ft-inspector-desc.ts binds its markdown sink to the sanitizer
```

The last one is worth naming: `opts.strings` blanking is what stops
`export const MSG = 'always call renderMarkdown before unsafeHTML';` in a sink
file from failing R3/R4. It is genuinely protective — ablating it turns that
case red — and **nothing in the suite exercises it**, because neither production
sink nor `SOUND_SINK_FILE` contains a string literal naming either identifier.

**Recommendation.** Not "delete the redundant rules" — defence in depth is fine.
But the docblock at `markdown.test.ts:1576` claims the fixture tables mean
"a future simplification of the rules cannot quietly reopen one." That claim is
true for the nine closed-world rules and **false for the four tree-wide checks
and string blanking.** Either narrow the claim, or give the tree-wide checks the
same treatment R8 got: a small table (`{ file-count changed, extra sink, banned
pattern present, string naming the identifier }`) asserted against the
predicates directly. It is the same two-line-per-entry pattern already in the
file, and it would move 4 checks from "decoration on a clean tree" to "pinned".

---

### T5 — LOW (costly disclosure: this corrects a documented claim, in the dev's favour on one count and against on the other)

`web/src/util/markdown.test.ts:124-130`:

> `formaction` is only valid on `<button>`/`<input>` and `action` only on
> `<form>` … **Both FORBID_ATTR entries can therefore be deleted with this suite
> fully green — they are … not testable in isolation through renderMarkdown.**

**BY EXECUTION**, mutating `FORBID_ATTR` to drop both:

```
### mutation applied: CFG-attr-drop-formaction-and-action
gone  <a href="#" formaction="https://evil.example">x</a>
        "<p><a href=\"#\">x</a></p>\n"
KEPT  <a href="#" action="https://evil.example">x</a>
        "<p><a href=\"#\" action=\"https://evil.example\">x</a></p>\n"
gone  <img src="x" formaction="https://evil.example">
        "<img src=\"x\">"
KEPT  <div action="https://evil.example">x</div>
        "<div action=\"https://evil.example\">x</div>"
```

The "green when deleted" half is confirmed
(`CFG-attr-drop-formaction` and `CFG-attr-drop-action` both `exit=0 green`). The
*reason* given is half wrong: DOMPurify applies `ALLOWED_ATTR` per-attribute,
not per-tag-and-attribute, and `action` is in its default allowlist. So `action`
**is** testable in isolation on any surviving element, and a one-line check
would pin it. `formaction` genuinely is not — it is stripped by DOMPurify's
defaults regardless — so for that entry the disclosure is exactly right.

Security impact of a surviving `action` on a non-`<form>` element is nil today;
the value of pinning it is that `FORBID_ATTR`'s stated design property —
"Both the tag and the attribute are forbidden so that neither rule is
load-bearing on its own" (`markdown.ts:9-10`) — currently has no test on the
attribute side.

**Everything else in the sanitizer config is well covered.** All 8 `FORBID_TAGS`
entries and 3 of 5 `FORBID_ATTR` entries are individually pinned:

```
CFG-tag-drop-form/input/button/select/textarea/option/dialog/style   all red  OK
CFG-attr-drop-style / class / download                               all red  OK
CFG-checkbox-default                                                 red      OK
CFG-no-sanitize / CFG-config-dropped / CFG-attr-empty / CFG-tags-empty  red   OK
```

For a 71-line module that is a live XSS boundary, that is a genuinely good
result and I want it on the record alongside the gaps.

---

### T6 — LOW — the "private `Marked` instance" is a stated security property with no test

`web/src/util/markdown.ts:56-57` — *"A private Marked instance keeps this off
the shared `marked` singleton."*

**BY EXECUTION** (`CFG-shared-marked`): replacing the private instance with a
shared/global one leaves the suite green at 61/61. R8 does contain the hazard
statically (no other scanned file may name `'marked'`), so this is not live —
but a documented security decision inside the module with zero behavioural or
structural pin is the same class of thing R8's fixture was added to fix.

---

### T7 — LOW — `renderMarkdown` throws on non-string input; no test, and both call sites can deliver it

**BY EXECUTION** (`probe-baseline.txt`):

```
THROW undefined -> Error: marked(): input parameter is undefined or null
THROW null      -> Error: marked(): input parameter is undefined or null
THROW number    -> Error: marked(): input parameter is of type [object Number], string expected
```

Both sinks pass values that arrive over gRPC (`c.body`, `this.description`). A
throw inside `render()` takes down the whole Lit component, not one comment.
This is availability, not XSS, and it is a one-line guard plus a one-line test.
Zero cardinality on the input domain is untested — the suite tests `''` but
never absent.

---

## Answers to the four other charges, stated directly

**Charge 2 — is the 61-check pin vacuous?** No, but it is inflated by 3.
R1, R3 and the tree-wide argument check have no unique coverage anywhere in the
tree or the fixtures (T4). Four more — file count, sink count, `BANNED_SINKS`,
string blanking — do have unique coverage but their deletion is undetectable.
**R9 specifically does not have R8's problem**: `ABL-R9` is red, caught by the
`LAUNDERED:` fixtures. The R8 fixture works and generalised correctly to R9.

**Charge 3 — do FP1–FP6 actually control?** Yes for the three I could
over-broaden, and they are each *doubly* covered. BY EXECUTION:

```
OB1-asrule-dropname   red  - fixture: legitimate source does not trip the raw-directive tripwire
OB3-reexport-dropname red  - fixture: legitimate source does not trip the raw-directive tripwire
OB5-innerHTML-eq      red  - fixture: legitimate source does not trip the raw-directive tripwire
OB6-htmlcomment-strip red  - fixture: comments and marked lines cannot turn the suite red
FP1                   green expect=green  OK
FP1xOB1               red   - tripwire: … src/components/inspector/ft-inspector-desc.ts
FP3xOB3               red   - tripwire: … src/components/inspector/ft-inspector-desc.ts
FP5xOB5               red   - tripwire: … src/components/inspector/ft-inspector-desc.ts
```

Read the `OB*`-alone rows carefully: the over-broadenings are **already caught
by the in-file `LEGITIMATE_SOURCE` / `INERT_PROSE` tables**, which run on every
`npm test`. FP2 and FP4 likewise (`ABL-STRIP-comments`, `ABL-IGNORE` both red
via `INERT_PROSE`). So the six FP* vectors in `dev-195-vectors.json` do control —
`FP1xOB1` etc. prove they go red when the rule breaks — but they are *redundant*
with live in-suite fixtures. That is the right direction to be redundant in. No
FP control is asserting nothing.

I did get one prediction wrong and it is worth recording: I expected
`MX-prosestring` (a plain string literal naming both identifiers in a sink file,
**without** the marker) to be green. It is red, via the tree-wide tripwire —
correctly, since that scan runs with `strings: false` and the documented remedy
is the opt-out marker. My model of the two views was wrong, not the guard's.

**Charge 4 — are the sanitizer's own tests adequate?** Mostly yes, and better
than I expected going in (see T5's coverage table: 11 of 13 config entries
individually pinned, plus mXSS, SVG `<style>`, `foreignObject`, animation
elements and `xlink:href`). The gaps are T1 (arity — the serious one), T5
(`action`), T6 (private `Marked`) and T7 (non-string input).

**Charge 5 — input-domain variation.** The cardinality axis the charge names is
where T1 came from, and it generalises: for `renderMarkdown` the collection is
**the argument list**, and the suite tests cardinality *one* and nothing else —
not zero (T7), not **two** (T1), not conflicting. Everything else I varied came
back clean and I am recording the negatives so nobody re-runs them:
attribute-name case (`STYLE=`, `CLASS=`, `DOWNLOAD=`) all stripped; `class` and
`style` stripped in the SVG namespace too; `<template>` content dropped; entity-
and whitespace-obfuscated `javascript:` URLs stripped; reference-style links
handled. Two curiosities, neither a defect: `<img srcset>` survives (same
attacker-origin fetch that `<img src>` already permits by design, so it is
consistent — but undiscussed), and an attacker can type `☑︎` directly into
markdown to render a checkbox indistinguishable from a real completed one.

---

## On the amended claim itself

The brief asks whether the criterion was defined down to fit the solution. My
answer is **no — and T1 is the evidence.**

A criterion defined down to fit its solution is one nothing can fail. This one
names seven axes, and I found a survivor on two of them (T1: argument-shape
drift, configuration capture) plus one on the laundering axis (T3). The amended
claim is falsifiable, it was falsified this round, and it was falsified *on its
own terms* rather than by re-litigating the scope. That is what a real exit
criterion looks like. Dropping the unnamed adversary was correct: the original
wording was unsatisfiable, and pretending otherwise is what kept three rounds of
evadable checks in the file.

One caveat on the boundary statement. "Rules of this kind can own a NAME; they
cannot own an EFFECT" is right, and it is the correct reason to accept V25. But
T1 shows the boundary is drawn slightly too generously: R5 does not fail to own
an *effect* there, it fails to own a *shape* it explicitly claims to own —
`sinkArgumentIsSanitized`'s own docstring says "the argument has to be the call
and only the call", and an argument list is part of the call. That is inside the
technique's stated reach, not beyond it.

**I do not challenge any of the five disclosed survivors.** V25 and the three
runtime-construction vectors are correctly accepted for the stated reasons, and
the "do not fix by banning `.prototype` assignment" note is right — the
equivalents genuinely are unbounded. R-bareSpecifier is correctly scoped and
correctly marked not-live. Routing effect-observation to the Phase 2 harness
with V23/V25 as acceptance vectors is the right call. I would add T1's
two-argument case to that harness's acceptance vectors, because a component
harness that loads the sinks and re-asserts the sanitizer catches it for free.

On #204: I agree the regex scanner is asking the wrong question, and T2 and T3
are both artefacts of hand-rolling a tokenizer rather than using the compiler.
I would not block on it — the fixture tables have made this thing far more
honest than a scanner has any right to be — but I would not grow mechanism (b)
any further either.

---

## What would move this to APPROVE

1. **T1** — pin `renderMarkdown`'s arity, and/or reject a top-level comma inside
   the inner call in `sinkArgumentIsSanitized`. This is the blocker.
2. **T2** — treat an unterminated `<!--` as a violation instead of a blanking
   instruction.
3. **T3** — either honour `IGNORE_MARKER` nowhere, or say plainly in the
   docblock that it disarms the tripwire for the 48 non-`REQUIRED_SINKS` files
   and that those files are covered by review only.
4. **T4** — either narrow the "cannot quietly reopen one" claim to the
   closed-world rules, or add the four-entry table for the tree-wide checks.

T5, T6 and T7 are cheap and I would take them, but they are not blockers.

---

*All vectors, harnesses and raw per-vector output:
`/scion-volumes/scratchpad/projects/farmtable/salvage/test-195-r5/`*

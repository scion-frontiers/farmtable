# #195 markdown-sanitize — round 5 TEST REVIEW (independent leg)

**Reviewed:** `53296af`, branch `markdown-sanitize`, clean.
**Verdict:** **REQUEST CHANGES**.
**Report:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r5.md`
**Salvaged harness, vectors and raw output:**
`/scion-volumes/scratchpad/projects/farmtable/salvage/test-195-r5/`
**This entry changes no code.** Nothing under `web/` was modified; the tree was
returned byte-identical (sha256-verified) after every one of 74 vectors.

Nothing live is broken. Both real sinks are correctly wrapped at `53296af` and
still are. Everything below is regression detection, as with every prior round.

## The finding that decides the round

**T1 — `renderMarkdown`'s arity is unconstrained by R5 and inexpressible by any
fixture.** `sinkArgumentIsSanitized` (`markdown.test.ts:965`) asserts the
`unsafeHTML` argument is a bare `renderMarkdown(…)` call and nothing else, but
it only balances parentheses — it says nothing about what is *between* them. And
every behavioural check calls `renderMarkdown` with exactly one string argument.
So an ordinary-looking feature addition reopens the class:

```ts
export function renderMarkdown(md: string, opts: { inline?: boolean } = {}): string {
  // Inline fields are one-liners; marked's inline lexer emits no block-level
  // HTML, so the output is already safe.   <-- plausible, and wrong.
  if (opts.inline) return parser.parseInline(md) as string;
  return DOMPurify.sanitize(parser.parse(md) as string, { FORBID_TAGS, FORBID_ATTR });
}
// ft-inspector-desc.ts:233
${unsafeHTML(renderMarkdown(this.description, { inline: true }))}
```

`npm test` → exit 0, **61 checks passed**. `tsc --noEmit` → exit 0, so
`npm run build` does not catch it either. Runtime-verified through the compiled
sanitizer under the suite's own jsdom bootstrap:

```
safe  renderMarkdown(XSS)                    [1 arg, the only shape tested]
        "<p><img src=\"x\"></p>\n"
RAW   renderMarkdown(XSS, { inline: true })  [2 args, unreachable by any fixture]
        "<img src=x onerror=alert(1)><script>alert(2)</script>"
```

This lands on **two of the seven axes the amended criterion names** — argument-
shape drift, and capture of the sanitizer's own configuration. An options
parameter *is* a configuration channel into the sanitizer, opened from the sink
file; R8 took away the module specifier, and this walks in the front door
instead. It is also the accidental mutation the round asked for: a feature, not
an attack.

**Why five rounds missed it, and this is the transferable part.** V1–V25 all
mutate a *binding*, a *call-site spelling*, or a *module specifier*. Not one
changes an **arity**. Mutation testing proves your tests are bound to your code;
only input-domain variation proves they are bound to reality — and a fixture
that cannot express a two-argument call cannot be mutated into failing on one.
For a predicate over a collection the axis is cardinality, and here the
collection is *the argument list*: the suite tests one, and never zero (T7) or
two (T1). The defect was reachable only by asking what these tests cannot say.

Two lines close it: pin `renderMarkdown.length === 1` in the behavioural suite,
and/or reject a top-level comma inside the inner call in
`sinkArgumentIsSanitized`.

## Two more guard gaps

**T2 (MEDIUM) — an unterminated `<!--` inside a lit template blanks the scanner's
view to EOF** (`markdown.test.ts:827-833`, `const to = end === -1 ? src.length`).
Placed in a non-sink scanned component, everything after it is invisible to R8,
R9, the tripwire and `BANNED_SINKS`; an `el.innerHTML = body` write after it is
green. **Position control**: the byte-identical write moved *before* the comment
is caught, and the same write with no comment at all is caught. So the harness
can express the detection and the green is a blind spot, not an inexpressible
input. Strictly worse than the disclosed `/*` analogue (V14), because an
unterminated block comment is a TS syntax error and this compiles clean.

**T3 (MEDIUM) — the `raw-sink-scan: ignore-line` marker disarms the only rule
covering 48 of the 50 scanned files.** The docblock argues the marker is safe
because `sinkBindingViolations` does not honour it. True — but that mechanism
runs on the two `REQUIRED_SINKS` files only; for the other 48 the tripwire *is*
the whole guard, and the tripwire does honour the marker. Alias the directive
behind the marker in a scanned non-sink file, import it into a sink, and the
suite is green at 61/61 with R6 satisfied (the laundering file **is** scanned —
it is simply not sounded). V7 tried this inside a sink file and was caught; the
novel step is moving it one file to the left. Not accidental, but the marker's
stated safety argument is scoped to two files and does not say so.

## Is the 61-check pin vacuous? No — but 7 checks are deletable while green

19 ablations, each neutering one rule and running the full suite.

**Credit first, because it is most of the story.** R2, R4, R5, R6, R6b, R7, R8,
**R9**, the indirection tripwire, regex tracking, comment stripping and the
ignore marker are all individually detectable on deletion — and *every* red came
from a `fixture:` check naming a specific vector, never from the tree. The
tables have real per-rule discriminating power. **R9 does not have R8's problem**:
`ABL-R9` is red via the `LAUNDERED:` entries. The fixture discipline added for
R8 generalised correctly.

Seven checks are deletable with the suite green. A redundancy matrix
(mutation alone; mutation + ablation) separates two very different reasons:

| check | unique coverage? | |
|---|---|---|
| R1 (`:1063`) | **no** — `MX-sinkgone+R1+SINKCOUNT` green | dead weight |
| R3 (`:1111`) | **no** — R4 catches it (already disclosed) | dead weight |
| tree arg-check (`:1536`) | **no** — `MX-concat+R5+ARGCHECK` still red via fixture | dead weight |
| file-count pin (`:1441`) | yes — `MX-newfile+FILECOUNT` green | live, unfixtured |
| sink-count pin (`:1508`) | yes — `MX-newsink-existing-file+SINKCOUNT` green | live, unfixtured |
| `BANNED_SINKS` (`:1549`) | yes — `MX-innerhtml+BANNED` green | live, unfixtured |
| string blanking (`:865`) | yes — `MX-prosestring+STRINGS` red | live, unfixtured |

Not a case for deleting anything; defence in depth is fine. But the docblock's
claim that the tables mean *"a future simplification of the rules cannot quietly
reopen one"* is **true for the nine closed-world rules and false for the four
tree-wide checks plus string blanking.** Either narrow the sentence or give
those four the treatment R8 got — a four-entry table, two lines each.

## FP1–FP6 do control, and are redundant in the right direction

`FP1xOB1`, `FP3xOB3`, `FP5xOB5` all go red under the matching over-broadening,
so the controls are not asserting nothing. But each over-broadening *alone* also
goes red, caught by the in-file `LEGITIMATE_SOURCE` / `INERT_PROSE` tables that
run on every `npm test`. The FP vectors duplicate live fixtures rather than
substituting for them.

## The sanitizer's own tests, unexamined for three rounds

Better than expected: **all 8 `FORBID_TAGS` entries and 3 of 5 `FORBID_ATTR`
entries are individually pinned** (each drop → red), plus mXSS, SVG `<style>`,
`foreignObject`, animation elements and `xlink:href`. Gaps:

- **The disclosure at `markdown.test.ts:124-130` is half wrong** — in the dev's
  favour on `formaction`, against on `action`. DOMPurify applies `ALLOWED_ATTR`
  per-attribute, not per-tag-and-attribute, and `action` is in its defaults. With
  `FORBID_ATTR` dropped, `<div action="https://evil.example">` **keeps** the
  attribute while `formaction` is stripped anyway. So `action` *is* testable in
  isolation and is worth one line; `formaction` genuinely is not.
- **`CFG-shared-marked` stays green.** The private `Marked` instance
  (`markdown.ts:56`) is a documented security decision with no test. R8 contains
  the hazard statically, so it is not live — but it is the same shape as the
  vacuous R8 the last round fixed.
- **`renderMarkdown` throws on every non-string input** (`undefined`, `null`,
  number, object). Both sinks pass gRPC-sourced values straight in, and a throw
  inside `render()` takes down the component. Availability, not XSS, and
  untested.

Verified-clean negatives, recorded so nobody re-runs them: uppercase `STYLE=` /
`CLASS=` / `DOWNLOAD=`, SVG-namespace `class`/`style`, `<template>` contents,
entity- and whitespace-obfuscated `javascript:`, reference links, nested-form
mXSS. Two curiosities, neither a defect: `<img srcset>` survives (consistent with
`<img src>` being allowed by design, but undiscussed), and an attacker can type
`☑︎` to forge a completed checkbox.

## On the amended criterion

It was not defined down to fit the solution, and T1 is the evidence: a criterion
defined down is one nothing can fail, and this one was falsified this round **on
its own terms**, on two of the seven axes it names, without re-litigating scope.
Dropping the unnamed adversary was right; the original wording was unsatisfiable
and pretending otherwise is what kept three rounds of evadable checks in the
file. None of the five disclosed survivors is challenged — V25 and the runtime-
construction vectors are correctly accepted, and the "do not fix by banning
`.prototype` assignment" note is right.

One caveat on *"rules can own a NAME, not an EFFECT"*: correct as a boundary, but
drawn a shade too generously. At T1, R5 does not fail to own an effect — it fails
to own a **shape it explicitly claims**, since `sinkArgumentIsSanitized`'s own
docstring says the argument must be the call and only the call, and an argument
list is part of a call. Inside the technique's reach, not beyond it.

T1's two-argument case should join V23/V25 as a Phase 2 acceptance vector; a
harness that loads the sinks and re-asserts the sanitizer kills it for free.

## Method, and one prediction I got wrong

Content-addressed anchors only, aborting unless the anchor occurs exactly once;
backups outside the repo; every restore asserts **both** `git status --porcelain`
empty **and** the pristine sha256 of each touched file; exit codes read from
`subprocess.run`, never through a pipe; and the driver **fails closed** — before
any vector it applies a deliberate breakage (`EXPECTED_CHECKS 61 → 62`) and
exits if that tree still returns 0. Every run log opens with
`[self-check] deliberately-broken tree -> exit 1 OK`. Mid-run the driver aborted
on `?? web/.r5probe.mjs` — my own scratch file — rather than report results from
a tree it could not account for. That is the round-4 process note working.

**I predicted `MX-prosestring` (a string literal naming both identifiers in a
sink file, without the marker) would be green. It is red**, via the tree-wide
tripwire, which correctly runs with `strings: false` and points at the documented
opt-out. My model of the two source views was wrong, not the guard. Recording it
because a review leg that only publishes its hits is measuring the wrong thing.

Final state: `git status --porcelain` empty, all four touched files sha256-equal
to their pristine copies, `npm test` green at 61, and
`grep -cE '^\s+check\(' markdown.test.ts` = 60, matching the docblock's
60 + (REQUIRED_SINKS.length − 1) = 61 arithmetic.

## What would move this leg to APPROVE

1. **T1** — pin the arity and/or reject a top-level comma in the inner call. Blocker.
2. **T2** — treat an unterminated `<!--` as a violation, not a blanking instruction.
3. **T3** — either honour the ignore marker nowhere, or state in the docblock that
   it disarms the tripwire for the 48 non-`REQUIRED_SINKS` files.
4. **T4** — narrow the "cannot quietly reopen one" claim, or fixture the four
   tree-wide checks.

T5 (`action`), T6 (private `Marked`) and T7 (non-string input) are cheap and
worth taking, but are not blockers.

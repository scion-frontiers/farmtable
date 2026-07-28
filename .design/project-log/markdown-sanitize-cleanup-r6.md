# #195 markdown-sanitize — round 6 cleanup (cardinality, and the first production changes since round 2)

**Branch:** `markdown-sanitize` · **Base:** `53296af` · **Head:** `febc655`
**Scope:** `web/src/util/markdown.test.ts`, `web/src/util/markdown.ts`,
`web/package.json`, `web/package-lock.json`.
**Gate:** `npm ci` 0, `npm test` 0 (**69 checks passed**), `npx tsc --noEmit` 0,
`npm run build` 0, `go build ./...` 0, `go test ./...` 0. Every exit code read
from the child process, never through a pipe.

**No live vulnerability existed at any point.** Both real sinks were correctly
wrapped before this round and still are. The round-5 security audit found no
XSS across 69 vectors plus 10 mXSS vectors. Everything here is regression
detection plus four small hardening items.

## The finding behind the findings

Five rounds of mutation testing asked *"what mutation survives?"*. Every vector
V1–V25 mutates a **binding**, a **call-site spelling**, or a **module
specifier**. Not one changes a **cardinality**. The two defects that mattered
most this round were both invisible to that question and both fell out of a
different one — *"what inputs can these tests not express?"*:

| axis | cardinality tested | cardinality missed |
|---|---|---|
| `renderMarkdown`'s argument list | 1 (all ~40 behavioural checks) | 2 (T1), 0 (T7) |
| the source-file count | the true value | anything else (T4b) |
| the `unsafeHTML` sink count | the true value | anything else (T4b) |

A harness that cannot express an input cannot test it, and a fixture list whose
only input is the real tree can never be exercised against a wrong value. That
is the same defect at two scales.

## What was fixed

### Guard (`markdown.test.ts`)

**T1 — arity.** `renderMarkdown(body, { inline: true })` renames nothing, adds
no binding and adds no file, so R1–R9 were blind to it *by construction*; the
required sink literal `unsafeHTML(renderMarkdown(` stays byte-identical. It is a
configuration channel into the sanitizer opened from a sink file — exactly what
R8 exists to deny — except R8 took away the *module specifier* and an options
parameter needs none. Closed from three sides: `Function.length`, the
declaration text in `markdown.ts`, and `sinkArgumentIsSanitized` rejecting a
top-level comma. Fixtured as V11.

The brief proposed `renderMarkdown.length === 1` alone as a one-line fix. **That
is insufficient and I did not do only that** — see "Where I disagreed" below.

**F1 — `stripImportStatements` swept across statement boundaries.** The docblock
claimed "`[^;]` cannot cross a statement boundary". `[^;]` matches newlines, so
an import missing its semicolon ran forward to the next `from '…';` and blanked
everything in between, **including a value alias**. That is V3 — "the rule that
generalises" — defeated by deleting two semicolons, against R3, R4 and the
tree-wide non-called-position rule simultaneously. Now `[^;'"]`, which cannot
cross a specifier, plus an optional terminator. The property is **"one import
statement cannot swallow the next"**.

This exact defect had already been diagnosed and fixed once in this file, for
the re-export regex, and never carried back.

**F2 / T4a — `BANNED_SINKS` could be emptied with the suite green.** Its only
fixtures were two *negative* controls, so all eight patterns were untested
detection logic. A negative control cannot fail an over-permissive rule. Added
`BANNED_SINK_POSITIVES`. This was the last of four rule groups in the file to
get its positive half; the other three already had one.

**T2 — an unterminated `<!--` blanked to EOF.** Four characters in a lit
template hid the rest of any scanned component from R8, R9, the indirection
tripwire and `BANNED_SINKS` at once. Worse than the unterminated `/*` recorded
as V14, because that is a TypeScript syntax error and `tsc` is a second gate on
it, whereas an unterminated `<!--` inside a template literal compiles clean. It
now blanks nothing — the same fail-toward-detection choice `endOfRegexLiteral`
already makes.

**T3 — `IGNORE_MARKER` removed entirely.** Its containment argument ("not
honoured by the per-file rules") held for the two `REQUIRED_SINKS` files and was
stated as if it held for all fifty. For the other 48 the tree-wide tripwire *is*
the whole guard, and it honoured the marker. This is the workstream's signature
defect — a property true of one consumer, written as if true of all — and it is
the third time it has appeared. The cost is accepted and documented: a
production string literal naming a banned form now has no in-file escape.

**T4b — the coverage claim narrowed, and the four live-but-unfixtured checks
given positive halves.** Both count pins (extracted as predicates so a fixture
can reach them), `BANNED_SINKS`, and `opts.strings` blanking. R1, R3 and the
tree-wide argument check are redundant but **kept** as documented defence in
depth. The residue is stated rather than hidden: a fixture catches a *neutered
predicate*, not a *deleted call site*; `EXPECTED_CHECKS` is what catches the
latter.

**C1 — the amended criterion restated in artifact terms.** "Innocent-looking
regression" is a property of the author's intent, not of the artifact, so it
cannot adjudicate a diff — the only job an exit criterion has. Replaced with
name-and-shape versus effect, scoped to what is visible in the scanned view. Two
related corrections: the "capture of the sanitizer's own configuration" axis is
qualified (R8 defends it only *by naming a specifier the scanner can see*), and
the NAME/EFFECT boundary is explicitly barred from absorbing T1 — R5 there
failed to own a *shape it claims to own*, since an argument list is part of a
call. "We can only own names" is a real limit and also the most convenient
excuse available in that file; the docblock now says so.

**C2 — sunset clause.** Names what #204 retires (`stripInertText`,
`stripImportStatements`, R3, R4, R7, `directiveIndirectionOffenders`,
`BANNED_SINKS`) and what is kept unconditionally (the behavioural half, plus
R1/R2/R5/R6/R8/R9 until the Phase 2 harness observes the sanitizer's effect).
Every defect this file has recorded — V7, V8, V14, F1, T2 — is a *tokenizer*
defect, not a policy defect, which is the argument for the split.

**Bookkeeping.** `EXPECTED_CHECKS` is now derived in code from
`EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)`, so a third sink costs
one edit instead of three and the prose arithmetic that had to be kept in
lockstep is gone. The check-total failure message no longer claims a check was
added or removed when only `REQUIRED_SINKS` changed. The load-bearing literal
`61` is out of the V25 disclosure.

### Production (first production change since round 2)

- **T7** — `renderMarkdown` returned by throwing on `undefined`, `null` and
  numbers. Both sinks pass values that arrive over gRPC, and a throw inside a
  Lit `render()` takes down the whole component, not one field. Availability,
  not XSS. Non-string input now returns `''`.
- **`slot` added to `FORBID_ATTR`.** Not exploitable today — slot assignment
  considers only direct children of the host and the markdown lands two levels
  deeper inside `<sl-details>` — but that is an invariant of the *template's
  nesting*, not of the sanitizer.
- **`dompurify` range tightened `^3.0.0` → `^3.4.12`.** The lockfile already
  resolved 3.4.12; the declared range still admitted 3.0.0, which has known
  bypasses. Lockfile refreshed — one line, resolved version unchanged.
- **URI policy pinned.** No existing check notices `ALLOW_UNKNOWN_PROTOCOLS:
  true`, which leaves `javascript:`, `vbscript:` and `data:` blocked (so every
  scheme-specific check stays green) while letting everything else through.

## Verification — BY EXECUTION

Three legs, all with content-addressed anchors that abort unless the anchor
occurs exactly once, backups outside the repo, and sha256 verified against an
out-of-repo pristine copy on restore.

**Leg 1 — revert each fix, require red (16 mutations).** Every fix landed this
round was individually reverted and the suite required to go red *via the
expected message*. All 16 behaved as predicted, including two controls: a
deliberately-broken `EXPECTED_CHECK_CALL_SITES` (proving the driver can see red
at all — fails closed) and an untouched-tree control (proving it can see green).

**Leg 2 — reproduce the four findings in the real tree.** Not against fixture
strings: against `ft-inspector-desc.ts` and `inspector-shared-styles.ts`. All
four red, and red via the *right* rule each time.

**Leg 3 — the control that makes leg 2 mean anything.** The brief *asserts* those
four were green under round 5. Asserting is not measuring, so the same four
mutations were run against `53296af`:

| finding, in the real tree | round 5 | round 6 |
|---|---|---|
| T1 arity at the live sink | GREEN | RED |
| F1 semicolon-less import + alias | GREEN | RED |
| T3 marker laundering | GREEN | RED |
| T2 unterminated `<!--` hides an `innerHTML` write | GREEN | RED |

Round 5's guard was green at 61/61 on the clean tree in the same run, so the
control leg is sound.

**Standing bar 5 applied to my own fixes.** Before writing the `action` and
`slot` checks I measured them against a DOMPurify-defaults control, because a
check that passes on the library's defaults is a no-op dressed as coverage:
`action` and `slot` **survive** the defaults (so `FORBID_ATTR` is load-bearing
for both and both are testable), while `formaction` is dropped by the defaults
on any host tag (so it genuinely is not).

## Where I disagreed with the brief

1. **`renderMarkdown.length === 1` is not sufficient, and the brief called it a
   complete one-line fix.** `Function.length` stops counting at the first
   defaulted or rest parameter, so `renderMarkdown(md, opts = {})` reports 1 and
   walks straight past it — the *most natural* way anyone would actually add an
   options parameter. Measured both: the plain second parameter is caught by
   `.length`, the defaulted one is caught only by the declaration scan I added.
   Had I implemented the brief as written, T1 would have been closed against the
   spelling in the report and open against the spelling a real commit would use
   — which is precisely the round-1-through-3 failure mode this workstream
   exists to escape.

2. **The brief's `action` disclosure correction was right; its implicit scope
   was too narrow.** It asked for `action` only. `slot` — which the same brief
   adds to `FORBID_ATTR` in the very next item — is testable by the identical
   argument, and a new production rule with no test is how `FORBID_ATTR` got
   into this state. Added both.

3. **F1 was filed with two halves and the brief's fix only fixtured one.** The
   bypass half (V10) is in the brief; the mirror — a *correct* semicolon-less
   file being rejected with a message accusing it of aliasing — was described in
   the report but had no pin proposed. That half is the one that gets a guard
   deleted rather than bypassed, and it is now asserted inside the existing
   sound-fixture check. Deliberately in the same check, not a new one: a bypass
   fixture and a false-positive fixture have to move together, or the next round
   closes one by breaking the other.

4. **Minor, on T2's wording.** The brief says "treat an unterminated `<!--` as a
   **violation**". `stripInertText` returns a string and has no channel for
   emitting violations; adding one would be a much larger change than the
   one-line fix intended. Implemented as "blanks nothing", which produces the
   same outcome — the hidden sink becomes visible and the existing tripwire
   reports it, as measured in leg 2 — without restructuring the function.

I did **not** take any of the "NOT this round" items: no allow-list inversion,
no CSP/Trusted Types, no per-attribute additions, no #204, no T6.

## Costly disclosure

- **I very nearly shipped the insufficient arity fix.** My first pass wrote
  `renderMarkdown.length === 1` exactly as the brief specified and moved on. The
  defaulted-parameter gap only surfaced because I was enumerating mutations for
  the verification driver and had to write down what "any new parameter" meant
  concretely. The measurement caught what the reading did not — and the brief's
  own standing bar 1 is why I was writing mutations at all rather than trusting
  the fix.
- **My first `sinkArgumentIsSanitized` rewrite tracked only parentheses depth**,
  which would have rejected `renderMarkdown(fmt(a, b))` — a false positive of
  exactly the kind line 722 of the guard warns gets guards deleted. Caught while
  reasoning about the bracket cases before running anything; fixed by tracking
  `[` and `{` as well. Filing that as a disclosure rather than silently fixing
  it, because the near-miss is the same shape as F1's C5 mirror and I only
  noticed because F1 had just made me look for it.
- **Sequencing per the round-4 loss:** committed before running any driver, and
  refreshed the out-of-repo backups immediately after the commit. Both drivers
  verified their restore against sha256 of that copy in addition to
  `git status --porcelain`. No work was lost.

## State at the end of this round

| | |
|---|---|
| head | `febc655` on `markdown-sanitize`, **not pushed** |
| gate | `npm ci` 0 · `npm test` 0, **69 checks passed** · `tsc --noEmit` 0 · `npm run build` 0 · `go build` 0 · `go test` 0 |
| check total | 61 → 69; `EXPECTED_CHECK_CALL_SITES = 68`, runtime total derived in code |
| production diff | `markdown.ts` (+`slot`, non-string guard), `package.json` + lockfile (dompurify range) |
| mutation | 16 revert-the-fix vectors + 4 tree-level repros + 4 round-5 controls, all as predicted |
| still open, disclosed | V25 (capture by effect) and the bare non-relative specifier — both routed to the Phase 2 harness, neither newly discovered |

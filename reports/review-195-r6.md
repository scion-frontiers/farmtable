# #195 markdown-sanitize round 6 (`53296af..86f30bc`) — Code Review

**Leg:** code review (1 of 3). **Target SHA:** `86f30bcdc699367681ccffbc4fde1e40006fd754`,
branch `markdown-sanitize` — verified with `git rev-parse HEAD`.
**Range reviewed:** `53296af..86f30bc`, 814 insertions / 95 deletions, 5 files, 3 commits.

## VERDICT: REQUEST CHANGES

## Executive Summary

Risk level: **MEDIUM**. No live vulnerability: both real sinks are correctly wrapped,
the production diff is correct and every one of its items fails closed on revert, and
the round's bookkeeping work (the `EXPECTED_CHECKS` derivation, F1's fix and its new
mirror, T2, T3, T4b) is genuine and verified. Two of the round's headline fixes,
however, do not hold: the T1 arity pin loses two of its three sides to a single natural
TypeScript spelling, and F1's fix leaves an `import.meta`-shaped hole through which the
complete two-file laundering bypass it was meant to close is still **green at 69/69**.
Both are regression-detection gaps rather than exploitable flaws, and both are narrow
fixes.

## Severity Table

| # | Severity | Finding | Evidence |
|---|---|---|---|
| R1 | **Required** | T1 arity pin: sides A and B both defeated by an overload signature; the production comment's claim is false | BY EXECUTION |
| R2 | **Required** | F1: `import.meta` still swallows the next statement; full two-file raw-directive bypass is green | BY EXECUTION |
| R3 | **Required** | The non-string guard's stated justification does not describe either call site | BY EXECUTION |
| O1 | Optional | Declaration scan false-positives on four correct one-parameter spellings | BY EXECUTION |
| O2 | Optional | `BANNED_SINKS` tripwire message has no line number and no route forward post-T3 | BY EXECUTION |
| O3 | Consider | C2's sunset clause sets a condition but no tripwire | REASONED |
| F1 | FYI | "URI policy pinned" is logged as a production change; it is test-only | REASONED |
| F2 | FYI | `dompurify` range/lockfile/node_modules verified consistent at 3.4.12 | BY EXECUTION |

## Critical

None. No live vulnerability. Both `REQUIRED_SINKS` files wrap correctly at
`ft-inspector-comments.ts:221` and `ft-inspector-desc.ts:233`; no scanned file outside
those two names `unsafeHTML`; the T3 marker sweep is clean.

## Required

### R1 — The arity fix is one-sided, and `markdown.ts` states otherwise in capitals — BY EXECUTION

`web/src/util/markdown.ts:75-84` asserts:

> THIS FUNCTION TAKES EXACTLY ONE PARAMETER, AND THAT IS A SECURITY PROPERTY … The sink
> guard in markdown.test.ts pins the arity from both ends — behaviourally via
> `renderMarkdown.length` and by reading this declaration — **so adding a parameter here
> turns the suite red.**

It does not. I replaced `renderMarkdown` with a genuinely two-parameter function whose
second parameter reconfigures DOMPurify to permit `onerror`:

```ts
export function renderMarkdown(md: string): string;
export function renderMarkdown(md: string, opts: { inline?: boolean }): string;
export function renderMarkdown(md: string, opts: { inline?: boolean } = {}): string {
  …
  return DOMPurify.sanitize(html, {
    FORBID_TAGS, FORBID_ATTR,
    ...(opts.inline ? { ALLOWED_ATTR: ['href', 'src', 'onerror'] } : {}),
  });
}
```

Result: **`npm test` exit 0, "markdown sanitizer: 69 checks passed", `tsc` clean.**

Why each side misses (`markdown.test.ts:559-577`):

- **Side A, `renderMarkdown.length`** — stops counting at the first defaulted parameter,
  so the implementation reports `1`.
- **Side B, the declaration scan** — `/export function renderMarkdown\s*\(([^)]*)\)/.exec(src)`
  returns the **first** match in the file. With overloads present, that is the clean
  one-parameter *overload signature*; the two-parameter implementation is never examined.
- **Side C, `sinkArgumentIsSanitized`** — still holds. It is now the only side doing work,
  and it constrains *call sites*, not the declaration.

Two further weaknesses in side B, both verified in isolation:

- It reads **raw bytes** (`readFileSync`), not a derived view. This contradicts the file's
  own doctrine at `markdown.test.ts:899-916` ("Every scan below runs over a derived view
  of the file, never over its raw bytes"). A comment in `markdown.ts` reading
  `// e.g. export function renderMarkdown(md: string): string` shadows the real
  declaration and the scan passes — in a file whose 20 lines of prose above the function
  discuss this exact signature.
- `[^)]*` cannot span a `)` inside a parameter default, though every case I probed still
  tripped the `[,=]` test for other reasons.

**Suggested fix** (all in `markdown.test.ts:566-576`):
1. Use `matchAll`, not `exec`, and reject if **any** match's parameter text contains a
   top-level comma — this closes the overload spelling.
2. Assert the match count is exactly 1 unless overloads are deliberately expected, so the
   count itself is pinned.
3. Run the scan over `stripInertText(src, { strings: true })` rather than raw bytes.
4. Correct `markdown.ts:79-81` to state what is actually pinned.

### R2 — F1's fix does not cover `import.meta`; the two-file laundering bypass is still green — BY EXECUTION

`stripImportStatements` (`markdown.test.ts:1149-1154`) documents its property as:

> THE PROPERTY IS "ONE IMPORT STATEMENT CANNOT SWALLOW THE NEXT", which is what `[^;'"]`
> buys: the character class cannot cross a quote, so a match starting at one `import`
> keyword can never run past that statement's own specifier.

That argument assumes the match starts at an import *statement*, which has a quoted
specifier. **`import.meta` is an `import` keyword with no specifier**, so the class has no
quote to stop at and the match runs forward to the next `from '…'`, blanking everything in
between — the exact F1 defect, unchanged by F1's fix.

Verified as a **complete two-file bypass**. Laundering file
(`components/inspector/inspector-shared-styles.ts`, a non-sink scanned file — the same file
the round-6 log itself used for the T3 laundering repro), prepended:

```ts
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
const dev = import.meta.env.DEV
export const rawHtml = unsafeHTML
export { css as _css } from 'lit';
```

Sink file (`ft-inspector-desc.ts`), real sink left **byte-identical**, one line added
beside it:

```ts
import { rawHtml } from './inspector-shared-styles.js';
…
        ${unsafeHTML(renderMarkdown(this.description))}
        ${rawHtml(this.description)}          // renders the description raw
```

Result: **`npm test` exit 0, 69 checks passed, `tsc` clean.**

The `import.meta` line blanks `export const rawHtml = unsafeHTML` before the tree-wide
non-called-position rule in `directiveIndirectionOffenders` ever sees it, so R4-tree-wide
does not fire; the sink count stays at 2; R1/R5 see the untouched real sink.

This is the same class as V10 and V24b, and it lands in the region T3 identified as the
weakest — a non-sink scanned file, where the tree-wide tripwire *is* the whole guard.

Reachability today is latent, not live: `import.meta.env` is already used at
`src/index.ts:54`, but every `from` clause in that file precedes it and the trailing
`'shoelace'` quote stops the character class, so nothing is mis-blanked in the tree right
now (measured — no non-import line in `index.ts` is blanked).

**Not Critical** because no such code exists, no live sink is affected, and the bypass
requires a deliberate two-file change. It is **Required** because it is a complete defeat
of the closed-world mechanism in precisely the defect class this round was convened to
close.

**Suggested fix** in `markdown.test.ts:1152`: exclude the meta-property —
`/\bimport\b(?!\s*\.)[^;'"]*?\bfrom\b…/`. Add `'const d = import.meta.env.DEV\nconst raw = unsafeHTML\nimport { z } from "./z.js";'`
to `INDIRECTION_EVASIONS` as a positive, and `'const d = import.meta.env.DEV;'` to
`LEGITIMATE_SOURCE` as the false-positive control. Correct the docstring's stated property
to name the assumption (a match must start at an import statement *with a specifier*).

### R3 — The non-string guard's justification does not describe either call site — BY EXECUTION

`markdown.ts:86-91` justifies the behaviour change:

> Both call sites pass values that arrive over gRPC (a comment body, a task description),
> and marked throws on undefined, null or a number. A throw inside a Lit `render()` takes
> down the whole component … so an absent description would blank the inspector.

Neither call site can pass a non-string:

- `ft-inspector-comments.ts:221` passes `c.body`, typed `body: string` (`gen/types.ts:289`)
  and produced by `stringField()` at `gen/grpc-client.ts:553`, which is defined at
  `gen/grpc-client.ts:660-662` as
  `typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)`.
  It coerces at the wire boundary.
- `ft-inspector-desc.ts:233` passes `this.description`, but `ft-inspector-desc.ts:209`
  early-returns `if (!this.description)` before that branch is reachable.

So the described outage was not reachable at either site. This is charge 6's signature
defect — a property stated as if it held generally — applied to the *premise* for a
production behaviour change at a security boundary.

Arguing the change itself both ways, as the brief asks:

- **For:** one line, `''` cannot carry a payload, every non-empty string still goes through
  the sanitizer, TS types are erased at runtime, and the data is wire-sourced. Defence in
  depth for a *future third* call site that is not guarded.
- **Against:** with `md: string` the branch is unreachable per the type, so the test must
  write `renderMarkdown(bad as unknown as string)` (`markdown.test.ts:591`) to reach it. A
  test that has to defeat the type system to exercise a branch is a signal the declared
  contract and the runtime contract disagree. And silently mapping `42` or `{}` to `''`
  turns a caller type error into a blank field, which is harder to diagnose than a throw.

On balance **keep the guard** — it is cheap and it is at a security boundary — but the
comment must stop asserting a live bug that does not exist.

**Suggested fix:** rewrite `markdown.ts:86-91` as defence-in-depth for future callers,
naming the two coercions that make it currently unreachable (`stringField`, the
`!this.description` early return). Optionally widen the signature to `md: unknown` so the
static and runtime contracts agree and the test's cast disappears; note the trade-off that
this gives up TS's ability to flag a bad caller at compile time.

## Nit / Optional

### O1 — The declaration scan rejects four correct one-parameter spellings — BY EXECUTION

`/[,=]/.test(decl[1])` at `markdown.test.ts:571` red-lights all of these, none of which
adds a parameter:

| spelling | scan result |
|---|---|
| `renderMarkdown(\n  md: string,\n)` (prettier `trailingComma: "all"`, its default) | RED |
| `renderMarkdown(md: Record<string, string>)` | RED |
| `renderMarkdown(md: string /* body, raw */)` | RED |
| `renderMarkdown(md: string = '')` (default on the *only* parameter) | RED |

This is the failure mode the file names repeatedly ("a guard that rejects correct code gets
deleted", `markdown.test.ts:1136`, `2081-2082`) and for which it added F1's mirror. The
scan has no such mirror. Risk is currently moderate — there is no prettier or eslint config
in `web/` — but the first formatter added to this repo turns the suite red on a correct
declaration. Fixing R1 with a top-level-comma parser (rather than `[,=]`) resolves this at
the same time; add a false-positive fixture pinning the trailing-comma form as accepted.

### O2 — The removed escape hatch has a documented successor the failure message does not point at — BY EXECUTION

T3's sweep is clean — nothing under `web/src` carries `raw-sink-scan`, and no scanned file
contains a string literal naming a banned form — so the removal costs nothing today.
The failure mode when someone does need one is poor. Adding a legitimate
`export const SANITIZER_HELP = 'Never assign to el.innerHTML = userInput; …'` to
`src/util/format.ts` produces:

```
raw-HTML sink outside renderMarkdown in: src/util/format.ts (innerHTML/outerHTML assignment)
[tripwire: an enumeration of known sinks, not a proof of absence]
```

No line number (the check uses `pattern.test(code)`, not `matchLines`, unlike every other
rule in the file), no mention that a string literal is a known cause, and no route forward.
The remedy — "The fix for such a string is to change this file, in review" — exists only in
the `BANNED_SINKS` docstring at `markdown.test.ts:1287`, which the developer hitting this
has no pointer to. Recommend: use `matchLines` for line numbers, and append that sentence
to the thrown message.

### O3 — C2 sets a condition, not an expiration — REASONED

The sunset clause (`markdown.test.ts:702-722`) is well written and unusually specific: it
names the exact symbols to delete and the exact set to keep. But it fires on nothing. When
#204 lands, no check goes red, and the clause is discovered only by someone already reading
a 2400-line test file. Per the brief's own framing, this is a justification with no
tripwire.

A cheap mechanical one exists and would cost about five lines: assert that no eslint
configuration naming the #204 rule is present in `web/`, and when one appears, fail with the
deletion list from lines 707-709. That converts "someone should remember" into "the suite
tells you, once, at the moment it becomes true." C1's amended criterion
(`markdown.test.ts:733-741`) does not need this — it is already stated in artifact terms
(name-and-shape vs. effect, scoped to the scanned source view) and is genuinely
adjudicable against a diff, which is a real improvement over the withdrawn
"innocent-looking regression" wording.

## FYI

- **F1 — "URI policy pinned" is logged under "### Production (first production change
  since round 2)"** (`markdown-sanitize-cleanup-r6.md:129-131`), and the shared brief repeats
  it as one of four production items. It is a **test-only** addition
  (`markdown.test.ts:253-259`); `markdown.ts` sets no URI policy and relies on DOMPurify's
  defaults. The production diff is three items, not four. The pin itself is good and
  discriminating (verified: `ALLOW_UNKNOWN_PROTOCOLS: true` turns it red with exactly its
  own predicted message).
- **F2 — dompurify verified consistent.** `package.json` `^3.4.12`, lockfile root range
  `^3.4.12`, `node_modules/dompurify` resolved `3.4.12`. The log's claim that the resolved
  version was already 3.4.12 and only the declared range moved is accurate — the lockfile
  diff is one line. `npm ci` will not diverge. The floor has no test, but npm is the correct
  enforcer here; no action.

## Positive Feedback

- **The `EXPECTED_CHECKS` derivation is a genuine invariant, not the tautology charge 2
  suspected.** With `C` = `check(` call sites and `N` = `REQUIRED_SINKS.length`, actual runs
  = `(C-1)+N` and expected = `EXPECTED_CHECK_CALL_SITES+(N-1)`; the `N` terms cancel exactly,
  so the pin is insensitive to `N` and sensitive only to `C` — which is precisely what it
  exists to pin. `N` is independently pinned by `sinkCountViolation` against the tree, and
  that predicate is itself now fixtured (T4b). Verified: `grep -cE '^\s+check\('` = 68 =
  `EXPECTED_CHECK_CALL_SITES`; deleting one `check()` call site goes red with the correct
  message. It catches added/removed/unreached call sites; it does not catch a
  `REQUIRED_SINKS` length change, and it correctly delegates that.
- **All three production items fail closed.** Reverting `slot` from `FORBID_ATTR`, removing
  the non-string guard, and enabling `ALLOW_UNKNOWN_PROTOCOLS` each turn the suite red via
  the intended check and message. No production change here is untested.
- **F1's fix and its new mirror are both discriminating.** Reverting the *complete* pre-fix
  regex pair turns three checks red, including `febc655`'s mirror firing with exactly the
  predicted "a correct sink file with ASI-style imports was rejected" message and the
  aliasing accusation the docstring said it would produce. Commit `febc655` is real work,
  not a green no-op. (See disclosure below — I got this wrong first.)
- **`sinkArgumentIsSanitized`'s bracket handling is right.** Rejecting a top-level comma
  while permitting `renderMarkdown(fmt(a, b))` is the correct line, and the log's disclosure
  that the first draft would have false-positived on it is the kind of near-miss worth
  recording.
- **The log's costly-disclosure section is accurate**, and the `slot` comment's nesting
  claim checks out against both components (`ft-inspector.ts:183-196`,
  `ft-inspector-comments.ts:194-250`).

## Test Coverage

Strong and, unusually, largely self-verifying. Gaps found, all in the round's own new work:

- The overload spelling of R1 has no fixture; `V11` covers only the sink-call side.
- The `import.meta` shape of R2 has no fixture in `INDIRECTION_EVASIONS`.
- No false-positive control pins that a correct multi-line/trailing-comma declaration is
  accepted (O1).
- The dompurify floor has no test (acceptable; npm enforces it).

## Backward Compatibility

No wire-format or proto change. One behavioural change for callers:
`renderMarkdown(undefined | null | 42 | {} | [])` previously threw from `marked` and now
returns `''`. Both in-tree call sites are unaffected (R3). Any future caller relying on a
throw to detect bad input loses that signal — worth stating in the comment per R3.

## Methodology, Disclosures, Limitations

**Method.** Reviewed only `53296af..86f30bc`. Read both briefs and the developer's log,
treating the log as claims to check. Full project gate reproduced independently:
`npm test` exit 0 / "69 checks passed", `npx tsc --noEmit` exit 0, `npm run build` exit 0,
`go build ./...` exit 0, `go test ./...` exit 0. All mutations were content-addressed with
anchors asserted unique (abort otherwise), applied to a pristine out-of-repo copy, restored
from that copy, exit codes read from the child process and never through a pipe. Final state
verified: `git status --porcelain` empty and sha256 of both files matching the pristine
copies. Scratch confined to `salvage/r6-review-195/`; I read no other leg's files.

**Costly disclosure — I filed a wrong conclusion internally and caught it by measurement.**
My first F1 revert changed only the character class (`[^;'"]` → `[^;]`) and left the fix's
*other* half (mandatory `;` → optional `;?`) in place. The suite stayed green at 69/69 and I
was one step from filing "F1's fix is untested and its mirror is non-discriminating" as a
Required finding. Checking the actual diff showed F1 was a two-part change; reverting both
parts turns three checks red, including the mirror. The near-miss is the brief's standing
bar 6 in action — verify a green mutation actually weakens the thing before filing it — and
it would have been a materially unfair finding against the round's most careful work.

**What I did not establish.**
- I did not run the R1 or R2 payloads in a browser or confirm the resulting XSS executes. R1
  configures `ALLOWED_ATTR: ['href','src','onerror']`; R2 renders `this.description`
  through the raw directive. Both are guard-bypass demonstrations (suite green while the
  property is false), not proofs of exploitation.
- I did not review DOMPurify 3.4.12's changelog or CVE history; F2 checks only internal
  consistency of the declared range, lockfile and installed tree.
- I did not attempt to enumerate further `stripInertText` tokenizer defects beyond the
  charges. Given that every round has found one, I would not assume R2 is the last.
- I did not exercise the two Lit components; the sink analysis is static, matching the
  suite's own acknowledged Phase 2 boundary.
- Out-of-scope items (M1, CSP/Trusted Types, #204, V25, the bare non-relative specifier)
  were not re-litigated. I found nothing suggesting any is materially worse than recorded.

**Harness limits.** My probes for R1 side B ran the regex in isolation as well as
end-to-end; the isolation results are exact for that predicate but say nothing about other
rules. The `import.meta` sweep covered `web/src` only.

**Recommendation to the dispatcher.** R1 and R2 are narrow, well-localised fixes and do not
need a further round of architecture. Because both landed inside the round's own headline
work, a re-review of the fix should re-run the two bypasses above as explicit fixtures. This
change does not warrant escalation to a separate security specialist beyond the audit leg
already running.

## Final Verdict

**REQUEST CHANGES** — R1, R2 and R3 are blocking. Everything else is Optional, Consider or
FYI. The production diff is sound and should survive the fix round unchanged apart from the
two comment corrections.

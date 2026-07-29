# dev-195-r9 — predictions, written BEFORE any mutation was run

Tree `/workspace`, branch `markdown-sanitize-r9` off `3f6a695`. Baseline already
measured (and it is the only thing measured at the time of writing): `npm test` 0,
`78 checks passed (123 assertions)`, `npx tsc --noEmit` 0, `npm run build` 0.

## A. The live bypass at HEAD (re-measuring what three legs reported)

| id | mutation of `web/src/util/markdown.ts` | prediction |
|---|---|---|
| A-D1 | truncate shape, `` md: string \| `x)y` `` + defaulted `opts` | GREEN 78/123, tsc 0 (bypass live) |
| A-D4 | swallow shape, `` md: string \| `x(y` `` + defaulted `opts` | GREEN 78/123, tsc 0 (bypass live) |
| A-D2 | one-token control: `` `x)y` `` -> `'x)y'` | RED, `renderMarkdown declares 2 parameters` |
| A-J1 | revert `createDOMPurify(window)` to the process-global singleton | GREEN 78/123, tsc 0 (no pin) |

## B. What the class fix must change

The fix: add a `templateText` option to `stripInertText` that blanks template
literal TEXT but NOT `${…}` interpolations (the sinks live in interpolations), and
route all five counters through one shared helper
`literalBlindView(code) = stripInertText(code, { strings: true, templateText: true })`,
using the blinded view for structural decisions and the ORIGINAL text for slices
and messages.

Predicted effect on each counter, stated per counter because the point of a class
fix is that it reaches all five:

| counter | fixture that must go RED-before / GREEN-after, or newly RED-on-evasion |
|---|---|
| `balancedDeclarationParameterLists` | new evasion C7-n (truncate) — SURVIVES today, caught after |
| `splitTopLevelParameters` | new legitimate `` md: string \| `a,b` `` — FALSE POSITIVE today, accepted after |
| `hasTopLevelDefault` | new legitimate `` md: string \| `a=b` `` — FALSE POSITIVE today, accepted after |
| `callArguments` | new sink evasion V11f (a `)` in a template truncating the sanitizer's own call) — caught today for the WRONG reason ("not a bare call"), caught after for the right one (top-level comma) |
| `sinkArgumentIsSanitized` | new legitimate sink call `` renderMarkdown(`${a}, ${b}`) `` — FALSE POSITIVE today, accepted after |

Predicted counts after all work:
`EXPECTED_CHECK_CALL_SITES` 77 -> 78 (one new check: the DOMPurify pin).
`EXPECTED_CHECKS` 78 -> 79. `EXPECTED_ASSERTIONS` 123 -> 127 (four assertions in
the new check: one positive control + three). Guarded fixture tables 13 -> 17
(three hoisted ownership arrays + one new legitimate sink-call table).
`ARITY_EVASIONS` 13 -> 17, `ARITY_LEGITIMATE` 8 -> 11, `SINK_EVASIONS` 24 -> 27.

## C. Post-fix mutations that must go RED (the fix must itself be pinned)

| id | mutation | prediction |
|---|---|---|
| C-1 | `literalBlindView`: `templateText: true` -> `false` | RED — `SURVIVED: C7-n` and `SURVIVED: C7-o` (and the two template legitimates stay green because they only fail the other way) |
| C-2 | `literalBlindView`: `strings: true` -> `false` | RED — `SURVIVED:` the bare-string mirror C7-q ONLY. This is the T-3 masking pair dissolved: string blanking now has unique fixture coverage that the `decls.length !== 1` rule cannot reach, because the mirror is a single declaration. |
| C-3 | remove the `decls.length !== 1` rule alone | RED — `SURVIVED: C7-e2` only (unchanged from r8) |
| C-4 | `balancedDeclarationParameterLists`: use `code` instead of the blinded view for counting | RED — same as C-1 |
| C-5 | `splitTopLevelParameters`: drop the blinded view | RED via `FALSE POSITIVE: a template-literal type containing a comma` |
| C-6 | `hasTopLevelDefault`: drop the blinded view | RED via `FALSE POSITIVE: a template-literal type containing an equals sign` |
| C-7 | `sinkArgumentIsSanitized`: drop the blinded view | RED via the legitimate sink-call table |
| C-8 | `callArguments`: drop the blinded view | GREEN is possible here and would be a FINDING — the call-site layer is currently saved by the trailing-text arm of R5, so counting wrong may still report. Predicted: GREEN. If GREEN, the V11f message text is the discriminator and I will pin the REASON, not just the redness. |
| C-9 | unterminated parameter list branch: make it return the tail (the r8 behaviour) | RED via the malformed-source assertion in the arity fixture check |
| C-10 | delete the new DOMPurify check's body | RED via `EXPECTED_ASSERTIONS` |
| C-11 | J1 (revert to the process-global DOMPurify) with the new pin in place | RED, and RED only in `renderMarkdown does not use the process-global DOMPurify singleton` |

## D. Predicted non-findings / things I expect NOT to move

- Blanking template TEXT cannot remove a true positive from the sink rules: the
  sinks live in `${…}` interpolations, which stay visible. If any existing
  SINK_EVASIONS entry goes green, that prediction is wrong and it is a finding.
- V6c (`unsafeHTML(\`<div>\` + renderMarkdown(...) + ...)`) stays caught: the
  argument does not START with `renderMarkdown(`, which is a head-regex rejection
  and has nothing to do with paren counting.
- `dynamicImportSpecifierOffenders` keeps all 5/5 evasions and 5/5 legitimates:
  `callArguments` returns ORIGINAL text, so the plain-quoted-literal predicate
  still sees real specifier characters.
- Both orders of the two terminal poisoners (marked singleton, DOMPurify
  singleton) are safe, because they poison different objects and neither check
  consumes the other's global. I will measure both orders rather than assert it.

## E. Counts I predict for the arity ablation read-back

`ARITY_EVASIONS` after the change has 17 entries; the four new ones are all
`Function.length === 1` spellings (the second parameter is defaulted in three,
and the fourth is the bare-string mirror which is also defaulted), so the
"three spellings drive `.length` off 1" sentence (C7-d, C7-j, C7-k) stays true
at 17 entries. If a read-back prints anything other than 17 parsed entries, the
extraction is void — this is the exact trap test-195-r8 recorded (PARSED 5 next
to a pin that said 13).

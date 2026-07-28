# markdown-sanitize round 9 — issue #195

Branch: `markdown-sanitize-r9`, off `3f6a695`. Eleven commits. Not pushed.

Round 8 was reviewed by three independent legs; all three said do not merge. Two
blockers, one ruling, seven non-blocking items. All addressed.

Gates at the end: `npm test` 0 (**79 checks / 127 assertions**), `tsc --noEmit`
0, `npm run build` 0. Baseline at `3f6a695` was 78/123 and matched the brief.

Two files touched: `web/src/util/markdown.test.ts`, and `web/src/util/markdown.ts`
**comment-only** — two false rationales corrected, no executable line changed.

Full evidence, per item, with the mutation tables:
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-r9.md`.

## Blocker 1 — the arity pin, bypassed for the third consecutive round

A TypeScript **template-literal type** is legal in a parameter position.
`stripInertText` preserves template bodies on purpose (`` html`…` `` sinks must
stay visible), and every paren counter in the test file counted RAW characters
over that view. So a `)` inside a template type truncates the captured parameter
list and a `(` swallows it, and both leave `Function.length` at 1 when the second
parameter is defaulted. Measured at r8 head: a `markdown.ts` taking a real second
parameter that turns `FORBID_TAGS`/`FORBID_ATTR` off was GREEN at 78/123 with
`tsc` 0 and `build` 0.

Round 7 fixed `[,=]`. Round 8 fixed `[^)]*`. Each fix was defeated one construct
further in by the same reasoning error: **a counter that does not model the lexer
cannot see what the lexer hides.**

Fixed as a class. `stripInertText` gained a `templateText` option that blanks
template TEXT while keeping `${…}` interpolations — the sinks live in
interpolations — and one shared `literalBlindView` is now used by all five
character-level counters. Four new `ARITY_EVASIONS` pins (13 → 17) including the
bare-string mirror, which stays RED for a *different* reason and is therefore a
genuine cross-axis control.

**The finding that made this a class fix rather than a class-shaped one.** After
the first pass, deleting the blinding inside three of the five scanners was
GREEN — because the caller pre-blinded once, so the inner uses were
unobservable. Three of the five shared call sites the fix exists to create had no
unique coverage at all. The pre-blinding was removed; all six mutations are now
RED with distinct attribution.

## Blocker 1b — the layer that was saving us by accident

`sinkArgumentIsSanitized` rejecting the payload at the call site is the only
reason this was rated HIGH and not Critical, and nobody had designed, documented
or pinned it. It is pinned now, with an in-tree note saying the severity has to be
re-rated in the same commit as any relaxation.

Probing the **call** shape (the audit had held it constant) turned up a live
false positive in the opposite direction: a legal, prettier-emitted
`renderMarkdown(this.body,)` was rejected. Fixed, then pinned by an
eight-entry false-positive table.

## Blocker 2 — B3a had no regression pin

Reverting round 8's headline production change — the private
`createDOMPurify(window)` instance — was GREEN at 78/123 with `tsc` 0, and the
reverted tree reproduced the exploit output quoted in `markdown.ts`'s own
comments. R8/R9 exempt the sanitizer owner by construction, so the one file that
must own its sanitizer is the one file the ownership guard cannot police.

Pinned by effect, mirroring `sharedMarkedSingleton()`: poison the process-global
DOMPurify, assert the poisoning took (positive control, so the check cannot pass
vacuously), assert `renderMarkdown` output is still clean. RED against the
reverted tree, GREEN at head.

**The brief's ordering rationale for it was false.** "An early poisoner
contaminates every later check" — measured, moving it to the top of `run()` is
GREEN. The argument is also circular: it is only demonstrable on a tree where
this check already fails. The check still runs last, but the in-tree reason now
states the measurement.

## The "61 → 69" provenance line

Not a bug. The series silently changes units — 49/54/59/61 are *checks run*,
68/74/77 are *`check()` call sites* — because one call site loops over
`REQUIRED_SINKS`. Unit markers added, the note calling the line broken deleted,
the number unchanged. Re-measuring the series found the divergence begins one
commit earlier than the brief stated, and that the unit switch is at the `68 → 74`
entry rather than at the disputed one.

## Non-blocking items

All seven closed. Two are worth recording here because they generalised:

- **T-9 was five loops, not two.** Every tree-wide rule in the file was written as
  a hand-rolled `for (… of scanned)`. The predicates are all fixtured; the loops
  were not, and a loop that iterates nothing reports nothing. Five of the six were
  GREEN when emptied. The sixth — the one whose output is asserted against a known
  count — was RED, and that is both the contrast control and the design: a loop is
  non-vacuous exactly when something asserts its result for an input whose answer
  is known in advance. A shared `scanTreeWide` now runs each loop twice, once over
  the real tree and once with one poisoned entry appended last, and requires the
  visit count and the planted offender. Same repair as T-4 one level up.

- **Four "eleven" sentences, one of them in production.** All four recounted
  rather than incremented. Then the counting *recipe* written to justify the new
  number turned out to be off by one, because the comment stating the recipe
  contains the string it greps for. A count recipe that counts itself is the same
  defect as a rule derived from the thing it checks — found by running it.

## The pattern this round keeps hitting

Four separate findings this round reduce to one sentence, now written into the
file four times: **a harness that cannot express an input cannot test it.** The
arity blind spot, the emptyable fixture arrays, the vacuous tree-wide loops, and
the pre-blinded scanner call sites are all the same shape. So is the second-order
version: a false sentence produced by inheriting a number instead of recomputing
it. Every sentence touched this round was re-measured against the tree at the
revision it describes.

## Known residuals, stated not hidden

- `sinkArgumentIsSanitized` does not reject a destructured single argument.
  Documented in-tree; closing it needs a real expression parser.
- The function-type evasion pin (`` md: (x: string) => string | `)` ``) is a
  legal fixture but not a viable live payload — planted in `markdown.ts` it fails
  `tsc` with TS2345.
- The per-file R7 cannot distinguish the strings-blanked view from the
  strings-kept view on today's tree; neither sink file has an escape inside a
  string. The tree-wide half can, on `markdown.ts`.

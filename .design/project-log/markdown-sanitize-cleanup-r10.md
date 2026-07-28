# markdown-sanitize round 10 — issue #195

Branch: `markdown-sanitize-r10`, off `13680c2`. Fourteen commits. Not pushed.

Round 9 was reviewed by three independent legs; all three returned REQUEST
CHANGES. The security work was approved on the merits by all three and both r9
blockers were confirmed closed. What blocked was narrower, and it was the same
shape on two axes: **the round's own new controls failed the round's own stated
rule.** The thing that checks the checks was itself unchecked.

Gates at the end: `npm test` 0 (**83 checks / 131 assertions**), `tsc --noEmit`
0, `npm run build` 0, tree clean. Baseline at `13680c2` was 79/127 and matched
the brief.

**One file touched:** `web/src/util/markdown.test.ts`. `markdown.ts` is
byte-for-byte unchanged — `git diff 13680c2..HEAD -- web/src/util/markdown.ts`
is empty.

Full evidence, per item, with the mutation tables:
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-r10.md`.

## The governing idea this round, corrected by measurement

Round 9 shipped a rule of thumb for when a fixture loop is vacuous. The r9 test
leg built a 49-loop census with a real denominator and **falsified it**. The
criterion that survives, and that this round applies, is:

> A loop is non-vacuous under emptying exactly when some assertion requires a
> POSITIVE outcome from it — a non-zero count, a named offender, a specific
> result. A loop whose assertion only ever *permits* an empty result cannot fail
> when emptied, because empty is the expected answer.

Every fix below is an application of that sentence. Where a control could only
ever permit, it was given something positive to require: a count, a census of
names that must be present, a rejection that must have happened.

## The six blocking items

1. **The decide-blinded / report-raw split was unpinned at five sites.** Two of
   the five one-word edits, combined, walked round 8's masking bug back in with
   the suite green at 79/127. Two of the five in-tree rationales were also
   measurably false: `literalBlindView` keeps quote delimiters and backticks and
   blanks only contents, so a trailing literal does **not** blind to whitespace.
   A comment is the only construct that does — which makes those arms defence in
   depth against a caller that stops pre-stripping, not the load-bearing guard
   they were described as.
2. **`run()` asserted an ordering claim retracted one commit later**, and it was
   false for both poisoners. Third consecutive round in which a
   rationale-correcting commit shipped a false rationale.
3. **`scanTreeWide` was blind to its own input.** Handing all five call sites an
   empty view was green. The harness checked what the predicate did and never
   what it was handed. It now observes blank views and a canary, and rejects both
   an empty view and a non-empty junk one.
4. **The vacuity detector had no self-test.** Its whole body replaced by
   `return null` was green.
5. **Its five call sites were unpinned.** Disarming one throw, or all five, was
   green. The brief's suggested remedy — a counter of detector invocations — does
   not catch this, because a disarmed throw still calls the detector. Consulted
   and obeyed are different claims; the census asserts the second.
6. **A count-pin control could be silently disarmed** by emptying its
   perturbation list. Closed with a perturbation counter and an expected total.

## Two green controls found while fixing, and closed

- **D-8.** My first version of the MUST 5 census recorded a rule name when the
  wrapper was *reached*, so dropping only the throw was still green — the exact
  distinction I had just written down, reintroduced one level out. Closed by
  recording only after the throw arm has been passed.
- **The loop/table gap (S1).** With every fixture table size-pinned, leaving
  `SINK_EVASIONS` completely intact and changing its consumption loop to read
  `.slice(0, 0)` was **green**. The size pin reads the declared array; the loop
  reads a different expression; nothing connected them. Twenty-nine loops had
  that shape. `consumeFixtureTable` moves the count onto the value the loop
  actually iterates. Six of the twenty-nine — the evasion tables — are wrapped;
  the rest is a filed remainder, stated in-tree rather than implied.

## One control that lied about itself

Planting the audit's `parseFromString` shape produced two failures: the real
offender, and "tree-wide vacuity control(s) never ran or never threw". The second
was false — the control had not run because the check had already thrown, which
is what a check is supposed to do when it finds something. Fixed by asserting
scan soundness **before** the offender throw at all five sites, which is also the
right order on the merits: an offender list from an unsound scan is not evidence
in either direction.

## Enumeration extended, and labelled as such

`BANNED_SINKS` gained `parseFromString(`, `parseHTMLUnsafe(`, `.setHTML(` and
`XSLTProcessor(`, each with a positive fixture. The audit's finding reproduced
exactly against the r9 head (green there, with an `.innerHTML` positive control
red in the same file). The tree says plainly that this moves the list from eight
spellings to twelve and moves the class not at all, that two of the four are
chokepoints rather than raw sinks, and that `.setHTML` is banned for ownership
rather than danger.

## Recurring lesson, now three rounds old

Every round since 8 has shipped at least one **false rationale in the commit that
was correcting a false rationale**. Round 10 caught three of its own before
commit — the trailing-template claim, the `.toLowerCase()` claim in the new
event-handler control, and a claim that an early `break` would be caught by an
arm that a `break` makes unreachable. The only thing that caught them was
measuring the sentence before writing it down. A rationale is a claim; it needs
the same evidence as an assertion.

## Known open, deliberately

- 23 of 29 fixture-consumption loops are still unpinned to their tables.
- The property-bag gap in `sinkArgumentIsSanitized` (P10) is open by design,
  documented now at both layers. Closing it needs an expression parser. If the
  declaration-side rule is ever relaxed, it becomes load-bearing.
- `BANNED_SINKS` remains an enumeration, not a proof of absence.
- Nothing pins the two `run()` censuses or the two totals. That is the terminal
  position, and it is why all four live in `run()` rather than in a check that
  could be hollowed out.

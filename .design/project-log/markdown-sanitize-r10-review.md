# markdown-sanitize round 10 — code review (correctness + architecture leg)

Reviewed `markdown-sanitize-r10` @ `0b52dcd` (range `13680c2..0b52dcd`, 15 commits).
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r10.md`.

**Verdict: REQUEST CHANGES**, on two findings only. Everything else in the round I would
merge as-is.

## Gates, re-run in a clone installed from scratch

`npm ci` 0; `npm test` 0 (83 checks / 131 assertions); `tsc --noEmit` 0; `npm run build` 0;
tree clean. The round's reported baseline is confirmed on all four rows. `markdown.ts` is
byte-for-byte unchanged — blob `4f39481a731357abd29926e95d121cf944d11a4e` at both ends.

Four mutation cells, reverted by snapshot `cp` rather than `git checkout`. Tree dirty after
restore in **0 of 4**.

## The two blockers

**R1. The loop census has a hole at `OWNERSHIP_EVASIONS` (`markdown.test.ts:5142`, `:5150`).**
It is the only wrapped table consumed by two loops, and both register the same census key,
so either satisfies the census alone. Deleting the whole second loop — the "owner is exempt,
and only the owner" assertion — is **green at 83/131, byte-identical to baseline**. The
docblock at `:5525–5530` claims this census "proves the loop exists at all" and catches "a
deleted loop inside a surviving one". That is the exact mutation, and it is green.

Impact is narrower than it first looks, and the report says so: the owner-exemption
*behaviour* is still covered indirectly (deleting the loop *and* the exemption branch goes
red, because the live scan flags `markdown.ts`). What is lost silently is the per-fixture
assertion over all ten spellings.

Fix: distinct census keys for the two loops, one hoisted size constant, and —
the durable half — make `consumeFixtureTable` throw on duplicate name registration, so the
class cannot recur silently across the 23 loops still to be wrapped.

**R2. The corrected docblock at `:3350–3356` is still false.** It says the trailing
`yielded !== expected` arm is "reachable from a `throw` inside the loop body caught
upstream". Measured: a body `throw` triggers IteratorClose → `generator.return()`, exactly as
a `break` does, and execution never resumes past the `yield`. Positive control — the arm is
not syntactically dead: mutating the table mid-iteration does reach it.

This is the third consecutive round shipping a false rationale inside a rationale-correcting
change, the pattern this file's own log names at lines 97–105. Notably `753cd78`'s **commit
message** is correctly scoped ("unreachable from a break"); only the in-tree comment
over-reaches. The self-test itself is correct and should stay.

## What the round got right

`e510d40` does exactly what it says at all five sites, and the ordering is right on the
merits. The core mechanism genuinely works — a `break` in a singly-consumed loop is red with
a diagnostic that names the table and says what to do. The in-tree count recipe (24 − 7 = 17)
verifies in every term. The six `fixtureTableViolation` removals are real. Four commit
messages spot-checked against their diffs, all accurate, including one that volunteers its
own first draft was refuted and one that corrects an undercount upward.

## Architecture, recorded for whoever picks this up

The file is 5583 lines with 82 `check()` call sites, roughly thirty of which now test the
harness rather than the sanitizer. A new contributor cannot add a rule without reading a
large fraction of it. The extraction to make is a harness module — `scanTreeWide`,
`stripInertText`, `literalBlindView`, the two pins, `assertTreeWideScanSound`, `check`/
`assert*`, both censuses — leaving rules and fixtures in `markdown.test.ts`. The harness
self-tests then become an ordinary test of an ordinary module, which dissolves the recursion
instead of adding another level to it.

## Recommendation on the sequence

**Stop this axis after R1 and R2 land.** The yield is real but it is now entirely in the test
harness; the sanitizer has been stable for several rounds. Two facts drive this: nothing
automatically runs this suite (no CI exists; no Makefile or Dockerfile target invokes
`npm test`), so the marginal value of a tenth pin layer is bounded by how often a human types
it — wiring `npm test` into the build would buy more than wrapping the remaining 23 loops.
And the remaining product risk is the one the log already names: `BANNED_SINKS` is an
enumeration, not a proof of absence. **#18, the allow-list inversion, is where round 11
should go.**

# URL Scheme Validation — Round 8 Fix Leg

Date: 2026-07-29
Branch: `url-scheme-validation-r8`
Base: `e4e3d13`
Commits: `d739c06`, `253ab14`, `3961f30`, `6a0b8bd`, `af9ea8c`, `5e8b826`,
`4026dca`, `6e2c4aa`, `1cba5b5`, and the one carrying this line.

> That last clause is deliberate and inherited from the R5 log, which worked out
> why: **a log cannot cite the SHA of the commit that carries it.** Writing the
> SHA in changes the tree, which changes the SHA. The fixpoint is real and no
> amend closes it.

Verdict: **five items closed, F1 TYPECHECK-VERIFIED, two conditions open and
routed.** Not pushed.

> **AMENDED IN r9 (test finding F11).** This line and the one under "Three
> things a later leg should know" both read "F1 VERIFIED" when written. The
> word was too strong for the instrument: what was run was `tsc`, and a
> typechecker cannot observe a behavioural change. The two words are corrected
> in place rather than annotated-only because an unqualified "VERIFIED" is the
> kind of claim a later leg reads once and does not re-derive; the correction
> has to be where the claim was. What the amendment does *not* do is weaken the
> r8 result — see the amendment note in that section for what r9 measured.

---

## The correction this round owes the previous one

The R7 log's summary line says "all non-blocking items done." **It was not true —
one was outstanding, which is how it became audit condition 7.** R7's own audit
caught it. The line is left standing in that file because it is the durable
record of a closed round and rewriting history is worse than annotating it; this
paragraph is the correction. Condition 7 is now discharged (commit `3961f30`).

## What was wrong, and what this round did

The r7 leg shipped a security *argument* into the tree — a two-conjunct model of
why the GitHub write path is unreachable — and the argument had defects of fact.
Not exploitable: zero Critical, zero High at `e4e3d13`. But the round intends the
prose to be relied on, so its accuracy is the control.

1. **Citations.** 47 citations enumerated; **12 demonstrably stale**, 15
   re-anchored by identifier. The adjudication said five. It was not careless —
   it was the honest output of a regex that could not see bare `:NNN` forms or
   extensionless targets. A wider instrument found more.
2. **An inert guard.** The r7 web census could not distinguish top-level-only
   pruning from substring pruning, so its guard could not go red. Replaced with
   one that goes red on revert (`t.TempDir()` fixtures), and paired with a run
   showing the *old* test staying green under the *same* mutation — red exactly
   where the old one was blind.
3. **A producer count.** "The two producers" was wrong on the facts (there are
   three) and wrong in kind: a count is a population claim with nothing guarding
   it. Replaced by the conjunction it was trying to express.
4. **A false "TWO LIMITS."** The list was not exhaustive. Now open-ended, with
   the third limit written down.
5. **F1 — the round's only behavioural change.** `isCollectionWritable` tested
   the `writable` flag but not the platform. Its callers exclude FARMTABLE, so
   its effective predicate was "not FARMTABLE and writable" across an enum with
   six other values. Now requires `Platform.GITHUB`, matching `getCapabilities`.

## Three things a later leg should know

**F1 IS TYPECHECK-VERIFIED, AND THE INSTRUMENT THAT VERIFIED IT IS NOT THE
OBVIOUS ONE.** A build token was granted after the commits above landed. `npx
tsc --noEmit` is green, `--listFiles` proves `ft-app.ts` was actually loaded,
and a deliberate type error planted on the exact changed line drives tsc RED
naming that line -- restored from an out-of-repo backup and re-confirmed green
by hash. `npm test` is green too, 4 files, 380 assertions.

> **AMENDED IN r9 (test finding F11): the word was "VERIFIED" and the
> instrument was a typechecker.** Everything in the paragraph above is a
> measurement of *types*, and a type error planted on a line proves that tsc
> reads the line -- not that the line does anything. The r8 round's own next
> paragraph says as much about `npm test`; the same scepticism was owed to
> `tsc`. Nothing in r8 observed the F1 behaviour change fail when reverted,
> because at r8 no test could reach `isCollectionWritable` at all: it was a
> private method on `FtApp`.
>
> **r9 closed that gap and the claim can now be made on stronger evidence.**
> `isCollectionWritable` was lifted into `web/src/capabilities.ts` and exported,
> and `web/src/capabilities.test.ts` pins it. Reverting the three lines of
> `af9ea8c` drives that file RED, observed over three interleaved
> reverted/fixed pairs in a throwaway clone outside `/workspace`:
>
> ```
> Error: af9ea8c GUARD BREACHED: platform UNSPECIFIED with an explicit writable
> flag is treated as WRITABLE. ... (got true, want false)
> FAIL: 1 of 5 test file(s) failed:
>   src/capabilities.test.ts (exit 1)
> ```
>
> Reverted arm EXIT=1 in 3 of 3 pairs; fixed arm `PASS: 5 test file(s), 483
> assertions.` EXIT=0 in 3 of 3. No pair disagreed. Every individual run is in
> `reports/dev-xss-r9-fix.md`.
>
> One detail from the paragraph below survives r9 intact and should not be
> misread as fixed: `tsc -p tsconfig.test.json --noEmit --listFiles | grep -c
> ft-app.ts` still returns **0**. The test suite reaches the predicate through
> `capabilities.ts`, which the test config now does load. `ft-app.ts` is
> reached only as *text*, read from disk by §3 of the new test file -- which is
> why that arm is a source assertion and not an import.

**But `npm test` could never have verified F1, and a later leg needs to know
why.** `tsconfig.test.json` sets `include: ["src/**/*.test.ts"]`. TypeScript
reaches a non-test file only by import, and no test imports `ft-app.ts`:
`tsc -p tsconfig.test.json --listFiles | grep -c ft-app.ts` returns **0**, while
the root config returns **1**. A green `npm test` says nothing whatever about
this change. Use `npm run typecheck`.

**NEITHER CONJUNCT IS WELL PINNED, AND THAT IS BIGGER THAN ANYTHING ON THE
CHECKLIST.** `getCapabilities` and `isCollectionWritable` have **zero** test
coverage — no test file references either. Conjunct A's rejection *is* pinned,
but by four unnamed lines inside `TestRPC_ImportExportCollection_Errors` that
assert a gRPC code and never name the security property. Two review rounds have
polished the prose describing a gate whose browser half no test touches, and F1
landed in that half. One named test per conjunct is the obvious next move; it was
not done here because the brief bounds this round to five items.

> **AMENDED IN r9: the browser half is now pinned; conjunct A's is not.** This
> paragraph is annotated rather than left standing because r9 is the round that
> falsified half of it. `web/src/capabilities.test.ts` now covers both
> `getCapabilities` and `isCollectionWritable` and pins their agreement across
> the platform enum, so "zero test coverage -- no test file references either"
> is no longer true of the web half. The rest of the paragraph stands verbatim:
> conjunct A's rejection is still pinned only by four unnamed lines inside
> `TestRPC_ImportExportCollection_Errors`, and no r9 item touched them.

**GREP IS NOT AN ORACLE, AND IT COST FOUR ERRORS IN ONE SMALL ROUND.** Item 3
cannot be verified by `grep -c 'two producers'` — a prohibition must quote what
it forbids, so the count is 2 before and 2 after, forever; use `grep -B1` and read
the composition. I also read a grep miss as absence of test coverage and had to
retract it. A `--include=*.go` was eaten by zsh globbing and the command never ran
at all, which looks exactly like a clean result. And a `gofmt` cell I scoped to a
whole directory falsified a prediction I had made about my own diff. Every one is
the same shape: **the instrument answered a narrower question than the one asked.**

## Deliberately not done

`canEditRelationships` (F2), `EntStore.UpdateCollection`'s census omission (F7),
and `graph_routing.go` (F9) are routed to other legs and were not touched.
**Audit conditions 5 and 6b are exactly F2 and F9 and are therefore still open** —
this leg obeyed the routing rather than the inherited checklist, and is not
claiming them.

`internal/server/scopes.go` is unformatted at base and remains so. Fifteen
line-number citations remain in `convert.go` and neighbours; all fifteen resolve
today, but they sit in a file that tells the reader in its own voice not to write
them. Re-anchoring them is a round of its own.

Full report, with every measurement and its command:
`reports/r8/dev-xss-r8.md`. Run ledger: `reports/_run-queue-log.md`, cells
R8-01 … R8-15, all pre-registered before execution. R8-11 … R8-15 are the
build-token session and are the only cells in this leg that needed one.

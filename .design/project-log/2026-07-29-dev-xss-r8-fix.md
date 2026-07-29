# URL Scheme Validation — Round 8 Fix Leg

Date: 2026-07-29
Branch: `url-scheme-validation-r8`
Base: `e4e3d13`
Commits: `d739c06`, `253ab14`, `3961f30`, `6a0b8bd`, `af9ea8c`, `5e8b826`,
`4026dca`, and the one carrying this line.

> That last clause is deliberate and inherited from the R5 log, which worked out
> why: **a log cannot cite the SHA of the commit that carries it.** Writing the
> SHA in changes the tree, which changes the SHA. The fixpoint is real and no
> amend closes it.

Verdict: **five items closed, F1 UNVERIFIED, two conditions open and routed.**
Not pushed.

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

**F1 IS UNVERIFIED.** It is TypeScript and this leg held no build token. `npm
test` and `tsc --noEmit` were not run. Static checks only.

**NEITHER CONJUNCT IS WELL PINNED, AND THAT IS BIGGER THAN ANYTHING ON THE
CHECKLIST.** `getCapabilities` and `isCollectionWritable` have **zero** test
coverage — no test file references either. Conjunct A's rejection *is* pinned,
but by four unnamed lines inside `TestRPC_ImportExportCollection_Errors` that
assert a gRPC code and never name the security property. Two review rounds have
polished the prose describing a gate whose browser half no test touches, and F1
landed in that half. One named test per conjunct is the obvious next move; it was
not done here because the brief bounds this round to five items.

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
R8-01 … R8-10, all pre-registered before execution.

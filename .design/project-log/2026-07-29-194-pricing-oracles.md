# 2026-07-29 — #194 label-write pricing oracles (hardening leg 6/6)

Base `2cbbd92` (`refs/preserve/194-r11/branch`). Branch
`hardening/194-pricing-oracles`. Tests only; no production edit, no remedy
chosen. Full evidence in `reports/dev-194-oracle.md`.

## What this leg was for

#194 had run eleven review rounds and adopted zero remedies, with three
reviewers proposing three prices for the same write. The work was split: the
architect rules the price, this leg proves the defects are real and live. The
oracles are what let *any* remedy be verified, which is why they came first.

## Outcome

Three defects pinned RED, one file:
`internal/server/authz_194_pricing_oracles_test.go`.

| Defect | Oracle | State |
|---|---|---|
| D1 — stage removal priced at zero (Critical) | `TestPricingGate_UnprivilegedCallerCannotRemoveALifecycleStage` | RED at `UpdateTask` |
| D2 — `SameStageSet` order-sensitive | `TestSameStageSet_IsOrderSensitiveDespiteItsName`, `TestPricingGate_AuthorizationDoesNotDependOnCanonicalStageOrder` | RED (both) |
| D3 — over-denial at `InsertTasksAfter` | `TestInsertTasksAfter_DoesNotOverDenyStockGitHubLabels` | RED (1 of 9 stock labels) |

Every oracle has a mutation arm that killed a mutant. Every oracle asserts a
*property* rather than a price, so the architect's ruling cannot invalidate any
of them.

## Three things worth carrying forward

**1. The obvious D2 remedy makes the security hole worse.** Making
`SameStageSet` a genuine set comparison turns both D2 oracles green — and turns
the one masked-removal case that *was* charged `task:close` into FREE, while D1's
oracle stays red. D2 must not be remedied in isolation. This was found only
because D1 and D2 each had a mutation arm run against the *other* defect's
remedy shape.

**2. The trivial D3 remedy re-opens round 7's M-2.** Deleting the
`InsertTasksAfter` rejection turns the D3 oracle green and turns the existing
r11 control `TestInsertTasksAfter_RejectsLifecycleStageLabels` red. D3 needs the
predicate narrowed, not the gate removed.

**3. D3 is not live on `faf1c8c`.** Neither `SameStageSet`,
`LabelDeltaLifecycleStages`, `RestrictLabelWriteToSnapshot` nor
`assertStageWriteAllowed` exists on main, and main has no label-keyed
authorization gating in any of the three RPCs. D3 is introduced by the r11 diff
and dies with it. The corollary is worth stating plainly: on main every label
write is ungated, so r11 is a *partial* fix with a residual hole, not a
regression.

## Method notes that cost other legs a round

**A gate is rarely singular.** The brief named one `SameStageSet` call site;
there are three, in `CreateTask`, `InsertTasksAfter` and `UpdateTask`. Round 9
made the same one-gate framing error and both review legs called it the most
material error in that brief. The oracles are therefore driven by a table keyed
on the owning RPC, cross-checked by `TestPricingGateSiteCensus`, which parses
`server.go` with `go/ast` and fails if the call-site set stops matching the
table. A fourth gate site is now a row somebody must reason about, not a
rediscovery. A row whose exploit is unreachable carries a *verdict* and a
structural pin, not a deletion.

**`go list ./...` returns zero packages in a pristine checkout.** `assets.go:5`
is `//go:embed all:web/dist`; with `web/dist` absent the pattern fails and the
package list is empty, so a `go vet ./...` over nothing is indistinguishable
from a clean run. Use `go list -e ./...` and iterate per package. Denominator
here: **32**. Result: vet 27 clean / 5 failing, all 5 pre-existing (4 embed, 1
the known copylocks quartet). Tests 27 pass / 1 fail / 4 build-fail, where the
single test failure is `internal/server` and is exactly the four intended
oracles out of 971 test functions in that package.

**Empirical beats analytic for finding vectors.** I derived a plausible D1
mechanism by reading, then wrote a throwaway probe that swept
configs × label sets × deltas × stages × open/closed and printed every cell
where the price was FREE while the base `AFTER` was a strict subset of `BEFORE`.
It returned 36 hits including six on **stock defaults**, which is what let the
final oracle avoid config trickery. The probes were deleted before commit.

**Prove the file is inert before claiming it.** `internal/server` was vetted
with the oracle file removed and again with it restored; byte-identical output
both times. Mutations were applied to a scratch copy and reverted, with the
revert verified by an empty `git diff` against the base for every production
path.

# #194 ROUND 12 — EXECUTION RECORD

`dev-194-pricing`, track `farmtable-em-hardening`, 2026-07-29.
Full ruling: `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-pricing-ruling.md` §13.

**ARTEFACT:** the `internal/server`, `internal/platform/github` and
`internal/store` **test binaries**, module `farmtable`. Not a container; not
`ft dashboard`; not `farmtable-server`. Nothing here is a claim about the
deployed service.

**BRANCH** `dev/194-pricing-ruling`, tip `1253e12`, base `2ffc22a` on `2cbbd92`
(r11), **not main**. **NOTHING PUSHED.**

## The ruling in one sentence

> **A safety margin must never live inside a set difference.**

A wider AFTER endpoint is fail-CLOSED for ENTERING a stage and fail-OPEN for
LEAVING one. Round 11 put its config-blind margin on one AFTER endpoint and made
it do both jobs, so leaving a lifecycle stage cost nothing. Its monotonicity
theorem is true and useless: for the departure vector both sides are zero.

```
departed = narrow(before) \ narrow(after)     # READ predicate BOTH sides
entered  = wide(after)    \ narrow(before)    # claim view on the AFTER side ONLY
```

No equality gate, no cross product. `Entered ⊆ wideAfter` by construction, so
every pair charged was already charged by r11 whenever its gate fired; the one
new charge is the masked departure, which is the defect.

**THREE gate sites** — CreateTask, InsertTasksAfter, UpdateTask. Only UpdateTask
is repriced: it is the only RPC accepting `remove_labels`, so the only one a
departure can reach.

## The finding that matters most to anyone touching this later

**D2a's fix is a REGRESSION ON ITS OWN, and the two halves of round 12 are
coupled.** Measured at `037a626` with only the set-semantic `SameStageSet` hunk
applied:

```
masked removal of `completed` -> ALLOWED
read-back: [wont_fix completed] -> [wont_fix]   completed still present? FALSE
```

The elementwise comparison had been catching that vector **by accident of where
`unionStages` appended the restored element**. Making the comparison honest
removes the accident; without the directional split nothing replaces it.

Three-point measurement — **arms 1 and 3 are both green and are NOT the same
green:**

| arm | tree | result | cause |
|---|---|---|---|
| 1 | `037a626` fresh clean checkout, no impl | DENIED | the **ordering accident** |
| 2 | `037a626` + D2a hunk only | **ALLOWED** | accident gone, nothing replaced it |
| 3 | `0904a22`, both halves | DENIED | the **departure mechanism** |

Enforcement is mechanical, not documentary: both halves in one commit, the
oracle reds on the D2a hunk alone (that is arm 2), the oracle's docblock names
arm 2 with its SHA and read-back so the red says *why*, and compile-time
assertions on `LifecycleStageDepartureStager` make a split fail loudly.

## Guard liveness — every arm predicted in writing first

| arm | mutation | observed |
|---|---|---|
| L1 | 4th gate site, no oracle | RED, names the unlisted RPC |
| L2 | `gate` column lies | RED, *different message* |
| L2b | the tempting swap (replace instead of append) | RED, population collapses to 1 |
| L3 | drop **entry** vector in the real `PriceLabelWrite` | RED, 64 cells |
| L3b | drop **departure** vector in the real `PriceLabelWrite` | RED, 108 cells |

L2b and L3b were missing from the first registration and were each added in their
own results-free commit before running. L2b tests the actual condition (ADDITIVE
ONLY) rather than "notices some change" — the docblock warned against the swap,
and a warning is not a control. L3b exists because L3 only breaks the half round
11 already priced.

## Two-sided table — both endpoints fresh checkouts

`before` `037a626` (oracles, no impl) → `after` `1253e12`. **Population identical:
9001 named tests.** pass 8989 → **8996**; fail 12 → **5**.

- **FIXED (8):** D1 + `/UpdateTask`, D2a, D2b, the directional oracle +
  `/departure_is_charged`, and two pre-existing watch flakes.
- **REGRESSED (1):** `TestWatchTasks_ClaimEvent` — pre-existing flake, **1/35 at
  `before` and 1/35 at `after`, identical rates.** First attempt read 0/10 vs
  1/10, which is not a difference and was not reported as one.
- **ZERO pass→fail for a `PermissionDenied` reason.**
- Still red: D3 + `/duplicate` (**predicted RED in advance**, ruled unsound), and
  the watch flake family.

## The defect nearly shipped, and why everything above exists

The first cut of the split was **inert**: `MultiStore` did not forward
`LifecycleStageDepartureStager`, the type assertion **fell back instead of
failing**, `narrowAfter` degraded to `wideAfter`, every departure computed empty.
No compile error, no other test complaining.

**Had I run only my own new oracle and not the full suite, I would have shipped a
dead gate that looked fixed.**

Day's dominant defect class, hit three times in one hour on this track: **THE
SIGNAL EXISTS AND CARRIES NO INFORMATION** — the falling-back type assertion, the
verbatim copy mistaken for a stale replica, and an oracle that was green with and
without the fix.

## Rules this produced, adopted track-wide

1. **When the meaning of a pre-registered outcome changes under you, the
   pre-registration is VOID for that decision. Re-register. Do not silently
   reinterpret.**
2. **Strike through, never delete** — code, claims and superseded arguments alike.
   The withdrawn D1+D2b composition is struck, not removed: it is still true, it
   is merely no longer load-bearing.
3. **Widen the window, never delete the assertion** (agreed for
   `TestWatchTasks_NoInitial` before any red existed to make deletion look
   reasonable).

## Not mine, filed not followed (scope frozen)

- **A10:** `internal/store` `-race` flake, `entgo.io/ent`'s own package globals in
  `Atlas.setupTables` under concurrent `migrate.Create()`. ~3/5 at base
  `2ffc22a`, ~4/5 at `0904a22` — measured at both **because I had edited
  `multistore.go` and was not entitled to assume "pre-existing."** Reds only
  under whole-package load; run alone it is green and will wrongly clear.
- `go build ./...` fails at base and tip on the absent `web/dist` embed; all
  builds package-scoped. `go vet` copylock quartet, exactly 4, unchanged at both
  endpoints.
- D3 left open and **ruled unsound as written**: its premise is measurably false
  (`MapLabelsToStage("duplicate") = (duplicate, true)`), it demands PERMIT under
  scopes lacking `task:accept` (a triage bypass), and it edits **the decision**
  rather than the facts the decision is applied to.

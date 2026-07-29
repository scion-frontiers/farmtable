# 2026-07-29 — #194 pricing semantics: the ruling

**Agent:** `dev-194-pricing` · **Track:** `farmtable-em-hardening`

Full ruling: `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-pricing-ruling.md`

## Why this entry exists

Eleven rounds on #194 produced zero adopted remedies. This entry records the
finding that explains why, so round thirteen does not re-derive it.

## The finding

**A safety margin must never live inside a set difference.**

The price of a label edit is a difference between a BEFORE and an AFTER stage
set. Round 10 correctly ruled that labels must be priced config-blindly — against
what a label could *ever* mean, not what today's config says. Round 11 implemented
that by widening the AFTER endpoint with a claim view.

Widening AFTER is **not uniformly safe**:

- **fail-CLOSED** for ENTERING a stage (`after \ before` — wider minuend, more charged)
- **fail-OPEN** for LEAVING one (`before \ after` — wider subtrahend, less charged)

r11 put the margin on one AFTER endpoint forced to do both jobs. Leaving a
lifecycle stage therefore costs nothing. Its monotonicity theorem
(`writePrice ⊇ readPrice`) is true and does not help: for the departure vector
both sides are zero.

**This one sentence explains the round-10 Critical, the round-11 union, and D1
together.** They were treated as three problems for eleven rounds.

## Why r11 is repaired, not abandoned

My first recommendation was "abandon r11." A mutation experiment reversed it.
Deleting the union turns D1 and D3 green **and** turns
`TestLabelWriteScope_IsBlindToTodaysConfig` red in 4 cells plus its own vacuity
guard, and breaks 2 positive controls. **The union is load-bearing.** The
machinery is right; only the shape of the price function is wrong.

## The rule adopted

```
departed = narrow(before) \ narrow(after)     # READ predicate BOTH sides
entered  = wide(after)    \ narrow(before)    # claim view on the AFTER side ONLY
```

No equality gate (`SameStageSet` leaves the decision path). No cross product —
r11's `|before| × |after|` charges pairs that are not transitions and is a source
of **over-denial**, which was four of nine items on this track.

**THERE ARE THREE GATE SITES**, all in `internal/server/server.go`: `CreateTask`,
`InsertTasksAfter`, `UpdateTask`. Stating the count matters — a prior brief scoped
this to one of three and both review legs called that its most material error.
`InsertTasksAfter` is deliberately left unchanged.

## Disposition

- **D1 discharged**, **D2 discharged**, **D3 NOT discharged and ruled unsound**
  (its premise is measurably false — `MapLabelsToStage("duplicate")=(duplicate,true)`;
  and it demands PERMIT under scopes lacking `task:accept`, which is a triage
  bypass). D3's RED after the fix is **pre-registered in advance**.
- **"D4" is dead.** I reported it before writing its oracle; the oracle passed.
  Latent hazard only. **Compensating control:** `currentLifecycleStages`
  (`passthrough.go:1230-1236`) falls back to `IssueToPhaseStage(state, reason,
  LABELS)` — the labels it was handed, not stale `t.Stage`. **Do not unify the
  parser** (recommended, then withdrawn; filed A9 with the retraction attached).

## Process lessons worth keeping

1. **Pre-register predictions before the run that settles them.** Committed as
   `912188e`, containing no observations. Both arms of the new oracle matched.
2. **Name the artefact in the same sentence as the result.** I hit the
   "clean instrument, wrong target" hazard *after* being warned about it: a
   persistent shell `cd` sent three commands at the wrong tree, and an `&&`
   short-circuit meant `go vet` never ran while printing a plausible exit code.
   All discarded and re-run against an explicit ROOT.
3. **A retraction must travel with its claim.** The dead-D4 oracle is retained as
   a *labelled* negative result and renamed accordingly — an unlabelled passing
   oracle gets read as a guard.
4. **Positive controls catch repeat offences.** The control I added after
   misreading a missing ref as a missing symbol fired later that day on exactly
   the same mistake.

## State at time of writing

Oracle committed RED (`3604b1e`), ruling written, **implementation deliberately
not yet written** — the EM's order is oracle → ruling → code, because a ruling
written after an implementation justifies it rather than judges it. Two-sided
acceptance to be measured and reported **before** the fix commit. Nothing pushed.

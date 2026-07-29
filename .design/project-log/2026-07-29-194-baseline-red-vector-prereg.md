# PRE-REGISTRATION — does a vector exist on which ROUND 11 PERMITS a masked departure?

Written by `dev-194-pricing` BEFORE the run that settles it, per EM ruling
2026-07-29T16:04:52Z. **This file and its commit contain NO results.**

The EM declined to rule (A) or (B) and instead ordered the measurement in my own
item 2, on the grounds that **(B) run blind would produce an oracle that reds on
nothing real** — a guard whose failure mode is that it can never fire, which is
the exact defect class this track has spent the day removing.

## ARTEFACT

- **ARTEFACT:** the `internal/server` test binary, module `farmtable`. Not a
  container; not `ft dashboard`; not `farmtable-server`.
- **BASELINE UNDER TEST:** `037a626` — oracles present, **round-12
  implementation ABSENT**. That absence is the whole point: `037a626` is
  precisely the checkout my existing direct oracle cannot go red at.
- **MECHANISM READ AT:** `2ffc22a` (r11 as shipped), base `2cbbd92`. Not main.

## THE MECHANISM, READ NOT ASSUMED (at `2ffc22a`)

```go
SameStageSet(a, b)  // len check, then a[i] != b[i] — POSITIONAL, not a set op
after = unionStages(currentLifecycleStages(rawAfter),      // primary: narrow
                    writeView.claimedStages(canonical…))    // extra:  wide
unionStages: preserves PRIMARY order, APPENDS what only extra names
AllTerminalLabelStages: sort.Slice(out[i] < out[j])  // LEXICOGRAPHIC
IsTerminalStage: completed, wont_fix, duplicate, cancelled
  sorted:        cancelled < completed < duplicate < wont_fix
```

So **`wont_fix` is the canonically LAST terminal stage** and `cancelled` the first.

## THE CHARACTERIZATION — THIS IS THE POPULATION, AND WHY IT IS THE SET

Round 11's gate fires iff `!SameStageSet(before, after)`. It therefore **PERMITS**
exactly when `union(narrowAfter, wideAfter)` equals `before` **AS A SEQUENCE**.
Write `D = before \ narrowAfter` for the genuinely departed stages, `D ≠ ∅`.

1. **Set condition.** `wideAfter` must hand `D` back, or the sets differ and the
   edit is charged. So the departure must be **MASKED** — a markerless add the
   read predicate ignores and the write view honours.
2. **Order condition.** `union = narrowAfter ++ sorted(D)`, and `before` is
   sorted. A sorted list concatenated with a sorted list is sorted **iff**
   `max(narrowAfter) < min(D)`. Therefore **`D` MUST BE A CANONICALLY FINAL
   SUFFIX of `before`.**

**THAT IS THE WHOLE POPULATION: masked departures of a canonically-final suffix.**
It is not a sample — it is a derivation from the two order-producing functions,
and it is falsifiable by the negative half below.

**It also retro-explains my existing oracle.** That one departs `completed` from
`{completed, wont_fix}` — a **PREFIX**, so the order condition fails, the
sequences disagree, and r11 denies **by accident**. My oracle has never been able
to red at baseline because it tests the half of the population r11 accidentally
covers. **This is a hole in my oracle, not a property of round 11 — IF the
suffix case is reachable.**

## THE CANDIDATE VECTOR

```
labels  [ft:stage/completed ft:stage/wont_fix]   before = [completed wont_fix]
add     [stage/wont_fix]        markerless — read predicate ignores it
remove  [ft:stage/wont_fix]     authoritative spelling, really removed
scopes  {task:read task:write task:claim collection:read}   no accept, no close

narrowAfter = [completed]                       wont_fix genuinely gone
wideAfter   = [completed wont_fix]              write view still honours it
union       = [completed] ++ [wont_fix] = [completed wont_fix] == before
```

Round 12 prices it `departed={wont_fix}`, `entered={}`, transition
`wont_fix -> completed`, which is `any->terminal` and therefore **`task:close`** —
a scope the caller does not hold.

## BOTH BRANCHES, PRE-REGISTERED. THE EM'S RULING SELECTS, NOT ME.

| outcome at `037a626` | meaning | branch |
|---|---|---|
| **ALLOWED** (`err == nil`), and read-back shows `wont_fix` gone | the vector EXISTS; r11 permits a masked departure; the gap is a **hole in my oracle** | **(B)** — build it, RED here first, then green under the fix |
| **DENIED** | no such vector in this family; the gap is a **PROPERTY OF ROUND 11** | **(A)** — ship, documenting it as a property with this measurement cited |
| denied, but read-back shows `wont_fix` gone | denial is cosmetic; the write lands anyway | STOP and report — a gate that reports correctly and protects nothing |
| fixture `FailNow`, or a non-`PermissionDenied` code | the fixture is wrong | **VOID, not favourable.** Fix, re-register, re-run |

**PREDICTED: ALLOWED, therefore (B).** Recording the prediction so a wrong one is
visible as one. Reasoning is the order condition above and nothing else.

**IF DENIED I OWE A POPULATION, NOT A SHRUG.** A negative with no population
behind it is the failure caught three times today. The negative report must state
which vectors were enumerated and why that set is the set — i.e. the derivation
above, plus which clause of it the measurement falsified.

## MANDATORY SECOND ARM, WHICHEVER WAY THE FIRST LANDS

The prefix case must be run **at the same baseline in the same commit**, as the
**negative control on the characterization itself**:

```
remove ft:stage/completed instead   D = {completed}, a PREFIX
```

**Predicted: DENIED at `037a626`** (the ordering accident). If BOTH the suffix and
the prefix vector are allowed, my characterization is wrong about *why* and the
result is VOID pending a correct mechanism — the finding would be larger than the
oracle. If BOTH are denied, the suffix case is unreachable for a reason I have not
identified and I do not get to call that (A) until I know what it is.

## NOT AT ISSUE

D1, the direct oracle and the monotonicity pin already carry the departure
vector. **L3b came back RED, so the pin is NOT blind to departures** — I had
feared it might be, wrote that fear down in the L3b registration, and checked.
Nothing below depends on this measurement; nothing is blocked behind it.

# PRE-REGISTRATION — widened bulk-capture sweep of the corpus (EM-303)

Written **BEFORE** running the sweep. Discharges the numeric prediction owed to the
coordinator. The narrow sweep (two spellings) was already run and returned 9 hits / 7
files; **a prediction over that would be a receipt composed after the event (EM-290)**,
so this pre-registers the *widened* sweep, which has not been run.

## ROOTS THE ENUMERATOR WILL WALK — AS PATHS, per §32.4

```
/scion-volumes/scratchpad/projects/farmtable/briefs
/scion-volumes/scratchpad/projects/farmtable/reports
/scion-volumes/scratchpad/projects/farmtable/em-tooling
```

## PREDICATE

Every `*.md` file under those three roots, minus `em-tooling/audit-195-r7-artifacts/`
(built JS/CSS assets, not authored prose). Matched against the widened spelling set:
`git add -A`, `git add .`, `git add -u`, `git stash`, `git commit -a`, `git commit -am`.

**THE PREDICATE IS NOT THE POPULATION AND I AM STATING BOTH** because the whole reason
§32.4 exists is that I declared one and implemented the other on the largest number
produced tonight.

## PREDICTIONS — falsifiable, numeric, registered before the command runs

- **P1. FLAGGED = 0.** Zero *live instructions* directing a leg to perform a bulk
  capture, other than the already-suspended `em-tooling/snapshot-live-leg.md`.
- **P2. ENUMERATED is between 5 and 25** total hits across the widened set.
- **P3. `git stash` appears in at least 1 file** — it is the construction that defeated
  the original two-spelling ban, so the corpus should show it somewhere.
- **P4. The widened set finds at least 1 spelling the narrow set missed.** If it finds
  zero, the widening bought nothing and the property is doing no work the list did not.

## FALSIFIERS

- **F1. Any live bulk-capture instruction found.** Then §32.1 landing in four files is
  insufficient and a second pass is required tonight, before r8 dispatches.
- **F2. ENUMERATED = 0.** A filter that matches nothing silently passes everything.
  Zero is not a pass, it is an instrument failure, and the control below exists for it.
- **F3. ENUMERATED > 200.** A filter that matches half the corpus is not a filter.

## ABORTING CONTROL — §32.2, must fire in the SAME invocation

Known-positive: `em-tooling/snapshot-live-leg.md` contains `git add -A` in its fenced
procedure block. **If the filter does not return that file, the run ABORTS and reports
nothing.** A detector that has not returned YES in this invocation is not known to be
running.

Negative control: `git add --patch-this-does-not-exist` must return zero hits, or the
matcher is looser than stated.

## PROOF THE COMPARISON WAS FED — §32.3

Publish `FILES ENUMERATED` and `FILES SEARCHED` as integers and assert equality.
A zero-length comparison that prints "0 hazards" is the void-harness shape.

# #194 round-4 independent TEST REVIEW — verdict APPROVE

**SHA reviewed:** `03ab6b6` (parent `651da26`) on `close-label-swap`
**Leg:** test review, one of three independent round-4 legs
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r4.md`
**Date:** 2026-07-28

## Verdict

**APPROVE**, with six non-blocking findings. The round-4 fix is bound to its
tests: **14 of 15** content-addressed mutants KILLED, the single survivor being
a test-side assertion rather than production behaviour. The count pins are
honest and load-bearing, and — the point that mattered this round — they sit
over a schema that demonstrably **can** express the multi-label defect that
rounds 1–3 could not see.

## Method

Content-addressed mutations only, aborting unless the anchor string is unique.
Pristine copies held outside the repo; every mutation applied from pristine so
mutations cannot stack. After each restore: sha256 byte-identity check, empty
`git status --porcelain`, and a positive assertion of the restored property.
Exit codes captured from the child process, never through a pipe. Non-zero rc
with zero `--- FAIL` lines classified INCONCLUSIVE, not KILLED. Tree committed
before every driver run.

Gates at `03ab6b6` reproduce the EM's baseline exactly: build rc=0 (with a
gitignored `web/dist` stub; rc=1 without, which is round-3's still-open F6),
`go test ./...` rc=0, `make race` rc=0, `go vet` rc=1 with exactly the four
pre-existing copies-lock findings in `internal/server/server.go`.

## What the mutation battery established

Reverting `TerminalLabelStage` to the round-3 delegation form (M1):

| Sink | Dev's log | Measured |
|---|---|---|
| Authorization | 104 / 140 | **104 / 140** ✅ |
| Availability | 28 / 28 | **24 / 28** ❌ |
| Claim | 4 / 28 | **4 / 28** ✅ |

Every non-failing cell is accounted for. The 36 surviving authorization cells
decompose as 20 unmasked controls (correctly unaffected) plus 16 triage-masked
cells that pass because leaving `triage` independently costs `task:accept` — a
reason unrelated to the fix. The 4 surviving availability cells are the unmasked
controls, which is why the dev's 28/28 figure is 4 too high.

The **four triage-masked-to-triage cells did fail** under M1. The round-3 blind
spot — the audit PoC held the destination fixed at `accepted` and so could not
see the `from == to` short-circuit — is closed, because the round-4 matrix
varies the destination.

The dev's disclosed 4-of-28 claim result verifies: the gate's first arm is the
positive whitelist `lifecycleStage != task.StageAccepted`, not an
`IsTerminalStage` check. Rewriting it to `IsTerminalStage` (M9) is a no-op for
the suite today (28 pass), but M1+M9 stacked fails 24 — so the 24 "redundant"
cells are genuine latent regression detectors for exactly that rewrite. Keeping
them is correct.

## Findings

- **F-1 Medium** — this project log's round-4 sink table states availability
  28/28; it is 24/28. Overstating the bug you fixed is the mirror of the failure
  mode this workstream keeps hitting.
- **F-3 Medium** — no test in the repository varies `LabelConfig.Stages`. The
  label→stage map is an input to the function under test and has cardinality 1
  across the whole suite. Pre-existing, not a round-4 regression, but it is the
  same *shape* as the round-3 failure: a dimension nobody treated as an input.
- **F-2 Low** — stock GitHub `duplicate` resolves but stock `wontfix` does not;
  the deferred stock-label item is narrower than it reads and only half pinned.
- **F-4 Low** — terminal destinations are excluded from `reopenDestinations()`
  undisclosed (I verified the row is safe); the "mask is never terminal"
  disclosure understates its authorization consequence; two of the four count
  pins omit the factorisation the exemplary one at `:346` states.
- **F-5 Low** — the authorization matrix's label-state-after-refusal assertion
  survived mutation. Explicable (the scope gate returns before any store call),
  so it is a forward guard; it should say so.
- **F-6 Informational** — `TestWatchTasks_*` is a pre-existing load-dependent
  timing flake, unrelated to this diff.

## Note for round 5 (R-B measured, not re-filed)

R-B confirmed by execution and byte-identical under the round-3 body, so it is
genuinely pre-existing as disclosed. Two comments:

1. The proposed round-5 control (recompute the lifecycle stage of the
   post-mutation label set on `AddLabels`) closes the self-service form but not
   the form where the second terminal label is applied on GitHub directly,
   never passing through the API.
2. The `from == to` short-circuit is in tension with the deliberate round-2 fix
   that keeps terminal restamping at `task:write`. The distinguisher is
   **cardinality of the terminal set**: short-circuit only when the source label
   set names at most one terminal stage.

## Salvage

`test-194-r4-mutate.py`, `test-194-r4-run-mutants.sh`,
`test-194-r4-inputdomain_probe_test.go`, `test-194-r4-heldconstant_probe_test.go`
under `/scion-volumes/scratchpad/projects/farmtable/salvage/`.

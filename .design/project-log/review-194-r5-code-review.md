# #194 round 5 — code review leg (independent)

**Target:** `label-write-scope` @ `ea8ac390dad3d2401d65608684e5d6623ab15ac5`.
**Verdict:** REQUEST CHANGES — 3 blocking, all documentation/test. No code defect found.
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r5.md`

One of three parallel legs (code review / security audit / test review). I read no other
leg's report or working files.

## Gate — reproduced, agrees with the EM's

`GO_BUILD_EXIT=0` (after stubbing `web/dist/index.html`), `GO_VET_EXIT=1` with exactly the
four pre-existing copies-lock findings (`server.go:1601/1711/1919/2096`, confirmed by
request type rather than line number), `GO_TEST_EXIT=0`, `MAKE_RACE_EXIT=0`.

## Controls are load-bearing (content-addressed mutation, tree restored + sha256-verified)

| Mutation | Result |
| --- | --- |
| `SameStageSet` → always true (disables B1) | 6 server tests fail |
| `AllTerminalLabelStages` → `out[:1]` (collapses B5) | 2 server tests fail |
| drop the prefix requirement in `authorizationStage` (reverts B6) | 4 server + 3 github tests fail |

No mutation was a no-op.

## Blocking findings

- **F1 —** `labels.go:527-531` claims "callers on a privilege path use
  `AllTerminalLabelStages` instead". Both actual privilege-path callers of
  `TerminalLabelStage` — `ClaimTask` via `issueUnavailableForClaim`
  (`passthrough.go:612`) and `ComputeAvailability` (`:974`), both through
  `LifecycleStage` (`:784`) — do **not**. The code is nonetheless correct: each reduces
  every terminal stage to one boolean, so the tiebreak cannot change its answer. Verified
  by reversing `terminalStagePrecedence` — the winner moved (`completed`→`wont_fix`,
  `duplicate`→`cancelled`) while both answers held. That argument is load-bearing and
  written nowhere, and it silently assumes no future consumer branches on *which*
  terminal stage.
- **F2 —** the log's "Sinks covered" row (`:109-111`) writes `store.LifecycleStage(s)`,
  conflating B5 with B6. B6 reaches `ClaimTask` and `ComputeAvailability`; B5 does not.
- **F3 —** no test drives two terminal labels through `ClaimTask` or
  `ComputeAvailability`. This is the gap that left F1 unrecorded; a replacement test is in
  the report.

Non-blocking: `(#194 round 5)` tagging round-6 work (`labels.go:531`); the push-prefix
default still has three copies (drift fails closed, so not blocking).

## Charge answers

- **Splitability:** keeping B1+B5+B6 together was **right**. Production delta is 169 lines
  of code; the other 2923 insertions are tests, log and comments. B5 forced a rework of B1,
  and B5/B6 share `authorizationStage` — splitting would have flipped the same 12 cells
  twice. The reviewability cost is the 2023-line single test file, not the coupling.
- **Fences:** both edits within what was authorized; fail-open tiebreak loop confirmed
  byte-identical. Round-6 collision risk is textual only, and `matchPrefix()` is a net
  assist to round 6's `hasExternalUnavailableLabel` fix.
- **Seam:** fallback correct; `LifecycleStageSetStager` bundles both methods so no store
  can implement half. Recommend a compile-time assertion for the pass-through store.
- **Test inversions:** coverage preserved and strengthened — both gained positive controls
  the originals lacked. Nothing vanished.
- **Empty prefix:** consistent across all four `PushPrefix` sites; the ruling is right.
- **Over-prediction:** fails closed. Adds-then-removes ordering confirmed at
  `passthrough.go:468-484`; I could not construct an under-prediction.

## Disclosures

My first charge-1 probe was **vacuous** — I reversed the tiebreak, saw the server suite
pass, and nearly reported that as proof. No test drives two terminal labels through those
sinks, so it proved nothing; that vacuity became F3. My first mutation attempt also
**aborted on a non-unique anchor** (the four stage constants also match `stagePrecedence`'s
tail), which a line-addressed edit would have silently got wrong.

Charge 7 is REASONED, not executed. No integration run (no Postgres). All GitHub behaviour
is inherited from comments, not verified against the API.

No production code was modified. Tree verified pristine by sha256 against `git show HEAD:`,
not by `git status` alone.

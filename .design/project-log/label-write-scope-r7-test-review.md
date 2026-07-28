# Label Write Scope R7 Test Review

Date: 2026-07-28
Reviewer role: Test Engineer
Branch: `label-write-scope-r7`
Workspace: `/workspace`
Base: `6ced24e`
Reviewed HEAD: `1d4442f1982b6e03233f1517106d0c369af1afe6`

## Summary

Independent test review of the #194 round-7 combine (leg A authz: A-4, M-1, M-2;
leg B test quality: T-F2..T-F5), conducted by mutation testing rather than
coverage inspection. The question asked was not "is coverage adequate" but
"which assertions can actually fail, and what mutation makes each one fail".

Verdict: round 7's new tests are overwhelmingly live and leg B's four repairs
are verified to have worked. 20 of 23 scored mutations landed on the count
predicted in advance, including M5 = 29 exactly (`authorizationStage` neutered)
and M6 = 2 exactly (A-4 control reverted). Two real gaps found, both in shared
code rather than in the new tests.

Surface excluding `.design/` independently measured at 16 files, +1185 / −117.

## Findings

- **F-1 (High).** `writeLabelSwap`'s error propagation — the only behaviour the
  round-7 refactor introduced — was unpinned repository-wide. Swallowing both
  error returns while still performing the writes left `go test ./...` at exit
  0 with zero failures. Cause is structural: `failLabelWrites` is set at four
  sites, all driving `CloseTask`, and `CloseTask` does not use `writeLabelSwap`
  (it keeps an inline swap that swallows errors on purpose). The
  `internal/server` httptest mock always answers label mutations with success,
  so no server-side test can observe the error either. Closed by the additive
  test file committed with this entry.
- **F-2 (Medium).** `RestrictLabelWriteToSnapshot` losing case-folding on the
  query side produces zero failures repo-wide. The only case-variant coverage,
  `TestUpdateTask_RemovingATerminalLabelIsDeniedWhateverTheCase`, absorbs the
  divergence into a `t.Logf("OVER-PREDICTION (fail-closed): ...")` branch that
  exists for a genuinely different reason (whitespace trimming). Fail-closed in
  direction, so Medium rather than High. Not fixed here — the change belongs in
  the server package's fixture.
- **F-3 (Low, pre-existing).** §1 sweep turned up one new instance of the
  bypass shape: `TestPassThroughCloseTask_LabelWriteFailureStillCloses` injects
  a label-write failure and asserts the stale label survived, but never asserts
  a write was attempted, so it stayed green with every label mutation dead. Its
  sibling `LabelIndexFailureStillCloses` gets this right by asserting the call
  counters. One-line fix recommended, not applied.
- `requireOwnershipTableIsTotal` was probed as the natural "guard nobody
  guards" candidate and found sound: both capability probes fire, the second
  naming `cancelled` through the `allStages` completeness check. Not a finding.

## Verification

- `make web`: PASS (exit 0)
- `go build ./...`: PASS
- `go test ./...`: PASS, zero `FAIL` lines
- `make race`: PASS (exit 0), re-run PASS with the new test file present
- `go vet ./...`: exit 1 on exactly 4 pre-existing `copylocks` findings, all in
  `internal/server/server.go` (1737, 1847, 2055, 2232) — matches the brief
- `TestWatchTasks` re-run 3× on a clean tree after two appearances across 9
  full-suite runs: PASS 3/3, treated as the known flake and excluded from counts
- 23 scored mutations, all content-addressed, every anchor verified unique
  before use, every revert verified against `git diff --quiet`. No harness run
  was voided: no red baseline, no absent or non-unique anchor, no failed
  revert, no build error.

## Changes Committed

- `internal/platform/github/write_label_swap_test.go` (new, additive,
  test-only; no production code modified). Three top-level tests pinning
  `writeLabelSwap`'s error propagation on the `UpdateTask` and `ClaimTask`
  paths, each with a positive control and an attempt-count guard, plus one test
  pinning the removal half inside `internal/platform/github` (the round-7
  coverage-locality question). Proven capable of failing: the both-returns
  mutation goes 0 → 2 red, remove-side alone 0 → 2, add-side alone 0 → 1,
  `remove = nil` 0 → 3, whole component dead 3 → 6.

## Deliverables

- Report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r7.md`
- Predictions (written before each measurement batch):
  `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r7-predictions.md`

## Residual Risks

- `cmd/farmtable-server/main.go`'s `log.Fatalf` on invalid GitHub config — the
  server half of M-1 — has no test. Covering it needs `main()` refactored to a
  testable seam, which is a production change and out of a reviewer's remit.
- Postgres-tagged integration tests were not run; no live instance available.
- The §1 bypass-shape sweep was scoped to `internal/platform/github`. Other
  packages were only ever run as part of `./...` totals.
- `SameStageSet` stage-collapse and the 12-cell custom-prefix write matrix are
  known-open for r8 and were deliberately not probed.
- Two predictions missed and are disclosed in the report: the sweep instrument
  (predicted 8–11 red, actual 7) and one re-run of `remove = nil` against the
  new tests (predicted 1, actual 3 — my own fail-closed attempt-count guard
  fired, which I had not anticipated).

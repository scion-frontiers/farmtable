# test-194 — independent test review of `close-label-swap`

**Date:** 2026-07-27
**Role:** test engineer (independent verification)
**Range reviewed:** `d5db8c4..03bd155`
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-194.md`

## Verdict

**REQUEST CHANGES** — test coverage only. No production change requested; the
`passthrough.go` diff is correct as written.

## What was verified

- **Self-built oracle check (standing defect class): clear.** Tests drive the
  real `CloseTask` / `ComputeAvailability` and the real
  `LabelMapper.StageLabelSwap` built from `DefaultConfig()`. `fakeIssueRepo` is a
  transport stub over the existing `testGraphQLClient` httptest harness — it
  applies whatever label node IDs production puts on the wire and never decides
  which labels to swap. No shadow implementation.
- **Part 1 (label swap) is covered.** Removing the swap block fails 2 tests.
- **Part 2 (closed state is terminal) is independently covered.** Removing
  `|| t.ClosedAt != nil` fails 3 test functions / 7 subtests *with Part 1 intact*
  — including one pure unit test where no write ever occurs and one where the
  label write explicitly fails. The invariant flagged as most at-risk is
  genuinely verified.
- The 435-line suite is real coverage, not padding: ~200 lines are a stateful
  harness shared by four tests, and its statefulness is load-bearing.

## What was found

Three mutations survived the full suite:

1. **Critical —** `issueToTask` setting `ClosedAt` for OPEN issues passes every
   test. Part 2 makes that assignment the sole determinant of terminality, but
   only the CLOSED direction of the premise is pinned. Blast radius is every open
   task disappearing from the ready queue. A ~15-line end-to-end test closes it;
   written and verified during review (passes on HEAD, is the sole failure under
   the mutation).
2. **High —** the `getIssue` re-read fallback is unpinned. Inverting it to
   `return nil, err` passes everything.
3. **High —** the `ensureLabelIndex` failure guard is unpinned. Making it fatal
   passes everything.

Because `CloseTask` looks up its target filtered to `IssueStateOpen`, regressing
2 or 3 turns a successful close into a user-visible error that cannot be retried
(`ErrNotFound`) — the exact trap the ordering design exists to avoid.

Medium/low gaps: no transport-level failure injection (GraphQL-body errors
only), `closeIssue`'s own error branch untested, inverse coverage is
struct-level rather than through the read path.

## Process note

The dev report's mutation output is stale — M2 and M5 were run before the final
commit `03bd155`, so M2 omits a failure that now occurs and M5 cites a line
number that has since shifted. Conclusions were unaffected (and slightly
understated), but the pasted evidence no longer matches the committed tree.
Re-run mutation evidence after the last commit.

## Environment note

`go build ./...` fails from a clean checkout at HEAD *and* at base `d5db8c4`
(`pattern all:web/dist: no matching files found` — gitignored, needs a frontend
build first). Pre-existing, unrelated to this change, but it means the dev
report's `BUILD exit=0` is not reproducible without a pre-built `web/dist`.
Worth confirming CI builds the frontend before `go build`.

## Verification performed

Working tree restored to `03bd155` and confirmed clean after all mutations.
`gofmt -l internal/platform/github/` empty; `go test ./internal/platform/github/
-race -count=1` ok; `internal/store` and `internal/mcp` unaffected.

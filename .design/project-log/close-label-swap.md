# close-label-swap: closed pass-through tasks report available (#194)

**Date:** 2026-07-27
**Branch:** `close-label-swap` (based on `terminal-predicate` @ `d5db8c4`, PR #191)
**Status:** Complete

## Summary

`GitHubPassThroughStore.CloseTask` closed the GitHub issue but never touched
labels. Because `ClaimTask` stamps `ft:stage/working` on an issue, the ordinary
claim-then-close lifecycle left every closed task carrying a non-terminal stage
label. On the next read `IssueToPhaseStage` consults labels *before* real state
for a closed issue, so the task came back as `Phase=in_progress, Stage=working`
and `ComputeAvailability` returned `available=true` with an empty reason list —
a closed task offered as available work.

Two changes, deliberately layered:

1. **`CloseTask` now performs the stage-label swap** the way `UpdateTask` and
   `ClaimTask` already do, so a closed issue carries a label matching its true
   terminal stage.
2. **The pass-through `ComputeAvailability` treats `t.ClosedAt != nil` as
   terminal.** `ClosedAt` is set in `issueToTask` from GitHub's own issue state,
   never from labels, so it holds even when the Part 1 write fails.

Part 1 is hygiene and depends on a write succeeding. Part 2 is the invariant.

## Changes

### `internal/platform/github/passthrough.go`

- **`CloseTask`** — after a successful `closeIssue`, computes
  `mapper.StageLabelSwap(issueLabels(target), stage)` and applies the
  add/remove sets, then re-reads the issue via `getIssue` so the returned task
  reports the post-swap stage rather than the pre-swap `closeIssue` payload.
- **`ComputeAvailability`** — the terminal arm became
  `store.IsTerminalStage(t.Stage) || t.ClosedAt != nil`, with a comment
  explaining why the second arm exists and must not be folded away. This
  mirrors the existing `IsTerminalStage(t.Stage) || t.Phase == PhaseClosed`
  shape in `MultiStore.ComputeAvailability` (`internal/store/multistore.go`),
  including the "do not reduce this to a bare `IsTerminalStage` call" note.

### `internal/platform/github/close_label_swap_test.go` (new)

`fakeIssueRepo`, a small stateful GraphQL fake served through the package's
existing `testGraphQLClient` httptest harness, plus seven tests. See the report
for the fake's stated limits.

## Ordering decision (Part 1)

The close runs first; the label swap is best effort and cannot fail the close.

Close-then-swap can leave a closed issue with a stale non-terminal label — the
exact residue Part 2 was added to absorb, so it is contained. Swap-then-close
can leave an issue that is still **open** on GitHub labelled with a terminal
stage; `ClosedAt` is nil there, so nothing downstream can detect it and the
task silently vanishes from the available queue. The containable failure was
preferred. This also matches `UpdateTask`/`ClaimTask`, which perform the
primary mutation first and discard label-write errors with `_ =`.

## Verification

`go build ./...`, `go test ./...` and `go test -race` on the package all green.
Nine mutations applied and each confirmed to produce failing output before
restoring — full transcripts in the report. M9 targets the pre-existing
`ClosedAt`/`UpdatedAt` fallback in `issueToTask`, which is the premise Part 2
rests on and previously had no test.

## Not done, and why

- **#193 (labels overriding closed state) is not fixed.** The root cause is
  `IssueToPhaseStage` (`labels.go:374-384`) checking labels before real GitHub
  state for a closed issue, compounded by `stagePrecedence` ranking `working`
  at index 0 and `wont_fix` at 7 so the non-terminal stage wins a conflict.
  Part 2 **partially mitigates** it: availability is now correct regardless of
  what the labels say. The reported *stage* is still wrong, so a closed issue
  with a stale label still displays as `working`. Fixing the precedence or the
  label/state ordering changes stage reporting for every GitHub-sourced task
  and needs its own PR. Out of scope here by instruction.
- **`UpdateTask` and `ClaimTask` were not refactored** to share the now
  three-times-duplicated label-swap block. Worth extracting, but it would touch
  two working code paths for no behavioural gain in a PR that gates a deploy.
- **`ListTasks` cannot filter by a terminal stage label reliably** for the same
  precedence reason. Noted, not addressed.
- **Pre-existing `gofmt` drift** in `internal/server/scopes.go`,
  `internal/serverapp/{oauth,tokenrefresh,linkflows_test,unified_test}.go` and
  `internal/streaming/eventbus{,_test}.go` exists at base commit `d5db8c4` and
  was left alone. The two files in this PR are `gofmt` clean.

# audit-194 — security audit of the close-label-swap change

**Range audited:** `d5db8c4..03bd155` (`internal/platform/github/passthrough.go`)
**Auditor:** security-auditor, independent of the implementing agent
**Date:** 2026-07-27
**Verdict:** REQUEST CHANGES (two required items, both small)
**Full report:** `reports/audit-194.md` (scratchpad)

## What was audited

Issue #194: closed GitHub pass-through issues reported `available=true`. The
change has two parts — Part 1 swaps the stage label on `CloseTask`, Part 2 adds
a `t.ClosedAt != nil` arm to `GitHubPassThroughStore.ComputeAvailability`. The
audit asked two symmetric questions: can a closed issue still report available,
and can an open issue be made to report terminal?

## Framing correction

Availability is **not** the enforcement gate in the pass-through store.
`ClaimTask` (`passthrough.go:518`) and `CloseTask` (`:580`) resolve their target
from `listIssues(..., IssueStateOpen, ...)`, so a closed issue yields
`ErrNotFound`; `GetReadyTasks` (`:812`) never calls `ComputeAvailability` at all
and goes through `computeReady`, which already requires `State == "OPEN"` and
`Stage == accepted`. #194 is a reporting-correctness bug in the advisory
`availability` field on `task_get`/`task_list`, not an access-control bypass.
The corollary matters: because the field is advisory, a wrong `false` is as
damaging as a wrong `true`.

## Findings

| # | Sev | Finding |
|---|---|---|
| F1 | Medium | `issueToTask` gates `ClosedAt` on `stateStr == "CLOSED"` (`:161`) while `IssueToPhaseStage` (`labels.go:370`) and `hasOpenSubIssue` (`:568`) read the same field with `EqualFold`. Non-canonical casing restores the #194 bug exactly, `reasons=[]` and all. **Blocking.** |
| F2 | Medium | Part 1 writes a terminal label to GitHub that survives a reopen. Reopened issue: `state=OPEN, closedAt=nil, ft:stage/completed` → `available=false, reasons=[terminal]`. The inverse (denial-of-work) failure the ordering rationale claims to avoid, reached by an ordinary workflow rather than an error path. **Blocking.** |
| F3 | Medium | Three non-equivalent implementations of the terminal rule (`passthrough.go:658` stage‖ClosedAt, `multistore.go:249` stage‖phase, `entstore.go:1103` stage only). `storeForCtx` falls back to the Ent one when platform resolution fails. |
| F4 | High | Pre-existing: `ensureLabelIndex` (`:91-104`) mutates `s.labelIndex` with no mutex on a store shared across concurrent requests via `MultiStore.platforms`. Reproduced under `-race`. Concurrent map access is process-fatal. This PR adds a call site. Not blocking #194; file separately. |
| F5 | Low | Label-write and `ensureLabelIndex` failures swallowed at four points, no logger in the package. Availability stays correct (verified `closeIssue` selects the full `issueNode`, so the fallback payload carries `closedAt`), but remote label drift is invisible. |
| F6 | Low | Swap set computed from the pre-close snapshot (TOCTOU) and a `labels(first: 20)` window; can leave two stage labels → #193. |
| F7 | Low | `ft update --stage completed` already produces a terminal label on an OPEN issue, so the comment at `:613-615` claims more than it can. |
| F8 | Low | The `UpdatedAt` fallback for a null `closedAt` is sound for availability but the synthesised timestamp escapes to proto output, CLI/MCP output and JSON export. |

F9/F10 in the full report record the trust-boundary cases that are handled
correctly, and the absence of any credential/injection/transport surface in the
diff.

## Verified rather than accepted

- `closeIssue` (`graphql_queries.go:293-308`) selects the full `issueNode`, so
  the re-read fallback's payload does carry `state` and `closedAt`. The
  developer's justification for that fallback holds.
- `ClosedAt` is used as a boolean and never compared to a clock, so clock skew
  and remote control of the *value* cannot move the decision. Only presence
  matters, and presence is gated on state (subject to F1).
- Four adversarial tests written against the PR's own fake; two failed (F1, F2),
  one documented F7. Scratch tests removed, tree clean.
- `go test ./internal/...` passes except `internal/cli`, which fails setup on the
  gitignored `web/dist` embed — environmental, unrelated to the change.

## Required before merge

1. F1 — one shared case-insensitive reading of the remote `state` field, plus a
   casing table test.
2. F2 — the symmetric fix (open GitHub state outranks a terminal *label*), or an
   explicit test pinning the current reopen behaviour as a known, accepted
   consequence plus a tracked follow-up.

## Credit where due

The ordering judgement (close first, labels best effort) is correct and the
reasoning given for it is sound. Using `ClosedAt` as a boolean rather than a
timestamp is the strongest decision in the change. The mutation testing —
including M9, aimed at pre-existing code the change depends on — is the right
instinct; F1 is that same instinct applied one line further up, to the guard
that gates the fallback M9 pinned.

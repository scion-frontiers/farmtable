# review-194: independent review of close-label-swap (#194)

**Date:** 2026-07-27
**Branch reviewed:** `close-label-swap` @ `03bd155`, base `d5db8c4` (PR #191)
**Reviewer:** code-reviewer (independent)
**Verdict:** APPROVE — no Critical issues; one High-severity latent follow-up

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-194.md`

## Scope

Reviewed the delta `d5db8c4..03bd155`: the `CloseTask` stage-label swap (Part 1)
and the `ClosedAt`-as-terminal arm in the pass-through `ComputeAvailability`
(Part 2), plus `close_label_swap_test.go`.

## What was verified independently

The developer's report was re-derived rather than accepted. Confirmed from
source: `ClosedAt` originates in `issueToTask` from `issue.State`, never from
labels, so **Part 2 holds independently of Part 1**. Confirmed that
`MultiStore.ComputeAvailability` dispatches to the pass-through implementation
for GitHub collections, so the fixed predicate is the one actually reached.
Confirmed the pre-fix bug: the pass-through returns `Available: len(reasons)==0`
with no phase/stage gate, unlike the MultiStore fallback.

Mutations M1 (remove Part 1), M2 (remove Part 2) and M9 (remove the `UpdatedAt`
fallback) were re-run by the reviewer and all reproduced. The
`TestWatchTasks_*` timeouts were reproduced at base `d5db8c4` and are
pre-existing.

Also verified a claim the report asserted but did not prove: `closeIssue`
selects the full `issueNode` including `State` and `ClosedAt`, so the
`getIssue`-failure fallback path still yields correct availability.

**On silent write failure:** the post-swap re-read means the system reports the
true label state and never falsely believes the swap succeeded. This is a
design strength, not a defect.

## Findings

- **High (latent, non-blocking).** `issueUnavailableForClaim:575` is purely
  label-derived and is shielded only by the callers' `IssueStateOpen` filter,
  not by a truth-based predicate. The natural fix to known residue item 3
  (widening that filter so closing an already-closed task stops returning
  `ErrNotFound`) would make a closed issue with a stale `ft:stage/accepted`
  label claimable — reintroducing #194's bug class in the enforcement path.
  Recommend adding a `t.ClosedAt != nil` arm now, while it is a no-op.
- **Medium.** Four stacked silent error swallows in `CloseTask`
  (`:617, :623, :627, :636`) leave label-write degradation completely
  unobservable. The package has no logger (verified); deferring is accepted,
  tracking is not optional.
- **Medium.** `labelIndex` is an unsynchronized map on a store that `MultiStore`
  caches and shares across concurrent requests. Pre-existing; this PR adds a
  third writer at `:617`.
- **Low.** `labels(first: 20)` bounds the swap; the two `ComputeAvailability`
  implementations use different truth signals (`ClosedAt` vs `Phase`) for the
  same concept, unexplained; the report's M2 mutation output was captured before
  the final commit and omits one failing test.

## Cross-branch conclusion (HIGH-2 overlap with #191)

#194 **partially fixes** the "pass-through trusts labels over real GitHub state"
defect class and does not worsen it: availability is now truth-based, while
`IssueToPhaseStage` (HIGH-1) and `issueUnavailableForClaim` remain label-based.
It is safe to merge with HIGH-1/HIGH-2 open. Merging does not change their
severity, but it does raise the priority of the H1 guard, because it makes the
item-3 cleanup look safe when it is not. Item 4 (`ListTasks` stage filtering)
shares #193's root cause and does not touch the claim path.

## Noted as done well

Genuine independence of the two arms; the close-first ordering judgement pinned
by a test rather than a comment; remove-before-add ordering that fails safe; and
pinning the pre-existing `UpdatedAt` fallback (M9) that Part 2's soundness rests
on — code the developer did not write but correctly identified as load-bearing.

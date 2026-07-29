# Pre-Deploy Fix: GitHub Pass-Through Triage Mapping

**Date:** 2026-07-26
**Branch:** `auth-stage4-predeploy-fixes`
**Builds on:** `auth-stage4-scope-extension.md`

## Problem

`LabelMapper.IssueToPhaseStage` (`internal/platform/github/labels.go`) mapped
every unlabelled open GitHub issue to `StageTriage` as a fallback. After PR #166
added the `task:accept` gate, `ClaimTask` on any triage-stage task returns
`FailedPrecondition` for ALL roles including wildcard/admin. Since the vast
majority of real GitHub issues on pass-through collections carry no `stage/*`
label, this would silently disable `ClaimTask` for the entire pass-through
backend the moment PR #166 deploys.

Found by independent code review (review-scope-ext-v2.md, Important #2).

## Decision

**Option A** (reviewer-recommended): change the unlabelled-open-issue fallback
from `task.StageTriage` to `task.StageBacklog`.

Rationale: an unlabelled GitHub issue was never explicitly triaged — it was
never placed in triage by a human decision, so treating it as
accepted-but-unprioritized (`StageBacklog`, which is in the `stagesAccepted`
group) keeps the existing agent loop working. `StageBacklog` allows `ClaimTask`
without requiring `task:accept`.

## Changes

- `internal/platform/github/labels.go:402` — fallback → `task.StageBacklog`
- `internal/platform/github/labels_test.go` — updated `TestIssueToPhaseStage_Fallback`
  and `TestLabelMapper_Disabled` to expect `StageBacklog`
- `internal/server/scopes.go` — removed the `if userType != ""` guard on the
  warning log in `DefaultScopesForUserType`'s default branch (S3 from re-review:
  empty string is the most dangerous unrecognized type since it silently mints
  a wildcard token)

## Also in this fix (S3)

`DefaultScopesForUserType("")` previously logged no warning because of a
`if userType != ""` guard. Empty string from an unset `user.Type` field silently
mints a wildcard session token — the most dangerous case. The guard is removed
so ALL unrecognized types, including empty string, produce a warning log.

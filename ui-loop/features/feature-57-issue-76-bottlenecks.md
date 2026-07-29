# Feature 57: Fix Bottleneck Detection for `--blocked-by` Edges (Issue #76)

## Status: PR #134 OPEN/MERGEABLE — https://github.com/scion-frontiers/farmtable/pull/134

## Summary

Fixed `GetBottlenecks` in `internal/server/server.go` to seed candidates from both `blocks` (source-side) AND `blocked_by` (target-side) edges, with deduplication. Previously, tasks that blocked others via incoming `blocked_by` edges were silently excluded from bottleneck detection.

## Timeline

- **2026-07-22 21:07** — Worktree created at `/workspace/farmtable-f57` on branch `fix/f57-issue-76-bottlenecks`
- **2026-07-22 21:08** — Developer agent `dev-f57-bottlenecks` started
- **2026-07-22 21:11** — Developer agent completed: bug reproduced before fix, code fixed, test added, fix verified after, committed
- **2026-07-22 21:13** — Code reviewer agent `review-f57-bottlenecks` started
- **2026-07-22 21:15** — Code reviewer completed: **APPROVE**, no critical/important findings
- **2026-07-22 21:17** — Branch pushed to origin
- **2026-07-22 21:17** — PR creation rate-limited (GitHub GraphQL API), waiting for reset
- **2026-07-22 21:34** — PR #134 created: https://github.com/scion-frontiers/farmtable/pull/134 — OPEN/MERGEABLE

## Changes

- `internal/server/server.go`: Added `TargetRelationships` loop + `seen` map dedup to `GetBottlenecks` seeding (10 lines)
- `internal/server/server_test.go`: Added `TestRPC_GetBottlenecks_BlockedBy` regression test (58 lines)
- `.design/project-log/f57-issue76-bottleneck-fix.md`: Project log entry

## Evidence

- Before fix: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-57-issue-76-bottlenecks/before-fix.txt`
  - `ft task bottlenecks -o json` returned `{"items": null}` (BUG)
  - `ft task critical-path` correctly found Task A (control)
- After fix: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-57-issue-76-bottlenecks/after-fix.txt`
  - `ft task bottlenecks -o json` returned Task A with `direct_dependents: 2` (FIXED)
- Review: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-57-issue-76-bottlenecks/review-round1.md`

## Review Outcome

- **Verdict:** APPROVE (Round 1)
- **Critical/Important findings:** None
- **Suggestion (optional):** Add mixed-edge test (not blocking)

## Agents Used

| Agent | Type | Status | Duration |
|-------|------|--------|----------|
| dev-f57-bottlenecks | developer | completed | ~3m 18s |
| review-f57-bottlenecks | code-reviewer | completed | ~2m 25s |

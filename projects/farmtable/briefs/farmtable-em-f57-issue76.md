# Brief: Engineering Manager — Feature 57: Fix Bottleneck Detection for `--blocked-by` Edges (GitHub Issue #76)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f57 -b fix/f57-issue-76-bottlenecks origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **This is a validated, confirmed bug with a confirmed-correct suggested fix** — read the
  validation report below. Your job is to implement it and verify, not re-diagnose.
- **This PR should close GitHub issue #76** — include "Closes #76" in the PR description.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: reproduce the exact CLI repro from the issue before your fix
  (confirm it's broken), then after your fix (confirm `ft task bottlenecks` now correctly
  lists the bottleneck task built via `--blocked-by` edges), plus the reporter's suggested
  regression test passing.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Root Cause (validated, from GitHub issue #76 + coordinator's investigation — full
validation report at
`/scion-volumes/scratchpad/projects/farmtable/reports/issue-76-validation.md`)

`GetBottlenecks` in `internal/server/server.go` (~line 1686-1701) seeds candidate blockers
only from source-side `blocks` edges (`t.Edges.SourceRelationships` where `rel.Type ==
"blocks"`). A task that blocks others via INCOMING `blocked_by` edges (i.e. it is the
TARGET of other tasks' `blocked_by` relationships) never becomes a candidate, so it's
silently excluded from bottleneck detection.

`countDownstream` (same file) already correctly traverses BOTH directions (was fixed in
commit `4dd4fa9`) — the seeding loop was simply not updated to match at that time.

## Task

1. Reproduce the bug exactly as described in the GitHub issue (create Task A, then B and C
   with `--blocked-by A`, run `ft task bottlenecks -o json` — confirm it returns `{"items":
   null}` on current `main`, contrasted with `ft task critical-path` correctly finding
   Task A).
2. Fix `GetBottlenecks`'s seeding loop to mirror `countDownstream`'s traversal: seed
   candidates from BOTH (a) source relationships with type `blocks` (targets are
   dependents) AND (b) target relationships with type `blocked_by` (sources are
   dependents). De-duplicate `direct_dependents` across both directions.
3. Add a regression test that builds its DAG via `--blocked-by`/`AddBlockedBy` (the
   existing `TestRPC_GetBottlenecks` only used `AddBlocks` — per the issue, this test gap
   is exactly why the bug went unnoticed). Keep the existing `blocks`-based test too (don't
   remove coverage).
4. Verify the fix with the exact CLI repro from the issue, confirming `ft task bottlenecks`
   now lists Task A with `direct_dependents: 2`, consistent with `critical-path`.

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Backend: `internal/server/server.go` — `GetBottlenecks` and `countDownstream`.
- Tests: wherever `TestRPC_GetBottlenecks` lives (likely `internal/server/server_test.go`
  or similar).
- Validation report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/issue-76-validation.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-57-issue-76-bottlenecks.md`

## Deliverables

1. Pushed branch + open PR against `main` with "Closes #76" in the description, confirmed
   CLEAN/MERGEABLE.
2. Real evidence: before/after CLI output showing the exact repro from the issue now works.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-57-issue-76-bottlenecks/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-57-issue-76-bottlenecks.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.

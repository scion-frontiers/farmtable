# Brief: Validating Investigator — GitHub Issue #76 (Bottleneck Detection Misses `--blocked-by` Edges)

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-issue76 -b
  explore/issue-76-validation origin/main` (standing policy — running in parallel with
  farmtable-inv-relationship-model's Issue #77 validation in a separate worktree, and
  farmtable-em-f56 in its own worktree — all isolated, no collision).
- **This is a VALIDATING investigation, not a blind fix.** The reporter (external, via
  GitHub issue) already provided a detailed root-cause analysis and suggested fix — your
  job is to confirm it's accurate against the CURRENT codebase (not already fixed by
  recent work) and determine if the suggested fix is correct/sufficient before any
  implementation happens.
- Do not implement the fix yet — report findings first; the coordinator will dispatch a
  fix EM based on your validation.

## Issue Text (GitHub issue #76, scion-frontiers/farmtable)

Title: "ft task bottlenecks returns no results for graphs built with --blocked-by edges"

Summary: `ft task bottlenecks` returns no results (`{"items": null}`) when the dependency
graph was built with `--blocked-by` edges, even though `ft task critical-path` on the same
data correctly identifies the bottleneck.

Repro (embedded/SQLite mode):
```
A=$(ft task create "Task A" -o json | jq -r .id)
ft task create "Task B" --blocked-by "$A" >/dev/null
ft task create "Task C" --blocked-by "$A" >/dev/null
ft task bottlenecks -o json     # {"items": null} — WRONG, should list Task A
ft task critical-path -o table  # correctly identifies Task A as bottleneck (blocks 2)
```

Reporter's root cause: in `internal/server/server.go`, `GetBottlenecks` seeds candidate
blockers only from source-side `blocks` edges (`t.Edges.SourceRelationships` where
`rel.Type == "blocks"`). A task that blocks others via incoming `blocked_by` edges (i.e. it
is the TARGET of other tasks' `blocked_by` relationships) never becomes a candidate.
Meanwhile `countDownstream` in the same file already traverses BOTH directions (source
`blocks` AND target `blocked_by`), which is why `critical-path` sees the bottleneck but
`GetBottlenecks` doesn't — the seeding and the traversal are inconsistent. Reporter also
notes `TestRPC_GetBottlenecks` only builds its DAG with `AddBlocks`, so the `blocked_by`
direction is never exercised by tests.

Reporter's suggested fix: seed candidates from both directions, mirroring
`countDownstream` — source relationships with type `blocks` → targets are dependents;
target relationships with type `blocked_by` → sources are dependents; `direct_dependents` =
count of both, de-duplicated. Plus a regression test using `--blocked-by`/`AddBlockedBy`.

## Task

1. Reproduce the exact repro steps above against current `main` (embedded/local mode is
   fine, use the local-test-protocol's SQLite setup) — confirm the bug still exists as
   described.
2. Read `internal/server/server.go`'s `GetBottlenecks` and `countDownstream` implementations
   to confirm the reporter's root-cause analysis is accurate.
3. Check for any recent overlap with Feature 49 (reciprocal relationship sync fix,
   PR #126) — that was a FRONTEND caching/event bug, not a backend seeding bug, so it's
   likely unrelated, but confirm there's no overlap/conflict with the suggested fix here.
4. Evaluate the reporter's suggested fix for correctness and completeness — does mirroring
   `countDownstream`'s traversal fully solve it? Are there other RPCs/CLI commands with the
   same single-direction-seeding bug pattern that should be checked while we're in this
   code (don't fix them, just note if found)?

## Deliverables

1. A findings report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/issue-76-validation.md`: whether
   reproduced, whether the root cause analysis holds, whether the suggested fix is
   correct/sufficient, and a clear go/no-go + scope estimate recommendation for a fix
   dispatch.
2. A message to the coordinator with the validation summary and recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with findings.
- Do not message ptone@google.com directly.

## Termination
You MUST reproduce (or fail to reproduce) the issue, validate the root cause and suggested
fix, produce the report, and message the coordinator. Then signal task_completed.

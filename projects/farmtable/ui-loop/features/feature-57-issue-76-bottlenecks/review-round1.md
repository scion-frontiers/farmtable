# Code Review: Fix GetBottlenecks blocked_by edge seeding (Issue #76)

**Branch:** `fix/f57-issue-76-bottlenecks`
**Commits:** 2 (e0a8c66 fix, 834ebe7 docs)
**Files changed:** `internal/server/server.go`, `internal/server/server_test.go`, `.design/project-log/f57-issue76-bottleneck-fix.md`

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a clean, minimal bug fix that correctly mirrors the dual-direction traversal pattern already established in `countDownstream`. The change is low-risk — it adds a second seeding loop without modifying any existing logic, and the new test directly validates the previously-broken scenario.

---

## Executive Summary

The fix correctly addresses a symmetry gap between `GetBottlenecks` candidate seeding (which only checked `SourceRelationships` for `blocks` edges) and `countDownstream` (which already checked both directions). Risk is low: the change is purely additive, well-scoped to one function, and all 40+ server tests pass.

---

## Analysis

### 1. Correctness

**The fix is correct.** The seeding loop in `GetBottlenecks` (lines 1686–1700) now exactly mirrors the pattern used in `countDownstream` (lines 1775–1786):

| Direction | `countDownstream` (existing) | `GetBottlenecks` seeding (after fix) |
|---|---|---|
| `SourceRelationships` → `blocks` → `TargetTaskID` | Line 1776 | Line 1690 |
| `TargetRelationships` → `blocked_by` → `SourceTaskID` | Line 1782 | Line 1696 |

The deduplication via `seen` map (line 1687) correctly prevents double-counting when both a `blocks` and `blocked_by` edge exist for the same task pair. The `seen` map is scoped per-task (created inside the `for _, t := range tasks` loop), which is the correct scope — each task independently collects its set of dependents.

**No edge cases missed in the fix itself:**
- Nil `Edges.TargetRelationships`: Go range over nil slice is a no-op — safe.
- UUID zero value in map: not a concern since UUIDs come from the DB.
- The `seen` map guards against the same dependent appearing in both `SourceRelationships` and `TargetRelationships` for the same blocker, which can happen if a user creates both `A blocks B` and `B blocked_by A` (redundant but possible).

### 2. Test Coverage

**Adequate for the bug fix.** The new `TestRPC_GetBottlenecks_BlockedBy` test:
- Creates a bottleneck task (A) and two dependents using `AddBlockedBy` — the exact scenario that was broken.
- Asserts Task A appears as the top bottleneck with `DirectDependents == 2` and `DownstreamCount >= 2`.
- Exercises the full RPC path end-to-end (gRPC client → server → store → response).

**Original test is fully intact.** `TestRPC_GetBottlenecks` (using `AddBlocks` with 3 dependents) is unchanged and continues to pass, confirming no regression in the existing `blocks`-direction seeding.

**Edge cases not covered (acceptable for this PR scope):**
- Mixed edges: a task with some dependents via `AddBlocks` and others via `AddBlockedBy`. The dedup logic handles this correctly by construction, but a test would further validate.
- A task that appears as both a blocker and a dependent (A blocks B, B blocks A — cycle). `countDownstream` already has `maxGraphDepth` protection for this, and it's outside the scope of this fix.

### 3. Code Quality

- **Style:** Consistent with the existing codebase patterns. The new loop follows the exact same structure as the `SourceRelationships` loop and the `countDownstream` function.
- **Comments:** The project log entry (`.design/project-log/f57-issue76-bottleneck-fix.md`) is well-written and clearly explains the root cause, the fix, and the relationship to the prior `countDownstream` fix (commit 4dd4fa9).
- **Naming:** `seen` is clear for a deduplication set. `blocksTargets` retains its existing name, which is still appropriate since the semantics haven't changed — it's the set of tasks blocked by the current task, regardless of which direction the edge was created from.

### 4. Performance

**No regression.** The additional loop over `TargetRelationships` is O(|edges|) per task, same as the existing loop. The `seen` map adds a small per-task allocation, but this is negligible — the map is typically tiny (most tasks have single-digit dependency counts) and is GC'd per loop iteration.

### 5. Regressions

**None detected.** Full server test suite (40+ tests) passes. The change is strictly additive — no existing code paths were modified, only a new loop was appended after the existing one.

---

## Critical Issues

None.

## Important Issues

None.

## Suggestions

- **[server_test.go] Consider a mixed-edge test (optional):** A test where Task A has some dependents via `AddBlocks` and others via `AddBlockedBy` would exercise the deduplication path and confirm `DirectDependents` counts correctly across both edge types. This isn't blocking — the current dedup logic is correct by inspection — but would strengthen the test suite.

## What's Done Well

- **Exact pattern mirroring:** The fix precisely mirrors `countDownstream`'s dual-direction traversal, making the code easy to verify by visual comparison. This is the right level of consistency.
- **Defensive deduplication:** Adding the `seen` map proactively handles the edge case where both directions of the same dependency exist, even though the application may not currently create such redundant edges. Good defensive coding.
- **Project log:** The `.design/project-log/` entry is thorough and traces the root cause back to the original `countDownstream` fix, providing excellent context for future maintainers.
- **Minimal diff:** Only 10 lines of production code changed, no unnecessary refactoring. The fix does exactly what's needed and nothing more.

---

## Verification Story

- **Tests reviewed:** Yes — both existing `TestRPC_GetBottlenecks` (intact) and new `TestRPC_GetBottlenecks_BlockedBy` verify the correct behavior.
- **Build verified:** Yes — `go build ./...` compiles cleanly.
- **Tests pass:** Yes — all server tests pass (`ok github.com/farmtable-io/farmtable/internal/server 0.409s`).
- **Lint/static analysis:** Not run (no linter configured in CLAUDE.md); build is clean.
- **Security checked:** Yes — no security-relevant changes (no new inputs, no auth changes, no external calls).

---

**Final Verdict: APPROVE** — Clean, minimal fix that correctly addresses the reported bug. Ship it.

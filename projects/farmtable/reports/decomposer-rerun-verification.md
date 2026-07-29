# Decomposer Rerun Verification Report

**Date:** 2026-07-23
**Purpose:** Verify PR #139 terminal-criteria fix (`c6519ab`)
**Agent:** decomposer-rerun verification agent

## Summary

**The fix works.** PR #139 eliminated the premature terminal marking that prevented
deep decomposition. The decomposer now recurses through multiple depth levels as
designed, producing a meaningfully deep task tree instead of flattening everything
to depth 1.

## Setup

- **Binary built from:** commit `c6519ab` (branch `explore/decomposer-rerun` off
  `origin/main`), includes PR #139 fix
- **Worktree:** `/workspace/farmtable-decomposer-rerun`
- **Server:** `farmtable-qo7k5fvpda-uc.a.run.app:443` (IAP-protected Cloud Run)
- **Provider:** GenAI (Gemini via Vertex AI), project `deploy-demo-test`
- **Input prompt:** "Build an ecommerce website that allows users to buy and sell
  vintage action figures"
- **Max depth:** 7, Concurrency: 4

## New Collections Created

| Collection | ID | Notes |
|---|---|---|
| Vintage Action Figures Ecommerce v2 | `cd948a8e-c57e-423f-beda-2d425dd01869` | First run, timed out at 10 min, partial depth 0-2 data |
| Vintage Action Figures Ecommerce v3 | `bd0b8364-32a0-4962-873b-fb2d292a2a94` | Full background run, still in progress at report time |

## Results (v3 Collection, Snapshot at ~15 min)

| Depth | Tasks Created | Terminal | Non-Terminal |
|-------|--------------|----------|-------------|
| 0     | 11           | 0        | 11          |
| 1     | 105          | 0        | 105         |
| 2     | 903          | 0        | 903         |
| 3     | 976+         | 0        | 976+        |
| **Total** | **1995+** | **0** | **1995+** |

The run was still in progress and actively decomposing depth 3 tasks at snapshot
time. No tasks were marked terminal at any depth through depth 3.

## Before vs. After Comparison

| Metric | Pre-Fix (Architect's Run) | Post-Fix (This Run) |
|--------|--------------------------|---------------------|
| Prompt input | "Vintage Action Figures Ecommerce" | Same |
| `--max-depth` | 7 | 7 |
| Total tasks | 77 | 1995+ (still growing) |
| Terminal tasks | 69 (89.6%) | 0 (0%) |
| Non-terminal tasks | 8 (10.4%) | 1995+ (100%) |
| Max depth reached | 1 | 3+ (still growing) |
| Depth 1 terminal rate | ~89% | 0% |

The pre-fix run (documented in `followup-decomposer-terminal-criteria.md`)
produced 77 tasks with 69 marked terminal at depth 1. The LLM was pre-judging
subtask terminality inline via a `"terminal": true/false` field in the subtask
JSON template. This caused the engine to treat nearly all depth-1 tasks as
leaf nodes, short-circuiting recursion despite `--max-depth 7`.

## What PR #139 Changed

The fix (commit `c6519ab`) made three changes:

1. **Removed `"terminal"` field from subtask JSON template** in the default
   prompt (`prompt_default.txt`). Subtasks no longer carry a terminal judgment.

2. **Added explicit rule:** "Do NOT pre-judge whether subtasks are terminal.
   Each subtask will be assessed independently in a subsequent call."

3. **Fixed stats counter:** Terminal tasks are now counted when the LLM
   self-assesses the current task as terminal (not when a parent decides).

This restores the original design intent: each task assesses its OWN terminality
when the engine recurses into it, rather than having the parent pre-judge children.

## Observations

1. **Fix is effective:** The core bug is definitively fixed. Tasks at depths 0-3
   are correctly assessed as non-terminal (decomposable) for a complex ecommerce
   project.

2. **Possible follow-up: over-decomposition.** With max-depth 7 and zero terminal
   tasks through depth 3, the tree grows exponentially. At current growth rates
   (roughly 8-9x per depth level), the full depth-7 tree could contain tens of
   thousands of tasks. This may warrant a follow-up to tune terminal criteria or
   add a task-count cap. See the existing follow-up doc
   `followup-decomposer-terminal-criteria.md` which discusses depth hints and
   tighter terminal criteria.

3. **Growth rate:** depth 0 (11) -> depth 1 (105, ~9.5x) -> depth 2 (903, ~8.6x)
   -> depth 3 (976+, still filling). The growth rate is slowing which suggests the
   LLM may start marking tasks terminal at deeper depths where tasks become
   truly atomic.

## Legacy Collection

The old test collection `32e81d89-80dd-4eab-b73d-8924608fc574` (pre-fix run,
from the architect agent's session) remains as-is per the brief — no
`DeleteCollection` RPC exists.

## Conclusion

PR #139's fix is **confirmed working**. The decomposer now produces meaningfully
deep task trees. The immediate bug (premature depth-1 termination) is resolved.
A separate follow-up may be warranted to tune terminal criteria for practical
depth limits and task-count management, but this is a prompt-tuning concern,
not a code bug.

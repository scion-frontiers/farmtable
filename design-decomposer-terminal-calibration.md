# Design: Decomposer Terminal Calibration

**Status:** Proposed  
**Date:** 2026-07-23  
**Context:** PR #139 fixed the pre-judgment bug but over-corrected — 0% terminal through depth 3, explosive fan-out (~8-9x per level), 1500+ tasks and growing toward potentially tens of thousands.

## Problem

The terminal self-assessment fix correctly moved terminal judgment to each task's own decomposition call, but without calibration guidance the LLM almost never declares itself terminal — it can always find _something_ to decompose. We need a middle ground between "pre-judge everything terminal at depth 1" and "nothing is terminal until max-depth forces it."

## Goals

1. LLM starts declaring tasks terminal at depths 3-5 for typical tasks (components, single functions, single API endpoints).
2. Total task count for a project like "build an ecommerce website" stays in the hundreds, not thousands.
3. No hardcoded depth cutoffs — the LLM should use judgment, but with better calibration.
4. A safety cap prevents runaway runs regardless of prompt quality.

## Non-Goals

- Guaranteeing an exact task count (prompt-driven, inherently variable).
- Changing the recursion architecture (that's working correctly now).

## Proposed Design

Two changes: a **prompt depth hint** and an **engine-level task cap**.

### 1. Prompt Depth Hint (prompt-only change)

Add a depth-awareness section to the system prompt. The depth is already in the user message (`depth N`), but the system prompt gives no guidance on how to use it.

Add after rule 6:

```
7. **Use depth to calibrate terminal judgment.** You are told the current
   depth in the task header. As a guideline:
   - Depths 0-1: Almost always decompose. These are feature areas, not leaf tasks.
   - Depths 2-3: Decompose if the task spans multiple components, endpoints,
     or concerns. Declare terminal if it's a single well-defined unit of work
     (one API endpoint, one UI component, one migration, one test suite).
   - Depths 4+: Prefer terminal. Only decompose if the task genuinely contains
     multiple independent pieces. A task like "implement password hashing" is
     terminal even if you could theoretically split it further.
```

This gives the LLM a sliding scale rather than a binary. It preserves self-assessment but adds calibration.

### 2. Engine Task Cap (code change)

Add a `--max-tasks` flag (default: 500) to the engine. When `totalTasks` hits the cap, force all subsequent decompositions to terminal (skip the LLM call, just return). Log when the cap is hit.

```go
// In Engine struct
maxTasks int

// At the top of decompose(), after the max-depth check
if int(e.totalTasks.Load()) >= e.maxTasks {
    e.logf("[depth=%d] Task cap reached (%d), forcing terminal for parent %s",
        depth, e.maxTasks, parentTaskID)
    return nil
}
```

This is a safety valve, not a quality mechanism. The prompt calibration should keep task counts reasonable; the cap prevents runaway LLM behavior from creating thousands of tasks on a live instance.

### 3. Summary Stats Enhancement (nice-to-have)

Update the summary to show tasks-per-depth breakdown, so the operator can see the fan-out shape without a separate query.

## Alternatives Considered

### A. Hardcoded depth cutoffs in the engine

Reject: Too blunt. A hardcoded "terminal if depth >= 4" ignores task complexity. Some tasks genuinely need depth 5+; others should be terminal at depth 2. The LLM should judge, but with calibration.

### B. Post-hoc re-judgment

If all subtasks from a call are non-terminal and depth > 2, re-prompt with "are you sure these all need decomposition?" Reject: Doubles LLM calls, adds latency, and the corrective prompt is fragile. Better to get the initial judgment right.

### C. Fan-out limits per call

Cap subtasks per call at 6 instead of 6-12. Reject: Reduces breadth but not depth. The explosive growth is from unbounded depth × breadth. The depth hint addresses the root cause.

### D. Prompt-only (no task cap)

Just add the depth hint, no engine cap. Reject: Prompts are never 100% reliable. A different model or a particularly decomposable input could still produce runaway growth. The cap is cheap insurance.

## Migration / Rollout

1. Both changes land in a single PR.
2. `--max-tasks` defaults to 500 (safe for any reasonable project).
3. Prompt change is embedded, takes effect immediately on rebuild.
4. No schema or API changes. Backward compatible.

## Implementation Phases

1. **Phase 1:** Add depth-hint rule to `prompt_default.txt`. Add `--max-tasks` flag and engine cap logic. Update summary to show per-depth breakdown.
2. **Phase 2:** Rebuild and re-run against same prompt with max-depth 7. Compare task counts and depth distribution.
3. **Phase 3:** If depth distribution looks right (terminal tasks appearing at depths 3-5), ship it. If still too aggressive or too conservative, tune the prompt language.

## Open Questions

1. **Default max-tasks value:** 500 seems reasonable for a single project decomposition. Could also be a function of max-depth (e.g., `100 * maxDepth`). Needs user input.
2. **Should max-tasks cancel in-flight LLM calls?** Current proposal just skips new decompositions. In-flight calls that haven't returned yet could still create tasks over the cap. Strict enforcement would require a context cancellation, adding complexity. Recommend soft cap for now.

## Acceptance Criteria

- [ ] Decomposer with depth hint produces terminal tasks starting at depth 3-4 for the vintage action figures prompt.
- [ ] Total task count for that prompt stays under 500 with default settings.
- [ ] `--max-tasks` flag exists and stops decomposition when hit.
- [ ] Summary output shows tasks-per-depth breakdown.
- [ ] Existing tests still pass.

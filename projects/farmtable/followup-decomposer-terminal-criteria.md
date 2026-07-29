# Follow-Up: Decomposer Terminal Criteria Tuning

**Status:** Candidate follow-up (not urgent)  
**Date:** 2026-07-23  
**Source:** First live decomposer run against the deployed instance

## Observation

When running the decomposer with `--max-depth 7` on the prompt "Build an
ecommerce website that allows users to buy and sell vintage action figures",
the LLM marked nearly all depth-1 subtasks as terminal. The decomposer only
reached depth 1, producing 77 tasks (69 terminal, 8 non-terminal) despite
the max depth allowance of 7.

This suggests the current prompt's terminal criteria are too permissive —
the LLM considers tasks like "Build user sign-up, login, password reset" and
"Implement search and filtering" atomic enough to be leaf tasks.

## Root Cause

The placeholder prompt says a task is terminal when it is "atomic enough that
it can be completed with a relatively trivial amount of effort." The LLM
interprets "trivial" broadly, especially for tasks that are well-understood
patterns (auth, CRUD, search). It doesn't decompose further because it judges
the task is clear enough to hand to a single developer.

## Options

1. **Tighten the terminal criteria.** Add explicit rules like: "A task is
   terminal ONLY if it can be completed in under 2 hours by a single
   developer" or "terminal tasks should represent a single function, endpoint,
   or UI component — not a feature area."

2. **Add a depth hint.** Tell the LLM the desired target depth and how deep
   it currently is: "You are at depth 1 of a target depth of 7. Prefer
   decomposing over marking as terminal unless the task is truly atomic."

3. **Use a subtask-count heuristic.** If a task's description mentions
   multiple nouns/verbs (endpoints, UI components, APIs), it's probably
   decomposable regardless of perceived complexity.

4. **Post-hoc enforcement.** After the LLM returns, if all subtasks are
   terminal and depth < maxDepth, force re-decomposition with a nudge prompt.

## Recommendation

Option 2 (depth hint) is the lowest-risk change and doesn't alter the prompt
philosophy — it just gives the LLM calibration information. Can be combined
with Option 1 for more aggressive decomposition.

This is a prompt-only change (`--prompt-file` or the embedded default), so
no binary modification is needed.

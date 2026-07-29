# Brief: Independent Review of PR #158 (Dependency View CLOSED-Task Solo Fix)

## Critical Constraints (read first)
- Review only — do not modify code or push commits.
- Work in a throwaway worktree: `gh pr checkout 158`.
- This touches FOUR places in `ft-dependency-view.ts` (`getVisibleTasks()`,
  `getDirectedReachableIds()`, `computeLayers()`, and edge-building) — the original
  investigation only anticipated needing changes in the first two; the dev found the
  other two also needed fixes. Verify this expanded scope was handled correctly and
  didn't introduce a broader behavior change than intended.

## Context
Bug: when a user selects and solos a CLOSED task in Dependency View, it showed "No
dependency relationships" even though the task has real BLOCKS relationships (visible
correctly in Tree View). Root cause: multiple places in `ft-dependency-view.ts`
unconditionally filter out CLOSED (phase=4) tasks, including the explicitly-selected one,
so BFS traversal can't even start. This is a GENERAL Dependency View bug, not specific to
Beads-imported collections (the Beads importer itself is confirmed correct).

PR #158 fixes this surgically: the explicitly-selected CLOSED task (and its directly-
connected tasks in Solo mode) are exempted from the CLOSED filter at all four points,
while OTHER unrelated closed tasks remain filtered. Normal (non-Solo) view behavior is
unchanged. Verified by the coordinator with real before/after screenshots on a test
collection ("Closed-Solo Bug Test") showing the exact bug reproduced and then fixed.

## Task
1. Read the full diff (`gh pr diff 158`).
2. Verify the fix is genuinely surgical — confirm it does NOT accidentally show OTHER
   unrelated CLOSED tasks in Solo mode, and does NOT change behavior when Solo is OFF
   (CLOSED tasks must still be hidden from the full/non-solo graph).
3. Check `computeLayers()` and edge-building carefully — these are the two spots the
   original investigation assumed would "just work" but the dev found needed explicit
   fixes. Understand why the investigation's assumption was wrong and confirm the dev's
   fix at these two points is correct and consistent with the fix in the other two spots.
4. Check edge cases:
   - What happens if the selected CLOSED task's relationships point to ANOTHER closed
     task (not just open ones)? Should that other closed task also appear, or stay hidden?
     Confirm actual behavior matches sensible expectations and doesn't crash/error.
   - What happens when toggling Solo on/off repeatedly on a CLOSED task — any stale state?
   - Interaction with Perf Phase 2's viewport culling (just deployed) — does culling still
     work correctly on a solo'd CLOSED task's small subgraph?
5. Confirm `npx tsc --noEmit` passes.
6. Render a verdict: APPROVE, APPROVE WITH NITS, or REQUEST CHANGES, with line references.

## Deliverables
1. A review report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/review-pr158.md`.
2. A message to the coordinator with verdict and summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with your verdict.
- Do not contact ptone@google.com.

## Termination
You MUST read the diff and relevant surrounding code, verify the fix is surgical (not
overly broad) and correct at all four modified points, form a genuine independent
verdict, write the review report, and message the coordinator. Then signal task_completed.

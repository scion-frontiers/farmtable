# Brief: Deploy latest `main` to Cloud Run (deploy-51) — CLOSED-Task Solo Fix

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-deploy-51 -b deploy-51-snapshot origin/main`
- Check `scion list` yourself before starting — stop and message the coordinator if
  another `farmtable-deploy-*` agent is already running.
- Do not merge/modify any code. Build+deploy+verify only.

## Context
Last deploy was deploy-50, revision `farmtable-00057-hzl` (commit `b06528a`). Since then,
PR #158 merged to `main` (merge commit `42ced660a4e445c6ce2bcbf7fc93f1a2d8df3ce0`) — fixes
a real bug ptone reported: selecting and soloing a CLOSED task in Dependency View showed
"No dependency relationships" even when the task has real BLOCKS relationships (correctly
visible in Tree View). Root cause: four independent places in `ft-dependency-view.ts`
unconditionally filtered out CLOSED tasks, including the explicitly-selected one. The fix
surgically exempts only the explicitly-selected CLOSED task (and its direct relationship
targets) from the filter in Solo mode; unrelated CLOSED tasks and normal (non-Solo)
behavior are unaffected. Independently reviewed (APPROVE) with particular scrutiny on two
fix points (`computeLayers()`, edge-building) the original investigation had assumed
wouldn't need changes but actually did.

## Task
1. Confirm what's new: `git log --oneline origin/main` since `b06528a`.
2. Build and deploy to the `farmtable` Cloud Run service, project `deploy-demo-test`,
   region `us-central1`.
3. Verify live and serving 100% traffic.
4. **Verify the fix on the live instance**:
   a. If reachable, use the original repro: collection
      `7e76c29c-5981-4e32-98b2-fa2bdd5ad9b7`, task `9f7731a8-a23d-493d-86eb-2ac5d39f5e7a`
      via `?view=dependencies&task=<id>&solo=1` — confirm it now shows the task's 3 BLOCKS
      relationships instead of "No dependency relationships". If that exact
      collection/task isn't reachable from your environment, create a local test case:
      a task with real BLOCKS relationships, mark it CLOSED/completed, select + solo it
      in Dependency View, confirm relationships now display.
   b. Confirm NORMAL (non-Solo) Dependency View still hides CLOSED tasks as before — this
      must NOT regress.
   c. Confirm un-related CLOSED tasks (not the selected one) still stay hidden even when
      Solo is on for a different task.
5. Regression check: Perf Phase 2 viewport culling (deploy-49) and Feature 67 layout
   toggle + LR default (deploy-50) still work normally.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified.
2. Explicit pass/fail evidence with real screenshots, saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-51/`
3. A deploy log at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-51.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail per check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` if anything looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the CLOSED-task Solo fix live with real evidence (ideally against
the original repro), confirm no regressions, produce the log, and message the coordinator
with a clear per-check pass/fail. Then signal task_completed.

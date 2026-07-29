# Brief: Deploy latest `main` to Cloud Run (deploy-52) — Solo Cross-Edge Fix

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-deploy-52 -b deploy-52-snapshot origin/main`
- Check `scion list` yourself before starting — stop and message the coordinator if
  another `farmtable-deploy-*` agent is already running.
- Do not merge/modify any code. Build+deploy+verify only.

## Context
Last deploy was deploy-51, revision `farmtable-00058-l6f` (commit `42ced66`). Since then,
PR #159 merged to `main` (merge commit `758de9f7b26003b8f86577e89109b77c8c590206`) — fixes
a bug ptone reported: in Solo Dependency View, a spurious dashed-blue edge sometimes
appeared connecting two visible nodes that are NOT the selected task (e.g. a legitimate
but incidental relationship between two of the selected task's chain members). This is
DISTINCT from the earlier Feature 66 fix (which addressed node inclusion, not edge
inclusion) — Feature 66 actually unmasked this latent bug by making downstream nodes
visible for the first time. The fix is a small, targeted guard: when Solo mode is active,
skip rendering edges that aren't part of the selected task's direct chain
(`classifyEdge()` returns null for such cross-edges). Coordinator personally verified the
diff (minimal, correctly placed) and before/after screenshots against the exact original
repro before merging.

## Task
1. Confirm what's new: `git log --oneline origin/main` since `42ced66`.
2. Build and deploy to the `farmtable` Cloud Run service, project `deploy-demo-test`,
   region `us-central1`.
3. Verify live and serving 100% traffic.
4. **Verify the fix on the live instance using the EXACT original repro** (this
   collection/task is reachable, use it directly rather than a substitute):
   `https://farmtable-486315127503.us-central1.run.app/?collection=1e0f02d1-99cd-46bc-a739-bac0fde60710&view=dependencies&task=717ab19c-e86f-4c51-8126-fc16a8f81ef7&solo=1`
   - Confirm the selected task ("D16-Run-Tests...") shows only its direct chain edges
     (orange edges from blockers, purple edge to what it blocks).
   - Confirm the previously-spurious dashed-blue edge (Ready-15 → Deploy to production,
     bypassing the selected task) is NO LONGER present.
5. Confirm non-Solo Dependency View still renders ALL edges normally (toggle Solo off on
   the same collection, verify the Ready-15→Deploy-to-production edge and others still
   show).
6. Regression check: Perf Phase 2 viewport culling, Feature 67 layout toggle + LR
   default, and the CLOSED-task solo fix (deploy-51) all still work normally.
7. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified.
2. Explicit pass/fail evidence with real screenshots against the exact original repro,
   saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-52/`
3. A deploy log at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-52.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail per check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` if anything looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the cross-edge fix live against the EXACT original repro with
real evidence, confirm no regressions, produce the log, and message the coordinator with
a clear per-check pass/fail. Then signal task_completed.

# Brief: Deploy latest `main` to Cloud Run (deploy-22)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-22 -b deploy-22-snapshot origin/main`
  (standing policy).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- **Use real HTML5 DnD event simulation** (`page.dragAndDrop()` / `locator.dragTo()`) for
  verifying Feature 48 — NOT raw `mouse.move()` sequences. This project shipped a real
  production DnD bug before (Feature 42) that a mouse-move-based test failed to catch; see
  `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00027-6hc` (commit `7a2e742`, Feature 46). Since then, PR
#124 (commit `b8ee51f`) merged Feature 48: drag-and-drop relationship building in the
Dependency view — dropping one task node onto another creates a BLOCKED_BY relationship
(dragged task blocked by the drop target), with self-drop/duplicate no-ops and cycle
detection via a toast.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #124 as new since `7a2e742`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-21.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 48 on the LIVE site**, using real HTML5 DnD events:
   - Drag one task node onto another in the Dependency view, confirm a new BLOCKED_BY
     relationship is created (verify via a follow-up check, e.g. reload or `ft task show`).
   - Confirm self-drop is a no-op (drag a node onto itself, nothing happens).
   - If practical, confirm cycle detection shows a toast and prevents the relationship.
   - Real screenshots for each.
5. Confirm Feature 46 (deployed last round) is still working (quick spot-check).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 48's drag-and-drop relationship creation works on the
   LIVE deployed site, using real DnD events. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-22/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-22.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 48 live with real screenshots using real DnD events,
produce the log, and message the coordinator. Then signal task_completed.

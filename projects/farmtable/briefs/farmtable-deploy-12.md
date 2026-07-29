# Brief: Deploy latest `main` to Cloud Run (deploy-12)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-12 -b deploy-12-snapshot origin/main`
  (standing policy — avoids branch collisions with any other in-flight workstream).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands. Be rigorous and honest.

## Context
Last deploy was rev `farmtable-00017-wnn` (commit `8ac4bc0`, Feature 40 Inspector scroll).
Since then, PR #113 (commit `146b3be`) merged Feature 41: 750ms ease-in-out animated
centering of the tree-view canvas when a task is selected via any trigger (Inspector
Relationships click, command palette, direct tree-node click). This is a pure UX-polish
feature — no functional/data changes.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #113 as new since `8ac4bc0`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same `gcloud builds submit` / `gcloud run
   deploy` pattern as prior deploys (check `deploy/2026-07-22-deploy-11.md` for exact
   commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 41 on the LIVE site** with Playwright:
   - Open the Tree view, select a task via at least one trigger (e.g. click a related task
     in the Inspector's Relationships tab, or click a node directly).
   - Capture a progressive screenshot sequence during the ~750ms transition (similar to
     what Feature 41's dev did locally — check
     `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-41-tree-center-animation/`
     for the reference pattern: several frames across the transition, not just before/after)
     to confirm the animation is present and roughly the right duration on the live
     deployed build (not just locally).
   - Confirm the node ends up correctly centered/framed at the end (no regression to
     Feature 37's underlying accuracy).
5. Report honestly if anything doesn't work as expected.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real progressive screenshot sequence proving Feature 41's animation works on the LIVE
   deployed site. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-12/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-12.md` (revision
   ID, commit SHA, what was verified, screenshot links).
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 41 live with real screenshots, produce the log, and message
the coordinator. Then signal task_completed.

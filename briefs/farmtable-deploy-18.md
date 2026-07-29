# Brief: Deploy latest `main` to Cloud Run (deploy-18)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-18 -b deploy-18-snapshot origin/main`
  (standing policy — farmtable-em-f45 is actively working in its own separate worktree
  right now, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- Verify against a TEST collection/repo, not production farmtable issues, for anything
  involving GitHub writes.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00023-q6j` (commit `2095838`, Phase 2). Since then, PR #119
(commit `aa0feb2`) merged Phase 3 of Passthrough Write-Through — the final phase of this
project. It adds: write-error toasts (permission denied / rate limit / generic gRPC error
→ user-friendly Shoelace `sl-alert`, 8s auto-close), task-type label mapping for GitHub
writes, and generic AddLabels/RemoveLabels handling.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #119 as new since `2095838`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-17.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Phase 3 on the LIVE site**, using a GitHub-backed test collection:
   - Trigger a write failure (e.g. attempt a write against a collection/token without write
     access, or simulate however is practical) and confirm a user-friendly error toast
     appears (not a raw error dump).
   - If a rate-limit scenario is impractical to trigger for real, at minimum confirm the
     error-toast mapping code path is reachable/functioning for the permission-denied case.
   - Real screenshots.
5. Confirm Phase 1 and Phase 2 (deployed in prior rounds) are still working — quick
   spot-check of write-through + capability gating, not full re-verification.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Phase 3's error handling works on the LIVE deployed site. Saved
   under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-18/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-18.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail. Note this
   completes the entire 3-phase GitHub Passthrough Write-Through project.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Phase 3 live with real screenshots, produce the log, and message
the coordinator. Then signal task_completed.

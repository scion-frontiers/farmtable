# Brief: Deploy latest `main` to Cloud Run (deploy-20)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-20 -b deploy-20-snapshot origin/main`
  (standing policy — farmtable-em-f46 is actively working in its own separate worktree
  right now, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00025-nkn` (commit `cb19a2f`, Feature 47). Since then, PR
#122 (commit `2c973dc`) merged Feature 45: import support for Beads' JSONL format
alongside Farmtable's native JSON export, with auto-detection between the two formats and
an updated import dialog stating supported formats.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #122 as new since `cb19a2f`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-19.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 45 on the LIVE site**:
   - Confirm the import dialog states supported formats ("Farmtable export (.json), Beads
     issue export (.jsonl)").
   - Import the real sample file (`/scion-volumes/scratchpad/issues.jsonl`) into a NEW test
     collection on the live site, confirm tasks are created with sensible
     titles/descriptions/status (not garbled or empty).
   - Real screenshots.
5. Confirm Feature 47 (deployed last round) is still working (quick spot-check).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 45's Beads import works on the LIVE deployed site.
   Saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-20/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-20.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 45 live with real screenshots, produce the log, and
message the coordinator. Then signal task_completed.

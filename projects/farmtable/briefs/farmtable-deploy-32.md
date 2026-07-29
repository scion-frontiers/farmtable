# Brief: Deploy latest `main` to Cloud Run (deploy-32)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-32 -b deploy-32-snapshot origin/main`
  (standing policy — farmtable-inv-graph-redraw is active in its own worktree, this is
  safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`) over
  `gh pr view`/`gh pr diff` if you need PR metadata.
- **ptone@google.com explicitly asked for live validation of the new token approach
  against the ACTUAL DEPLOYED revision** (not just the pre-merge test build Feature 59's
  dev verified against). This is the most important part of this deploy — don't skip or
  abbreviate it.

## Context
Last deploy was rev `farmtable-00037-7cv` (commit `b500753`, Feature 58). Since then, PR
#136 (commit `7d64230`) merged Feature 59: adds an `x-farmtable-token` gRPC metadata
fallback header so the `ft` CLI / decomposer can authenticate against the Cloud Run service
now that it's behind IAP (which consumes the `Authorization: Bearer` header for its own
OIDC token, colliding with Farmtable's own use of that header for its app-level `ft_...`
token).

Reference: Feature 59's own live-IAP verification (done pre-merge, against a dev build) is
at
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-59-iap-token-header/live-iap-verification.md`
— use the same method/approach, but against the NEWLY DEPLOYED revision.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #136 as new since `b500753`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-23-deploy-31.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Live-validate the x-farmtable-token approach against this newly deployed revision**:
   - Get the Farmtable API token (`gcloud secrets versions access latest
     --secret=farmtable-token --project=deploy-demo-test`).
   - Make a real gRPC/CLI call (`ft task list` or similar) against the live IAP-protected
     Cloud Run URL, sending the token via the NEW `x-farmtable-token` header (not
     `Authorization`), and confirm it succeeds (not blocked by IAP, not rejected by the
     app).
   - Also confirm a call using ONLY `Authorization: Bearer <ft_token>` (the old way) still
     fails/is blocked by IAP as expected, to prove the new header is actually what's making
     the difference (not some other change).
   - If practical, actually run the decomposer binary against this collection to confirm
     end-to-end usability, since that's the original motivating use case.
5. Report exact commands + output — this is the evidence ptone@google.com specifically
   asked for.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real command output proving `x-farmtable-token` works against the LIVE DEPLOYED
   revision (not just the pre-merge test build). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-32/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-32.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail — be explicit
   that this confirms the live-deployed instance (not just Feature 59's own pre-merge test).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, live-validate the x-farmtable-token header against the actual deployed
revision with real command output, produce the log, and message the coordinator. Then
signal task_completed.

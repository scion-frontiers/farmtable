# Brief: URGENT Redeploy — Tree View Infinite Growth Fix

## Critical constraints (read first)
- This is URGENT: a confirmed live perf bug (infinite page-growth loop in tree view,
  ~240px/sec, affecting every user viewing tree view on the deployed service) was just
  fixed and merged as commit `6a7cafe` (PR #78). Get this deployed as fast as correctness
  allows.
- `gcloud` is already authenticated as `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com`
  with project `deploy-demo-test` set.
- Work from `/workspace/farmtable` on `main`, `git pull origin main` first.
- Do not modify application code.

## Task

1. Build and deploy:
```bash
cd /workspace/farmtable
git pull origin main
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest \
  --project=deploy-demo-test \
  --file=Dockerfile.server \
  .
gcloud run deploy farmtable \
  --image=us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest \
  --region=us-central1 \
  --platform=managed \
  --use-http2 \
  --add-cloudsql-instances=deploy-demo-test:us-central1:scion-postgres-test \
  --service-account=scion-my-grove@deploy-demo-test.iam.gserviceaccount.com \
  --project=deploy-demo-test
```
2. Confirm the new revision is live at 100% traffic and the dashboard returns HTTP 200.
3. **Verify the actual bug is fixed on the live service**: open
   `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d&view=tree`
   with Playwright and confirm page/container height is STABLE over ~10 seconds (not
   growing) — same measurement approach as the bug investigation/fix verification
   (`/scion-volumes/scratchpad/projects/farmtable/reports/tree-view-bug-investigation.md`,
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-28-tree-view-fix/measurements.md`).
   This is the most important check — don't skip it or treat "the deploy succeeded" as
   proof the fix is live.

## Deliverables
1. Confirmation of the new revision (exact name) live at 100% traffic.
2. Real before/after-style measurement showing the live service is now stable (height
   sampled over ~10s, not growing).
3. A short report at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-20-deploy-5.md`.
4. A message to the coordinator with the revision name and explicit confirmation the bug
   is fixed live.

## Direct contact
- Coordinator: `scion message coordinator "<message>"` for blockers.
- Do not message ptone@google.com directly.

## Termination
You MUST complete the deploy, verify the fix is live and stable, produce the report, and
message the coordinator. Then signal task_completed.

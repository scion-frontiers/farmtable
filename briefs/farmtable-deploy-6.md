# Brief: Redeploy — Watcher-Comparison Batch (Features 29-34)

## Critical constraints (read first)
- `gcloud` is already authenticated as `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com`
  with project `deploy-demo-test` set.
- Work from `/workspace/farmtable` on `main`, `git pull origin main` first — this pulls in
  PR #79-84 (Watcher-comparison batch: icon view switcher, empty state component, command
  palette, dashboard, collapsible inspector sections, ready queue view) plus everything
  before it (through the tree-view fix, commit 6a7cafe / rev farmtable-00010-qdh).
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
3. Use Playwright to verify at least the icon-based view switcher, command palette
   (Cmd+K/Ctrl+K), and dashboard view are visibly present and functional on the live
   deployed URL (https://farmtable-qo7k5fvpda-uc.a.run.app) — real screenshots, genuine
   interaction, not `page.evaluate()`.

## Deliverables
1. Confirmation of the new revision (exact name) live at 100% traffic.
2. Screenshots proving the new features are live (icon switcher, command palette open,
   dashboard view), saved to
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-6/`
3. A short report at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-6.md`.
4. A message to the coordinator with a summary and the deployed revision.

## Direct contact
- Coordinator: `scion message coordinator "<message>"` for blockers.
- Do not message ptone@google.com directly.

## Termination
You MUST complete the deploy, verify the new features are live, produce the report and
screenshots, and message the coordinator. Then signal task_completed.

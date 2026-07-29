# Brief: Redeploy — Latest Main (External Store Passthrough, PRs #85-104)

## Critical constraints (read first)
- `gcloud` is already authenticated as `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com`
  with project `deploy-demo-test` set.
- Work from `/workspace/farmtable` on `main`, `git pull origin main` first — this pulls in
  the full External Store Passthrough feature (PRs #85-104, final commit d95a755): proto
  LinkedAccount messages/RPCs, MultiStore, ephemeral SQLite graph query routing, CLI
  `collection link/unlink/links`, and web UI collection selector + read-only mode for
  external-platform collections — on top of everything from the Watcher-comparison batch
  already live.
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
3. Run baseline smoke tests (`ft task list` against the live service — see
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-20-deploy-4.md` for the
   token-retrieval pattern).
4. Verify at least one External Store Passthrough feature is live: e.g. `ft collection
   link --help` should show the new subcommand, and/or check the web dashboard's
   collection picker for a platform-linking affordance if one is UI-visible.

## Deliverables
1. Confirmation of the new revision (exact name) live at 100% traffic.
2. Smoke test results.
3. A short report at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-7.md`.
4. A message to the coordinator with a summary and the deployed revision.

## Direct contact
- Coordinator: `scion message coordinator "<message>"` for blockers.
- Do not message ptone@google.com directly.

## Termination
You MUST complete the deploy, run the smoke tests, produce the report, and message the
coordinator. Then signal task_completed.

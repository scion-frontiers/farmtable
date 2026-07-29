# Brief: Deploy Current Main to Cloud Run for Review

## Critical Constraints (read first)

- This is a DEPLOYMENT task, not a code change. Do not modify application
  code. If the build fails due to a genuine code bug, stop and report to
  the coordinator rather than trying to fix application code yourself.
- `gcloud` is already authenticated in this environment as
  `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com` with
  project `deploy-demo-test` set — you should not need to run `gcloud auth
  login` or `gcloud config set project`. Verify with `gcloud auth list`
  and `gcloud config get-value project` before starting if you want to
  confirm, but don't fight the tooling if it's already correct.
- Work from `/workspace/farmtable` on the `main` branch. Make sure you are
  on the latest `main` (`git pull origin main`) before building — 17
  features have merged since this service was last deployed (see the full
  list in the "Context" section below).

## Context

This repo has an existing Cloud Run deployment (details in
`/workspace/downloads/tg_1784417200_cloud-run-handoff.md`) that predates
17 merged UI-improvement features (Add Task UI, per-column create,
inline card/inspector editing for title/priority/description/dates/
labels/assignees, keyboard navigation + shortcut overlay, functional
toolbar filters with chips/counts/tooltips — see
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/loop-log.md` for the
full list with PR links). The user wants a fresh deployment of current
`main` to the SAME existing Cloud Run service so they can review the
accumulated changes live.

Known existing limitation from the handoff doc: the dashboard's browser
gRPC-Web client previously had an auth-token gap for the browser client —
worth re-checking whether this is still the case post-deploy (see Smoke
Test Checklist below), but do not attempt to fix it as part of this
deployment task; just report what you observe.

## Deploy Steps (from the handoff doc — reuse these, don't invent new ones)

1. Build and push the image:
```bash
cd /workspace/farmtable
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest \
  --project=deploy-demo-test \
  --file=Dockerfile.server \
  .
```

2. Deploy the new image:
```bash
gcloud run deploy farmtable \
  --image=us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest \
  --region=us-central1 \
  --platform=managed \
  --use-http2 \
  --add-cloudsql-instances=deploy-demo-test:us-central1:scion-postgres-test \
  --service-account=scion-my-grove@deploy-demo-test.iam.gserviceaccount.com \
  --project=deploy-demo-test
```

3. Run the smoke test checklist (from the handoff doc):
```bash
# Dashboard loads
curl -i https://farmtable-qo7k5fvpda-uc.a.run.app/

# Native gRPC (requires token - get it first)
TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)
export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443
ft task list --token "$TOKEN"

# Create a test task and verify it appears
ft task create "smoke-test-$(date +%s)" --token "$TOKEN"
ft task list --token "$TOKEN"
```
(If the `ft` CLI isn't on PATH, check `/workspace/.farmtable/bin/ft` or
build it per the `farmtable-dev` skill / repo's `agents.md`.)

4. Use the project's web-launch/screenshot tooling to open the deployed
   URL in a real browser (Playwright) and take screenshots showing the new
   features are live: the "+ Add Task" button, per-column "+" controls,
   an open inspector panel with editable fields, the toolbar filters with
   chips. Confirm visually that this is the NEW version, not a stale cache
   (check for the per-column create buttons and filter chips specifically
   — those are late additions).

## Deliverables

1. Confirmation the new revision is live (note the revision name/URL from
   `gcloud run deploy` output).
2. Smoke test results (pass/fail on each check above).
3. Explicit note on whether the browser gRPC-Web auth-token gap (from the
   handoff doc) is still present or has resolved itself — don't fix it,
   just report what you observe.
4. Screenshots proving the new features are live on the deployed URL,
   saved to `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-19-deploy-1/`
5. A short deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-19-deploy-1.md`
   with: commands run, revision deployed, smoke test results, screenshot
   list, and any issues encountered.
6. A message to the coordinator with a summary and the deployed URL, once
   everything above is done.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for questions,
  blockers, or if the build/deploy genuinely fails and needs a decision
  (e.g. rollback vs. investigate).
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST complete the deploy, run the smoke tests, produce the log and
screenshots at the paths above, and message the coordinator with the
summary and URL. Then signal task_completed.

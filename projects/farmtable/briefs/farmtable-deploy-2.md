# Brief: Deploy Current Main to Cloud Run (Features 18-20: Collections)

## Critical Constraints (read first)

- This is a DEPLOYMENT task, not a code change. Do not modify application
  code. If the build fails due to a genuine code bug, stop and report to
  the coordinator rather than trying to fix application code yourself.
- `gcloud` is already authenticated in this environment as
  `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com` with
  project `deploy-demo-test` set — you should not need to run `gcloud auth
  login` or `gcloud config set project`. Verify with `gcloud auth list`
  and `gcloud config get-value project` if you want to confirm, but don't
  fight the tooling if it's already correct.
- Work from `/workspace/farmtable` on the `main` branch. Make sure you are
  on the latest `main` (`git pull origin main`) before building — PRs
  #64, #65, #66 (collection URL routing, collection picker, new-collection
  modal) have merged since the last deploy (revision farmtable-00006-rx9).
- The coordinator will NOT be independently re-opening your screenshots or
  re-reading your diff (context-preservation directive from the project
  owner) — your report is what stands. Be specific and rigorous: exact
  revision name, exact smoke-test pass/fail per check, exact screenshot
  filenames with what each shows.

## Context

Prior deploy log (baseline to compare against):
`/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-19-deploy-1.md`
(revision farmtable-00006-rx9, 17 UI-improvement features).

Since then, 3 new chained features merged, adding multi-collection support
to the UI:
- **Feature 18** (PR #64): URL-driven collection routing — no
  `?collection=` param shows a landing list of collections; selecting one
  navigates to `?collection=<uuid>` and shows that board; direct URL nav
  loads that collection directly.
- **Feature 19** (PR #65): persistent collection picker in the top-left of
  the toolbar, listing all collections, switches via the same routing.
- **Feature 20** (PR #66): "new collection" button next to the picker,
  opens a modal (name only), creates via `CreateCollection` RPC, switches
  into the new collection on success.

Full detail: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/loop-log.md`
(see Features 18-20 sections) and the individual feature logs under
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/`.

## Deploy Steps (reuse from the prior deploy, don't invent new ones)

1. Build and push the image:
```bash
cd /workspace/farmtable
git pull origin main
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

3. Run the smoke test checklist:
```bash
# Dashboard loads
curl -i https://farmtable-qo7k5fvpda-uc.a.run.app/

# Native gRPC (requires token)
TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)
export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443
ft task list --token "$TOKEN"
```
(If the `ft` CLI isn't on PATH, check `/workspace/.farmtable/bin/ft` or
build it per the `farmtable-dev` skill / repo's `agents.md`.)

4. Use the project's web-launch/screenshot tooling (Playwright) against
   the live URL to verify the 3 new features specifically, via genuine UI
   interaction (not `page.evaluate()`):
   - Navigate to the bare URL (no `?collection=`) — confirm the landing
     list of collections appears (Feature 18).
   - Select a collection, confirm the URL updates to `?collection=<uuid>`
     and the board loads (Feature 18), and the picker in the top-left
     shows that collection's name (Feature 19).
   - Open the picker dropdown, confirm it lists collections (Feature 19).
   - Click the new-collection button next to the picker, confirm the
     modal opens, create a test collection (e.g. name
     `smoke-test-<timestamp>`), confirm it switches into the new
     (empty) collection's board on success (Feature 20).
   - Directly navigate to a URL with an existing collection's ID already
     in it and confirm it loads that board without going through the
     landing list (Feature 18's direct-nav case).

## Deliverables

1. Confirmation the new revision is live (exact revision name/URL from
   `gcloud run deploy` output).
2. Smoke test results (pass/fail on each check above, including each of
   the 5 Playwright checks for Features 18/19/20 individually).
3. Screenshots proving each of the 5 checks above, saved to
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-19-deploy-2/`,
   verified distinct via `md5sum` before reporting.
4. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-19-deploy-2.md`
   with: commands run, revision deployed, smoke test results, screenshot
   list with what each one shows, and any issues encountered.
5. A message to the coordinator with a summary, the deployed URL/revision,
   and explicit pass/fail on each of the 5 collection-feature checks. Then
   signal task_completed.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for questions,
  blockers, or if the build/deploy genuinely fails and needs a decision
  (e.g. rollback vs. investigate).
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST complete the deploy, run the smoke tests (including all 5
collection-feature UI checks), produce the log and screenshots at the
paths above, and message the coordinator with the summary and explicit
pass/fail per check. Then signal task_completed.

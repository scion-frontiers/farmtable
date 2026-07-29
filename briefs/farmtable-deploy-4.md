# Brief: Deploy Current Main (incl. Export/Import) + Test Export/Import Round-Trip Live

## Critical constraints (read first)
- This has TWO parts: (1) a normal redeploy, (2) a real end-to-end test of the
  export/import feature against the newly deployed live service. Do not modify application
  code unless you hit a trivial, safe, isolated bug — if so, stop and report to the
  coordinator rather than patching yourself.
- `gcloud` is already authenticated as `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com`
  with project `deploy-demo-test` set.
- Work from `/workspace/farmtable` on `main`, `git pull origin main` first — this pulls in
  PR #74 (export/import web UI) and everything before it, including PR #72
  (export/import backend RPCs + CLI) and PR #73 (collection platform types).
- **Do not modify or delete the EXISTING `default` collection or its tasks**, or the
  earlier test github-platform collection (id `466c2baa-334e-439c-b9f9-abbe89eb8aae`) on
  the live service. Only ADD new collections for your test — purely additive.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands. Be specific and rigorous.

## Context
The full export/import feature (collection snapshot to JSON, restore/migrate via CLI or
web dashboard) is merged but has not yet been deployed or tested end-to-end against the
live Cloud Run service. See
`/scion-volumes/scratchpad/projects/farmtable/reports/design-export-import.md` for the full
design (format, UUID remapping, user matching) and
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/export-import-phaseA.md` +
`export-import-phaseB.md` for what was actually built. ptone@google.com wants this
redeployed and genuinely tested, not just deployed and assumed to work.

## Part 1: Deploy

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

Run baseline smoke tests (dashboard loads, `ft task list` works — see
`/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-19-deploy-2.md` for the exact
commands/token-retrieval pattern) and confirm the new revision is live at 100% traffic.

## Part 2: Test export/import round-trip against the LIVE service

1. **Via CLI**: export the `default` collection (`ft collection export default --out
   /tmp/default-export.json` or equivalent — confirm exact flags from the PR #72 diff if
   needed). Confirm the file is real, non-trivial JSON with the expected sections
   (tasks/comments/relationships/users per the design doc).
2. Import that file back as a NEW collection (do not overwrite/merge into `default` — the
   design is import-always-creates-new). Confirm: the new collection appears via `ft
   collection list` / `ft task list` scoped to it, task count matches the source, and spot
   check that at least one task's fields (title, priority, labels) match the original.
3. **Via Web UI**: open the live dashboard, use the export button (Feature from PR #74) on
   a collection, confirm a real file downloads. Then use the import dialog to import it as
   another new test collection, confirm the preview shows sane counts and the import
   succeeds, landing you on the new collection's board with visible tasks.
4. If anything fails, capture the exact error (don't paper over it) — this is real
   production-config testing (Cloud SQL, real gRPC-Web through Cloud Run, not local dev),
   so genuinely new failure modes are possible and are exactly what this test is for.
5. Note approximate timing (export/import RPCs are unary with a 64MB message limit — is
   this collection's export well within that, any slowness observed?).

## Deliverables
1. Confirmation of the new revision (exact name) live at 100% traffic, baseline smoke test
   results.
2. Exact steps + exact results for BOTH the CLI and web-UI round-trip tests (commands, file
   sizes, task counts before/after, any errors verbatim).
3. Screenshots of the web UI import flow (dialog with preview, resulting imported
   collection with visible tasks) — real, distinct, md5sum-verified.
4. A report at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-20-deploy-4.md` covering
   both parts.
5. A message to the coordinator with a summary, the deployed revision, and an explicit
   pass/fail verdict for the CLI round-trip and the web-UI round-trip separately.

## Direct contact
- Coordinator: `scion message coordinator "<message>"` for blockers or a decision (e.g. if
  the deploy itself fails and needs a rollback call, or if you find a real bug in
  export/import that needs a fix — report it, don't silently patch a merged feature).
- Do not message ptone@google.com directly.

## Termination
You MUST complete the deploy, run both round-trip tests, produce the report and
screenshots at the paths above, and message the coordinator with the summary and explicit
pass/fail verdicts. Then signal task_completed.

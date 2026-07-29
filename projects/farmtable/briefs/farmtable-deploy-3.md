# Brief: Deploy Current Main (incl. GitHub Platform Support) + Attempt Live GitHub Issue Mirroring

## Critical constraints (read first)
- This has TWO parts: (1) a normal redeploy, (2) an experiment against the newly deployed
  service. Do not modify application code for either part unless you hit a trivial, safe,
  isolated bug — if so, stop and report to the coordinator rather than patching yourself.
- `gcloud` is already authenticated as `scion-integration-sa@deploy-demo-test.iam.gserviceaccount.com`
  with project `deploy-demo-test` set.
- Work from `/workspace/farmtable` on `main`, `git pull origin main` first — this pulls in
  PR #73 (server now accepts `platform`/`remote_id` on `CreateCollection` instead of
  hardcoding `farmtable`) plus everything before it.
- **Do not modify or delete the EXISTING `default` collection or its tasks** on the live
  service. Only ADD a new collection for the GitHub-mirror experiment — purely additive.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands. Be specific and rigorous.

## Context
Feature 26 (PR #73, merged) removed a hardcoded `platform: farmtable` in the server's
`CreateCollection` RPC, so the server should now accept a `platform: github` collection
with a `remote_id`. HOWEVER, an earlier experiment
(`/scion-volumes/scratchpad/projects/farmtable/reports/github-backed-collection-experiment.md`)
found that the actual GitHub issue -> Farmtable task SYNC mechanism only works via the
CLI's local passthrough mode (`FARMTABLE_GITHUB_REPO` env var) — it explicitly was NOT
wired into the server's RPC path, and Feature 26 deliberately did not change that (its
scope was just "accept the platform value at creation," not "make sync work on the
server" — see `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-26-collection-platform-types.md`).

ptone@google.com wants: redeploy Cloud Run with this GitHub platform support, and actually
try to get the farmtable repo's own GitHub issues to mirror into a collection on the LIVE
hosted service. Given the known limitation above, the honest expected outcome is that
you'll be able to CREATE a github-platform collection via the server now, but it will
likely stay EMPTY (no automatic sync) since the passthrough/sync code isn't wired into the
server RPC path. Your job is to confirm exactly what happens, precisely, not to force it to
work by hacking something together.

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

## Part 2: Attempt to mirror GitHub issues on the live service

1. Using `ft` (or a direct gRPC call) against the LIVE Cloud Run service, create a new
   collection with `platform: github`, `remote_id: scion-frontiers/farmtable` (confirm the
   exact CLI flags/RPC fields from Feature 26's implementation — `gh pr diff 73` if needed).
2. Check whether this succeeds (collection creation itself) — report the exact
   command/RPC and exact response/error.
3. Check whether any GitHub issues appear as tasks in that new collection (`ft task list`
   scoped to it, or the web dashboard). Try any obvious trigger you can find (is there a
   sync/refresh RPC or CLI command at all? check `internal/platform/github/` and
   `internal/cli/` again if unsure) — but do NOT write new sync code to make this work if
   it isn't already wired up. If nothing happens, that itself is the finding.
4. If it's empty as expected, explicitly confirm this matches the known limitation (server
   RPC path doesn't invoke the passthrough/sync logic) rather than something else being
   broken — e.g. check for a clear error/log message vs. silent no-op, since those imply
   different follow-up work.
5. Report exactly what a future "wire GitHub sync into the server" feature would need to
   do, based on what you observed (this becomes a candidate next-phase brief, not something
   to build now).

## Deliverables
1. Confirmation of the new revision (exact name from `gcloud run deploy` output) live at
   100% traffic, baseline smoke test results.
2. Exact steps + exact results for the GitHub-mirror attempt (commands/RPCs, responses,
   whether tasks appeared), plus a screenshot of the resulting collection (empty or
   populated, whichever it actually is) in the dashboard.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-20-deploy-3.md` covering
   both parts, plus a short "what Phase C (server-side GitHub sync) would need" section.
4. A message to the coordinator with a summary, the deployed revision, and the explicit
   mirror-attempt verdict (worked / empty-as-expected / broken-differently-than-expected).

## Direct contact
- Coordinator: `scion message coordinator "<message>"` for blockers or a decision (e.g. if
  the deploy itself fails and needs a rollback call).
- Do not message ptone@google.com directly.

## Termination
You MUST complete the deploy, run the GitHub-mirror experiment, produce the report and
screenshot(s) at the paths above, and message the coordinator with the summary. Then signal
task_completed.

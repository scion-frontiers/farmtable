# Brief: Urgent, narrow check - are GitHub-backed collections active in production?

## Critical Constraints (read first)
- This is a SAFETY-DECIDING check, not a feature task. Answer fast, narrowly, and factually.
  Do not fix anything. Do not touch any code. Read-only investigation only.
- Time matters: a real HIGH-severity data race (GitHub issue #198, farmtable repo) exists in
  internal/platform/github/passthrough.go that can crash the entire production server process
  under two ordinary concurrent authenticated RPCs against a GitHub-backed collection. Whether
  this needs a same-day hotfix or can wait behind the in-flight Task State Model chain hinges
  ENTIRELY on whether GitHub-backed collections are actually in active/concurrent use in
  production right now. That is the one question this brief needs answered.
- Farm Table production: Cloud Run service `farmtable`, project `deploy-demo-test`, region
  `us-central1`. Cloud SQL Postgres `deploy-demo-test:us-central1:scion-postgres-test`,
  database `farmtable`. You have gcloud ADC access already configured in this environment
  (scion-integration-sa@deploy-demo-test). No `ft` CLI binary is pre-built; you may build one
  from `/workspace/farmtable/cmd/ft` with `go build` if that's the fastest path, or connect to
  Postgres directly (via Cloud SQL Proxy + psql, or a small Go/python script using the
  connection info above - install a postgres client if needed), or query the deployed
  service's own API if there's a lower-friction way. Use whichever is fastest and correct.

## What to determine
1. How many collections in the production database have platform=github (or equivalent
   GitHub-backed platform marker per the schema - check `internal/store/schema/collection.go`
   for the exact field/enum if unsure)?
2. For each GitHub-backed collection found: when was its most recent task mutation
   (create/update/close) or sync activity? Look for the freshest `updated_at` timestamp on
   tasks belonging to that collection, or any passthrough-sync-related timestamp the schema
   tracks.
3. Is there any evidence of CONCURRENT usage specifically (not just "used sometime") - e.g.
   multiple distinct actors/sessions, or webhook/poll-driven writes happening close in time to
   user-driven writes on the same collection? Concurrent writes are what triggers the race
   (CreateTask+CloseTask, two CloseTasks, ClaimTask+UpdateTask in close succession on the same
   collection). If you can find server logs (Cloud Run logs) showing GitHub passthrough
   activity in a recent time window, that's strong corroborating evidence.
4. Bottom line judgment: is it plausible that this race could be triggered under CURRENT real
   production usage patterns, or is GitHub passthrough essentially unused/dormant in
   production right now?

## Deliverables
1. A short factual report (a few paragraphs, not a full doc) at
   `/scion-volumes/scratchpad/projects/farmtable/reports/inv-github-collections-prod.md`
   covering: collection count, most recent activity timestamps, any concurrency evidence, and
   your bottom-line judgment (reachable-now vs dormant).
2. Message the coordinator directly with a one-line summary the moment you have an answer -
   don't wait to polish the full report first if the answer is time-sensitive either way.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for the summary, and for anything you
  get stuck on.

## Termination
You MUST produce the report file and message the coordinator with the bottom-line answer,
then mark the task complete. This should be a fast, single-pass investigation - do not expand
scope beyond the question above.

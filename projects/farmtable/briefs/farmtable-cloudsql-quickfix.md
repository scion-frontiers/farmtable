# Brief: Cloud SQL Connection Exhaustion — Quick Fixes

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-cloudsql-quickfix -b
  fix/cloudsql-connection-pool origin/main` (standing policy).
- This touches production database connection handling — be careful, but the fixes here
  are narrow and low-risk (adding pool limits that don't currently exist, and raising an
  instance-level connection cap). Test locally where possible before touching live infra.
- Full investigation doc (read this first, don't re-derive):
  `/scion-volumes/scratchpad/projects/farmtable/investigation-cloudsql-connections.md`
- GCP project: `deploy-demo-test`, Cloud SQL instance: `scion-postgres-test`, Cloud Run
  service: `farmtable`, region `us-central1`.

## Context
Root cause of intermittent "invalid token" errors during decomposer resume-mode runs
(found by `farmtable-architect-decomposer`): Cloud SQL `max_connections=100` on a
shared-core `db-g1-small` instance gets exhausted under sustained load (~700 req/min).
The Farmtable server has **no connection pool limits at all** on the Postgres path
(`internal/store/entstore.go:65`, `ent.Open(opts.Dialect, opts.DSN)`) — Go's
`database/sql` defaults to unlimited open connections. With Cloud Run
`containerConcurrency: 80`, even a single instance can exhaust the 100-connection budget.

ptone@google.com asked to implement the "top quick fixes" from the investigation doc
(items 1, 2, and 4 below) and open an issue for the rest (already done — GitHub issue
#142 tracks instance tier upgrade, PgBouncer, auth.go error unmasking, and IAP token
refresh — don't duplicate that work here).

## Task — implement these 3 items from the investigation doc
1. **App-level connection pool limits** (most impactful — do this first): in
   `internal/store/entstore.go`, on the Postgres path (near line 65, alongside the
   existing `ent.Open` call), add:
   - `SetMaxOpenConns(20)` — conservative starting value (safe under a 200-connection
     budget with room for multiple Cloud Run instances)
   - `SetConnMaxLifetime(5 * time.Minute)`
   - `SetConnMaxIdleTime(1 * time.Minute)`
   Note the SQLite path (line ~87) already correctly sets `SetMaxOpenConns(1)` — follow
   that pattern/style. You'll need the underlying `*sql.DB` handle from the Ent client
   (check Ent's driver API, e.g. `client.DB()` or similar, to access these setters).
2. **Increase Cloud SQL `max_connections`**: run
   `gcloud sql instances patch scion-postgres-test --database-flags=max_connections=200
   --project=deploy-demo-test` (this causes a brief instance restart — do this during your
   testing window, not urgently timed, but be aware it's disruptive for a few minutes).
3. **Cap Cloud Run max instances**: update the `farmtable` Cloud Run service's
   `--max-instances` flag to `4` (4 instances × 20 conns/instance = 80, safely under the
   200 budget with headroom). Use `gcloud run services update farmtable
   --max-instances=4 --region=us-central1 --project=deploy-demo-test` (or update your
   deploy script/manifest if the project has one — check for existing deploy scripts
   referenced in recent deploy logs under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/`).

## Deliverables
1. PR against `main` with the `entstore.go` pool-limit change.
2. Confirmation the Cloud SQL `max_connections=200` flag change was applied (verify via
   `gcloud sql instances describe scion-postgres-test --format="value(settings.databaseFlags)"`).
3. Confirmation Cloud Run `--max-instances=4` was applied (verify via `gcloud run services
   describe farmtable --region=us-central1 --format="value(spec.template.metadata.annotations)"`
   or equivalent).
4. Basic verification that the server still starts and serves requests normally after the
   pool-limit code change (local build + smoke test is fine; a live redeploy isn't
   required as part of THIS task — the coordinator will handle deploy+verify separately
   once your PR is merged, same as all other feature work this session).
5. A message to the coordinator with the PR link and confirmation of both infra changes.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests or completion.
- Do not message ptone@google.com directly.

## Termination
You MUST implement the pool-limit code change, apply both infra changes, verify them, open
a PR, and message the coordinator with the PR link + infra confirmation. Then signal
task_completed.

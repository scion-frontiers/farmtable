# Brief: Deploy Task State Phase 1 + Predeploy Migration Patch

## Context

Phase 1 core/API and the predeploy migration patch are both merged to `main`.
Coordinator has cleared the deploy gate after:

- old live web incompatibility was proven and fixed by the narrow Phase1-aware web patch;
- SQLite 4,044-task dogfood copy migration proof passed;
- Cloud SQL Postgres scratch-schema dogfood-scale migration proof passed;
- R2 code review, test review, and security audit approved.

You are deploying commit:

- `49f2e9dc7e78928e05acf41d2b35748a7da03078` (`Add task-state predeploy migration`)

Worktree:

- `/workspace/farmtable-deploy-task-state-phase1-live`

## Production Target

- GCP project: `deploy-demo-test`
- Cloud Run service: `farmtable`
- region: `us-central1`
- Cloud SQL instance: `deploy-demo-test:us-central1:scion-postgres-test`
- production database: `farmtable`
- production DB user: `farmtable`
- DB password secret: `farmtable-db-password`
- service account: `scion-my-grove@deploy-demo-test.iam.gserviceaccount.com`
- image: `us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest`

Do not print secrets. Use Secret Manager or existing Cloud Run env references.

## Required Deployment Steps

1. Confirm source:
   - worktree is clean;
   - HEAD is `49f2e9dc7e78928e05acf41d2b35748a7da03078`;
   - `origin/main` is an ancestor/equal.

2. Capture production DB pre-migration evidence before deployment:
   - total task rows;
   - old native stage counts for `backlog`, `ready`, `blocked`, `waiting_for_input`, `deferred`, `scheduled`;
   - existing `changes.field_name='task_state_migration'` count.

3. Build and deploy:
   - use the standard `Dockerfile.server` Cloud Build flow from recent deploy logs;
   - deploy Cloud Run service `farmtable` with HTTP/2, max instances 4, Cloud SQL instance attachment, and the existing service account.

4. Confirm service health:
   - Cloud Run revision is ready and receiving 100% traffic;
   - unauthenticated curl still returns the expected IAP redirect;
   - no immediate revision/startup errors in logs.

5. Capture production DB post-migration evidence after the deployed revision has started:
   - total task rows;
   - old native stage counts are zero;
   - `task_state_migration` note count increased by exactly the number of migrated old-stage rows;
   - note reason counts match the migrated old-stage distribution where possible;
   - a second check after at least one more service request/revision warmup does not duplicate notes.

6. Verify live web dashboard correctness:
   - use Playwright or an existing verification harness against the deployed URL;
   - confirm the dashboard/current UI renders with the Phase1-aware web patch;
   - confirm stale old-stage copy/labels are not shown as native dashboard/available queue state;
   - capture screenshot/evidence and console errors.

7. Write a deploy log:
   - `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-27-task-state-phase1-live.md`
   - include build ID, revision, URL, DB before/after counts, audit note evidence, web smoke evidence, and rollback notes.

## Verification Commands

Run and record:

- `PATH="/home/scion/go/bin:$PATH" go test ./...`
- `PATH="/home/scion/go/bin:$PATH" go build ./...`
- `npm run build` in `web/`
- `PATH="/home/scion/go/bin:$PATH" go run golang.org/x/vuln/cmd/govulncheck@latest ./...`
- deployment build/deploy commands and outcomes

## Rollback Notes

If deploy fails before migration starts, redeploy previous known-good revision (`farmtable-00062-nfn` from deploy 55) or the latest ready revision reported before this deploy.

If the migration runs and then a serious app issue appears, do not try to reverse migrated rows live without explicit coordinator approval. The migration is lossy by design but audit notes exist; rollback should first be binary rollback to previous image only if the old binary can tolerate migrated rows. Otherwise hold and escalate.

## Deliverables

- Cloud Run production deployment completed and verified.
- Deploy log written at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-27-task-state-phase1-live.md`.
- Manager summary message with:
  - deployed commit;
  - revision;
  - DB before/after evidence;
  - web smoke result;
  - any residual risks.

You MUST write the deploy log and then mark the task complete.

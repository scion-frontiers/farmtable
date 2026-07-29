# Farm Table Deploy Log - 2026-07-27 Task State Phase 1 Live

## Source

- Repo: `https://github.com/scion-frontiers/farmtable`
- Primary predeploy PR: `#178` (`Add task-state predeploy migration`)
- Live hotfix PR: `#179` (`Fix available queue fallback filtering`)
- R2/R3 follow-up branch: `task-state-hotfix-179-r2`
- Final deployed commit before follow-up: `582793ea1d7e8fcf9c0be28390a553abf2c7916f`
- Final merged commit after follow-up: `7a0f220dbd9332cb8db62138c841777432b4eda4`
- Previous ready revision before rollout: `farmtable-00064-6j6`
- Intermediate task-state revision: `farmtable-00065-8pq`
- Original live hotfix revision: `farmtable-00066-sq7`
- Final live revision after R3 follow-up: `farmtable-00067-ckt`

## Why PR #179 Was Needed

The first live web smoke after deploying PR #178 found the Available Queue fallback path
showing `triage` and `in_review` cards when `task.availability` was absent on frontend
objects. The production data migration was already successful and idempotent, but the
currently-live web UI still had a fallback predicate bug.

PR #179 changed `web/src/utils/task-ready.ts` so fallback availability requires
`phase=open` and `stage=accepted`, matching the Phase 1 claimable-state contract. This
was deployed immediately as a production correctness hotfix. A post-hoc independent
review was requested by the coordinator and then approved.

The follow-up R2/R3 fix added the missing fallback guard for already-assigned accepted
tasks, expanded regression coverage for explicit availability and fallback exclusions,
and resolved a dev-only PostCSS advisory through `npm audit fix`.

## Pre-Deploy Production DB Evidence

Captured before deploying PR #178:

```text
tasks=59119
migration_notes=0
has_hold_reason=false
old_stage=backlog count=23
old_stage=ready count=256
```

Production had 279 persisted old-stage task rows and no `hold_reason` column yet.

## Build 1: PR #178

- Cloud Build ID: `7c954fda-4d6e-489b-aac4-04d58709024e`
- Status: `SUCCESS`
- Image: `us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest`
- Finish time: `2026-07-27T06:20:54Z`

## Deploy 1: PR #178

```bash
gcloud run deploy farmtable \
  --image=us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest \
  --region=us-central1 \
  --platform=managed \
  --use-http2 \
  --max-instances=4 \
  --add-cloudsql-instances=deploy-demo-test:us-central1:scion-postgres-test \
  --service-account=scion-my-grove@deploy-demo-test.iam.gserviceaccount.com \
  --project=deploy-demo-test
```

- Revision: `farmtable-00065-8pq`
- Traffic: `100%`
- Service URL: `https://farmtable-486315127503.us-central1.run.app`

## Production Migration Evidence

Captured immediately after `farmtable-00065-8pq` startup:

```text
tasks=59119
migration_notes=279
has_hold_reason=true
stage_hold=accepted| count=279
stage_hold=cancelled| count=2
stage_hold=completed| count=797
stage_hold=in_review| count=12
stage_hold=triage| count=58018
stage_hold=working| count=11
note_new_value={"reason":"old_backlog_stage_to_accepted","stage":"accepted"} count=23
note_new_value={"reason":"old_ready_stage_to_accepted","stage":"accepted"} count=256
```

Result:

- old native stage rows remaining: `0`
- migration notes created: `279`
- note count exactly matched the pre-deploy old-stage count (`23 + 256`)
- `hold_reason` column existed after Ent schema migration

After an additional service request, the same counts remained unchanged:

```text
tasks=59119
migration_notes=279
has_hold_reason=true
stage_hold=accepted| count=279
stage_hold=cancelled| count=2
stage_hold=completed| count=797
stage_hold=in_review| count=12
stage_hold=triage| count=58018
stage_hold=working| count=11
note_new_value={"reason":"old_backlog_stage_to_accepted","stage":"accepted"} count=23
note_new_value={"reason":"old_ready_stage_to_accepted","stage":"accepted"} count=256
```

This confirms production startup migration idempotency.

## Build 2: PR #179 Hotfix

- Cloud Build ID: `1944e112-89e2-462e-bb25-7f29072bc009`
- Status: `SUCCESS`
- Image: `us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest`
- Finish time: `2026-07-27T06:30:08Z`

## Deploy 2: PR #179 Hotfix

- Revision: `farmtable-00066-sq7`
- Traffic: `100%`
- Service URL: `https://farmtable-486315127503.us-central1.run.app`

Cloud Run service state:

```json
{
  "latestCreatedRevisionName": "farmtable-00066-sq7",
  "latestReadyRevisionName": "farmtable-00066-sq7",
  "traffic": [
    {
      "latestRevision": true,
      "percent": 100,
      "revisionName": "farmtable-00066-sq7"
    }
  ]
}
```

Additional checks:

- unauthenticated `curl` returned HTTP `302`, confirming IAP is still enforcing.
- recent ERROR log query for revision `farmtable-00066-sq7` returned no entries.
- DB counts after hotfix deploy still showed `migration_notes=279` and zero old-stage rows.

## Live Web Smoke

Verification script:

- `/tmp/verify-task-state-live.mjs`

Evidence files:

- `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-27-task-state-phase1-live/web-smoke-results.json`
- `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-27-task-state-phase1-live/dashboard-post-task-state.png`
- `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-27-task-state-phase1-live/available-queue-post-task-state.png`

Relevant Available Queue result after PR #179:

```json
{
  "hasApp": true,
  "currentView": "ready-queue",
  "hasReadyQueueView": true,
  "hasAvailableQueueLabel": true,
  "hasReadyQueueLabel": false,
  "hasOldNativeStageLabels": false
}
```

Rendered queue snippet showed `Available Queue (6)` with only `Accepted` task stage
labels. The prior PR #178 live smoke had shown `Triage` and `In Review` cards in the
Available Queue; PR #179 corrected that.

The script's aggregate `ok` field remained `false` because its dashboard text assertion
looked for visible text in `ft-app.shadowRoot.textContent`, while the dashboard content is
nested deeper and produced whitespace-only text in that particular assertion. The task-state
specific web check is the Available Queue assertion above, which passed after PR #179.

Console errors:

- one `/api/auth/session` `401` resource error captured during the scripted login flow;
  this is the same auth/session probing noise seen in prior deploy verification and did
  not prevent authenticated session use.

## Verification Commands

Before PR #178 merge/deploy:

- `go test ./...` - pass
- `go build ./...` - pass
- `npm run build` in `web/` - pass, existing Vite chunk-size warning
- `go run golang.org/x/vuln/cmd/govulncheck@latest ./...` - pass, no called vulnerabilities
- `git diff --check` - pass

Before PR #179 hotfix deploy:

- `npm run build` in `web/` - pass, existing Vite chunk-size warning
- `go test ./...` - pass
- `go build ./...` - pass
- `git diff --check` - pass

## Deployment Notes

Two Scion deploy-agent starts (`deploy-task-state-phase1-live` and
`deploy-task-state-phase1-live-r2`) became stuck in `created` phase with no runtime
container or `lastSeen`. No deploy work ran inside either agent. The manager took over the
deployment directly and ran Cloud Build/Cloud Run commands serially, one deploy stream at a
time.

## Final Status

Live production status after hotfix:

- Cloud Run revision `farmtable-00066-sq7` is live at `100%` traffic.
- Production database migration completed and is idempotent.
- No persisted old native task-stage rows remain.
- `task_state_migration` audit notes exist for all 279 migrated rows.
- Available Queue live UI renders Phase1-aware copy and no longer leaks triage/in-review
  fallback tasks.

## Build 3: PR #179 R3 Follow-Up

- Cloud Build ID: `d91cc853-6700-475e-98ee-1138e85c1bbf`
- Status: `SUCCESS`
- Image: `us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest`
- Digest: `sha256:1493de0be612c1ece00ce81ecf95a9ee0da6ccc418da70b10123d9a7951f007f`
- Finish time: `2026-07-27T07:07:46.927014Z`

## Deploy 3: PR #179 R3 Follow-Up

- Revision: `farmtable-00067-ckt`
- Traffic: `100%`
- Service URL: `https://farmtable-486315127503.us-central1.run.app`

Cloud Run service state:

```json
{
  "latestCreatedRevisionName": "farmtable-00067-ckt",
  "latestReadyRevisionName": "farmtable-00067-ckt",
  "traffic": [
    {
      "latestRevision": true,
      "percent": 100,
      "revisionName": "farmtable-00067-ckt"
    }
  ]
}
```

Additional checks:

- unauthenticated `curl` returned HTTP `302`, confirming IAP is still enforcing.
- recent ERROR log query for revision `farmtable-00067-ckt` returned no entries.
- DB counts after the follow-up deploy remained stable with `migration_notes=279` and zero old-stage rows.

## R3 Live Web Smoke

Relevant Available Queue result after PR #179 R3:

```json
{
  "hasApp": true,
  "currentView": "ready-queue",
  "hasReadyQueueView": true,
  "hasAvailableQueueLabel": true,
  "hasReadyQueueLabel": false,
  "hasOldNativeStageLabels": false
}
```

Rendered queue snippet still showed `Available Queue (6)` with only `Accepted`
task stage labels. The queue fallback continued to exclude triage/in-review
cards, and the R3 guard correctly excluded assigned accepted tasks.

## Final Status

Live production status after the R3 follow-up:

- Cloud Run revision `farmtable-00067-ckt` is live at `100%` traffic.
- Production database migration completed and is idempotent.
- No persisted old native task-stage rows remain.
- `task_state_migration` audit notes exist for all 279 migrated rows.
- Available Queue live UI renders Phase1-aware copy and no longer leaks triage/in-review
  fallback tasks.
- Fallback queue eligibility now also excludes already-assigned accepted tasks when
  `task.availability` is absent.
- R3 review, test, and security audit all approved.

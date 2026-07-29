# Brief: Deploy latest `main` to Cloud Run (deploy-39) — Cloud SQL Connection Pool Fix

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-39 -b deploy-39-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY**, but verify carefully anyway since this touches the database
  connection path for every request. The infra-level changes (Cloud SQL
  `max_connections=200`, Cloud Run `max-instances=4`) are ALREADY live (applied
  separately, not part of this deploy) — this deploy is specifically to get the
  application-level connection pool limits (previously nonexistent) into the running
  code.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-38, revision `farmtable-00044-g8l` (commit `0cf1f4b`). Since then:
- A Cloud Run config-only change (max-instances=4) already created revision
  `farmtable-00045-rgn` — same code, just the new scaling cap.
- PR #143 merged to `main` (squash commit `cc9d1180264b98ee401b1fd5b5efd62345ac4692`):
  adds `openPostgres()` helper in `internal/store/entstore.go` with
  `SetMaxOpenConns(20)`, `SetMaxIdleConns(10)`, `SetConnMaxLifetime(5m)`,
  `SetConnMaxIdleTime(1m)` — fixes the root cause of Cloud SQL connection exhaustion
  (previously the Postgres path had NO pool limits at all, unlike the already-correct
  SQLite path).

Full background: `/scion-volumes/scratchpad/projects/farmtable/investigation-cloudsql-connections.md`

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `0cf1f4b`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-38. Preserve the
   existing `--max-instances=4` setting (don't accidentally reset it to a default during
   deploy — check your deploy command includes it or that it persists across revisions).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify the connection pool fix took effect and didn't break anything**:
   a. Service starts cleanly — check Cloud Run logs for the first few minutes for any
      DB-connection-related errors or panics.
   b. Basic functional smoke test: `ft` CLI dual-header IAP auth — confirm `ft task list`
      and a mutating call both succeed (proves the Postgres connection path works
      end-to-end post-change).
   c. Web dashboard loads and shows live data (confirms read path works).
   d. If practical, check Cloud SQL active-connections metric
      (`gcloud monitoring` or Cloud SQL console/API) briefly after some traffic to sanity
      check it's NOT spiking anywhere near 200 — this is a nice-to-have confirmation, not
      a hard requirement if it's awkward to pull from the CLI in your environment.
   e. Revision stable for several minutes (no restarts/OOM/crash-loop).
5. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl),
   with `--max-instances=4` confirmed still in effect.
2. Explicit pass/fail evidence for the checks above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-39/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-39.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the checks above, produce the log, and message the coordinator
with a clear per-check pass/fail. Then signal task_completed.

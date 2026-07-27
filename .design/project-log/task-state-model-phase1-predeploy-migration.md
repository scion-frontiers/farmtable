# Task State Model Phase 1 Predeploy Migration

Date: 2026-07-27
Branch: `task-state-predeploy-migration`

## Summary

- Added an idempotent startup migration after Ent schema creation in `store.NewEntStore`.
- Migrates persisted old native stages to Phase 1 primitives:
  - `backlog`, `ready` -> `accepted`
  - `waiting_for_input` -> `accepted`, `hold_reason=waiting_for_input`
  - `deferred` -> `accepted`, or clears deferred hold when future `start_date` exists
  - `scheduled` -> `accepted`, preserving `start_date`; missing dates become `hold_reason=deferred`
  - `blocked` -> `accepted`; rows without unsatisfied blocker evidence become `hold_reason=waiting_for_input`
- Writes one persistent `changes.field_name='task_state_migration'` note per migrated row with compact JSON `old_value`/`new_value`.
- Uses zero UUID as the existing system-compatible migration actor.
- Added startup-migration coverage separate from import/export tests, including old-stage matrix cases, blocked with/without blocker evidence, scheduled with/without `start_date`, deferred future start date, no old-stage rows remaining, and second-start idempotency.
- Added narrow Phase 1-aware web correctness updates:
  - shared ready/available predicate honors `task.availability` when present;
  - fallback excludes held and future-start tasks;
  - dependency satisfaction uses `completed` only, not broad closed phase;
  - visible queue/dashboard labels say Available Queue/Available;
  - command palette stage labels use current `TaskStage` enum keys, removing stale Backlog/Ready/Blocked/Scheduled numeric labels.

## Realistic DB Evidence

The brief-specified `/workspace/.farmtable/farmtable.db` was not mounted in this container. I found and used the only mounted Farm Table DB copy at `/scion-volumes/scratchpad/web-test/farmtable.db`, copied to `/tmp/farmtable-predeploy-migration.db`. It had 7 tasks, not 4,044.

Pre-migration copied DB:

- `tasks`: 7
- old stages: `ready=1`, `backlog=2`, `blocked=1`
- existing `task_state_migration` notes: 0

Startup path:

- Command path: `cmd/farmtable-server`
- Env: `FARMTABLE_DB_DIALECT=sqlite3`, `FARMTABLE_DB_URL=/tmp/farmtable-predeploy-migration.db?_fk=1`, `FARMTABLE_OPEN_ACCESS=1`
- Result: server initialized and listened, proving `store.NewEntStore(... Migrate:true)` completed against the copied DB.

Post-migration:

- stage/hold counts:
  - `accepted`, no hold: 3
  - `accepted`, `waiting_for_input`: 1
  - `working`, no hold: 2
  - `in_qa`, no hold: 1
- old-stage rows remaining: 0
- `task_state_migration` notes: 4

Sample notes:

- `ready` row: `{"has_blocker":false,"native_label":"ready","phase":"open","stage":"ready","start_date":null}` -> `{"reason":"old_ready_stage_to_accepted","stage":"accepted"}`
- `blocked` row without blocker evidence: `{"has_blocker":false,"native_label":"blocked","phase":"on_hold","stage":"blocked","start_date":null}` -> `{"hold_reason":"waiting_for_input","reason":"old_blocked_stage_without_blocker_to_waiting_for_input","stage":"accepted"}`
- `backlog` rows: `{"has_blocker":false,"native_label":"backlog","phase":"open","stage":"backlog","start_date":null}` -> `{"reason":"old_backlog_stage_to_accepted","stage":"accepted"}`

Second-run idempotency:

- old-stage rows after second startup: 0
- `task_state_migration` notes after second startup: 4
- no duplicate notes were created.

Ambiguous rows:

- The accessible DB had one `blocked` row with no unsatisfied blocker evidence. It was classified as `accepted` with `hold_reason=waiting_for_input`, per the contract.
- No `scheduled` rows without `start_date` were present in the accessible DB. The automated test matrix covers that ambiguity and records `old_scheduled_stage_without_start_date_to_deferred`.

## Web Compatibility Evidence

Built assets with `npm run build`, served by `cmd/farmtable-server` against `/tmp/farmtable-predeploy-migration.db`, and verified with Playwright using system Chromium.

Playwright result:

- URL after collection selection: `http://127.0.0.1:18082/?view=ready-queue&collection=8ef64de9-cc3e-47ed-aae2-02e83f26dc5d`
- Available Queue rendered: true
- stale old-stage copy checked in rendered text (`Backlog`, `Deferred`, `Scheduled`, `Waiting for Input`): false
- console errors: 0
- screenshot: `/tmp/farmtable-predeploy-web.png`

Rendered text snippet included migrated tasks as `Accepted`, `Working`, and `In QA`; the old `ready`, `backlog`, and `blocked` persisted stages were not rendered as native stage labels.

## Verification

- `PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration_PersistedOldTaskStates -count=1` - pass
- `PATH="/home/scion/go/bin:$PATH" go test ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" go build ./...` - pass
- `npm ci` - pass; npm reported one high severity advisory in existing web dependency graph
- `npm run build` in `web/` - pass; Vite reported the existing large chunk warning
- `PATH="/home/scion/go/bin:$PATH" govulncheck ./...` - pass; 0 called vulnerabilities
- strict removed native stage constant search - pass; no removed native stage constants/generated enum references found

## Residual Risk

- The developer container did not have `/workspace/.farmtable/farmtable.db` mounted. The manager reran the startup migration against that 4,044-task dogfood DB copy after developer completion; evidence is recorded below.
- The migration actor uses zero UUID because the current `changes` schema has a required `author_id` UUID and no dedicated system actor/table.

## Manager Verification: 4,044-task dogfood DB copy

After developer completion, the manager copied `/workspace/.farmtable/farmtable.db`
to `/tmp/farmtable-predeploy-4044.db` and ran the predeploy startup migration
against the copy with `cmd/farmtable-server`.

Pre-migration:

- `tasks`: 4,044
- old native stage rows: `backlog=4`, `blocked=5`, `ready=15`
- existing `task_state_migration` notes: 0

First startup:

- command path: `FARMTABLE_DB_DIALECT=sqlite3 FARMTABLE_DB_URL='file:/tmp/farmtable-predeploy-4044.db?_fk=1' FARMTABLE_OPEN_ACCESS=1 PORT=18091 /tmp/farmtable-server-predeploy`
- server initialized and listened successfully.

Post-migration:

- stage/hold counts:
  - `accepted`, no hold: 24
  - `completed`, no hold: 1
  - `in_qa`, no hold: 2
  - `triage`, no hold: 4,014
  - `working`, no hold: 3
- old native stage rows remaining: 0
- `task_state_migration` notes: 24
- note reasons:
  - `old_backlog_stage_to_accepted`: 4
  - `old_blocked_stage_with_blocker_to_dependency_availability`: 5
  - `old_ready_stage_to_accepted`: 15

Sample note payloads:

- `{"has_blocker":false,"native_label":"backlog","phase":"open","stage":"backlog","start_date":null}` -> `{"reason":"old_backlog_stage_to_accepted","stage":"accepted"}`
- `{"has_blocker":false,"native_label":"ready","phase":"open","stage":"ready","start_date":"2026-07-20T00:00:00Z"}` -> `{"reason":"old_ready_stage_to_accepted","stage":"accepted"}`

Second startup idempotency:

- old native stage rows remaining: 0
- `task_state_migration` notes: 24
- stage/hold counts unchanged.

Manager web smoke:

- Served the migrated 4,044-task DB copy with the predeploy build on
  `http://127.0.0.1:18092`.
- Playwright selected the default Farm Table collection and reached the
  Phase1-aware `ft-ready-queue-view`.
- Screenshot: `/tmp/farmtable-predeploy-4044-web.png`.
- Only observed network error was `/api/auth/session` 404 in open-access mode.

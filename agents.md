# Farm Table Agent Guide

This repository is the Farm Table codebase. Agents use Farm Table for task
tracking and may also work on Farm Table itself.

## Quick Start For Task Agents

Use the `farmtable` skill for task management. It covers ready work, task
creation, claiming, updating status, closing work, and dependency inspection.

Core loop:

1. Check ready work with `task_ready`.
2. Inspect the task with `task_get`.
3. Claim it with `task_claim`.
4. Work the task and update status with `task_update` when needed.
5. Close it with `task_close`.

Prefer MCP tools from the configured `farmtable` server over shell commands for
task operations.

## Quick Start For Dev Agents

Use the `farmtable-dev` skill when working on this repository's source code,
setting up the local environment, running tests, rebuilding the CLI, or fixing
local auth/token issues.

Development commands:

```bash
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db
make test          # go test ./... AND cd web && npm test
go build ./...
go build -o /workspace/.farmtable/bin/ft ./cmd/ft
```

`make test` runs both suites. Do not substitute a bare `go test ./...`: the
URL-scheme security guard lives in `web/src/util/*.test.ts`, and `npm test` is
its only intended executor.

`npm test` runs `web/scripts/run-node-tests.mjs`, which **discovers** every
`src/**/*.{test,spec}.{ts,tsx}` file and hands node explicit paths. Adding a
test file requires no edit to that runner, to `package.json`, or to `ci.yml` —
it is picked up by being on disk. Deliberately not restating a file count here:
a number in prose goes stale silently, and `make suite-manifest` is the
executable form of the same claim. It compares the runner's own `--list`
against an independent scan of the tree and **fails the build if any tracked
test file compiles without executing**.

## farmtable-dev Skill Reference

The `farmtable-dev` skill includes:

- `setup`: PATH, `FARMTABLE_DB_PATH`, and token configuration.
- `build`: Go build and dog-food `ft` binary rebuild workflow.
- `test`: unit tests and Postgres-backed integration test guidance.
- `gotchas`: stale token fix, Ent generation, and common local failures.
- `architecture`: Go, Ent, SQLite/Postgres, gRPC, web dashboard, MCP, and
  platform adapter overview.

## Task Claiming Protocol

Use your Scion identity when claiming or assigning work:

```bash
scion whoami --format json | jq -r '.id // "unknown"'
```

Always prefer `task_claim` for starting work because it atomically assigns the
task and moves it to `working`. Do not claim work you do not intend to start.

Use these stages consistently:

- `triage`: no acceptance decision has been made.
- `accepted`: accepted work that has not started; availability is computed.
- `working`: actively owned.
- `in_review`, `in_qa`, `deploying`: handoff stages.
- `completed`, `wont_fix`, `duplicate`, `cancelled`: terminal stages.

Use `hold_reason=waiting_for_input` when accepted or active work needs input.
Use `hold_reason=deferred` when work is intentionally postponed without a
concrete start date. A future `start_date` makes a task unavailable but is not
a hold reason. Claim starts execution and requires computed availability.

## Dev Environment

The dog-food CLI binary is prebuilt at `/workspace/.farmtable/bin/ft`.
The embedded DB is `/workspace/.farmtable/farmtable.db`.

If `ft` reports `invalid token`, the token in
`~/.config/farmtable/config.toml` likely does not match the embedded DB. See the
`farmtable-dev` skill's gotchas resource for the token-hash repair command.

## Project Overview

- **Language:** Go
- **ORM:** Ent (entgo.io) on SQLite (embedded) / Postgres (server mode)
- **Proto:** `proto/farmtable.proto` is the source of truth for the data model
- **Design docs:** `.design/` directory

## Build And Test

```bash
go build ./...
make test          # go test ./... AND the web suite (cd web && npm test)
go generate ./internal/store/ent
```

`make test` is `test-go` plus `test-web`; both are separately invocable. The web
half is not optional cosmetics — `web/src/util/url-binding-scan.test.ts` and
`safe-url.test.ts` are the client-side half of the URL-scheme security property.

Both are executed by `npm test`, and `RUN npm test` in both `Dockerfile` and
`Dockerfile.server` therefore does fail the image on a red guard.

**This sentence has been false twice, in both directions, so verify it rather
than trusting it.** It was written when the suite ran everything, became false
when the test script was narrowed to a single named file — leaving these guards
compiling and never running while the docs still promised they ran — and became
true again when the discovery runner landed. `make suite-manifest` is the check
that makes the promise executable instead of aspirational; run it rather than
believing this paragraph.

Run `go generate ./internal/store/ent` after Ent schema changes. Run
`go test ./... -tags integration` only when a live Postgres instance is
available.

Never push from an agent session. Commit completed work locally with a clear
message and leave pushing to the manager agent.

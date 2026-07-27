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
go test ./...
go build ./...
go build -o /workspace/.farmtable/bin/ft ./cmd/ft
```

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

- `ready`: unblocked and available.
- `working`: actively owned.
- `blocked`: cannot proceed because of a dependency or external issue.
- `waiting_for_input`: user or stakeholder decision needed.
- `in_review`, `in_qa`, `deploying`: handoff stages.
- `completed`, `wont_fix`, `duplicate`, `cancelled`: terminal stages.

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
go test ./...
go generate ./internal/store/ent
```

Run `go generate ./internal/store/ent` after Ent schema changes. Run
`go test ./... -tags integration` only when a live Postgres instance is
available.

Never push from an agent session. Commit completed work locally with a clear
message and leave pushing to the manager agent.

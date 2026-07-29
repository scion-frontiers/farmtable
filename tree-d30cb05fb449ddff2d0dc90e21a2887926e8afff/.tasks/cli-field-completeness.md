# CLI Field Completeness

## Context

Farm Table's backend (store + gRPC service) supports labels, dates, relationships, and code_context fields. The Wave 1 spec (`.design/wave-1-spec.md`, Track A) wired these through the store and server layers. However, the CLI commands may not expose all of these as flags yet.

## Task

Audit the CLI commands in `internal/cli/task.go` against the proto API (`api/farmtable/v1/farmtable.proto`) and wire any missing fields as CLI flags.

### Expected CLI flags

**`ft task create`** should support:
- `--label` (repeatable) — task labels
- `--due-date` — due date (RFC3339 or YYYY-MM-DD)
- `--start-date` — start date
- `--blocks` (repeatable) — task IDs this task blocks
- `--blocked-by` (repeatable) — task IDs that block this task
- `--repo` — repository (code_context)
- `--branch` — branch name (code_context)
- `--type` — task type
- `--parent` — parent task ID

**`ft task update`** should support:
- `--add-label` / `--remove-label` — label management
- `--due-date` / `--clear-due-date` — date management
- `--start-date` / `--clear-start-date`
- `--add-blocks` / `--add-blocked-by` / `--remove-relationship` — relationship management
- `--repo` / `--branch` / `--clear-repo` / `--clear-branch` — code context
- `--ci-status` / `--clear-ci-status`
- `--reason` — audit trail reason

**`ft task list`** should support:
- `--priority` — filter by priority
- `--type` — filter by type
- `--label` (repeatable) — filter by labels (AND semantics)
- `--parent` — filter by parent task ID

**`ft task get`** output should display:
- Labels, dates, relationships, code_context when present

### Check what exists first

Some of these flags may already exist. Audit `internal/cli/task.go` before implementing. Only add what's missing.

## Constraints

- Do NOT modify proto or generated proto code
- Follow existing CLI patterns in task.go
- `go build ./...` and `go test ./...` must pass
- Rebuild ft binary: `go build -o /workspace/.farmtable/bin/ft ./cmd/ft`
- Ensure JSON output (`--format json`) includes the new fields

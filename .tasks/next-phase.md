# Next Phase — CLI Completeness, Pagination, and Polish

## Context

Farm Table's backend (store + gRPC service) supports labels, dates, relationships, code_context, sort/filter, and graph RPCs. However, several of these capabilities aren't fully wired through the CLI yet. The CLI is the primary agent interface, so gaps here mean agents can't use features the backend already supports.

The project also needs cursor-based pagination (M3) to replace the current offset-based approach, which breaks under concurrent mutations.

## Workstreams

Break these into parallel developer tasks where possible. Check the current CLI code (`internal/cli/task.go` and related files) to understand what's already wired vs. what's missing.

### 1. CLI Field Completeness

Audit the CLI commands against the proto/gRPC API and wire any missing fields:

- **`ft task create`**: Ensure flags exist for `--label`, `--due-date`, `--start-date`, `--blocks`, `--blocked-by`, `--repo`, `--branch`, `--type`, `--priority`, `--parent`
- **`ft task update`**: Ensure flags for `--add-label`, `--remove-label`, `--due-date`, `--clear-due-date`, `--start-date`, `--clear-start-date`, `--add-blocks`, `--add-blocked-by`, `--remove-relationship`, `--repo`, `--branch`, `--ci-status`
- **`ft task list`**: Ensure filter flags `--priority`, `--type`, `--label`, `--parent`, `--sort`, `--order` work. Some may already exist from Wave 1 — check before implementing.
- **`ft task get`**: Ensure output displays labels, dates, relationships, code_context when present

For all commands, ensure JSON output (`--format json`) includes the new fields.

### 2. Graph CLI Commands

The graph RPCs are implemented server-side but may not have CLI commands yet. Check and add if missing:

- **`ft task ready`** — calls GetReadyTasks, lists tasks that are unblocked and claimable
- **`ft task blocked`** — calls GetBlockedTasks, shows blocked tasks with blocker info
- **`ft task tree <id>`** — calls GetDependencyTree, shows dependency tree for a task
- **`ft task critical-path`** — calls GetCriticalPath
- **`ft task bottlenecks`** — calls GetBottlenecks

### 3. Cursor-Based Pagination (M3)

Replace offset-based pagination with opaque cursor tokens in the store and server layers:

- Encode cursor as base64(JSON({last_id, last_sort_value})) — keyset pagination
- Update `ListTasks`, `ListComments`, `ListChanges`, `ListCollections` in store, server, and CLI
- Keep backward compat: if `page_token` is empty, start from the beginning
- CLI `--page-token` flag for manual pagination; default behavior fetches first page

### 4. Test Coverage

- Add CLI integration tests if a test pattern exists (check for existing CLI tests)
- Ensure all new CLI flags have at least basic test coverage through the server test layer
- All existing tests must continue to pass

## Constraints

- Do NOT modify proto or generated proto code
- Follow existing code patterns
- `go build ./...` and `go test ./...` must pass
- Rebuild `ft` binary after changes: `go build -o /workspace/.farmtable/bin/ft ./cmd/ft`

## Priority Order

1. CLI field completeness (highest value — unblocks dog-fooding)
2. Graph CLI commands (high value — makes graph features accessible)
3. Cursor-based pagination (important but less urgent)

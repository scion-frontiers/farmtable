# Track 2 C-13: Availability Mapping to MCP and CLI

**Date:** 2026-07-30
**Author:** farmtable-dev-c13
**Branch:** fix/track2-c13-availability-mapping
**Criterion:** C-13 — Empty CLI/MCP queues are legible at the v1 read-model level.

## Problem

The gRPC `GetReadyTasks` response includes `TaskAvailability` on each task
(field 30), carrying a boolean `available` flag and a list of
`AvailabilityReason` enum values. However, neither the MCP `task_ready` handler
nor the CLI `ready` command surfaced this information. Users and agents seeing
an empty ready queue received no explanation of *why* no tasks were available.

## Changes

### internal/mcp/server.go

- Added `availabilityReasonNames` map (`AvailabilityReason` → lowercase string).
- Added `availabilityReasonsToStrings()` helper that converts a slice of
  `AvailabilityReason` to `[]string`, skipping `UNSPECIFIED`.
- Added `availabilityToMap()` helper that produces `{"available": bool, "reasons": []string}`,
  handling nil `TaskAvailability` gracefully (defaults to `available: false`).
- Updated `handleTaskReady` response mapping to include `"availability"` key
  on each item.

### internal/cli/graph.go

- Added matching `availabilityReasonNames`, `availabilityReasonsToStrings()`,
  and `availabilityToMap()` in the CLI package (duplicated intentionally — each
  package has its own enum maps).
- Updated `readyTaskToMap()` to include `"availability"` in the output map.
- Updated `printReadyTable()` to show an `AVAIL` column. Available tasks show
  `yes`; unavailable tasks show their comma-separated reasons (or `no` if no
  reasons are present).
- Enhanced the empty-queue stderr hint: when `--include-unblocked` is set and
  the queue is still empty, the message now lists the possible availability
  reasons and suggests JSON output for per-task detail.

### Tests

- `internal/mcp/server_test.go`:
  - `TestHandleTaskReadyIncludesAvailability` — verifies the JSON response
    contains `availability` for available tasks, unavailable tasks with reasons,
    and tasks with nil availability.
  - `TestAvailabilityReasonsToStrings` — table-driven test covering nil, empty,
    unspecified-only, single, and all-reasons cases.
- `internal/cli/graph_test.go` (new file):
  - `TestReadyTaskToMapIncludesAvailability` — verifies the map output for
    available, unavailable, and nil-availability tasks.
  - `TestAvailabilityReasonsToStrings` — mirrors the MCP test for the CLI copy.

## Verification

- `go build ./...` — compiles clean.
- `go test ./internal/mcp/... ./internal/cli/...` — all tests pass.

## Reason String Mapping

| Proto Enum | String |
|---|---|
| AVAILABILITY_REASON_TRIAGE | `triage` |
| AVAILABILITY_REASON_TERMINAL | `terminal` |
| AVAILABILITY_REASON_HELD | `held` |
| AVAILABILITY_REASON_BLOCKED_BY_DEPENDENCY | `blocked_by_dependency` |
| AVAILABILITY_REASON_FUTURE_START_DATE | `future_start_date` |
| AVAILABILITY_REASON_UNSPECIFIED | (skipped) |

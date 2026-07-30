# Track 2 C-2: Remove ON_HOLD from CLI and MCP Input Parsing

**Date:** 2026-07-30
**Agent:** farmtable-dev-c2
**Branch:** fix/track2-c2-on-hold-residue
**Criterion:** C-2 (design-task-state-model-contract.md:734-737)

## Summary

Removed ON_HOLD from the CLI and MCP input parsing surfaces to close
acceptance criterion C-2, which requires that native phases like ON_HOLD
cannot be selected through API, CLI, MCP, web, or other user-facing
interfaces.

## Changes

### internal/cli/enums.go
- Removed `case "ON_HOLD"` from `parsePhase` switch statement
- Updated error message to list only `OPEN, IN_PROGRESS, CLOSED`
- **Kept** `phaseNames` map entry for ON_HOLD (output rendering, per C-11)

### internal/mcp/server.go
- Updated `task_list` tool description: removed ON_HOLD from phase filter text
- Updated `task_search` tool description: removed ON_HOLD from phase filter text
- Removed `case "ON_HOLD"` from MCP `parsePhase` switch statement
- Updated error message to list only `OPEN, IN_PROGRESS, CLOSED`
- **Kept** `phaseNames` map entry for ON_HOLD (output rendering, per C-11)

### internal/cli/enums_test.go (new)
- `TestParsePhaseAcceptsValidPhases`: verifies OPEN, IN_PROGRESS, CLOSED accepted (case-insensitive)
- `TestParsePhaseRejectsOnHold`: verifies ON_HOLD rejected in all case variants
- `TestParsePhaseRejectsInvalidInput`: verifies arbitrary invalid input rejected

### internal/mcp/server_test.go (extended)
- Same three test functions added to the MCP package, testing the MCP-local `parsePhase`

## Verification

- `go test ./internal/cli/... ./internal/mcp/...` — all tests pass
- `go build ./...` — compiles clean

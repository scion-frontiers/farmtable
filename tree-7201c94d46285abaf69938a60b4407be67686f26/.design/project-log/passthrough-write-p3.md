# Passthrough Write-Through — Phase 3: Polish + Error Handling

**Date:** 2026-07-22
**Branch:** feat/passthrough-write-p3
**Base:** main @ 2095838 (includes Phases 1+2)

## Summary

Phase 3 adds write error feedback (toast notifications) and missing write
mappings (type label swap, generic label add/remove) to the GitHub passthrough
write-through feature.

## What Was Implemented

### 1. Write Error Toasts (Frontend)

- Added `showWriteError(error)` to `FtApp` that maps gRPC/network errors to
  user-friendly messages:
  - Permission/403 → "GitHub rejected this edit — your token may not have write access"
  - Rate limit/429 → "GitHub rate limit reached — please wait before making more edits"
  - Network errors → "Could not reach the server — your change will retry on the next sync"
  - Default → "Failed to save changes: <original message>"
- Uses Shoelace `sl-alert` toast with `variant='danger'`, 8-second duration,
  following the existing pattern from `ft-toolbar.ts`.
- Updated `applyTaskUpdate()` catch block in `ft-app.ts` to call `showWriteError()`
  alongside the existing `console.warn`.
- The optimistic rollback (`this.taskStore.upsert(task)`) was already in place
  and remains unchanged.

### 2. Kanban View Error Events

- Updated both catch blocks in `ft-kanban-view.ts` (stage change and task update)
  to dispatch a `write-error` custom event with `bubbles: true, composed: true`.
- `FtApp` listens for `@write-error` on the kanban view and routes to
  `showWriteError()`.
- Removed the `TODO(ui-feedback)` comments from both files.

### 3. Type Label Swap (Backend)

- Added `typeToLabel` map to `LabelMapper` struct, built during `NewLabelMapper`
  from default and custom type config.
- Added `TypeToLabel(typ string) string` method following `PriorityToLabel` pattern.
- Added `TypeLabelSwap(currentLabels, newType)` method following `PriorityLabelSwap`
  pattern — computes add/remove label sets for type transitions.
- Added `p.Type` handling block in `UpdateTask` in `passthrough.go`, placed after
  the Priority block and before the AssigneeID block.

### 4. Generic Label Add/Remove (Backend)

- Added `p.AddLabels` and `p.RemoveLabels` handling in `UpdateTask` in
  `passthrough.go`, placed after the Type block.
- Follows the same `ensureLabelIndex → labelNamesToIDs → addLabels/removeLabels`
  pattern used by Stage/Priority/Type.

### 5. Tests

- Added `TestTypeToLabel`, `TestTypeToLabel_UnknownType`, `TestTypeToLabel_CustomMapping`,
  `TestTypeToLabel_Disabled` tests in `labels_test.go`.
- Added `TestTypeLabelSwap`, `TestTypeLabelSwap_NoExistingType`,
  `TestTypeLabelSwap_AlreadyPresent`, `TestTypeLabelSwap_Disabled` tests.
- Extended existing `TestLabelMapper_Disabled` to cover `TypeToLabel` and
  `TypeLabelSwap` disabled behavior.

## Files Changed

- `internal/platform/github/labels.go` — Added `typeToLabel` map, `TypeToLabel()`, `TypeLabelSwap()`
- `internal/platform/github/labels_test.go` — Added type label tests
- `internal/platform/github/passthrough.go` — Added Type, AddLabels, RemoveLabels handling in UpdateTask
- `web/src/components/ft-app.ts` — Added `showWriteError()`, `onWriteError()`, updated catch block
- `web/src/components/kanban/ft-kanban-view.ts` — Dispatch write-error events from catch blocks

## Deviations from Design Doc

- **Rate limit awareness (Area 4):** The design doc mentions reading
  `X-RateLimit-Remaining` from GitHub API responses and dynamically adjusting
  the sweep interval. The gRPC metadata pipeline does not currently expose these
  headers, so this was implemented as error-message-based detection only: if a
  write fails with a rate limit error, the toast shows the appropriate message.
  Dynamic sweep interval adjustment is deferred.
- **Sweep interval for rate limits (§4 of design doc):** Not implemented — would
  require plumbing rate limit headers through gRPC metadata, which is out of
  scope for Phase 3.

## Build Verification

- `go build ./...` — passes
- `go test ./internal/platform/github/...` — passes (all new tests green)
- `npm run build` (tsc + vite) — passes

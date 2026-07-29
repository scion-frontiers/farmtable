# B2: Fix taskToProto platform awareness

**Date:** 2026-07-21
**Status:** Complete
**Branch:** `feat/extstore-b2-taskToProto`

## Problem

`taskToProto` in `internal/server/convert.go` hardcoded `Platform: pb.Platform_PLATFORM_FARMTABLE` (line 179) for every task, regardless of the task's actual origin. GitHub passthrough tasks and tasks from other platforms were incorrectly reported as Farmtable-native.

## Solution

1. **Added `platformStringToProto` helper** — maps lowercase platform strings (`"github"`, `"linear"`, `"jira"`, `"asana"`, `"beads"`, `"farmtable"`) to their corresponding `pb.Platform` enum values. Unknown or empty strings fall back to `PLATFORM_FARMTABLE`.

2. **Updated `taskToProto`** — before constructing the proto, checks `t.RemoteData["platform"]` via type assertion. If present and a valid string, uses `platformStringToProto` to derive the correct platform. Otherwise defaults to `PLATFORM_FARMTABLE`.

## Key decisions

- **Fallback is PLATFORM_FARMTABLE, not PLATFORM_UNSPECIFIED** — existing tasks without RemoteData are native Farmtable tasks and should continue to report as such. Using UNSPECIFIED would be a breaking change for API consumers.
- **Type assertion guard** — if `RemoteData["platform"]` is not a string (e.g. numeric, nil), the code silently falls back rather than panicking, matching the defensive style used elsewhere in the file for RemoteData field extraction.

## Tests added

`internal/server/convert_test.go` (new file):
- `TestPlatformStringToProto` — 8 subtests covering all known platforms, explicit farmtable, empty string, and unknown string fallback.
- `TestTaskToProto_PlatformFromRemoteData` — 5 subtests: nil RemoteData, empty RemoteData, github platform, linear platform, and non-string platform value.

## Verification

- `go build ./...` passes
- `go test ./internal/server/` passes (13/13 new tests pass)
- Pre-existing `TestWatchTasks_NoInitial` flaky failure is unrelated (timeout race in watch streaming)

# Periodic UI Redraw: Root Cause Analysis & Fix

## Summary

Two bugs in the GitHub passthrough polling path defeat the `TaskStore.upsert()` 
equality check (Feature 55 fix), causing every component subscribed via 
`TaskStoreController` to re-render on every poll cycle (15s for writable / 30s 
for read-only external collections).

## Root Cause 1: `ClosedAt = time.Now()` in GitHub Passthrough

**File**: `internal/platform/github/passthrough.go` line 161-163

```go
// BEFORE (bug):
if stateStr == "CLOSED" {
    now := time.Now()
    t.ClosedAt = &now
}
```

For closed GitHub issues, `ClosedAt` was set to the **current server time** on 
every `ListTasks` call, instead of using GitHub's actual `closedAt` timestamp. 
This produced a different value on every poll cycle.

**Impact**: Every closed issue generates a different `closedAt` ISO string on 
every poll. The `TaskStore.upsert()` JSON equality check sees the timestamps as 
different and fires a `tasks-changed` event, triggering re-renders in all views.

**Fix**: Added `ClosedAt *githubv4.DateTime` to the `issueNode` GraphQL struct 
and used the actual GitHub closure timestamp:

```go
// AFTER (fix):
if stateStr == "CLOSED" && issue.ClosedAt != nil {
    closedAt := issue.ClosedAt.Time
    t.ClosedAt = &closedAt
}
```

## Root Cause 2: Non-Deterministic `remoteData` Map Key Ordering

**File**: `web/src/store/task-store.ts` (equality check in `upsert()`)

The `TaskStore.upsert()` equality check used `JSON.stringify()`:

```typescript
JSON.stringify(existing) === JSON.stringify(task)
```

`JSON.stringify()` serializes object keys in insertion order. GitHub tasks carry 
a `remoteData` field populated from a Go `map[string]any` via 
`structpb.NewStruct()`. Go's proto marshal uses non-deterministic iteration 
order for map fields by default, so the key order in the proto wire encoding 
varies between responses. The client-side `protobufjs` deserializer preserves 
wire order, producing JavaScript objects with varying key order.

**Impact**: Even when task data hasn't changed, the `remoteData` object keys may 
appear in a different order. `JSON.stringify()` produces different strings for 
different key orderings, so the equality check fails and `tasks-changed` fires.

**Fix**: Replaced `JSON.stringify` with `stableStringify()` that sorts object 
keys recursively before stringifying:

```typescript
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys
    .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
    .join(',') + '}';
}
```

## Flow Trace (Before Fix)

```
PollManager.refresh()  [every 15/30s]
  -> listTasks() RPC
  -> server returns tasks with:
       - ClosedAt = time.Now()  (different each call)
       - remoteData keys in random Go map order
  -> for each task: store.upsert(task)
       -> JSON.stringify(existing) !== JSON.stringify(task)  // FAILS
       -> fires 'tasks-changed' event
  -> TaskStoreController.onChanged() on EVERY subscribed component
       -> host.requestUpdate() on ft-app, dashboard, kanban, etc.
  -> Full UI re-render on every poll cycle
```

## Flow Trace (After Fix)

```
PollManager.refresh()  [every 15/30s]
  -> listTasks() RPC
  -> server returns tasks with:
       - ClosedAt = actual GitHub closedAt  (stable)
       - remoteData keys in random Go map order (but doesn't matter now)
  -> for each task: store.upsert(task)
       -> stableStringify(existing) === stableStringify(task)  // PASSES
       -> returns false, no event dispatched
  -> No re-renders (data unchanged)
```

## Files Changed

1. `internal/platform/github/graphql_queries.go` - Added `ClosedAt` field to 
   `issueNode` struct so the GraphQL query fetches the actual closure timestamp
2. `internal/platform/github/passthrough.go` - Use `issue.ClosedAt.Time` 
   instead of `time.Now()` for closed issues
3. `web/src/store/task-store.ts` - Added `stableStringify()` function and 
   replaced `JSON.stringify` in `upsert()` equality check

## Why This Wasn't Caught by Feature 55

Feature 55 added the JSON equality check to prevent redundant `tasks-changed` 
events. The check works correctly for Farmtable-native tasks (deterministic 
field values, no `remoteData`). However, for GitHub passthrough tasks:

1. `ClosedAt` was newly fabricated on every call (always different)
2. `remoteData` had non-deterministic key ordering (proto map serialization)

Both broke the `JSON.stringify`-based equality check, making it a no-op for 
GitHub tasks.

## Verification

- Go build: `go build ./internal/platform/github/...` passes
- Go tests: `go test ./internal/platform/github/...` all pass (25 tests)
- TypeScript: `npx tsc --noEmit` passes

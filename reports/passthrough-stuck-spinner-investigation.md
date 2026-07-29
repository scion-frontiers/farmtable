# Investigation: Passthrough Collection Stuck on Spinner

**Date:** 2026-07-21
**Investigator:** investigator agent
**Collection:** `466c2baa-334e-439c-b9f9-abbe89eb8aae`
**URL:** `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=466c2baa-334e-439c-b9f9-abbe89eb8aae`
**Revision:** `farmtable-00012-5dc`

---

## Summary

The stuck spinner is caused by a **string-matching bug in the frontend's `isUnimplementedError()` detection**. When the server returns `codes.Unimplemented` for WatchTasks on a GitHub-platform collection, the grpc-web error message carries the server's status text ("WatchTasks is not supported for external platform...") but does NOT contain the literal string "Unimplemented" or "code 12" that the frontend checks for. The frontend therefore treats it as a generic stream error, enters an infinite reconnect loop with exponential backoff, and never transitions to the polling fallback. The loading spinner stays forever because `snapshotComplete()` is never called.

A secondary issue exists: the `PlatformResolver` is never wired into the production server, and this collection has no `LinkedAccount`, so even with the spinner fix, the board would show 0 tasks (empty) rather than GitHub issues. This second issue requires separate work.

---

## Reproduction

**Confirmed.** Opened the URL with Playwright on `farmtable-00012-5dc`. The page renders a toolbar (correctly showing "GitHub: scion-frontiers/farmtable", "Read-only"), but the board area shows an infinite loading spinner. Connection badge shows "Reconnecting...".

**Screenshot:** `passthrough-stuck-spinner-screenshot.png` (same directory as this report)

**Console log** (10 errors within ~54 seconds, truncated to first and last):
```
[  297ms] [ERROR] Stream error: Error: WatchTasks is not supported for external platform "github" collections; use polling instead
[  428ms] [ERROR] Stream error: Error: (same)
[  667ms] [ERROR] Stream error: Error: (same)
[ 1091ms] [ERROR] Stream error: Error: (same)
[ 1948ms] [ERROR] Stream error: Error: (same)
[ 3701ms] [ERROR] Stream error: Error: (same)
[ 7079ms] [ERROR] Stream error: Error: (same)
[13851ms] [ERROR] Stream error: Error: (same)
[27804ms] [ERROR] Stream error: Error: (same)
[54153ms] [ERROR] Stream error: Error: (same)
```

Timing intervals show exponential backoff: ~100ms, ~200ms, ~400ms, ~800ms, ~1.6s, ~3.2s, ~6.4s, ~12.8s, ~25.6s, capping at ~30s. Each attempt hits the server, gets the same Unimplemented error, logs "Stream error:", and schedules another reconnect. The loop never exits.

---

## Server-Side State Checks

### Collection record
```json
{
  "id": "466c2baa-334e-439c-b9f9-abbe89eb8aae",
  "name": "github-mirror-scion-frontiers-farmtable-20260720",
  "platform": "github",
  "remote_id": "scion-frontiers/farmtable",
  "description": "Deploy 3 experiment: GitHub-backed collection pointing at scion-frontiers/farmtable"
}
```

### LinkedAccounts for this collection
```
ft collection links --collection 466c2baa-334e-439c-b9f9-abbe89eb8aae --token "$TOKEN" -o json
```
```json
{"has_more": false, "items": null, "total_count": 0}
```
**Zero linked accounts.** This collection was created before the LinkedAccount system existed.

### Task list for this collection
```
ft task list -c 466c2baa-334e-439c-b9f9-abbe89eb8aae --token "$TOKEN" -o json
```
```json
{"has_more": false, "items": null, "total_count": 0}
```
Returns 0 tasks. Without a LinkedAccount, the MultiStore's lazy resolution cannot construct a passthrough store, so it falls through to Postgres which has no tasks for this collection.

### Cloud Logging
No errors in Cloud Run logs for `farmtable` service in the last 2 days. The WatchTasks `codes.Unimplemented` response is a normal gRPC status return, not an application error, so nothing is logged server-side. Request logs show repeated POST requests to `/farmtable.v1.FarmTableService/WatchTasks` returning 200 (gRPC errors are conveyed in trailers within a 200 HTTP response).

---

## Root Cause (with code citations)

### Primary bug: `isUnimplementedError()` string mismatch

**Chain of failure:**

1. **Server returns Unimplemented** (`internal/server/watch.go:35-38`):
   ```go
   if coll.Platform != collection.PlatformFarmtable {
       return status.Errorf(codes.Unimplemented,
           "WatchTasks is not supported for external platform %q collections; use polling instead",
           coll.Platform)
   }
   ```
   The gRPC status code is `12` (Unimplemented), but the status *message text* is:
   `"WatchTasks is not supported for external platform \"github\" collections; use polling instead"`

2. **grpc-web client creates an Error with the status message text** (`web/src/gen/grpc-client.ts:321-325`):
   ```javascript
   onEnd: (code, message) => {
       done = true;
       if (code !== grpc.Code.OK && code !== grpc.Code.Canceled) {
           error = new Error(message || `gRPC stream failed with code ${code}`);
       }
       wake();
   },
   ```
   Since `message` is non-empty (the server provides a status message), the Error's `.message` property is the status text, **not** a format like `"gRPC stream failed with code 12"`.

3. **`isUnimplementedError()` fails to match** (`web/src/store/stream-manager.ts:12-21`):
   ```javascript
   function isUnimplementedError(err: unknown): boolean {
     if (!(err instanceof Error)) return false;
     const msg = err.message;
     return (
       msg.includes('Unimplemented') ||      // ❌ message says "is not supported", not "Unimplemented"
       msg.includes('code 12') ||             // ❌ message doesn't contain "code 12"
       msg.includes('code 12:') ||            // ❌ same
       /gRPC.*(?:failed|error).*\b12\b/.test(msg) // ❌ message doesn't contain "gRPC" or "12"
     );
   }
   ```
   **All four checks fail.** The error message `"WatchTasks is not supported for external platform \"github\" collections; use polling instead"` does not contain any of the strings or patterns the function looks for.

4. **Falls through to generic error handler** (`web/src/store/stream-manager.ts:106-108`):
   ```javascript
   console.error('Stream error:', err);  // ← this is the "Stream error:" we see in console
   this.setStatus('error');
   this.scheduleReconnect();             // ← enters exponential backoff reconnect loop
   ```

5. **Spinner stays forever** (`web/src/store/task-store.ts:5-6`, `web/src/components/ft-app.ts:243-244`):
   - `TaskStore._isLoading` starts as `true` and only becomes `false` when `snapshotComplete()` is called
   - `snapshotComplete()` is called by StreamManager on `SNAPSHOT_COMPLETE` event (never received) or by PollManager after a successful refresh (never started)
   - `ft-app.ts` line 243: `if (this.taskStore.isLoading)` renders the spinner

### Why `isUnimplementedError()` was written this way

The function was designed to detect the *other* Unimplemented error from `watch.go:19`:
```go
return status.Error(codes.Unimplemented, "streaming not available in pass-through mode")
```
This message also does NOT contain "Unimplemented" — but the fallback format `"gRPC stream failed with code 12"` (used when the server's message is empty) WOULD match. The function seems to have been tested against scenarios where the grpc-web `message` parameter was empty, relying on the fallback format. In practice, both WatchTasks Unimplemented error paths provide non-empty messages, so the fallback format is never used, and neither error is detected.

### Secondary issue: PlatformResolver not wired up in production

**`cmd/farmtable-server/main.go:41-43`** creates the MultiStore but never calls `SetResolver`:
```go
s := store.NewMultiStore(entStore)
defer s.Close()
// ← No s.SetResolver(github.NewPlatformResolver()) call
```

The `github.NewPlatformResolver()` function exists at `internal/platform/github/resolver.go:14-28` and is used in tests (`internal/server/passthrough_e2e_test.go:167`), but is never wired into the production server binary.

**Impact:** Even if `isUnimplementedError` is fixed and polling starts:
- `MultiStore.lazyResolve()` at `internal/store/multistore.go:107-109` checks `if m.resolver == nil { return nil }` — since the resolver is nil, lazy resolution is a no-op
- `storeForCtx()` falls through to the primary Postgres store
- Postgres returns 0 tasks for this collection
- Board shows empty (no GitHub issues)

### Tertiary issue: No LinkedAccount for this collection

Even if the resolver WERE wired up, `lazyResolve()` at `internal/store/multistore.go:121-125` calls `ListLinkedAccounts` and gets 0 results, so it returns nil before ever calling the resolver. The collection was created before the LinkedAccount system existed and has no associated credentials.

---

## Scope Recommendation

**XS-to-Small** for the immediate spinner fix. **Medium** for making the passthrough actually work end-to-end.

### Immediate fix (XS): Fix `isUnimplementedError()` detection
- Fix `web/src/store/stream-manager.ts:12-21` to reliably detect `codes.Unimplemented` errors regardless of the status message text
- Best approach: check the gRPC status code directly rather than string-matching on the message. This requires threading the gRPC code through the error (e.g., a custom error class with a `code` property set in `grpc-client.ts:321-325`)
- Quick alternative: add `msg.includes('not supported')` or `msg.includes('use polling instead')` to the checks — but this is fragile

### Wiring fix (Small): Connect PlatformResolver in production server
- In `cmd/farmtable-server/main.go`, add `s.SetResolver(github.NewPlatformResolver())` after creating the MultiStore
- Without this, lazy resolution is dead code in production

### Data fix (XS): Create LinkedAccount for the existing collection
- The collection `466c2baa...` needs a LinkedAccount with a valid GitHub PAT to enable the passthrough
- Can be done via `ft collection link --collection 466c2baa... --platform github --token <PAT>` (or equivalent CLI command)

---

## Recommended Approach

1. **Fix `isUnimplementedError()`** — Introduce a custom Error subclass (e.g., `GrpcError`) in `grpc-client.ts` that carries the numeric gRPC code. Update `isUnimplementedError()` to check `err.code === 12` instead of string-matching on the message. This is robust against message text changes.

2. **Wire `SetResolver` in `main.go`** — One-line addition. Import `github.NewPlatformResolver()` and call `s.SetResolver(github.NewPlatformResolver())`.

3. **Create a LinkedAccount** for the existing collection — operational task, not a code change. Requires a valid GitHub PAT with `repo` scope for `scion-frontiers/farmtable`.

4. **(Optional)** Add a dedicated unit test for `isUnimplementedError` that uses the exact error message format produced by the grpc-web client when the server sends a non-empty status message with `codes.Unimplemented`.

---

## Open Questions

1. **Which GitHub PAT to use?** The original experiment used `ptone`'s PAT via `$GITHUB_TOKEN`. Creating the LinkedAccount requires deciding whose credentials to store and ensuring the token has appropriate scope.

2. **Should the server log Unimplemented WatchTasks responses?** Currently silent. Adding a `log.Printf` would make debugging easier but adds noise for expected behavior.

3. **Is there a broader pattern?** The `isUnimplementedError` string-matching approach is fragile. Are there other gRPC error codes that might need similar detection? (e.g., `codes.PermissionDenied` for expired tokens.) An architect should consider whether to switch entirely to a code-based error classification for the grpc-web client.

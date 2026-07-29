# Design Note: Passthrough Stuck-Spinner Fix

**Date:** 2026-07-21
**Architect:** architect agent
**Scope:** XS–Small (one PR, three files touched)
**Investigation:** `/scion-volumes/scratchpad/projects/farmtable/reports/passthrough-stuck-spinner-investigation.md`

---

## Problem & Goals

Collection `466c2baa-...` (platform: `github`) shows an infinite loading
spinner on the deployed dashboard. The server correctly returns
`codes.Unimplemented` (gRPC code 12) for `WatchTasks` on non-farmtable
collections, but the frontend's `isUnimplementedError()` fails to detect it
because it string-matches the Error `.message` rather than checking the numeric
gRPC status code. The polling fallback (Feature B8, PR #103) never activates,
and the stream manager loops on reconnect forever.

**Goals:**
1. Fix the frontend to reliably detect `codes.Unimplemented` regardless of the
   server's status message text.
2. Wire `PlatformResolver` into the production server so the passthrough
   mechanism actually routes requests for external-platform collections.
3. Decide on the LinkedAccount data-fix scope.

## Non-Goals

- Adding new gRPC error classification for other codes (e.g. `PermissionDenied`).
  The investigation flagged this as a future consideration; this fix addresses
  only the immediate `Unimplemented` detection failure.
- Server-side logging of `Unimplemented` WatchTasks responses. Currently silent
  and intentionally so (expected behavior, not an error).
- Creating LinkedAccount records or managing GitHub PATs — operational concern,
  not a code change.

---

## Proposed Design

### Fix 1: Typed gRPC errors (primary bug — `grpc-client.ts` + `stream-manager.ts`)

**Root cause:** The `grpc.invoke` `onEnd` callback receives `(code, message,
trailers)` where `code` is the numeric `grpc.Code` enum value. Currently,
`grpc-client.ts:321-324` discards the code and creates a plain `Error` with
only the message string. `isUnimplementedError()` then tries to reverse-engineer
the code from the message text, which fails when the server provides a custom
status message that doesn't contain "Unimplemented" or "code 12".

**Fix:** Introduce a `GrpcError` subclass that carries the numeric code:

```typescript
// web/src/gen/grpc-client.ts (or a new grpc-error.ts, developer's choice)
import { grpc } from '@improbable-eng/grpc-web';

export class GrpcError extends Error {
  readonly code: grpc.Code;
  constructor(code: grpc.Code, message: string) {
    super(message);
    this.name = 'GrpcError';
    this.code = code;
  }
}
```

Update the two sites in `grpc-client.ts` that construct Error objects:

```typescript
// watchTasks onEnd (line ~321-324):
onEnd: (code, message) => {
  done = true;
  if (code !== grpc.Code.OK && code !== grpc.Code.Canceled) {
    error = new GrpcError(code, message || `gRPC stream failed with code ${code}`);
  }
  wake();
},

// unary onEnd (line ~369-370):
if (output.status !== grpc.Code.OK) {
  reject(new GrpcError(output.status, output.statusMessage || `gRPC request failed with code ${output.status}`));
  return;
}
```

Then replace the fragile string-matching in `stream-manager.ts`:

```typescript
// stream-manager.ts — replaces lines 12-21
function isUnimplementedError(err: unknown): boolean {
  if (err instanceof GrpcError) {
    return err.code === grpc.Code.Unimplemented;  // === 12
  }
  return false;
}
```

**Why this approach over alternatives:**

| Alternative | Why rejected |
|---|---|
| Add more string patterns (`msg.includes('not supported')`, etc.) | Fragile — breaks again on any future message text change. Exactly the same class of bug we're fixing. |
| Parse the code from the message with a regex | The `onEnd` callback already provides the code as a first-class value. Parsing it out of the message is unnecessary indirection. |
| Attach `code` as an ad-hoc property on a plain Error | Loses type safety. A custom subclass is idiomatic TypeScript and enables `instanceof` checks, which is how `isUnimplementedError` already gates on `Error`. |

**Load-bearing decision:** Using a `GrpcError` subclass (vs. ad-hoc property)
is a minor structural choice but easily reversible — the developer could pick
either approach and the fix works. The load-bearing decision is **checking the
numeric code, not the message text** — this is what makes the fix robust.

### Fix 2: Wire `PlatformResolver` into production (`main.go`)

**Root cause:** `cmd/farmtable-server/main.go` creates a `MultiStore` but never
calls `SetResolver()`. The `github.NewPlatformResolver()` function exists and
is used in tests, but is dead code in the production binary.

**Fix:** Add the import and one line after the MultiStore creation:

```go
// cmd/farmtable-server/main.go — add import
import "github.com/farmtable-io/farmtable/internal/platform/github"

// After line 47 (s := store.NewMultiStore(entStore)):
s.SetResolver(github.NewPlatformResolver())
```

**This is straightforward.** No alternatives to consider — `SetResolver` is the
designed API, and the resolver already exists. The only question was whether to
guard it behind an env-var feature flag. I decided against it: the passthrough
feature has been merged through 21 PRs (#85–#104) and is clearly intended to
be active. A flag adds complexity for no safety gain on an already-shipped feature.

### Decision: LinkedAccount for collection `466c2baa-...` — OUT OF SCOPE

**Context:** This specific collection has zero `LinkedAccount` records. Even
with both code fixes above, `MultiStore.lazyResolve()` calls
`ListLinkedAccounts`, gets 0 results, and returns `nil` before ever calling the
resolver. The board would show empty (no GitHub issues) rather than a spinner,
which is a correct (if unhelpful) rendering of "no credentials to access the
external platform."

**Decision:** Out of scope for the EM's code PR. Reasons:

1. **Credential management is an operational concern.** Creating a
   LinkedAccount requires a valid GitHub PAT with `repo` scope for
   `scion-frontiers/farmtable`. This is a human decision — whose token, what
   permissions, how to rotate — not a code change.
2. **The code fix is independently valuable.** Even without this specific
   collection working end-to-end, the `isUnimplementedError` fix and
   `SetResolver` wiring are needed for ALL future external-platform collections.
   Any new collection created with `ft collection link` will work correctly
   after these fixes.
3. **Risk of scope creep.** Bundling a one-off data-fix with the code changes
   makes the PR harder to review and test. The data-fix can be done
   independently via `ft collection link` once the project owner decides on
   credentials.

**Follow-up for project owner:** Run
`ft collection link --collection 466c2baa-334e-439c-b9f9-abbe89eb8aae --platform github --token <PAT>`
with an appropriate GitHub PAT after the code fix is deployed.

---

## Migration / Rollout

No migration needed. Both changes are backward-compatible:

- `GrpcError` is a subclass of `Error`, so any existing `catch (err)` blocks
  that check `err instanceof Error` still work.
- `SetResolver` enables lazy resolution that was previously a no-op — it adds
  capability, doesn't change existing behavior for `platform: farmtable`
  collections.

After merging and redeploying, the specific collection `466c2baa-...` will show
an empty board (correctly: no LinkedAccount) instead of a stuck spinner. All
future external-platform collections created with proper LinkedAccounts will
work end-to-end.

---

## Open Questions

1. **Should `GrpcError` also be used for unary error handling?** The proposed
   fix updates both the streaming `onEnd` and the unary `onEnd` to use
   `GrpcError` for consistency. This is a minor scope expansion but prevents
   the same class of bug from occurring in unary error handlers later. The
   developer should make this call — both approaches are fine.

---

## Implementation Phases

This is small enough to be a single commit or two small commits in one PR:

1. **Commit 1:** Introduce `GrpcError`, update `grpc-client.ts` to use it,
   rewrite `isUnimplementedError()` to check the code.
2. **Commit 2:** Wire `github.NewPlatformResolver()` into `main.go`.

Or a single commit if the developer prefers — the changes don't depend on each
other.

---

## Acceptance Criteria

1. `isUnimplementedError()` returns `true` for any error with gRPC code 12,
   regardless of the status message text.
2. `isUnimplementedError()` returns `false` for errors with other gRPC codes.
3. The production server binary calls `SetResolver` with the GitHub platform
   resolver.
4. No string-matching on error messages remains in `isUnimplementedError()`.
5. Existing tests pass (`go test ./...`, `npm test` if applicable).
6. (Optional but recommended) A unit test for `isUnimplementedError` covering:
   - `GrpcError` with code 12 and a custom message → `true`
   - `GrpcError` with code 13 (Internal) → `false`
   - Plain `Error` (not a `GrpcError`) → `false`
   - Non-Error value → `false`

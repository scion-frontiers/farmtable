# Feature 26: Server Support for Collection Platform Types + External Source Link in Header

## Investigation Findings

- **Hardcoded platform**: `internal/server/server.go:800-812` hardcoded `Platform: "farmtable"` in `CreateCollectionParams`, ignoring any platform value from the request.
- **Proto `CreateCollectionRequest`**: Only had `name` (field 1) and `description` (field 2). No way to specify platform or remote_id at creation time.
- **Proto `Collection` message**: Already defines `platform` (field 4), `remote_id` (field 5), and other fields. The response side was already ready.
- **Ent schema**: Had a `platform` enum field but no `remote_id` field.
- **`collectionToProto`**: Did not populate `RemoteId` on the response.
- **`remote_id` format for GitHub**: The passthrough store uses `owner/repo` format (e.g., `scion-frontiers/farmtable`), making the URL `https://github.com/owner/repo`.
- **Existing `platformFromProto`**: Already defined in `server.go:1537` returning `collection.Platform`. No need to create a new one.

## What Was Built

### Part 1: Server - Stop Hardcoding Platform on CreateCollection

1. **Ent schema** (`internal/store/schema/collection.go`): Added `remote_id` optional string field to Collection schema. Ran `go generate ./internal/store/ent` to regenerate Ent code.

2. **Proto** (`proto/farmtable.proto`): Added `optional Platform platform = 3` and `optional string remote_id = 4` to `CreateCollectionRequest`. Ran `buf generate` to regenerate Go proto code.

3. **Store params** (`internal/store/store.go`): Added `RemoteID string` to `CreateCollectionParams`.

4. **EntStore** (`internal/store/entstore.go`): Added `SetRemoteID` call when `p.RemoteID` is non-empty.

5. **Server handler** (`internal/server/server.go`): Updated `CreateCollection` to:
   - Read platform from request, defaulting to "farmtable" if unspecified
   - Read remote_id from request
   - Validate that non-farmtable collections require a remote_id
   - Pass both to `CreateCollectionParams`

6. **Conversion** (`internal/server/convert.go`): Updated `collectionToProto` to populate `RemoteId` on the response when non-empty.

### Part 2: Web UI - Display External Source Link in Header

1. **Proto gen files** (`web/src/gen/farmtable.json`): Added `platform` and `remoteId` fields to `CreateCollectionRequest` descriptor.

2. **gRPC client** (`web/src/gen/grpc-client.ts`): Updated `createCollection` to accept optional `platform` and `remoteId` parameters.

3. **Toolbar** (`web/src/components/ft-toolbar.ts`):
   - Added `renderExternalLink` method that shows:
     - "View on GitHub" link with `box-arrow-up-right` icon for GitHub collections with a remote_id
     - Platform badge (e.g., "Linear", "Jira") for other non-farmtable platforms
   - Added CSS styles for `.external-link` and `.platform-badge`
   - Imported `platformLabel` utility for badge text

## Scope Boundary

Server now accepts the platform value sent in CreateCollectionRequest and stores remote_id. Full external platform sync through the hosted server (GitHubAdapter wiring, SyncCollection RPC, linked accounts) remains out of scope.

## Issues Encountered

- **Duplicate `platformFromProto`**: An existing `platformFromProto` function in `server.go` returns `collection.Platform` (Ent enum type). Initially added a duplicate in `convert.go` returning `string`, which caused a compile error. Removed the duplicate and used `string()` cast on the existing function's return value.
- **`buf` CLI not installed**: Had to install `buf`, `protoc-gen-go`, and `protoc-gen-go-grpc` to regenerate proto code.

## Review Rounds

### Round 1
- **Verdict:** APPROVE with 2 medium findings
- Finding 1: `service.ts` interface not updated for new `createCollection` opts parameter → Fixed in `8dd932a`
- Finding 2: `remoteId` not validated before constructing GitHub URL → Fixed with regex validation in `8dd932a`

### Round 2
- **Verdict:** APPROVE — no blocking findings
- Informational: Mock doesn't simulate opts, no new unit tests, farmtable + remote_id permissive — all non-blocking

## PR

- **PR:** https://github.com/scion-frontiers/farmtable/pull/73
- **Status:** CLEAN / MERGEABLE
- **Commits:**
  - `2f21836` — feat: support collection platform types in CreateCollection and show external source link
  - `8dd932a` — fix: update service interface and validate remoteId format in external link

## Phase B Conflict

No conflict encountered. `origin/main` did not advance between worktree creation and push.

## GitHub URL Format

For github-platform collections, `remote_id` stores `owner/repo` format (e.g., `scion-frontiers/farmtable`), and the URL constructed is `https://github.com/owner/repo`. This is validated client-side with regex `/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/` before rendering.

## Screenshots

Real screenshots captured via Playwright against a local dev server running the F26 ft binary with a github-platform collection inserted into the test DB.

- `f26-github-collection-header.png` (md5: `58e13a8fff8bf955a21e73e4bdc21ab6`): Shows the toolbar header with the "scion-frontiers/farmtable" collection selected, "View on GitHub" external link visible and pointing to `https://github.com/scion-frontiers/farmtable`.
- `f26-farmtable-collection-header.png` (md5: `5fe261218f60e5b67cd51b143d90c21a`): Shows the toolbar header with the "default" farmtable collection selected, gear icon visible, no external link or platform badge (regression check PASS).

Screenshots saved under `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-26-collection-platform-types/`.

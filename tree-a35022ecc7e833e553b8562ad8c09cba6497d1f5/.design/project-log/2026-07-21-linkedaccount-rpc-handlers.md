# LinkedAccount Server RPC Handlers (A5)

**Date:** 2026-07-21
**Branch:** feat/extstore-a5-linkedaccount-rpcs
**Task:** A5 - LinkedAccount Server RPC Handlers

## Summary

Implemented gRPC server-side handlers for the four LinkedAccount CRUD RPCs
(CreateLinkedAccount, GetLinkedAccount, DeleteLinkedAccount, ListLinkedAccounts)
in the Farmtable server package.

## Changes

### `internal/server/convert.go`
- Added `linkedAccountToProto` conversion function that maps `*ent.LinkedAccount`
  to `*pb.LinkedAccount`. **Security: auth_token is intentionally omitted** from
  the proto response.
- Added helper conversion functions for LinkedAccount-specific enums:
  - `linkedAccountPlatformToProto` / `linkedAccountPlatformFromProto`
  - `linkedAccountAuthMethodToProto` / `linkedAccountAuthMethodFromProto`
  - `linkedAccountStatusToProto` / `linkedAccountStatusFromProto`

### `internal/server/server.go`
- **CreateLinkedAccount**: Validates collection_id, platform, auth_method, and
  auth_token. Delegates to `store.CreateLinkedAccount` and returns the proto
  conversion.
- **GetLinkedAccount**: Parses UUID, fetches from store, returns proto.
- **DeleteLinkedAccount**: Parses UUID, deletes via store, returns empty response.
- **ListLinkedAccounts**: Supports filtering by collection_id, platform, and
  status. Uses cursor-based pagination consistent with other List RPCs.

### `internal/server/linkedaccount_test.go`
- 17 test cases across 4 test functions covering:
  - Create: success, auth_token omission, expires_at, missing platform/auth_method/auth_token, invalid collection_id
  - Get: success, not found, invalid id
  - Delete: success (with verification), not found, invalid id
  - List: list all, filter by collection, filter by platform, pagination, empty collection

## Testing

All tests pass:
```
go build github.com/farmtable-io/farmtable/internal/server  # OK
go test github.com/farmtable-io/farmtable/internal/server    # PASS (all tests)
```

## Notes

- The `go build ./...` command fails with a pre-existing import cycle in
  `internal/store/multistore.go` (unrelated to this PR). Building the server
  package directly (`go build github.com/farmtable-io/farmtable/internal/server`)
  succeeds.
- Follows existing patterns from Task/Collection/Comment RPCs for error handling
  and pagination.

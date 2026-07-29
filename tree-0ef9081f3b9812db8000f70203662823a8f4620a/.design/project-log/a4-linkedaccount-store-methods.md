# A4: LinkedAccount Store Methods

**Date:** 2026-07-21
**Branch:** `feat/extstore-a4-linkedaccount-store`
**Task:** Implement store layer CRUD for the LinkedAccount entity

## Summary

Added LinkedAccount store methods to support the External Store Passthrough
feature. This builds on the LinkedAccount Ent schema merged in PR #85 and
provides the data access layer needed for managing platform credentials
(GitHub PATs, OAuth tokens, etc.) tied to collections.

## Changes

### `internal/store/store.go`
- Added `CreateLinkedAccountParams` struct with fields: CollectionID, Platform,
  AuthToken, AuthMethod, Scopes (optional), RemoteUserID (optional), ExpiresAt
  (optional).
- Added `ListLinkedAccountsParams` struct with filters: CollectionID, Platform,
  Status, Limit, LastID (cursor-based pagination).
- Added 4 methods to the `Store` interface:
  - `CreateLinkedAccount` — creates a new linked account
  - `GetLinkedAccount` — retrieves by UUID
  - `DeleteLinkedAccount` — removes by UUID
  - `ListLinkedAccounts` — paginated list with optional filters

### `internal/store/entstore.go`
- Implemented all 4 methods on `EntStore` using Ent query builders.
- `CreateLinkedAccount` maps string platform/auth_method to Ent enum types.
- `ListLinkedAccounts` supports filtering by collection_id, platform, and
  status, with keyset pagination using `(created_at, id)` cursor — matches
  the pattern used by ListCollections, ListUsers, etc.
- Added `keysetPredLinkedAccount` helper for cursor-based pagination.
- Updated `Truncate()` to clear `linked_accounts` table (FK-safe ordering).

### `internal/store/multistore.go`
- All 4 LinkedAccount methods delegate to `m.primary` since credentials are
  global (always in the primary Postgres DB), not per-platform-store.

### `internal/store/linkedaccount_test.go` (new file)
- 12 test cases covering:
  - Create with all fields, minimal fields, and optional ExpiresAt
  - Get by ID and not-found error
  - Delete and delete-not-found error
  - List with no filter, by collection, by platform, by status
  - Pagination across multiple pages
  - Auth token stored and retrievable (sensitive field verification)

## Design Decisions

- **Keyset pagination** uses `(created_at, id)` composite cursor rather than
  ID-only, matching existing patterns and handling UUID v4 randomness correctly.
- **MultiStore always delegates to primary** — linked accounts represent
  credentials for external platforms and belong in the central Postgres DB,
  not in per-collection ephemeral stores.
- **No update method** — not in scope for this task; credential rotation will
  be addressed separately.
- **Auth token is `json:"-"`** in the Ent entity (excluded from JSON
  serialization) but is always available via direct struct field access in
  Go code, which tests verify.

## Verification

- `go build ./...` — passes
- `go test ./...` — all tests pass (including 12 new LinkedAccount tests)

# Auth Stage 4: Scoped Tokens & Basic RBAC

**Date:** 2026-07-23  
**Author:** developer agent  
**Stage:** Completed

## Summary

Implemented scoped tokens and basic RBAC (Role-Based Access Control) for the Farm Table API. Previously, all API tokens had equivalent access. This stage adds per-token scope restrictions and per-collection access controls.

## Changes

### Schema Changes
- **`internal/store/schema/apitoken.go`** - Added `scopes` (JSON string array, optional) and `collection_ids` (JSON UUID array, optional) fields to the ApiToken Ent schema. Ran `go generate ./internal/store/ent` to regenerate Ent code.
- **`internal/store/store.go`** - Extended `CreateAPITokenParams` with `Scopes []string` and `CollectionIDs []uuid.UUID`.
- **`internal/store/entstore.go`** - Updated `CreateAPIToken` to persist scopes and collection_ids.

### Scope Vocabulary & Enforcement
- **`internal/server/scopes.go`** (new) - Defines scope constants (`task:read`, `task:write`, `task:claim`, `collection:read`, `collection:write`, `collection:admin`, `token:manage`, `user:read`, `*`), context helpers, `RequireScope()`, `RequireCollectionAccess()`, `DefaultScopesForUserType()`, and `ValidateScopes()`.

### Auth System Updates
- **`internal/server/auth.go`** - Extended `TokenLookupResult` with `Scopes` and `CollectionIDs`. Updated both unary and stream interceptors to inject scopes/collection_ids into context.
- **`internal/server/token_lookup.go`** - `StoreTokenLookup.LookupByHash` now populates scopes and collection_ids from the token record.

### RPC Handler Enforcement
- **`internal/server/server.go`** - Added `RequireScope()` calls to all RPC handlers:
  - Read RPCs: `task:read` or `collection:read` as appropriate
  - Write RPCs: `task:write` or `collection:write`
  - ClaimTask: `task:claim`
  - Admin RPCs (import, linked account create/delete): `collection:admin`
  - User RPCs: `user:read`
  - Collection access checks where collection_id is specified
- **`internal/server/export_import.go`** - Added `collection:read` to ExportCollection, `collection:admin` to ImportCollection.
- **`internal/server/watch.go`** - Added `task:read` to WatchTasks.

### CLI Updates
- **`internal/cli/token.go`** - Added `--scope` (repeatable) and `--collection` (repeatable UUID) flags to `ft token create`. Implements user type-based default scopes when no explicit scopes are given.

### Tests
- **`internal/server/rbac_test.go`** (new) - 24 tests covering:
  - RequireScope: wildcard, nil, empty, specific, missing, open-access
  - RequireCollectionAccess: no restrictions, allowed, denied
  - DefaultScopesForUserType: all 5 user types
  - ValidateScopes: valid and invalid
  - Integration tests: wildcard token, nil-scoped legacy token, read-only restrictions, claim scope requirement, collection scoping, user:read restriction, collection:admin requirement
  - Store-level tests: scopes persistence, collection_ids persistence, no-scopes legacy behavior, lookup returns scopes

## Design Decisions

1. **Nil scopes = wildcard (backward compatible):** Existing tokens created before this stage have nil scopes and continue to work with full access.
2. **User type-based defaults:** When creating tokens via CLI without explicit `--scope`, defaults are applied based on user type (admin/human/service_account get `*`, agent gets read+write+claim, viewer gets read-only).
3. **Scope enforcement in handler layer, not interceptor:** RequireScope is called at the top of each handler rather than in the interceptor. This allows exempt endpoints (health/version) to bypass scope checks naturally and keeps the scope requirements visible in each handler.
4. **Collection scoping is additive to scope checks:** A token must have both the right scope AND collection access. Collection restrictions are checked separately after scope checks.

## Backward Compatibility

- All existing tokens (nil scopes, no collection restrictions) continue to work with full wildcard access.
- Open-access mode (no auth configured) continues to allow all operations.
- All existing tests pass without modification.

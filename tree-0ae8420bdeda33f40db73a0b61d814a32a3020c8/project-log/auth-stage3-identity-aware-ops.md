# Auth Stage 3: Identity-Aware Operations

**Date:** 2026-07-23
**Branch:** `auth/stage3-identity-aware-ops`
**Commit:** 3074952

## Summary

Implemented identity enforcement for mutating RPCs as the third stage of the
auth hardening plan. After Stage 1 made authentication mandatory when token
auth is configured, this stage ensures that mutating operations require a
real user identity (non-nil UUID) rather than just a valid token.

## Changes

### RequireIdentity helper (`internal/server/auth.go`)

- Added `RequireIdentity(ctx) (uuid.UUID, error)` function that extracts the
  user ID from context and returns `codes.Unauthenticated` if the user ID is
  `uuid.Nil` or missing
- Uses an `authEnforcedKey` context flag (set by the auth interceptors) to
  distinguish between open-access mode (no auth configured, mutations allowed)
  and enforced-auth mode (identity required for mutations)
- Added `ContextWithAuthEnforced(ctx)` export for test use

### Auth interceptors (`internal/server/auth.go`)

- Both `TokenAuthInterceptor` (unary) and `TokenAuthStreamInterceptor` (stream)
  now set the `authEnforcedKey` context flag when a non-nil `TokenLookup` is
  configured
- This allows downstream `RequireIdentity` calls to enforce identity only when
  auth is actually configured

### Mutating RPC enforcement (`internal/server/server.go`, `export_import.go`, `watch.go`)

All mutating RPCs now call `RequireIdentity(ctx)` at the top of their handler:
- CreateTask, InsertTasksAfter, UpdateTask, ClaimTask, CloseTask, DeleteTask
- AddComment
- CreateCollection, UpdateCollection, ImportCollection
- CreateLinkedAccount, DeleteLinkedAccount
- WatchTasks (streaming RPC that creates server-side subscription state)

Read-only RPCs remain unaffected: ListTasks, GetTask, ListComments, GetComment,
ListCollections, GetCollection, ExportCollection, GetLinkedAccount,
ListLinkedAccounts, GetReadyTasks, GetBlockedTasks, GetDependencyTree,
GetCriticalPath, GetBottlenecks, ListChanges, WhoAmI, ListUsers, GetUser,
GetStatus, GetVersion.

### Actor ID propagation fixes

- Removed `uuid.Nil -> uuid.New()` fallback in `ClaimTask` and `AddComment`
  since `RequireIdentity` guarantees a valid user ID when auth is enforced
- Change records now always capture the authenticated user as the actor

### LegacyTokenAuth deprecation (`internal/server/auth.go`)

- Marked `LegacyTokenAuth` as deprecated with a doc comment explaining that
  it returns `uuid.Nil` which always fails identity checks
- Only used in one test (`TestAuthInterceptor_MissingBearerPrefix`)
- Production server already uses `NewStoreTokenLookup` exclusively

### Test infrastructure (`internal/testutil/testserver.go`)

- Added `NewTestServerWithAuthAndStreaming` helper for tests needing both auth
  interceptors and the event bus (WatchTasks)
- Added stream interceptor to existing `NewTestServerWithAuth` helper

### Tests (`internal/server/identity_enforcement_test.go`)

Comprehensive test coverage:
- `TestIdentity_MutatingRPCsRejectLegacyAuth` - all 12 mutating RPCs reject uuid.Nil identity
- `TestIdentity_MutatingRPCsAcceptValidAuth` - all mutating RPCs work with valid identity
- `TestIdentity_ReadOnlyRPCsAccessibleWithValidAuth` - 16 read-only RPCs verified accessible
- `TestIdentity_ChangeRecordsCaptureActor` - UpdateTask change records have correct actor
- `TestIdentity_CloseTaskRecordsActor` - CloseTask change records have correct actor
- `TestIdentity_WatchTasksRequiresAuth` - unauthenticated WatchTasks rejected
- `TestIdentity_WatchTasksRejectsLegacyAuth` - legacy auth WatchTasks rejected
- `TestIdentity_WatchTasksAcceptsValidAuth` - authenticated WatchTasks works
- `TestRequireIdentity_ValidUserID` - valid user returns ID
- `TestRequireIdentity_NilUserID` - nil user rejected (auth enforced)
- `TestRequireIdentity_NoUserInContext` - no user rejected (auth enforced)
- `TestRequireIdentity_OpenAccessMode` - no auth configured returns uuid.Nil without error

## Design Decisions

1. **Open-access backward compatibility**: Rather than unconditionally requiring
   identity, we check whether auth enforcement is active. This allows deployments
   without token auth to continue working with all RPCs.

2. **Context-based enforcement flag**: Using a context key set by the interceptor
   rather than a service-level flag keeps the RequireIdentity function stateless
   and testable without needing a service instance.

3. **LegacyTokenAuth retained**: Though deprecated, it's retained for backward
   compatibility. The deprecation comment guides users to StoreTokenLookup.

## Files Modified

- `internal/server/auth.go` - RequireIdentity, ContextWithAuthEnforced, auth flag, deprecation
- `internal/server/server.go` - identity checks on mutating RPCs, removed Nil fallbacks
- `internal/server/watch.go` - identity check on WatchTasks
- `internal/server/export_import.go` - identity check on ImportCollection
- `internal/testutil/testserver.go` - NewTestServerWithAuthAndStreaming, stream interceptor
- `internal/server/identity_enforcement_test.go` - comprehensive tests (new file)

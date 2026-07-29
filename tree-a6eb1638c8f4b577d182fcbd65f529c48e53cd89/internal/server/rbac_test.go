package server_test

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// createTestUserAndToken creates a user with the given type and a token
// with the given scopes and collection IDs.
func createTestUserAndToken(t *testing.T, s *store.EntStore, userType string, scopes []string, collectionIDs []uuid.UUID) (uuid.UUID, string) {
	t.Helper()
	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "test-" + userType,
		Type:        userType,
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID:        u.ID,
		Name:          "test-token",
		Scopes:        scopes,
		CollectionIDs: collectionIDs,
	})
	if err != nil {
		t.Fatalf("creating token: %v", err)
	}
	return u.ID, rawToken
}

func authCtx(token string) context.Context {
	return metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer "+token)
}

// ── RequireScope unit tests ──

func TestRequireScope_WildcardAllows(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	ctx = server.ContextWithScopes(ctx, []string{server.ScopeWildcard})

	if err := server.RequireScope(ctx, server.ScopeTaskRead); err != nil {
		t.Fatalf("wildcard scope should allow task:read, got: %v", err)
	}
	if err := server.RequireScope(ctx, server.ScopeCollectionAdmin); err != nil {
		t.Fatalf("wildcard scope should allow collection:admin, got: %v", err)
	}
}

func TestRequireScope_NilScopesIsWildcard(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	// No scopes set = nil = wildcard behavior

	if err := server.RequireScope(ctx, server.ScopeTaskRead); err != nil {
		t.Fatalf("nil scopes should be treated as wildcard, got: %v", err)
	}
}

func TestRequireScope_EmptyScopesIsWildcard(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	ctx = server.ContextWithScopes(ctx, []string{})

	if err := server.RequireScope(ctx, server.ScopeTaskRead); err != nil {
		t.Fatalf("empty scopes should be treated as wildcard, got: %v", err)
	}
}

func TestRequireScope_SpecificScopeAllows(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	ctx = server.ContextWithScopes(ctx, []string{server.ScopeTaskRead, server.ScopeTaskWrite})

	if err := server.RequireScope(ctx, server.ScopeTaskRead); err != nil {
		t.Fatalf("specific scope should allow matching scope, got: %v", err)
	}
	if err := server.RequireScope(ctx, server.ScopeTaskWrite); err != nil {
		t.Fatalf("specific scope should allow matching scope, got: %v", err)
	}
}

func TestRequireScope_MissingScopeRejectsPermissionDenied(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	ctx = server.ContextWithScopes(ctx, []string{server.ScopeTaskRead})

	err := server.RequireScope(ctx, server.ScopeTaskWrite)
	if err == nil {
		t.Fatal("expected PermissionDenied for missing scope")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got: %v", err)
	}
	if st.Code() != codes.PermissionDenied {
		t.Errorf("code = %v, want PermissionDenied", st.Code())
	}
}

func TestRequireScope_NoAuthEnforcedAllows(t *testing.T) {
	// Open-access mode: no auth enforced
	ctx := context.Background()

	if err := server.RequireScope(ctx, server.ScopeTaskRead); err != nil {
		t.Fatalf("open access mode should allow everything, got: %v", err)
	}
}

// ── RequireCollectionAccess unit tests ──

func TestRequireCollectionAccess_NoRestrictions(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	// No collection IDs set = no restrictions

	if err := server.RequireCollectionAccess(ctx, uuid.New()); err != nil {
		t.Fatalf("no collection restrictions should allow any collection, got: %v", err)
	}
}

func TestRequireCollectionAccess_AllowedCollection(t *testing.T) {
	allowedID := uuid.New()
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	ctx = server.ContextWithCollectionIDs(ctx, []uuid.UUID{allowedID})

	if err := server.RequireCollectionAccess(ctx, allowedID); err != nil {
		t.Fatalf("should allow access to listed collection, got: %v", err)
	}
}

func TestRequireCollectionAccess_DeniedCollection(t *testing.T) {
	allowedID := uuid.New()
	deniedID := uuid.New()
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	ctx = server.ContextWithCollectionIDs(ctx, []uuid.UUID{allowedID})

	err := server.RequireCollectionAccess(ctx, deniedID)
	if err == nil {
		t.Fatal("expected PermissionDenied for unlisted collection")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got: %v", err)
	}
	if st.Code() != codes.PermissionDenied {
		t.Errorf("code = %v, want PermissionDenied", st.Code())
	}
}

// ── DefaultScopesForUserType tests ──

func TestDefaultScopesForUserType(t *testing.T) {
	tests := []struct {
		userType string
		expected []string
	}{
		{"admin", []string{server.ScopeWildcard}},
		{"agent", []string{server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeTaskClaim, server.ScopeCollectionRead}},
		{"viewer", []string{server.ScopeTaskRead, server.ScopeCollectionRead}},
		{"human", []string{server.ScopeWildcard}},
		{"service_account", []string{server.ScopeWildcard}},
	}
	for _, tt := range tests {
		t.Run(tt.userType, func(t *testing.T) {
			got := server.DefaultScopesForUserType(tt.userType)
			if len(got) != len(tt.expected) {
				t.Fatalf("DefaultScopesForUserType(%q) = %v, want %v", tt.userType, got, tt.expected)
			}
			for i, s := range got {
				if s != tt.expected[i] {
					t.Errorf("scope[%d] = %q, want %q", i, s, tt.expected[i])
				}
			}
		})
	}
}

// ── ValidateScopes tests ──

func TestValidateScopes_Valid(t *testing.T) {
	if err := server.ValidateScopes([]string{server.ScopeTaskRead, server.ScopeWildcard}); err != nil {
		t.Fatalf("expected valid scopes to pass, got: %v", err)
	}
}

func TestValidateScopes_Invalid(t *testing.T) {
	err := server.ValidateScopes([]string{server.ScopeTaskRead, "bogus:scope"})
	if err == nil {
		t.Fatal("expected error for invalid scope")
	}
}

// ── Integration tests: scoped tokens with gRPC server ──

func TestScopedToken_WildcardAllowsEverything(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Create wildcard-scoped token (nil scopes = wildcard)
	_, rawToken := createTestUserAndToken(t, s, "admin", nil, nil)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	ctx := authCtx(rawToken)

	// Should be able to list collections (collection:read)
	if _, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{}); err != nil {
		t.Fatalf("wildcard token should allow ListCollections: %v", err)
	}

	// Should be able to list users (user:read)
	if _, err := client.ListUsers(ctx, &pb.ListUsersRequest{}); err != nil {
		t.Fatalf("wildcard token should allow ListUsers: %v", err)
	}

	// Should be able to create a collection (collection:write)
	if _, err := client.CreateCollection(ctx, &pb.CreateCollectionRequest{Name: "test"}); err != nil {
		t.Fatalf("wildcard token should allow CreateCollection: %v", err)
	}
}

func TestScopedToken_ExistingTokenNilScopesIsWildcard(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Simulate existing token without scopes (pre-RBAC migration)
	_, rawToken := createTestUserAndToken(t, s, "human", nil, nil)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	ctx := authCtx(rawToken)

	// Existing tokens with nil scopes should work as wildcard
	if _, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{}); err != nil {
		t.Fatalf("nil-scoped token should act as wildcard: %v", err)
	}
	if _, err := client.ListUsers(ctx, &pb.ListUsersRequest{}); err != nil {
		t.Fatalf("nil-scoped token should act as wildcard: %v", err)
	}
}

func TestScopedToken_ReadOnlyCannotWrite(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Create a read-only token
	_, rawToken := createTestUserAndToken(t, s, "viewer",
		[]string{server.ScopeTaskRead, server.ScopeCollectionRead}, nil)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	ctx := authCtx(rawToken)

	// Read operations should work
	if _, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{}); err != nil {
		t.Fatalf("read-only token should allow ListCollections: %v", err)
	}

	// Write operations should be rejected
	_, err := client.CreateCollection(ctx, &pb.CreateCollectionRequest{Name: "test"})
	if err == nil {
		t.Fatal("read-only token should not allow CreateCollection")
	}
	assertPermissionDenied(t, err, "CreateCollection")

	// Task write should also be rejected — create a collection with an admin token first
	_, adminToken := createTestUserAndToken(t, s, "admin", []string{server.ScopeWildcard}, nil)
	adminCtx := authCtx(adminToken)
	collResp, createErr := client.CreateCollection(adminCtx, &pb.CreateCollectionRequest{Name: "test"})
	if createErr != nil {
		t.Fatalf("creating test collection: %v", createErr)
	}
	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		Name:         "test task",
		CollectionId: collResp.GetId(),
	})
	if err == nil {
		t.Fatal("read-only token should not allow CreateTask")
	}
	assertPermissionDenied(t, err, "CreateTask")
}

func TestScopedToken_TaskClaimRequiresScope(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Token with task:read and task:write but NOT task:claim
	_, rawToken := createTestUserAndToken(t, s, "agent",
		[]string{server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeCollectionRead}, nil)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	// Create a collection and task using a wildcard admin token
	_, adminToken := createTestUserAndToken(t, s, "admin",
		[]string{server.ScopeWildcard}, nil)
	adminCtx := authCtx(adminToken)

	collResp, err := client.CreateCollection(adminCtx, &pb.CreateCollectionRequest{Name: "claim-test"})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	taskResp, err := client.CreateTask(adminCtx, &pb.CreateTaskRequest{
		Name:         "claim me",
		CollectionId: collResp.GetId(),
	})
	if err != nil {
		t.Fatalf("creating task: %v", err)
	}

	// Attempt to claim with token lacking task:claim
	agentCtx := authCtx(rawToken)
	_, err = client.ClaimTask(agentCtx, &pb.ClaimTaskRequest{Id: taskResp.GetId()})
	if err == nil {
		t.Fatal("token without task:claim should not allow ClaimTask")
	}
	assertPermissionDenied(t, err, "ClaimTask")
}

func TestScopedToken_CollectionScopingRestricts(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Create two collections using admin
	_, adminToken := createTestUserAndToken(t, s, "admin",
		[]string{server.ScopeWildcard}, nil)
	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	adminCtx := authCtx(adminToken)
	coll1, err := client.CreateCollection(adminCtx, &pb.CreateCollectionRequest{Name: "coll-1"})
	if err != nil {
		t.Fatalf("creating collection 1: %v", err)
	}
	coll2, err := client.CreateCollection(adminCtx, &pb.CreateCollectionRequest{Name: "coll-2"})
	if err != nil {
		t.Fatalf("creating collection 2: %v", err)
	}

	// Create a token scoped to collection 1 only
	coll1ID, _ := uuid.Parse(coll1.GetId())
	_, scopedToken := createTestUserAndToken(t, s, "agent",
		[]string{server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeCollectionRead},
		[]uuid.UUID{coll1ID})

	scopedCtx := authCtx(scopedToken)

	// Should be able to access collection 1
	if _, err := client.GetCollection(scopedCtx, &pb.GetCollectionRequest{Id: coll1.GetId()}); err != nil {
		t.Fatalf("scoped token should access coll-1: %v", err)
	}

	// Should NOT be able to access collection 2
	_, err = client.GetCollection(scopedCtx, &pb.GetCollectionRequest{Id: coll2.GetId()})
	if err == nil {
		t.Fatal("collection-scoped token should not access unscoped collection")
	}
	assertPermissionDenied(t, err, "GetCollection for restricted collection")

	// Creating task in collection 1 should work
	_, err = client.CreateTask(scopedCtx, &pb.CreateTaskRequest{
		Name:         "task in coll-1",
		CollectionId: coll1.GetId(),
	})
	if err != nil {
		t.Fatalf("scoped token should create task in allowed collection: %v", err)
	}

	// Creating task in collection 2 should fail
	_, err = client.CreateTask(scopedCtx, &pb.CreateTaskRequest{
		Name:         "task in coll-2",
		CollectionId: coll2.GetId(),
	})
	if err == nil {
		t.Fatal("collection-scoped token should not create task in unscoped collection")
	}
	assertPermissionDenied(t, err, "CreateTask in restricted collection")
}

func TestScopedToken_UserReadRestriction(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Token with only task scopes (no user:read)
	_, rawToken := createTestUserAndToken(t, s, "agent",
		[]string{server.ScopeTaskRead, server.ScopeCollectionRead}, nil)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	ctx := authCtx(rawToken)

	// user:read should be denied
	_, err := client.ListUsers(ctx, &pb.ListUsersRequest{})
	if err == nil {
		t.Fatal("token without user:read should not allow ListUsers")
	}
	assertPermissionDenied(t, err, "ListUsers")
}

func TestScopedToken_TokenManageRequired(t *testing.T) {
	// token:manage scope is defined but there are currently no
	// gRPC RPCs for token management. This test verifies the scope
	// validation works as a constant.
	if err := server.ValidateScopes([]string{server.ScopeTokenManage}); err != nil {
		t.Fatalf("token:manage should be a valid scope, got: %v", err)
	}
}

func TestScopedToken_CollectionAdminRequired(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Token without collection:admin
	_, rawToken := createTestUserAndToken(t, s, "agent",
		[]string{server.ScopeTaskRead, server.ScopeCollectionRead, server.ScopeCollectionWrite}, nil)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	ctx := authCtx(rawToken)

	// ImportCollection requires collection:admin
	_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{
		Data: []byte(`{"format_version":1,"generator":"farmtable","collection":{"name":"test","platform":"farmtable"},"users":[],"tasks":[],"comments":[],"relationships":[],"changes":[]}`),
	})
	if err == nil {
		t.Fatal("token without collection:admin should not allow ImportCollection")
	}
	assertPermissionDenied(t, err, "ImportCollection")
}

// ── Store-level tests for scopes/collection_ids persistence ──

func TestCreateAPIToken_WithScopes(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "scoped-user",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	scopes := []string{server.ScopeTaskRead, server.ScopeTaskWrite}
	tok, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "scoped-token",
		Scopes: scopes,
	})
	if err != nil {
		t.Fatalf("creating scoped token: %v", err)
	}

	if len(tok.Scopes) != 2 {
		t.Fatalf("expected 2 scopes, got %d", len(tok.Scopes))
	}
	if tok.Scopes[0] != server.ScopeTaskRead || tok.Scopes[1] != server.ScopeTaskWrite {
		t.Errorf("scopes = %v, want [task:read, task:write]", tok.Scopes)
	}
}

func TestCreateAPIToken_WithCollectionIDs(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "coll-scoped-user",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	collID := uuid.New()
	tok, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID:        u.ID,
		Name:          "coll-scoped-token",
		Scopes:        []string{server.ScopeTaskRead},
		CollectionIDs: []uuid.UUID{collID},
	})
	if err != nil {
		t.Fatalf("creating collection-scoped token: %v", err)
	}

	if len(tok.CollectionIds) != 1 {
		t.Fatalf("expected 1 collection ID, got %d", len(tok.CollectionIds))
	}
	if tok.CollectionIds[0] != collID {
		t.Errorf("collection_ids[0] = %v, want %v", tok.CollectionIds[0], collID)
	}
}

func TestCreateAPIToken_NoScopes(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "legacy-user",
		Type:        "human",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	tok, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "legacy-token",
	})
	if err != nil {
		t.Fatalf("creating token without scopes: %v", err)
	}

	if len(tok.Scopes) != 0 {
		t.Errorf("expected nil/empty scopes for legacy token, got %v", tok.Scopes)
	}
	if len(tok.CollectionIds) != 0 {
		t.Errorf("expected nil/empty collection_ids for legacy token, got %v", tok.CollectionIds)
	}
}

func TestLookupToken_ReturnsScopesAndCollectionIDs(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "lookup-user",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	collID := uuid.New()
	scopes := []string{server.ScopeTaskRead, server.ScopeCollectionRead}
	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID:        u.ID,
		Name:          "lookup-token",
		Scopes:        scopes,
		CollectionIDs: []uuid.UUID{collID},
	})
	if err != nil {
		t.Fatalf("creating token: %v", err)
	}

	lookup := server.NewStoreTokenLookup(s)
	hash := store.HashToken(rawToken)
	result, err := lookup.LookupByHash(ctx, hash)
	if err != nil {
		t.Fatalf("looking up token: %v", err)
	}

	if len(result.Scopes) != 2 {
		t.Fatalf("expected 2 scopes from lookup, got %d", len(result.Scopes))
	}
	if result.Scopes[0] != server.ScopeTaskRead || result.Scopes[1] != server.ScopeCollectionRead {
		t.Errorf("lookup scopes = %v, want [task:read, collection:read]", result.Scopes)
	}

	if len(result.CollectionIDs) != 1 {
		t.Fatalf("expected 1 collection ID from lookup, got %d", len(result.CollectionIDs))
	}
	if result.CollectionIDs[0] != collID {
		t.Errorf("lookup collection_ids[0] = %v, want %v", result.CollectionIDs[0], collID)
	}
}

// ── Helpers ──

func assertPermissionDenied(t *testing.T, err error, context string) {
	t.Helper()
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("[%s] expected gRPC status error, got: %v", context, err)
	}
	if st.Code() != codes.PermissionDenied {
		t.Errorf("[%s] code = %v, want PermissionDenied", context, st.Code())
	}
}

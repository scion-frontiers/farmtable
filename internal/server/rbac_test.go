package server_test

import (
	"context"
	"strings"
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

// defaultScopes resolves a recognised user type's default scopes, and fails the
// test if the vocabulary ever stops containing that type. Fixtures route
// through this helper so that a token minted for a known type always carries
// the scopes that type is supposed to have, rather than relying on an empty
// scope set being read as wildcard.
func defaultScopes(t *testing.T, userType string) []string {
	t.Helper()
	scopes, err := server.DefaultScopesForUserType(userType)
	if err != nil {
		t.Fatalf("DefaultScopesForUserType(%q): %v", userType, err)
	}
	return scopes
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

// Until 2026-07-29 this test was named TestRequireScope_NilScopesIsWildcard and
// asserted that a nil scope set ALLOWED everything. That assertion was the bug,
// not a description of it: an absent scope set is a principal that holds no
// scopes, and it must grant nothing.
func TestRequireScope_NilScopesDenied(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	// No scopes set at all: the principal holds nothing.

	err := server.RequireScope(ctx, server.ScopeTaskRead)
	if err == nil {
		t.Fatal("nil scopes must grant nothing, got allow")
	}
	assertPermissionDenied(t, err, "nil scopes")
}

// Until 2026-07-29 this test was named TestRequireScope_EmptyScopesIsWildcard
// and asserted the opposite. See TestRequireScope_NilScopesDenied.
func TestRequireScope_EmptyScopesDenied(t *testing.T) {
	ctx := context.Background()
	ctx = server.ContextWithAuthEnforced(ctx)
	ctx = server.ContextWithScopes(ctx, []string{})

	err := server.RequireScope(ctx, server.ScopeTaskRead)
	if err == nil {
		t.Fatal("empty scopes must grant nothing, got allow")
	}
	assertPermissionDenied(t, err, "empty scopes")
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
			got := defaultScopes(t, tt.userType)
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

	// Grant the wildcard explicitly. Until 2026-07-29 this passed nil here and
	// relied on "nil scopes = wildcard", so despite its name it never exercised
	// a wildcard token at all — it exercised the empty-set escalation, and would
	// have kept passing if the wildcard match in RequireScope were deleted.
	_, rawToken := createTestUserAndToken(t, s, "admin", []string{server.ScopeWildcard}, nil)

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

// Until 2026-07-29 this test was named
// TestScopedToken_ExistingTokenNilScopesIsWildcard and asserted that a token
// carrying no scopes was allowed through every scoped RPC. It passed, green, for
// the whole life of the escalation — a named test certifying that the
// vulnerability was intended behaviour. It is inverted rather than deleted so
// that the invariant keeps a test carrying its name.
func TestScopedToken_ExistingTokenNilScopesDenied(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// A token predating the scope vocabulary, or minted for an unrecognised
	// user type: the row simply has no scopes.
	_, rawToken := createTestUserAndToken(t, s, "human", nil, nil)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	ctx := authCtx(rawToken)

	_, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
	if err == nil {
		t.Fatal("nil-scoped token must be denied ListCollections, got allow")
	}
	assertPermissionDenied(t, err, "ListCollections")

	_, err = client.ListUsers(ctx, &pb.ListUsersRequest{})
	if err == nil {
		t.Fatal("nil-scoped token must be denied ListUsers, got allow")
	}
	assertPermissionDenied(t, err, "ListUsers")

	// The ruling requires the denial to be discoverable, so the message must
	// name the scope that was refused rather than failing blank.
	if !strings.Contains(err.Error(), server.ScopeUserRead) {
		t.Errorf("denial must name the required scope %q, got: %v",
			server.ScopeUserRead, err)
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

	// Deliberately scope-less. This is a storage assertion, not an
	// authorization one: the store still accepts a row with no scopes, and an
	// omitted set still round-trips as empty rather than as something else.
	// Enforcement happens at RequireScope, not here. A future sweep for
	// scope-less mints will flag this line; leaving it is correct.
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

// ── Lifecycle scope enforcement (task:accept / task:close) ──

// lifecycleFixture spins up an authenticated server with a collection and
// returns the client plus an admin context for fixture setup.
func lifecycleFixture(t *testing.T) (pb.FarmTableServiceClient, context.Context, string, *store.EntStore) {
	t.Helper()

	s, storeCleanup := testutil.NewTestStore(t)
	t.Cleanup(storeCleanup)

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	t.Cleanup(cleanup)

	_, adminToken := createTestUserAndToken(t, s, "admin", []string{server.ScopeWildcard}, nil)
	adminCtx := authCtx(adminToken)

	coll, err := client.CreateCollection(adminCtx, &pb.CreateCollectionRequest{Name: "lifecycle"})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}
	return client, adminCtx, coll.GetId(), s
}

func createLifecycleTask(t *testing.T, client pb.FarmTableServiceClient, ctx context.Context, collID, name string, stage *pb.TaskStage) *pb.Task {
	t.Helper()
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		Name:         name,
		CollectionId: collID,
		Stage:        stage,
	})
	if err != nil {
		t.Fatalf("creating task %q: %v", name, err)
	}
	return created
}

func createClaimedLifecycleTask(t *testing.T, client pb.FarmTableServiceClient, ctx context.Context, collID, name string) *pb.Task {
	t.Helper()
	accepted := createLifecycleTask(t, client, ctx, collID, name, stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED))
	claimed, err := client.ClaimTask(ctx, &pb.ClaimTaskRequest{Id: accepted.GetId()})
	if err != nil {
		t.Fatalf("claiming task %q: %v", name, err)
	}
	return claimed.GetTask()
}

func stageProtoPtr(s pb.TaskStage) *pb.TaskStage { return &s }

func assertFailedPrecondition(t *testing.T, err error, context string) {
	t.Helper()
	if err == nil {
		t.Fatalf("[%s] expected FailedPrecondition, got nil error", context)
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("[%s] expected gRPC status error, got: %v", context, err)
	}
	if st.Code() != codes.FailedPrecondition {
		t.Errorf("[%s] code = %v (%s), want FailedPrecondition", context, st.Code(), st.Message())
	}
}

// An agent-scoped token has task:write but not task:accept, so it cannot move
// a task out of triage.
func TestScopedToken_AgentCannotAcceptFromTriage(t *testing.T) {
	client, adminCtx, collID, s := lifecycleFixture(t)
	_, agentToken := createTestUserAndToken(t, s, "agent",
		defaultScopes(t, "agent"), nil)
	agentCtx := authCtx(agentToken)

	triaged := createLifecycleTask(t, client, adminCtx, collID, "needs accepting", nil)
	if triaged.GetStage() != pb.TaskStage_TASK_STAGE_TRIAGE {
		t.Fatalf("fixture stage = %v, want TRIAGE", triaged.GetStage())
	}

	for _, target := range []pb.TaskStage{
		pb.TaskStage_TASK_STAGE_ACCEPTED,
		pb.TaskStage_TASK_STAGE_ACCEPTED,
	} {
		_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
			Id:    triaged.GetId(),
			Stage: stageProtoPtr(target),
		})
		if err == nil {
			t.Fatalf("agent token should not be able to move triage → %v", target)
		}
		assertPermissionDenied(t, err, "UpdateTask triage → "+target.String())
	}
	_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
		Id:    triaged.GetId(),
		Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_WORKING),
	})
	if err == nil {
		t.Fatal("direct UpdateTask to working should be rejected")
	}
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("UpdateTask triage → working code = %v, want InvalidArgument", status.Code(err))
	}

	// Non-stage writes still work with task:write.
	newName := "renamed by agent"
	if _, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
		Id:   triaged.GetId(),
		Name: &newName,
	}); err != nil {
		t.Fatalf("agent token should still allow non-stage updates: %v", err)
	}
}

// Parking a task in an on-hold stage must not launder it out of triage: with
// only task:write an agent could otherwise do triage → blocked → accepted → claim
// and never pass the accept gate.
func TestScopedToken_AgentCannotLaunderOutOfTriageViaOnHold(t *testing.T) {
	client, adminCtx, collID, s := lifecycleFixture(t)
	_, agentToken := createTestUserAndToken(t, s, "agent",
		defaultScopes(t, "agent"), nil)
	agentCtx := authCtx(agentToken)

	triaged := createLifecycleTask(t, client, adminCtx, collID, "launder me", nil)

	// Hop 1 of the laundering path is refused, so the rest is unreachable.
	for _, onHold := range []pb.TaskStage{
		pb.TaskStage_TASK_STAGE_ACCEPTED,
		pb.TaskStage_TASK_STAGE_ACCEPTED,
		pb.TaskStage_TASK_STAGE_ACCEPTED,
		pb.TaskStage_TASK_STAGE_ACCEPTED,
	} {
		_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
			Id:    triaged.GetId(),
			Stage: stageProtoPtr(onHold),
		})
		if err == nil {
			t.Fatalf("agent token should not be able to move triage → %v", onHold)
		}
		assertPermissionDenied(t, err, "UpdateTask triage → "+onHold.String())
	}

	// The task never left triage, so ClaimTask still hits the accept gate.
	resp, err := client.GetTask(adminCtx, &pb.GetTaskRequest{Id: triaged.GetId()})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if resp.GetTask().GetStage() != pb.TaskStage_TASK_STAGE_TRIAGE {
		t.Fatalf("stage = %v, want TRIAGE", resp.GetTask().GetStage())
	}
	_, err = client.ClaimTask(agentCtx, &pb.ClaimTaskRequest{Id: triaged.GetId()})
	assertFailedPrecondition(t, err, "ClaimTask after failed laundering")
}

// CreateTask's explicit stage carries the same privilege as transitioning a
// freshly created task there: an agent cannot skip the accept gate by creating
// work directly in an accepted stage.
func TestScopedToken_AgentCannotCreateInAcceptedStage(t *testing.T) {
	client, _, collID, s := lifecycleFixture(t)
	_, agentToken := createTestUserAndToken(t, s, "agent",
		defaultScopes(t, "agent"), nil)

	_, err := client.CreateTask(authCtx(agentToken), &pb.CreateTaskRequest{
		Name:         "born accepted",
		CollectionId: collID,
		Stage:        stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
	})
	if err == nil {
		t.Fatal("agent token should not be able to create a task directly in accepted")
	}
	assertPermissionDenied(t, err, "CreateTask stage=ACCEPTED")
}

// Creating directly in a terminal stage is a close and needs task:close.
func TestScopedToken_AgentCannotCreateInCompletedStage(t *testing.T) {
	client, _, collID, s := lifecycleFixture(t)
	_, agentToken := createTestUserAndToken(t, s, "agent",
		defaultScopes(t, "agent"), nil)

	_, err := client.CreateTask(authCtx(agentToken), &pb.CreateTaskRequest{
		Name:         "born closed",
		CollectionId: collID,
		Stage:        stageProtoPtr(pb.TaskStage_TASK_STAGE_COMPLETED),
	})
	if err == nil {
		t.Fatal("agent token should not be able to create a task directly in completed")
	}
	assertPermissionDenied(t, err, "CreateTask stage=COMPLETED")
}

// A reviewer holds task:accept, so creating in an accepted stage is allowed.
func TestScopedToken_ReviewerCanCreateInAcceptedStage(t *testing.T) {
	client, _, collID, s := lifecycleFixture(t)
	_, reviewerToken := createTestUserAndToken(t, s, "reviewer",
		defaultScopes(t, "reviewer"), nil)

	created, err := client.CreateTask(authCtx(reviewerToken), &pb.CreateTaskRequest{
		Name:         "reviewer created",
		CollectionId: collID,
		Stage:        stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
	})
	if err != nil {
		t.Fatalf("reviewer token should be able to create a task in accepted: %v", err)
	}
	if created.GetStage() != pb.TaskStage_TASK_STAGE_ACCEPTED {
		t.Errorf("stage = %v, want ACCEPTED", created.GetStage())
	}
}

// An agent-scoped token has task:write but not task:close.
func TestScopedToken_AgentCannotClose(t *testing.T) {
	client, adminCtx, collID, s := lifecycleFixture(t)
	_, agentToken := createTestUserAndToken(t, s, "agent",
		defaultScopes(t, "agent"), nil)
	agentCtx := authCtx(agentToken)

	working := createClaimedLifecycleTask(t, client, adminCtx, collID, "agent work")

	// CloseTask RPC.
	_, err := client.CloseTask(agentCtx, &pb.CloseTaskRequest{Id: working.GetId()})
	if err == nil {
		t.Fatal("agent token should not be able to close a task")
	}
	assertPermissionDenied(t, err, "CloseTask")

	// UpdateTask into a terminal stage is the same privilege.
	_, err = client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
		Id:    working.GetId(),
		Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_COMPLETED),
	})
	if err == nil {
		t.Fatal("agent token should not be able to close via UpdateTask")
	}
	assertPermissionDenied(t, err, "UpdateTask → COMPLETED")
}

// Agents keep their working authority: claim an accepted task and hand it off.
func TestScopedToken_AgentCanClaimAcceptedTask(t *testing.T) {
	client, adminCtx, collID, s := lifecycleFixture(t)
	_, agentToken := createTestUserAndToken(t, s, "agent",
		defaultScopes(t, "agent"), nil)
	agentCtx := authCtx(agentToken)

	accepted := createLifecycleTask(t, client, adminCtx, collID, "alaccepted accepted",
		stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED))

	resp, err := client.ClaimTask(agentCtx, &pb.ClaimTaskRequest{Id: accepted.GetId()})
	if err != nil {
		t.Fatalf("agent token should be able to claim an accepted task: %v", err)
	}
	if resp.GetTask().GetStage() != pb.TaskStage_TASK_STAGE_WORKING {
		t.Errorf("stage after claim = %v, want WORKING", resp.GetTask().GetStage())
	}

	// working → in_review is an ordinary task:write handoff.
	if _, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
		Id:    accepted.GetId(),
		Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_IN_REVIEW),
	}); err != nil {
		t.Fatalf("agent token should be able to hand off to in_review: %v", err)
	}
}

// Claiming straight from triage is rejected regardless of scope.
func TestRPC_ClaimTask_RejectsTriageStage(t *testing.T) {
	client, adminCtx, collID, s := lifecycleFixture(t)

	triaged := createLifecycleTask(t, client, adminCtx, collID, "still in triage", nil)

	// Even a wildcard admin token cannot claim from triage: this is a
	// precondition, not a permission.
	_, err := client.ClaimTask(adminCtx, &pb.ClaimTaskRequest{Id: triaged.GetId()})
	assertFailedPrecondition(t, err, "ClaimTask from triage (admin)")

	_, reviewerToken := createTestUserAndToken(t, s, "reviewer",
		defaultScopes(t, "reviewer"), nil)
	reviewerCtx := authCtx(reviewerToken)

	_, err = client.ClaimTask(reviewerCtx, &pb.ClaimTaskRequest{Id: triaged.GetId()})
	assertFailedPrecondition(t, err, "ClaimTask from triage (reviewer)")

	// The task is untouched by the rejected claim.
	resp, err := client.GetTask(adminCtx, &pb.GetTaskRequest{Id: triaged.GetId()})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	after := resp.GetTask()
	if after.GetStage() != pb.TaskStage_TASK_STAGE_TRIAGE {
		t.Errorf("stage = %v, want TRIAGE (claim must not mutate)", after.GetStage())
	}
	if len(after.GetAssignees()) != 0 {
		t.Errorf("assignees = %v, want none after rejected claim", after.GetAssignees())
	}
}

// A reviewer/orchestrator token can drive the whole lifecycle.
func TestScopedToken_ReviewerFullLifecycle(t *testing.T) {
	for _, userType := range []string{"reviewer", "orchestrator"} {
		t.Run(userType, func(t *testing.T) {
			client, adminCtx, collID, s := lifecycleFixture(t)
			_, token := createTestUserAndToken(t, s, userType,
				defaultScopes(t, userType), nil)
			ctx := authCtx(token)

			task := createLifecycleTask(t, client, adminCtx, collID, "full lifecycle", nil)

			// triage → accepted (task:accept)
			accepted, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
				Id:    task.GetId(),
				Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
			})
			if err != nil {
				t.Fatalf("%s should be able to accept from triage: %v", userType, err)
			}
			if accepted.GetStage() != pb.TaskStage_TASK_STAGE_ACCEPTED {
				t.Fatalf("stage after accept = %v, want ACCEPTED", accepted.GetStage())
			}

			// accepted → working (task:claim)
			claimed, err := client.ClaimTask(ctx, &pb.ClaimTaskRequest{Id: task.GetId()})
			if err != nil {
				t.Fatalf("%s should be able to claim: %v", userType, err)
			}
			if claimed.GetTask().GetStage() != pb.TaskStage_TASK_STAGE_WORKING {
				t.Fatalf("stage after claim = %v, want WORKING", claimed.GetTask().GetStage())
			}

			// working → in_review (task:write)
			if _, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
				Id:    task.GetId(),
				Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_IN_REVIEW),
			}); err != nil {
				t.Fatalf("%s should be able to hand off: %v", userType, err)
			}

			// in_review → completed (task:close)
			closed, err := client.CloseTask(ctx, &pb.CloseTaskRequest{Id: task.GetId()})
			if err != nil {
				t.Fatalf("%s should be able to close: %v", userType, err)
			}
			if closed.GetStage() != pb.TaskStage_TASK_STAGE_COMPLETED {
				t.Errorf("stage after close = %v, want COMPLETED", closed.GetStage())
			}
		})
	}
}

// Reopening a closed task requires task:accept.
func TestScopedToken_ReopenRequiresAccept(t *testing.T) {
	client, adminCtx, collID, s := lifecycleFixture(t)
	_, agentToken := createTestUserAndToken(t, s, "agent",
		defaultScopes(t, "agent"), nil)
	agentCtx := authCtx(agentToken)

	closedTask := createClaimedLifecycleTask(t, client, adminCtx, collID, "closed work")
	if _, err := client.CloseTask(adminCtx, &pb.CloseTaskRequest{Id: closedTask.GetId()}); err != nil {
		t.Fatalf("closing task: %v", err)
	}

	_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
		Id:    closedTask.GetId(),
		Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
	})
	if err == nil {
		t.Fatal("agent token should not be able to reopen a closed task")
	}
	assertPermissionDenied(t, err, "UpdateTask completed → accepted")

	_, reviewerToken := createTestUserAndToken(t, s, "reviewer",
		defaultScopes(t, "reviewer"), nil)
	reopened, err := client.UpdateTask(authCtx(reviewerToken), &pb.UpdateTaskRequest{
		Id:    closedTask.GetId(),
		Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
	})
	if err != nil {
		t.Fatalf("reviewer token should be able to reopen: %v", err)
	}
	if reopened.GetStage() != pb.TaskStage_TASK_STAGE_ACCEPTED {
		t.Errorf("stage after reopen = %v, want BACKLOG", reopened.GetStage())
	}
}

// Legacy nil-scoped tokens lose lifecycle access. This is sudden blocking and it
// is intended: the ruling forbids a grace period or a grandfather list, so a
// pre-vocabulary token is denied at its next call and the operator re-issues it.
//
// Until 2026-07-29 this test was named
// TestScopedToken_LegacyNilScopesKeepLifecycleAccess and asserted that such
// tokens kept full lifecycle rights. Its old name encoded the grandfather clause
// the ruling forbids, so the name had to change with the behaviour.
func TestScopedToken_LegacyNilScopesLoseLifecycleAccess(t *testing.T) {
	client, adminCtx, collID, s := lifecycleFixture(t)
	_, legacyToken := createTestUserAndToken(t, s, "human", nil, nil)
	legacyCtx := authCtx(legacyToken)

	task := createLifecycleTask(t, client, adminCtx, collID, "legacy lifecycle", nil)

	_, err := client.UpdateTask(legacyCtx, &pb.UpdateTaskRequest{
		Id:    task.GetId(),
		Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
	})
	if err == nil {
		t.Fatal("legacy nil-scoped token must be denied accept, got allow")
	}
	assertPermissionDenied(t, err, "legacy accept")

	_, err = client.CloseTask(legacyCtx, &pb.CloseTaskRequest{Id: task.GetId()})
	if err == nil {
		t.Fatal("legacy nil-scoped token must be denied close, got allow")
	}
	assertPermissionDenied(t, err, "legacy close")
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

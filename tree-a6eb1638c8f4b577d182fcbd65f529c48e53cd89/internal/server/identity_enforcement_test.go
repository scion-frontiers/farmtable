package server_test

import (
	"context"
	"net"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/streaming"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

// setupAuthTestEnv creates a store, a user, a token, and a test server with
// auth. It returns the client, an authenticated context, the user ID, and a
// cleanup function.
func setupAuthTestEnv(t *testing.T) (pb.FarmTableServiceClient, context.Context, uuid.UUID, func()) {
	t.Helper()
	s, storeCleanup := testutil.NewTestStore(t)

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "identity-test-user",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		storeCleanup()
		t.Fatalf("creating user: %v", err)
	}
	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "identity-test-token",
	})
	if err != nil {
		storeCleanup()
		t.Fatalf("creating token: %v", err)
	}

	client, _, srvCleanup := testutil.NewTestServerWithAuth(t, s)
	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)

	cleanup := func() {
		srvCleanup()
		storeCleanup()
	}
	return client, authCtx, u.ID, cleanup
}

// createCollectionAndTask is a helper that creates a collection and a task
// using an authenticated context.
func createCollectionAndTask(t *testing.T, client pb.FarmTableServiceClient, authCtx context.Context) (string, string) {
	t.Helper()
	coll, err := client.CreateCollection(authCtx, &pb.CreateCollectionRequest{Name: "test-coll"})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	task, err := client.CreateTask(authCtx, &pb.CreateTaskRequest{
		Name:         "test-task",
		CollectionId: coll.GetId(),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	return coll.GetId(), task.GetId()
}

// ── Mutating RPCs reject uuid.Nil user context ──

func TestIdentity_MutatingRPCsRejectLegacyAuth(t *testing.T) {
	// LegacyTokenAuth returns uuid.Nil as the user ID, which should be
	// rejected by all mutating RPCs.
	lookup := server.LegacyTokenAuth("legacy-secret")
	client, _, cleanup := startServerWithLookup(t, lookup)
	defer cleanup()

	legacyCtx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer legacy-secret")

	tests := []struct {
		name string
		fn   func() error
	}{
		{"CreateTask", func() error {
			_, err := client.CreateTask(legacyCtx, &pb.CreateTaskRequest{
				Name:         "should-fail",
				CollectionId: uuid.New().String(),
			})
			return err
		}},
		{"CreateCollection", func() error {
			_, err := client.CreateCollection(legacyCtx, &pb.CreateCollectionRequest{Name: "should-fail"})
			return err
		}},
		{"UpdateCollection", func() error {
			name := "new-name"
			_, err := client.UpdateCollection(legacyCtx, &pb.UpdateCollectionRequest{
				Id:   uuid.New().String(),
				Name: &name,
			})
			return err
		}},
		{"UpdateTask", func() error {
			name := "new-name"
			_, err := client.UpdateTask(legacyCtx, &pb.UpdateTaskRequest{
				Id:   uuid.New().String(),
				Name: &name,
			})
			return err
		}},
		{"ClaimTask", func() error {
			_, err := client.ClaimTask(legacyCtx, &pb.ClaimTaskRequest{
				Id: uuid.New().String(),
			})
			return err
		}},
		{"CloseTask", func() error {
			_, err := client.CloseTask(legacyCtx, &pb.CloseTaskRequest{
				Id: uuid.New().String(),
			})
			return err
		}},
		{"DeleteTask", func() error {
			_, err := client.DeleteTask(legacyCtx, &pb.DeleteTaskRequest{
				Id: uuid.New().String(),
			})
			return err
		}},
		{"AddComment", func() error {
			_, err := client.AddComment(legacyCtx, &pb.AddCommentRequest{
				TaskId: uuid.New().String(),
				Body:   "should fail",
			})
			return err
		}},
		{"CreateLinkedAccount", func() error {
			_, err := client.CreateLinkedAccount(legacyCtx, &pb.CreateLinkedAccountRequest{
				CollectionId: uuid.New().String(),
				Platform:     pb.Platform_PLATFORM_GITHUB,
				AuthMethod:   pb.AuthMethod_AUTH_METHOD_API_KEY,
				AuthToken:    "test",
			})
			return err
		}},
		{"DeleteLinkedAccount", func() error {
			_, err := client.DeleteLinkedAccount(legacyCtx, &pb.DeleteLinkedAccountRequest{
				Id: uuid.New().String(),
			})
			return err
		}},
		{"ImportCollection", func() error {
			_, err := client.ImportCollection(legacyCtx, &pb.ImportCollectionRequest{
				Data: []byte(`{"collection":{},"tasks":[]}`),
			})
			return err
		}},
		{"InsertTasksAfter", func() error {
			_, err := client.InsertTasksAfter(legacyCtx, &pb.InsertTasksAfterRequest{
				AnchorTaskId: uuid.New().String(),
				CollectionId: uuid.New().String(),
				Steps: []*pb.NewTaskSpec{
					{Name: "step1"},
				},
			})
			return err
		}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.fn()
			if err == nil {
				t.Fatalf("%s: expected Unauthenticated error, got nil", tc.name)
			}
			st, ok := status.FromError(err)
			if !ok {
				t.Fatalf("%s: expected gRPC status error, got %v", tc.name, err)
			}
			if st.Code() != codes.Unauthenticated {
				t.Errorf("%s: code = %v, want Unauthenticated", tc.name, st.Code())
			}
		})
	}
}

// ── Mutating RPCs accept valid user context ──

func TestIdentity_MutatingRPCsAcceptValidAuth(t *testing.T) {
	client, authCtx, _, cleanup := setupAuthTestEnv(t)
	defer cleanup()

	// CreateCollection
	coll, err := client.CreateCollection(authCtx, &pb.CreateCollectionRequest{Name: "valid-coll"})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}

	// CreateTask
	task, err := client.CreateTask(authCtx, &pb.CreateTaskRequest{
		Name:         "valid-task",
		CollectionId: coll.GetId(),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	// UpdateTask
	newName := "updated-valid-task"
	_, err = client.UpdateTask(authCtx, &pb.UpdateTaskRequest{
		Id:   task.GetId(),
		Name: &newName,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	// ClaimTask
	_, err = client.ClaimTask(authCtx, &pb.ClaimTaskRequest{Id: task.GetId()})
	if err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}

	// AddComment
	_, err = client.AddComment(authCtx, &pb.AddCommentRequest{
		TaskId: task.GetId(),
		Body:   "valid comment",
	})
	if err != nil {
		t.Fatalf("AddComment: %v", err)
	}

	// CloseTask
	_, err = client.CloseTask(authCtx, &pb.CloseTaskRequest{Id: task.GetId()})
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	// UpdateCollection
	newCollName := "updated-coll"
	_, err = client.UpdateCollection(authCtx, &pb.UpdateCollectionRequest{
		Id:   coll.GetId(),
		Name: &newCollName,
	})
	if err != nil {
		t.Fatalf("UpdateCollection: %v", err)
	}

	// DeleteTask (returns Unimplemented, but should pass identity check)
	_, err = client.DeleteTask(authCtx, &pb.DeleteTaskRequest{Id: task.GetId()})
	if err != nil {
		st, ok := status.FromError(err)
		if !ok || st.Code() != codes.Unimplemented {
			t.Fatalf("DeleteTask: expected Unimplemented, got %v", err)
		}
	}
}

// ── Read-only RPCs remain accessible to any authenticated user ──

func TestIdentity_ReadOnlyRPCsAccessibleWithValidAuth(t *testing.T) {
	client, authCtx, userID, cleanup := setupAuthTestEnv(t)
	defer cleanup()

	collID, taskID := createCollectionAndTask(t, client, authCtx)

	tests := []struct {
		name string
		fn   func() error
	}{
		{"ListTasks", func() error {
			_, err := client.ListTasks(authCtx, &pb.ListTasksRequest{})
			return err
		}},
		{"GetTask", func() error {
			_, err := client.GetTask(authCtx, &pb.GetTaskRequest{Id: taskID})
			return err
		}},
		{"ListComments", func() error {
			_, err := client.ListComments(authCtx, &pb.ListCommentsRequest{TaskId: taskID})
			return err
		}},
		{"ListCollections", func() error {
			_, err := client.ListCollections(authCtx, &pb.ListCollectionsRequest{})
			return err
		}},
		{"GetCollection", func() error {
			_, err := client.GetCollection(authCtx, &pb.GetCollectionRequest{Id: collID})
			return err
		}},
		{"ListLinkedAccounts", func() error {
			_, err := client.ListLinkedAccounts(authCtx, &pb.ListLinkedAccountsRequest{})
			return err
		}},
		{"ListChanges", func() error {
			_, err := client.ListChanges(authCtx, &pb.ListChangesRequest{TaskId: taskID})
			return err
		}},
		{"WhoAmI", func() error {
			_, err := client.WhoAmI(authCtx, &pb.WhoAmIRequest{})
			return err
		}},
		{"ListUsers", func() error {
			_, err := client.ListUsers(authCtx, &pb.ListUsersRequest{})
			return err
		}},
		{"GetUser", func() error {
			_, err := client.GetUser(authCtx, &pb.GetUserRequest{Id: userID.String()})
			return err
		}},
		{"GetReadyTasks", func() error {
			_, err := client.GetReadyTasks(authCtx, &pb.GetReadyTasksRequest{CollectionId: &collID})
			return err
		}},
		{"GetBlockedTasks", func() error {
			_, err := client.GetBlockedTasks(authCtx, &pb.GetBlockedTasksRequest{CollectionId: &collID})
			return err
		}},
		{"GetDependencyTree", func() error {
			_, err := client.GetDependencyTree(authCtx, &pb.GetDependencyTreeRequest{TaskId: taskID})
			return err
		}},
		{"GetCriticalPath", func() error {
			_, err := client.GetCriticalPath(authCtx, &pb.GetCriticalPathRequest{CollectionId: collID})
			return err
		}},
		{"GetBottlenecks", func() error {
			_, err := client.GetBottlenecks(authCtx, &pb.GetBottlenecksRequest{CollectionId: collID})
			return err
		}},
		{"ExportCollection", func() error {
			_, err := client.ExportCollection(authCtx, &pb.ExportCollectionRequest{Id: collID})
			return err
		}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.fn()
			if err != nil {
				t.Errorf("%s: expected success with valid auth, got: %v", tc.name, err)
			}
		})
	}
}

// ── Change records capture correct actor ──

func TestIdentity_ChangeRecordsCaptureActor(t *testing.T) {
	client, authCtx, userID, cleanup := setupAuthTestEnv(t)
	defer cleanup()

	collID, taskID := createCollectionAndTask(t, client, authCtx)
	_ = collID

	// UpdateTask should record the actor
	newName := "updated-for-change-audit"
	_, err := client.UpdateTask(authCtx, &pb.UpdateTaskRequest{
		Id:   taskID,
		Name: &newName,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	// Check the change records
	taskResp, err := client.GetTask(authCtx, &pb.GetTaskRequest{
		Id:             taskID,
		IncludeChanges: true,
	})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}

	found := false
	for _, ch := range taskResp.GetChanges() {
		if ch.GetField() == "title" {
			if ch.GetChangedBy() == nil {
				t.Error("expected change to have a non-nil changed_by")
				continue
			}
			if ch.GetChangedBy().GetId() != userID.String() {
				t.Errorf("change author = %q, want %q", ch.GetChangedBy().GetId(), userID.String())
			}
			if ch.GetChangedBy().GetId() == uuid.Nil.String() {
				t.Error("change author should not be uuid.Nil")
			}
			found = true
		}
	}
	if !found {
		t.Error("expected title change record but found none")
	}
}

func TestIdentity_CloseTaskRecordsActor(t *testing.T) {
	client, authCtx, userID, cleanup := setupAuthTestEnv(t)
	defer cleanup()

	_, taskID := createCollectionAndTask(t, client, authCtx)

	_, err := client.CloseTask(authCtx, &pb.CloseTaskRequest{Id: taskID})
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	taskResp, err := client.GetTask(authCtx, &pb.GetTaskRequest{
		Id:             taskID,
		IncludeChanges: true,
	})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}

	for _, ch := range taskResp.GetChanges() {
		if ch.GetField() == "stage" || ch.GetField() == "phase" {
			if ch.GetChangedBy() == nil {
				t.Errorf("change for field %q has nil changed_by", ch.GetField())
				continue
			}
			if ch.GetChangedBy().GetId() != userID.String() {
				t.Errorf("change author for %q = %q, want %q", ch.GetField(), ch.GetChangedBy().GetId(), userID.String())
			}
		}
	}
}

// ── WatchTasks requires auth ──

func TestIdentity_WatchTasksRequiresAuth(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	client, _, cleanup := testutil.NewTestServerWithAuthAndStreaming(t, s)
	defer cleanup()

	// No auth context — should fail
	stream, err := client.WatchTasks(context.Background(), &pb.WatchTasksRequest{})
	if err != nil {
		st, ok := status.FromError(err)
		if !ok || st.Code() != codes.Unauthenticated {
			t.Fatalf("expected Unauthenticated, got: %v", err)
		}
		return
	}
	_, err = stream.Recv()
	if err == nil {
		t.Fatal("expected Unauthenticated error for unauthenticated WatchTasks")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}

func TestIdentity_WatchTasksRejectsLegacyAuth(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// Use LegacyTokenAuth which returns uuid.Nil
	lookup := server.LegacyTokenAuth("legacy-secret")

	client, _, cleanup := startServerWithLookupAndStreaming(t, lookup, s)
	defer cleanup()

	legacyCtx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer legacy-secret")
	stream, err := client.WatchTasks(legacyCtx, &pb.WatchTasksRequest{})
	if err != nil {
		st, ok := status.FromError(err)
		if !ok || st.Code() != codes.Unauthenticated {
			t.Fatalf("expected Unauthenticated, got: %v", err)
		}
		return
	}
	_, err = stream.Recv()
	if err == nil {
		t.Fatal("expected Unauthenticated error for legacy auth WatchTasks")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}

func TestIdentity_WatchTasksAcceptsValidAuth(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "watch-user",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}
	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "watch-token",
	})
	if err != nil {
		t.Fatalf("creating token: %v", err)
	}

	client, _, cleanup := testutil.NewTestServerWithAuthAndStreaming(t, s)
	defer cleanup()

	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)

	// Create a collection first so WatchTasks has something to subscribe to
	coll, err := client.CreateCollection(authCtx, &pb.CreateCollectionRequest{Name: "watch-coll"})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}

	collID := coll.GetId()
	watchCtx, cancel := context.WithCancel(authCtx)
	defer cancel()

	stream, err := client.WatchTasks(watchCtx, &pb.WatchTasksRequest{
		CollectionId:   &collID,
		IncludeInitial: true,
	})
	if err != nil {
		t.Fatalf("WatchTasks: unexpected error establishing stream: %v", err)
	}

	// We should receive a SNAPSHOT_COMPLETE event
	ev, err := stream.Recv()
	if err != nil {
		t.Fatalf("WatchTasks: error receiving snapshot complete: %v", err)
	}
	if ev.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_SNAPSHOT_COMPLETE {
		t.Errorf("expected SNAPSHOT_COMPLETE, got %v", ev.GetEventType())
	}

	cancel()
}

// ── RequireIdentity unit tests ──

func TestRequireIdentity_ValidUserID(t *testing.T) {
	userID := uuid.New()
	ctx := server.ContextWithUserID(context.Background(), userID)
	got, err := server.RequireIdentity(ctx)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if got != userID {
		t.Errorf("got %v, want %v", got, userID)
	}
}

func TestRequireIdentity_NilUserID(t *testing.T) {
	ctx := server.ContextWithAuthEnforced(server.ContextWithUserID(context.Background(), uuid.Nil))
	_, err := server.RequireIdentity(ctx)
	if err == nil {
		t.Fatal("expected error for uuid.Nil user")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}

func TestRequireIdentity_NoUserInContext(t *testing.T) {
	ctx := server.ContextWithAuthEnforced(context.Background())
	_, err := server.RequireIdentity(ctx)
	if err == nil {
		t.Fatal("expected error for missing user in context")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}

func TestRequireIdentity_OpenAccessMode(t *testing.T) {
	// In open-access mode (no auth interceptor), RequireIdentity should
	// return uuid.Nil without error.
	id, err := server.RequireIdentity(context.Background())
	if err != nil {
		t.Fatalf("expected no error in open-access mode, got: %v", err)
	}
	if id != uuid.Nil {
		t.Errorf("expected uuid.Nil in open-access mode, got %v", id)
	}
}

// startServerWithLookupAndStreaming creates a test server with a custom
// TokenLookup and streaming support (event bus).
func startServerWithLookupAndStreaming(t *testing.T, lookup server.TokenLookup, s *store.EntStore) (pb.FarmTableServiceClient, *store.EntStore, func()) {
	t.Helper()
	if s == nil {
		var storeCleanup func()
		s, storeCleanup = testutil.NewTestStore(t)
		_ = storeCleanup
	}

	lis := bufconn.Listen(1 << 20)
	eb := streaming.NewEventBus()
	srv := grpc.NewServer(
		grpc.UnaryInterceptor(server.TokenAuthInterceptor(lookup)),
		grpc.StreamInterceptor(server.TokenAuthStreamInterceptor(lookup)),
	)
	pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(s, "test", server.WithEventBus(eb)))
	go srv.Serve(lis)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		srv.Stop()
		t.Fatalf("dialing bufconn: %v", err)
	}

	client := pb.NewFarmTableServiceClient(conn)
	cleanup := func() {
		conn.Close()
		srv.Stop()
	}
	return client, s, cleanup
}

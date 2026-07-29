package server_test

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestWhoAmI(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "whoami-agent",
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("creating user: %v", err)
	}

	_, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "whoami-token",
	})
	if err != nil {
		t.Fatalf("creating token: %v", err)
	}

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)
	got, err := client.WhoAmI(authCtx, &pb.WhoAmIRequest{})
	if err != nil {
		t.Fatalf("WhoAmI: %v", err)
	}
	if got.GetId() != u.ID.String() {
		t.Errorf("ID = %q, want %q", got.GetId(), u.ID.String())
	}
	if got.GetName() != "whoami-agent" {
		t.Errorf("Name = %q, want %q", got.GetName(), "whoami-agent")
	}
}

func TestWhoAmI_Unauthenticated(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	_, err := client.WhoAmI(context.Background(), &pb.WhoAmIRequest{})
	if err == nil {
		t.Fatal("expected error for unauthenticated WhoAmI")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status, got %v", err)
	}
	if st.Code() != codes.Unauthenticated {
		t.Errorf("code = %v, want Unauthenticated", st.Code())
	}
}

func TestClaimTask_PropagatesUserID(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "claim-agent",
		Type:        "agent",
		Status:      "active",
	})
	_, rawToken, _ := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "claim-token",
	})

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)

	coll, err := client.CreateCollection(authCtx, &pb.CreateCollectionRequest{Name: "test-coll"})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	task, err := client.CreateTask(authCtx, &pb.CreateTaskRequest{
		Name:         "test-task",
		CollectionId: coll.GetId(),
	})
	if err != nil {
		t.Fatalf("creating task: %v", err)
	}

	resp, err := client.ClaimTask(authCtx, &pb.ClaimTaskRequest{
		Id: task.GetId(),
	})
	if err != nil {
		t.Fatalf("claiming task: %v", err)
	}

	assignees := resp.GetTask().GetAssignees()
	if len(assignees) == 0 {
		t.Fatal("expected at least one assignee")
	}
	if assignees[0].GetId() != u.ID.String() {
		t.Errorf("assignee ID = %q, want %q", assignees[0].GetId(), u.ID.String())
	}

	taskResp, err := client.GetTask(authCtx, &pb.GetTaskRequest{
		Id:             task.GetId(),
		IncludeChanges: true,
	})
	if err != nil {
		t.Fatalf("getting task: %v", err)
	}

	found := false
	for _, ch := range taskResp.GetChanges() {
		if ch.GetField() == "assignee_id" {
			if ch.GetChangedBy().GetId() != u.ID.String() {
				t.Errorf("change author = %q, want %q", ch.GetChangedBy().GetId(), u.ID.String())
			}
			found = true
			break
		}
	}
	if !found {
		t.Error("expected assignee_id change record")
	}
}

func TestAddComment_PropagatesUserID(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "comment-agent",
		Type:        "agent",
		Status:      "active",
	})
	_, rawToken, _ := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "comment-token",
	})

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)

	coll, _ := client.CreateCollection(authCtx, &pb.CreateCollectionRequest{Name: "comment-coll"})
	task, _ := client.CreateTask(authCtx, &pb.CreateTaskRequest{
		Name:         "comment-task",
		CollectionId: coll.GetId(),
	})

	comment, err := client.AddComment(authCtx, &pb.AddCommentRequest{
		TaskId: task.GetId(),
		Body:   "test comment",
	})
	if err != nil {
		t.Fatalf("adding comment: %v", err)
	}

	if comment.GetAuthor().GetId() != u.ID.String() {
		t.Errorf("comment author = %q, want %q", comment.GetAuthor().GetId(), u.ID.String())
	}
}

func TestListUsers(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	uA, _ := s.CreateUser(ctx, store.CreateUserParams{DisplayName: "user-a", Type: "agent", Status: "active"})
	s.CreateUser(ctx, store.CreateUserParams{DisplayName: "user-b", Type: "human", Status: "active"})

	_, rawToken, _ := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: uA.ID,
		Name:   "list-users-token",
	})

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)
	resp, err := client.ListUsers(authCtx, &pb.ListUsersRequest{})
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if resp.GetTotalCount() != 2 {
		t.Errorf("total = %d, want 2", resp.GetTotalCount())
	}
}

func TestGetUser(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "get-user",
		Type:        "human",
		Status:      "active",
	})

	_, rawToken, _ := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "get-user-token",
	})

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)
	got, err := client.GetUser(authCtx, &pb.GetUserRequest{Id: u.ID.String()})
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if got.GetName() != "get-user" {
		t.Errorf("Name = %q, want %q", got.GetName(), "get-user")
	}
}

func TestUpdateTask_PropagatesActorID(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "updater-agent",
		Type:        "agent",
		Status:      "active",
	})
	_, rawToken, _ := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "updater-token",
	})

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	authCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+rawToken)

	coll, _ := client.CreateCollection(authCtx, &pb.CreateCollectionRequest{Name: "update-coll"})
	task, _ := client.CreateTask(authCtx, &pb.CreateTaskRequest{
		Name:         "update-task",
		CollectionId: coll.GetId(),
	})

	newName := "updated-task"
	_, err := client.UpdateTask(authCtx, &pb.UpdateTaskRequest{
		Id:   task.GetId(),
		Name: &newName,
	})
	if err != nil {
		t.Fatalf("updating task: %v", err)
	}

	taskResp, _ := client.GetTask(authCtx, &pb.GetTaskRequest{
		Id:             task.GetId(),
		IncludeChanges: true,
	})
	for _, ch := range taskResp.GetChanges() {
		if ch.GetField() == "title" {
			if ch.GetChangedBy().GetId() != u.ID.String() {
				t.Errorf("change author = %q, want %q", ch.GetChangedBy().GetId(), u.ID.String())
			}
			return
		}
	}
	t.Error("expected title change record")
}

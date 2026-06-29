package server_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func createTestCollection(t *testing.T, client pb.FarmTableServiceClient) string {
	t.Helper()
	c, err := client.CreateCollection(context.Background(), &pb.CreateCollectionRequest{
		Name: "test",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	return c.GetId()
}

func TestRPC_CreateAndGetTask(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "RPC test task",
		Description:  strPtr("A task created via RPC"),
	})
	if err != nil {
		t.Fatalf("CreateTask RPC: %v", err)
	}
	if created.GetName() != "RPC test task" {
		t.Errorf("name = %q, want %q", created.GetName(), "RPC test task")
	}
	if created.GetPhase() != pb.TaskPhase_TASK_PHASE_OPEN {
		t.Errorf("phase = %v, want OPEN", created.GetPhase())
	}
	if created.GetVersion() != "1" {
		t.Errorf("version = %q, want %q", created.GetVersion(), "1")
	}

	resp, err := client.GetTask(ctx, &pb.GetTaskRequest{Id: created.GetId()})
	if err != nil {
		t.Fatalf("GetTask RPC: %v", err)
	}
	got := resp.GetTask()
	if got.GetId() != created.GetId() {
		t.Errorf("id = %q, want %q", got.GetId(), created.GetId())
	}
	if got.GetName() != "RPC test task" {
		t.Errorf("name = %q, want %q", got.GetName(), "RPC test task")
	}
}

func TestRPC_ListTasks_Pagination(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	for i := 0; i < 5; i++ {
		_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			CollectionId: collID,
			Name:         "Task " + string(rune('A'+i)),
		})
		if err != nil {
			t.Fatalf("CreateTask %d: %v", i, err)
		}
	}

	resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collID,
		PageSize:     2,
	})
	if err != nil {
		t.Fatalf("ListTasks page 1: %v", err)
	}
	if resp.GetTotalCount() != 5 {
		t.Errorf("total_count = %d, want 5", resp.GetTotalCount())
	}
	if len(resp.GetItems()) != 2 {
		t.Errorf("page 1 items = %d, want 2", len(resp.GetItems()))
	}
	if !resp.GetHasMore() {
		t.Error("expected has_more=true on page 1")
	}
	if resp.GetNextPageToken() == "" {
		t.Error("expected non-empty next_page_token on page 1")
	}

	resp2, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collID,
		PageSize:     2,
		PageToken:    resp.GetNextPageToken(),
	})
	if err != nil {
		t.Fatalf("ListTasks page 2: %v", err)
	}
	if len(resp2.GetItems()) != 2 {
		t.Errorf("page 2 items = %d, want 2", len(resp2.GetItems()))
	}
	if !resp2.GetHasMore() {
		t.Error("expected has_more=true on page 2")
	}

	resp3, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collID,
		PageSize:     2,
		PageToken:    resp2.GetNextPageToken(),
	})
	if err != nil {
		t.Fatalf("ListTasks page 3: %v", err)
	}
	if len(resp3.GetItems()) != 1 {
		t.Errorf("page 3 items = %d, want 1", len(resp3.GetItems()))
	}
	if resp3.GetHasMore() {
		t.Error("expected has_more=false on last page")
	}
}

func TestRPC_UpdateTask_VersionConflict(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "CAS RPC test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	t.Run("correct version succeeds", func(t *testing.T) {
		newName := "Updated via RPC"
		updated, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
			Id:      created.GetId(),
			Name:    &newName,
			Version: strPtr(created.GetVersion()),
		})
		if err != nil {
			t.Fatalf("UpdateTask: %v", err)
		}
		if updated.GetName() != "Updated via RPC" {
			t.Errorf("name = %q, want %q", updated.GetName(), "Updated via RPC")
		}
		if updated.GetVersion() != "2" {
			t.Errorf("version = %q, want %q", updated.GetVersion(), "2")
		}
	})

	t.Run("wrong version returns Aborted", func(t *testing.T) {
		newName := "Should fail"
		_, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
			Id:      created.GetId(),
			Name:    &newName,
			Version: strPtr("1"), // stale
		})
		if err == nil {
			t.Fatal("expected error for stale version")
		}
		st, ok := status.FromError(err)
		if !ok {
			t.Fatalf("expected gRPC status error, got %v", err)
		}
		if st.Code() != codes.Aborted {
			t.Errorf("code = %v, want Aborted", st.Code())
		}
	})
}

func TestRPC_UpdateTask_RemoteReference(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Remote reference test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	remoteID := "123"
	remoteURL := "https://github.com/ptone/farmtable/issues/123"
	updated, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        created.GetId(),
		RemoteId:  &remoteID,
		RemoteUrl: &remoteURL,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if updated.GetRemoteId() != remoteID {
		t.Errorf("remote_id = %q, want %q", updated.GetRemoteId(), remoteID)
	}
	if updated.GetRemoteUrl() != remoteURL {
		t.Errorf("remote_url = %q, want %q", updated.GetRemoteUrl(), remoteURL)
	}
	if updated.GetRemoteData().GetFields()["remote_id"].GetStringValue() != remoteID {
		t.Errorf("remote_data.remote_id = %q, want %q", updated.GetRemoteData().GetFields()["remote_id"].GetStringValue(), remoteID)
	}
}

func TestRPC_ClaimTask(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Claim RPC test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	resp, err := client.ClaimTask(ctx, &pb.ClaimTaskRequest{
		Id:      created.GetId(),
		Version: strPtr(created.GetVersion()),
	})
	if err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}
	if resp.GetTask().GetPhase() != pb.TaskPhase_TASK_PHASE_IN_PROGRESS {
		t.Errorf("phase = %v, want IN_PROGRESS", resp.GetTask().GetPhase())
	}
	if resp.GetTask().GetStage() != pb.TaskStage_TASK_STAGE_WORKING {
		t.Errorf("stage = %v, want WORKING", resp.GetTask().GetStage())
	}
	if len(resp.GetTask().GetAssignees()) == 0 {
		t.Error("expected at least one assignee after claim")
	}
	if resp.GetClaimedAt() == nil {
		t.Error("expected claimed_at timestamp")
	}

	t.Run("double claim returns FailedPrecondition", func(t *testing.T) {
		_, err := client.ClaimTask(ctx, &pb.ClaimTaskRequest{Id: created.GetId()})
		if err == nil {
			t.Fatal("expected error for double claim")
		}
		st, ok := status.FromError(err)
		if !ok {
			t.Fatalf("expected gRPC status error, got %v", err)
		}
		if st.Code() != codes.FailedPrecondition {
			t.Errorf("code = %v, want FailedPrecondition", st.Code())
		}
	})
}

func TestRPC_CloseTask(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	t.Run("close as completed", func(t *testing.T) {
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			CollectionId: collID,
			Name:         "Close RPC test",
		})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}

		stage := pb.TaskStage_TASK_STAGE_COMPLETED
		closed, err := client.CloseTask(ctx, &pb.CloseTaskRequest{
			Id:      created.GetId(),
			Stage:   &stage,
			Version: strPtr(created.GetVersion()),
		})
		if err != nil {
			t.Fatalf("CloseTask: %v", err)
		}
		if closed.GetPhase() != pb.TaskPhase_TASK_PHASE_CLOSED {
			t.Errorf("phase = %v, want CLOSED", closed.GetPhase())
		}
		if closed.GetStage() != pb.TaskStage_TASK_STAGE_COMPLETED {
			t.Errorf("stage = %v, want COMPLETED", closed.GetStage())
		}
		if closed.GetClosedAt() == nil {
			t.Error("expected closed_at timestamp")
		}
	})

	t.Run("close with invalid stage returns error", func(t *testing.T) {
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			CollectionId: collID,
			Name:         "Bad close RPC",
		})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}

		stage := pb.TaskStage_TASK_STAGE_WORKING
		_, err = client.CloseTask(ctx, &pb.CloseTaskRequest{
			Id:    created.GetId(),
			Stage: &stage,
		})
		if err == nil {
			t.Fatal("expected error for invalid close stage")
		}
		st, ok := status.FromError(err)
		if !ok {
			t.Fatalf("expected gRPC status error, got %v", err)
		}
		if st.Code() != codes.InvalidArgument {
			t.Errorf("code = %v, want InvalidArgument", st.Code())
		}
	})
}

func TestRPC_UpdateTask_WithoutVersion(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "unconditional update test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	name1 := "first update"
	updated1, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:      created.GetId(),
		Name:    &name1,
		Version: strPtr(created.GetVersion()),
	})
	if err != nil {
		t.Fatalf("first UpdateTask: %v", err)
	}
	if updated1.GetVersion() != "2" {
		t.Errorf("version after first update = %q, want %q", updated1.GetVersion(), "2")
	}

	name2 := "unconditional update"
	updated2, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:   created.GetId(),
		Name: &name2,
	})
	if err != nil {
		t.Fatalf("unconditional UpdateTask: %v", err)
	}
	if updated2.GetName() != "unconditional update" {
		t.Errorf("name = %q, want %q", updated2.GetName(), "unconditional update")
	}
	if updated2.GetVersion() != "3" {
		t.Errorf("version after unconditional update = %q, want %q", updated2.GetVersion(), "3")
	}
}

func TestRPC_ClaimTask_ClosedTask(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "claim closed test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	stage := pb.TaskStage_TASK_STAGE_COMPLETED
	_, err = client.CloseTask(ctx, &pb.CloseTaskRequest{
		Id:      created.GetId(),
		Stage:   &stage,
		Version: strPtr(created.GetVersion()),
	})
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	_, err = client.ClaimTask(ctx, &pb.ClaimTaskRequest{Id: created.GetId()})
	if err == nil {
		t.Fatal("expected error when claiming a closed task")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.FailedPrecondition {
		t.Errorf("code = %v, want FailedPrecondition", st.Code())
	}
}

func TestRPC_ListTasks_PageSizeCap(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	for i := 0; i < 3; i++ {
		_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			CollectionId: collID,
			Name:         "cap test",
		})
		if err != nil {
			t.Fatalf("CreateTask %d: %v", i, err)
		}
	}

	resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collID,
		PageSize:     10000,
	})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(resp.GetItems()) != 3 {
		t.Errorf("items = %d, want 3", len(resp.GetItems()))
	}
}

func TestRPC_GetVersion(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()

	resp, err := client.GetVersion(context.Background(), &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("GetVersion: %v", err)
	}
	if resp.GetServerVersion() != "test" {
		t.Errorf("server_version = %q, want %q", resp.GetServerVersion(), "test")
	}
	if resp.GetServer() != "farmtable" {
		t.Errorf("server = %q, want %q", resp.GetServer(), "farmtable")
	}
}

func TestRPC_GetStatus(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()

	resp, err := client.GetStatus(context.Background(), &pb.GetStatusRequest{})
	if err != nil {
		t.Fatalf("GetStatus: %v", err)
	}
	if resp.GetServerVersion() != "test" {
		t.Errorf("server_version = %q, want %q", resp.GetServerVersion(), "test")
	}
	if resp.GetStatus() != "serving" {
		t.Errorf("status = %q, want %q", resp.GetStatus(), "serving")
	}
}

func TestRPC_CreateTask_WithLabels(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Task with labels",
		Labels:       []string{"frontend", "p0"},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if len(created.GetLabels()) != 2 {
		t.Errorf("labels count = %d, want 2", len(created.GetLabels()))
	}

	resp, err := client.GetTask(ctx, &pb.GetTaskRequest{Id: created.GetId()})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if len(resp.GetTask().GetLabels()) != 2 {
		t.Errorf("labels count = %d, want 2", len(resp.GetTask().GetLabels()))
	}
}

func TestRPC_UpdateTask_Dates(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Date test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	due := timestamppb.New(time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC))
	start := timestamppb.New(time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC))
	updated, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        created.GetId(),
		DueDate:   due,
		StartDate: start,
	})
	if err != nil {
		t.Fatalf("UpdateTask set dates: %v", err)
	}
	if updated.GetDueDate() == nil {
		t.Error("due_date should be set")
	}
	if updated.GetStartDate() == nil {
		t.Error("start_date should be set")
	}

	cleared, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:             created.GetId(),
		ClearDueDate:   true,
		ClearStartDate: true,
	})
	if err != nil {
		t.Fatalf("UpdateTask clear dates: %v", err)
	}
	if cleared.GetDueDate() != nil {
		t.Error("due_date should be cleared")
	}
	if cleared.GetStartDate() != nil {
		t.Error("start_date should be cleared")
	}
}

func TestRPC_ListTasks_FilterByPriority(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	high := pb.TaskPriority_TASK_PRIORITY_HIGH
	low := pb.TaskPriority_TASK_PRIORITY_LOW

	_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "High priority",
		Priority:     &high,
	})
	if err != nil {
		t.Fatalf("CreateTask high: %v", err)
	}
	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Low priority",
		Priority:     &low,
	})
	if err != nil {
		t.Fatalf("CreateTask low: %v", err)
	}

	resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collID,
		Priority:     &high,
	})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if resp.GetTotalCount() != 1 {
		t.Errorf("total_count = %d, want 1", resp.GetTotalCount())
	}
	if len(resp.GetItems()) != 1 {
		t.Fatalf("items = %d, want 1", len(resp.GetItems()))
	}
	if resp.GetItems()[0].GetName() != "High priority" {
		t.Errorf("name = %q, want %q", resp.GetItems()[0].GetName(), "High priority")
	}
}

func TestRPC_UpdateTask_Labels(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Label update test",
		Labels:       []string{"one", "two"},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	updated, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:           created.GetId(),
		AddLabels:    []string{"three"},
		RemoveLabels: []string{"one"},
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	labels := updated.GetLabels()
	if len(labels) != 2 {
		t.Fatalf("labels count = %d, want 2", len(labels))
	}
}

func TestRPC_ListTasks_Sort(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "First",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Second",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collID,
		SortField:    pb.SortField_SORT_FIELD_CREATED,
		SortOrder:    pb.SortOrder_SORT_ORDER_DESC,
	})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(resp.GetItems()) < 2 {
		t.Fatalf("items = %d, want >= 2", len(resp.GetItems()))
	}
	if resp.GetItems()[0].GetName() != "Second" {
		t.Errorf("first item = %q, want %q (desc sort)", resp.GetItems()[0].GetName(), "Second")
	}
}

func TestRPC_UpdateTask_AuditTrail(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Audit trail test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	newName := "Renamed"
	newStage := pb.TaskStage_TASK_STAGE_BACKLOG
	_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:    created.GetId(),
		Name:  &newName,
		Stage: &newStage,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	resp, err := client.ListChanges(ctx, &pb.ListChangesRequest{
		TaskId: created.GetId(),
	})
	if err != nil {
		t.Fatalf("ListChanges: %v", err)
	}
	if resp.GetTotalCount() < 2 {
		t.Fatalf("total_count = %d, want >= 2", resp.GetTotalCount())
	}

	found := map[string]bool{}
	for _, c := range resp.GetItems() {
		found[c.GetField()] = true
	}
	if !found["title"] {
		t.Error("missing change for title")
	}
	if !found["stage"] {
		t.Error("missing change for stage")
	}

	// Verify field filter works
	filtered, err := client.ListChanges(ctx, &pb.ListChangesRequest{
		TaskId: created.GetId(),
		Field:  strPtr("title"),
	})
	if err != nil {
		t.Fatalf("ListChanges filtered: %v", err)
	}
	if filtered.GetTotalCount() != 1 {
		t.Errorf("filtered total = %d, want 1", filtered.GetTotalCount())
	}
}

func TestRPC_GetReadyTasks(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	readyStage := pb.TaskStage_TASK_STAGE_READY
	taskA, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Ready task A",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask A: %v", err)
	}

	taskB, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Blocker task B",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask B: %v", err)
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId:     collID,
		Name:             "Blocked task C",
		Stage:            &readyStage,
		BlockedByTaskIds: []string{taskB.GetId()},
	})
	if err != nil {
		t.Fatalf("CreateTask C: %v", err)
	}

	resp, err := client.GetReadyTasks(ctx, &pb.GetReadyTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("GetReadyTasks: %v", err)
	}

	names := make(map[string]bool)
	for _, item := range resp.GetItems() {
		names[item.GetTask().GetName()] = true
	}
	if !names["Ready task A"] {
		t.Error("expected Ready task A in results")
	}
	if !names["Blocker task B"] {
		t.Error("expected Blocker task B in results")
	}
	if names["Blocked task C"] {
		t.Error("Blocked task C should not be in ready tasks")
	}

	t.Run("resolved blocker becomes ready", func(t *testing.T) {
		closeStage := pb.TaskStage_TASK_STAGE_COMPLETED
		_, err := client.CloseTask(ctx, &pb.CloseTaskRequest{
			Id:    taskB.GetId(),
			Stage: &closeStage,
		})
		if err != nil {
			t.Fatalf("CloseTask: %v", err)
		}

		resp2, err := client.GetReadyTasks(ctx, &pb.GetReadyTasksRequest{
			CollectionId: &collID,
		})
		if err != nil {
			t.Fatalf("GetReadyTasks: %v", err)
		}

		names2 := make(map[string]bool)
		for _, item := range resp2.GetItems() {
			names2[item.GetTask().GetName()] = true
		}
		if !names2["Blocked task C"] {
			t.Error("Blocked task C should now be ready after blocker is closed")
		}

		for _, item := range resp2.GetItems() {
			if item.GetTask().GetName() == "Blocked task C" {
				if item.GetBlockersResolved() != 1 {
					t.Errorf("blockers_resolved = %d, want 1", item.GetBlockersResolved())
				}
			}
		}
	})

	_ = taskA
}

func TestRPC_GetBlockedTasks(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	readyStage := pb.TaskStage_TASK_STAGE_READY
	blocker, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Blocker",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask blocker: %v", err)
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId:     collID,
		Name:             "Blocked task",
		Stage:            &readyStage,
		BlockedByTaskIds: []string{blocker.GetId()},
	})
	if err != nil {
		t.Fatalf("CreateTask blocked: %v", err)
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Free task",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask free: %v", err)
	}

	resp, err := client.GetBlockedTasks(ctx, &pb.GetBlockedTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("GetBlockedTasks: %v", err)
	}

	if len(resp.GetItems()) != 1 {
		t.Fatalf("items = %d, want 1", len(resp.GetItems()))
	}
	item := resp.GetItems()[0]
	if item.GetTask().GetName() != "Blocked task" {
		t.Errorf("name = %q, want %q", item.GetTask().GetName(), "Blocked task")
	}
	if len(item.GetBlockedBy()) != 1 {
		t.Fatalf("blocked_by count = %d, want 1", len(item.GetBlockedBy()))
	}
	if item.GetBlockedBy()[0].GetName() != "Blocker" {
		t.Errorf("blocker name = %q, want %q", item.GetBlockedBy()[0].GetName(), "Blocker")
	}
}

func TestRPC_GetDependencyTree(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	readyStage := pb.TaskStage_TASK_STAGE_READY
	taskA, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "A",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask A: %v", err)
	}

	taskB, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "B",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask B: %v", err)
	}

	taskC, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "C",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask C: %v", err)
	}

	// A blocks B, B blocks C
	_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        taskA.GetId(),
		AddBlocks: []string{taskB.GetId()},
	})
	if err != nil {
		t.Fatalf("AddBlocks A->B: %v", err)
	}
	_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        taskB.GetId(),
		AddBlocks: []string{taskC.GetId()},
	})
	if err != nil {
		t.Fatalf("AddBlocks B->C: %v", err)
	}

	resp, err := client.GetDependencyTree(ctx, &pb.GetDependencyTreeRequest{
		TaskId:    taskA.GetId(),
		Direction: pb.DependencyDirection_DEPENDENCY_DIRECTION_DOWN,
		MaxDepth:  10,
	})
	if err != nil {
		t.Fatalf("GetDependencyTree: %v", err)
	}

	root := resp.GetRoot()
	if root == nil {
		t.Fatal("root is nil")
	}
	if root.GetTask().GetName() != "A" {
		t.Errorf("root name = %q, want %q", root.GetTask().GetName(), "A")
	}
	if len(root.GetBlocks()) != 1 {
		t.Fatalf("root.blocks count = %d, want 1", len(root.GetBlocks()))
	}
	if root.GetBlocks()[0].GetTask().GetName() != "B" {
		t.Errorf("root.blocks[0] = %q, want B", root.GetBlocks()[0].GetTask().GetName())
	}
	if len(root.GetBlocks()[0].GetBlocks()) != 1 {
		t.Fatalf("B.blocks count = %d, want 1", len(root.GetBlocks()[0].GetBlocks()))
	}
	if root.GetBlocks()[0].GetBlocks()[0].GetTask().GetName() != "C" {
		t.Errorf("B.blocks[0] = %q, want C", root.GetBlocks()[0].GetBlocks()[0].GetTask().GetName())
	}

	_ = taskC
}

func TestRPC_GetCriticalPath(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	readyStage := pb.TaskStage_TASK_STAGE_READY
	taskA, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "A",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask A: %v", err)
	}

	taskB, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "B",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask B: %v", err)
	}

	taskC, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "C",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask C: %v", err)
	}

	taskD, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "D",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask D: %v", err)
	}

	// A -> B -> C (length 3), A -> D (length 2)
	_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        taskA.GetId(),
		AddBlocks: []string{taskB.GetId()},
	})
	if err != nil {
		t.Fatalf("AddBlocks A->B: %v", err)
	}
	_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        taskB.GetId(),
		AddBlocks: []string{taskC.GetId()},
	})
	if err != nil {
		t.Fatalf("AddBlocks B->C: %v", err)
	}
	_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        taskA.GetId(),
		AddBlocks: []string{taskD.GetId()},
	})
	if err != nil {
		t.Fatalf("AddBlocks A->D: %v", err)
	}

	resp, err := client.GetCriticalPath(ctx, &pb.GetCriticalPathRequest{
		CollectionId: collID,
		RootTaskId:   &taskA.Id,
	})
	if err != nil {
		t.Fatalf("GetCriticalPath: %v", err)
	}

	if resp.GetTotalDepth() < 3 {
		t.Errorf("total_depth = %d, want >= 3 (A->B->C)", resp.GetTotalDepth())
	}

	if len(resp.GetPath()) < 3 {
		t.Fatalf("path length = %d, want >= 3", len(resp.GetPath()))
	}
	if resp.GetPath()[0].GetName() != "A" {
		t.Errorf("path[0] = %q, want A", resp.GetPath()[0].GetName())
	}
	if resp.GetPath()[1].GetName() != "B" {
		t.Errorf("path[1] = %q, want B", resp.GetPath()[1].GetName())
	}
	if resp.GetPath()[2].GetName() != "C" {
		t.Errorf("path[2] = %q, want C", resp.GetPath()[2].GetName())
	}

	_ = taskC
	_ = taskD
}

func TestRPC_GetBottlenecks(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	readyStage := pb.TaskStage_TASK_STAGE_READY
	taskA, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "Bottleneck A",
		Stage:        &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask A: %v", err)
	}

	for i := 0; i < 3; i++ {
		dep, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			CollectionId: collID,
			Name:         fmt.Sprintf("Dep %d", i),
			Stage:        &readyStage,
		})
		if err != nil {
			t.Fatalf("CreateTask dep %d: %v", i, err)
		}
		_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
			Id:        taskA.GetId(),
			AddBlocks: []string{dep.GetId()},
		})
		if err != nil {
			t.Fatalf("AddBlocks A->dep%d: %v", i, err)
		}
	}

	resp, err := client.GetBottlenecks(ctx, &pb.GetBottlenecksRequest{
		CollectionId: collID,
		Limit:        10,
	})
	if err != nil {
		t.Fatalf("GetBottlenecks: %v", err)
	}

	if len(resp.GetItems()) == 0 {
		t.Fatal("expected at least 1 bottleneck")
	}
	top := resp.GetItems()[0]
	if top.GetName() != "Bottleneck A" {
		t.Errorf("top bottleneck = %q, want %q", top.GetName(), "Bottleneck A")
	}
	if top.GetDirectDependents() != 3 {
		t.Errorf("direct_dependents = %d, want 3", top.GetDirectDependents())
	}
	if top.GetDownstreamCount() < 3 {
		t.Errorf("downstream_count = %d, want >= 3", top.GetDownstreamCount())
	}
}

func TestRPC_GetCriticalPath_DiamondDAG(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	readyStage := pb.TaskStage_TASK_STAGE_READY
	// Diamond: A -> B -> D, A -> C -> D
	// Longest path should be A -> B -> D or A -> C -> D (length 3)
	taskA, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID, Name: "A", Stage: &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask A: %v", err)
	}
	taskB, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID, Name: "B", Stage: &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask B: %v", err)
	}
	taskC, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID, Name: "C", Stage: &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask C: %v", err)
	}
	taskD, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID, Name: "D", Stage: &readyStage,
	})
	if err != nil {
		t.Fatalf("CreateTask D: %v", err)
	}

	// A blocks B and C; both B and C block D
	for _, target := range []string{taskB.GetId(), taskC.GetId()} {
		_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
			Id: taskA.GetId(), AddBlocks: []string{target},
		})
		if err != nil {
			t.Fatalf("AddBlocks A->%s: %v", target, err)
		}
	}
	for _, src := range []string{taskB.GetId(), taskC.GetId()} {
		_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
			Id: src, AddBlocks: []string{taskD.GetId()},
		})
		if err != nil {
			t.Fatalf("AddBlocks %s->D: %v", src, err)
		}
	}

	resp, err := client.GetCriticalPath(ctx, &pb.GetCriticalPathRequest{
		CollectionId: collID,
		RootTaskId:   &taskA.Id,
	})
	if err != nil {
		t.Fatalf("GetCriticalPath: %v", err)
	}

	if resp.GetTotalDepth() != 3 {
		t.Errorf("total_depth = %d, want 3 (A->?->D)", resp.GetTotalDepth())
	}
	if len(resp.GetPath()) != 3 {
		t.Fatalf("path length = %d, want 3", len(resp.GetPath()))
	}
	if resp.GetPath()[0].GetName() != "A" {
		t.Errorf("path[0] = %q, want A", resp.GetPath()[0].GetName())
	}
	if resp.GetPath()[2].GetName() != "D" {
		t.Errorf("path[2] = %q, want D", resp.GetPath()[2].GetName())
	}

	_ = taskD
}

func strPtr(s string) *string { return &s }

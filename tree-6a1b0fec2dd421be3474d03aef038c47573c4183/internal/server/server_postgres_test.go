//go:build integration

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

func createTestCollectionPostgres(t *testing.T, client pb.FarmTableServiceClient) string {
	t.Helper()
	c, err := client.CreateCollection(context.Background(), &pb.CreateCollectionRequest{
		Name: "test",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	return c.GetId()
}

func TestPostgresRPC_CreateAndGetTask(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)

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

func TestPostgresRPC_ListTasks_Pagination(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)

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

func TestPostgresRPC_UpdateTask_VersionConflict(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)
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
			Version: strPtr("1"),
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

func TestPostgresRPC_ClaimTask(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)
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

func TestPostgresRPC_CloseTask(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)

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

func TestPostgresRPC_UpdateTask_Dates(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)

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

func TestPostgresRPC_GetReadyTasks(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)

	readyStage := pb.TaskStage_TASK_STAGE_READY
	_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
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
}

func TestPostgresRPC_GetBlockedTasks(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)

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
}

func TestPostgresRPC_GetBottlenecks(t *testing.T) {
	client, cleanup := testutil.NewTestServerPostgres(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollectionPostgres(t, client)

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
}

// Ensure unused imports don't cause build errors.
var _ = time.Now
var _ = timestamppb.Now
var _ = fmt.Sprintf

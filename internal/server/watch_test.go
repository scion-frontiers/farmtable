package server_test

import (
	"context"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func recvEvent(t *testing.T, stream pb.FarmTableService_WatchTasksClient, timeout time.Duration) *pb.TaskEvent {
	t.Helper()
	type result struct {
		event *pb.TaskEvent
		err   error
	}
	ch := make(chan result, 1)
	go func() {
		e, err := stream.Recv()
		ch <- result{e, err}
	}()
	select {
	case r := <-ch:
		if r.err != nil {
			t.Fatalf("stream.Recv: %v", r.err)
		}
		return r.event
	case <-time.After(timeout):
		t.Fatal("timed out waiting for event")
		return nil
	}
}

func TestWatchTasks_IncludeInitial(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	var taskIDs []string
	for i := 0; i < 3; i++ {
		task, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			CollectionId: collID,
			Name:         "task-" + string(rune('A'+i)),
		})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}
		taskIDs = append(taskIDs, task.GetId())
	}

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId:   &collID,
		IncludeInitial: true,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	seen := make(map[string]bool)
	for i := 0; i < 3; i++ {
		event := recvEvent(t, stream, 5*time.Second)
		if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_INITIAL {
			t.Errorf("event %d: type = %v, want INITIAL", i, event.GetEventType())
		}
		seen[event.GetTask().GetId()] = true
	}
	for _, id := range taskIDs {
		if !seen[id] {
			t.Errorf("missing initial event for task %s", id)
		}
	}

	snap := recvEvent(t, stream, 5*time.Second)
	if snap.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_SNAPSHOT_COMPLETE {
		t.Errorf("expected SNAPSHOT_COMPLETE, got %v", snap.GetEventType())
	}
}

func TestWatchTasks_NoInitial(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "pre-existing",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	streamCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	stream, err := client.WatchTasks(streamCtx, &pb.WatchTasksRequest{
		CollectionId:   &collID,
		IncludeInitial: false,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "new-task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() == pb.TaskEventType_TASK_EVENT_TYPE_INITIAL {
		t.Error("should not receive INITIAL events when include_initial=false")
	}
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_CREATED {
		t.Errorf("event type = %v, want CREATED", event.GetEventType())
	}
	if event.GetTask().GetName() != "new-task" {
		t.Errorf("task name = %q, want %q", event.GetTask().GetName(), "new-task")
	}
}

func TestWatchTasks_CreatedEvent(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "streamed-task",
		Description:  strPtr("description"),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_CREATED {
		t.Errorf("event type = %v, want CREATED", event.GetEventType())
	}
	if event.GetTask().GetId() != created.GetId() {
		t.Errorf("task id = %q, want %q", event.GetTask().GetId(), created.GetId())
	}
	if event.GetTask().GetName() != "streamed-task" {
		t.Errorf("task name = %q, want %q", event.GetTask().GetName(), "streamed-task")
	}
}

func TestWatchTasks_UpdatedEvent(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "update-me",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	newName := "updated-name"
	_, err = client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:      created.GetId(),
		Name:    &newName,
		Version: strPtr(created.GetVersion()),
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_UPDATED {
		t.Errorf("event type = %v, want UPDATED", event.GetEventType())
	}
	if event.GetTask().GetName() != "updated-name" {
		t.Errorf("task name = %q, want %q", event.GetTask().GetName(), "updated-name")
	}
}

func TestWatchTasks_ClosedEvent(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "close-me",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	_, err = client.CloseTask(ctx, &pb.CloseTaskRequest{
		Id:      created.GetId(),
		Version: strPtr(created.GetVersion()),
	})
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_CLOSED {
		t.Errorf("event type = %v, want CLOSED", event.GetEventType())
	}
	if event.GetTask().GetId() != created.GetId() {
		t.Errorf("task id = %q, want %q", event.GetTask().GetId(), created.GetId())
	}
}

func TestWatchTasks_ClaimEvent(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "claim-me",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	_, err = client.ClaimTask(ctx, &pb.ClaimTaskRequest{
		Id:      created.GetId(),
		Version: strPtr(created.GetVersion()),
	})
	if err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_UPDATED {
		t.Errorf("event type = %v, want UPDATED", event.GetEventType())
	}
	if len(event.GetTask().GetAssignees()) == 0 {
		t.Error("expected task to have assignees after claim")
	}
}

func TestWatchTasks_SequenceNumbers(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "seq-task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId:   &collID,
		IncludeInitial: true,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	initial := recvEvent(t, stream, 5*time.Second)
	snap := recvEvent(t, stream, 5*time.Second)

	if initial.GetSequence() != 1 {
		t.Errorf("initial sequence = %d, want 1", initial.GetSequence())
	}
	if snap.GetSequence() != 2 {
		t.Errorf("snapshot_complete sequence = %d, want 2", snap.GetSequence())
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "seq-task-2",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	created := recvEvent(t, stream, 5*time.Second)
	if created.GetSequence() != 3 {
		t.Errorf("created sequence = %d, want 3", created.GetSequence())
	}

	if initial.GetSequence() >= snap.GetSequence() || snap.GetSequence() >= created.GetSequence() {
		t.Errorf("sequences not monotonically increasing: %d, %d, %d",
			initial.GetSequence(), snap.GetSequence(), created.GetSequence())
	}
}

func TestWatchTasks_CollectionFilter(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collA := createTestCollection(t, client)
	collB := createTestCollection(t, client)

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId: &collA,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collB,
		Name:         "wrong-collection",
	})
	if err != nil {
		t.Fatalf("CreateTask in collB: %v", err)
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collA,
		Name:         "right-collection",
	})
	if err != nil {
		t.Fatalf("CreateTask in collA: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetTask().GetName() != "right-collection" {
		t.Errorf("task name = %q, want %q", event.GetTask().GetName(), "right-collection")
	}
	if event.GetTask().GetCollectionId() != collA {
		t.Errorf("collection = %q, want %q", event.GetTask().GetCollectionId(), collA)
	}
}

func TestWatchTasks_Heartbeat(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	streamCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	stream, err := client.WatchTasks(streamCtx, &pb.WatchTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "keep-alive",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_CREATED {
		t.Errorf("event type = %v, want CREATED", event.GetEventType())
	}

	_, err = client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "second-event",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	event2 := recvEvent(t, stream, 5*time.Second)
	if event2.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_CREATED {
		t.Errorf("event type = %v, want CREATED", event2.GetEventType())
	}
	if event2.GetSequence() <= event.GetSequence() {
		t.Errorf("sequence not increasing: %d <= %d", event2.GetSequence(), event.GetSequence())
	}
}

func TestWatchTasks_PassThroughReturnsUnimplemented(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()

	stream, err := client.WatchTasks(context.Background(), &pb.WatchTasksRequest{})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	_, err = stream.Recv()
	if err == nil {
		t.Fatal("expected error from server without EventBus")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unimplemented {
		t.Errorf("code = %v, want Unimplemented", st.Code())
	}
}

func TestWatchTasks_InvalidFilters(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()

	badCollectionID := "not-a-uuid"
	badPhase := pb.TaskPhase(99)
	badStage := pb.TaskStage(99)
	badAssignee := "not-a-uuid"
	badTaskID := "not-a-uuid"
	badPriority := pb.TaskPriority(99)

	tests := []struct {
		name string
		req  *pb.WatchTasksRequest
	}{
		{
			name: "collection_id",
			req:  &pb.WatchTasksRequest{CollectionId: &badCollectionID},
		},
		{
			name: "phase",
			req:  &pb.WatchTasksRequest{Phase: &badPhase},
		},
		{
			name: "stage",
			req:  &pb.WatchTasksRequest{Stages: []pb.TaskStage{badStage}},
		},
		{
			name: "assignee",
			req:  &pb.WatchTasksRequest{Assignee: &badAssignee},
		},
		{
			name: "task_id",
			req:  &pb.WatchTasksRequest{TaskId: &badTaskID},
		},
		{
			name: "priority",
			req:  &pb.WatchTasksRequest{Priority: &badPriority},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stream, err := client.WatchTasks(context.Background(), tt.req)
			if err != nil {
				t.Fatalf("WatchTasks: %v", err)
			}
			_, err = stream.Recv()
			if err == nil {
				t.Fatal("expected invalid argument error")
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
}

func TestWatchTasks_ExternalCollectionReturnsUnimplemented(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()

	platforms := []pb.Platform{
		pb.Platform_PLATFORM_GITHUB,
		pb.Platform_PLATFORM_LINEAR,
		pb.Platform_PLATFORM_JIRA,
		pb.Platform_PLATFORM_ASANA,
	}

	for _, plat := range platforms {
		t.Run(plat.String(), func(t *testing.T) {
			p := plat
			remoteID := "remote-123"
			coll, err := client.CreateCollection(context.Background(), &pb.CreateCollectionRequest{
				Name:     "ext-" + plat.String(),
				Platform: &p,
				RemoteId: &remoteID,
			})
			if err != nil {
				t.Fatalf("CreateCollection: %v", err)
			}
			collID := coll.GetId()

			stream, err := client.WatchTasks(context.Background(), &pb.WatchTasksRequest{
				CollectionId: &collID,
			})
			if err != nil {
				t.Fatalf("WatchTasks: %v", err)
			}

			_, err = stream.Recv()
			if err == nil {
				t.Fatal("expected Unimplemented error for external collection")
			}
			st, ok := status.FromError(err)
			if !ok {
				t.Fatalf("expected gRPC status error, got %v", err)
			}
			if st.Code() != codes.Unimplemented {
				t.Errorf("code = %v, want Unimplemented", st.Code())
			}
		})
	}
}

func TestWatchTasks_FarmtableCollectionAllowed(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client) // default platform = farmtable

	_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "farmtable-task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		CollectionId:   &collID,
		IncludeInitial: true,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_INITIAL {
		t.Errorf("event type = %v, want INITIAL", event.GetEventType())
	}
}

func TestWatchTasks_NoCollectionFilterAllowed(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithStreaming(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "unfiltered-task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	// No collection_id filter — should proceed normally.
	stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
		IncludeInitial: true,
	})
	if err != nil {
		t.Fatalf("WatchTasks: %v", err)
	}

	event := recvEvent(t, stream, 5*time.Second)
	if event.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_INITIAL {
		t.Errorf("event type = %v, want INITIAL", event.GetEventType())
	}
}

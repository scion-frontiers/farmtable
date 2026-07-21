package server_test

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/testutil"
)

// stagePtr returns a pointer to a TaskStage value.
func stagePtr(s pb.TaskStage) *pb.TaskStage { return &s }

// platformPtr returns a pointer to a Platform value.
func platformPtr(p pb.Platform) *pb.Platform { return &p }

// createGitHubCollection creates a GitHub-platform collection via gRPC
// and returns its ID.
func createGitHubCollection(t *testing.T, client pb.FarmTableServiceClient, name string) string {
	t.Helper()
	coll, err := client.CreateCollection(context.Background(), &pb.CreateCollectionRequest{
		Name:     name,
		Platform: platformPtr(pb.Platform_PLATFORM_GITHUB),
		RemoteId: strPtr("owner/repo"),
	})
	if err != nil {
		t.Fatalf("CreateCollection(%s): %v", name, err)
	}
	return coll.GetId()
}

// createTaskWithBlocking creates a task via gRPC in the given collection
// with the specified blocking relationships and returns the proto.
func createTaskWithBlocking(
	t *testing.T,
	client pb.FarmTableServiceClient,
	collID, name string,
	blockedBy []string,
) *pb.Task {
	t.Helper()
	stage := pb.TaskStage_TASK_STAGE_READY
	tsk, err := client.CreateTask(context.Background(), &pb.CreateTaskRequest{
		CollectionId:     collID,
		Name:             name,
		Stage:            &stage,
		BlockedByTaskIds: blockedBy,
	})
	if err != nil {
		t.Fatalf("CreateTask(%s): %v", name, err)
	}
	return tsk
}

// ─── Test: GetCriticalPath via ephemeral (simple chain A→B→C) ───

func TestGraphIntegration_GetCriticalPath_SimpleChain(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "critical-path-chain")

	taskA := createTaskWithBlocking(t, client, collID, "Task A", nil)
	taskB := createTaskWithBlocking(t, client, collID, "Task B", []string{taskA.GetId()})
	taskC := createTaskWithBlocking(t, client, collID, "Task C", []string{taskB.GetId()})

	resp, err := client.GetCriticalPath(context.Background(), &pb.GetCriticalPathRequest{
		CollectionId: collID,
	})
	if err != nil {
		t.Fatalf("GetCriticalPath: %v", err)
	}

	if resp.TotalDepth != 3 {
		t.Errorf("expected total_depth=3, got %d", resp.TotalDepth)
	}
	if len(resp.Path) != 3 {
		t.Fatalf("expected 3 nodes in path, got %d", len(resp.Path))
	}

	// The critical path should be A → B → C.
	wantOrder := []string{taskA.GetName(), taskB.GetName(), taskC.GetName()}
	for i, node := range resp.Path {
		if node.Name != wantOrder[i] {
			t.Errorf("path[%d].name = %q, want %q", i, node.Name, wantOrder[i])
		}
		if node.Depth != int32(i) {
			t.Errorf("path[%d].depth = %d, want %d", i, node.Depth, i)
		}
	}
}

// ─── Test: GetReadyTasks via ephemeral (simple chain A→B,C) ───

func TestGraphIntegration_GetReadyTasks_SimpleChain(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "ready-tasks-chain")

	taskA := createTaskWithBlocking(t, client, collID, "Task A", nil)
	createTaskWithBlocking(t, client, collID, "Task B", []string{taskA.GetId()})
	createTaskWithBlocking(t, client, collID, "Task C", []string{taskA.GetId()})

	resp, err := client.GetReadyTasks(context.Background(), &pb.GetReadyTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("GetReadyTasks: %v", err)
	}

	// Only Task A should be ready (no blockers).
	if len(resp.Items) == 0 {
		t.Fatal("expected at least one ready task")
	}

	readyNames := make(map[string]bool)
	for _, item := range resp.Items {
		readyNames[item.Task.GetName()] = true
	}

	if !readyNames["Task A"] {
		t.Error("expected Task A to be ready (no blockers)")
	}
	if readyNames["Task B"] {
		t.Error("Task B should NOT be ready (blocked by A)")
	}
	if readyNames["Task C"] {
		t.Error("Task C should NOT be ready (blocked by A)")
	}
}

// ─── Test: GetBlockedTasks via ephemeral (simple chain A→B→C) ───

func TestGraphIntegration_GetBlockedTasks_SimpleChain(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "blocked-tasks-chain")

	taskA := createTaskWithBlocking(t, client, collID, "Task A", nil)
	createTaskWithBlocking(t, client, collID, "Task B", []string{taskA.GetId()})
	createTaskWithBlocking(t, client, collID, "Task C", []string{taskA.GetId()})

	resp, err := client.GetBlockedTasks(context.Background(), &pb.GetBlockedTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("GetBlockedTasks: %v", err)
	}

	// B and C should be blocked; A should not.
	blockedNames := make(map[string]bool)
	for _, item := range resp.Items {
		blockedNames[item.Task.GetName()] = true
	}

	if blockedNames["Task A"] {
		t.Error("Task A should NOT be blocked (no blockers)")
	}
	if !blockedNames["Task B"] {
		t.Error("expected Task B to be blocked (blocked by A)")
	}
	if !blockedNames["Task C"] {
		t.Error("expected Task C to be blocked (blocked by A)")
	}
}

// ─── Test: GetBottlenecks via ephemeral (diamond A→B,C→D) ───

func TestGraphIntegration_GetBottlenecks_Diamond(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "bottleneck-diamond")

	// Diamond shape: A blocks B and C; both B and C block D.
	taskA := createTaskWithBlocking(t, client, collID, "Task A", nil)
	taskB := createTaskWithBlocking(t, client, collID, "Task B", []string{taskA.GetId()})
	taskC := createTaskWithBlocking(t, client, collID, "Task C", []string{taskA.GetId()})
	createTaskWithBlocking(t, client, collID, "Task D", []string{taskB.GetId(), taskC.GetId()})

	resp, err := client.GetBottlenecks(context.Background(), &pb.GetBottlenecksRequest{
		CollectionId: collID,
	})
	if err != nil {
		t.Fatalf("GetBottlenecks: %v", err)
	}

	if len(resp.Items) == 0 {
		t.Fatal("expected at least one bottleneck")
	}

	// Task A should be the top bottleneck because it blocks B and C
	// (2 direct dependents), which transitively block D (3 downstream total).
	topBottleneck := resp.Items[0]
	if topBottleneck.Name != "Task A" {
		t.Errorf("expected top bottleneck to be Task A, got %q", topBottleneck.Name)
	}
	if topBottleneck.DirectDependents != 2 {
		t.Errorf("expected 2 direct dependents for Task A, got %d", topBottleneck.DirectDependents)
	}
	if topBottleneck.DownstreamCount < 3 {
		t.Errorf("expected at least 3 downstream tasks for Task A, got %d", topBottleneck.DownstreamCount)
	}
}

// ─── Test: GetCriticalPath with diamond (longest chain) ───

func TestGraphIntegration_GetCriticalPath_Diamond(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "critical-path-diamond")

	// Diamond: A → B → D and A → C → D.
	// Both paths have depth 3, so the critical path should have depth 3.
	taskA := createTaskWithBlocking(t, client, collID, "Task A", nil)
	taskB := createTaskWithBlocking(t, client, collID, "Task B", []string{taskA.GetId()})
	taskC := createTaskWithBlocking(t, client, collID, "Task C", []string{taskA.GetId()})
	createTaskWithBlocking(t, client, collID, "Task D", []string{taskB.GetId(), taskC.GetId()})

	resp, err := client.GetCriticalPath(context.Background(), &pb.GetCriticalPathRequest{
		CollectionId: collID,
	})
	if err != nil {
		t.Fatalf("GetCriticalPath: %v", err)
	}

	// The longest chain through the diamond is A → (B or C) → D = depth 3.
	if resp.TotalDepth != 3 {
		t.Errorf("expected total_depth=3 for diamond, got %d", resp.TotalDepth)
	}
	if len(resp.Path) != 3 {
		t.Fatalf("expected 3 nodes in path, got %d", len(resp.Path))
	}

	// First node must be A (root of all chains).
	if resp.Path[0].Name != "Task A" {
		t.Errorf("expected first node to be Task A, got %q", resp.Path[0].Name)
	}
	// Last node must be D (end of all chains).
	if resp.Path[2].Name != "Task D" {
		t.Errorf("expected last node to be Task D, got %q", resp.Path[2].Name)
	}
}

// ─── Test: GetReadyTasks with independent tasks (no relationships) ───

func TestGraphIntegration_GetReadyTasks_IndependentTasks(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "ready-independent")

	createTaskWithBlocking(t, client, collID, "Independent A", nil)
	createTaskWithBlocking(t, client, collID, "Independent B", nil)
	createTaskWithBlocking(t, client, collID, "Independent C", nil)

	resp, err := client.GetReadyTasks(context.Background(), &pb.GetReadyTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("GetReadyTasks: %v", err)
	}

	// All three tasks should be ready since none are blocked.
	if len(resp.Items) != 3 {
		t.Errorf("expected 3 ready tasks, got %d", len(resp.Items))
	}
}

// ─── Test: GetBlockedTasks with no blocked tasks ───

func TestGraphIntegration_GetBlockedTasks_NoneBlocked(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "blocked-none")

	createTaskWithBlocking(t, client, collID, "Free A", nil)
	createTaskWithBlocking(t, client, collID, "Free B", nil)

	resp, err := client.GetBlockedTasks(context.Background(), &pb.GetBlockedTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("GetBlockedTasks: %v", err)
	}

	if len(resp.Items) != 0 {
		t.Errorf("expected 0 blocked tasks, got %d", len(resp.Items))
	}
}

// ─── Test: GetBottlenecks with simple chain (A blocks B blocks C) ───

func TestGraphIntegration_GetBottlenecks_SimpleChain(t *testing.T) {
	client, cleanup := testutil.NewTestServerWithEphemeralPool(t)
	defer cleanup()

	collID := createGitHubCollection(t, client, "bottleneck-chain")

	taskA := createTaskWithBlocking(t, client, collID, "Task A", nil)
	taskB := createTaskWithBlocking(t, client, collID, "Task B", []string{taskA.GetId()})
	createTaskWithBlocking(t, client, collID, "Task C", []string{taskB.GetId()})

	resp, err := client.GetBottlenecks(context.Background(), &pb.GetBottlenecksRequest{
		CollectionId: collID,
	})
	if err != nil {
		t.Fatalf("GetBottlenecks: %v", err)
	}

	if len(resp.Items) < 2 {
		t.Fatalf("expected at least 2 bottleneck entries, got %d", len(resp.Items))
	}

	// Task A should be first (downstream count 2: B and C).
	if resp.Items[0].Name != "Task A" {
		t.Errorf("expected top bottleneck to be Task A, got %q", resp.Items[0].Name)
	}
	if resp.Items[0].DownstreamCount != 2 {
		t.Errorf("expected downstream_count=2 for Task A, got %d", resp.Items[0].DownstreamCount)
	}
	if resp.Items[0].DirectDependents != 1 {
		t.Errorf("expected direct_dependents=1 for Task A, got %d", resp.Items[0].DirectDependents)
	}
}

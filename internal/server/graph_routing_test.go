package server

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// newTestService creates a FarmTableService backed by an in-memory SQLite store
// with an optional EphemeralStorePool for tests that exercise ephemeral routing.
func newTestService(t *testing.T, withPool bool) (*FarmTableService, func()) {
	t.Helper()
	ctx := context.Background()
	s, err := store.NewEntStore(ctx, store.StoreOptions{
		Dialect: "sqlite3",
		DSN:     "file::memory:?cache=shared&_fk=1",
		Migrate: true,
	})
	if err != nil {
		t.Fatalf("creating test store: %v", err)
	}

	var opts []ServiceOption
	var pool *store.EphemeralStorePool
	if withPool {
		pool = store.NewEphemeralStorePool(2)
		opts = append(opts, WithEphemeralPool(pool))
	}

	svc := NewFarmTableService(s, "test", opts...)
	cleanup := func() {
		if pool != nil {
			pool.Close()
		}
		s.Close()
	}
	return svc, cleanup
}

func TestResolveGraphRoute_FarmtableCollection(t *testing.T) {
	svc, cleanup := newTestService(t, false)
	defer cleanup()
	ctx := context.Background()

	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "my farmtable collection",
		Platform: string(collection.PlatformFarmtable),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	_, route, err := svc.resolveGraphRoute(ctx, coll.ID)
	if err != nil {
		t.Fatalf("resolveGraphRoute: %v", err)
	}
	if route != graphRouteDirect {
		t.Errorf("expected graphRouteDirect for farmtable collection, got %d", route)
	}
}

func TestResolveGraphRoute_SupportedExternalCollection(t *testing.T) {
	svc, cleanup := newTestService(t, false)
	defer cleanup()
	ctx := context.Background()

	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "my github collection",
		Platform: string(collection.PlatformGithub),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	_, route, err := svc.resolveGraphRoute(ctx, coll.ID)
	if err != nil {
		t.Fatalf("resolveGraphRoute: %v", err)
	}
	if route != graphRouteEphemeral {
		t.Errorf("expected graphRouteEphemeral for github collection, got %d", route)
	}
}

func TestResolveGraphRoute_UnsupportedExternalCollection(t *testing.T) {
	svc, cleanup := newTestService(t, false)
	defer cleanup()
	ctx := context.Background()

	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "my asana collection",
		Platform: string(collection.PlatformAsana),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	_, _, err = svc.resolveGraphRoute(ctx, coll.ID)
	if err == nil {
		t.Fatal("expected error for unsupported platform")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unimplemented {
		t.Errorf("expected Unimplemented, got %v", st.Code())
	}
}

func TestResolveGraphRoute_NonexistentCollection(t *testing.T) {
	svc, cleanup := newTestService(t, false)
	defer cleanup()
	ctx := context.Background()

	_, _, err := svc.resolveGraphRoute(ctx, uuid.New())
	if err == nil {
		t.Fatal("expected error for nonexistent collection")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.NotFound {
		t.Errorf("expected NotFound, got %v", st.Code())
	}
}

func TestGetCriticalPath_ExternalCollection_EphemeralRoute(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	// Create a GitHub collection (external, supported).
	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "github project",
		Platform: string(collection.PlatformGithub),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	// Create tasks with blocking relationship: A blocks B blocks C.
	taskA, err := svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task A",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	taskB, err := svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task B",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task B: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task C",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
		BlockedByTaskIDs: []uuid.UUID{taskB.ID},
	})
	if err != nil {
		t.Fatalf("creating task C: %v", err)
	}

	resp, err := svc.GetCriticalPath(ctx, &pb.GetCriticalPathRequest{
		CollectionId: coll.ID.String(),
	})
	if err != nil {
		t.Fatalf("GetCriticalPath: %v", err)
	}

	// The critical path should have depth 3 (A -> B -> C).
	if resp.TotalDepth != 3 {
		t.Errorf("expected total_depth=3, got %d", resp.TotalDepth)
	}
	if len(resp.Path) != 3 {
		t.Errorf("expected 3 nodes in path, got %d", len(resp.Path))
	}
}

func TestGetBottlenecks_ExternalCollection_EphemeralRoute(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	// Create a Linear collection (external, supported).
	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "linear project",
		Platform: string(collection.PlatformLinear),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	// Create a bottleneck: A blocks B and C.
	taskA, err := svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Bottleneck A",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task B",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task B: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task C",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task C: %v", err)
	}

	resp, err := svc.GetBottlenecks(ctx, &pb.GetBottlenecksRequest{
		CollectionId: coll.ID.String(),
	})
	if err != nil {
		t.Fatalf("GetBottlenecks: %v", err)
	}

	if len(resp.Items) == 0 {
		t.Fatal("expected at least one bottleneck")
	}
	// The top bottleneck should have 2 direct dependents.
	if resp.Items[0].DirectDependents != 2 {
		t.Errorf("expected 2 direct dependents, got %d", resp.Items[0].DirectDependents)
	}
}

func TestGetReadyTasks_ExternalCollection_EphemeralRoute(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	// Create a Jira collection (external, supported).
	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "jira project",
		Platform: string(collection.PlatformJira),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	// Create a task in ready stage.
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Ready task",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
	})
	if err != nil {
		t.Fatalf("creating task: %v", err)
	}

	collIDStr := coll.ID.String()
	resp, err := svc.GetReadyTasks(ctx, &pb.GetReadyTasksRequest{
		CollectionId: &collIDStr,
	})
	if err != nil {
		t.Fatalf("GetReadyTasks: %v", err)
	}

	if len(resp.Items) == 0 {
		t.Error("expected at least one ready task from ephemeral path")
	}
}

func TestGetBlockedTasks_ExternalCollection_EphemeralRoute(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	// Create a GitHub collection (external, supported).
	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "github project",
		Platform: string(collection.PlatformGithub),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	// Create A and B where B is blocked by A.
	taskA, err := svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Blocker A",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Blocked B",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task B: %v", err)
	}

	collIDStr := coll.ID.String()
	resp, err := svc.GetBlockedTasks(ctx, &pb.GetBlockedTasksRequest{
		CollectionId: &collIDStr,
	})
	if err != nil {
		t.Fatalf("GetBlockedTasks: %v", err)
	}

	if len(resp.Items) == 0 {
		t.Error("expected at least one blocked task from ephemeral path")
	}
}

func TestGetCriticalPath_UnsupportedExternalCollection(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "asana project",
		Platform: string(collection.PlatformAsana),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	_, err = svc.GetCriticalPath(ctx, &pb.GetCriticalPathRequest{
		CollectionId: coll.ID.String(),
	})
	if err == nil {
		t.Fatal("expected error for unsupported platform")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unimplemented {
		t.Errorf("expected Unimplemented, got %v", st.Code())
	}
}

func TestGetBottlenecks_UnsupportedExternalCollection(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "beads project",
		Platform: string(collection.PlatformBeads),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	_, err = svc.GetBottlenecks(ctx, &pb.GetBottlenecksRequest{
		CollectionId: coll.ID.String(),
	})
	if err == nil {
		t.Fatal("expected error for unsupported platform")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unimplemented {
		t.Errorf("expected Unimplemented, got %v", st.Code())
	}
}

func TestGetReadyTasks_UnsupportedExternalCollection(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "asana project",
		Platform: string(collection.PlatformAsana),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	collIDStr := coll.ID.String()
	_, err = svc.GetReadyTasks(ctx, &pb.GetReadyTasksRequest{
		CollectionId: &collIDStr,
	})
	if err == nil {
		t.Fatal("expected error for unsupported platform")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Unimplemented {
		t.Errorf("expected Unimplemented, got %v", st.Code())
	}
}

func TestGetCriticalPath_FarmtableCollection_DirectRoute(t *testing.T) {
	svc, cleanup := newTestService(t, true)
	defer cleanup()
	ctx := context.Background()

	// Create a farmtable collection — should use direct path.
	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "farmtable project",
		Platform: string(collection.PlatformFarmtable),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	// Create two tasks with blocking: A blocks B.
	taskA, err := svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task A",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Task B",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task B: %v", err)
	}

	resp, err := svc.GetCriticalPath(ctx, &pb.GetCriticalPathRequest{
		CollectionId: coll.ID.String(),
	})
	if err != nil {
		t.Fatalf("GetCriticalPath: %v", err)
	}

	if resp.TotalDepth != 2 {
		t.Errorf("expected total_depth=2, got %d", resp.TotalDepth)
	}
}

func TestLoadEphemeralStore_NilPool(t *testing.T) {
	svc, cleanup := newTestService(t, false) // no pool
	defer cleanup()
	ctx := context.Background()

	_, _, err := svc.loadEphemeralStore(ctx, uuid.New())
	if err == nil {
		t.Fatal("expected error when pool is nil")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected gRPC status error, got %v", err)
	}
	if st.Code() != codes.Internal {
		t.Errorf("expected Internal, got %v", st.Code())
	}
}

func TestExtractRelationships(t *testing.T) {
	svc, cleanup := newTestService(t, false)
	defer cleanup()
	ctx := context.Background()

	coll, err := svc.store.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "test",
		Platform: string(collection.PlatformFarmtable),
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	taskA, err := svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "A",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "B",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageReady,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task B: %v", err)
	}

	// Re-fetch task B to get eager-loaded relationships.
	// B has a SourceRelationship of type "blocked_by" pointing to A.
	tasks, _, err := svc.store.ListTasks(ctx, store.ListTasksParams{
		CollectionID: &coll.ID,
		Limit:        100,
	})
	if err != nil {
		t.Fatalf("listing tasks: %v", err)
	}

	// Collect all relationships from all tasks.
	totalRels := 0
	for _, tsk := range tasks {
		rels := extractRelationships(tsk)
		totalRels += len(rels)
	}
	if totalRels == 0 {
		t.Fatal("expected at least one relationship across all tasks")
	}
}

package server

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
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
		Stage:        task.StageAccepted,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	taskB, err := svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:            "Task B",
		CollectionID:     coll.ID,
		Phase:            task.PhaseOpen,
		Stage:            task.StageAccepted,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task B: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:            "Task C",
		CollectionID:     coll.ID,
		Phase:            task.PhaseOpen,
		Stage:            task.StageAccepted,
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
		Stage:        task.StageAccepted,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:            "Task B",
		CollectionID:     coll.ID,
		Phase:            task.PhaseOpen,
		Stage:            task.StageAccepted,
		BlockedByTaskIDs: []uuid.UUID{taskA.ID},
	})
	if err != nil {
		t.Fatalf("creating task B: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:            "Task C",
		CollectionID:     coll.ID,
		Phase:            task.PhaseOpen,
		Stage:            task.StageAccepted,
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

	// Create a task in accepted stage.
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Ready task",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageAccepted,
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
		Stage:        task.StageAccepted,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:            "Blocked B",
		CollectionID:     coll.ID,
		Phase:            task.PhaseOpen,
		Stage:            task.StageAccepted,
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
		Stage:        task.StageAccepted,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:            "Task B",
		CollectionID:     coll.ID,
		Phase:            task.PhaseOpen,
		Stage:            task.StageAccepted,
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
		Stage:        task.StageAccepted,
	})
	if err != nil {
		t.Fatalf("creating task A: %v", err)
	}
	_, err = svc.store.CreateTask(ctx, store.CreateTaskParams{
		Title:            "B",
		CollectionID:     coll.ID,
		Phase:            task.PhaseOpen,
		Stage:            task.StageAccepted,
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

// TestEphemeralGraphRouteDropsRemoteData pins the premise the whole
// passthrough-GraphQL sanitizer argument rests on.
//
// The ephemeral graph route is the ONE path from a passthrough task to
// taskToProto that contains a real serialisation round-trip: loadEphemeralStore
// pulls tasks out of the passthrough store, writes each into an in-memory SQLite
// store via taskToCreateParams, and the inner handler reads them back out. If
// RemoteData travelled that path it would be JSON-encoded and decoded, "labels"
// would come back as []any instead of []string, structpb.NewStruct would
// succeed, and remote_data would start populating on the wire -- which is
// precisely the outcome TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident
// asserts cannot happen.
//
// TODAY IT DOES NOT TRAVEL, AND THE ONLY THING STOPPING IT IS AN ABSENT LINE IN A
// FOURTEEN-FIELD COPY. taskToCreateParams copies Title, Description, Phase,
// Stage, NativeLabel, Type, Priority, Labels, StartDate, DueDate, Repo, Branch
// and AcceptanceCriteria, and simply never assigns RemoteData -- not because the
// destination lacks the field (store.CreateTaskParams has it, and control 2
// below proves the store persists it when it is set), but because the copy omits
// it. A MISSING FIELD IN A FOURTEEN-FIELD COPY READS TO EVERY FUTURE MAINTAINER
// AS AN OVERSIGHT TO BE TIDIED UP: adding one line looks like a bug fix and
// would silently invalidate the premise with nothing else in the tree going red.
//
// This test pins the VALUE, not the spelling. It does not grep for the absent
// assignment; it drives a task carrying RemoteData through the real ephemeral
// store and asserts what arrives on the far side.
func TestEphemeralGraphRouteDropsRemoteData(t *testing.T) {
	ctx := context.Background()

	pool := store.NewEphemeralStorePool(1)
	defer pool.Close()
	ephemeral, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("acquiring ephemeral store: %v", err)
	}

	// The source task carries the shape the passthrough store actually builds:
	// a URL-bearing key plus the []string "labels" whose type rejection is what
	// keeps remote_data off the wire.
	src := &ent.Task{
		Title:       "issue from a passthrough collection",
		Description: "body",
		Phase:       task.PhaseOpen,
		Stage:       task.StageTriage,
		Labels:      []string{"bug"},
		RemoteData: map[string]any{
			"remote_url": "https://example.test/issues/1",
			"labels":     []string{"bug"},
		},
	}
	// Anti-vacuity: if the input were nil this test would pass while measuring
	// nothing at all.
	if len(src.RemoteData) == 0 {
		t.Fatal("fixture error: the source task must carry RemoteData or this test is vacuous")
	}

	mirror, err := ephemeral.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "ephemeral-mirror",
		Platform: string(collection.PlatformFarmtable),
	})
	if err != nil {
		t.Fatalf("creating mirror collection: %v", err)
	}

	params := taskToCreateParams(src, mirror.ID)

	// CONTROL 1 -- the copy ran and does copy things. Without this, a nil
	// RemoteData below would be equally consistent with taskToCreateParams
	// having become a no-op or having failed to see its input at all.
	if params.Title != src.Title {
		t.Fatalf("control 1: taskToCreateParams should copy Title, got %q want %q",
			params.Title, src.Title)
	}

	// CONTROL 2 -- THE STORE WOULD CARRY REMOTEDATA IF THE COPY ASSIGNED IT.
	// This is the control that makes the assertion below meaningful: it proves
	// the protection lives in taskToCreateParams and NOT in some downstream
	// inability to persist the field. An assertion that a value comes back nil
	// is worth nothing unless something could have come back non-nil.
	withRemote := params
	withRemote.RemoteData = src.RemoteData
	carried, err := ephemeral.CreateTask(ctx, withRemote)
	if err != nil {
		t.Fatalf("control 2: creating task with RemoteData set: %v", err)
	}
	reloadedCarried, err := ephemeral.GetTask(ctx, carried.ID)
	if err != nil {
		t.Fatalf("control 2: reloading task: %v", err)
	}
	if reloadedCarried.RemoteData == nil {
		t.Fatal("control 2: the ephemeral store dropped RemoteData even when it WAS " +
			"assigned. The pin below would then be measuring the store's behaviour " +
			"rather than taskToCreateParams's, and would stay green after the copy " +
			"started propagating the field.")
	}

	// THE PROPERTY. Same store, same collection, params straight from the copy.
	created, err := ephemeral.CreateTask(ctx, params)
	if err != nil {
		t.Fatalf("creating task from taskToCreateParams: %v", err)
	}
	reloaded, err := ephemeral.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("reloading task: %v", err)
	}
	if reloaded.RemoteData != nil {
		t.Errorf("RemoteData is now propagating onto the ephemeral graph route: got %v.\n"+
			"taskToCreateParams has begun copying the field. That completes a real "+
			"JSON round-trip on this path, so \"labels\" arrives as []any, "+
			"structpb.NewStruct succeeds, and passthrough remote_data starts "+
			"reaching the wire. The premise behind "+
			"TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident and behind the "+
			"read-path-only sanitizer argument no longer holds. This is not a test "+
			"to update -- re-derive the persistence question first.", reloaded.RemoteData)
	}
}

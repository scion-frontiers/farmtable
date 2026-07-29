package store_test

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
)

func TestTruncate(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	// Seed data across several tables.
	collID := createTestCollection(t, s)
	_, err := s.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Ephemeral task",
		CollectionID: collID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	if err := s.Truncate(ctx); err != nil {
		t.Fatalf("Truncate: %v", err)
	}

	// Verify tables are empty.
	tasks, total, err := s.ListTasks(ctx, store.ListTasksParams{})
	if err != nil {
		t.Fatalf("ListTasks after truncate: %v", err)
	}
	if total != 0 || len(tasks) != 0 {
		t.Errorf("tasks after truncate: total=%d len=%d, want 0", total, len(tasks))
	}

	cols, colTotal, err := s.ListCollections(ctx, store.ListCollectionsParams{})
	if err != nil {
		t.Fatalf("ListCollections after truncate: %v", err)
	}
	if colTotal != 0 || len(cols) != 0 {
		t.Errorf("collections after truncate: total=%d len=%d, want 0", colTotal, len(cols))
	}
}

func TestEphemeralStorePool_GetAndReturn(t *testing.T) {
	pool := store.NewEphemeralStorePool(2)
	defer pool.Close()
	ctx := context.Background()

	// Get a fresh store from the empty pool.
	s1, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	// Verify the store is usable — create some data.
	coll, err := s1.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "ephemeral",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	_, err = s1.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Pool task",
		CollectionID: coll.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	// Return the store to the pool (should truncate it).
	pool.Return(s1)

	// Get it back — should be the same (recycled) instance, now empty.
	s2, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("Get after return: %v", err)
	}
	if s2 != s1 {
		t.Error("expected recycled store instance")
	}

	// Verify data was truncated.
	tasks, total, err := s2.ListTasks(ctx, store.ListTasksParams{})
	if err != nil {
		t.Fatalf("ListTasks on recycled store: %v", err)
	}
	if total != 0 || len(tasks) != 0 {
		t.Errorf("recycled store should be empty: total=%d len=%d", total, len(tasks))
	}

	// Verify the recycled store is still usable.
	coll2, err := s2.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "reused",
		Platform: "farmtable",
	})
	if err != nil {
		t.Fatalf("CreateCollection on recycled store: %v", err)
	}
	_, err = s2.CreateTask(ctx, store.CreateTaskParams{
		Title:        "Reused task",
		CollectionID: coll2.ID,
		Phase:        task.PhaseOpen,
		Stage:        task.StageTriage,
		NativeLabel:  "triage",
		Type:         "task",
	})
	if err != nil {
		t.Fatalf("CreateTask on recycled store: %v", err)
	}

	pool.Return(s2)
}

func TestEphemeralStorePool_ExceedsMaxSize(t *testing.T) {
	pool := store.NewEphemeralStorePool(1)
	defer pool.Close()
	ctx := context.Background()

	s1, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("Get s1: %v", err)
	}
	s2, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("Get s2: %v", err)
	}

	// Return both — only one should be kept (maxSize=1).
	pool.Return(s1)
	pool.Return(s2) // s2 should be closed, not pooled.

	// Get one — should be s1 (the one that was kept).
	s3, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("Get s3: %v", err)
	}
	if s3 != s1 {
		t.Error("expected the first returned store to be recycled")
	}

	// Pool should now be empty, next Get creates a new store.
	s4, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("Get s4: %v", err)
	}
	if s4 == s1 || s4 == s2 {
		t.Error("expected a fresh store, not a recycled one")
	}

	pool.Return(s3)
	pool.Return(s4)
}

func TestEphemeralStorePool_Close(t *testing.T) {
	pool := store.NewEphemeralStorePool(3)
	ctx := context.Background()

	stores := make([]*store.EntStore, 3)
	for i := range stores {
		s, err := pool.Get(ctx)
		if err != nil {
			t.Fatalf("Get %d: %v", i, err)
		}
		stores[i] = s
	}
	for _, s := range stores {
		pool.Return(s)
	}

	// Close should drain the pool.
	pool.Close()

	// After close, Get should still work (creates a new store).
	s, err := pool.Get(ctx)
	if err != nil {
		t.Fatalf("Get after Close: %v", err)
	}
	s.Close()
}

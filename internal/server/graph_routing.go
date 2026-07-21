package server

import (
	"context"
	"fmt"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// graphRouteResult describes how to route a graph query for a given collection.
type graphRouteResult int

const (
	// graphRouteDirect means the collection uses the primary store directly
	// (farmtable platform or no collection_id specified).
	graphRouteDirect graphRouteResult = iota
	// graphRouteEphemeral means the collection requires loading tasks into an
	// ephemeral in-memory SQLite store for graph queries.
	graphRouteEphemeral
)

// resolveGraphRoute determines how a graph query for the given collection
// should be routed. It returns the collection entity when relevant, the
// routing decision, and any error (e.g. Unimplemented for unsupported
// platforms).
func (s *FarmTableService) resolveGraphRoute(ctx context.Context, collectionID uuid.UUID) (*ent.Collection, graphRouteResult, error) {
	coll, err := s.store.GetCollection(ctx, collectionID)
	if err != nil {
		return nil, graphRouteDirect, status.Errorf(codes.NotFound, "collection not found: %v", err)
	}

	if coll.Platform == collection.PlatformFarmtable {
		return coll, graphRouteDirect, nil
	}

	if !collectionSupportsGraph(coll) {
		return nil, graphRouteDirect, status.Errorf(codes.Unimplemented,
			"graph queries are not supported for %s collections", coll.Platform)
	}

	return coll, graphRouteEphemeral, nil
}

// loadEphemeralStore acquires an ephemeral in-memory SQLite store from the
// pool, loads all tasks and their relationships from the passthrough store
// for the given collection, and returns a FarmTableService backed by the
// ephemeral store. The caller MUST call the returned cleanup function to
// release the ephemeral store back to the pool.
//
// The ephemeral store gets a mirror of the collection so that graph queries
// scoped by collection_id work correctly.
func (s *FarmTableService) loadEphemeralStore(ctx context.Context, collectionID uuid.UUID) (*FarmTableService, func(), error) {
	if s.ephemeralPool == nil {
		return nil, nil, status.Errorf(codes.Internal, "ephemeral store pool not configured")
	}

	ephemeral, err := s.ephemeralPool.Get(ctx)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "acquiring ephemeral store: %v", err)
	}
	cleanup := func() { s.ephemeralPool.Return(ephemeral) }

	// Load all tasks for the collection from the passthrough store.
	// We use ListTasks with a high limit to get relationships eagerly loaded.
	const maxEphemeralTasks = 10000
	tasks, _, err := s.store.ListTasks(ctx, store.ListTasksParams{
		CollectionID: &collectionID,
		Limit:        maxEphemeralTasks,
	})
	if err != nil {
		cleanup()
		return nil, nil, status.Errorf(codes.Internal, "loading tasks for ephemeral graph: %v", err)
	}

	// Create a mirror collection in the ephemeral store so that collection-
	// scoped graph queries resolve correctly.
	mirrorColl, err := ephemeral.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     fmt.Sprintf("ephemeral-%s", collectionID),
		Platform: string(collection.PlatformFarmtable),
	})
	if err != nil {
		cleanup()
		return nil, nil, status.Errorf(codes.Internal, "creating ephemeral collection: %v", err)
	}
	ephCollID := mirrorColl.ID

	// Build a map of original task ID -> ephemeral task ID so we can
	// recreate relationships with the correct IDs.
	idMap := make(map[uuid.UUID]uuid.UUID, len(tasks))

	// First pass: create all tasks in the ephemeral store.
	for _, t := range tasks {
		created, err := ephemeral.CreateTask(ctx, taskToCreateParams(t, ephCollID))
		if err != nil {
			cleanup()
			return nil, nil, status.Errorf(codes.Internal, "loading task into ephemeral store: %v", err)
		}
		idMap[t.ID] = created.ID
	}

	// Second pass: create relationships using the mapped IDs.
	for _, t := range tasks {
		for _, rel := range extractRelationships(t) {
			srcID, srcOK := idMap[rel.SourceTaskID]
			tgtID, tgtOK := idMap[rel.TargetTaskID]
			if !srcOK || !tgtOK {
				// One end of the relationship is outside this collection;
				// skip it since it can't participate in the graph.
				continue
			}
			rel.SourceTaskID = srcID
			rel.TargetTaskID = tgtID

			if err := createRelationshipViaUpdate(ctx, ephemeral, rel); err != nil {
				// Non-fatal: log and continue. A missing relationship
				// degrades the graph but doesn't break it.
				continue
			}
		}
	}

	svc := NewFarmTableService(ephemeral, s.version)
	return svc, cleanup, nil
}

// taskToCreateParams converts an ent.Task into CreateTaskParams suitable
// for inserting into an ephemeral store.
func taskToCreateParams(t *ent.Task, collectionID uuid.UUID) store.CreateTaskParams {
	p := store.CreateTaskParams{
		Title:        t.Title,
		Description:  t.Description,
		CollectionID: collectionID,
		Phase:        t.Phase,
		Stage:        t.Stage,
		NativeLabel:  t.NativeLabel,
		Type:         t.Type,
		Priority:     t.Priority,
		Labels:       t.Labels,
		StartDate:    t.StartDate,
		DueDate:      t.DueDate,
		Repo:         t.Repo,
		Branch:       t.Branch,
	}
	if t.AcceptanceCriteria != nil {
		p.AcceptanceCriteria = t.AcceptanceCriteria
	}
	return p
}

// extractRelationships returns the relationship descriptors from a task's
// eager-loaded edges. It only looks at SourceRelationships to avoid counting
// each relationship twice (once from each side).
func extractRelationships(t *ent.Task) []store.ImportRelationship {
	var rels []store.ImportRelationship
	for _, rel := range t.Edges.SourceRelationships {
		rels = append(rels, store.ImportRelationship{
			ID:           rel.ID,
			SourceTaskID: rel.SourceTaskID,
			TargetTaskID: rel.TargetTaskID,
			Type:         rel.Type,
		})
	}
	return rels
}

// createRelationshipViaUpdate creates a relationship in the ephemeral store
// using UpdateTask, since the Store interface does not expose a direct
// CreateRelationship method.
//
// For graph-relevant types (blocks / blocked_by) it creates BOTH the original
// relationship AND its complement so that graph handlers, which may look at
// only one direction (e.g. SourceRelationships with type "blocks"), work
// correctly.
func createRelationshipViaUpdate(ctx context.Context, s store.Store, rel store.ImportRelationship) error {
	switch rel.Type {
	case relationship.TypeBlocks:
		// Source blocks Target: create "blocks" from Source and "blocked_by" from Target.
		_, err := s.UpdateTask(ctx, rel.SourceTaskID, store.UpdateTaskParams{
			AddBlocks: []uuid.UUID{rel.TargetTaskID},
		}, uuid.Nil)
		if err != nil {
			return err
		}
		_, err = s.UpdateTask(ctx, rel.TargetTaskID, store.UpdateTaskParams{
			AddBlockedBy: []uuid.UUID{rel.SourceTaskID},
		}, uuid.Nil)
		return err
	case relationship.TypeBlockedBy:
		// Source blocked_by Target: create "blocked_by" from Source and "blocks" from Target.
		_, err := s.UpdateTask(ctx, rel.SourceTaskID, store.UpdateTaskParams{
			AddBlockedBy: []uuid.UUID{rel.TargetTaskID},
		}, uuid.Nil)
		if err != nil {
			return err
		}
		_, err = s.UpdateTask(ctx, rel.TargetTaskID, store.UpdateTaskParams{
			AddBlocks: []uuid.UUID{rel.SourceTaskID},
		}, uuid.Nil)
		return err
	default:
		// relates_to, duplicates, etc. are not relevant for graph queries.
		return nil
	}
}

// ephemeralCollectionID returns the ID of the first collection in the ephemeral
// store. This is used to scope graph queries to the correct ephemeral collection.
func ephemeralCollectionID(ctx context.Context, s store.Store) (uuid.UUID, error) {
	colls, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Limit: 1})
	if err != nil || len(colls) == 0 {
		return uuid.Nil, fmt.Errorf("no ephemeral collection found: %w", err)
	}
	return colls[0].ID, nil
}

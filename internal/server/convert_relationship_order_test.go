package server

import (
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

func TestTaskToProtoSortsRelationshipsForStablePollPayloads(t *testing.T) {
	rootID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	collectionID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	blockedByAID := uuid.MustParse("00000000-0000-0000-0000-000000000010")
	blockedByZID := uuid.MustParse("00000000-0000-0000-0000-000000000030")
	blocksBID := uuid.MustParse("00000000-0000-0000-0000-000000000020")
	blocksCID := uuid.MustParse("00000000-0000-0000-0000-000000000040")

	got := taskToProto(&ent.Task{
		ID:           rootID,
		Title:        "relationship order",
		Phase:        task.PhaseOpen,
		Stage:        task.StageAccepted,
		CollectionID: collectionID,
		CreatedAt:    time.Unix(1, 0).UTC(),
		UpdatedAt:    time.Unix(1, 0).UTC(),
		Edges: ent.TaskEdges{
			SourceRelationships: []*ent.Relationship{
				{Type: relationship.TypeBlockedBy, TargetTaskID: blockedByZID},
				{Type: relationship.TypeBlocks, TargetTaskID: blocksCID},
				{Type: relationship.TypeBlockedBy, TargetTaskID: blockedByAID},
				{Type: relationship.TypeBlocks, TargetTaskID: blocksBID},
			},
		},
	})

	want := []struct {
		typ      pb.RelationshipType
		targetID string
	}{
		{pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKS, blocksBID.String()},
		{pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKS, blocksCID.String()},
		{pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKED_BY, blockedByAID.String()},
		{pb.RelationshipType_RELATIONSHIP_TYPE_BLOCKED_BY, blockedByZID.String()},
	}
	if len(got.GetRelationships()) != len(want) {
		t.Fatalf("relationships length = %d, want %d: %v", len(got.GetRelationships()), len(want), got.GetRelationships())
	}
	for i, rel := range got.GetRelationships() {
		if rel.GetType() != want[i].typ || rel.GetTargetTaskId() != want[i].targetID {
			t.Fatalf("relationships[%d] = (%v, %s), want (%v, %s); all=%v",
				i, rel.GetType(), rel.GetTargetTaskId(), want[i].typ, want[i].targetID, got.GetRelationships())
		}
	}
}

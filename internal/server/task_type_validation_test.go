package server_test

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── #194 round 8: req.Type shape validation ──
//
// Every other caller-supplied task field is validated at the RPC boundary —
// name for blankness and length, description for length, stage and priority
// against their enums. Type was validated for nothing at all: it went from the
// wire, through the store, into the label mapper.
//
// What is NOT checked here, deliberately, is membership in a set of known
// types. There is no such set the server can know: the Ent schema declares type
// as an open string so native collections can use arbitrary types, and on a
// GitHub collection the valid set is the operator's github.labels.types. The
// destructive consequence of an unrepresentable type is fixed where the
// knowledge lives, in LabelMapper.TypeLabelSwap.
//
// The over-long bound matters independently of any of that: 128 runes is the
// difference between a category name and an unbounded caller-controlled string
// reaching the store, the label mapper and every event payload downstream.

const testMaxTaskTypeLength = 128

func TestRPC_TaskType_ShapeIsValidated(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)
	longType := stringOfLength(testMaxTaskTypeLength + 1)

	rejected := []struct {
		name string
		typ  string
	}{
		{"blank but not empty", "   "},
		{"tab only", "\t"},
		{"too long", longType},
	}

	for _, tt := range rejected {
		t.Run("create/"+tt.name, func(t *testing.T) {
			typ := tt.typ
			_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
				CollectionId: collID,
				Name:         "type shape " + tt.name,
				Type:         &typ,
			})
			requireInvalidArgument(t, err, tt.typ)
		})
	}

	// UpdateTask is a separate req.Type block in a separate RPC, so it needs
	// its own rows: wiring the validator into one and not the other was the
	// original shape of this finding.
	base, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "type shape update target",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	for _, tt := range rejected {
		t.Run("update/"+tt.name, func(t *testing.T) {
			typ := tt.typ
			_, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
				Id:   base.GetId(),
				Type: &typ,
			})
			requireInvalidArgument(t, err, tt.typ)
		})
	}

	// InsertTasksAfter is the THIRD path that builds a CreateTaskParams from a
	// caller-supplied type, and it is the one that is easy to forget: the type
	// arrives on a nested step message rather than on the request. Validating
	// two of the three write paths is the shape this finding already had once.
	for _, tt := range rejected {
		t.Run("insert_after/"+tt.name, func(t *testing.T) {
			typ := tt.typ
			_, err := client.InsertTasksAfter(ctx, &pb.InsertTasksAfterRequest{
				AnchorTaskId: base.GetId(),
				CollectionId: collID,
				Steps: []*pb.NewTaskSpec{{
					Name: "inserted step",
					Type: &typ,
				}},
			})
			requireInvalidArgument(t, err, tt.typ)
		})
	}
}

// TestRPC_TaskType_LegitimateValuesStillWork is the positive control. Without
// it the assertions above would pass against a server that rejected every type,
// including the empty string that means "clear the type" and the ordinary
// values every existing caller sends.
func TestRPC_TaskType_LegitimateValuesStillWork(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	accepted := []struct {
		name string
		typ  string
	}{
		{"ordinary", "bug"},
		{"empty clears the type", ""},
		{"exactly at the limit", stringOfLength(testMaxTaskTypeLength)},
		// A type this store cannot map to a label is still a valid value for a
		// native collection, and the validator must not become the allow-list
		// its doc comment says it is not.
		{"unrepresentable but well-formed", "totally-unknown-type"},
	}

	for _, tt := range accepted {
		t.Run(tt.name, func(t *testing.T) {
			typ := tt.typ
			created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
				CollectionId: collID,
				Name:         "type control " + tt.name,
				Type:         &typ,
			})
			if err != nil {
				t.Fatalf("CONTROL BROKEN: CreateTask(type=%q) was rejected: %v", tt.typ, err)
			}
			if created.GetType() != tt.typ {
				t.Errorf("type = %q, want %q: the value was accepted but not stored",
					created.GetType(), tt.typ)
			}

			updated, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
				Id:   created.GetId(),
				Type: &typ,
			})
			if err != nil {
				t.Fatalf("CONTROL BROKEN: UpdateTask(type=%q) was rejected: %v", tt.typ, err)
			}
			if updated.GetType() != tt.typ {
				t.Errorf("after update type = %q, want %q", updated.GetType(), tt.typ)
			}
		})
	}
}

func requireInvalidArgument(t *testing.T, err error, typ string) {
	t.Helper()
	if err == nil {
		t.Fatalf("type %q was accepted, want InvalidArgument", typ)
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("got a non-gRPC error %v, want a status error", err)
	}
	if st.Code() != codes.InvalidArgument {
		t.Errorf("code = %v (%s), want InvalidArgument", st.Code(), st.Message())
	}
}

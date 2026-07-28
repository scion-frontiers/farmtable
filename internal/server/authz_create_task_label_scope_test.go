package server_test

import (
	"context"
	"fmt"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
)

// ── B1 / audit A-1: CreateTask was the fifth verb with the same root ──

// TestCreateTask_TerminalStageLabelCostsWhatTheTerminalStageCosts closes the
// residual round 5 disclosed and pinned here (audit A-1, #194 round 6 B1).
//
// The residual: CreateTask passed req.labels straight through to the new GitHub
// issue and nothing inspected them, so on a bare task:write token
//
//	CreateTask(stage=completed)             -> DENIED, needs task:close
//	CreateTask(labels=[ft:stage/completed]) -> ALLOWED, resulting stage completed
//	remove_labels to undo it                -> DENIED, needs task:accept
//
// and it was ONE-WAY: reaching the terminal state cost task:write, leaving it
// cost a scope the caller does not hold.
//
// THIS IS A DIFFERENTIAL, not a list of expected scope names. For each terminal
// stage it asks the SAME question through both verbs — the stage field and the
// label spelling — and requires the two answers to match. That is invariant 1
// stated as a measurement, and it is deliberately not written as
// `want: "task:close"`: a table of literals would keep passing if
// TransitionScope itself were weakened, because the literals and the gate would
// have been changed together by whoever weakened it. Asking both doors about
// the same destination cannot pass that way — one door has to disagree.
func TestCreateTask_TerminalStageLabelCostsWhatTheTerminalStageCosts(t *testing.T) {
	for _, tc := range []struct {
		name  string
		stage task.Stage
		proto pb.TaskStage
	}{
		{"completed", task.StageCompleted, pb.TaskStage_TASK_STAGE_COMPLETED},
		{"wont_fix", task.StageWontFix, pb.TaskStage_TASK_STAGE_WONT_FIX},
		{"duplicate", task.StageDuplicate, pb.TaskStage_TASK_STAGE_DUPLICATE},
		{"cancelled", task.StageCancelled, pb.TaskStage_TASK_STAGE_CANCELLED},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// DOOR 1, the stage field. Round 5 already gated this; it is the
			// reference answer, measured rather than assumed.
			f := openIssue(t, stageLabel(task.StageAccepted))
			st := tc.proto
			_, stageErr := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
				CollectionId: f.collID.String(), Name: "direct", Stage: &st,
			})
			if stageErr == nil {
				t.Fatalf("CreateTask(stage=%s) was ALLOWED on a bare task:write token. "+
					"The reference door is open, so this test can no longer establish "+
					"anything about the label door", tc.stage)
			}
			stageScope := deniedScope(t, stageErr, fmt.Sprintf("CreateTask(stage=%s)", tc.stage))

			// DOOR 2, the label spelling of the same destination. Must cost the
			// same as door 1 or the bypass is still open.
			f2 := openIssue(t, stageLabel(task.StageAccepted))
			_, labelErr := f2.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
				CollectionId: f2.collID.String(), Name: "via labels",
				Labels: []string{stageLabel(tc.stage)},
			})
			if labelErr == nil {
				t.Fatalf("CreateTask(labels=[%s]) was ALLOWED on a bare task:write token while "+
					"CreateTask(stage=%s) required %q. The label spelling still reaches a "+
					"terminal stage the stage field is gated to prevent (audit A-1)",
					stageLabel(tc.stage), tc.stage, stageScope)
			}
			labelScope := deniedScope(t, labelErr,
				fmt.Sprintf("CreateTask(labels=[%s])", stageLabel(tc.stage)))

			if labelScope != stageScope {
				t.Errorf("the two doors to stage=%s disagree: stage field costs %q, label "+
					"spelling costs %q. Invariant 1 requires every write path to the value "+
					"authorization reads to be guarded by the SAME authorization",
					tc.stage, stageScope, labelScope)
			}

			// And nothing was created. A denial that still wrote the issue
			// would be a denial in name only.
			if got := f2.issue.createdIssues(); len(got) != 0 {
				t.Errorf("denied CreateTask still issued %d createIssue mutation(s): %v",
					len(got), got)
			}
		})
	}
}

// TestCreateTask_OrdinaryLabelsAndAuthorizedTerminalsStillWork is the positive
// control for the test above, and it is the reason a green result there means
// anything.
//
// A CreateTask gate that simply refused every request carrying labels would
// satisfy every cell of the differential. These rows are the ones that must
// still be ALLOWED, so a gate that over-denies fails here.
func TestCreateTask_OrdinaryLabelsAndAuthorizedTerminalsStillWork(t *testing.T) {
	closerScopes := withScope(server.ScopeTaskClose)

	t.Run("an ordinary non-stage label is free on task:write", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		if _, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
			CollectionId: f.collID.String(), Name: "ordinary", Labels: []string{"bug"},
		}); err != nil {
			t.Fatalf("CreateTask(labels=[bug]) was DENIED on task:write (%v). The gate is "+
				"charging for a label that names no lifecycle stage, which denies "+
				"legitimate work", err)
		}
		// The create really happened, and it really carried the label — asked
		// of the create mutation itself, not of the shared issue's label set,
		// so a later update could not satisfy this.
		creates := f.issue.createdIssues()
		if len(creates) != 1 {
			t.Fatalf("got %d createIssue mutations, want 1: %v", len(creates), creates)
		}
		if !containsLabel(creates[0], "bug") {
			t.Errorf("createIssue asked for labels %v, want it to include \"bug\"", creates[0])
		}
	})

	t.Run("a terminal stage label is allowed when the caller holds task:close", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		if _, err := f.svc.CreateTask(scopedCtx(closerScopes), &pb.CreateTaskRequest{
			CollectionId: f.collID.String(), Name: "authorized terminal",
			Labels: []string{stageLabel(task.StageCompleted)},
		}); err != nil {
			t.Fatalf("CreateTask(labels=[%s]) was DENIED for a caller holding task:close (%v). "+
				"The gate must charge the scope, not forbid the operation",
				stageLabel(task.StageCompleted), err)
		}
		creates := f.issue.createdIssues()
		if len(creates) != 1 {
			t.Fatalf("got %d createIssue mutations, want 1: %v", len(creates), creates)
		}
		if !containsLabel(creates[0], stageLabel(task.StageCompleted)) {
			t.Errorf("createIssue asked for labels %v, want it to include %q",
				creates[0], stageLabel(task.StageCompleted))
		}
	})

	t.Run("no labels at all is free on task:write", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		if _, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
			CollectionId: f.collID.String(), Name: "plain",
		}); err != nil {
			t.Fatalf("plain CreateTask was DENIED on task:write: %v", err)
		}
	})
}

// TestCreateTask_NativeCollectionIsUnaffectedByTheLabelGate pins that the B1
// gate is inert where it should be.
//
// A native Ent collection keeps the stage in its own column and EntStore does
// not implement store.LifecycleStageSetStager, so store.LabelDeltaLifecycleStages
// reports before == after and the gate charges nothing. A label named
// "ft:stage/completed" on a native task is just a string.
//
// This is worth pinning rather than reasoning about because the gate reads a
// caller-supplied label and the cost of getting it wrong is denying every
// labelled create on the default backend.
func TestCreateTask_NativeCollectionIsUnaffectedByTheLabelGate(t *testing.T) {
	ctx := context.Background()
	entStore, cleanup := testutil.NewTestStore(t)
	t.Cleanup(cleanup)
	ms := store.NewMultiStore(entStore)
	t.Cleanup(func() { _ = ms.Close() })

	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{Name: "native"})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	svc := server.NewFarmTableService(ms, "test")

	if _, err := svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
		CollectionId: coll.ID.String(), Name: "native task",
		Labels: []string{stageLabel(task.StageCompleted)},
	}); err != nil {
		t.Fatalf("CreateTask with a stage-shaped label on a NATIVE collection was DENIED (%v). "+
			"No label can forge a native task's stage, so the gate must be inert here", err)
	}
}

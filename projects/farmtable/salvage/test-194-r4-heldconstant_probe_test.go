//go:build ignore_in_salvage

// test-194-r4-heldconstant_probe_test.go — #194 round-4 TEST REVIEW probe.
//
// Salvage copy. To run: drop into internal/server/ as
// zz_r4_heldconstant_probe_test.go, DELETE the build tag line above, then
//
//	go test ./internal/server/ -run 'TestProbeR4' -v -count=1
//
// It reuses newTerminalLabelledService / scopedCtx / agentScopes / stageLabel
// from authz_terminal_reopen_test.go, so it must live in that package.
//
// PURPOSE (charge 5 of the round-4 brief). The round-3 legs both recorded the
// four triage cells as safe because the audit's PoC held the DESTINATION
// constant at `accepted`, making a whole row of the space invisible. This probe
// looks for the same shape in the round-4 matrix: dimensions that are held
// constant so that a row cannot be seen.
//
// Dimensions the round-4 server matrix holds constant:
//
//	1. destination stage `working`   — excluded by reopenDestinations() on the
//	                                   stated grounds that UpdateTask rejects it
//	                                   up front. R1 tests that justification.
//	2. destination stage TERMINAL    — excluded silently; reopenDestinations()
//	                                   lists only non-terminal stages and the
//	                                   doc comment does not say terminal
//	                                   destinations were considered. R2/R3.
//	3. mask is never a second
//	   TERMINAL label                — disclosed as inexpressible in the SCHEMA
//	                                   comment. R3 measures what that hides.
//
// R3 corroborates KNOWN RESIDUAL R-B from the shared brief. It is NOT filed as
// a new finding; it is measured so the round-5 control can be sized.

package server_test

import (
	"strings"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// R1 — the `working` destination is excluded from reopenDestinations() with a
// stated justification. If that justification stopped holding, the matrix would
// silently lose a row rather than fail. Assert it.
func TestProbeR4_WorkingDestinationIsRejectedBeforeTheScopeGate(t *testing.T) {
	for _, labels := range [][]string{
		{stageLabel(task.StageWontFix)},
		{stageLabel(task.StageWontFix), stageLabel(task.StageAccepted)},
	} {
		svc, _, taskID, _, issue := newTerminalLabelledService(t, labels...)
		stage := pb.TaskStage_TASK_STAGE_WORKING
		_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
			Id: taskID, Stage: &stage,
		})
		st, _ := status.FromError(err)
		t.Logf("labels=%v -> working : code=%v msg=%q labels-after=%v",
			labels, st.Code(), st.Message(), issue.currentLabels())
		if st.Code() != codes.InvalidArgument {
			t.Errorf("FINDING: reopenDestinations() excludes `working` because UpdateTask is "+
				"supposed to reject it with InvalidArgument before the scope gate. For %v it "+
				"returned %v instead, so that exclusion is now hiding a live row", labels, st.Code())
		}
	}
}

// R2 — a TERMINAL destination from a masked terminal source. Not in the matrix
// and not mentioned in its SCHEMA comment. Moving wont_fix -> completed is a
// close and must cost task:close, whatever else is labelled on the issue.
func TestProbeR4_TerminalDestinationFromMaskedTerminalSource(t *testing.T) {
	for _, labels := range [][]string{
		{stageLabel(task.StageWontFix)},
		{stageLabel(task.StageWontFix), stageLabel(task.StageAccepted)},
		{stageLabel(task.StageWontFix), stageLabel(task.StageWorking)},
	} {
		svc, _, taskID, _, _ := newTerminalLabelledService(t, labels...)
		stage := pb.TaskStage_TASK_STAGE_COMPLETED // different terminal stage
		_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
			Id: taskID, Stage: &stage,
		})
		st, _ := status.FromError(err)
		t.Logf("labels=%v -> completed : code=%v msg=%q", labels, st.Code(), st.Message())
		if st.Code() != codes.PermissionDenied || !strings.Contains(st.Message(), server.ScopeTaskClose) {
			t.Errorf("FINDING: %v -> completed with an agent token gave %v (%s); closing must "+
				"require %q", labels, st.Code(), st.Message(), server.ScopeTaskClose)
		}
	}
}

// R3 — the from == to short-circuit reached with a SECOND TERMINAL label. This
// is KNOWN RESIDUAL R-B, measured rather than re-filed. The tiebreak returns
// `completed` first, so an actor who can put ft:stage/completed on the issue
// can then set stage=completed for task:write.
//
// The point for the TEST review is that the round-4 server matrix cannot
// express this row at all: masks are non-terminal by construction, and
// reopenDestinations() has no terminal entries. It is disclosed in prose in the
// project log and in the SCHEMA comment, and NOT pinned by any cell.
func TestProbeR4_MultiTerminalFromEqualsTo(t *testing.T) {
	// Two terminal labels already present.
	svc, _, taskID, _, issue := newTerminalLabelledService(t,
		stageLabel(task.StageWontFix), stageLabel(task.StageCompleted))
	stage := pb.TaskStage_TASK_STAGE_COMPLETED
	_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID, Stage: &stage,
	})
	t.Logf("[wont_fix completed] -> completed with task:write only: err=%v labels-after=%v",
		err, issue.currentLabels())
	if err == nil {
		t.Logf("R-B CONFIRMED (disclosed residual): the tiebreak picked `completed`, from == to " +
			"short-circuited to task:write, and the maintainer's wont_fix label was swapped away " +
			"by the write. No cell in the round-4 matrix covers this shape.")
	}

	// And the self-service form: reach it from a single wont_fix label using
	// nothing but task:write. This is R-A + R-B composed.
	svc2, _, taskID2, _, issue2 := newTerminalLabelledService(t, stageLabel(task.StageWontFix))
	dest := pb.TaskStage_TASK_STAGE_COMPLETED
	if _, err := svc2.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID2, Stage: &dest,
	}); err == nil {
		t.Fatal("precondition failed: wont_fix -> completed was already allowed with task:write")
	}
	if _, err := svc2.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID2, AddLabels: []string{stageLabel(task.StageCompleted)},
	}); err != nil {
		t.Fatalf("AddLabels failed: %v", err)
	}
	t.Logf("after AddLabels: %v", issue2.currentLabels())
	_, err2 := svc2.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID2, Stage: &dest,
	})
	t.Logf("step 2 (wont_fix+completed -> completed, task:write only): err=%v labels-after=%v",
		err2, issue2.currentLabels())
}

package server

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestBasicAvailabilityForTask_OwnTerminalStageBlocksClaim asserts the server's
// basic availability projection, used when the routed store cannot compute
// availability itself. This is about the task's OWN stage being terminal, not
// about terminal blockers satisfying dependencies.
func TestBasicAvailabilityForTask_OwnTerminalStageBlocksClaim(t *testing.T) {
	for _, stage := range []task.Stage{
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			availability := basicAvailabilityForTask(&ent.Task{
				Phase: task.PhaseClosed,
				Stage: stage,
			})
			if availability.Available {
				t.Fatalf("available = true, want false; reasons = %v", availability.Reasons)
			}
			if len(availability.Reasons) != 1 || availability.Reasons[0] != store.AvailabilityReasonTerminal {
				t.Fatalf("reasons = %v, want exactly [%s]",
					availability.Reasons, store.AvailabilityReasonTerminal)
			}
		})
	}
}

// TestBasicAvailabilityForTask_NonTerminalStagesAreNotTerminal guards the other
// side of the predicate, so a mutation that marks everything terminal is caught
// too.
func TestBasicAvailabilityForTask_NonTerminalStagesAreNotTerminal(t *testing.T) {
	for _, stage := range []task.Stage{
		task.StageAccepted,
		task.StageWorking,
		task.StageInReview,
		task.StageInQa,
		task.StageDeploying,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			availability := basicAvailabilityForTask(&ent.Task{
				Phase: task.PhaseOpen,
				Stage: stage,
			})
			for _, reason := range availability.Reasons {
				if reason == store.AvailabilityReasonTerminal {
					t.Fatalf("stage %s reported terminal; reasons = %v", stage, availability.Reasons)
				}
			}
		})
	}
}

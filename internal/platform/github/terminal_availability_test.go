package github

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim asserts the
// GitHub pass-through store's availability: a task whose OWN stage is terminal
// is unavailable and reports AvailabilityReasonTerminal.
func TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim(t *testing.T) {
	s := &GitHubPassThroughStore{}
	ctx := context.Background()

	for _, stage := range []task.Stage{
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			availability, err := s.ComputeAvailability(ctx, &ent.Task{
				Phase: task.PhaseClosed,
				Stage: stage,
			})
			if err != nil {
				t.Fatalf("ComputeAvailability: %v", err)
			}
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

// TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal guards the
// other side of the predicate, so a mutation that marks everything terminal is
// caught too.
func TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal(t *testing.T) {
	s := &GitHubPassThroughStore{}
	ctx := context.Background()

	for _, stage := range []task.Stage{
		task.StageAccepted,
		task.StageWorking,
		task.StageInReview,
		task.StageInQa,
		task.StageDeploying,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			availability, err := s.ComputeAvailability(ctx, &ent.Task{
				Phase: task.PhaseOpen,
				Stage: stage,
			})
			if err != nil {
				t.Fatalf("ComputeAvailability: %v", err)
			}
			for _, reason := range availability.Reasons {
				if reason == store.AvailabilityReasonTerminal {
					t.Fatalf("stage %s reported terminal; reasons = %v", stage, availability.Reasons)
				}
			}
		})
	}
}

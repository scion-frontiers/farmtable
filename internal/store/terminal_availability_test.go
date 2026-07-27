package store_test

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

// terminalStages is the set of stages that make a task itself unavailable.
// These tests are about the task's OWN stage, not about whether a terminal
// blocker satisfies a dependency — see
// TestComputeAvailability_TerminalDependencyMatrix for that separate property.
var terminalStages = []task.Stage{
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
	task.StageCancelled,
}

func TestIsTerminalStage_ClassifiesEveryStage(t *testing.T) {
	tests := []struct {
		stage task.Stage
		want  bool
	}{
		{task.StageTriage, false},
		{task.StageAccepted, false},
		{task.StageWorking, false},
		{task.StageInReview, false},
		{task.StageInQa, false},
		{task.StageDeploying, false},
		{task.StageCompleted, true},
		{task.StageWontFix, true},
		{task.StageDuplicate, true},
		{task.StageCancelled, true},
	}
	for _, tt := range tests {
		t.Run(tt.stage.String(), func(t *testing.T) {
			if got := store.IsTerminalStage(tt.stage); got != tt.want {
				t.Fatalf("IsTerminalStage(%s) = %v, want %v", tt.stage, got, tt.want)
			}
		})
	}
}

// TestComputeAvailability_OwnTerminalStageBlocksClaim asserts the canonical
// EntStore predicate: a task whose OWN stage is terminal is unavailable and
// reports AvailabilityReasonTerminal.
func TestComputeAvailability_OwnTerminalStageBlocksClaim(t *testing.T) {
	for _, stage := range terminalStages {
		t.Run(stage.String(), func(t *testing.T) {
			s, cleanup := testutil.NewTestStore(t)
			defer cleanup()
			ctx := context.Background()
			collID := createTestCollection(t, s)

			created, err := s.CreateTask(ctx, store.CreateTaskParams{
				Title: "Terminal", CollectionID: collID, Phase: task.PhaseOpen, Stage: task.StageAccepted,
			})
			if err != nil {
				t.Fatalf("create task: %v", err)
			}
			if _, err := s.CloseTask(ctx, created.ID, stage, "", uuid.Nil); err != nil {
				t.Fatalf("close task as %s: %v", stage, err)
			}

			closed, err := s.GetTask(ctx, created.ID)
			if err != nil {
				t.Fatalf("GetTask: %v", err)
			}
			if closed.Stage != stage {
				t.Fatalf("stage = %s, want %s", closed.Stage, stage)
			}

			availability, err := s.ComputeAvailability(ctx, closed)
			if err != nil {
				t.Fatalf("ComputeAvailability: %v", err)
			}
			assertTerminalUnavailable(t, availability)

			if _, err := s.ClaimTask(ctx, created.ID, uuid.New(), ""); err == nil {
				t.Fatalf("ClaimTask on %s task succeeded, want rejection", stage)
			}
		})
	}
}

// noComputeStore is a Store that deliberately does NOT implement
// ComputeAvailability, forcing MultiStore onto its own fallback branch.
// Embedding the interface promotes every Store method without supplying
// ComputeAvailability, so MultiStore's type assertion fails as intended.
type noComputeStore struct {
	store.Store
}

// TestMultiStoreComputeAvailability_OwnTerminalStageBlocksClaim asserts the
// MultiStore fallback branch used when the routed platform store cannot
// compute availability itself.
func TestMultiStoreComputeAvailability_OwnTerminalStageBlocksClaim(t *testing.T) {
	for _, stage := range terminalStages {
		t.Run(stage.String(), func(t *testing.T) {
			assertTerminalUnavailable(t, multiStoreFallbackAvailability(t, &ent.Task{
				Phase: task.PhaseOpen,
				Stage: stage,
			}))
		})
	}
}

// TestMultiStoreComputeAvailability_ClosedPhaseIsTerminal pins the extra arm
// that only the MultiStore fallback carries: PhaseClosed is terminal even when
// the stage is not. Without this the consolidation could silently drop it.
func TestMultiStoreComputeAvailability_ClosedPhaseIsTerminal(t *testing.T) {
	assertTerminalUnavailable(t, multiStoreFallbackAvailability(t, &ent.Task{
		Phase: task.PhaseClosed,
		Stage: task.StageAccepted,
	}))
}

// TestMultiStoreComputeAvailability_RequiresOpenAccepted pins the second thing
// unique to the MultiStore fallback: its Available result carries an extra
// "PhaseOpen && StageAccepted" conjunction, making it strictly stricter than
// the other three implementations. A task with no unavailability reasons is
// still unavailable here if it is not open+accepted.
func TestMultiStoreComputeAvailability_RequiresOpenAccepted(t *testing.T) {
	tests := []struct {
		name          string
		phase         task.Phase
		stage         task.Stage
		wantAvailable bool
	}{
		{"open accepted is available", task.PhaseOpen, task.StageAccepted, true},
		{"in progress working is not available", task.PhaseInProgress, task.StageWorking, false},
		{"open working is not available", task.PhaseOpen, task.StageWorking, false},
		{"in progress accepted is not available", task.PhaseInProgress, task.StageAccepted, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			availability := multiStoreFallbackAvailability(t, &ent.Task{
				Phase: tt.phase,
				Stage: tt.stage,
			})
			if availability.Available != tt.wantAvailable {
				t.Fatalf("available = %v, want %v; reasons = %v",
					availability.Available, tt.wantAvailable, availability.Reasons)
			}
			if !tt.wantAvailable && len(availability.Reasons) != 0 {
				t.Fatalf("reasons = %v, want empty; this case must be driven by the "+
					"open+accepted conjunction, not by a reason", availability.Reasons)
			}
		})
	}
}

// multiStoreFallbackAvailability routes t through a MultiStore whose platform
// store cannot compute availability, exercising MultiStore's own fallback.
func multiStoreFallbackAvailability(t *testing.T, target *ent.Task) store.TaskAvailability {
	t.Helper()

	primary, cleanup := testutil.NewTestStore(t)
	t.Cleanup(cleanup)

	collID := uuid.New()
	target.CollectionID = collID

	ms := store.NewMultiStore(primary)
	ms.RegisterPlatform(collID, noComputeStore{})

	availability, err := ms.ComputeAvailability(context.Background(), target)
	if err != nil {
		t.Fatalf("MultiStore.ComputeAvailability: %v", err)
	}
	return availability
}

// assertTerminalUnavailable requires that terminal be the sole reason the task
// is unavailable, so a broken terminal arm cannot be masked by another reason.
func assertTerminalUnavailable(t *testing.T, a store.TaskAvailability) {
	t.Helper()
	if a.Available {
		t.Fatalf("available = true, want false; reasons = %v", a.Reasons)
	}
	if len(a.Reasons) != 1 || a.Reasons[0] != store.AvailabilityReasonTerminal {
		t.Fatalf("reasons = %v, want exactly [%s]", a.Reasons, store.AvailabilityReasonTerminal)
	}
}

package server

import (
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/convert"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// allStages returns every task stage, derived from the proto enum so a stage
// added to the data model shows up here without touching this test.
func allStages(t *testing.T) []task.Stage {
	t.Helper()
	var stages []task.Stage
	for value, name := range pb.TaskStage_name {
		if name == pb.TaskStage_TASK_STAGE_UNSPECIFIED.String() {
			continue
		}
		stage := convert.StageFromProto(pb.TaskStage(value))
		if err := task.StageValidator(stage); err != nil {
			t.Fatalf("proto stage %s does not map to a valid task stage: %v", name, err)
		}
		stages = append(stages, stage)
	}
	return stages
}

// The stage groups behind the transition table must form a partition of every
// task stage: each stage belongs to exactly one group. A stage missing from all
// groups (a newly added one, say) would silently fall through the table to
// task:write, and a stage in two groups would make the required scope depend on
// row order in ways the policy comment does not describe.
func TestStageGroupsPartitionAllStages(t *testing.T) {
	groups := map[string]stageSet{
		"triage":   stagesTriage,
		"accepted": stagesAccepted,
		"working":  stagesWorking,
		"handoff":  stagesHandoff,
		"terminal": stagesTerminal,
	}

	membership := map[task.Stage][]string{}
	for name, set := range groups {
		for stage := range set {
			membership[stage] = append(membership[stage], name)
		}
	}

	for _, stage := range allStages(t) {
		switch got := membership[stage]; len(got) {
		case 1: // Exactly one group: correct.
		case 0:
			t.Errorf("stage %q belongs to no stage group", stage)
		default:
			t.Errorf("stage %q belongs to multiple stage groups: %v", stage, got)
		}
	}

	// Nothing in a group may be outside the data model.
	for stage := range membership {
		if err := task.StageValidator(stage); err != nil {
			t.Errorf("stage group contains unknown stage %q", stage)
		}
	}
}

// The accept gate must hold for every destination stage: the only way out of
// triage that is not task:accept is closing the task.
func TestLeavingTriageAlwaysRequiresAcceptOrClose(t *testing.T) {
	for _, to := range allStages(t) {
		if to == task.StageTriage {
			continue
		}
		want := ScopeTaskAccept
		if stagesTerminal.contains(to) {
			want = ScopeTaskClose
		}
		if got := TransitionScope(string(task.StageTriage), string(to)); got != want {
			t.Errorf("TransitionScope(triage, %q) = %q, want %q", to, got, want)
		}
	}
}

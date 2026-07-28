package github

import (
	"strings"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ── #194 round 9, review S4: allStages is unpinned ──
//
// allStages is a hand-written slice of ten task.Stage constants, and by round 9
// it decides more than "default auto-mapping" says. NewLabelMapper builds
// stageToLabel and labelToStage from it, so it is the enumeration behind
// StageToLabel, behind authorizationStage's lookup table, and — since MUST 5 —
// behind checkLifecycleKeyCollisions' notion of which labels this deployment
// owns. Nothing compared it to anything.
//
// The two directions fail differently and only one of them is loud:
//
//   - An EXTRA or MISSPELLED entry is caught by StageValidator below and would
//     surface as a label nothing else in the system recognises.
//   - A MISSING entry is silent and is the dangerous one. That stage gets no
//     stageToLabel entry, no labelToStage entry, and no place in `owned`, so a
//     priorities or types key naming it stops being rejected and the capture
//     class this round has been closing reopens for exactly that stage.

// TestAllStages_MatchesTheProtoEnum pins both directions.
//
// THE ORACLE IS A DIFFERENT AXIS, deliberately. Checking allStages against
// task.StageValidator alone only closes the first direction: StageValidator
// answers "is this string a stage?" and cannot be asked "which stages are
// there?", so a slice that dropped an entry passes it. The proto is the
// project's declared source of truth for the data model, and TaskStage_name is
// generated from it — a list produced by a different tool from a different
// file, which is what makes it able to disagree.
//
// TASK_STAGE_UNSPECIFIED is excluded: it is the proto's zero value, not a
// lifecycle stage, and task.Stage has no counterpart for it.
func TestAllStages_MatchesTheProtoEnum(t *testing.T) {
	want := make(map[task.Stage]bool)
	for _, name := range pb.TaskStage_name {
		bare := strings.ToLower(strings.TrimPrefix(name, "TASK_STAGE_"))
		if bare == "unspecified" {
			continue
		}
		want[task.Stage(bare)] = true
	}
	if len(want) == 0 {
		t.Fatal("VACUOUS: the proto enum yielded no stages, so this test compares nothing")
	}

	got := make(map[task.Stage]bool, len(allStages))
	for _, stage := range allStages {
		if got[stage] {
			t.Errorf("allStages lists %q twice", stage)
		}
		got[stage] = true

		// Direction 1: nothing in allStages is a stage the store would reject.
		if err := task.StageValidator(stage); err != nil {
			t.Errorf("allStages contains %q, which the store rejects: %v", stage, err)
		}
	}

	for stage := range want {
		if !got[stage] {
			t.Errorf("stage %q is in the proto but MISSING from allStages.\n\n"+
				"This is the silent direction. NewLabelMapper builds stageToLabel and "+
				"labelToStage from allStages, and checkLifecycleKeyCollisions builds "+
				"`owned` from them, so this deployment would neither write nor recognise "+
				"nor protect %q — and `types: {%s: chore}` would stop being rejected.",
				stage, stage, stage)
		}
	}
	for stage := range got {
		if !want[stage] {
			t.Errorf("allStages contains %q, which the proto does not declare", stage)
		}
	}
}

// TestStageToLabel_FallbackIsUnreachableForEveryValidStage records the
// consequence of the pin above, and is the honest form of a claim the round-9
// review asked to be written down rather than assumed.
//
// StageToLabel has a fallback for a stage absent from stageToLabel:
//
//	return m.pushPrefix() + "stage/" + s.String()
//
// NewLabelMapper populates stageToLabel for every stage in allStages, so with
// allStages complete that branch is DEAD for every stage the store will accept.
// It is not deletable — it is what keeps the function total, and a caller that
// reaches it with an invalid stage should get the prefix the readers require
// rather than an empty string — but it is not a behaviour anyone should be
// relying on, and it must not be the thing that silently papers over a stage
// missing from allStages.
//
// The test does not try to prove the branch is unexecuted, which Go cannot
// state. It proves the equivalent: for every valid stage the populated path and
// the fallback path AGREE, so no valid stage can tell which one it took. If
// that ever stops holding, whichever branch a stage takes starts to matter and
// the pin above becomes load-bearing in a second way.
func TestStageToLabel_FallbackIsUnreachableForEveryValidStage(t *testing.T) {
	for _, prefix := range []string{"", "ft:", "acme:", "x"} {
		cfg := DefaultConfig().GitHub.Labels
		cfg.PushPrefix = prefix
		m := NewLabelMapper(cfg)

		for _, stage := range allStages {
			populated, ok := m.stageToLabel[stage]
			if !ok {
				t.Fatalf("push_prefix %q: stage %q has no stageToLabel entry, so StageToLabel "+
					"is running on its fallback for a stage the store accepts", prefix, stage)
			}
			fallback := m.pushPrefix() + "stage/" + stage.String()
			if populated != fallback {
				t.Errorf("push_prefix %q, stage %q: table says %q, fallback would say %q.\n\n"+
					"The two paths have diverged, so which branch StageToLabel takes is now "+
					"observable and the fallback is no longer a harmless totality guard.",
					prefix, stage, populated, fallback)
			}
		}
	}
}

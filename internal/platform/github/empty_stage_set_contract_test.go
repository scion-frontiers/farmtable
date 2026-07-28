package github

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestLifecycleStageSetStager_NeverReturnsAnEmptySide is this store's half of a
// contract the OTHER package now enforces, and it exists because neither leg of
// #194 round 6 could test the pair alone.
//
// Leg B changed store.LifecycleStages and store.LabelDeltaLifecycleStages to
// return ErrEmptyLifecycleStageSet when an IMPLEMENTER hands back an empty
// side, replacing a fail-open that silently answered "no transition" and
// charged nothing. Verified against their actual code rather than a
// description of it (label-write-scope-r6b, a2cced0):
//
//	LifecycleStages:            if len(stages) == 0        -> error
//	LabelDeltaLifecycleStages:  if len(b) == 0 || len(a) == 0 -> error
//
// Strictly empty, on either side, with no len < 2 rule and no nil-versus-empty
// distinction. GitHubPassThroughStore is an implementer, so from that moment
// any input on which it returns an empty slice stops being a quiet miscount and
// becomes an Internal error on a live RPC. This asserts it has no such input.
//
// THE ONE MOST LIKELY TO, and the reason this file exists: a pass-through
// collection with label mapping DISABLED. AllTerminalLabelStages returns nil
// early when !m.enabled, deliberately, so that a mapper configured to ignore
// labels does not start honouring them. Every path below that nil has to
// supply a fallback, and there are three of them.
func TestLifecycleStageSetStager_NeverReturnsAnEmptySide(t *testing.T) {
	ctx := context.Background()

	disabled := DefaultConfig().GitHub.Labels
	disabled.Enabled = false

	configs := map[string]LabelConfig{
		"default":          DefaultConfig().GitHub.Labels,
		"mapping_disabled": disabled,
		"custom_prefix":    labelConfigWithStages("acme:", nil),
	}

	tasks := map[string]*ent.Task{
		"no_labels":            {Stage: task.StageAccepted},
		"nil_label_slice":      {Stage: task.StageAccepted, Labels: nil},
		"empty_label_slice":    {Stage: task.StageAccepted, Labels: []string{}},
		"one_terminal":         {Stage: task.StageAccepted, Labels: []string{"ft:stage/wont_fix"}},
		"two_terminal":         {Stage: task.StageAccepted, Labels: []string{"ft:stage/wont_fix", "ft:stage/duplicate"}},
		"non_stage_labels":     {Stage: task.StageAccepted, Labels: []string{"bug", "help wanted"}},
		"foreign_prefix":       {Stage: task.StageAccepted, Labels: []string{"other:stage/completed"}},
		"stock_bare_duplicate": {Stage: task.StageAccepted, Labels: []string{"duplicate"}},
	}

	// The deltas include ones that strip every label the task has, because
	// "remove everything" is the shape most likely to empty the AFTER side.
	deltas := []struct {
		name        string
		add, remove []string
	}{
		{name: "no_delta"},
		{name: "remove_all_stage_labels", remove: []string{"ft:stage/wont_fix", "ft:stage/duplicate", "ft:stage/accepted", "duplicate"}},
		{name: "add_terminal", add: []string{"ft:stage/completed"}},
		{name: "add_and_remove_the_same", add: []string{"ft:stage/completed"}, remove: []string{"ft:stage/completed"}},
	}

	for cfgName, cfg := range configs {
		for taskName, base := range tasks {
			for _, d := range deltas {
				t.Run(cfgName+"/"+taskName+"/"+d.name, func(t *testing.T) {
					s := &GitHubPassThroughStore{mapper: NewLabelMapper(cfg)}
					tk := *base // copy; the loop reuses the fixtures

					if got := s.LifecycleStages(ctx, &tk); len(got) == 0 {
						t.Errorf("LifecycleStages returned an EMPTY set. Under leg B's "+
							"a2cced0 that is no longer a silent miscount: "+
							"store.LifecycleStages turns it into "+
							"ErrEmptyLifecycleStageSet and the RPC fails Internal. "+
							"config=%s labels=%v", cfgName, tk.Labels)
					}

					before, after := s.LabelDeltaLifecycleStages(ctx, &tk, d.add, d.remove)
					if len(before) == 0 || len(after) == 0 {
						t.Errorf("LabelDeltaLifecycleStages returned an empty side: "+
							"before=%v after=%v. config=%s labels=%v add=%v remove=%v",
							before, after, cfgName, tk.Labels, d.add, d.remove)
					}
				})
			}
		}
	}
}

// TestLifecycleStageSetStager_NilMapperStillAnswers is the same contract for a
// zero-value store. LabelDeltaLifecycleStages has an explicit nil-mapper arm
// and LifecycleStages relies on AllTerminalLabelStages' own nil check, so the
// two reach the fallback by different routes and both are asserted.
func TestLifecycleStageSetStager_NilMapperStillAnswers(t *testing.T) {
	ctx := context.Background()
	s := &GitHubPassThroughStore{}
	tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:stage/wont_fix"}}

	if got := s.LifecycleStages(ctx, tk); len(got) != 1 || got[0] != task.StageAccepted {
		t.Errorf("LifecycleStages with a nil mapper = %v, want [accepted]: no mapper "+
			"means labels are not read, so the task's own stage is the answer", got)
	}
	before, after := s.LabelDeltaLifecycleStages(ctx, tk, []string{"ft:stage/completed"}, nil)
	if len(before) == 0 || len(after) == 0 {
		t.Errorf("LabelDeltaLifecycleStages with a nil mapper: before=%v after=%v, "+
			"want both non-empty", before, after)
	}
}

// TestLifecycleStageSetStager_EmptySideIsDetectable is the POSITIVE CONTROL for
// the two tests above, and it is not optional: "no input produced an empty
// set" is a claim about a search, and a search that cannot recognise its own
// target has found nothing.
//
// It does not mutate the store. It runs the same len() predicate leg B runs,
// against a value that IS empty, and requires it to fire.
func TestLifecycleStageSetStager_EmptySideIsDetectable(t *testing.T) {
	var empty []task.Stage

	if len(empty) != 0 {
		t.Fatal("CONTROL BROKEN: a nil []task.Stage does not read as empty, so the " +
			"exhaustive sweep above cannot recognise the thing it is looking for")
	}
	// And leg B's helpers treat nil and empty identically, so a nil return from
	// this store would error exactly as a zero-length one would. Asserted here
	// because "we return nil, not empty" is the obvious wrong reassurance.
	if len([]task.Stage{}) != len(empty) {
		t.Fatal("CONTROL BROKEN: nil and empty differ under len, and the " +
			"nil-versus-empty distinction the sweep assumes away is real")
	}
	if !store.IsTerminalStage(task.StageWontFix) {
		t.Fatal("CONTROL BROKEN: the store package this test reasons about is not " +
			"the one linked here")
	}
}

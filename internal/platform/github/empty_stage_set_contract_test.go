package github

import (
	"context"
	"testing"

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
//
// WHAT THESE 96 CELLS ARE, restated honestly (#194 round 7, T-F3). Read as a
// SEARCH they are already finished: every return in LifecycleStages,
// LabelDeltaLifecycleStages and lifecycleStagesForLabels is either a
// `[]task.Stage{...}` literal of length one or a slice already guarded by
// `len(...) > 0`, so no input can empty either side. VERIFIED by reading
// passthrough.go at 6ced24e, not assumed. They are kept as a REGRESSION
// TRIPWIRE on those guards, which is a claim that can be measured: deleting the
// `len(stages) > 0` guard from LifecycleStages turns this test RED. Sweeping a
// domain whose answer is currently constant is worth 96 cheap cells precisely
// because the constant is maintained by three separate two-line guards and
// nothing in the type system holds them there.
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
// the two tests above: "no input produced an empty set" is a claim about a
// search, and a search that cannot recognise its own target has found nothing.
//
// WHAT THIS TEST USED TO BE, and why it was rewritten (#194 round 7, T-F3). It
// asserted `len(nil) != 0` and `len([]task.Stage{}) != len(nil)`. Those are Go
// language guarantees. It exercised one line of package code — a
// store.IsTerminalStage linkage check — and nothing at all from the sweep's
// subject, so no defect in this package could turn it red and it licensed a
// 96-cell sweep on the strength of a tautology.
//
// WHAT IT IS NOW. The empty value the sweep hunts is not hypothetical and it is
// not a language fact: AllTerminalLabelStages returns nil for any label set
// naming no terminal stage, which is most of the sweep's fixtures. Both
// GitHubPassThroughStore.LifecycleStages and lifecycleStagesForLabels stand a
// `len(...) > 0` guard between that nil and their return, and substitute a
// one-element fallback. So the sweep's green is the GUARD WORKING, not the
// empty value being unreachable in principle — and this control measures
// exactly that difference:
//
//	part 1: the package really does produce an empty set, on the sweep's inputs
//	part 2: on the SAME input, the store returns a non-empty answer
//
// MEASURED, so the two parts are not decoration. Making AllTerminalLabelStages
// return a non-empty slice instead of nil turns part 1 RED; deleting the
// `len(stages) > 0` guard from LifecycleStages turns part 2 RED. Both mutations
// left the old version of this test GREEN.
//
// It still does not mutate the store, and it asserts nothing about
// authorization.
func TestLifecycleStageSetStager_EmptySideIsDetectable(t *testing.T) {
	ctx := context.Background()
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	// PART 1. Real package code, real empty result, checked with the same len()
	// predicate leg B's helpers use. These are label sets the sweep above
	// actually drives, not invented ones.
	emptyProducing := [][]string{
		nil,
		{},
		{"bug", "help wanted"},    // no stage meaning at all
		{"duplicate"},             // names a terminal stage, but bare: not ours (B6)
		{"other:stage/completed"}, // prefixed, but not OUR prefix
		{"ft:stage/accepted"},     // ours, but not terminal
	}
	for _, labels := range emptyProducing {
		got := m.AllTerminalLabelStages(labels)
		if len(got) != 0 {
			t.Fatalf("CONTROL BROKEN: AllTerminalLabelStages(%v) = %v, want empty.\n\n"+
				"The sweep above is a search for an empty lifecycle stage set. If this "+
				"package no longer produces one anywhere, the sweep is searching for "+
				"something that does not exist and its green says nothing", labels, got)
		}
	}

	// PART 2. The same input through the store. A non-empty answer here is the
	// guard doing its job on top of the nil measured above; if this ever
	// returned empty, the sweep would be reporting a live contract violation
	// rather than a suppressed one.
	for _, labels := range emptyProducing {
		s := &GitHubPassThroughStore{mapper: m}
		tk := &ent.Task{Stage: task.StageAccepted, Labels: labels}

		got := s.LifecycleStages(ctx, tk)
		if len(got) != 1 || got[0] != task.StageAccepted {
			t.Fatalf("CONTROL BROKEN: LifecycleStages(labels=%v) = %v, want [accepted].\n\n"+
				"Part 1 showed AllTerminalLabelStages returns empty for this input, so "+
				"the sweep's green depends entirely on the len(...) > 0 fallback in "+
				"LifecycleStages substituting the task's own stage. That substitution is "+
				"no longer happening", labels, got)
		}
	}
}

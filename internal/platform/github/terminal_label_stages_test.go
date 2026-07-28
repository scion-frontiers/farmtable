package github

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestStageLabelSwap_DoesNotDeleteAHumansStockLabel is the INVERSION of a
// round-5 measurement, performed in round 6 exactly as that measurement asked
// for. Kept under a renamed function rather than deleted, because the history
// is the useful part.
//
// WHAT IT SAID IN ROUND 5, as
// TestStageLabelSwap_StillDeletesAHumansStockLabel: the audit claimed, from
// unit-level evidence it declined to extend, that requiring the configured
// prefix for authorization inputs would also fix its F7. Measured answer: it
// did not. B6 changed the two READERS, where authorization answers come from.
// StageLabelSwap is a WRITER and went on deciding "is this one of ours?" with
// the prefix-tolerant stripForMatch, so a stock "duplicate" was still deleted
// when the task moved to working. That test pinned the open bug so the audit's
// claim could not be carried forward unverified, and instructed whoever fixed
// F7 to invert it.
//
// WHAT ROUND 6 DID: StageLabelSwap now asks authorizationStage, the same
// predicate the readers ask. The measurement stands as a REGRESSION GUARD in
// the opposite direction. Nothing about the round-5 finding was wrong; the
// behaviour it recorded has changed, which is the outcome a pinned measurement
// is for.
//
// The round-5 log entry is amended accordingly — see
// .design/project-log/close-label-swap-r5-label-write-scope.md and the round-6
// leg-A entry.
func TestStageLabelSwap_DoesNotDeleteAHumansStockLabel(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	add, remove := m.StageLabelSwap([]string{"duplicate", "bug"}, task.StageWorking)

	// BASELINE, unchanged from round 5: the swap must still be DOING something,
	// or "removed nothing" is a disabled function rather than a scoped one.
	if len(add) != 1 || add[0] != "ft:stage/working" {
		t.Fatalf("BASELINE BROKEN: add = %v, want [ft:stage/working]; the swap is not doing "+
			"the thing whose side effect is being measured", add)
	}

	for _, l := range remove {
		if l == "duplicate" {
			t.Errorf("F7 HAS REGRESSED: StageLabelSwap removed the stock GitHub label "+
				"\"duplicate\" (remove = %v). Farm Table does not read that label as a "+
				"terminal assertion because it is not ours; deleting it is the same "+
				"ownership question answered the opposite way, destructively.", remove)
		}
		if l == "bug" {
			t.Errorf("StageLabelSwap removed the non-stage label \"bug\" (remove = %v); "+
				"that is a larger bug than F7 ever was", remove)
		}
	}

	// The contrast that localises it, kept from round 5 and now pointing the
	// same way in both halves: one label, one answer, in one mapper.
	if _, ok := m.TerminalLabelStage([]string{"duplicate"}); ok {
		t.Fatalf("TerminalLabelStage reads the stock \"duplicate\" as terminal; B6 did " +
			"not land, and the writer-side assertion above is meaningless without it")
	}
}

// TestAllTerminalLabelStages_ReportsEveryPresentStageDeterministically pins the
// two properties the seam exists for.
//
// It must report ALL present terminal stages, because an authorization decision
// must not depend on which of several equally present values a tiebreak
// selects; and it must do so in a fixed order, because map iteration order is
// randomised and an authorization answer that differs run to run for one
// unchanged issue is not an answer.
func TestAllTerminalLabelStages_ReportsEveryPresentStageDeterministically(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	cases := []struct {
		name   string
		labels []string
		want   []task.Stage
	}{
		{"none", []string{"ft:stage/accepted", "bug"}, nil},
		{"one", []string{"ft:stage/wont_fix"}, []task.Stage{task.StageWontFix}},
		{
			"two_in_either_input_order",
			[]string{"ft:stage/wont_fix", "ft:stage/completed"},
			[]task.Stage{task.StageCompleted, task.StageWontFix},
		},
		{
			"reversed_input_gives_the_same_answer",
			[]string{"ft:stage/completed", "ft:stage/wont_fix"},
			[]task.Stage{task.StageCompleted, task.StageWontFix},
		},
		{
			"all_four_masked_by_a_non_terminal_label",
			[]string{
				"ft:stage/cancelled", "ft:stage/working", "ft:stage/duplicate",
				"ft:stage/completed", "ft:stage/wont_fix",
			},
			[]task.Stage{
				task.StageCancelled, task.StageCompleted, task.StageDuplicate, task.StageWontFix,
			},
		},
		{"duplicated_label_is_reported_once", []string{"ft:stage/completed", "FT:STAGE/COMPLETED"},
			[]task.Stage{task.StageCompleted}},
		// B6: unprefixed spellings contribute nothing, whatever else is present.
		{"bare_stock_label_alone", []string{"duplicate"}, nil},
		{
			"bare_label_beside_a_prefixed_one",
			[]string{"duplicate", "ft:stage/wont_fix"},
			[]task.Stage{task.StageWontFix},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := m.AllTerminalLabelStages(tc.labels)
			if len(got) != len(tc.want) {
				t.Fatalf("AllTerminalLabelStages(%v) = %v, want %v", tc.labels, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("AllTerminalLabelStages(%v) = %v, want %v (order is part of the "+
						"contract: it must not vary run to run)", tc.labels, got, tc.want)
				}
			}
		})
	}
}

// TestAllTerminalLabelStages_IsSilentWhenLabelMappingIsOff mirrors
// TerminalLabelStage's guard. With mapping disabled IssueToPhaseStage declines
// to read labels at all, so scanning them here would make a disabled mapper
// start honouring labels it is configured to ignore.
func TestAllTerminalLabelStages_IsSilentWhenLabelMappingIsOff(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.Enabled = false
	m := NewLabelMapper(cfg)

	if got := m.AllTerminalLabelStages([]string{"ft:stage/completed"}); got != nil {
		t.Fatalf("a disabled mapper reported %v", got)
	}

	var nilMapper *LabelMapper
	if got := nilMapper.AllTerminalLabelStages([]string{"ft:stage/completed"}); got != nil {
		t.Fatalf("a nil mapper reported %v; callers reach this from ComputeAvailability, "+
			"which is total on a zero-value store", got)
	}
}

// TestAuthorizationStage_IsSilentWhenLabelMappingIsOff pins the round-9 ruling
// (MUST 5) at the level it is stated: github.labels.enabled=false removes
// lifecycle-label AUTHORITY, not merely lifecycle-label writes.
//
// WHY THIS IS A UNIT TEST AND NOT AN END-TO-END ONE, stated because the
// distinction is the honest part. There is no integration path that reaches
// authorizationStage with a non-empty label while the toggle is off: every
// caller that can reach a privilege decision already short-circuits on
// !m.enabled, and the one that does not (assertStageWriteAllowed) is handed
// empty lists by those same short-circuits. MEASURED (#194 r9): adding the
// guard changed no test in the repository, and removing it changes none
// either. So this test is the ONLY thing that makes the guard observable, and
// deleting it returns the rule to being unenforced.
//
// The enabled=true half is not decoration: without it a mapper that answered
// ("", false) for everything would pass, which is the degenerate oracle that
// cost round 6 a whole test file.
func TestAuthorizationStage_IsSilentWhenLabelMappingIsOff(t *testing.T) {
	own := defaultPushPrefix + "stage/completed"

	on := DefaultConfig().GitHub.Labels
	on.Enabled = true
	if stage, ok := NewLabelMapper(on).authorizationStage(own); !ok || stage != task.StageCompleted {
		t.Fatalf("CONTROL BROKEN: enabled mapper reads %q as (%q, %v), want (completed, true). "+
			"Without this the off-case below would pass for the wrong reason",
			own, stage, ok)
	}

	off := DefaultConfig().GitHub.Labels
	off.Enabled = false
	if stage, ok := NewLabelMapper(off).authorizationStage(own); ok {
		t.Fatalf("a disabled mapper read %q as an assertion of stage %q.\n\n"+
			"With label mapping off this deployment neither writes nor honours lifecycle "+
			"labels, so treating one as authoritative lets a label nothing in Farm Table "+
			"wrote decide a Farm Table privilege question.", own, stage)
	}
}

// TestExternalUnavailableLabel_IsToggleBlind pins the correction round 10 made
// to authorizationStage's doc comment.
//
// Round 9 wrote that github.labels.enabled=false "removes lifecycle-label
// AUTHORITY entirely". It does not: hasExternalUnavailableLabel carries no
// toggle guard, so a hold label still withholds work with the mapping off.
//
// The behaviour is fail-closed, pre-existing and deliberately unchanged. This
// test exists so the CLAIM cannot drift back: a future edit that adds a toggle
// guard to hasExternalUnavailableLabel — which the round-9 sentence would
// license — turns this red and has to argue with the operator whose hold it is
// about to drop.
//
// The free rows are the positive control. Without them a function that simply
// returned true would pass every held row.
func TestExternalUnavailableLabel_IsToggleBlind(t *testing.T) {
	cases := []struct {
		label    string
		wantHeld bool
	}{
		{"ft:stage/blocked", true},
		{"blocked", true},
		{"ft:blocked", true},
		{"deferred", true},
		{"waiting_for_input", true},
		{"scheduled", true},
		{"ft:stage/completed", false}, // control: a lifecycle label that is NOT a hold
		{"ordinary-label", false},     // control: not a lifecycle label at all
	}

	held, free := 0, 0
	for _, enabled := range []bool{true, false} {
		m := NewLabelMapper(LabelConfig{Enabled: enabled})
		for _, tc := range cases {
			got := m.hasExternalUnavailableLabel([]string{tc.label})
			if tc.wantHeld {
				held++
			} else {
				free++
			}
			if got != tc.wantHeld {
				t.Fatalf("hasExternalUnavailableLabel(%q) at enabled=%v = %v, want %v. "+
					"This function must give the SAME answer at both toggle settings: it "+
					"can only ever withhold work, and an operator's explicit hold is a "+
					"signal to obey whether or not label mapping is on. If you are "+
					"deliberately making holds toggle-dependent, you are dropping holds "+
					"that issues are relying on — say so out loud and fix the doc comment "+
					"on authorizationStage, which now documents this as toggle-blind",
					tc.label, enabled, got, tc.wantHeld)
			}
		}
	}

	if want := 2 * len(cases); held+free != want {
		t.Fatalf("SWEEP BROKEN: evaluated %d cells, want %d", held+free, want)
	}
	if held == 0 || free == 0 {
		t.Fatalf("VACUOUS: %d held rows and %d free rows. Without both, this test "+
			"cannot tell a discriminating function from a constant one", held, free)
	}
}

package github

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestStageLabelSwap_StillDeletesAHumansStockLabel is a MEASUREMENT requested
// alongside B6, not an assertion of desired behaviour.
//
// The audit claimed, from unit-level evidence it declined to extend, that
// requiring the configured prefix for authorization inputs would also fix its
// F7: StageLabelSwap treats a human's stock GitHub label as one of ours and
// DELETES it during an ordinary stage change.
//
// MEASURED ANSWER: it does not. B6 changed the two terminal-stage READERS
// (TerminalLabelStage and AllTerminalLabelStages), which is where an
// authorization answer comes from. StageLabelSwap is a WRITER and still decides
// "is this one of ours?" with the prefix-tolerant stripForMatch, so a stock
// "duplicate" is still removed when the task moves to working. That is a data
// loss bug and it is untouched by this round; it is recorded here so the claim
// is not carried forward unverified.
//
// This test pins CURRENT behaviour. If you are here because it failed, you are
// probably fixing F7 — invert it and say so.
func TestStageLabelSwap_StillDeletesAHumansStockLabel(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	add, remove := m.StageLabelSwap([]string{"duplicate", "bug"}, task.StageWorking)

	if len(add) != 1 || add[0] != "ft:stage/working" {
		t.Fatalf("BASELINE BROKEN: add = %v, want [ft:stage/working]; the swap is not doing "+
			"the thing whose side effect is being measured", add)
	}

	deletesStock := false
	for _, l := range remove {
		if l == "duplicate" {
			deletesStock = true
		}
		if l == "bug" {
			t.Fatalf("StageLabelSwap removed the non-stage label \"bug\" (remove = %v); that "+
				"is a different and larger bug than the one being measured", remove)
		}
	}
	if !deletesStock {
		t.Fatalf("F7 IS FIXED: StageLabelSwap([duplicate bug], working) no longer removes "+
			"\"duplicate\" (remove = %v). This test recorded that B6 did NOT fix it; if that "+
			"has changed, invert this test and update the round-5 log entry", remove)
	}
	t.Logf("F7 MEASURED STILL OPEN: StageLabelSwap([duplicate bug], working) "+
		"add=%v remove=%v", add, remove)

	// The contrast that localises it: the READERS B6 changed do not honour the
	// stock label, while this WRITER still claims ownership of it. One label,
	// two answers, in the same mapper.
	if _, ok := m.TerminalLabelStage([]string{"duplicate"}); ok {
		t.Fatalf("TerminalLabelStage still reads the stock \"duplicate\" as terminal; B6 did " +
			"not land")
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

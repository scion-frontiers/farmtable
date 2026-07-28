package github

import (
	"context"
	"sort"
	"testing"

	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// MUTATION RECORD for this file (#194 round 6, leg A).
//
// PROVE-IT: every test here was written and run BEFORE the fix and was RED
// against the real defect at ea8ac39 —
// TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel reproduced F7 end to
// end through UpdateTask, [ft:stage/wont_fix duplicate] -> [ft:stage/wont_fix].
//
// HARNESS NOTE, disclosed because it nearly became a false finding: that
// end-to-end test first failed with "unexpected GraphQL request: updateIssue",
// which is a missing arm in the fake repository, not a measurement of anything.
// A red run for a harness reason looks identical to a red run for a real one in
// a summary line. The arm was added (close_label_swap_test.go) and the test
// re-run before the failure above was recorded as F7.
//
// OVER-BROAD-FIX CONTROL (MUT 7): making StageLabelSwap remove NOTHING —
// `ours && false` — is caught by
// TestStageLabelSwap_DoesNotDeleteLabelsFarmTableDoesNotOwn (4 rows),
// TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader and
// TestStageLabelSwap_UnderACustomPushPrefix. So these tests distinguish
// "scoped the removal correctly" from "stopped removing", which the F7
// reproduction alone cannot do. Restored and sha256-verified against an
// out-of-repo pristine copy.

// TestStageLabelSwap_DoesNotDeleteLabelsFarmTableDoesNotOwn is review F7.
//
// MEASURED AT ea8ac39, end to end through UpdateTask:
//
//	issue labels  = [ft:stage/wont_fix, duplicate]
//	UpdateTask(stage=wont_fix)
//	-> ALLOWED, and afterwards labels = [ft:stage/wont_fix]
//
// The human's stock "duplicate" label was gone. Two separate things were wrong
// and only one of them is this leg's:
//
//   - THE SCOPE. wont_fix -> wont_fix reads as from == to, so the transition
//     table short-circuits to task:write and never asks for task:close, even
//     though the write erases a terminal assertion. That gate is
//     store.LabelDeltaLifecycleStages, in internal/store, and is leg B's.
//
//   - THE WRITE ITSELF, which is this test. StageLabelSwap decided what to
//     DELETE using stripForMatch — the prefix-TOLERANT, display-side lookup.
//     Round 5 established the rule that prefix-tolerant matching is a display
//     affordance and must not reach a security decision, and applied it to
//     every READER. The writer was left behind. So Farm Table read "duplicate"
//     as not-ours for the purposes of believing it, and as ours for the
//     purposes of deleting it — the worst possible pair, because it means we
//     destroy exactly the labels we have decided we are not entitled to trust.
//
// THE RULE, stated so it is checkable: Farm Table removes a stage label only if
// that label carries the configured push prefix. Same predicate the readers
// use, one direction of a single ownership question.
//
// The cost, stated plainly rather than buried: a bare human-applied stage label
// now SURVIVES a stage change, so an issue can display a stale reading. That is
// the same trade round 4 accepted for reads — wrongly displayed, not wrongly
// privileged, and never destructive — and it is now consistent across both
// directions instead of split down the middle.
func TestStageLabelSwap_DoesNotDeleteLabelsFarmTableDoesNotOwn(t *testing.T) {
	cases := []struct {
		name     string
		current  []string
		newStage task.Stage

		wantAdd    []string
		wantRemove []string
		why        string
	}{
		{
			name:     "f7_exact_case",
			current:  []string{"ft:stage/wont_fix", "duplicate"},
			newStage: task.StageWontFix,
			wantAdd:  nil, wantRemove: nil,
			why: "REVIEW F7. Before round 6 this removed \"duplicate\". A no-op " +
				"update must not be a destructive one.",
		},
		{
			name:     "stock_label_survives_a_real_stage_change",
			current:  []string{"ft:stage/accepted", "duplicate"},
			newStage: task.StageWorking,
			wantAdd:  []string{"ft:stage/working"}, wantRemove: []string{"ft:stage/accepted"},
			why: "our own label is swapped, the human's stock one is left alone. " +
				"This is the row that shows the fix is a narrowing and not a disabling.",
		},
		{
			name:     "our_own_terminal_label_is_still_swappable",
			current:  []string{"ft:stage/wont_fix"},
			newStage: task.StageCompleted,
			wantAdd:  []string{"ft:stage/completed"}, wantRemove: []string{"ft:stage/wont_fix"},
			why: "CONTROL. If this stopped removing, the fix would have broken the " +
				"swap outright and every other row would pass vacuously. Whether " +
				"this transition is PERMITTED is the delta gate's question, not " +
				"this function's; StageLabelSwap only computes the edit.",
		},
		{
			name:     "bare_stage_name_is_not_ours_to_delete",
			current:  []string{"completed", "ft:stage/accepted"},
			newStage: task.StageWorking,
			wantAdd:  []string{"ft:stage/working"}, wantRemove: []string{"ft:stage/accepted"},
			why: "a bare stage name does not authorize (B6), so it must not be " +
				"deletable either. Read and write have to answer ownership the " +
				"same way or one of them is lying.",
		},
		{
			name:     "unrelated_labels_were_never_at_risk",
			current:  []string{"ft:stage/accepted", "bug", "help wanted"},
			newStage: task.StageWorking,
			wantAdd:  []string{"ft:stage/working"}, wantRemove: []string{"ft:stage/accepted"},
			why: "BASELINE: labels that map to no stage at all were already safe. " +
				"Included so a regression there is visible here too.",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := NewLabelMapper(DefaultConfig().GitHub.Labels)
			add, remove := m.StageLabelSwap(tc.current, tc.newStage)

			sort.Strings(add)
			sort.Strings(remove)
			wantAdd := append([]string(nil), tc.wantAdd...)
			wantRemove := append([]string(nil), tc.wantRemove...)
			sort.Strings(wantAdd)
			sort.Strings(wantRemove)

			if !equalStrings(add, wantAdd) {
				t.Errorf("add = %v, want %v\nwhy: %s", add, wantAdd, tc.why)
			}
			if !equalStrings(remove, wantRemove) {
				t.Errorf("remove = %v, want %v\nwhy: %s", remove, wantRemove, tc.why)
			}
		})
	}
}

// TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader is the property
// behind the table above, asserted directly rather than sampled.
//
// The defect was not "duplicate was in the wrong list". It was that the writer
// and the reader used DIFFERENT predicates for the same ownership question, and
// a table of examples cannot rule that out — it can only fail to find a case
// where they diverge. This enumerates every stage name in both spellings and
// requires the two answers to agree by construction.
func TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	// Move to a stage nothing below is already at, so "not removed" is never an
	// artefact of raw == newLabel.
	const target = task.StageTriage

	var checked int
	for _, stage := range allStages {
		if stage == target {
			continue
		}
		for _, label := range []string{
			"ft:stage/" + stage.String(), // ours
			stage.String(),               // a human's, or another tool's
		} {
			checked++
			_, ours := m.authorizationStage(label)
			_, removed := m.StageLabelSwap([]string{label}, target)
			// removed is a []string; presence is what matters.
			gotRemoved := len(removed) > 0

			if gotRemoved != ours {
				t.Errorf("label %q: authorizationStage says ours=%v but StageLabelSwap "+
					"removes=%v.\n\nThe reader and the writer disagree about who owns "+
					"this label. Whichever way that disagreement points it is a bug: "+
					"remove-but-not-trust destroys third-party data (review F7), "+
					"trust-but-not-remove leaves a label that authorizes and can never "+
					"be cleared.", label, ours, gotRemoved)
			}
		}
	}
	if checked == 0 {
		t.Fatal("enumerated nothing; allStages is empty and this test is vacuous")
	}
	t.Logf("checked %d label spellings across %d stages", checked, len(allStages))
}

// TestStageLabelSwap_UnderACustomPushPrefix pins that ownership follows the
// CONFIGURED prefix, not a hardcoded ft:. Without this the fix would read as
// "special-case the string ft:" rather than "ask who owns the label", and the
// acme: deployment would go on deleting labels from a namespace it does not own
// while its own labels became undeletable.
func TestStageLabelSwap_UnderACustomPushPrefix(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = "acme:"
	m := NewLabelMapper(cfg)

	add, remove := m.StageLabelSwap([]string{"acme:stage/accepted", "ft:stage/accepted", "duplicate"}, task.StageWorking)

	if len(add) != 1 || add[0] != "acme:stage/working" {
		t.Errorf("add = %v, want [acme:stage/working]", add)
	}
	if len(remove) != 1 || remove[0] != "acme:stage/accepted" {
		t.Errorf("remove = %v, want exactly [acme:stage/accepted]: under push_prefix "+
			"acme:, ft:stage/accepted belongs to some other deployment and duplicate "+
			"belongs to a human", remove)
	}
}

// TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel is F7 at the RPC-facing
// seam rather than the mapper seam, because the mapper-level assertions above
// would all still pass if UpdateTask stopped calling StageLabelSwap and did
// something else. This drives the real path and inspects the fake repository's
// resulting label set.
func TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/wont_fix", "duplicate")
	// Without this the stock label has no node ID, labelNamesToIDs silently
	// drops it, and the test would "pass" for the wrong reason -- the same way
	// the round-5 custom-prefix probe measured nothing.
	fake.registerLabel("duplicate")
	s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)

	if !fake.hasLabel("duplicate") {
		t.Fatalf("fixture lost the stock label before the call; labels = %v", fake.labels)
	}

	stage := task.StageWontFix
	if _, err := s.UpdateTask(ctx, s.issueUUID(1), store.UpdateTaskParams{Stage: &stage}, uuid.New()); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	if !fake.hasLabel("duplicate") {
		t.Errorf("UpdateTask(stage=wont_fix) deleted the stock GitHub label "+
			"\"duplicate\"; labels = %v.\n\nFarm Table declines to READ that label as "+
			"a terminal assertion because it is not ours (B6). Deleting it anyway is "+
			"the same ownership question answered the opposite way in the destructive "+
			"direction (review F7).", fake.labels)
	}
	if !fake.hasLabel("ft:stage/wont_fix") {
		t.Errorf("our own stage label went missing; labels = %v", fake.labels)
	}

	// CONTROL: the fake genuinely CAN delete this label, so its survival above
	// is a decision by the code and not an inability of the harness.
	if _, ok := fake.labelIDs["duplicate"]; !ok {
		t.Fatal("CONTROL BROKEN: no node ID for \"duplicate\", so no removal was ever " +
			"possible and the assertion above proves nothing")
	}
	fake.removeLabelByID(fake.labelIDs["duplicate"])
	if fake.hasLabel("duplicate") {
		t.Fatal("CONTROL BROKEN: the harness cannot remove \"duplicate\" at all")
	}
}

// TestF7Cell_IsNonEmptyOnBothSidesSoTheEmptySetGuardCannotFire pins the SEAM
// between this leg's A5 fix and leg B's B4 fix, because two fixes that each
// look complete are how this branch keeps producing gaps.
//
// B4 makes store.LifecycleStages / store.LabelDeltaLifecycleStages return an
// error when an implementer hands back an EMPTY side, replacing a fail-open
// that charged nothing. A5 is the NON-EMPTY but EQUAL case. They are adjacent
// and it is tempting to assume one covers the other, so this measures the one
// fact that decides it: on the F7 input, is either side empty?
//
// MEASURED: no. [ft:stage/wont_fix, duplicate] names the set {wont_fix} —
// one element, because B6 already denies the bare stock label any authority.
// One is not zero, so B4's guard is unreachable on this input and cannot
// subsume A5. Complementary, not overlapping.
//
// If this test starts failing with an empty set, the two fixes have begun
// overlapping and the reasoning in both logs needs revisiting.
func TestF7Cell_IsNonEmptyOnBothSidesSoTheEmptySetGuardCannotFire(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/wont_fix", "duplicate")
	fake.registerLabel("duplicate")
	s := fake.store()

	tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:stage/wont_fix", "duplicate"}}

	stages := s.LifecycleStages(ctx, tk)
	if len(stages) == 0 {
		t.Fatalf("the F7 input now yields an EMPTY lifecycle stage set. That makes it " +
			"leg B's empty-set guard's problem as well as this leg's, and the " +
			"\"complementary, not overlapping\" conclusion recorded in both round-6 " +
			"logs is no longer true")
	}
	if len(stages) != 1 || stages[0] != task.StageWontFix {
		t.Errorf("LifecycleStages = %v, want exactly [wont_fix]: the bare stock "+
			"\"duplicate\" must contribute nothing (B6), and ft:stage/wont_fix must "+
			"contribute exactly itself", stages)
	}

	// The other half of the seam: the delta reader, on the delta this update
	// actually performs. After A5 the swap is a no-op, so both endpoints are
	// the same non-empty set -- allowed, and harmless, which is the point.
	add, remove := s.mapper.StageLabelSwap(tk.Labels, task.StageWontFix)
	before, after := s.LabelDeltaLifecycleStages(ctx, tk, add, remove)
	if len(before) == 0 || len(after) == 0 {
		t.Fatalf("LabelDeltaLifecycleStages returned an empty side (before=%v after=%v); "+
			"same conclusion as above, revisit both logs", before, after)
	}
	if len(add) != 0 || len(remove) != 0 {
		t.Errorf("after A5 this update should be a label no-op, got add=%v remove=%v",
			add, remove)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

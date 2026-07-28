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

// ownershipTruthTable is the EXPECTED side of
// TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader, and it is
// hand-written rather than generated. That is the entire point of it.
//
// WHAT THE PREVIOUS VERSION DID, and why it was deleted (#194 round 7, T-F2).
// It computed EXPECTED as `m.authorizationStage(label)` and ACTUAL as
// `m.StageLabelSwap(...)`. But StageLabelSwap's ownership predicate IS
// authorizationStage — one call, one function. The test asked a function to
// agree with itself, which it does unconditionally. MEASURED: breaking
// authorizationStage to return ("", false) for every label turned 27 top-level
// tests in this package RED and left that one GREEN, exit 0. It was the ninth
// instance on this workstream of a check deriving from the thing it checks.
//
// So both spellings of every stage are written out as literals below, with the
// ownership answer each one is supposed to get. Nothing in this table is
// computed from the mapper, from stagePrecedence, or from StageToLabel. If the
// mapper's answer moves, the table does not move with it, and the test fails —
// which is what "fails if the two ever diverge" was supposed to mean.
//
// THE RULE THE `ours` COLUMN ENCODES is B6: a label may contribute to an
// authorization or terminal-stage determination only if it carries the
// configured push prefix. Prefixed spelling -> ours. Bare spelling -> not ours,
// because "duplicate" and "completed" are labels GitHub ships or any triager
// can apply, and they carry no assertion by Farm Table.
//
// MAINTAINING IT IS DELIBERATE WORK, ON PURPOSE. Add a stage to the data model
// and this table does not know about it; the completeness check in
// requireOwnershipTableIsTotal then fails and names the missing stage. A
// generated table would have absorbed the new stage silently and gone on
// reporting that it had checked everything.
var ownershipTruthTable = []struct {
	stage    task.Stage
	prefixed string // what this deployment writes, spelled out
	bare     string // what a human or another tool might write
}{
	{task.StageTriage, "ft:stage/triage", "triage"},
	{task.StageAccepted, "ft:stage/accepted", "accepted"},
	{task.StageWorking, "ft:stage/working", "working"},
	{task.StageInReview, "ft:stage/in_review", "in_review"},
	{task.StageInQa, "ft:stage/in_qa", "in_qa"},
	{task.StageDeploying, "ft:stage/deploying", "deploying"},
	{task.StageCompleted, "ft:stage/completed", "completed"},
	{task.StageWontFix, "ft:stage/wont_fix", "wont_fix"},
	{task.StageDuplicate, "ft:stage/duplicate", "duplicate"},
	{task.StageCancelled, "ft:stage/cancelled", "cancelled"},
}

// wantOwnershipRows pins the table's size against silent deletion. The
// completeness check below catches a stage ADDED to the model and not to the
// table; this catches a row removed from the table and not from the model, in
// the case where allStages was edited to match.
const wantOwnershipRows = 10

// requireOwnershipTableIsTotal aborts unless the hand-written table names
// exactly the stages the mapper is built over, each exactly once, with two
// distinct spellings. Everything below it is worthless if this does not hold,
// so it is a Fatal and it runs first.
//
// This checks the table's DOMAIN against allStages. It does not — and must not
// — take the ownership ANSWER from anywhere but the literals above.
func requireOwnershipTableIsTotal(t *testing.T) {
	t.Helper()

	if len(ownershipTruthTable) != wantOwnershipRows {
		t.Fatalf("ownershipTruthTable has %d rows, want %d: a row was added or removed "+
			"without updating the pin", len(ownershipTruthTable), wantOwnershipRows)
	}

	inTable := make(map[task.Stage]int, len(ownershipTruthTable))
	for _, row := range ownershipTruthTable {
		if err := task.StageValidator(row.stage); err != nil {
			t.Fatalf("ownershipTruthTable names %q, which is not a stage: %v", row.stage, err)
		}
		if row.prefixed == row.bare {
			t.Fatalf("row %q spells both labels %q; the two spellings must differ or the "+
				"row cannot distinguish ours from not-ours", row.stage, row.prefixed)
		}
		if row.bare != row.stage.String() {
			t.Fatalf("row %q spells its bare label %q; it must be the stage's own name, "+
				"which is what a human or another tool would actually apply",
				row.stage, row.bare)
		}
		inTable[row.stage]++
	}

	for stage, n := range inTable {
		if n != 1 {
			t.Fatalf("stage %q appears %d times in ownershipTruthTable, want once", stage, n)
		}
	}
	for _, stage := range allStages {
		if inTable[stage] == 0 {
			t.Fatalf("stage %q is in allStages but has no row in ownershipTruthTable.\n\n"+
				"A stage was added to the data model and the hand-written ownership table "+
				"was not updated, so both of its label spellings are unchecked. Add a row "+
				"— deliberately, deciding what the answer should be — and bump "+
				"wantOwnershipRows.", stage)
		}
		delete(inTable, stage)
	}
	for stage := range inTable {
		t.Fatalf("ownershipTruthTable has a row for %q, which is not in allStages; the "+
			"mapper never builds a lookup for it and the row measures nothing", stage)
	}
}

// TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader pins that the
// WRITER and the READER give the ownership answer a hand-written table says
// they should — separately, each against the literal.
//
// The defect this exists for was not "duplicate was in the wrong list". It was
// that the writer and the reader used DIFFERENT predicates for the same
// ownership question. The obvious way to test that is to compare the two, and
// that is exactly what must not be done here: since round 6 the writer's
// predicate is a call to the reader, so comparing them is comparing a function
// to itself and passes under every possible defect (see ownershipTruthTable).
//
// Comparing each to a third, independent source restores the property AND
// strengthens it. If the reader and the writer ever diverge, at least one of
// them must disagree with the literal, so divergence is still caught; and a
// change that moves BOTH of them together — which the old test could not see at
// all, because they move together by construction — is now caught too.
func TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader(t *testing.T) {
	requireOwnershipTableIsTotal(t)

	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	var checked int
	for i, row := range ownershipTruthTable {
		// Swap TO some other stage, so "not removed" is never an artefact of
		// raw == newLabel. Taken from the table so the target label is a literal
		// too; the next row, wrapping, is always a different stage because
		// requireOwnershipTableIsTotal proved the rows are distinct.
		target := ownershipTruthTable[(i+1)%len(ownershipTruthTable)]

		// BASELINE: the literal really is the label this deployment writes for
		// the target stage. Without this the table could drift into fiction —
		// every row would swap to a label nothing recognises and every
		// "removed" answer would be right for the wrong reason. This reads the
		// WRITER's spelling (StageToLabel), which is not the predicate under
		// test.
		if got := m.StageToLabel(target.stage); got != target.prefixed {
			t.Fatalf("BASELINE BROKEN: StageToLabel(%q) = %q, but ownershipTruthTable "+
				"spells it %q. The table describes a deployment that does not exist",
				target.stage, got, target.prefixed)
		}

		for _, sp := range []struct {
			label    string
			wantOurs bool
			why      string
		}{
			{row.prefixed, true, "carries the configured push prefix, so Farm Table " +
				"wrote it (or someone deliberately impersonated it) and it is ours to " +
				"read and ours to remove"},
			{row.bare, false, "a bare stage name is a human's triage note or another " +
				"tool's label. B6: it must not authorize, and F7: it must not be " +
				"deleted either. One ownership question, one answer, both directions"},
		} {
			if sp.label == target.prefixed {
				t.Fatalf("BASELINE BROKEN: row %q spelling %q is the target label itself; "+
					"StageLabelSwap short-circuits on raw == newLabel and this cell would "+
					"measure that short-circuit instead of ownership", row.stage, sp.label)
			}

			checked++

			// The READER, against the literal.
			_, readerSaysOurs := m.authorizationStage(sp.label)
			if readerSaysOurs != sp.wantOurs {
				t.Errorf("READER: authorizationStage(%q) ours = %v, want %v.\n\nwhy: %s",
					sp.label, readerSaysOurs, sp.wantOurs, sp.why)
			}

			// The WRITER, against the same literal, independently.
			_, remove := m.StageLabelSwap([]string{sp.label}, target.stage)
			writerRemoves := len(remove) > 0
			if writerRemoves != sp.wantOurs {
				t.Errorf("WRITER: StageLabelSwap([%q] -> %q) removes = %v, want %v.\n\nwhy: %s\n\n"+
					"remove-but-not-trust destroys third-party data (review F7); "+
					"trust-but-not-remove leaves a label that authorizes and can never "+
					"be cleared.", sp.label, target.stage, writerRemoves, sp.wantOurs, sp.why)
			}
		}
	}

	// The old version of this guard was `if checked == 0`, which could not fire:
	// the loop is over a non-empty package-level slice, so zero was unreachable
	// and the guard was decoration. This pins the exact cell count instead, so a
	// `continue` added to the loop, or a row that silently stops being
	// enumerated, is a failure rather than a smaller number nobody reads.
	if want := 2 * len(ownershipTruthTable); checked != want {
		t.Fatalf("checked %d label spellings, want %d (%d stages x 2 spellings); the "+
			"enumeration is no longer total", checked, want, len(ownershipTruthTable))
	}
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

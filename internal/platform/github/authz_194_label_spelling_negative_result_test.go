package github

import (
	"context"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ─────────────────────────────────────────────────────────────────────────────
// NEGATIVE RESULT — #194 "DEFECT 4" DOES NOT EXIST. THIS TEST PASSES, AND IT
// PASSED THE FIRST TIME IT WAS EVER RUN.
//
// READ THIS BEFORE YOU "FIX" ANYTHING IT DESCRIBES.
//
// This file is kept deliberately, as a recorded negative result and as a
// regression guard on the compensating control named below. It is NOT evidence
// of a defect. An earlier draft of this docblock asserted one; that assertion
// was wrong, was retracted by its author before it was acted on, and the
// correction is preserved here on purpose so the claim cannot be rediscovered
// without it.
//
// GREEN at 2ffc22a (base 2cbbd92, refs/preserve/194-r11/branch), package
// github.com/farmtable-io/farmtable/internal/platform/github. Both rows pass,
// including the positive control.
//
// ── WHAT IS REAL: TWO PREDICATES DISAGREE ───────────────────────────────────
// This much was measured and still holds at 2ffc22a, DefaultConfig,
// push_prefix "ft:", enabled=true:
//
//	authorizationStage  (terminal_label_stages.go:116-125) REQUIRES the prefix.
//	MapLabelsToStage    (labels.go:279-291) does NOT. stripForMatch removes the
//	                    prefix if present and is content without one.
//
//	label                 MapLabelsToStage   authorizationStage   AllTerminalLabelStages
//	"duplicate"           (duplicate,true)   ("",false)           []
//	"ft:stage/duplicate"  (duplicate,true)   (duplicate,true)     [duplicate]
//
// That divergence is a LATENT HAZARD. It is not a live defect, because of:
//
// ── THE COMPENSATING CONTROL, NAMED ─────────────────────────────────────────
//
//	currentLifecycleStages (passthrough.go:1230-1236) falls back to
//	    IssueToPhaseStage(taskIssueState(t), taskStateReason(t), LABELS)
//	                                                             ^^^^^^
//	on the labels IT WAS HANDED — not on the task's stored t.Stage.
//
// THIS IS THE WHOLE REASON D4 IS DEAD. The retracted claim was that the
// fallback returned stale t.Stage, which would have made BEFORE and AFTER
// identical for any task whose only lifecycle label is bare-spelled, pricing a
// real transition as a no-op. It does not. Each endpoint is resolved from its
// own label set through the SAME parser the read path uses, so the bare
// spelling is priced correctly and the two-predicate disagreement never reaches
// the subtraction.
//
// IF YOU CHANGE THAT FALLBACK TO USE t.Stage, OR TO USE authorizationStage, YOU
// REMOVE THE CONTROL AND D4 BECOMES REAL. This test is the thing that will tell
// you. That is its job now.
//
// ── DO NOT UNIFY THE PARSER ─────────────────────────────────────────────────
// Making authorizationStage and MapLabelsToStage agree is the obvious response
// to the table above. It was proposed on this track and then WITHDRAWN, on the
// grounds that it is a refactor of the authorization predicate with no
// demonstrated defect behind it, and that any such change risks turning a
// currently-permitted transition into a denied one. It is filed as a backlog
// item with the retraction attached. It is not scoped work. Do not start it
// because you found this table.
//
// ── WHAT THIS TEST ASSERTS ──────────────────────────────────────────────────
// It does not name a price. It asserts only that an edit which moves the stage
// the system believes must not price as a no-op — and it verifies that against
// ground truth computed from IssueToPhaseStage rather than asserted by hand.
// The prefixed row is a positive control: if the gate cannot price the spelling
// it already handles, the instrument is broken and the bare row proves nothing.
// ─────────────────────────────────────────────────────────────────────────────

func TestLabelWritePrice_DoesNotDependOnLabelSpelling(t *testing.T) {
	ctx := context.Background()
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)
	s := &GitHubPassThroughStore{mapper: m}

	closedAt := time.Date(2026, 7, 29, 0, 0, 0, 0, time.UTC)

	for _, tc := range []struct {
		name    string
		label   string
		control bool // true = the spelling the gate already handles
	}{
		{name: "prefixed_spelling_POSITIVE_CONTROL", label: "ft:stage/duplicate", control: true},
		{name: "bare_spelling", label: "duplicate"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tk := &ent.Task{
				Stage:    task.StageDuplicate,
				Labels:   []string{tc.label},
				ClosedAt: &closedAt,
			}

			// GROUND TRUTH, computed rather than asserted. This is the function
			// issueToTask uses to decide a task's stage, so it is what the
			// deployment will really believe before and after the write.
			_, truthBefore := m.IssueToPhaseStage("closed", "", tk.Labels)
			_, truthAfter := m.IssueToPhaseStage("closed", "", []string{})

			// PREMISE. If the edit does not move the stage there is nothing to
			// price and this row would be vacuous.
			if truthBefore == truthAfter {
				t.Fatalf("PREMISE FAILED: removing %q leaves the stage at %v. "+
					"This row cannot demonstrate a mispriced transition.",
					tc.label, truthBefore)
			}

			before, after := s.LabelDeltaLifecycleStages(ctx, tk, nil, []string{tc.label})
			priced := !store.SameStageSet(before, after)

			if tc.control {
				if !priced {
					t.Fatalf("POSITIVE CONTROL FAILED: the gate did not price the "+
						"prefixed spelling either (before=%v after=%v). The "+
						"instrument cannot detect the thing this test measures, so "+
						"a pass on the bare row below would be meaningless.",
						before, after)
				}
				t.Logf("control OK: %q prices (before=%v after=%v); the gate CAN see "+
					"this transition when it is spelled with the prefix.",
					tc.label, before, after)
				return
			}

			if !priced {
				t.Errorf("SECURITY PROPERTY VIOLATED — a real lifecycle transition "+
					"priced as a no-op because of how the label is spelled.\n"+
					"  label removed:      %q\n"+
					"  stage really moves: %v -> %v   (IssueToPhaseStage, the read-back)\n"+
					"  gate endpoints:     before=%v after=%v  -> SameStageSet=true, FREE\n"+
					"  same edit prefixed: priced (see the positive control above)\n"+
					"\n"+
					"authorizationStage requires the push prefix and MapLabelsToStage "+
					"does not, so AllTerminalLabelStages returns empty for the bare "+
					"spelling and currentLifecycleStages falls back to t.Stage on BOTH "+
					"endpoints. The fallback returns the pre-edit stage twice, so the "+
					"difference the price is computed from is identically zero.\n"+
					"\n"+
					"THIS ORACLE DOES NOT SAY WHAT THE PRICE SHOULD BE. It says the "+
					"price must not be decided by the caller's choice of spelling.",
					tc.label, truthBefore, truthAfter, before, after)
			}
		})
	}
}

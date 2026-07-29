package server_test

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ─────────────────────────────────────────────────────────────────────────────
// #194 — THE MASKED REMOVAL OF A CANONICALLY *FINAL* STAGE. THIS IS THE ARM THAT
// GOES RED AT A BASELINE WHERE THE ROUND-12 IMPLEMENTATION IS ABSENT.
//
// WHY IT EXISTS, AND WHY THE OTHER ORACLE IS NOT ENOUGH.
// TestPricingGate_MaskedRemovalOfCanonicallyFirstStageIsCharged is GREEN at
// 037a626 — a checkout carrying the oracles and NOT the implementation. That is
// not a bug in it; it is a property of the vector it picked. Round 11 denied
// that vector BY ACCIDENT of element ordering, so the oracle cannot distinguish
// "denied because priced" from "denied by accident", and an oracle that cannot
// go red at the pre-fix baseline is exactly the defect class this issue is about.
//
// THE MECHANISM, DERIVED FROM THE TWO ORDER-PRODUCING FUNCTIONS AT 2ffc22a.
// Round 11's gate fires iff !SameStageSet(before, after), and SameStageSet is
// POSITIONAL (len check, then a[i] != b[i]). Its AFTER endpoint is
//
//	after = unionStages(narrowAfter, wideAfter)   // primary order, extras APPENDED
//
// while AllTerminalLabelStages returns its stages sort.Slice'd. So r11 PERMITS a
// masked departure exactly when the concatenation reproduces sorted order:
//
//	union = narrowAfter ++ sorted(departed)  equals sorted(before)
//	  iff  max(narrowAfter) < min(departed)
//	  iff  THE DEPARTED SET IS A CANONICALLY FINAL SUFFIX OF BEFORE.
//
// Terminal vocabulary sorted: cancelled < completed < duplicate < wont_fix.
//
// MEASURED AT 037a626, IMPLEMENTATION ABSENT (pre-registered results-free at
// 754dc16, both branches named in advance):
//
//	remove wont_fix,  keep completed   -> ALLOWED  after=[completed]  DEPARTED
//	remove duplicate, keep cancelled   -> ALLOWED  after=[cancelled]  DEPARTED
//	remove completed, keep wont_fix    -> PermissionDenied   (the accident)
//	remove cancelled, keep duplicate   -> PermissionDenied   (the accident)
//
// TWO SUFFIX PAIRS, NOT ONE, SO THE RESULT CANNOT BE A QUIRK OF wont_fix: the
// split tracks ORDER, not stage identity. THE DEPARTURE IS REAL — the read-back
// shows the stage gone from the authoritative set while the edit was free.
//
// SO ROUND 11 DOES NOT MERELY UNDER-PRICE MASKED DEPARTURES SOMETIMES. IT PRICES
// AT NOTHING EVERY MASKED DEPARTURE OF A CANONICALLY FINAL STAGE, AND CHARGES THE
// REST ONLY AS A SIDE EFFECT OF SLICE ORDER.
//
// Round 12 prices this vector departed={wont_fix}, entered={}, giving the pair
// wont_fix -> completed, which the transition table matches at any->terminal and
// charges task:close — a scope agentScopes() deliberately does not hold.
//
// DO NOT "SIMPLIFY" THIS INTO THE FIRST-STAGE ORACLE. They test opposite halves
// of the same characterization, and the first-stage one is green before the fix.
// ─────────────────────────────────────────────────────────────────────────────

func TestPricingGate_MaskedRemovalOfCanonicallyFinalStageIsCharged(t *testing.T) {
	cases := []struct {
		name          string
		kept, removed task.Stage
	}{
		// removed sorts AFTER kept in both rows — that is the whole point.
		{"wont_fix_after_completed", task.StageCompleted, task.StageWontFix},
		{"duplicate_after_cancelled", task.StageCancelled, task.StageDuplicate},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if !(tc.kept < tc.removed) {
				t.Fatalf("PREMISE FAILED: %v does not sort before %v, so this row "+
					"is not a canonically-final departure and proves nothing.",
					tc.kept, tc.removed)
			}

			f := openIssue(t, stageLabel(tc.kept), stageLabel(tc.removed))
			if got := f.lifecycleStages(t); len(got) != 2 {
				t.Fatalf("PREMISE FAILED: labels resolve to %v, want both %v and %v. "+
					"Without two stages present there is no departure to price.",
					got, tc.kept, tc.removed)
			}

			add, remove := maskedRemoval(tc.removed)
			err := f.swapLabels(agentScopes(), add, remove)

			after := f.lifecycleStages(t)
			stillThere := false
			for _, s := range after {
				if s == tc.removed {
					stillThere = true
				}
			}

			if err == nil {
				t.Errorf("FREE DEPARTURE — the gate charged NOTHING for removing %v.\n"+
					"  scopes held: %v  (task:accept and task:close deliberately absent)\n"+
					"  edit:        remove %v, add %v\n"+
					"  stage set:   %v -> %v   (%v still present? %v)\n"+
					"\n"+
					"THIS IS THE ROUND-11 BEHAVIOUR AND IT IS THE DEFECT: %v sorts "+
					"canonically LAST, so unionStages appending the restored element "+
					"reproduces sorted order, the positional SameStageSet sees no "+
					"change, and a real departure is waved through. If this is red at "+
					"a checkout that HAS round 12, the departure half has regressed.",
					tc.removed, agentScopes(), remove, add,
					[]task.Stage{tc.kept, tc.removed}, after, tc.removed, stillThere,
					tc.removed)
				return
			}

			if st, _ := status.FromError(err); st.Code() != codes.PermissionDenied {
				t.Fatalf("the edit failed with %v (%s), which is not an authorization "+
					"answer. This measures pricing; a transport or validation failure "+
					"means the fixture is wrong, not that the gate held.",
					st.Code(), st.Message())
			}

			// IMPACT. A denial that still let the write land would be a gate that
			// reports correctly and protects nothing.
			if !stillThere {
				t.Errorf("DENIED BUT NOT PREVENTED — PermissionDenied was returned and "+
					"%v is gone from the authoritative stage set anyway (%v). The "+
					"denial is cosmetic.", tc.removed, after)
			}
		})
	}
}

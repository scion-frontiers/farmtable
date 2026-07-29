package server_test

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ─────────────────────────────────────────────────────────────────────────────
// #194 — THE PRICE OF A LABEL EDIT IS DIRECTIONAL, AND ONE BUILD MUST CHARGE
// BOTH DIRECTIONS.
//
// This oracle exists because the two directions are in TENSION under the
// round-11 design, and every previous round fixed one by breaking the other.
// Both arms below run in the SAME BUILD, so a remedy cannot satisfy it by
// trading one for the other. That trade is what eleven rounds kept making.
//
// THE TENSION, MEASURED at 2ffc22a by deleting the union from the AFTER
// endpoint in LabelDeltaLifecycleStages (mutation arm, tree deliberately dirty):
//
//	                                          union present   union deleted
//	DEPARTURE arm (below)                     ALLOWED (RED)   DENIED (green)
//	ENTRY arm (below)                         DENIED (green)  ALLOWED (RED)
//	TestLabelWriteScope_IsBlindToTodaysConfig  green           4 falsifying
//	                                                           cells + its own
//	                                                           vacuity guard RED
//
// So the config-blind union is LOAD-BEARING and cannot simply be removed, and
// it is ALSO the mechanism that makes the departure free. Both facts are true.
//
// WHY. The price is a SET DIFFERENCE, and a safety margin behaves oppositely on
// the two sides of one:
//
//	a wider AFTER is fail-CLOSED for ENTERING a stage
//	a wider AFTER is fail-OPEN   for LEAVING  one
//
// Round 11 states that sentence in its own docblock and then unions the single
// AFTER endpoint anyway, which forces one set to do both jobs. Its monotonicity
// theorem (writePrice ⊇ readPrice) is TRUE and does not help: it bounds the new
// price below by the OLD price, and for the departure vector both are zero.
//
// THE PROPERTY THIS ORACLE ASSERTS, and it does NOT name a price:
//
//	Departures must be computed with the READ predicate on BOTH endpoints.
//	Entries must be computed with the WIDE claim predicate on the AFTER endpoint.
//	A safety margin must never sit inside the set difference it is protecting.
//
// Neither arm asserts WHICH scope is charged — only that a caller who holds
// neither task:accept nor task:close cannot complete the write.
// ─────────────────────────────────────────────────────────────────────────────

func TestLabelWritePrice_ChargesBothDirectionsInOneBuild(t *testing.T) {
	// ── ARM 1: DEPARTURE ────────────────────────────────────────────────────
	// Leaving a lifecycle stage must cost something. RED at 2ffc22a: the claim
	// arm restores the departed stage to AFTER and the edit prices at nothing.
	t.Run("departure_is_charged", func(t *testing.T) {
		const kept = task.StageCompleted
		const removed = task.StageWontFix

		f := openIssue(t, stageLabel(kept), stageLabel(removed))

		if got := f.lifecycleStages(t); len(got) != 2 {
			t.Fatalf("PREMISE FAILED: labels resolve to %v, want both %v and %v. "+
				"Without two stages present there is no departure to price.",
				got, kept, removed)
		}

		add, remove := maskedRemoval(removed)
		err := f.swapLabels(agentScopes(), add, remove)

		after := f.lifecycleStages(t)
		stillThere := false
		for _, s := range after {
			if s == removed {
				stillThere = true
			}
		}

		if err == nil {
			t.Errorf("DEPARTURE PRICED AT NOTHING.\n"+
				"  scopes held: %v  (task:accept and task:close deliberately absent)\n"+
				"  edit:        remove %v, add %v\n"+
				"  stage set:   %v -> %v   (%v still present? %v)\n"+
				"\n"+
				"The departure must be computed with the READ predicate on BOTH "+
				"endpoints. Widening AFTER with the claim view restores the "+
				"departed stage and the difference collapses to empty.",
				agentScopes(), remove, add,
				[]task.Stage{kept, removed}, after, removed, stillThere)
			return
		}
		if st, _ := status.FromError(err); st.Code() != codes.PermissionDenied {
			t.Fatalf("departure arm failed with %v (%s), which is not an "+
				"authorization answer. That means the fixture is wrong, not that "+
				"the gate held.", st.Code(), st.Message())
		}
	})

	// ── ARM 2: ENTRY, CONFIG-BLIND ──────────────────────────────────────────
	// GREEN at 2ffc22a. It is here as the OTHER HALF OF THE VICE: it goes RED
	// the moment somebody "fixes" the departure arm by deleting the union
	// instead of by splitting the two directions apart. Measured, not
	// hypothesised — see the table in the header.
	t.Run("entry_under_a_foreign_prefix_is_charged", func(t *testing.T) {
		f := openIssue(t)

		// "ft2:" is not this deployment's push prefix, so today's read predicate
		// does not honour this label. A deployment that adopted that prefix
		// would, and nothing re-prices a label once it is written.
		const foreign = "ft2:stage/completed"

		err := f.addLabels(agentScopes(), foreign)

		if err == nil {
			t.Errorf("ENTRY PRICED AT NOTHING.\n"+
				"  scopes held: %v  (task:accept and task:close deliberately absent)\n"+
				"  edit:        add %q\n"+
				"\n"+
				"This is the config-blindness property (#194 round 10, Ruling 1). "+
				"If this arm is RED while the departure arm is GREEN, the remedy "+
				"deleted the claim view instead of confining it to the ENTRY "+
				"difference. The claim view is load-bearing; it is only in the "+
				"wrong place.",
				agentScopes(), foreign)
			return
		}
		if st, _ := status.FromError(err); st.Code() != codes.PermissionDenied {
			t.Fatalf("entry arm failed with %v (%s), which is not an authorization "+
				"answer.", st.Code(), st.Message())
		}
	})
}

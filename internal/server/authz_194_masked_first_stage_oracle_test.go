package server_test

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ─────────────────────────────────────────────────────────────────────────────
// #194 — THE MASKED REMOVAL OF THE CANONICALLY FIRST STAGE, MEASURED DIRECTLY
// AGAINST THE REAL GATE.
//
// WHY THIS EXISTS. TestLabelWritePrice_IsMonotoneInThePredicate went red on 48
// cells, all of them this vector. Its price helper (priceOf,
// lifecycle_claim_property_test.go:45-54) is a VERBATIM COPY of the pre-round-12
// gate — "same SameStageSet guard, same all-pairs walk", in its own words — so
// what it is complaining about is a gate shape that no longer exists. The
// obvious response is to repoint it at the real pricing function.
//
// THAT REPOINT WOULD DELETE THE ONLY SIGNAL CURRENTLY DISAGREEING WITH THE CLAIM
// THAT THIS VECTOR IS CHARGED. The argument that it IS charged was a composition
// — D1 green proves masking wont_fix is denied, D2b green proves both maskings
// agree, therefore masking completed is denied. That inference is sound. It is
// still the wrong instrument to justify silencing the sole dissenting guard,
// because if it has a hole the repoint converts a true finding into green and
// nothing is left to say so.
//
// So: get a REAL guard to speak about this exact vector before retiring the
// copy. This test is that guard. It is deliberately NOT a rewrite of the copy
// and NOT a restatement of D1 — it pins the one cell the copy names.
//
// THE VECTOR, taken verbatim from the failing cells:
//
//	labels  [ft:stage/wont_fix ft:stage/completed]
//	add     [stage/completed]        <- markerless: THIS deployment ignores it
//	remove  [ft:stage/completed]     <- authoritative spelling, really removed
//
// completed sorts canonically FIRST, so unionStages appends the restored element
// behind wont_fix and the two orderings disagree even though the sets do not.
// Under the old elementwise SameStageSet that disagreement charged the edit BY
// ACCIDENT. Making SameStageSet a real set comparison — which D2a demands —
// removes the accident. This test asserts the price does not depend on that
// accident ever having been there.
//
// IMPACT IS ASSERTED, NOT JUST THE CODE. A denial that happens for the wrong
// reason, or a permit whose write turns out to be a no-op, would both let a
// broken gate look healthy. The read-back is the difference between an oracle
// and a wish.
// ─────────────────────────────────────────────────────────────────────────────

func TestPricingGate_MaskedRemovalOfCanonicallyFirstStageIsCharged(t *testing.T) {
	const kept = task.StageWontFix
	const removed = task.StageCompleted // canonically FIRST — the whole point

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
		t.Errorf("THE COPY WAS RIGHT — the real gate does NOT charge this vector.\n"+
			"  scopes held: %v  (task:accept and task:close deliberately absent)\n"+
			"  edit:        remove %v, add %v\n"+
			"  stage set:   %v -> %v   (%v still present? %v)\n"+
			"\n"+
			"IF THIS IS RED, DO NOT REPOINT priceOf. The monotonicity copy was "+
			"reporting a true under-pricing, the D1+D2b composition has a hole, and "+
			"repointing would convert a real finding into green. STOP AND REPORT.",
			agentScopes(), remove, add,
			[]task.Stage{kept, removed}, after, removed, stillThere)
		return
	}

	if st, _ := status.FromError(err); st.Code() != codes.PermissionDenied {
		t.Fatalf("the edit failed with %v (%s), which is not an authorization "+
			"answer. This measures pricing; a transport or validation failure "+
			"means the fixture is wrong, not that the gate held.",
			st.Code(), st.Message())
	}

	// IMPACT, THE OTHER HALF. A denial that still let the write land would be a
	// gate that reports correctly and protects nothing.
	if !stillThere {
		t.Errorf("DENIED BUT NOT PREVENTED — the gate returned PermissionDenied and "+
			"%v is gone from the authoritative stage set anyway (%v). The denial is "+
			"cosmetic.", removed, after)
	}
}

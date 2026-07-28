package server_test

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday is a CHARACTERIZATION
// test. It asserts a hole, not a fix.
//
// WHEN THIS TEST GOES RED, THE SEAM HAS BEEN CLOSED. Delete it — do not repair
// it, do not weaken it, and do not reach for t.Skip. A test that disappears
// instead of failing is a named defect class on this branch, and the whole
// point of writing this as an assertion on the CURRENT behaviour is that r7
// cannot close the seam without this test firing and forcing someone to notice.
//
// THE SEAM (#194 round 6, found while answering the B4-versus-A5 question;
// adjudicated to r7). The label-write gate in server.go reads:
//
//	if !store.SameStageSet(before, after) { ...charge every (from, to) pair... }
//
// It compares resolved stage SETS. Upstream, terminal_label_stages.go:120
// builds those sets as `present := make(map[task.Stage]bool)` — keyed by STAGE.
// Two distinct labels that resolve to the same stage collapse to one element,
// so removing one of them produces a byte-identical set, SameStageSet is true,
// the gate short-circuits, and the write costs nothing.
//
// It takes BOTH halves to fix. Removing the short-circuit alone does not help,
// because the stager is structurally incapable of reporting the change: it has
// already discarded which labels produced the stage. A correct fix needs a
// delta over LABELS rather than over resolved stages, which is a contract
// change spanning internal/server and internal/platform/github. That is why it
// is not being done here.
//
// NO CONFIG TRICKERY IS REQUIRED, WHICH IS THE UNCOMFORTABLE PART. I expected
// to need a custom cfg.Stages alias to construct two labels for one stage.
// stripForMatch (labels.go:542) strips the push prefix AND then strips a
// leading "stage/", so "ft:stage/completed" and "ft:completed" both key to
// "completed". Both clear the prefix gate in authorizationStage, both resolve
// to StageCompleted, and the collapse happens on stock defaults. The input
// below is reachable by anyone who can write labels.
func TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday(t *testing.T) {
	const (
		canonical = "ft:stage/completed"
		alias     = "ft:completed"
	)

	f := openIssue(t, canonical, alias)

	// PREMISE 1: the two labels really do collapse to a single-element set.
	// Without this the test could pass for the boring reason that the alias was
	// never recognised at all, which would make the whole thing vacuous.
	stages := f.lifecycleStages(t)
	if len(stages) != 1 || stages[0] != task.StageCompleted {
		t.Fatalf("PREMISE FAILED: labels %v resolve to %v, want the single-element "+
			"set [completed]. If the alias is no longer recognised this test is "+
			"vacuous and must be rewritten, not deleted", []string{canonical, alias}, stages)
	}

	// PREMISE 2: both labels are genuinely present on the issue. The collapse
	// must be in the stage resolution, not in the fixture quietly deduplicating.
	before := f.issue.currentLabels()
	if !containsLabel(before, canonical) || !containsLabel(before, alias) {
		t.Fatalf("PREMISE FAILED: issue carries %v, want both %q and %q",
			before, canonical, alias)
	}

	// PREMISE 3: this same removal IS gated when it changes the set. Removing
	// the last label naming a terminal stage costs task:accept, which is the
	// pre-existing round-5 control. If this arm ever stops denying, the
	// observation below stops being "the collapse is a hole" and becomes "label
	// removal is ungated generally" — a much larger finding wearing this test's
	// clothes.
	control := openIssue(t, canonical)
	if err := control.removeLabels(agentScopes(), canonical); err == nil {
		t.Fatalf("PREMISE FAILED: removing the ONLY terminal label was permitted on " +
			"bare task:write. The set-changing case is supposed to be gated, so the " +
			"seam below is not what this test thinks it is")
	}

	// THE SEAM. Identical removal, identical scopes, and the only difference is
	// that an aliased label is left behind holding the stage in place. The set
	// does not move, so nothing is charged.
	err := f.removeLabels(agentScopes(), canonical)
	if err != nil {
		t.Fatalf("SEAM CLOSED — THIS IS GOOD NEWS. Removing %q from an issue also "+
			"carrying %q was denied (%v). The two-labels-one-stage collapse at "+
			"terminal_label_stages.go:120 no longer slips past the SameStageSet "+
			"short-circuit in server.go. DELETE THIS TEST; it exists only to pin the "+
			"hole and to make sure closing it could not happen silently.",
			canonical, alias, err)
	}

	// And the write really landed: this is a destroyed label, not a no-op that
	// merely returned success.
	after := f.issue.currentLabels()
	if containsLabel(after, canonical) {
		t.Fatalf("permitted but %q is still present; labels %v. The seam is a FREE "+
			"WRITE, not a free refusal — if the write no-ops the impact assessment "+
			"changes and this test should be re-derived", canonical, after)
	}
	if !containsLabel(after, alias) {
		t.Fatalf("removing %q also removed %q; labels %v. That is a different and "+
			"worse bug than the one this test characterizes", canonical, alias, after)
	}

	// The stage set is unchanged, which is precisely why the gate said nothing.
	// This is the invariant the fix will have to break.
	if got := f.lifecycleStages(t); len(got) != 1 || got[0] != task.StageCompleted {
		t.Fatalf("stage set moved to %v after the removal; the premise that the gate "+
			"saw before == after does not hold and the mechanism above is wrong", got)
	}

	// IMPACT, measured rather than asserted in prose: the task is still terminal
	// and still unavailable, so a reader cannot tell this happened. That is what
	// makes the free write worth a round of its own — the audit trail for a
	// maintainer's completion decision lost a label and nothing observable moved.
	avail := f.availability(t)
	if avail.Available || !hasReason(avail.Reasons, store.AvailabilityReasonTerminal) {
		t.Fatalf("expected the task to remain terminal and unavailable after the "+
			"collapse write, got Available=%v Reasons=%v", avail.Available, avail.Reasons)
	}
}

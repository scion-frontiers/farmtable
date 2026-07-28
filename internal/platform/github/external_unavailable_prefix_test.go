package github

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestHasExternalUnavailableLabel_HonoursTheConfiguredPrefix is #194 A7.
//
// MEASURED AT ea8ac39: hasExternalUnavailableLabel stripped the hardcoded
// literal "ft:", so under push_prefix "acme:" the row
//
//	label = "acme:blocked"  ->  withheld = FALSE
//
// An operator's explicit hold was ignored and the task was handed to an agent,
// while "ft:blocked" — a namespace that deployment does not own — WAS honoured.
// Exactly backwards, and invisible to every test in the branch because no
// fixture varied push_prefix through this function.
//
// WHY THIS FUNCTION IS ALLOWED TO STAY PREFIX-TOLERANT, when B6 spent a whole
// round making the readers strict: it can only WITHHOLD. authorizationStage
// answers "may this label grant something?" and must refuse anything a third
// party can apply. This answers "does anyone want this held back?", where
// obeying a stranger costs an agent some work and never costs anyone a
// privilege. Same rule, different question, opposite correct answer — and the
// distinction is worth pinning because "make it consistent with
// authorizationStage" is the plausible-sounding wrong fix here.
func TestHasExternalUnavailableLabel_HonoursTheConfiguredPrefix(t *testing.T) {
	cases := []struct {
		name       string
		pushPrefix string
		label      string
		want       bool
		why        string
	}{
		{
			name: "default_prefixed", pushPrefix: "", label: "ft:blocked", want: true,
			why: "BASELINE: the spelling that already worked. If this breaks, the fix " +
				"removed a hold rather than adding one.",
		},
		{
			name: "default_stage_path", pushPrefix: "", label: "ft:stage/blocked", want: true,
			why: "BASELINE: the fullest spelling.",
		},
		{
			name: "bare", pushPrefix: "", label: "blocked", want: true,
			why: "BASELINE, and the deliberate part: a human who never heard of Farm " +
				"Table applying \"blocked\" is a signal to obey.",
		},
		{
			name: "custom_prefixed", pushPrefix: "acme:", label: "acme:blocked", want: true,
			why: "A7, THE DEFECT. Measured false at ea8ac39: the operator's own " +
				"namespace was the one spelling their deployment ignored.",
		},
		{
			name: "custom_stage_path", pushPrefix: "acme:", label: "acme:stage/deferred", want: true,
			why: "A7 again, with the stage/ segment and a different hold reason, so " +
				"the fix is not specific to one word.",
		},
		{
			name: "custom_prefix_uppercase_label", pushPrefix: "acme:", label: "ACME:Blocked", want: true,
			why: "the label is lowercased before matching, as everywhere else",
		},
		{
			name: "custom_prefix_uppercase_config", pushPrefix: "ACME:", label: "acme:blocked", want: true,
			why: "matchPrefix lowercases the CONFIGURED prefix too; if it did not, " +
				"push_prefix: \"ACME:\" would silently disarm this",
		},
		{
			name: "default_prefix_still_honoured_under_custom", pushPrefix: "acme:", label: "ft:blocked", want: true,
			why: "DELIBERATE and monotone: dropping this would REMOVE a hold some " +
				"issue may rely on. Widening a withhold-only predicate cannot grant " +
				"anything, so there is no reason to pay that cost.",
		},
		{
			name: "unrelated_label", pushPrefix: "acme:", label: "bug", want: false,
			why: "CONTROL. Without a false row this table is satisfied by a function " +
				"that returns true unconditionally.",
		},
		{
			name: "similar_but_not_a_hold", pushPrefix: "", label: "ft:stage/working", want: false,
			why: "CONTROL: a prefixed stage label that is not a hold reason.",
		},
		{
			name: "prefix_only_no_reason", pushPrefix: "acme:", label: "acme:", want: false,
			why: "CONTROL: stripping the prefix must not leave something that matches.",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := DefaultConfig().GitHub.Labels
			cfg.PushPrefix = tc.pushPrefix
			m := NewLabelMapper(cfg)

			if got := m.hasExternalUnavailableLabel([]string{tc.label}); got != tc.want {
				t.Errorf("hasExternalUnavailableLabel([%q]) = %v, want %v under "+
					"push_prefix %q\nwhy: %s", tc.label, got, tc.want, tc.pushPrefix, tc.why)
			}
		})
	}
}

// TestHasExternalUnavailableLabel_NilMapperKeepsThePreRoundSixSpellings pins
// the fallback, because the round-6 change made this a method and every
// zero-value store and bare tree-walk test now reaches it through a nil
// receiver. A nil mapper that withheld nothing would silently disable holds in
// exactly the paths nobody looks at.
func TestHasExternalUnavailableLabel_NilMapperKeepsThePreRoundSixSpellings(t *testing.T) {
	var m *LabelMapper

	for _, label := range []string{"blocked", "ft:blocked", "ft:stage/waiting_for_input", "deferred"} {
		if !m.hasExternalUnavailableLabel([]string{label}) {
			t.Errorf("nil mapper: %q no longer withholds; the receiver change silently "+
				"disabled a hold", label)
		}
	}
	if m.hasExternalUnavailableLabel([]string{"bug"}) {
		t.Error("CONTROL BROKEN: nil mapper withholds on an unrelated label, so the " +
			"assertions above are satisfied by a function that returns true")
	}
}

// TestExternalUnavailableLabel_ReachesBothPrivilegePathsUnderACustomPrefix is
// the point of A7: the mapper-level table above would be satisfied even if
// nothing threaded the mapper down to the gates. Round 6 changed four call-site
// signatures to make that threading possible, and this is what proves the
// threading happened rather than merely compiling.
func TestExternalUnavailableLabel_ReachesBothPrivilegePathsUnderACustomPrefix(t *testing.T) {
	ctx := context.Background()

	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = "acme:"

	fake := newFakeIssueRepo(t, "acme:stage/accepted", "acme:blocked")
	fake.registerLabel("acme:stage/accepted")
	fake.registerLabel("acme:blocked")
	s := fake.storeWithLabelConfig(cfg)

	tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{"acme:stage/accepted", "acme:blocked"}}

	avail, err := s.ComputeAvailability(ctx, tk)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if avail.Available {
		t.Errorf("available = true for a task labelled acme:blocked under push_prefix "+
			"acme: (reasons %v); the operator's own hold namespace must reach the "+
			"availability gate", avail.Reasons)
	}
	if !avail.HasReason(store.AvailabilityReasonHeld) {
		t.Errorf("reasons = %v, want to contain %q", avail.Reasons, store.AvailabilityReasonHeld)
	}

	if !issueUnavailableForClaim(s.mapper, &issueNode{}, tk, s.LifecycleStage(ctx, tk)) {
		t.Error("the claim gate would hand out a task labelled acme:blocked under " +
			"push_prefix acme:. The two gates must agree about what unavailable means.")
	}

	// CONTROL, same store and same configuration, hold label removed. Without
	// it, a gate that refuses every acme: task satisfies both assertions above.
	live := &ent.Task{Stage: task.StageAccepted, Labels: []string{"acme:stage/accepted"}}
	liveAvail, err := s.ComputeAvailability(ctx, live)
	if err != nil {
		t.Fatalf("ComputeAvailability(control): %v", err)
	}
	if !liveAvail.Available {
		t.Fatalf("CONTROL BROKEN: the same task without the hold label is still "+
			"unavailable (reasons %v); nothing above is attributable to the hold",
			liveAvail.Reasons)
	}
	if issueUnavailableForClaim(s.mapper, &issueNode{}, live, s.LifecycleStage(ctx, live)) {
		t.Fatal("CONTROL BROKEN: the claim gate refuses the task with the hold label removed")
	}
}

// TestComputeReadyAndBlocked_HonourTheConfiguredHoldPrefix covers the other two
// call sites the round-6 signature change threaded. computeReady and
// computeBlocked feed `ft ready` and `ft blocked`, so a hold this walk cannot
// see is a task an operator withheld and an agent is offered anyway.
func TestComputeReadyAndBlocked_HonourTheConfiguredHoldPrefix(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = "acme:"
	m := NewLabelMapper(cfg)

	nodes := parentWithClosedChild(task.StageAccepted)

	// CONTROL FIRST: without the hold label this parent IS ready, so the
	// disappearance below is caused by the label and not by the fixture.
	if got := readyNumbers(computeReady(m, nodes, false)); len(got) != 1 || got[0] != 1 {
		t.Fatalf("CONTROL BROKEN: computeReady = %v without any hold label, want [1]", got)
	}
	if got := computeBlocked(m, nodes); len(got) != 0 {
		t.Fatalf("CONTROL BROKEN: computeBlocked = %d results without a hold label, want 0", len(got))
	}

	nodes[1].Labels = append(nodes[1].Labels, "acme:blocked")

	if got := readyNumbers(computeReady(m, nodes, false)); len(got) != 0 {
		t.Errorf("computeReady = %v for a node labelled acme:blocked under push_prefix "+
			"acme:, want none", got)
	}
	blocked := computeBlocked(m, nodes)
	if len(blocked) != 1 || blocked[0].Node.Number != 1 {
		t.Errorf("computeBlocked = %v, want issue 1 flagged as explicitly unavailable", blocked)
	}
}

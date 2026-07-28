package github

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestComputeReady_IsNotBlindedByAMaskingLabel is #194 A7's second half: the
// tree walk was a FOURTH consumer of the round-3 masking defect and no round
// had counted it.
//
// The enumeration that missed it looked at the two privilege gates and at
// LabelDeltaLifecycleStages, because those are where authorization happens.
// computeReady is not an authorization gate — it is the scheduler behind
// `ft ready` — so it was never on the list. But it answers the same underlying
// question ("can this be worked on?") off the same labels, and it answered it
// through MapLabelsToStage, the display collapse. stagePrecedence ranks every
// non-terminal stage above every terminal one, so one extra label hid the
// terminal one exactly as it did in round 3.
//
// MEASURED BEFORE THE FIX, on an open parent whose only child is closed:
//
//	labels                            node.Stage  offered as ready?
//	[ft:stage/completed]              completed   no
//	[ft:stage/completed, working]     working     YES   <- one BARE label
//	[ft:stage/completed, ...accepted] accepted    YES
//
// The middle row is the one that matters. "working" carries no push prefix, so
// under B6 it is a label anyone can apply and nothing may trust — and applying
// it took a completed task and handed it back to an agent as ready work. The
// third row needs a prefixed label and therefore task:write, which is a
// narrower door but the same defect.
//
// The table is rooted in the terminal-stage ENUM rather than hand-picked,
// because on this branch a hand-picked table is how the cell that mattered went
// missing three separate times.
//
// MUTATION RECORD. The withhold is a `continue` at the top of a loop, which is
// the shape that fixes one case and quietly deletes the feature. Both
// directions were injected, run, and the tree restored and sha256-verified
// against a pristine copy:
//
//	MUT   defect injected                          masking  StillOffers  prefix-gate
//	A7    withhold removed entirely (pre-fix)      RED      green        RED
//	A7b   withhold refuses every node              green    RED          RED
//
// Neither test alone distinguishes a correct withhold from no withhold and from
// a total one. That is the point of running both: A7b is invisible to the
// masking table, because a walk that offers nothing satisfies every "must not
// be offered" assertion in it.
func TestComputeReady_IsNotBlindedByAMaskingLabel(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	// Masking labels: one bare (anyone can apply it) and one prefixed (needs
	// task:write). Both must fail to unmask.
	maskers := map[string]string{
		"bare_masking_label":     "working",
		"prefixed_masking_label": "ft:stage/accepted",
	}

	for _, terminal := range terminalStages(t) {
		terminalLabel := m.StageToLabel(terminal)

		for maskName, masker := range maskers {
			t.Run(string(terminal)+"/"+maskName, func(t *testing.T) {
				labels := []string{terminalLabel, masker}

				// PRECONDITION, asserted rather than assumed: the masking label
				// really does move the display collapse. If it did not, this case
				// would pass without exercising the defect at all.
				collapsed, _ := m.MapLabelsToStage(labels)
				if store.IsTerminalStage(collapsed) {
					t.Fatalf("PRECONDITION FAILED: MapLabelsToStage(%v) = %q, still "+
						"terminal, so %q does not mask and this case proves nothing",
						labels, collapsed, masker)
				}
				if got := m.AllTerminalLabelStages(labels); len(got) != 1 || got[0] != terminal {
					t.Fatalf("PRECONDITION FAILED: AllTerminalLabelStages(%v) = %v, "+
						"want [%s]", labels, got, terminal)
				}

				nodes := parentWithClosedChild(collapsed)
				nodes[1].Labels = labels

				for _, includeUnblocked := range []bool{false, true} {
					got := readyNumbers(computeReady(m, nodes, includeUnblocked))
					if len(got) != 0 {
						t.Errorf("computeReady(includeUnblocked=%v) = %v for an open "+
							"issue labelled %v. The %s label masked the terminal one and "+
							"the task was offered as ready work.",
							includeUnblocked, got, labels, maskName)
					}
				}
			})
		}
	}
}

// TestComputeReady_StillOffersRealWork is the control for the test above, and
// it is doing more work than a control usually does: "returns nothing" is
// trivially satisfied by a walk that offers nothing at all, and the fix is a
// `continue` at the top of the loop, which is exactly the shape that overshoots.
func TestComputeReady_StillOffersRealWork(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	cases := []struct {
		name             string
		labels           []string
		stage            task.Stage
		includeUnblocked bool
		want             []int
	}{
		{
			name: "accepted_with_no_labels", stage: task.StageAccepted,
			want: []int{1},
		},
		{
			name: "accepted_with_its_own_label", stage: task.StageAccepted,
			labels: []string{"ft:stage/accepted"}, want: []int{1},
		},
		{
			name: "accepted_with_unrelated_labels", stage: task.StageAccepted,
			labels: []string{"bug", "p1", "needs-design"}, want: []int{1},
		},
		{
			name: "unblocked_candidate", stage: task.StageWorking,
			labels: []string{"ft:stage/working"}, includeUnblocked: true, want: []int{1},
		},
		{
			name: "bare_terminal_label_does_not_withhold", stage: task.StageAccepted,
			labels: []string{"ft:stage/accepted", "duplicate"}, want: []int{1},
			// B6 again, and deliberately asymmetric with hasExternalUnavailableLabel:
			// a stock "duplicate" a human applied is not ours and must not decide a
			// terminal question. It CAN still withhold through the hold-label path,
			// which is a different question with a different correct answer.
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			nodes := parentWithClosedChild(tc.stage)
			nodes[1].Labels = tc.labels

			got := readyNumbers(computeReady(m, nodes, tc.includeUnblocked))
			if len(got) != len(tc.want) {
				t.Fatalf("computeReady = %v, want %v: the A7 withhold is over-broad "+
					"and is now suppressing real work", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("computeReady = %v, want %v", got, tc.want)
				}
			}
		})
	}
}

// TestComputeReady_TerminalWithholdIsPrefixGated pins the half of A7 that is
// easy to get backwards. The withhold reads authoritative labels only, so a
// third party cannot use it to hide work from the queue — they can only ask for
// a hold, through hasExternalUnavailableLabel, which is prefix-tolerant on
// purpose. Withhold-only predicates may be generous; terminal determinations
// may not.
func TestComputeReady_TerminalWithholdIsPrefixGated(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = "acme:"
	m := NewLabelMapper(cfg)

	nodes := parentWithClosedChild(task.StageAccepted)
	nodes[1].Labels = []string{"acme:stage/accepted", "ft:stage/completed"}

	// "ft:stage/completed" is a FOREIGN namespace here: this deployment's prefix
	// is "acme:". It must not decide terminality.
	if got := readyNumbers(computeReady(m, nodes, false)); len(got) != 1 || got[0] != 1 {
		t.Errorf("computeReady = %v, want [1]: a terminal label in a namespace this "+
			"deployment does not own withheld the task, which lets any third party "+
			"empty the ready queue", got)
	}

	// CONTROL: the same label in the deployment's OWN namespace does withhold.
	nodes[1].Labels = []string{"acme:stage/accepted", "acme:stage/completed"}
	if got := readyNumbers(computeReady(m, nodes, false)); len(got) != 0 {
		t.Errorf("computeReady = %v, want none: the withhold does not fire on the "+
			"configured prefix, so the assertion above passes for the wrong reason", got)
	}
}

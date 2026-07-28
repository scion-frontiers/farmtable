package github

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// MUTATION RECORD for this file (#194 round 6, leg A). Every test below was
// shown RED against a defect before it was trusted green. Content-addressed
// edits, each restored and sha256-verified against an out-of-repo pristine copy.
//
//	MUT  defect injected                                    tripwire  F3 pairs  F3 control
//	1    claim gate returns false for StageDuplicate         RED       RED       green
//	2    availability gate skips terminal for StageWontFix   RED       RED       green
//	3    LifecycleStage falls back to t.Stage when >1         green     RED (12)  green
//	     terminal label is present (fail-open)
//	4    claim gate refuses unconditionally                   RED       green     RED
//	5    terminalStagePrecedence reversed                     green     green     green
//
// Read the columns, because the shape of the table is the argument:
//
//   - MUT 3 is invisible to the tripwire and caught by nothing else in the
//     repository. The tripwire uses single-terminal fixtures by construction,
//     so a multi-terminal fail-open cannot reach it. That is why F3 exists as a
//     separate test rather than more rows in the first one.
//
//   - MUT 4 is the reverse: a gate that refuses everything satisfies every
//     "both refused" assertion in F3. Only the controls see it. This is the
//     concrete reason the positive controls are not ceremony.
//
//   - MUT 5 staying green three times is a POSITIVE result, not a gap. F3's
//     claim is that the two gates are BLIND to the tiebreak order; if reversing
//     the order changed an answer, the claim would be false. Note this is the
//     probe the round-5 reviewer ran first, saw pass, and correctly refused to
//     read as evidence — because at ea8ac39 no fixture could express two
//     terminal labels, so nothing was looking. It means something now only
//     because MUT 3 shows the same tests go red when the answer really moves.
//
//     What this table did NOT record, and should have (#194 round 7, T-F4):
//     MUT 5 is caught OUTSIDE this file, by TestTerminalLabelStage_Cardinality,
//     which spells the expected winner of each terminal pair as a literal. A
//     green row here therefore means "these gates are order-blind", not "no
//     test sees this mutation". Round 6 left the first reading available and
//     the winnersSeen comment then asserted the second.
//
//   - F3 was FIRST WRITTEN with three hand-picked label pairs and caught MUT 1
//     but NOT MUT 2: with terminalStagePrecedence = [completed wont_fix
//     duplicate cancelled], none of the three picked pairs had wont_fix as the
//     tiebreak winner. Enumerating all 12 ordered pairs from the enum caught it.
//     The hand-picked list was not wrong about any cell; it just could not
//     express the one that mattered, which is this workstream's whole defect
//     class showing up inside the fix for it.

// TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer is the
// TRIPWIRE for review F1.
//
// GitHubPassThroughStore.LifecycleStage returns ONE terminal stage where an
// issue may name several, chosen by the terminalStagePrecedence tiebreak. Its
// two consumers — the claim gate and the availability gate — are both
// privilege paths, and both are safe only because neither branches on WHICH
// terminal stage it got. Round 5 relied on that and wrote it down nowhere; the
// comment it did write claimed the opposite (that privilege-path callers use
// the set-valued reader), which is false of both actual callers.
//
// A comment saying "if you add a branching consumer, this breaks" is an
// assumption with an expiration date nobody set. This test sets it.
//
// THE PROPERTY, stated so it is falsifiable: for every pair of terminal stages
// S and T, each consumer's answer on a task whose terminal label names S must
// equal its answer when it names T. Enumerated from the enum via
// terminalStages, so a terminal stage added to the data model joins this
// matrix automatically rather than being silently exempt.
//
// WHAT MAKES IT FAIL: someone gives issueUnavailableForClaim or
// ComputeAvailability a branch that distinguishes wont_fix from duplicate —
// a distinct denial reason is the natural one. The moment that lands, the
// answers stop agreeing and this goes red, at the gate, before the tiebreak
// order silently becomes an access-control parameter.
//
// WHAT IT DELIBERATELY DOES NOT CLAIM: it does not prove no third consumer
// exists. It pins the two that do. A new consumer of LifecycleStage is not
// caught here unless it is added to this test — which is why the doc comment
// on LifecycleStage tells you to use LifecycleStages instead. See Limitations
// in the round-6 leg-A log entry.
func TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer(t *testing.T) {
	ctx := context.Background()

	terminals := terminalStages(t)
	if len(terminals) < 2 {
		t.Fatalf("only %d terminal stages; this test needs at least two to compare", len(terminals))
	}

	type answer struct {
		claimRefused   bool
		available      bool
		terminalReason bool
	}

	observe := func(t *testing.T, stage task.Stage) answer {
		t.Helper()
		label := "ft:stage/" + stage.String()

		fake := newFakeIssueRepo(t, label)
		s := fake.store()

		// BASELINE: the label must genuinely be on the issue and must genuinely
		// read as this terminal stage. Without this the "answers agree" result
		// below could be agreement on a fixture that expresses nothing.
		if !fake.hasLabel(label) {
			t.Fatalf("fixture lost %q; labels = %v", label, fake.labels)
		}
		tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{label}}
		if got := s.LifecycleStage(ctx, tk); got != stage {
			t.Fatalf("BASELINE BROKEN: LifecycleStage for %q = %q, want %q; the fixture "+
				"is not presenting the stage this row is meant to vary", label, got, stage)
		}

		avail, err := s.ComputeAvailability(ctx, tk)
		if err != nil {
			t.Fatalf("ComputeAvailability(%s): %v", stage, err)
		}

		issue := &issueNode{}
		return answer{
			claimRefused:   issueUnavailableForClaim(s.mapper, issue, tk, s.LifecycleStage(ctx, tk)),
			available:      avail.Available,
			terminalReason: avail.HasReason(store.AvailabilityReasonTerminal),
		}
	}

	first := terminals[0]
	want := observe(t, first)

	for _, stage := range terminals[1:] {
		got := observe(t, stage)
		if got != want {
			t.Errorf("CONSUMER NOW DISCRIMINATES BETWEEN TERMINAL STAGES.\n"+
				"  %s -> %+v\n  %s -> %+v\n\n"+
				"LifecycleStage returns ONE terminal stage chosen by the "+
				"terminalStagePrecedence tiebreak. That was safe only while every "+
				"consumer collapsed all terminal stages to one boolean. A consumer "+
				"now branches on which one, so an authorization answer depends on a "+
				"tiebreak order — which is exactly the B5 defect, reopened at a gate.\n\n"+
				"Fix the CONSUMER, not this test: read LifecycleStages and decide "+
				"against the whole set. Only update this test if you have made the "+
				"consumer set-valued and the collapse no longer applies.",
				first, want, stage, got)
		}
	}

	// POSITIVE CONTROL. "All terminal stages agree" is worthless if the
	// consumers return the same answer for everything. A non-terminal stage
	// must produce the OPPOSITE answer, or this test cannot see a difference
	// at all and its agreement above is vacuous.
	fake := newFakeIssueRepo(t, "ft:stage/accepted")
	s := fake.store()
	live := &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:stage/accepted"}}
	liveAvail, err := s.ComputeAvailability(ctx, live)
	if err != nil {
		t.Fatalf("ComputeAvailability(control): %v", err)
	}
	control := answer{
		claimRefused:   issueUnavailableForClaim(s.mapper, &issueNode{}, live, s.LifecycleStage(ctx, live)),
		available:      liveAvail.Available,
		terminalReason: liveAvail.HasReason(store.AvailabilityReasonTerminal),
	}
	// Checked FIELD BY FIELD, not as a struct. `control != want` would be
	// satisfied by one field moving, which would leave the other consumer free
	// to be a constant function while the agreement above still "passed" for
	// it. Each consumer must independently be shown capable of two answers.
	if control.claimRefused == want.claimRefused {
		t.Errorf("CONTROL BROKEN: the CLAIM GATE returns %v for both a terminal and a "+
			"non-terminal task. It is a constant here, so the per-stage agreement "+
			"asserted above proves nothing about it", control.claimRefused)
	}
	if control.available == want.available {
		t.Errorf("CONTROL BROKEN: the AVAILABILITY GATE returns available=%v for both a "+
			"terminal and a non-terminal task. It is a constant here, so the per-stage "+
			"agreement asserted above proves nothing about it", control.available)
	}
	if control.terminalReason == want.terminalReason {
		t.Errorf("CONTROL BROKEN: reason %q is present=%v for both a terminal and a "+
			"non-terminal task", store.AvailabilityReasonTerminal, control.terminalReason)
	}
}

// TestSingularSinksAreBlindToTheTerminalTiebreak is review F3: the end-to-end
// cell nothing in the branch had.
//
// The two singular sinks — ClaimTask and ComputeAvailability — were never
// driven with TWO terminal labels. With one terminal label the tiebreak has
// nothing to choose between, so every existing test was structurally incapable
// of observing the choice it makes. The reviewer's first probe for this was
// "reverse terminalStagePrecedence and see if anything fails"; nothing did,
// and that proved nothing, because no fixture could express the input.
//
// This constructs that input directly, over EVERY ordered pair of distinct
// terminal stages taken from the enum rather than a hand-picked few. Ordered,
// not unordered, because label application order is the one thing an attacker
// controls for free; enumerated, because a hand-picked list is how the fixture
// gap got here. Each pair names two distinct terminal stages, so
// terminalStagePrecedence genuinely picks a winner, and both gates must refuse
// regardless of which one it picks.
//
// MEASURED, so the coverage claim is not a guess: with
// terminalStagePrecedence = [completed wont_fix duplicate cancelled], the 12
// ordered pairs produce completed, wont_fix and duplicate as tiebreak winners.
// cancelled is last in the order and therefore never wins a pair — it is
// covered as a lone terminal label elsewhere, and by the per-stage tripwire
// above.
//
// THAT SPECIFIC ORDER IS NOT PINNED HERE, and the round-6 version of this
// paragraph claimed it was ("the winnersSeen assertion at the end fails if that
// ever stops holding"). It does not. MEASURED (#194 round 7, T-F4): reversing
// terminalStagePrecedence to [cancelled duplicate wont_fix completed] leaves
// this whole test GREEN, exit 0. The winnersSeen block is invariant under every
// permutation of the order — see the comment on it for what it does pin. The
// order itself is pinned by TestTerminalLabelStage_Cardinality, which the same
// reversal turns RED. This is a mis-attribution being corrected, not a coverage
// hole: the condition is caught, just not here.
func TestSingularSinksAreBlindToTheTerminalTiebreak(t *testing.T) {
	ctx := context.Background()

	terminals := terminalStages(t)
	if len(terminals) < 2 {
		t.Fatalf("only %d terminal stages; this test needs at least two", len(terminals))
	}

	var pairs [][]string
	for _, a := range terminals {
		for _, b := range terminals {
			if a != b {
				pairs = append(pairs, []string{"ft:stage/" + a.String(), "ft:stage/" + b.String()})
			}
		}
	}

	winnersSeen := map[task.Stage]bool{}

	for _, labels := range pairs {
		t.Run(labels[0]+"+"+labels[1], func(t *testing.T) {
			fake := newFakeIssueRepo(t, labels...)
			s := fake.store()

			// BASELINE 1: the fixture really carries both labels.
			for _, l := range labels {
				if !fake.hasLabel(l) {
					t.Fatalf("fixture lost %q; labels = %v", l, fake.labels)
				}
			}

			tk := &ent.Task{ID: uuid.New(), Stage: task.StageAccepted, Labels: labels}

			// BASELINE 2 — the one that makes this test non-vacuous. The set
			// reader must see BOTH stages. If it sees one, the tiebreak has
			// nothing to choose and the assertions below are the
			// single-terminal case wearing two labels.
			all := s.mapper.AllTerminalLabelStages(labels)
			if len(all) != 2 {
				t.Fatalf("BASELINE BROKEN: AllTerminalLabelStages(%v) = %v, want 2 distinct "+
					"terminal stages. Without two, the tiebreak is not exercised and this "+
					"test does not test what it says", labels, all)
			}

			// BASELINE 3: the tiebreak really does collapse them to one, so
			// there is a choice being made that these gates must be blind to.
			winner := s.LifecycleStage(ctx, tk)
			if !store.IsTerminalStage(winner) {
				t.Fatalf("BASELINE BROKEN: LifecycleStage = %q, not terminal", winner)
			}
			winnersSeen[winner] = true

			// The claim gate must refuse, whichever stage won.
			if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err == nil {
				t.Errorf("labels=%v (tiebreak winner %q): ClaimTask succeeded, want refusal. "+
					"An issue naming two terminal stages must not be claimable under either",
					labels, winner)
			}

			// The availability gate must refuse, whichever stage won.
			avail, err := s.ComputeAvailability(ctx, tk)
			if err != nil {
				t.Fatalf("labels=%v: ComputeAvailability: %v", labels, err)
			}
			if avail.Available {
				t.Errorf("labels=%v (tiebreak winner %q): available=true, want false "+
					"(reasons %v)", labels, winner, avail.Reasons)
			}
			if !avail.HasReason(store.AvailabilityReasonTerminal) {
				t.Errorf("labels=%v: reasons = %v, want to contain %q", labels,
					avail.Reasons, store.AvailabilityReasonTerminal)
			}
		})
	}

	// ENUMERATION PIN — and NOT a precedence pin. Read the assertion before
	// trusting the name it used to have.
	//
	// What it pins: that the 12 pairs really did exercise 3 distinct tiebreak
	// winners rather than one winner wearing twelve names, that every terminal
	// stage reachable as a winner was reached, and that the tiebreak behaves
	// like a TOTAL ORDER — exactly one stage, the last, can never win a pair.
	// A terminal stage missing from terminalStagePrecedence never wins and is
	// caught here; a pair enumeration that stopped being total is caught here.
	//
	// What it does NOT pin, stated because the round-6 comment claimed it did:
	// WHICH order. Everything below is written in terms of
	// terminalStagePrecedence's own last element, so it holds under every
	// permutation of that slice. MEASURED (#194 round 7, T-F4): reversing the
	// order leaves this block GREEN. The order is pinned by
	// TestTerminalLabelStage_Cardinality, whose literal expectations the same
	// reversal turns RED. Do not add a precedence assertion here to "fix" that —
	// it would be redundant coverage, and the two tests would then have to be
	// kept in step for no gain.
	last := terminalStagePrecedence[len(terminalStagePrecedence)-1]
	for _, stage := range terminals {
		if stage == last {
			if winnersSeen[stage] {
				t.Errorf("%q is last in terminalStagePrecedence yet won a pair; the "+
					"tiebreak is not the total order this test's reasoning assumes", stage)
			}
			continue
		}
		if !winnersSeen[stage] {
			t.Errorf("terminal stage %q never won a tiebreak across all %d ordered pairs, "+
				"so no assertion above exercised it as the selected stage. Either the "+
				"precedence order changed or the pair enumeration stopped being total",
				stage, len(pairs))
		}
	}
}

// TestSingularSinksAreBlindToTheTerminalTiebreak_PositiveControl is the
// control the test above needs: the same harness, the same two gates, on a
// task that IS claimable and available. Without it, "both gates refused" is
// consistent with a harness that refuses everything — which is the exact
// vacuity that let F1's unstated invariant survive round 5.
func TestSingularSinksAreBlindToTheTerminalTiebreak_PositiveControl(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/accepted")
	s := fake.store()

	tk := &ent.Task{ID: uuid.New(), Stage: task.StageAccepted, Labels: []string{"ft:stage/accepted"}}

	avail, err := s.ComputeAvailability(ctx, tk)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if !avail.Available {
		t.Fatalf("CONTROL BROKEN: an accepted task is not available (reasons %v); every "+
			"refusal asserted by the multi-terminal test is therefore unattributable",
			avail.Reasons)
	}

	if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err != nil {
		t.Fatalf("CONTROL BROKEN: ClaimTask refused an accepted task: %v; the claim gate "+
			"refuses everything and the multi-terminal refusals prove nothing", err)
	}
	// And the claim actually did something, rather than succeeding vacuously.
	if !fake.hasLabel("ft:stage/working") {
		t.Errorf("CONTROL WEAK: ClaimTask succeeded but did not stamp ft:stage/working; "+
			"labels = %v", fake.labels)
	}
}

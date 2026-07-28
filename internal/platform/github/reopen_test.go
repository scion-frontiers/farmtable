package github

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	githubv4 "github.com/shurcooL/githubv4"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestAudit_ReopenAfterCloseIsDisplayedOpenButNotScheduled is audit-194 F2's
// reproduction, committed as a permanent regression test and NARROWED in the
// round-3 fix pass. Read the whole comment before changing either half: the two
// halves assert deliberately opposite things.
//
// Before #194, ft close left ft:stage/working on the issue. #194 made it write
// a terminal stage label instead — and reopening an issue is an ordinary GitHub
// operation which, in a pass-through collection where GitHub is the UI, happens
// entirely outside Farm Table. GitHub sets state=OPEN and clears closedAt on
// reopen; it does not touch labels. F2's response was to demote (open, terminal
// label) to (open, accepted) everywhere.
//
// Round-2 review found that demotion reaching two places it must not: the RBAC
// transition gate, where it downgraded reopening a wont_fix issue from
// task:accept to task:write, and computed availability, where it presented work
// a maintainer had declined as available. The ruling was to split the field's
// two jobs: the demotion stands for DISPLAY, and authorization and scheduling
// read the un-demoted, label-derived stage.
//
// So this test now asserts BOTH:
//
//   - DISPLAY (F2's surviving half): the task reads back as open/accepted with
//     no ClosedAt. Nothing tells a human this work is finished.
//   - SCHEDULING (the round-3 narrowing): it is NOT offered as available work.
//
// The honest cost, stated plainly because the report must carry it: OPEN plus a
// terminal label is produced both by a legitimate reopen (this test) and by a
// maintainer declining an open issue. Labels and issue state alone cannot tell
// them apart, so scheduling now takes the conservative branch for both, and a
// genuine reopen needs its stale terminal label cleared before it is offered
// again. Absence from a queue is recoverable; handing an agent work that was
// explicitly declined is not. Distinguishing the two cases properly — GitHub's
// stateReason=REOPENED is the candidate signal — is #203, not this branch.
func TestAudit_ReopenAfterCloseIsDisplayedOpenButNotScheduled(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/working")
	s := fake.store()
	id := s.issueUUID(1)

	if _, err := s.CloseTask(ctx, id, task.StageCompleted, "", uuid.Nil); err != nil {
		t.Fatalf("CloseTask: %v", err)
	}
	if !fake.hasLabel("ft:stage/completed") {
		t.Fatalf("precondition: close did not write the terminal label; labels = %v", fake.labels)
	}

	// A human reopens the issue on GitHub: state flips back and closedAt is
	// cleared, but the terminal stage label stays exactly where it was.
	fake.state, fake.closedAt, fake.stateReason = "OPEN", "", ""

	readBack, err := s.GetTask(ctx, id)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if readBack.ClosedAt != nil {
		t.Errorf("ClosedAt = %v for a reopened issue, want nil", readBack.ClosedAt)
	}

	// ── Display half: the demotion still applies. ──
	if readBack.Stage != task.StageAccepted {
		t.Errorf("reopened issue reports stage = %s, want %s (the F2 demotion is a display "+
			"decision and still stands)", readBack.Stage, task.StageAccepted)
	}
	if readBack.Phase != task.PhaseOpen {
		t.Errorf("reopened issue reports phase = %s, want %s", readBack.Phase, task.PhaseOpen)
	}

	// ── Scheduling half: the terminal label is honoured. ──
	availability, err := s.ComputeAvailability(ctx, readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if availability.Available {
		t.Fatalf("an OPEN issue still carrying a terminal stage label is offered as available "+
			"work; the demotion must not reach computed availability, or a maintainer's "+
			"wont_fix is laundered into claimable work (stage = %s, reasons = %v)",
			readBack.Stage, availability.Reasons)
	}
	if !availability.HasReason(store.AvailabilityReasonTerminal) {
		t.Errorf("availability reasons = %v, want to contain %q so the caller can tell WHY "+
			"the work is withheld", availability.Reasons, store.AvailabilityReasonTerminal)
	}
}

// TestIssueToPhaseStage_OpenIssueMayNotHoldTerminalStage is the symmetric rule
// on its own, across every terminal stage and both label spellings. An open
// issue's stage is label-derived; GitHub's open state is not, so the label
// must not win.
//
// This also covers audit-194 F7: the same end state is reachable without any
// close at all, via ft update --stage completed on an issue that stays open.
func TestIssueToPhaseStage_OpenIssueMayNotHoldTerminalStage(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	for _, stage := range []task.Stage{
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	} {
		for _, label := range []string{"ft:stage/" + stage.String(), stage.String()} {
			t.Run(stage.String()+"/"+label, func(t *testing.T) {
				phase, got := m.IssueToPhaseStage("OPEN", "", []string{label})
				if got != task.StageAccepted {
					t.Errorf("IssueToPhaseStage(OPEN, %q) stage = %s, want %s", label, got, task.StageAccepted)
				}
				if phase != task.PhaseOpen {
					t.Errorf("IssueToPhaseStage(OPEN, %q) phase = %s, want %s", label, phase, task.PhaseOpen)
				}
			})
		}
	}
}

// TestIssueToPhaseStage_OpenIssueKeepsNonTerminalStage stops the symmetric rule
// being over-broad. Only terminal labels are demoted; every non-terminal stage
// label must still win on an open issue, or ClaimTask and the ready walk lose
// the ability to see working, in_review, in_qa and deploying at all.
func TestIssueToPhaseStage_OpenIssueKeepsNonTerminalStage(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	for _, stage := range []task.Stage{
		task.StageTriage,
		task.StageAccepted,
		task.StageWorking,
		task.StageInReview,
		task.StageInQa,
		task.StageDeploying,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			_, got := m.IssueToPhaseStage("OPEN", "", []string{"ft:stage/" + stage.String()})
			if got != stage {
				t.Errorf("IssueToPhaseStage(OPEN, %s) stage = %s, want %s", stage, got, stage)
			}
		})
	}
}

// TestIssueToPhaseStage_ClosedIssueKeepsTerminalStage is the other guard against
// over-breadth: the demotion must be conditioned on the issue being open. A
// closed issue's terminal label still selects the specific terminal stage, so
// wont_fix does not silently become completed.
func TestIssueToPhaseStage_ClosedIssueKeepsTerminalStage(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	for _, stage := range []task.Stage{
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			phase, got := m.IssueToPhaseStage("CLOSED", "completed", []string{"ft:stage/" + stage.String()})
			if got != stage {
				t.Errorf("IssueToPhaseStage(CLOSED, %s) stage = %s, want %s", stage, got, stage)
			}
			if phase != task.PhaseClosed {
				t.Errorf("IssueToPhaseStage(CLOSED, %s) phase = %s, want %s", stage, phase, task.PhaseClosed)
			}
		})
	}
}

// TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable checks that the
// enforcement path agrees with the advisory one. issueUnavailableForClaim's own
// doc comment states the invariant: it "is the enforcement counterpart to
// ComputeAvailability [...] and the two must not disagree about what
// 'unavailable' means." Availability withholding a terminal-labelled open issue
// while ClaimTask handed it out would be exactly that disagreement.
//
// This inverts the assertion F2 originally committed here
// (TestPassThroughClaimTask_ReopenedIssueIsClaimable). See
// TestAudit_ReopenAfterCloseIsDisplayedOpenButNotScheduled for the reasoning and
// the cost; the short version is that a claim is the point where an agent is
// actually handed the work, so it is the last place the demotion should reach.
//
// The bare stock `duplicate` row that used to live in this table has moved to
// TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal below, and now
// asserts the opposite. See there for the ruling and the reasoning; the table
// here is deliberately all-prefixed so that it remains the positive control for
// that inversion.
func TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable(t *testing.T) {
	for _, label := range []string{
		"ft:stage/completed",
		"ft:stage/wont_fix",
		"ft:stage/duplicate",
		"ft:stage/cancelled",
	} {
		t.Run(label, func(t *testing.T) {
			ctx := context.Background()

			// The state both a reopen and a maintainer's decline leave behind:
			// open on GitHub, terminal label intact.
			fake := newFakeIssueRepo(t, label)
			s := fake.store()

			_, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), "")
			if !errors.Is(err, store.ErrUnavailable) {
				t.Fatalf("ClaimTask on an OPEN issue labelled %s returned %v, want %v; "+
					"the claim gate must read the lifecycle stage, not the demoted "+
					"display stage", label, err, store.ErrUnavailable)
			}
			if fake.hasLabel("ft:stage/working") {
				t.Errorf("a refused claim still stamped ft:stage/working; labels = %v", fake.labels)
			}
		})
	}
}

// TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal is the INVERSION
// of the "duplicate" row that used to sit in the table above, and it is
// deliberately not a deletion: the old assertion is wrong now, and a reader
// comparing rounds must be able to see that it was reconsidered rather than
// quietly dropped.
//
// What it used to assert: a bare, unprefixed `duplicate` label made an open
// issue unclaimable, on the reasoning that stage labels match bare and
// prefixed alike, so the stock label was a laundering route (audit-194-r2,
// Medium).
//
// Why that is now wrong. Round 4 made the terminal scan read the whole label
// set instead of a precedence winner, which was correct, and in doing so
// promoted every bare stock label into an AUTHORITATIVE terminal signal —
// twelve label combinations changed answer. `duplicate` ships in every new
// GitHub repository and any triager can apply it. Letting it decide a Farm
// Table privilege question means a label with a lower permission bar, and no
// Farm Table meaning at all, outranks the explicit ft:-prefixed one. The
// ruling (#194 round 5, B6): require the configured prefix for any label
// feeding an authorization or terminal-stage determination; keep
// prefix-tolerant matching for display only.
//
// The direction of the cost is why this is acceptable as an interim state.
// Denying the stock label its terminal reading makes some tasks appear
// available that a human might consider finished — wrongly available, not
// wrongly privileged — whereas honouring it hands a privilege decision to
// whoever can click a stock label. The laundering route the old assertion
// closed is still closed for the label that matters, because the prefixed
// ft:stage/duplicate above is unchanged.
func TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal(t *testing.T) {
	ctx := context.Background()

	// Exactly the state the old row used: open issue, stock label, nothing else.
	fake := newFakeIssueRepo(t, "duplicate")
	s := fake.store()

	if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err != nil {
		t.Fatalf("ClaimTask on an OPEN issue carrying only the stock GitHub "+
			"label \"duplicate\" returned %v, want success; an unprefixed label "+
			"is a human's triage note, not a Farm Table terminal assertion", err)
	}
	if !fake.hasLabel("ft:stage/working") {
		t.Errorf("claim did not stamp ft:stage/working; labels = %v", fake.labels)
	}
}

// TestPassThroughClaimTask_ClearingTheStaleLabelRestoresClaimability is the
// positive control for the test above, and the documented remedy for the
// denial-of-work cost it imposes: once the stale terminal label is gone, a
// reopened issue is ordinary claimable work again. Without this, a claim gate
// that refused everything would satisfy the test above.
func TestPassThroughClaimTask_ClearingTheStaleLabelRestoresClaimability(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t)
	s := fake.store()

	if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err != nil {
		t.Fatalf("ClaimTask on an open, unlabelled issue: %v", err)
	}
	if !fake.hasLabel("ft:stage/working") {
		t.Errorf("claim did not stamp ft:stage/working; labels = %v", fake.labels)
	}
}

// openParentWithClosedChildIssues builds the RAW GraphQL shapes buildIssueTree
// consumes — an OPEN parent carrying the given label whose only sub-issue is
// CLOSED — rather than hand-building issueTreeNodes.
//
// Driving the real constructor is the entire point. buildIssueTree is the
// function that would have to learn a demotion rule, so a test that skips it
// cannot detect one being added.
func openParentWithClosedChildIssues(label string) []issueNode {
	parent := issueNode{Number: 1, Title: "parent", State: "OPEN"}
	parent.Labels.Nodes = []struct {
		Name githubv4.String
	}{{Name: githubv4.String(label)}}

	child := subIssueNode{Number: 2, Title: "child", State: "CLOSED"}
	parent.SubIssues.Nodes = []subIssueNode{child}
	parent.SubIssues.TotalCount = 1

	return []issueNode{parent}
}

// TestComputeReady_OpenTerminalLabelledIssueIsNotReady pins the tree-walk half
// of the terminal rule: an OPEN issue whose stage labels say the work is
// finished must not surface as ready.
//
// This test was rewritten in the round-3 fix pass because the version F2
// committed was TAUTOLOGICAL. It hand-built a node with Stage=StageCompleted
// and called computeReady(nodes, false); with includeUnblocked=false the only
// appending arm requires Stage==StageAccepted, so a completed node was excluded
// regardless of any terminal handling, and buildIssueTree was never invoked at
// all. audit-194-r2 proved it with mutation MUT-T: teaching buildIssueTree the
// demotion — the precise change the old failure message told the reader to make
// — left the whole package green. "We pinned it rather than fixing it" was not
// true in effect.
//
// Two things make this version able to fail where that one could not:
//
//   - it goes through buildIssueTree, so a demotion inserted there is visible;
//   - it uses includeUnblocked=true, the branch whose guard actually consults
//     store.IsTerminalStage (treewalk.go), reached via a parent whose children
//     are all closed.
//
// Under MUT-T the parent's stage becomes accepted, the FIRST arm of computeReady
// then appends it, and this test fails. That is the property being bought.
func TestComputeReady_OpenTerminalLabelledIssueIsNotReady(t *testing.T) {
	mapper := NewLabelMapper(DefaultConfig().GitHub.Labels)

	for _, label := range []string{
		"ft:stage/completed",
		"ft:stage/wont_fix",
		"ft:stage/duplicate",
		"ft:stage/cancelled",
	} {
		t.Run(label, func(t *testing.T) {
			nodes := buildIssueTree(openParentWithClosedChildIssues(label), mapper)
			if got := readyNumbers(computeReady(nodes, true)); len(got) != 0 {
				t.Fatalf("computeReady returned %v for an OPEN issue labelled %s, want none; "+
					"a task whose stage labels say the work is finished must never surface "+
					"as ready", got, label)
			}
		})
	}
}

// TestComputeReady_OpenNonTerminalLabelledIssueIsReady guards the other side of
// the same predicate through the same real constructor. Without it, a
// buildIssueTree that returned nothing — or a computeReady that appended
// nothing — would satisfy the test above.
func TestComputeReady_OpenNonTerminalLabelledIssueIsReady(t *testing.T) {
	mapper := NewLabelMapper(DefaultConfig().GitHub.Labels)

	nodes := buildIssueTree(openParentWithClosedChildIssues("ft:stage/accepted"), mapper)
	if got := readyNumbers(computeReady(nodes, true)); len(got) != 1 || got[0] != 1 {
		t.Fatalf("computeReady returned %v for an OPEN accepted issue with all children "+
			"closed, want [1]", got)
	}
}

// TestPassThroughStore_OpenTerminalLabelledIssueIsDisplayedOpenButNotScheduled
// is the store-path counterpart, split out of the tree-walk pin above so that
// each test has one subject. (test-194-r2 F-5: the combined test carried a
// "delete this test" instruction that was only ever correct for the pin half,
// and a literal reading would have taken these assertions with it.)
//
// The two paths now AGREE that a terminal-labelled open issue is not offered as
// work — the tree walk excludes it from ready, and the store reports it
// unavailable — while still displaying it as open/accepted. Before round 3 they
// disagreed: the store said available, the tree walk said not ready.
func TestPassThroughStore_OpenTerminalLabelledIssueIsDisplayedOpenButNotScheduled(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/completed")
	s := fake.store()
	readBack, err := s.GetTask(ctx, s.issueUUID(1))
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}

	// Display: demoted, so nothing reports live work as finished.
	if readBack.Stage != task.StageAccepted {
		t.Errorf("stage = %s, want %s", readBack.Stage, task.StageAccepted)
	}

	// Scheduling: the terminal label is honoured.
	availability, err := s.ComputeAvailability(ctx, readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if availability.Available {
		t.Fatalf("open terminal-labelled issue reports available=true; reasons = %v",
			availability.Reasons)
	}
	// Unconditional, replacing a compound `&&` guard that could never fire:
	// audit-194-r2 and test-194-r2 both showed the old form contributed zero
	// detection even in the scenario it was written for.
	if !availability.HasReason(store.AvailabilityReasonTerminal) {
		t.Fatalf("availability reasons = %v, want to contain %q",
			availability.Reasons, store.AvailabilityReasonTerminal)
	}
}

package github

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestAudit_ReopenAfterCloseStaysAvailable is audit-194 F2's reproduction,
// committed as a permanent regression test. (The audit filed it as
// TestAudit_ReopenAfterCloseIsUnavailable, naming the bug; it is named for the
// property it now asserts.)
//
// Before #194, ft close left ft:stage/working on the issue. #194 made it write
// a terminal stage label instead — and reopening an issue is an ordinary
// GitHub operation which, in a pass-through collection where GitHub is the UI,
// happens entirely outside Farm Table. GitHub sets state=OPEN and clears
// closedAt on reopen; it does not touch labels. That left the issue carrying a
// terminal stage label with no contradicting non-label signal, reporting
// available=false reasons=[terminal] for live, open work.
//
// This is the same shape as the failure the ordering comment in CloseTask
// cites to justify closing before swapping. That argument only considered a
// failed close; a successful close plus a later reopen reaches the identical
// state by a completely normal workflow.
func TestAudit_ReopenAfterCloseStaysAvailable(t *testing.T) {
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

	availability, err := s.ComputeAvailability(ctx, readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if !availability.Available {
		t.Fatalf("DENIAL-OF-WORK: reopened OPEN issue reports available=false; stage = %s, reasons = %v",
			readBack.Stage, availability.Reasons)
	}
	if readBack.Stage != task.StageAccepted {
		t.Errorf("reopened issue reports stage = %s, want %s", readBack.Stage, task.StageAccepted)
	}
	if readBack.Phase != task.PhaseOpen {
		t.Errorf("reopened issue reports phase = %s, want %s", readBack.Phase, task.PhaseOpen)
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

// TestPassThroughClaimTask_ReopenedIssueIsClaimable checks the symmetric rule
// reaches the enforcement path too, not just the advisory one. Availability
// saying "yes" while ClaimTask says ErrUnavailable would be the #194 shape
// inverted: a truthful report the enforcement path disagrees with.
func TestPassThroughClaimTask_ReopenedIssueIsClaimable(t *testing.T) {
	ctx := context.Background()

	// The state a reopen leaves behind: open on GitHub, terminal label intact.
	fake := newFakeIssueRepo(t, "ft:stage/completed")
	s := fake.store()

	if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err != nil {
		t.Fatalf("ClaimTask on a reopened issue: %v", err)
	}
	if !fake.hasLabel("ft:stage/working") {
		t.Errorf("claim did not stamp ft:stage/working; labels = %v", fake.labels)
	}
	if fake.hasLabel("ft:stage/completed") {
		t.Errorf("claim left the stale terminal label behind; labels = %v", fake.labels)
	}
}

// TestComputeReady_OpenTerminalLabelledIssueIsNotReady pins a known divergence
// rather than a desired property.
//
// The symmetric rule lives in IssueToPhaseStage, which the tree walk does not
// use — buildIssueTree calls MapLabelsToStage directly and so still sees
// "completed" for an open issue carrying a terminal label. Such an issue is
// therefore reported available by GetTask and claimable by ClaimTask, but does
// not appear in GetReadyTasks.
//
// This is deliberate and left as a follow-up. The divergence is fail-safe (the
// ready queue under-reports rather than over-reports), and closing it means
// changing the semantics of a tree-walk predicate that #191 consolidated in
// the commit immediately below this branch — a ready-queue behaviour change
// that deserves its own review rather than riding along here.
func TestComputeReady_OpenTerminalLabelledIssueIsNotReady(t *testing.T) {
	nodes := map[int]*issueTreeNode{
		1: {Number: 1, Title: "reopened", State: "OPEN", Stage: task.StageCompleted},
	}
	if got := readyNumbers(computeReady(nodes, false)); len(got) != 0 {
		t.Fatalf("computeReady returned %v; this test documents the current "+
			"divergence between the tree walk and IssueToPhaseStage — if the "+
			"tree walk has been taught the symmetric rule, delete this test", got)
	}

	// ...while the same issue read through the store is available. Asserting
	// both halves here is what makes the divergence visible to the next reader
	// instead of surprising them.
	fake := newFakeIssueRepo(t, "ft:stage/completed")
	s := fake.store()
	readBack, err := s.GetTask(context.Background(), s.issueUUID(1))
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	availability, err := s.ComputeAvailability(context.Background(), readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if !availability.Available {
		t.Fatalf("open terminal-labelled issue reports available=false; reasons = %v", availability.Reasons)
	}
	if !availability.HasReason(store.AvailabilityReasonTerminal) && readBack.Stage != task.StageAccepted {
		t.Fatalf("unexpected stage %s", readBack.Stage)
	}
}

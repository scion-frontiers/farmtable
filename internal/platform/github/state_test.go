package github

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestIssueStateHelpers_Casing is the unit-level half of audit-194 F1. The two
// helpers are the package's only reading of the remote state field, so their
// contract is pinned directly: case-insensitive on the values GitHub can
// legitimately send, and false on everything else.
//
// The last block is the load-bearing one. issueStateClosed must NOT be the
// negation of issueStateOpen: an unrecognised state has to be closed=false AND
// open=false, so that neither the terminal stamp nor the ready walk claims it.
func TestIssueStateHelpers_Casing(t *testing.T) {
	for _, tc := range []struct {
		state  string
		closed bool
		open   bool
	}{
		{state: "CLOSED", closed: true},
		{state: "closed", closed: true},
		{state: "Closed", closed: true},
		{state: "cLoSeD", closed: true},
		{state: "OPEN", open: true},
		{state: "open", open: true},
		{state: "Open", open: true},

		// Neither open nor closed: an unrecognised state must fail open on the
		// terminal decision rather than mark live work finished.
		{state: ""},
		{state: "MERGED"},
		{state: "closed "},
	} {
		t.Run(tc.state, func(t *testing.T) {
			if got := issueStateClosed(tc.state); got != tc.closed {
				t.Errorf("issueStateClosed(%q) = %v, want %v", tc.state, got, tc.closed)
			}
			if got := issueStateOpen(tc.state); got != tc.open {
				t.Errorf("issueStateOpen(%q) = %v, want %v", tc.state, got, tc.open)
			}
		})
	}
}

// TestAudit_LowercaseClosedStateDefeatsFix is audit-194 F1's reproduction,
// committed as a permanent regression test. Before the shared state helper,
// issueToTask compared the raw remote state byte-for-byte against "CLOSED"
// while IssueToPhaseStage next to it used EqualFold. A non-canonical casing —
// reachable via GitHub Enterprise, a caching or replay proxy, or a schema
// change — left ClosedAt nil, so the #194 fix never fired and the closed issue
// reported available=true with an empty reason list: the original bug's exact
// fingerprint, with the fix fully present.
//
// The closedAt sub-case matters independently: the UpdatedAt fallback lives
// inside the same branch, so a casing miss made that unreachable too.
func TestAudit_LowercaseClosedStateDefeatsFix(t *testing.T) {
	ctx := context.Background()

	for _, state := range []string{"CLOSED", "closed", "Closed"} {
		for _, closedAt := range []string{"2026-01-02T00:00:00Z", ""} {
			name := state
			if closedAt == "" {
				name += "/null-closedAt"
			}
			t.Run(name, func(t *testing.T) {
				// The residue ClaimTask leaves: a stale non-terminal label that
				// IssueToPhaseStage will happily let win over real closed state.
				fake := newFakeIssueRepo(t, "ft:stage/working")
				fake.state = state
				fake.stateReason = "COMPLETED"
				fake.closedAt = closedAt
				s := fake.store()

				got, err := s.GetTask(ctx, s.issueUUID(1))
				if err != nil {
					t.Fatalf("GetTask: %v", err)
				}
				if got.ClosedAt == nil {
					t.Fatalf("ClosedAt is nil for state=%q; the ClosedAt availability arm cannot fire", state)
				}

				// Phase and Stage are deliberately not asserted here. A closed
				// issue carrying a stale non-terminal label still reports
				// phase=in_progress stage=working, because IssueToPhaseStage
				// checks labels before stateReason on the closed branch. That is
				// issue #193 and it is out of scope; ClosedAt is precisely the
				// non-label signal that makes availability correct in spite of
				// it, which is what this test pins.

				availability, err := s.ComputeAvailability(ctx, got)
				if err != nil {
					t.Fatalf("ComputeAvailability: %v", err)
				}
				if availability.Available {
					t.Fatalf("FIX DEFEATED: closed issue with state=%q reports available=true; stage = %s, reasons = %v",
						state, got.Stage, availability.Reasons)
				}
			})
		}
	}
}

// TestPassThroughIssueToTask_UnrecognisedStateIsNotClosed pins the warning
// attached to the F1 fix: the guard must stay a positive issueStateClosed test
// and must never become !issueStateOpen. Under the inverted form an empty or
// unrecognised state would stamp ClosedAt on live work and report every such
// issue as terminal — the denial-of-work direction, which is as damaging as
// the bug #194 fixed because availability is advisory.
func TestPassThroughIssueToTask_UnrecognisedStateIsNotClosed(t *testing.T) {
	ctx := context.Background()

	for _, state := range []string{"", "MERGED"} {
		t.Run("state="+state, func(t *testing.T) {
			fake := newFakeIssueRepo(t, "ft:stage/accepted")
			fake.state = state
			s := fake.store()

			got, err := s.GetTask(ctx, s.issueUUID(1))
			if err != nil {
				t.Fatalf("GetTask: %v", err)
			}
			if got.ClosedAt != nil {
				t.Fatalf("ClosedAt = %v for unrecognised state %q, want nil; "+
					"the closed guard must not be the negation of the open guard", got.ClosedAt, state)
			}

			availability, err := s.ComputeAvailability(ctx, got)
			if err != nil {
				t.Fatalf("ComputeAvailability: %v", err)
			}
			if !availability.Available {
				t.Fatalf("issue with unrecognised state %q reports available=false; reasons = %v", state, availability.Reasons)
			}
		})
	}
}

// TestComputeReady_StateCasingIsIgnored covers the tree walk's share of the
// same field. computeReady skips non-open nodes and treats open children as
// blockers, both of which compared the raw state string exactly. A lowercase
// parent state silently emptied the ready queue; a lowercase child state
// silently stopped blocking its parent.
func TestComputeReady_StateCasingIsIgnored(t *testing.T) {
	t.Run("lowercase open parent is still walked", func(t *testing.T) {
		nodes := parentWithClosedChild(task.StageAccepted)
		nodes[1].State = "open"

		if got := readyNumbers(computeReady(nil, nodes, false)); len(got) != 1 || got[0] != 1 {
			t.Fatalf("computeReady returned %v for a lowercase-open parent, want [1]", got)
		}
	})

	t.Run("lowercase open child still blocks", func(t *testing.T) {
		nodes := parentWithClosedChild(task.StageAccepted)
		nodes[2].State = "open"

		if got := readyNumbers(computeReady(nil, nodes, false)); len(got) != 0 {
			t.Fatalf("computeReady returned %v with a lowercase-open child, want none; "+
				"an open sub-issue must block its parent regardless of casing", got)
		}
	})
}

// TestComputeBlocked_StateCasingIsIgnored is the same field again in the
// blocked walk, which reads it at two more points.
func TestComputeBlocked_StateCasingIsIgnored(t *testing.T) {
	nodes := parentWithClosedChild(task.StageAccepted)
	nodes[1].State = "open"
	nodes[2].State = "open"

	results := computeBlocked(nil, nodes)
	if len(results) != 1 {
		t.Fatalf("computeBlocked returned %d results for a lowercase-open parent with a lowercase-open child, want 1", len(results))
	}
	if results[0].Node.Number != 1 {
		t.Fatalf("computeBlocked flagged issue %d, want 1", results[0].Node.Number)
	}
	if len(results[0].BlockedBy) != 1 || results[0].BlockedBy[0].Number != 2 {
		t.Fatalf("BlockedBy = %v, want the lowercase-open child 2", results[0].BlockedBy)
	}
}

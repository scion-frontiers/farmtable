package github

import (
	"sort"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// parentWithClosedChild builds the exact shape computeReady's includeUnblocked
// branch cares about: an OPEN parent carrying stage, whose only sub-issue is
// already CLOSED. Whether the parent surfaces as ready then turns solely on
// whether its own stage is terminal.
func parentWithClosedChild(stage task.Stage) map[int]*issueTreeNode {
	child := &issueTreeNode{Number: 2, Title: "child", State: "CLOSED", Stage: task.StageCompleted}
	parent := &issueTreeNode{
		Number:   1,
		Title:    "parent",
		State:    "OPEN",
		Stage:    stage,
		Children: []*issueTreeNode{child},
	}
	return map[int]*issueTreeNode{1: parent, 2: child}
}

func readyNumbers(results []readyResult) []int {
	numbers := make([]int, 0, len(results))
	for _, r := range results {
		numbers = append(numbers, r.Node.Number)
	}
	sort.Ints(numbers)
	return numbers
}

// TestComputeReady_TerminalParentIsNotReady pins the terminal arm of
// computeReady's includeUnblocked branch. A GitHub issue can be OPEN while its
// stage labels say the work is finished, so the stage — not the issue state —
// has to be what keeps it out of the ready set.
func TestComputeReady_TerminalParentIsNotReady(t *testing.T) {
	for _, stage := range []task.Stage{
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			results := computeReady(parentWithClosedChild(stage), true)
			if got := readyNumbers(results); len(got) != 0 {
				t.Fatalf("computeReady returned %v for terminal stage %s, want none; "+
					"a task in a terminal stage must never surface as ready", got, stage)
			}
		})
	}
}

// TestComputeReady_NonTerminalParentIsReady guards the other side of the same
// predicate, so a mutation marking every stage terminal is caught too. Without
// this, "return no results" would satisfy the test above.
func TestComputeReady_NonTerminalParentIsReady(t *testing.T) {
	for _, stage := range []task.Stage{
		task.StageTriage,
		task.StageWorking,
		task.StageInReview,
		task.StageInQa,
		task.StageDeploying,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			results := computeReady(parentWithClosedChild(stage), true)
			got := readyNumbers(results)
			if len(got) != 1 || got[0] != 1 {
				t.Fatalf("computeReady returned %v for non-terminal stage %s, want [1]", got, stage)
			}
			if want := "all sub-issues closed (candidate for ready)"; results[0].Reason != want {
				t.Fatalf("reason = %q, want %q", results[0].Reason, want)
			}
		})
	}
}

// TestComputeReady_AcceptedTakesTheAcceptedBranch keeps the two branches
// distinct: accepted is excluded from the includeUnblocked branch because it is
// handled earlier, not because it is terminal. It stays ready with
// includeUnblocked off, which no other stage does.
func TestComputeReady_AcceptedTakesTheAcceptedBranch(t *testing.T) {
	results := computeReady(parentWithClosedChild(task.StageAccepted), false)
	if got := readyNumbers(results); len(got) != 1 || got[0] != 1 {
		t.Fatalf("computeReady returned %v for accepted parent, want [1]", got)
	}
	if want := "accepted, no open sub-issues"; results[0].Reason != want {
		t.Fatalf("reason = %q, want %q", results[0].Reason, want)
	}

	if got := readyNumbers(computeReady(parentWithClosedChild(task.StageWorking), false)); len(got) != 0 {
		t.Fatalf("computeReady with includeUnblocked=false returned %v for working, want none", got)
	}
}

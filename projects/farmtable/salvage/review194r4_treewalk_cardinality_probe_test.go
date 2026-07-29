package github

// Salvaged probe from code-review-194-r4.
//
// Drop this file into internal/platform/github/ and run:
//   go test ./internal/platform/github/ -run ReviewR4 -v
//
// It exercises the ONE axis the existing tree-walk fixture cannot express:
// label-set cardinality >= 2. openParentWithClosedChildIssues() in
// reopen_test.go takes a single label STRING, so no mutation of it can build
// the two-label input that triggered the #194 Critical. This probe builds the
// set directly.
//
// Expected at 03ab6b6: the single-label rows pass (not ready) and the
// two-label rows FAIL (ready), because buildIssueTree calls MapLabelsToStage,
// which collapses the set with stagePrecedence -- the display rule that ranks
// every non-terminal stage above every terminal one. TerminalLabelStage's
// round-4 direct scan is not on this path.

import (
	"testing"

	"github.com/shurcooL/githubv4"
)

func reviewR4OpenParentWithClosedChild(labels ...string) []issueNode {
	parent := issueNode{Number: 1, Title: "parent", State: "OPEN"}
	nodes := make([]struct {
		Name githubv4.String
	}, len(labels))
	for i, l := range labels {
		nodes[i].Name = githubv4.String(l)
	}
	parent.Labels.Nodes = nodes
	parent.SubIssues.Nodes = []subIssueNode{{Number: 2, Title: "child", State: "CLOSED"}}
	parent.SubIssues.TotalCount = 1
	return []issueNode{parent}
}

func TestReviewR4_TreeWalkCardinality(t *testing.T) {
	mapper := NewLabelMapper(DefaultConfig().GitHub.Labels)

	cases := []struct {
		name   string
		labels []string
	}{
		// cardinality 1 -- what the shipped fixture can express.
		{"1/completed", []string{"ft:stage/completed"}},
		{"1/wont_fix", []string{"ft:stage/wont_fix"}},
		{"1/duplicate", []string{"ft:stage/duplicate"}},
		{"1/cancelled", []string{"ft:stage/cancelled"}},

		// cardinality 2 -- terminal + one ordinary non-terminal label.
		{"2/completed+accepted", []string{"ft:stage/completed", "ft:stage/accepted"}},
		{"2/wont_fix+accepted", []string{"ft:stage/wont_fix", "ft:stage/accepted"}},
		{"2/duplicate+accepted", []string{"ft:stage/duplicate", "ft:stage/accepted"}},
		{"2/cancelled+accepted", []string{"ft:stage/cancelled", "ft:stage/accepted"}},
		{"2/wont_fix+triage", []string{"ft:stage/wont_fix", "ft:stage/triage"}},
		{"2/wont_fix+working", []string{"ft:stage/wont_fix", "ft:stage/working"}},

		// order-reversed, to show the answer is not order-sensitive.
		{"2/accepted+wont_fix", []string{"ft:stage/accepted", "ft:stage/wont_fix"}},

		// conflicting: two terminals, still terminal.
		{"2/wont_fix+duplicate", []string{"ft:stage/wont_fix", "ft:stage/duplicate"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			issues := reviewR4OpenParentWithClosedChild(tc.labels...)
			nodes := buildIssueTree(issues, mapper)

			// Self-check that the harness expressed what it meant to: the
			// node must carry exactly the labels we asked for. A fixture that
			// silently dropped one would make every NEGATIVE below vacuous.
			if got := len(nodes[1].Labels); got != len(tc.labels) {
				t.Fatalf("harness self-check failed: node carries %d labels, want %d",
					got, len(tc.labels))
			}

			collapsed, _ := mapper.MapLabelsToStage(tc.labels)
			terminal, isTerminal := mapper.TerminalLabelStage(tc.labels)
			ready := computeReady(nodes, true)

			t.Logf("labels=%v  MapLabelsToStage=%q  TerminalLabelStage=(%q,%v)  ready=%v",
				tc.labels, collapsed, terminal, isTerminal, readyNumbers(ready))

			if !isTerminal {
				t.Fatalf("harness self-check failed: TerminalLabelStage says non-terminal "+
					"for %v; every row here names a terminal stage", tc.labels)
			}
			if len(ready) != 0 {
				t.Errorf("BYPASS: computeReady returned %v for OPEN issue labelled %v "+
					"(TerminalLabelStage=%q). An issue a maintainer marked terminal is "+
					"being offered as ready work.", readyNumbers(ready), tc.labels, terminal)
			}
		})
	}
}

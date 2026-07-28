package github

import (
	"strings"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

type issueTreeNode struct {
	Number   int
	Title    string
	State    string // "OPEN" or "CLOSED"
	Stage    task.Stage
	Labels   []string
	Children []*issueTreeNode
}

type readyResult struct {
	Node   *issueTreeNode
	Reason string
}

type blockedResult struct {
	Node      *issueTreeNode
	Reason    string
	BlockedBy []*issueTreeNode
}

func buildIssueTree(issues []issueNode, mapper *LabelMapper) map[int]*issueTreeNode {
	nodes := make(map[int]*issueTreeNode)

	for i := range issues {
		issue := &issues[i]
		labels := issueLabels(issue)
		stage, _ := mapper.MapLabelsToStage(labels)

		node := &issueTreeNode{
			Number: int(issue.Number),
			Title:  string(issue.Title),
			State:  string(issue.State),
			Stage:  stage,
			Labels: labels,
		}
		nodes[node.Number] = node

		for j := range issue.SubIssues.Nodes {
			si := &issue.SubIssues.Nodes[j]
			siLabels := make([]string, len(si.Labels.Nodes))
			for k, l := range si.Labels.Nodes {
				siLabels[k] = string(l.Name)
			}
			siStage, _ := mapper.MapLabelsToStage(siLabels)
			child := &issueTreeNode{
				Number: int(si.Number),
				Title:  string(si.Title),
				State:  string(si.State),
				Stage:  siStage,
				Labels: siLabels,
			}
			if existing, ok := nodes[child.Number]; ok {
				existing.State = child.State
				existing.Stage = child.Stage
				existing.Labels = child.Labels
				child = existing
			} else {
				nodes[child.Number] = child
			}
			node.Children = append(node.Children, child)
		}
	}

	return nodes
}

func computeReady(m *LabelMapper, nodes map[int]*issueTreeNode, includeUnblocked bool) []readyResult {
	var results []readyResult

	for _, node := range nodes {
		if !issueStateOpen(node.State) {
			continue
		}

		// A task carrying an authoritative terminal label is not ready work,
		// however node.Stage reads.
		//
		// #194 A7, MEASURED. node.Stage comes from MapLabelsToStage, the DISPLAY
		// collapse, and stagePrecedence ranks every non-terminal stage above
		// every terminal one. So this walk was the FOURTH consumer of the round-3
		// masking defect, and nobody had enumerated it:
		//
		//	labels                             node.Stage  offered as ready?
		//	[ft:stage/completed]               completed   no
		//	[ft:stage/completed, working]      working     YES  <- one bare label
		//	[ft:stage/completed, accepted]     accepted    YES
		//
		// The second row is the bad one. "working" carries no push prefix, so
		// anyone at all can apply it, and applying it hands a completed task back
		// to an agent as available work. Asking the SET-valued reader instead
		// means the answer cannot depend on what else the issue is labelled.
		//
		// This is a WITHHOLD, which is why it is safe to widen: it can only
		// remove entries from a ready list, never add one. It also makes the walk
		// agree with ComputeAvailability, which already treats a terminal label
		// as unavailable through LifecycleStage — two views of "can this be
		// worked on" that disagreed.
		//
		// It does NOT contradict IssueToPhaseStage's deliberate demotion of a
		// terminal label on an open issue. That rule exists so live work is not
		// DISPLAYED as finished; this one decides whether to OFFER the work, and
		// for offering, the cautious direction is the other one.
		if len(m.AllTerminalLabelStages(node.Labels)) > 0 {
			continue
		}

		hasOpenChildren := false
		for _, child := range node.Children {
			if issueStateOpen(child.State) {
				hasOpenChildren = true
				break
			}
		}

		if node.Stage == task.StageAccepted && !hasOpenChildren {
			if m.hasExternalUnavailableLabel(node.Labels) {
				continue
			}
			reason := "accepted, no open sub-issues"
			if len(node.Children) == 0 {
				reason = "leaf task, accepted"
			}
			results = append(results, readyResult{Node: node, Reason: reason})
			continue
		}

		if includeUnblocked && !hasOpenChildren && node.Stage != task.StageAccepted {
			if !store.IsTerminalStage(node.Stage) && len(node.Children) > 0 {
				results = append(results, readyResult{
					Node:   node,
					Reason: "all sub-issues closed (candidate for ready)",
				})
			}
		}
	}

	return results
}

func computeBlocked(m *LabelMapper, nodes map[int]*issueTreeNode) []blockedResult {
	var results []blockedResult

	for _, node := range nodes {
		if !issueStateOpen(node.State) {
			continue
		}

		if m.hasExternalUnavailableLabel(node.Labels) {
			results = append(results, blockedResult{
				Node:   node,
				Reason: "explicitly unavailable (label)",
			})
			continue
		}

		var openChildren []*issueTreeNode
		for _, child := range node.Children {
			if issueStateOpen(child.State) {
				openChildren = append(openChildren, child)
			}
		}
		if len(openChildren) > 0 {
			results = append(results, blockedResult{
				Node:      node,
				Reason:    "blocked by open sub-issues",
				BlockedBy: openChildren,
			})
			continue
		}

	}

	return results
}

// hasExternalUnavailableLabel reports whether any label asks for the task to be
// withheld. It is deliberately PREFIX-TOLERANT, which is the opposite of the
// rule authorizationStage enforces, and the difference is load-bearing rather
// than an oversight:
//
//	authorizationStage answers "may this label GRANT something?" and must
//	refuse anything a third party can apply. This answers "does anyone want
//	this work held back?" and can only ever WITHHOLD. There is no privilege to
//	escalate by honouring one more spelling, and "blocked" applied by a human
//	who never heard of Farm Table is a signal we want to obey. The two
//	functions differ because the questions differ, not because one of them
//	forgot the rule.
//
// FIXED IN ROUND 6 (#194 A7): the prefix it stripped was the hardcoded literal
// "ft:", not the configured one. So a deployment on push_prefix "acme:" had
// "acme:blocked" silently ignored — an operator's explicit hold handing work
// to an agent — while "ft:blocked", a namespace that deployment does not own,
// was honoured. Exactly backwards.
//
// It now accepts THREE spellings: the configured prefix, the default prefix,
// and no prefix at all. Keeping the default alongside the configured one is
// deliberate. Dropping it would REMOVE a hold that some issue somewhere is
// relying on, and this is the one direction where being wrong costs an
// operator work they meant to withhold. Adding a spelling is monotone: this
// function can only withhold, so a wider match can only withhold more. Both
// prefixes come from named sources (m.matchPrefix and defaultPushPrefix), so
// this is not a fourth copy of the literal that review F5 collapsed.
//
// The nil receiver is real: computeReady and computeBlocked are reached from
// tests and from a zero-value store. A nil mapper falls back to the default
// prefix, which is the same set of spellings the function honoured before this
// change.
func (m *LabelMapper) hasExternalUnavailableLabel(labels []string) bool {
	prefixes := []string{defaultPushPrefix}
	if m != nil {
		if configured := m.matchPrefix(); configured != defaultPushPrefix {
			prefixes = append(prefixes, configured)
		}
	}

	for _, raw := range labels {
		label := strings.ToLower(strings.TrimSpace(raw))
		for _, prefix := range prefixes {
			if trimmed := strings.TrimPrefix(label, prefix); trimmed != label {
				label = trimmed
				break
			}
		}
		label = strings.TrimPrefix(label, "stage/")
		switch label {
		case "blocked", "waiting_for_input", "deferred", "scheduled":
			return true
		}
	}
	return false
}

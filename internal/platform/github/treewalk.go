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

func computeReady(nodes map[int]*issueTreeNode, includeUnblocked bool) []readyResult {
	var results []readyResult

	for _, node := range nodes {
		if node.State != "OPEN" {
			continue
		}

		hasOpenChildren := false
		for _, child := range node.Children {
			if child.State == "OPEN" {
				hasOpenChildren = true
				break
			}
		}

		if node.Stage == task.StageAccepted && !hasOpenChildren {
			if hasExternalUnavailableLabel(node.Labels) {
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

func computeBlocked(nodes map[int]*issueTreeNode) []blockedResult {
	var results []blockedResult

	for _, node := range nodes {
		if node.State != "OPEN" {
			continue
		}

		if hasExternalUnavailableLabel(node.Labels) {
			results = append(results, blockedResult{
				Node:   node,
				Reason: "explicitly unavailable (label)",
			})
			continue
		}

		var openChildren []*issueTreeNode
		for _, child := range node.Children {
			if child.State == "OPEN" {
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

func hasExternalUnavailableLabel(labels []string) bool {
	for _, raw := range labels {
		label := strings.ToLower(strings.TrimSpace(raw))
		label = strings.TrimPrefix(label, "ft:")
		label = strings.TrimPrefix(label, "stage/")
		switch label {
		case "blocked", "waiting_for_input", "deferred", "scheduled":
			return true
		}
	}
	return false
}

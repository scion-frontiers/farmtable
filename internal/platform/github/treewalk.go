package github

import (
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

		if node.Stage == task.StageReady && !hasOpenChildren {
			reason := "marked ready, no open sub-issues"
			if len(node.Children) == 0 {
				reason = "leaf task, marked ready"
			}
			results = append(results, readyResult{Node: node, Reason: reason})
			continue
		}

		if includeUnblocked && !hasOpenChildren && node.Stage != task.StageBlocked {
			isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
				node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
			if !isTerminal && len(node.Children) > 0 {
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

		if node.Stage == task.StageBlocked {
			results = append(results, blockedResult{
				Node:   node,
				Reason: "explicitly blocked (label)",
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

		for _, child := range node.Children {
			if child.Stage == task.StageBlocked {
				results = append(results, blockedResult{
					Node:      node,
					Reason:    "transitively blocked: sub-issue is blocked",
					BlockedBy: []*issueTreeNode{child},
				})
				break
			}
		}
	}

	return results
}

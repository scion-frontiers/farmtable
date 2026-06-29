package github

import (
	"context"
	"fmt"
	"time"

	githubv4 "github.com/shurcooL/githubv4"
)

// ── Query struct definitions ──

type issueNode struct {
	ID          githubv4.ID
	Number      githubv4.Int
	Title       githubv4.String
	Body        githubv4.String
	State       githubv4.String
	StateReason *githubv4.String
	CreatedAt   githubv4.DateTime
	UpdatedAt   githubv4.DateTime
	URL         githubv4.URI

	Labels struct {
		Nodes []struct {
			Name githubv4.String
		}
	} `graphql:"labels(first: 20)"`

	Assignees struct {
		Nodes []struct {
			Login githubv4.String
		}
	} `graphql:"assignees(first: 10)"`

	Milestone *struct {
		Title githubv4.String
	}

	SubIssues struct {
		Nodes      []subIssueNode
		TotalCount githubv4.Int
	} `graphql:"subIssues(first: 100)"`

	SubIssuesSummary subIssuesSummary
	Parent           *parentIssueNode
}

type subIssueNode struct {
	ID     githubv4.ID
	Number githubv4.Int
	Title  githubv4.String
	State  githubv4.String
	Labels struct {
		Nodes []struct {
			Name githubv4.String
		}
	} `graphql:"labels(first: 20)"`
}

type parentIssueNode struct {
	ID     githubv4.ID
	Number githubv4.Int
}

type subIssuesSummary struct {
	Total            githubv4.Int
	Completed        githubv4.Int
	PercentCompleted githubv4.Int
}

type issueCommentNode struct {
	ID        githubv4.ID
	Body      githubv4.String
	CreatedAt githubv4.DateTime
	UpdatedAt githubv4.DateTime
	Author    struct {
		Login githubv4.String
	}
}

// ── Query methods ──

func (c *graphqlClient) listIssues(ctx context.Context, states []githubv4.IssueState, labelFilter []string, limit int) ([]issueNode, error) {
	var query struct {
		Repository struct {
			Issues struct {
				Nodes    []issueNode
				PageInfo struct {
					HasNextPage githubv4.Boolean
					EndCursor   githubv4.String
				}
			} `graphql:"issues(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}, after: $cursor, states: $states, labels: $labels)"`
		} `graphql:"repository(owner: $owner, name: $repo)"`
	}

	var labelPtrs *[]githubv4.String
	if len(labelFilter) > 0 {
		ls := make([]githubv4.String, len(labelFilter))
		for i, l := range labelFilter {
			ls[i] = githubv4.String(l)
		}
		labelPtrs = &ls
	}

	stateVals := make([]githubv4.IssueState, len(states))
	copy(stateVals, states)

	pageSize := 100
	if limit > 0 && limit < pageSize {
		pageSize = limit
	}

	vars := map[string]any{
		"owner":  githubv4.String(c.owner),
		"repo":   githubv4.String(c.repo),
		"first":  githubv4.Int(pageSize),
		"cursor": (*githubv4.String)(nil),
		"states": stateVals,
		"labels": labelPtrs,
	}

	var allNodes []issueNode
	for {
		if err := c.v4.Query(ctx, &query, vars); err != nil {
			return nil, fmt.Errorf("graphql list issues: %w", err)
		}
		allNodes = append(allNodes, query.Repository.Issues.Nodes...)

		if limit > 0 && len(allNodes) >= limit {
			allNodes = allNodes[:limit]
			break
		}
		if !bool(query.Repository.Issues.PageInfo.HasNextPage) {
			break
		}
		vars["cursor"] = githubv4.NewString(query.Repository.Issues.PageInfo.EndCursor)
	}
	return allNodes, nil
}

func (c *graphqlClient) getIssue(ctx context.Context, number int) (*issueNode, error) {
	var query struct {
		Repository struct {
			Issue issueNode `graphql:"issue(number: $number)"`
		} `graphql:"repository(owner: $owner, name: $repo)"`
	}

	vars := map[string]any{
		"owner":  githubv4.String(c.owner),
		"repo":   githubv4.String(c.repo),
		"number": githubv4.Int(number),
	}

	if err := c.v4.Query(ctx, &query, vars); err != nil {
		return nil, fmt.Errorf("graphql get issue #%d: %w", number, err)
	}
	return &query.Repository.Issue, nil
}

func (c *graphqlClient) listIssueComments(ctx context.Context, number int, limit int) ([]issueCommentNode, error) {
	var query struct {
		Repository struct {
			Issue struct {
				Comments struct {
					Nodes    []issueCommentNode
					PageInfo struct {
						HasNextPage githubv4.Boolean
						EndCursor   githubv4.String
					}
				} `graphql:"comments(first: $first, after: $cursor)"`
			} `graphql:"issue(number: $number)"`
		} `graphql:"repository(owner: $owner, name: $repo)"`
	}

	pageSize := 100
	if limit > 0 && limit < pageSize {
		pageSize = limit
	}

	vars := map[string]any{
		"owner":  githubv4.String(c.owner),
		"repo":   githubv4.String(c.repo),
		"number": githubv4.Int(number),
		"first":  githubv4.Int(pageSize),
		"cursor": (*githubv4.String)(nil),
	}

	var all []issueCommentNode
	for {
		if err := c.v4.Query(ctx, &query, vars); err != nil {
			return nil, fmt.Errorf("graphql list comments for #%d: %w", number, err)
		}
		all = append(all, query.Repository.Issue.Comments.Nodes...)

		if limit > 0 && len(all) >= limit {
			all = all[:limit]
			break
		}
		if !bool(query.Repository.Issue.Comments.PageInfo.HasNextPage) {
			break
		}
		vars["cursor"] = githubv4.NewString(query.Repository.Issue.Comments.PageInfo.EndCursor)
	}
	return all, nil
}

func (c *graphqlClient) listSubIssues(ctx context.Context, number int) ([]subIssueNode, error) {
	issue, err := c.getIssue(ctx, number)
	if err != nil {
		return nil, err
	}
	return issue.SubIssues.Nodes, nil
}

// ── Repository ID lookup (needed for mutations) ──

func (c *graphqlClient) getRepositoryID(ctx context.Context) (githubv4.ID, error) {
	var query struct {
		Repository struct {
			ID githubv4.ID
		} `graphql:"repository(owner: $owner, name: $repo)"`
	}

	vars := map[string]any{
		"owner": githubv4.String(c.owner),
		"repo":  githubv4.String(c.repo),
	}

	if err := c.v4.Query(ctx, &query, vars); err != nil {
		return nil, fmt.Errorf("graphql get repository ID: %w", err)
	}
	return query.Repository.ID, nil
}

// ── Mutation methods ──

func (c *graphqlClient) createIssue(ctx context.Context, repoID githubv4.ID, title, body string, labelIDs []githubv4.ID, assigneeIDs []githubv4.ID) (*issueNode, error) {
	var mutation struct {
		CreateIssue struct {
			Issue issueNode
		} `graphql:"createIssue(input: $input)"`
	}

	input := githubv4.CreateIssueInput{
		RepositoryID: repoID,
		Title:        githubv4.String(title),
	}
	if body != "" {
		b := githubv4.String(body)
		input.Body = &b
	}
	if len(labelIDs) > 0 {
		input.LabelIDs = &labelIDs
	}
	if len(assigneeIDs) > 0 {
		input.AssigneeIDs = &assigneeIDs
	}

	if err := c.v4.Mutate(ctx, &mutation, input, nil); err != nil {
		return nil, fmt.Errorf("graphql create issue: %w", err)
	}
	return &mutation.CreateIssue.Issue, nil
}

func (c *graphqlClient) updateIssue(ctx context.Context, issueID githubv4.ID, title, body *string) (*issueNode, error) {
	var mutation struct {
		UpdateIssue struct {
			Issue issueNode
		} `graphql:"updateIssue(input: $input)"`
	}

	input := githubv4.UpdateIssueInput{
		ID: issueID,
	}
	if title != nil {
		t := githubv4.String(*title)
		input.Title = &t
	}
	if body != nil {
		b := githubv4.String(*body)
		input.Body = &b
	}

	if err := c.v4.Mutate(ctx, &mutation, input, nil); err != nil {
		return nil, fmt.Errorf("graphql update issue: %w", err)
	}
	return &mutation.UpdateIssue.Issue, nil
}

func (c *graphqlClient) closeIssue(ctx context.Context, issueID githubv4.ID, reason githubv4.IssueClosedStateReason) (*issueNode, error) {
	var mutation struct {
		CloseIssue struct {
			Issue issueNode
		} `graphql:"closeIssue(input: $input)"`
	}

	input := githubv4.CloseIssueInput{
		IssueID:     issueID,
		StateReason: &reason,
	}

	if err := c.v4.Mutate(ctx, &mutation, input, nil); err != nil {
		return nil, fmt.Errorf("graphql close issue: %w", err)
	}
	return &mutation.CloseIssue.Issue, nil
}

func (c *graphqlClient) addComment(ctx context.Context, issueID githubv4.ID, body string) (*issueCommentNode, error) {
	var mutation struct {
		AddComment struct {
			CommentEdge struct {
				Node issueCommentNode
			}
		} `graphql:"addComment(input: $input)"`
	}

	input := githubv4.AddCommentInput{
		SubjectID: issueID,
		Body:      githubv4.String(body),
	}

	if err := c.v4.Mutate(ctx, &mutation, input, nil); err != nil {
		return nil, fmt.Errorf("graphql add comment: %w", err)
	}
	return &mutation.AddComment.CommentEdge.Node, nil
}

func (c *graphqlClient) addSubIssue(ctx context.Context, parentID, childID githubv4.ID) error {
	var mutation struct {
		AddSubIssue struct {
			Issue    issueNode
			SubIssue issueNode
		} `graphql:"addSubIssue(input: $input)"`
	}

	input := githubv4.AddSubIssueInput{
		IssueID:    parentID,
		SubIssueID: &childID,
	}

	if err := c.v4.Mutate(ctx, &mutation, input, nil); err != nil {
		return fmt.Errorf("graphql add sub-issue: %w", err)
	}
	return nil
}

func (c *graphqlClient) removeSubIssue(ctx context.Context, parentID, childID githubv4.ID) error {
	var mutation struct {
		RemoveSubIssue struct {
			Issue    issueNode
			SubIssue issueNode
		} `graphql:"removeSubIssue(input: $input)"`
	}

	input := githubv4.RemoveSubIssueInput{
		IssueID:    parentID,
		SubIssueID: childID,
	}

	if err := c.v4.Mutate(ctx, &mutation, input, nil); err != nil {
		return fmt.Errorf("graphql remove sub-issue: %w", err)
	}
	return nil
}

func (c *graphqlClient) addLabels(ctx context.Context, labelableID githubv4.ID, labelIDs []githubv4.ID) error {
	var mutation struct {
		AddLabelsToLabelable struct {
			Labelable struct {
				Labels struct {
					Nodes []struct{ Name githubv4.String }
				} `graphql:"labels(first: 1)"`
			}
		} `graphql:"addLabelsToLabelable(input: $input)"`
	}

	input := githubv4.AddLabelsToLabelableInput{
		LabelableID: labelableID,
		LabelIDs:    labelIDs,
	}

	return c.v4.Mutate(ctx, &mutation, input, nil)
}

func (c *graphqlClient) removeLabels(ctx context.Context, labelableID githubv4.ID, labelIDs []githubv4.ID) error {
	var mutation struct {
		RemoveLabelsFromLabelable struct {
			Labelable struct {
				Labels struct {
					Nodes []struct{ Name githubv4.String }
				} `graphql:"labels(first: 1)"`
			}
		} `graphql:"removeLabelsFromLabelable(input: $input)"`
	}

	input := githubv4.RemoveLabelsFromLabelableInput{
		LabelableID: labelableID,
		LabelIDs:    labelIDs,
	}

	return c.v4.Mutate(ctx, &mutation, input, nil)
}

// ── Label ID lookup ──

type repoLabel struct {
	ID   githubv4.ID
	Name githubv4.String
}

func (c *graphqlClient) listRepoLabels(ctx context.Context) ([]repoLabel, error) {
	var query struct {
		Repository struct {
			Labels struct {
				Nodes    []repoLabel
				PageInfo struct {
					HasNextPage githubv4.Boolean
					EndCursor   githubv4.String
				}
			} `graphql:"labels(first: 100, after: $cursor)"`
		} `graphql:"repository(owner: $owner, name: $repo)"`
	}

	vars := map[string]any{
		"owner":  githubv4.String(c.owner),
		"repo":   githubv4.String(c.repo),
		"cursor": (*githubv4.String)(nil),
	}

	var all []repoLabel
	for {
		if err := c.v4.Query(ctx, &query, vars); err != nil {
			return nil, fmt.Errorf("graphql list labels: %w", err)
		}
		all = append(all, query.Repository.Labels.Nodes...)
		if !bool(query.Repository.Labels.PageInfo.HasNextPage) {
			break
		}
		vars["cursor"] = githubv4.NewString(query.Repository.Labels.PageInfo.EndCursor)
	}
	return all, nil
}

// ── Assignee lookup ──

func (c *graphqlClient) updateIssueAssignees(ctx context.Context, issueID githubv4.ID, assigneeIDs []githubv4.ID) error {
	var mutation struct {
		UpdateIssue struct {
			Issue struct {
				ID githubv4.ID
			}
		} `graphql:"updateIssue(input: $input)"`
	}

	input := githubv4.UpdateIssueInput{
		ID:          issueID,
		AssigneeIDs: &assigneeIDs,
	}

	return c.v4.Mutate(ctx, &mutation, input, nil)
}

// ── Helper: extract label names from issueNode ──

func issueLabels(issue *issueNode) []string {
	labels := make([]string, len(issue.Labels.Nodes))
	for i, l := range issue.Labels.Nodes {
		labels[i] = string(l.Name)
	}
	return labels
}

func issueBuildRemoteData(owner, repo string, issue *issueNode) map[string]any {
	rd := map[string]any{
		"remote_id":  fmt.Sprintf("%s/%s#%d", owner, repo, issue.Number),
		"node_id":    issue.ID,
		"html_url":   issue.URL.String(),
		"number":     int(issue.Number),
		"created_at": time.Time(issue.CreatedAt.Time).UTC().Format(time.RFC3339),
		"updated_at": time.Time(issue.UpdatedAt.Time).UTC().Format(time.RFC3339),
		"labels":     issueLabels(issue),
	}
	if issue.StateReason != nil {
		rd["state_reason"] = string(*issue.StateReason)
	}
	if issue.Milestone != nil {
		rd["milestone"] = string(issue.Milestone.Title)
	}
	if issue.Parent != nil {
		rd["parent"] = map[string]any{
			"node_id": issue.Parent.ID,
			"number":  int(issue.Parent.Number),
		}
	}

	if len(issue.SubIssues.Nodes) > 0 {
		var subs []map[string]any
		for _, si := range issue.SubIssues.Nodes {
			subs = append(subs, map[string]any{
				"number": int(si.Number),
				"title":  string(si.Title),
				"state":  string(si.State),
			})
		}
		rd["sub_issues"] = subs
	}
	rd["sub_issues_summary"] = map[string]any{
		"total":             int(issue.SubIssuesSummary.Total),
		"completed":         int(issue.SubIssuesSummary.Completed),
		"percent_completed": int(issue.SubIssuesSummary.PercentCompleted),
	}

	return rd
}

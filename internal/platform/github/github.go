package github

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	gh "github.com/google/go-github/v62/github"
	"github.com/google/uuid"
	"golang.org/x/oauth2"

	"github.com/farmtable-io/farmtable/internal/platform"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// GitHubAdapter implements platform.Adapter for GitHub Issues.
type GitHubAdapter struct {
	client *gh.Client
	store  store.Store
	owner  string
	repo   string
}

var _ platform.Adapter = (*GitHubAdapter)(nil)

func New(token, owner, repo string, s store.Store) *GitHubAdapter {
	ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	tc := oauth2.NewClient(context.Background(), ts)
	return &GitHubAdapter{
		client: gh.NewClient(tc),
		store:  s,
		owner:  owner,
		repo:   repo,
	}
}

func (a *GitHubAdapter) Platform() string { return "github" }

func (a *GitHubAdapter) SyncCollection(ctx context.Context, collectionID uuid.UUID, opts platform.SyncOptions) (platform.SyncResult, error) {
	var result platform.SyncResult

	listOpts := &gh.IssueListByRepoOptions{
		State:     "all",
		Sort:      "updated",
		Direction: "desc",
		ListOptions: gh.ListOptions{
			PerPage: 100,
		},
	}
	if opts.Since != nil {
		listOpts.Since = *opts.Since
	}

	existingTasks, err := a.buildRemoteIDIndex(ctx, collectionID)
	if err != nil {
		return result, fmt.Errorf("building remote ID index: %w", err)
	}

	for {
		issues, resp, err := a.client.Issues.ListByRepo(ctx, a.owner, a.repo, listOpts)
		if err != nil {
			return result, fmt.Errorf("listing issues: %w", err)
		}

		for _, issue := range issues {
			if issue.IsPullRequest() {
				continue
			}

			remoteID := a.remoteID(issue.GetNumber())
			params := IssueToCreateParams(issue, collectionID, remoteID, a.owner, a.repo)

			if existingID, ok := existingTasks[remoteID]; ok {
				updateParams := IssueToUpdateParams(issue, remoteID)
				if _, err := a.store.UpdateTask(ctx, existingID, updateParams, uuid.Nil); err != nil {
					result.Errors++
					continue
				}
				result.Updated++
			} else {
				if _, err := a.store.CreateTask(ctx, params); err != nil {
					result.Errors++
					continue
				}
				result.Created++
			}
		}

		if resp.NextPage == 0 {
			break
		}
		listOpts.Page = resp.NextPage
	}

	return result, nil
}

func (a *GitHubAdapter) PushTask(ctx context.Context, t *ent.Task) (string, error) {
	issueReq := TaskToIssueRequest(t)

	remoteNum := extractIssueNumber(t.RemoteData)
	if remoteNum > 0 {
		issue, _, err := a.client.Issues.Edit(ctx, a.owner, a.repo, remoteNum, issueReq)
		if err != nil {
			return "", fmt.Errorf("editing issue: %w", err)
		}
		return a.remoteID(issue.GetNumber()), nil
	}

	issue, _, err := a.client.Issues.Create(ctx, a.owner, a.repo, issueReq)
	if err != nil {
		return "", fmt.Errorf("creating issue: %w", err)
	}
	return a.remoteID(issue.GetNumber()), nil
}

func (a *GitHubAdapter) PushComment(ctx context.Context, c *ent.Comment, t *ent.Task) (string, error) {
	issueNum := extractIssueNumber(t.RemoteData)
	if issueNum == 0 {
		return "", fmt.Errorf("task %s has no GitHub issue number in remote_data", t.ID)
	}

	comment, _, err := a.client.Issues.CreateComment(ctx, a.owner, a.repo, issueNum, &gh.IssueComment{
		Body: gh.String(c.Body),
	})
	if err != nil {
		return "", fmt.Errorf("creating comment: %w", err)
	}
	return strconv.FormatInt(comment.GetID(), 10), nil
}

// IssueToCreateParams maps a GitHub issue to store.CreateTaskParams.
func IssueToCreateParams(issue *gh.Issue, collectionID uuid.UUID, remoteID, owner, repo string) store.CreateTaskParams {
	phase, stage := issueStateToPhaseStage(issue.GetState())

	p := store.CreateTaskParams{
		Title:        issue.GetTitle(),
		Description:  issue.GetBody(),
		CollectionID: collectionID,
		Phase:        phase,
		Stage:        stage,
		NativeLabel:  issue.GetState(),
		Type:         "issue",
		RemoteData:   buildRemoteData(issue, remoteID),
		Repo:         fmt.Sprintf("%s/%s", owner, repo),
	}

	for _, l := range issue.Labels {
		p.Labels = append(p.Labels, l.GetName())
	}

	if assignee := issue.GetAssignee(); assignee != nil {
		aid := deterministicUUID(assignee.GetLogin())
		p.AssigneeID = &aid
	}

	return p
}

// IssueToUpdateParams maps a GitHub issue to store.UpdateTaskParams for upsert.
func IssueToUpdateParams(issue *gh.Issue, remoteID string) store.UpdateTaskParams {
	phase, stage := issueStateToPhaseStage(issue.GetState())
	title := issue.GetTitle()
	desc := issue.GetBody()
	nativeLabel := issue.GetState()
	issueType := "issue"

	p := store.UpdateTaskParams{
		Title:       &title,
		Description: &desc,
		Phase:       &phase,
		Stage:       &stage,
		NativeLabel: &nativeLabel,
		Type:        &issueType,
		RemoteData:  buildRemoteData(issue, remoteID),
	}

	for _, l := range issue.Labels {
		p.AddLabels = append(p.AddLabels, l.GetName())
	}

	if assignee := issue.GetAssignee(); assignee != nil {
		aid := deterministicUUID(assignee.GetLogin())
		p.AssigneeID = &aid
	} else {
		p.ClearAssignee = true
	}

	return p
}

// TaskToIssueRequest maps an ent.Task to a GitHub IssueRequest for create/edit.
func TaskToIssueRequest(t *ent.Task) *gh.IssueRequest {
	req := &gh.IssueRequest{
		Title: gh.String(t.Title),
	}
	if t.Description != "" {
		req.Body = gh.String(t.Description)
	}

	state := phaseToIssueState(t.Phase)
	req.State = gh.String(state)

	labels := extractLabels(t.RemoteData)
	if len(labels) > 0 {
		req.Labels = &labels
	}

	return req
}

func issueStateToPhaseStage(state string) (task.Phase, task.Stage) {
	switch state {
	case "closed":
		return task.PhaseClosed, task.StageCompleted
	default:
		return task.PhaseOpen, task.StageTriage
	}
}

func phaseToIssueState(phase task.Phase) string {
	if phase == task.PhaseClosed {
		return "closed"
	}
	return "open"
}

func buildRemoteData(issue *gh.Issue, remoteID string) map[string]any {
	rd := map[string]any{
		"remote_id":  remoteID,
		"html_url":   issue.GetHTMLURL(),
		"number":     issue.GetNumber(),
		"created_at": issue.GetCreatedAt().Format(time.RFC3339),
		"updated_at": issue.GetUpdatedAt().Format(time.RFC3339),
	}

	if issue.Milestone != nil {
		rd["milestone"] = issue.Milestone.GetTitle()
	}

	var labelNames []string
	for _, l := range issue.Labels {
		labelNames = append(labelNames, l.GetName())
	}
	if len(labelNames) > 0 {
		rd["labels"] = labelNames
	}

	return rd
}

func extractLabels(remoteData map[string]any) []string {
	if remoteData == nil {
		return nil
	}
	raw, ok := remoteData["labels"]
	if !ok {
		return nil
	}
	switch v := raw.(type) {
	case []string:
		return v
	case []any:
		var out []string
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func extractIssueNumber(remoteData map[string]any) int {
	if remoteData == nil {
		return 0
	}
	raw, ok := remoteData["number"]
	if !ok {
		return 0
	}
	switch v := raw.(type) {
	case int:
		return v
	case float64:
		return int(v)
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	}
	return 0
}

func deterministicUUID(input string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("github:user:"+input))
}

func (a *GitHubAdapter) remoteID(number int) string {
	return fmt.Sprintf("%s/%s#%d", a.owner, a.repo, number)
}

func (a *GitHubAdapter) buildRemoteIDIndex(ctx context.Context, collectionID uuid.UUID) (map[string]uuid.UUID, error) {
	index := make(map[string]uuid.UUID)

	limit := 200
	var lastID string
	var lastSortValue string
	for {
		tasks, _, err := a.store.ListTasks(ctx, store.ListTasksParams{
			CollectionID:  &collectionID,
			Limit:         limit,
			LastID:        lastID,
			LastSortValue: lastSortValue,
		})
		if err != nil {
			return nil, err
		}
		for _, t := range tasks {
			if rid, ok := t.RemoteData["remote_id"].(string); ok {
				index[rid] = t.ID
			}
		}
		if len(tasks) < limit {
			break
		}
		last := tasks[len(tasks)-1]
		lastID = last.ID.String()
		lastSortValue = last.CreatedAt.UTC().Format(time.RFC3339Nano)
	}

	return index, nil
}

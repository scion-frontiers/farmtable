package github

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	githubv4 "github.com/shurcooL/githubv4"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// GitHubPassThroughStore implements store.Store by proxying directly to
// GitHub's GraphQL API. No local database is used.
type GitHubPassThroughStore struct {
	gql    *graphqlClient
	mapper *LabelMapper
	owner  string
	repo   string

	// Cached values resolved on first use.
	repoID       githubv4.ID
	collectionID uuid.UUID
	labelIndex   map[string]githubv4.ID // label name -> node ID
}

var _ store.Store = (*GitHubPassThroughStore)(nil)

// NewPassThroughStore creates a store that proxies to GitHub Issues.
func NewPassThroughStore(token, owner, repo string, cfg *GitHubConfig) *GitHubPassThroughStore {
	if cfg == nil {
		cfg = DefaultConfig()
	}
	return &GitHubPassThroughStore{
		gql:          newGraphQLClient(token, owner, repo, cfg),
		mapper:       NewLabelMapper(cfg.GitHub.Labels),
		owner:        owner,
		repo:         repo,
		collectionID: deterministicUUID(fmt.Sprintf("github:%s/%s", owner, repo)),
	}
}

// ── ID mapping ──

func (s *GitHubPassThroughStore) issueUUID(number int) uuid.UUID {
	return deterministicUUID(fmt.Sprintf("github:%s/%s#%d", s.owner, s.repo, number))
}

func (s *GitHubPassThroughStore) commentUUID(id githubv4.ID) uuid.UUID {
	return deterministicUUID(fmt.Sprintf("github:comment:%v", id))
}

func (s *GitHubPassThroughStore) userUUID(login string) uuid.UUID {
	return deterministicUUID(fmt.Sprintf("github:user:%s", login))
}

func (s *GitHubPassThroughStore) issueNumberFromUUID(id uuid.UUID, issues []issueNode) int {
	for _, issue := range issues {
		if s.issueUUID(int(issue.Number)) == id {
			return int(issue.Number)
		}
	}
	return 0
}

// ── Lazy initialization ──

func (s *GitHubPassThroughStore) ensureRepoID(ctx context.Context) error {
	if s.repoID != nil {
		return nil
	}
	id, err := s.gql.getRepositoryID(ctx)
	if err != nil {
		return err
	}
	s.repoID = id
	return nil
}

func (s *GitHubPassThroughStore) ensureLabelIndex(ctx context.Context) error {
	if s.labelIndex != nil {
		return nil
	}
	labels, err := s.gql.listRepoLabels(ctx)
	if err != nil {
		return err
	}
	s.labelIndex = make(map[string]githubv4.ID, len(labels))
	for _, l := range labels {
		s.labelIndex[strings.ToLower(string(l.Name))] = l.ID
	}
	return nil
}

func (s *GitHubPassThroughStore) labelNameToID(name string) (githubv4.ID, bool) {
	id, ok := s.labelIndex[strings.ToLower(name)]
	return id, ok
}

func (s *GitHubPassThroughStore) labelNamesToIDs(names []string) []githubv4.ID {
	var ids []githubv4.ID
	for _, name := range names {
		if id, ok := s.labelNameToID(name); ok {
			ids = append(ids, id)
		}
	}
	return ids
}

// ── Convert issueNode → ent.Task ──

func (s *GitHubPassThroughStore) issueToTask(issue *issueNode) *ent.Task {
	labels := issueLabels(issue)
	stateStr := string(issue.State)
	stateReason := ""
	if issue.StateReason != nil {
		stateReason = string(*issue.StateReason)
	}

	phase, stage := s.mapper.IssueToPhaseStage(stateStr, stateReason, labels)
	priority, _ := s.mapper.MapLabelsToPriority(labels)
	taskType, _ := s.mapper.MapLabelsToType(labels)

	t := &ent.Task{
		ID:           s.issueUUID(int(issue.Number)),
		Title:        string(issue.Title),
		Description:  string(issue.Body),
		Phase:        phase,
		Stage:        stage,
		NativeLabel:  string(stage),
		Type:         taskType,
		Priority:     priority,
		CollectionID: s.collectionID,
		CreatedAt:    issue.CreatedAt.Time,
		UpdatedAt:    issue.UpdatedAt.Time,
		RemoteData:   issueBuildRemoteData(s.owner, s.repo, issue),
		Labels:       labels,
		Version:      fmt.Sprintf("%d", issue.UpdatedAt.Unix()),
	}

	if len(issue.Assignees.Nodes) > 0 {
		aid := s.userUUID(string(issue.Assignees.Nodes[0].Login))
		t.AssigneeID = &aid
	}
	if issue.Parent != nil {
		pid := s.issueUUID(int(issue.Parent.Number))
		t.ParentTaskID = &pid
	}

	if stateStr == "CLOSED" {
		now := time.Now()
		t.ClosedAt = &now
	}

	return t
}

// ── Task CRUD ──

func (s *GitHubPassThroughStore) ListTasks(ctx context.Context, p store.ListTasksParams) ([]*ent.Task, int, error) {
	var states []githubv4.IssueState
	if p.Phase != nil {
		switch *p.Phase {
		case task.PhaseClosed:
			states = []githubv4.IssueState{githubv4.IssueStateClosed}
		default:
			states = []githubv4.IssueState{githubv4.IssueStateOpen}
		}
	} else {
		states = []githubv4.IssueState{githubv4.IssueStateOpen, githubv4.IssueStateClosed}
	}

	var labelFilter []string
	if p.Stage != nil {
		if stageLabel := s.mapper.StageToLabel(*p.Stage); stageLabel != "" {
			labelFilter = append(labelFilter, stageLabel)
		}
	}
	if len(p.Labels) > 0 {
		labelFilter = append(labelFilter, p.Labels...)
	}

	limit := p.Limit
	if limit <= 0 {
		limit = 50
	}

	issues, err := s.gql.listIssues(ctx, states, labelFilter, limit)
	if err != nil {
		return nil, 0, err
	}

	var tasks []*ent.Task
	for i := range issues {
		t := s.issueToTask(&issues[i])

		if p.Priority != nil && (t.Priority == nil || *t.Priority != *p.Priority) {
			continue
		}
		if p.Type != nil && t.Type != *p.Type {
			continue
		}
		if p.AssigneeID != nil && (t.AssigneeID == nil || *t.AssigneeID != *p.AssigneeID) {
			continue
		}
		if p.Unassigned && t.AssigneeID != nil {
			continue
		}

		tasks = append(tasks, t)
	}

	return tasks, len(tasks), nil
}

func (s *GitHubPassThroughStore) GetTask(ctx context.Context, id uuid.UUID) (*ent.Task, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen, githubv4.IssueStateClosed}, nil, 200)
	if err != nil {
		return nil, err
	}

	for i := range issues {
		if s.issueUUID(int(issues[i].Number)) == id {
			return s.issueToTask(&issues[i]), nil
		}
	}

	return nil, store.ErrNotFound
}

func (s *GitHubPassThroughStore) CreateTask(ctx context.Context, p store.CreateTaskParams) (*ent.Task, error) {
	if err := s.ensureRepoID(ctx); err != nil {
		return nil, err
	}
	if err := s.ensureLabelIndex(ctx); err != nil {
		return nil, err
	}

	var labelIDs []githubv4.ID

	stageLabel := s.mapper.StageToLabel(p.Stage)
	if stageLabel != "" {
		if id, ok := s.labelNameToID(stageLabel); ok {
			labelIDs = append(labelIDs, id)
		}
	}

	if p.Priority != nil {
		prioLabel := s.mapper.PriorityToLabel(*p.Priority)
		if prioLabel != "" {
			if id, ok := s.labelNameToID(prioLabel); ok {
				labelIDs = append(labelIDs, id)
			}
		}
	}

	for _, l := range p.Labels {
		if id, ok := s.labelNameToID(l); ok {
			labelIDs = append(labelIDs, id)
		}
	}

	var parentIssue *issueNode
	var err error
	if p.ParentTaskID != nil {
		parentIssue, err = s.getIssueByTaskID(ctx, *p.ParentTaskID)
		if err != nil {
			return nil, err
		}
		if err := s.checkSubIssueLimits(ctx, parentIssue); err != nil {
			return nil, err
		}
	}

	issue, err := s.gql.createIssue(ctx, s.repoID, p.Title, p.Description, labelIDs, nil)
	if err != nil {
		return nil, err
	}
	if parentIssue != nil {
		if err := s.gql.addSubIssue(ctx, parentIssue.ID, issue.ID); err != nil {
			return nil, err
		}
		issue.Parent = &parentIssueNode{ID: parentIssue.ID, Number: parentIssue.Number}
	}
	return s.issueToTask(issue), nil
}

func (s *GitHubPassThroughStore) UpdateTask(ctx context.Context, id uuid.UUID, p store.UpdateTaskParams, actorID uuid.UUID) (*ent.Task, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen, githubv4.IssueStateClosed}, nil, 200)
	if err != nil {
		return nil, err
	}

	var target *issueNode
	for i := range issues {
		if s.issueUUID(int(issues[i].Number)) == id {
			target = &issues[i]
			break
		}
	}
	if target == nil {
		return nil, store.ErrNotFound
	}

	issueID := target.ID
	oldParentID := githubv4.ID(nil)
	if target.Parent != nil {
		oldParentID = target.Parent.ID
	}

	updated, err := s.gql.updateIssue(ctx, issueID, p.Title, p.Description)
	if err != nil {
		return nil, err
	}

	if p.Stage != nil {
		if err := s.ensureLabelIndex(ctx); err != nil {
			return nil, err
		}
		currentLabels := issueLabels(target)
		add, remove := s.mapper.StageLabelSwap(currentLabels, *p.Stage)

		removeIDs := s.labelNamesToIDs(remove)
		if len(removeIDs) > 0 {
			_ = s.gql.removeLabels(ctx, issueID, removeIDs)
		}
		addIDs := s.labelNamesToIDs(add)
		if len(addIDs) > 0 {
			_ = s.gql.addLabels(ctx, issueID, addIDs)
		}
	}

	if p.Priority != nil {
		if err := s.ensureLabelIndex(ctx); err != nil {
			return nil, err
		}
		currentLabels := issueLabels(target)
		add, remove := s.mapper.PriorityLabelSwap(currentLabels, *p.Priority)

		removeIDs := s.labelNamesToIDs(remove)
		if len(removeIDs) > 0 {
			_ = s.gql.removeLabels(ctx, issueID, removeIDs)
		}
		addIDs := s.labelNamesToIDs(add)
		if len(addIDs) > 0 {
			_ = s.gql.addLabels(ctx, issueID, addIDs)
		}
	}

	if p.AssigneeID != nil {
		_ = s.gql.updateIssueAssignees(ctx, issueID, nil)
	}

	if p.ClearParent || p.ParentTaskID != nil {
		if oldParentID != nil {
			if err := s.gql.removeSubIssue(ctx, oldParentID, issueID); err != nil {
				return nil, err
			}
			updated.Parent = nil
		}

		if p.ParentTaskID != nil {
			parentIssue, err := s.getIssueByTaskID(ctx, *p.ParentTaskID)
			if err != nil {
				return nil, err
			}
			if err := s.checkSubIssueLimits(ctx, parentIssue); err != nil {
				return nil, err
			}
			if err := s.gql.addSubIssue(ctx, parentIssue.ID, issueID); err != nil {
				return nil, err
			}
			updated.Parent = &parentIssueNode{ID: parentIssue.ID, Number: parentIssue.Number}
		}
	}

	return s.issueToTask(updated), nil
}

func (s *GitHubPassThroughStore) getIssueByTaskID(ctx context.Context, id uuid.UUID) (*issueNode, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen, githubv4.IssueStateClosed}, nil, 200)
	if err != nil {
		return nil, err
	}

	for i := range issues {
		if s.issueUUID(int(issues[i].Number)) == id {
			return &issues[i], nil
		}
	}
	return nil, store.ErrNotFound
}

func (s *GitHubPassThroughStore) checkSubIssueLimits(ctx context.Context, parent *issueNode) error {
	if parent == nil {
		return store.ErrNotFound
	}

	if int(parent.SubIssues.TotalCount) >= MaxSubIssuesPerParent {
		return fmt.Errorf("sub-issue count limit (%d) exceeded", MaxSubIssuesPerParent)
	}

	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen, githubv4.IssueStateClosed}, nil, 200)
	if err != nil {
		return err
	}
	if s.issueDepth(parent, issues) >= MaxSubIssueDepth {
		return fmt.Errorf("sub-issue depth limit (%d) exceeded", MaxSubIssueDepth)
	}
	return nil
}

func (s *GitHubPassThroughStore) issueDepth(issue *issueNode, issues []issueNode) int {
	depth := 1
	seen := map[int]bool{int(issue.Number): true}
	current := issue
	for current.Parent != nil {
		parentNumber := int(current.Parent.Number)
		if seen[parentNumber] {
			break
		}
		seen[parentNumber] = true
		parent := s.findIssueByNumber(issues, parentNumber)
		if parent == nil {
			depth++
			break
		}
		depth++
		current = parent
	}
	return depth
}

func (s *GitHubPassThroughStore) ClaimTask(ctx context.Context, id uuid.UUID, assigneeID uuid.UUID, version string) (*ent.Task, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen}, nil, 200)
	if err != nil {
		return nil, err
	}

	var target *issueNode
	for i := range issues {
		if s.issueUUID(int(issues[i].Number)) == id {
			target = &issues[i]
			break
		}
	}
	if target == nil {
		return nil, store.ErrNotFound
	}

	issueID := target.ID

	if err := s.ensureLabelIndex(ctx); err != nil {
		return nil, err
	}
	currentLabels := issueLabels(target)
	add, remove := s.mapper.StageLabelSwap(currentLabels, task.StageWorking)

	removeIDs := s.labelNamesToIDs(remove)
	if len(removeIDs) > 0 {
		_ = s.gql.removeLabels(ctx, issueID, removeIDs)
	}
	addIDs := s.labelNamesToIDs(add)
	if len(addIDs) > 0 {
		_ = s.gql.addLabels(ctx, issueID, addIDs)
	}

	refreshed, err := s.gql.getIssue(ctx, int(target.Number))
	if err != nil {
		return nil, err
	}
	return s.issueToTask(refreshed), nil
}

func (s *GitHubPassThroughStore) CloseTask(ctx context.Context, id uuid.UUID, stage task.Stage, version string, actorID uuid.UUID) (*ent.Task, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen}, nil, 200)
	if err != nil {
		return nil, err
	}

	var target *issueNode
	for i := range issues {
		if s.issueUUID(int(issues[i].Number)) == id {
			target = &issues[i]
			break
		}
	}
	if target == nil {
		return nil, store.ErrNotFound
	}

	reason := githubv4.IssueClosedStateReasonCompleted
	if stage == task.StageWontFix || stage == task.StageCancelled {
		reason = githubv4.IssueClosedStateReasonNotPlanned
	}

	closed, err := s.gql.closeIssue(ctx, target.ID, reason)
	if err != nil {
		return nil, err
	}
	return s.issueToTask(closed), nil
}

func (s *GitHubPassThroughStore) DeleteTask(ctx context.Context, id uuid.UUID) error {
	return fmt.Errorf("delete task: %w", store.ErrNotImplemented)
}

// ── Collections ──

func (s *GitHubPassThroughStore) CreateCollection(ctx context.Context, p store.CreateCollectionParams) (*ent.Collection, error) {
	return s.syntheticCollection(), nil
}

func (s *GitHubPassThroughStore) GetCollection(ctx context.Context, id uuid.UUID) (*ent.Collection, error) {
	return s.syntheticCollection(), nil
}

func (s *GitHubPassThroughStore) ListCollections(ctx context.Context, p store.ListCollectionsParams) ([]*ent.Collection, int, error) {
	return []*ent.Collection{s.syntheticCollection()}, 1, nil
}

func (s *GitHubPassThroughStore) syntheticCollection() *ent.Collection {
	return &ent.Collection{
		ID:          s.collectionID,
		Name:        fmt.Sprintf("%s/%s", s.owner, s.repo),
		Description: fmt.Sprintf("GitHub Issues: %s/%s (pass-through)", s.owner, s.repo),
		Platform:    collection.PlatformGithub,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

// ── Comments ──

func (s *GitHubPassThroughStore) AddComment(ctx context.Context, p store.AddCommentParams) (*ent.Comment, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen, githubv4.IssueStateClosed}, nil, 200)
	if err != nil {
		return nil, err
	}

	var issueID githubv4.ID
	var taskID uuid.UUID
	found := false
	for _, issue := range issues {
		if s.issueUUID(int(issue.Number)) == p.TaskID {
			issueID = issue.ID
			taskID = p.TaskID
			found = true
			break
		}
	}
	if !found {
		return nil, store.ErrNotFound
	}

	node, err := s.gql.addComment(ctx, issueID, p.Body)
	if err != nil {
		return nil, err
	}

	return &ent.Comment{
		ID:        s.commentUUID(node.ID),
		TaskID:    taskID,
		AuthorID:  p.AuthorID,
		Body:      string(node.Body),
		CreatedAt: node.CreatedAt.Time,
		UpdatedAt: node.UpdatedAt.Time,
	}, nil
}

func (s *GitHubPassThroughStore) GetComment(ctx context.Context, id uuid.UUID) (*ent.Comment, error) {
	return nil, fmt.Errorf("get comment by ID: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ListComments(ctx context.Context, p store.ListCommentsParams) ([]*ent.Comment, int, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen, githubv4.IssueStateClosed}, nil, 200)
	if err != nil {
		return nil, 0, err
	}

	var issueNumber int
	for _, issue := range issues {
		if s.issueUUID(int(issue.Number)) == p.TaskID {
			issueNumber = int(issue.Number)
			break
		}
	}
	if issueNumber == 0 {
		return nil, 0, store.ErrNotFound
	}

	limit := p.Limit
	if limit <= 0 {
		limit = 50
	}

	nodes, err := s.gql.listIssueComments(ctx, issueNumber, limit)
	if err != nil {
		return nil, 0, err
	}

	var comments []*ent.Comment
	for _, n := range nodes {
		comments = append(comments, &ent.Comment{
			ID:        s.commentUUID(n.ID),
			TaskID:    p.TaskID,
			AuthorID:  s.userUUID(string(n.Author.Login)),
			Body:      string(n.Body),
			CreatedAt: n.CreatedAt.Time,
			UpdatedAt: n.UpdatedAt.Time,
		})
	}

	return comments, len(comments), nil
}

// ── Audit Trail ──

func (s *GitHubPassThroughStore) ListChanges(ctx context.Context, p store.ListChangesParams) ([]*ent.Change, int, error) {
	return nil, 0, fmt.Errorf("list changes: %w", store.ErrNotImplemented)
}

// ── Graph Queries ──

func (s *GitHubPassThroughStore) GetReadyTasks(ctx context.Context, p store.GetReadyTasksParams) ([]*store.ReadyTaskResult, int, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen}, nil, 0)
	if err != nil {
		return nil, 0, err
	}

	nodes := buildIssueTree(issues, s.mapper)
	readyNodes := computeReady(nodes, p.IncludeUnblockedOpen)

	var results []*store.ReadyTaskResult
	for _, r := range readyNodes {
		issue := s.findIssueByNumber(issues, r.Node.Number)
		if issue == nil {
			continue
		}
		t := s.issueToTask(issue)
		results = append(results, &store.ReadyTaskResult{
			Task:             t,
			BlockersResolved: 0,
		})
	}

	if p.Limit > 0 && len(results) > p.Limit {
		results = results[:p.Limit]
	}

	return results, len(results), nil
}

func (s *GitHubPassThroughStore) GetBlockedTasks(ctx context.Context, p store.GetBlockedTasksParams) ([]*store.BlockedTaskResult, int, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen}, nil, 0)
	if err != nil {
		return nil, 0, err
	}

	nodes := buildIssueTree(issues, s.mapper)
	blockedNodes := computeBlocked(nodes)

	var results []*store.BlockedTaskResult
	for _, b := range blockedNodes {
		issue := s.findIssueByNumber(issues, b.Node.Number)
		if issue == nil {
			continue
		}
		t := s.issueToTask(issue)
		result := &store.BlockedTaskResult{Task: t}
		for _, blocker := range b.BlockedBy {
			result.Blockers = append(result.Blockers, store.BlockerInfoResult{
				TaskID: s.issueUUID(blocker.Number),
				Name:   blocker.Title,
				Phase:  task.PhaseOpen,
				Stage:  blocker.Stage,
			})
		}
		results = append(results, result)
	}

	if p.Limit > 0 && len(results) > p.Limit {
		results = results[:p.Limit]
	}

	return results, len(results), nil
}

func (s *GitHubPassThroughStore) findIssueByNumber(issues []issueNode, number int) *issueNode {
	for i := range issues {
		if int(issues[i].Number) == number {
			return &issues[i]
		}
	}
	return nil
}

// ── Users (not applicable in pass-through mode) ──

func (s *GitHubPassThroughStore) CreateUser(ctx context.Context, p store.CreateUserParams) (*ent.User, error) {
	now := time.Now()
	return &ent.User{
		ID:          uuid.New(),
		DisplayName: p.DisplayName,
		Type:        p.Type,
		Status:      p.Status,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (s *GitHubPassThroughStore) GetUser(ctx context.Context, id uuid.UUID) (*ent.User, error) {
	return &ent.User{
		ID:          id,
		DisplayName: "github-user",
		Type:        "agent",
		Status:      "active",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}, nil
}

func (s *GitHubPassThroughStore) GetUserByName(ctx context.Context, name string) (*ent.User, error) {
	return &ent.User{
		ID:          s.userUUID(name),
		DisplayName: name,
		Type:        "agent",
		Status:      "active",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}, nil
}

func (s *GitHubPassThroughStore) ListUsers(ctx context.Context, p store.ListUsersParams) ([]*ent.User, int, error) {
	return nil, 0, nil
}

// ── API Tokens (not applicable in pass-through mode) ──

func (s *GitHubPassThroughStore) CreateAPIToken(ctx context.Context, p store.CreateAPITokenParams) (*ent.ApiToken, string, error) {
	tok := &ent.ApiToken{
		ID:        uuid.New(),
		UserID:    p.UserID,
		Name:      p.Name,
		CreatedAt: time.Now(),
	}
	return tok, "passthrough-token", nil
}

func (s *GitHubPassThroughStore) LookupToken(ctx context.Context, tokenHash string) (*ent.ApiToken, error) {
	return &ent.ApiToken{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		CreatedAt: time.Now(),
	}, nil
}

func (s *GitHubPassThroughStore) ListAPITokens(ctx context.Context, p store.ListAPITokensParams) ([]*ent.ApiToken, int, error) {
	return nil, 0, nil
}

func (s *GitHubPassThroughStore) RevokeAPIToken(ctx context.Context, id uuid.UUID) error {
	return fmt.Errorf("revoke API token: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) UpdateTokenLastUsed(ctx context.Context, id uuid.UUID) error {
	return nil
}

// ── Close ──

func (s *GitHubPassThroughStore) Close() error {
	return nil
}

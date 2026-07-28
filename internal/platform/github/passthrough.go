package github

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
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

	// collectionID is fixed at construction and never written afterwards, so
	// it needs no synchronisation.
	collectionID uuid.UUID

	// cacheMu guards the two lazily resolved fields below. One store instance
	// serves every request for its collection, so concurrent RPCs on it are
	// the normal case; without this, a lazy populate racing a read of
	// labelIndex is a concurrent map read and map write, which is a fatal
	// runtime error rather than a recoverable one (#198).
	//
	// The lock covers the cache fields only, never a network call. Both
	// ensureRepoID and ensureLabelIndex release it while fetching and re-check
	// under the write lock, so a concurrent populate costs a duplicate GitHub
	// request, not a blocked caller. That is the right trade: the fetches are
	// idempotent reads and both produce the same value.
	cacheMu    sync.RWMutex
	repoID     githubv4.ID
	labelIndex map[string]githubv4.ID // label name -> node ID
}

var _ store.Store = (*GitHubPassThroughStore)(nil)

// LifecycleStageSetStager is asserted at COMPILE TIME because nothing else
// does, and the runtime alternative fails open silently (#194 round 6, review
// F6).
//
// store.LifecycleStagesOf and store.LabelDeltaLifecycleStagesOf reach these
// methods through `if stager, ok := s.(LifecycleStageSetStager); ok`, and fall
// back to the SINGULAR reader when the assertion misses. So renaming a method,
// reordering a return, or adding a parameter here does not break a build and
// does not fail a test — it re-enables the exact single-answer collapse that
// B5 exists to remove, everywhere at once, with no diagnostic. A dynamic
// assertion whose miss is indistinguishable from "this store opted out" is not
// a check.
//
// One line, and the failure becomes a compile error at the site that caused it.
// MultiStore reaches the same interface by the same runtime assertion and had
// the same gap; leg B pinned it in internal/store/multistore.go in the same
// round. Both implementers are covered — this note is a cross-reference, not an
// open item.
var _ store.LifecycleStageSetStager = (*GitHubPassThroughStore)(nil)

// NewPassThroughStore creates a store that proxies to GitHub Issues.
// If collectionID is non-nil the provided value is used; otherwise a
// deterministic UUID is derived from the owner/repo pair.
func NewPassThroughStore(token, owner, repo string, cfg *GitHubConfig, collectionID *uuid.UUID) *GitHubPassThroughStore {
	if cfg == nil {
		cfg = DefaultConfig()
	}
	cid := deterministicUUID(fmt.Sprintf("github:%s/%s", owner, repo))
	if collectionID != nil {
		cid = *collectionID
	}
	return &GitHubPassThroughStore{
		gql:          newGraphQLClient(token, owner, repo, cfg),
		mapper:       NewLabelMapper(cfg.GitHub.Labels),
		owner:        owner,
		repo:         repo,
		collectionID: cid,
	}
}

// ── ID mapping ──

func (s *GitHubPassThroughStore) issueUUID(number int) uuid.UUID {
	return deterministicUUID(fmt.Sprintf("github:%s/%s#%d", s.owner, s.repo, number))
}

// repoSlug is the owner/repo pair, for log messages. A pass-through store is
// bound to one repository, but a process serves many, so a log line naming
// only the issue number is ambiguous.
func (s *GitHubPassThroughStore) repoSlug() string {
	return s.owner + "/" + s.repo
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
	s.cacheMu.RLock()
	cached := s.repoID != nil
	s.cacheMu.RUnlock()
	if cached {
		return nil
	}

	id, err := s.gql.getRepositoryID(ctx)
	if err != nil {
		return err
	}

	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	// Re-check: another goroutine may have populated it while this one was in
	// flight. Keeping the first winner rather than overwriting means callers
	// that already read the field see a value that does not change under them.
	if s.repoID == nil {
		s.repoID = id
	}
	return nil
}

func (s *GitHubPassThroughStore) ensureLabelIndex(ctx context.Context) error {
	s.cacheMu.RLock()
	cached := s.labelIndex != nil
	s.cacheMu.RUnlock()
	if cached {
		return nil
	}

	labels, err := s.gql.listRepoLabels(ctx)
	if err != nil {
		return err
	}

	// Build into a local map and publish it in one assignment. Populating
	// s.labelIndex entry by entry would expose a partially filled map to any
	// reader that took the read lock between entries, which is worse than the
	// race it replaces: a silently missing label ID is a skipped label write,
	// not a crash.
	index := make(map[string]githubv4.ID, len(labels))
	for _, l := range labels {
		index[strings.ToLower(string(l.Name))] = l.ID
	}

	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	if s.labelIndex == nil {
		s.labelIndex = index
	}
	return nil
}

// cachedRepoID reads the repo ID cache. ensureRepoID must have been called
// first; this only reads what that populated, under the lock.
func (s *GitHubPassThroughStore) cachedRepoID() githubv4.ID {
	s.cacheMu.RLock()
	defer s.cacheMu.RUnlock()
	return s.repoID
}

// labelNameToID reads the label cache under the read lock.
//
// Every call site today happens to be preceded by ensureLabelIndex on the same
// goroutine, which acquires cacheMu and so orders this read after whichever
// publish won — meaning that with the double-check above in place, dropping
// this read lock does not currently reproduce a race. That is an argument
// spanning two functions and resting on the double-check, not a property of
// this one, and it is exactly the kind of reasoning that stops being true when
// someone adds a caller or relaxes the publish. Allow re-publication and the
// unlocked read races immediately; both variants were measured.
//
// So the lock stays, and it is what actually makes the read safe. The map is
// never mutated after publication, so concurrent readers never contend.
func (s *GitHubPassThroughStore) labelNameToID(name string) (githubv4.ID, bool) {
	s.cacheMu.RLock()
	defer s.cacheMu.RUnlock()
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

	if issueStateClosed(stateStr) {
		if issue.ClosedAt != nil {
			closedAt := issue.ClosedAt.Time
			t.ClosedAt = &closedAt
		} else {
			// Defensive fallback: if the GitHub API returns a null ClosedAt
			// for a CLOSED issue (API race or legacy data), use UpdatedAt
			// rather than leaving ClosedAt nil or fabricating time.Now().
			fallback := issue.UpdatedAt.Time
			t.ClosedAt = &fallback
		}
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

func (s *GitHubPassThroughStore) ListAllTasksForCollection(ctx context.Context, p store.ListAllTasksForCollectionParams) ([]*ent.Task, error) {
	return nil, fmt.Errorf("list all tasks for collection: %w", store.ErrNotImplemented)
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

	issue, err := s.gql.createIssue(ctx, s.cachedRepoID(), p.Title, p.Description, labelIDs, nil)
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

func (s *GitHubPassThroughStore) InsertTasksAfter(ctx context.Context, p store.InsertTasksAfterParams) (*store.InsertTasksAfterResult, error) {
	return nil, fmt.Errorf("insert tasks after: %w", store.ErrNotImplemented)
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

	if p.Type != nil {
		if err := s.ensureLabelIndex(ctx); err != nil {
			return nil, err
		}
		currentLabels := issueLabels(target)
		add, remove := s.mapper.TypeLabelSwap(currentLabels, *p.Type)

		removeIDs := s.labelNamesToIDs(remove)
		if len(removeIDs) > 0 {
			_ = s.gql.removeLabels(ctx, issueID, removeIDs)
		}
		addIDs := s.labelNamesToIDs(add)
		if len(addIDs) > 0 {
			_ = s.gql.addLabels(ctx, issueID, addIDs)
		}
	}

	if len(p.AddLabels) > 0 {
		if err := s.ensureLabelIndex(ctx); err != nil {
			return nil, err
		}
		addIDs := s.labelNamesToIDs(p.AddLabels)
		if len(addIDs) > 0 {
			_ = s.gql.addLabels(ctx, issueID, addIDs)
		}
	}
	if len(p.RemoveLabels) > 0 {
		if err := s.ensureLabelIndex(ctx); err != nil {
			return nil, err
		}
		removeIDs := s.labelNamesToIDs(p.RemoveLabels)
		if len(removeIDs) > 0 {
			_ = s.gql.removeLabels(ctx, issueID, removeIDs)
		}
	}

	if p.AssigneeID != nil {
		// Build UUID → GitHub node ID reverse lookup from already-fetched issue data.
		// The deterministic UUID is generated via s.userUUID(login), so we scan
		// all issue assignees to find the one whose UUID matches the target.
		var assigneeNodeID githubv4.ID
		for _, issue := range issues {
			for _, a := range issue.Assignees.Nodes {
				if s.userUUID(string(a.Login)) == *p.AssigneeID {
					assigneeNodeID = a.ID
					break
				}
			}
			if assigneeNodeID != nil {
				break
			}
		}
		if assigneeNodeID != nil {
			_ = s.gql.updateIssueAssignees(ctx, issueID, []githubv4.ID{assigneeNodeID})
		} else {
			// Assignee UUID not found among current issue assignees — clear assignees.
			_ = s.gql.updateIssueAssignees(ctx, issueID, nil)
		}
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

	current := s.issueToTask(target)
	if current.AssigneeID != nil {
		return nil, store.ErrAlreadyClaimed
	}
	if issueUnavailableForClaim(s.mapper, target, current, s.LifecycleStage(ctx, current)) {
		return nil, store.ErrUnavailable
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

func hasOpenSubIssue(issue *issueNode) bool {
	for _, child := range issue.SubIssues.Nodes {
		if issueStateOpen(string(child.State)) {
			return true
		}
	}
	return false
}

// issueUnavailableForClaim is the pass-through store's claim gate. It is the
// enforcement counterpart to ComputeAvailability, which is advisory here, and
// the two must not disagree about what "unavailable" means.
//
// The ClosedAt arm is, today, a behaviour-preserving no-op: ClaimTask resolves
// its target from a listIssues call filtered to IssueStateOpen, so every task
// reaching this function came from an open issue and issueToTask left ClosedAt
// nil. It is here because ComputeAvailability gained the same arm in #194 Part
// 2, and the reason it gained it — that a stale non-terminal stage label can
// outlive a close, leaving Stage alone unable to see terminality — applies
// identically to the claim gate. Anything that widens the filter, adds a
// caller, or reaches this function from a cached or replayed issue makes the
// arm load-bearing without touching this line, and the failure it would
// prevent is handing a closed task to an agent.
//
// lifecycleStage is the task's authoritative stage, not its display stage. The
// caller passes it because this function cannot derive it: for an OPEN issue
// carrying a terminal label, t.Stage has already been demoted to "accepted" by
// IssueToPhaseStage, and reading it here would let a maintainer's wont_fix,
// duplicate or cancelled be claimed as ordinary work. Keeping this in step with
// ComputeAvailability is the invariant this doc comment opens with; both now
// read the lifecycle stage.
func issueUnavailableForClaim(m *LabelMapper, issue *issueNode, t *ent.Task, lifecycleStage task.Stage) bool {
	return lifecycleStage != task.StageAccepted ||
		t.ClosedAt != nil ||
		t.HoldReason != nil ||
		m.hasExternalUnavailableLabel(t.Labels) ||
		hasOpenSubIssue(issue)
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

	// Swap the stage labels so the closed issue carries a label matching its
	// terminal stage, the same way UpdateTask and ClaimTask do.
	//
	// Ordering is deliberate. The close is the primary, user-requested effect,
	// so it runs first and its failure aborts before any label is touched.
	// A label write that fails afterwards leaves a closed issue carrying a
	// stale non-terminal stage label; the ClosedAt arm of ComputeAvailability
	// keeps that residue harmless. The reverse order would leave an issue that
	// is still OPEN on GitHub labelled with a terminal stage. IssueToPhaseStage
	// now demotes that combination to accepted, so it is no longer undetectable
	// — but the close would still not have happened, which is the effect the
	// caller asked for. Label writes are therefore best effort and never fail
	// an already-completed close.
	// Each best-effort failure below is logged and not returned. Logging is the
	// whole remedy available here: the close has already happened and cannot be
	// undone, so there is nothing to report to the caller that would not read as
	// "your close failed". What the log buys is the ability to tell a stale
	// label caused by a rejected write from one caused by a bug, which is
	// otherwise indistinguishable from the outside.
	if err := s.ensureLabelIndex(ctx); err == nil {
		currentLabels := issueLabels(target)
		add, remove := s.mapper.StageLabelSwap(currentLabels, stage)

		removeIDs := s.labelNamesToIDs(remove)
		if len(removeIDs) > 0 {
			if err := s.gql.removeLabels(ctx, target.ID, removeIDs); err != nil {
				log.Printf("github passthrough: close %s#%d: removing stage labels %v failed, "+
					"issue is closed but may carry a stale stage label: %v",
					s.repoSlug(), target.Number, remove, err)
			}
		}
		addIDs := s.labelNamesToIDs(add)
		if len(addIDs) > 0 {
			if err := s.gql.addLabels(ctx, target.ID, addIDs); err != nil {
				log.Printf("github passthrough: close %s#%d: adding stage label %v failed, "+
					"issue is closed but is not labelled %s: %v",
					s.repoSlug(), target.Number, add, stage, err)
			}
		}
	} else {
		log.Printf("github passthrough: close %s#%d: label index unavailable, "+
			"issue is closed but its stage label was not swapped to %s: %v",
			s.repoSlug(), target.Number, stage, err)
	}

	// The closeIssue payload was captured before the label swap, so re-read the
	// issue to report the post-swap stage. If the re-read fails the close still
	// happened, so fall back to the mutation payload rather than reporting an
	// error for work that succeeded.
	refreshed, err := s.gql.getIssue(ctx, int(target.Number))
	if err != nil {
		log.Printf("github passthrough: close %s#%d: post-close re-read failed, "+
			"reporting the pre-swap close payload instead: %v",
			s.repoSlug(), target.Number, err)
		return s.issueToTask(closed), nil
	}
	return s.issueToTask(refreshed), nil
}

func (s *GitHubPassThroughStore) DeleteTask(ctx context.Context, id uuid.UUID) error {
	return fmt.Errorf("delete task: %w", store.ErrNotImplemented)
}

// LifecycleStage implements store.LifecycleStager. It returns the stage that
// authorization and work-scheduling decisions must use for a task this store
// produced, which is not always the stage the task displays.
//
// issueToTask reports an OPEN issue carrying a terminal stage label as
// "accepted" (see the rule-2 exception in IssueToPhaseStage) so that live work
// is never presented as finished. That demotion must not reach a decision that
// grants privilege or hands work to an agent, because a maintainer's wont_fix,
// duplicate or cancelled label is a real statement about the work regardless of
// whether someone has reopened the issue on GitHub.
//
// The labels are read from the task rather than re-fetched: issueToTask copies
// the issue's labels onto t.Labels verbatim, so this is the same input
// IssueToPhaseStage saw, not a second round trip that could disagree with it.
//
// ── THE INVARIANCE THIS FUNCTION DEPENDS ON, AND WHO OWES IT ──
//
// This returns ONE terminal stage where the issue may name several.
// TerminalLabelStage resolves that with terminalStagePrecedence, a tiebreak —
// so which stage comes back here is a choice, not a fact about the issue. B5
// exists precisely because letting a tiebreak decide an authorization question
// is how a task:write holder converted a maintainer's wont_fix into completed.
//
// B5's set-valued reader (LifecycleStages) is NOT what this function's two
// consumers use. They use this one:
//
//	issueUnavailableForClaim (:  the claim gate)  lifecycleStage != StageAccepted
//	ComputeAvailability      (:  the availability gate)  IsTerminalStage(...)
//
// That is safe because BOTH COLLAPSE EVERY TERMINAL STAGE TO ONE BOOLEAN. No
// terminal stage is accepted, and every terminal stage is terminal, so
// whichever stage the tiebreak selects, both answers are unchanged. Verified
// by execution under a reversed terminalStagePrecedence: the winner moved,
// both answers held.
//
// THIS IS A PRECONDITION ON THE CONSUMERS, NOT A PROPERTY OF THIS FUNCTION.
// It is the kind of assumption that has an expiration date nobody set, so the
// date is enforced instead of trusted:
//
//	TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer
//	    - drives both consumers with each terminal stage, from the enum, and
//	      fails if any two answers differ
//	TestSingularSinksAreBlindToTheTerminalTiebreak
//	    - drives ClaimTask and ComputeAvailability end to end with TWO terminal
//	      labels, the input that makes the tiebreak observable at all
//
// If you are adding a consumer that needs to know WHICH terminal stage — a
// distinct denial reason for wont_fix vs duplicate is the obvious one — do not
// read it from here. Use LifecycleStages and decide against the whole set,
// or you reopen B5 at a gate (#194 round 6).
func (s *GitHubPassThroughStore) LifecycleStage(ctx context.Context, t *ent.Task) task.Stage {
	if stage, ok := s.mapper.TerminalLabelStage(t.Labels); ok {
		return stage
	}
	return t.Stage
}

// LifecycleStages implements store.LifecycleStageSetStager. It reports every
// terminal stage the issue's labels name, not the one terminalStagePrecedence
// selects.
//
// An issue carrying two terminal labels is an ordinary state, not an exotic
// one: CloseTask stamps one, and a human applying GitHub's stock "duplicate"
// or an independently created label produces the second without anyone
// attacking anything. LifecycleStage has to collapse that to one value, and
// collapsing it is what let a task:write holder convert a maintainer's wont_fix
// into completed by re-asserting a stage the issue already carried — the
// tiebreak reported the destination as the source, so the transition table saw
// from == to and short-circuited to task:write. Returning the whole set lets
// the caller demand the strongest scope any present stage implies.
//
// Falls back to t.Stage, exactly as LifecycleStage does, so at zero or one
// terminal label this is byte-for-byte the round-4 answer wrapped in a slice.
func (s *GitHubPassThroughStore) LifecycleStages(ctx context.Context, t *ent.Task) []task.Stage {
	if stages := s.mapper.AllTerminalLabelStages(t.Labels); len(stages) > 0 {
		return stages
	}
	return []task.Stage{t.Stage}
}

// LabelDeltaLifecycleStages implements store.LifecycleStageSetStager.
//
// In this store the authoritative lifecycle stage IS a label, so add_labels
// and remove_labels are stage writes wearing the clothes of metadata edits.
// This reports what such an edit would move the stage from and to, so the
// caller can charge it the same scope the equivalent stage change would cost
// (#194 round 5).
//
// Both endpoints go through lifecycleStagesForLabels so the only difference
// between them is the label set. "before" is deliberately NOT taken from
// LifecycleStage above: that reads t.Stage as its non-terminal fallback while
// this must model a hypothetical label set, and mixing the two sources would
// make the two endpoints disagree for reasons that have nothing to do with the
// edit. lifecycleStagesForLabels(t, t.Labels) is expected to agree with
// LifecycleStage(t) for any task this store produced, and
// TestLifecycleStageForLabels_AgreesWithLifecycleStageOnTheTasksOwnLabels in
// the server package pins that agreement.
//
// Both endpoints are SETS for the same reason LifecycleStages is: comparing
// two tiebreak winners hides an edit that swaps one of several present terminal
// labels for another, and "the edit changed nothing" is precisely the answer
// that costs nothing.
func (s *GitHubPassThroughStore) LabelDeltaLifecycleStages(ctx context.Context, t *ent.Task, addLabels, removeLabels []string) (before, after []task.Stage) {
	if s.mapper == nil {
		return []task.Stage{t.Stage}, []task.Stage{t.Stage}
	}
	before = s.lifecycleStagesForLabels(t, t.Labels)
	after = s.lifecycleStagesForLabels(t, applyLabelDelta(t.Labels, addLabels, removeLabels))
	return before, after
}

// lifecycleStagesForLabels is LifecycleStage generalised twice over: to an
// arbitrary label set, and to every terminal stage that set names rather than
// one. It answers "which lifecycle stages would this issue name if it carried
// these labels?" and is never empty.
//
// The terminal scan comes first for the same reason it does in LifecycleStage
// — IssueToPhaseStage demotes an OPEN issue's terminal label to "accepted" for
// display, and that demotion must not reach a privilege decision. Below it,
// IssueToPhaseStage is the right answer and not a reimplementation of one:
// for non-terminal labels nothing is demoted, so the display mapping and the
// lifecycle mapping coincide, and a non-terminal label set names exactly one
// stage.
//
// state and stateReason are reconstructed from the task rather than re-fetched.
// ClosedAt is set by issueToTask from GitHub's own issue state and never from
// labels, so it is the same witness issueStateClosed consulted; state_reason is
// copied verbatim into RemoteData by issueBuildRemoteData. Reconstructing
// rather than re-fetching also matters for correctness, not just cost: a second
// round trip could observe a different issue than the one the caller
// authorized against.
func (s *GitHubPassThroughStore) lifecycleStagesForLabels(t *ent.Task, labels []string) []task.Stage {
	if stages := s.mapper.AllTerminalLabelStages(labels); len(stages) > 0 {
		return stages
	}
	_, stage := s.mapper.IssueToPhaseStage(taskIssueState(t), taskStateReason(t), labels)
	return []task.Stage{stage}
}

// taskIssueState reconstructs the GitHub issue state string for a task this
// store produced. issueToTask sets ClosedAt if and only if issueStateClosed
// said the issue was closed, so this agrees with that reading by construction —
// including on an unrecognised state, which issueStateClosed treats as open.
func taskIssueState(t *ent.Task) string {
	if t.ClosedAt != nil {
		return "closed"
	}
	return "open"
}

// taskStateReason recovers the GitHub state_reason issueBuildRemoteData copied
// onto the task. It is only consulted for a CLOSED issue whose labels name no
// stage at all, where it decides wont_fix vs completed. Losing it there would
// turn stripping the stage labels off a closed not_planned issue into an
// apparent wont_fix -> completed transition and charge task:close for what is
// really a no-op, so it is read rather than defaulted.
func taskStateReason(t *ent.Task) string {
	if t.RemoteData == nil {
		return ""
	}
	reason, _ := t.RemoteData["state_reason"].(string)
	return reason
}

// applyLabelDelta reports the label set an issue would carry after add and
// remove are applied to current.
//
// Matching is case-insensitive, which is deliberately stricter than the
// exact-string mergeLabels the Ent store uses for native tasks. GitHub label
// names are unique case-insensitively and this store resolves BOTH add and
// remove targets through labelNameToID, a lowercased name -> node ID index, so
// remove_labels=["FT:Stage/Wont_Fix"] really does strip "ft:stage/wont_fix"
// from the issue. Predicting that with case-sensitive equality would report
// "no change" for a write that does change the lifecycle stage, and at an
// authorization gate a missed change is a bypass rather than a rounding error.
//
// Remove wins over add for a label named in both, matching the order
// UpdateTask applies them in (adds first, then removes).
//
// It over-predicts in one direction: a label that does not exist in the
// repository is dropped by labelNamesToIDs and never actually added, but is
// modelled here as added. That fails closed — the caller is charged for a
// transition that would not have happened — which is the right side to err on.
func applyLabelDelta(current, add, remove []string) []string {
	removed := make(map[string]bool, len(remove))
	for _, l := range remove {
		removed[labelMatchKey(l)] = true
	}

	out := make([]string, 0, len(current)+len(add))
	seen := make(map[string]bool, len(current)+len(add))
	for _, l := range append(append([]string(nil), current...), add...) {
		key := labelMatchKey(l)
		if key == "" || removed[key] || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, l)
	}
	return out
}

// labelMatchKey normalises a label name for the identity comparison GitHub
// itself makes. It is NOT stripForMatch: that also strips the push prefix and
// path segments to answer "what stage does this label mean?", whereas this
// answers "are these two names the same label?".
func labelMatchKey(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func (s *GitHubPassThroughStore) ComputeAvailability(ctx context.Context, t *ent.Task) (store.TaskAvailability, error) {
	reasons := make([]store.AvailabilityReason, 0, 3)
	if t.Stage == task.StageTriage {
		reasons = append(reasons, store.AvailabilityReasonTriage)
	}
	// The ClosedAt arm is intentional and unique to the pass-through store: it
	// treats an issue that is really closed on GitHub as terminal even when its
	// stage is not. Stage here is label-derived, and IssueToPhaseStage lets a
	// stale non-terminal label (e.g. ft:stage/working left by ClaimTask) win
	// over real closed state. ClosedAt is set from GitHub's own issue state in
	// issueToTask, never from labels, so it is the reliable signal. Do not
	// reduce this to a bare IsTerminalStage call.
	//
	// Phase cannot stand in for ClosedAt here, which is why this differs from
	// the MultiStore implementation's Phase arm: Phase is label-derived too,
	// and IssueToPhaseStage returns PhaseInProgress for exactly the closed
	// issue with a stale working label that this arm exists to catch.
	//
	// The stage arm reads LifecycleStage, not t.Stage. t.Stage is the display
	// stage, and for an OPEN issue carrying a terminal label it has been
	// demoted to "accepted" — so reading it here would report an issue a
	// maintainer marked wont_fix / duplicate / cancelled as available work.
	//
	// Only the web dashboard actually inherits this field: it defers to
	// availability when the server supplies it (web/src/utils/task-ready.ts).
	// `ft ready` does not — it goes through GetReadyTasks, which filters
	// server-side before this value would ever reach a client — and the MCP
	// task_ready tool calls that same RPC and drops the field. So this arm is
	// necessary but not sufficient; making the other two consumers honour one
	// answer is #202, not this fix. Widens the arm only: LifecycleStage
	// returns t.Stage whenever no terminal label is present.
	if store.IsTerminalStage(s.LifecycleStage(ctx, t)) || t.ClosedAt != nil {
		reasons = append(reasons, store.AvailabilityReasonTerminal)
	}
	if t.HoldReason != nil || s.mapper.hasExternalUnavailableLabel(t.Labels) {
		reasons = append(reasons, store.AvailabilityReasonHeld)
	}
	return store.TaskAvailability{Available: len(reasons) == 0, Reasons: reasons}, nil
}

// ── Collections ──

func (s *GitHubPassThroughStore) CreateCollection(ctx context.Context, p store.CreateCollectionParams) (*ent.Collection, error) {
	return s.syntheticCollection(), nil
}

func (s *GitHubPassThroughStore) UpdateCollection(ctx context.Context, id uuid.UUID, p store.UpdateCollectionParams) (*ent.Collection, error) {
	return nil, fmt.Errorf("update collection: %w", store.ErrNotImplemented)
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

func (s *GitHubPassThroughStore) ListAllCommentsForTask(ctx context.Context, p store.ListAllCommentsForTaskParams) ([]*ent.Comment, error) {
	return nil, fmt.Errorf("list all comments for task: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ListAllCommentsForCollection(ctx context.Context, p store.ListAllCommentsForCollectionParams) ([]*ent.Comment, error) {
	return nil, fmt.Errorf("list all comments for collection: %w", store.ErrNotImplemented)
}

// ── Audit Trail ──

func (s *GitHubPassThroughStore) ListChanges(ctx context.Context, p store.ListChangesParams) ([]*ent.Change, int, error) {
	return nil, 0, fmt.Errorf("list changes: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ListAllChangesForTask(ctx context.Context, p store.ListAllChangesForTaskParams) ([]*ent.Change, error) {
	return nil, fmt.Errorf("list all changes for task: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ListAllChangesForCollection(ctx context.Context, p store.ListAllChangesForCollectionParams) ([]*ent.Change, error) {
	return nil, fmt.Errorf("list all changes for collection: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ListAllRelationshipsForCollection(ctx context.Context, p store.ListAllRelationshipsForCollectionParams) ([]*ent.Relationship, error) {
	return nil, fmt.Errorf("list all relationships for collection: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ImportCollection(ctx context.Context, p store.ImportCollectionParams) (*ent.Collection, error) {
	return nil, fmt.Errorf("import collection: %w", store.ErrNotImplemented)
}

// ── Graph Queries ──

func (s *GitHubPassThroughStore) GetReadyTasks(ctx context.Context, p store.GetReadyTasksParams) ([]*store.ReadyTaskResult, int, error) {
	issues, err := s.gql.listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen}, nil, 0)
	if err != nil {
		return nil, 0, err
	}

	nodes := buildIssueTree(issues, s.mapper)
	readyNodes := computeReady(s.mapper, nodes, p.IncludeUnblockedOpen)

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
	blockedNodes := computeBlocked(s.mapper, nodes)

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

func (s *GitHubPassThroughStore) GetUserByEmail(ctx context.Context, email string) ([]*ent.User, error) {
	return nil, fmt.Errorf("get user by email: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) GetUsersByIDs(ctx context.Context, ids []uuid.UUID) ([]*ent.User, error) {
	return nil, fmt.Errorf("get users by ids: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ListUsers(ctx context.Context, p store.ListUsersParams) ([]*ent.User, int, error) {
	return nil, 0, fmt.Errorf("list users: %w", store.ErrNotImplemented)
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

func (s *GitHubPassThroughStore) GetAPIToken(ctx context.Context, id uuid.UUID) (*ent.ApiToken, error) {
	return nil, fmt.Errorf("get API token: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) LookupToken(ctx context.Context, tokenHash string) (*ent.ApiToken, error) {
	return &ent.ApiToken{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		CreatedAt: time.Now(),
	}, nil
}

func (s *GitHubPassThroughStore) ListAPITokens(ctx context.Context, p store.ListAPITokensParams) ([]*ent.ApiToken, int, error) {
	return nil, 0, fmt.Errorf("list API tokens: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) UpdateAPITokenScopes(ctx context.Context, id uuid.UUID, scopes []string) (*ent.ApiToken, error) {
	return nil, fmt.Errorf("update API token scopes: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) RevokeAPIToken(ctx context.Context, id uuid.UUID) error {
	return fmt.Errorf("revoke API token: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) UpdateTokenLastUsed(ctx context.Context, id uuid.UUID) error {
	return nil
}

// ── Linked Accounts (not applicable in pass-through mode) ──

func (s *GitHubPassThroughStore) CreateLinkedAccount(ctx context.Context, p store.CreateLinkedAccountParams) (*ent.LinkedAccount, error) {
	return nil, fmt.Errorf("create linked account: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) GetLinkedAccount(ctx context.Context, id uuid.UUID) (*ent.LinkedAccount, error) {
	return nil, fmt.Errorf("get linked account: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) UpdateLinkedAccount(ctx context.Context, id uuid.UUID, p store.UpdateLinkedAccountParams) (*ent.LinkedAccount, error) {
	return nil, fmt.Errorf("update linked account: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) DeleteLinkedAccount(ctx context.Context, id uuid.UUID) error {
	return fmt.Errorf("delete linked account: %w", store.ErrNotImplemented)
}

func (s *GitHubPassThroughStore) ListLinkedAccounts(ctx context.Context, p store.ListLinkedAccountsParams) ([]*ent.LinkedAccount, int, error) {
	return nil, 0, fmt.Errorf("list linked accounts: %w", store.ErrNotImplemented)
}

// ── Close ──

func (s *GitHubPassThroughStore) Close() error {
	return nil
}

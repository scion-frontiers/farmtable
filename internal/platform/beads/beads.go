package beads

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/farmtable-io/farmtable/internal/platform"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

// Issue mirrors the Beads Issue type for platform-independent mapping.
type Issue struct {
	ID                 string
	Title              string
	Description        string
	Design             string
	AcceptanceCriteria string
	Notes              string
	Status             string
	Priority           int
	IssueType          string
	Assignee           string
	Owner              string
	CreatedAt          time.Time
	CreatedBy          string
	UpdatedAt          time.Time
	StartedAt          *time.Time
	ClosedAt           *time.Time
	DueAt              *time.Time
	DeferUntil         *time.Time
	ExternalRef        *string
	SourceSystem       string
	Metadata           json.RawMessage
	Labels             []string
	Dependencies       []Dependency
	Comments           []Comment
}

// Dependency mirrors the Beads Dependency type.
type Dependency struct {
	IssueID     string
	DependsOnID string
	Type        string
	CreatedAt   time.Time
	CreatedBy   string
	Metadata    string
	ThreadID    string
}

// Comment mirrors the Beads Comment type.
type Comment struct {
	ID        string
	IssueID   string
	Author    string
	Text      string
	CreatedAt time.Time
}

// Storage defines the subset of Beads storage operations used by the adapter.
type Storage interface {
	SearchIssues(ctx context.Context, query string, statuses []string, issueType string) ([]*Issue, error)
	GetLabels(ctx context.Context, issueID string) ([]string, error)
	GetComments(ctx context.Context, issueID string) ([]*Comment, error)
	CreateIssue(ctx context.Context, issue *Issue) error
	UpdateIssue(ctx context.Context, id string, updates map[string]interface{}) error
	AddComment(ctx context.Context, issueID, author, text string) (*Comment, error)
}

// BeadsAdapter implements platform.Adapter for Beads issue databases.
type BeadsAdapter struct {
	beads Storage
	store store.Store
}

var _ platform.Adapter = (*BeadsAdapter)(nil)

func New(beadsStore Storage, s store.Store) *BeadsAdapter {
	return &BeadsAdapter{
		beads: beadsStore,
		store: s,
	}
}

func (a *BeadsAdapter) Platform() string { return "beads" }

func (a *BeadsAdapter) SyncCollection(ctx context.Context, collectionID uuid.UUID, opts platform.SyncOptions) (platform.SyncResult, error) {
	var result platform.SyncResult

	issues, err := a.beads.SearchIssues(ctx, "", nil, "")
	if err != nil {
		return result, fmt.Errorf("listing beads issues: %w", err)
	}

	existingTasks, err := a.buildRemoteIDIndex(ctx, collectionID)
	if err != nil {
		return result, fmt.Errorf("building remote ID index: %w", err)
	}

	for _, issue := range issues {
		labels, err := a.beads.GetLabels(ctx, issue.ID)
		if err != nil {
			result.Errors++
			continue
		}
		issue.Labels = labels

		comments, err := a.beads.GetComments(ctx, issue.ID)
		if err != nil {
			result.Errors++
			continue
		}
		issue.Comments = commentsToSlice(comments)

		remoteID := issue.ID
		params := IssueToCreateParams(issue, collectionID, remoteID)

		if existingID, ok := existingTasks[remoteID]; ok {
			updateParams := IssueToUpdateParams(issue, remoteID)
			if _, err := a.store.UpdateTask(ctx, existingID, updateParams, uuid.Nil); err != nil {
				result.Errors++
				continue
			}
			result.Updated++
		} else {
			newTask, err := a.store.CreateTask(ctx, params)
			if err != nil {
				result.Errors++
				continue
			}

			for _, comment := range issue.Comments {
				authorID := deterministicUUID(comment.Author)
				_, _ = a.store.AddComment(ctx, store.AddCommentParams{
					TaskID:   newTask.ID,
					AuthorID: authorID,
					Body:     comment.Text,
				})
			}

			result.Created++
		}
	}

	return result, nil
}

func (a *BeadsAdapter) PushTask(ctx context.Context, t *ent.Task) (string, error) {
	existingID := extractRemoteID(t.RemoteData)

	if existingID != "" {
		updates := TaskToIssueUpdates(t)
		if err := a.beads.UpdateIssue(ctx, existingID, updates); err != nil {
			return "", fmt.Errorf("updating beads issue: %w", err)
		}
		return existingID, nil
	}

	issue := TaskToIssue(t)
	if err := a.beads.CreateIssue(ctx, issue); err != nil {
		return "", fmt.Errorf("creating beads issue: %w", err)
	}
	return issue.ID, nil
}

func (a *BeadsAdapter) PushComment(ctx context.Context, c *ent.Comment, t *ent.Task) (string, error) {
	issueID := extractRemoteID(t.RemoteData)
	if issueID == "" {
		return "", fmt.Errorf("task %s has no beads issue ID in remote_data", t.ID)
	}

	comment, err := a.beads.AddComment(ctx, issueID, "farmtable", c.Body)
	if err != nil {
		return "", fmt.Errorf("creating comment: %w", err)
	}
	return comment.ID, nil
}

// IssueToCreateParams maps a Beads issue to store.CreateTaskParams.
func IssueToCreateParams(issue *Issue, collectionID uuid.UUID, remoteID string) store.CreateTaskParams {
	phase, stage := statusToPhaseStage(issue.Status)
	priority := priorityToFT(issue.Priority)

	p := store.CreateTaskParams{
		Title:        issue.Title,
		Description:  issue.Description,
		CollectionID: collectionID,
		Phase:        phase,
		Stage:        stage,
		NativeLabel:  issue.Status,
		Type:         issue.IssueType,
		Priority:     &priority,
		RemoteData:   buildRemoteData(issue, remoteID),
		Labels:       issue.Labels,
	}

	if issue.AcceptanceCriteria != "" {
		p.AcceptanceCriteria = &issue.AcceptanceCriteria
	}

	if issue.DueAt != nil {
		p.DueDate = issue.DueAt
	}

	if issue.Assignee != "" {
		aid := deterministicUUID(issue.Assignee)
		p.AssigneeID = &aid
	}

	return p
}

// IssueToUpdateParams maps a Beads issue to store.UpdateTaskParams for upsert.
func IssueToUpdateParams(issue *Issue, remoteID string) store.UpdateTaskParams {
	phase, stage := statusToPhaseStage(issue.Status)
	priority := priorityToFT(issue.Priority)
	title := issue.Title
	desc := issue.Description
	nativeLabel := issue.Status
	issueType := issue.IssueType

	p := store.UpdateTaskParams{
		Title:       &title,
		Description: &desc,
		Phase:       &phase,
		Stage:       &stage,
		NativeLabel: &nativeLabel,
		Type:        &issueType,
		Priority:    &priority,
		RemoteData:  buildRemoteData(issue, remoteID),
		AddLabels:   issue.Labels,
	}

	if issue.AcceptanceCriteria != "" {
		p.AcceptanceCriteria = &issue.AcceptanceCriteria
	} else {
		p.ClearAcceptance = true
	}

	if issue.DueAt != nil {
		p.DueDate = issue.DueAt
	} else {
		p.ClearDueDate = true
	}

	if issue.Assignee != "" {
		aid := deterministicUUID(issue.Assignee)
		p.AssigneeID = &aid
	} else {
		p.ClearAssignee = true
	}

	return p
}

// TaskToIssue maps an ent.Task to a Beads Issue for push operations.
func TaskToIssue(t *ent.Task) *Issue {
	issue := &Issue{
		ID:          fmt.Sprintf("ft-%s", t.ID.String()[:8]),
		Title:       t.Title,
		Description: t.Description,
		Status:      string(phaseStageToStatus(t.Phase, t.Stage)),
		Priority:    priorityFromFTPtr(t.Priority),
		IssueType:   t.Type,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}

	if t.AcceptanceCriteria != nil {
		issue.AcceptanceCriteria = *t.AcceptanceCriteria
	}

	if t.DueDate != nil {
		issue.DueAt = t.DueDate
	}

	return issue
}

// TaskToIssueUpdates maps an ent.Task to a Beads update map.
func TaskToIssueUpdates(t *ent.Task) map[string]interface{} {
	updates := map[string]interface{}{
		"title":       t.Title,
		"description": t.Description,
		"status":      string(phaseStageToStatus(t.Phase, t.Stage)),
		"priority":    priorityFromFTPtr(t.Priority),
		"issue_type":  t.Type,
	}

	if t.AcceptanceCriteria != nil {
		updates["acceptance_criteria"] = *t.AcceptanceCriteria
	}

	return updates
}

func statusToPhaseStage(status string) (task.Phase, task.Stage) {
	switch status {
	case "closed":
		return task.PhaseClosed, task.StageCompleted
	case "in_progress":
		return task.PhaseInProgress, task.StageWorking
	case "blocked":
		return task.PhaseOpen, task.StageBlocked
	case "deferred":
		return task.PhaseOnHold, task.StageDeferred
	default:
		return task.PhaseOpen, task.StageTriage
	}
}

func phaseStageToStatus(phase task.Phase, stage task.Stage) string {
	switch {
	case phase == task.PhaseClosed:
		return "closed"
	case stage == task.StageBlocked:
		return "blocked"
	case stage == task.StageDeferred:
		return "deferred"
	case phase == task.PhaseInProgress || stage == task.StageWorking:
		return "in_progress"
	default:
		return "open"
	}
}

func priorityToFT(beadsPriority int) task.Priority {
	switch beadsPriority {
	case 0:
		return task.PriorityUrgent
	case 1:
		return task.PriorityHigh
	case 2:
		return task.PriorityNormal
	default:
		return task.PriorityLow
	}
}

func priorityFromFTPtr(p *task.Priority) int {
	if p == nil {
		return 2
	}
	return priorityFromFT(*p)
}

func priorityFromFT(p task.Priority) int {
	switch p {
	case task.PriorityUrgent:
		return 0
	case task.PriorityHigh:
		return 1
	case task.PriorityNormal:
		return 2
	default:
		return 3
	}
}

func buildRemoteData(issue *Issue, remoteID string) map[string]any {
	rd := map[string]any{
		"remote_id":  remoteID,
		"created_at": issue.CreatedAt.Format(time.RFC3339),
		"updated_at": issue.UpdatedAt.Format(time.RFC3339),
		"status":     issue.Status,
		"priority":   issue.Priority,
		"issue_type": issue.IssueType,
	}

	if issue.ExternalRef != nil {
		rd["external_ref"] = *issue.ExternalRef
	}

	if issue.SourceSystem != "" {
		rd["source_system"] = issue.SourceSystem
	}

	if issue.Owner != "" {
		rd["owner"] = issue.Owner
	}

	if issue.CreatedBy != "" {
		rd["created_by"] = issue.CreatedBy
	}

	if issue.Design != "" {
		rd["design"] = issue.Design
	}

	if issue.Notes != "" {
		rd["notes"] = issue.Notes
	}

	if len(issue.Labels) > 0 {
		rd["labels"] = issue.Labels
	}

	if len(issue.Metadata) > 0 {
		rd["metadata"] = json.RawMessage(issue.Metadata)
	}

	if issue.DueAt != nil {
		rd["due_at"] = issue.DueAt.Format(time.RFC3339)
	}

	if issue.DeferUntil != nil {
		rd["defer_until"] = issue.DeferUntil.Format(time.RFC3339)
	}

	if issue.StartedAt != nil {
		rd["started_at"] = issue.StartedAt.Format(time.RFC3339)
	}

	if issue.ClosedAt != nil {
		rd["closed_at"] = issue.ClosedAt.Format(time.RFC3339)
	}

	if len(issue.Dependencies) > 0 {
		var deps []map[string]any
		for _, dep := range issue.Dependencies {
			deps = append(deps, map[string]any{
				"issue_id":      dep.IssueID,
				"depends_on_id": dep.DependsOnID,
				"type":          dep.Type,
				"created_at":    dep.CreatedAt.Format(time.RFC3339),
				"created_by":    dep.CreatedBy,
				"metadata":      dep.Metadata,
				"thread_id":     dep.ThreadID,
			})
		}
		rd["dependencies"] = deps
	}

	return rd
}

func extractRemoteID(remoteData map[string]any) string {
	if remoteData == nil {
		return ""
	}
	if rid, ok := remoteData["remote_id"].(string); ok {
		return rid
	}
	return ""
}

func deterministicUUID(input string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("beads:user:"+input))
}

func commentsToSlice(comments []*Comment) []Comment {
	out := make([]Comment, len(comments))
	for i, c := range comments {
		out[i] = *c
	}
	return out
}

func (a *BeadsAdapter) buildRemoteIDIndex(ctx context.Context, collectionID uuid.UUID) (map[string]uuid.UUID, error) {
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

// BeadsDependencyToRelationshipType maps Beads dependency types to Farm Table relationship types.
func BeadsDependencyToRelationshipType(depType string) string {
	switch depType {
	case "blocks":
		return "blocks"
	case "related", "discovered-from":
		return "relates_to"
	case "parent-child":
		return "blocks"
	default:
		return "relates_to"
	}
}

package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/change"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/comment"
	"github.com/farmtable-io/farmtable/internal/store/ent/predicate"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

// StoreOptions configures NewEntStore.
type StoreOptions struct {
	Dialect string // "postgres" or "sqlite3"
	DSN     string
	Migrate bool // run schema migration on startup (default: true when zero value)
}

type EntStore struct {
	client  *ent.Client
	dialect string
}

func NewEntStore(ctx context.Context, opts StoreOptions) (*EntStore, error) {
	if opts.Dialect == "" {
		opts.Dialect = dialect.Postgres
	}

	var client *ent.Client
	var err error

	if opts.Dialect == dialect.SQLite {
		client, err = openSQLite(opts.DSN)
	} else {
		client, err = ent.Open(opts.Dialect, opts.DSN)
	}
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}

	if opts.Migrate {
		if err := client.Schema.Create(ctx); err != nil {
			client.Close()
			return nil, fmt.Errorf("creating schema: %w", err)
		}
	}

	return &EntStore{client: client, dialect: opts.Dialect}, nil
}

func openSQLite(dsn string) (*ent.Client, error) {
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	// SQLite performs best with a single connection in WAL mode.
	db.SetMaxOpenConns(1)

	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return nil, fmt.Errorf("enabling WAL mode: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		db.Close()
		return nil, fmt.Errorf("enabling foreign keys: %w", err)
	}

	drv := entsql.OpenDB(dialect.SQLite, db)
	return ent.NewClient(ent.Driver(drv)), nil
}


func (s *EntStore) Client() *ent.Client {
	return s.client
}

func (s *EntStore) Close() error {
	return s.client.Close()
}

func (s *EntStore) CreateTask(ctx context.Context, p CreateTaskParams) (*ent.Task, error) {
	tx, err := s.client.Tx(ctx)
	if err != nil {
		return nil, fmt.Errorf("starting transaction: %w", err)
	}
	defer tx.Rollback()

	create := tx.Task.Create().
		SetTitle(p.Title).
		SetDescription(p.Description).
		SetCollectionID(p.CollectionID).
		SetPhase(p.Phase).
		SetStage(p.Stage).
		SetNativeLabel(p.NativeLabel).
		SetType(p.Type).
		SetVersion("1")

	if p.Priority != nil {
		create.SetPriority(*p.Priority)
	}
	if p.AssigneeID != nil {
		create.SetAssigneeID(*p.AssigneeID)
	}
	if p.ParentTaskID != nil {
		create.SetParentTaskID(*p.ParentTaskID)
	}
	if p.AcceptanceCriteria != nil {
		create.SetAcceptanceCriteria(*p.AcceptanceCriteria)
	}
	if p.RemoteData != nil {
		create.SetRemoteData(p.RemoteData)
	}
	if len(p.Labels) > 0 {
		create.SetLabels(p.Labels)
	}
	if p.StartDate != nil {
		create.SetStartDate(*p.StartDate)
	}
	if p.DueDate != nil {
		create.SetDueDate(*p.DueDate)
	}
	if p.Repo != "" {
		create.SetRepo(p.Repo)
	}
	if p.Branch != "" {
		create.SetBranch(p.Branch)
	}

	t, err := create.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("creating task: %w", err)
	}

	for _, targetID := range p.BlocksTaskIDs {
		_, err := tx.Relationship.Create().
			SetSourceTaskID(t.ID).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlocks).
			Save(ctx)
		if err != nil {
			if ent.IsConstraintError(err) {
				continue
			}
			return nil, fmt.Errorf("creating blocks relationship: %w", err)
		}
	}
	for _, targetID := range p.BlockedByTaskIDs {
		_, err := tx.Relationship.Create().
			SetSourceTaskID(t.ID).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlockedBy).
			Save(ctx)
		if err != nil {
			if ent.IsConstraintError(err) {
				continue
			}
			return nil, fmt.Errorf("creating blocked_by relationship: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing task creation: %w", err)
	}

	return s.getTaskWithEdges(ctx, t.ID)
}

func (s *EntStore) GetTask(ctx context.Context, id uuid.UUID) (*ent.Task, error) {
	return s.getTaskWithEdges(ctx, id)
}

func (s *EntStore) getTaskWithEdges(ctx context.Context, id uuid.UUID) (*ent.Task, error) {
	t, err := s.client.Task.Query().
		Where(task.IDEQ(id)).
		WithSourceRelationships().
		WithTargetRelationships().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting task: %w", err)
	}
	return t, nil
}

func (s *EntStore) ListTasks(ctx context.Context, p ListTasksParams) ([]*ent.Task, int, error) {
	q := s.client.Task.Query()

	var preds []predicate.Task
	if p.CollectionID != nil {
		preds = append(preds, task.CollectionIDEQ(*p.CollectionID))
	}
	if p.Phase != nil {
		preds = append(preds, task.PhaseEQ(*p.Phase))
	}
	if p.Stage != nil {
		preds = append(preds, task.StageEQ(*p.Stage))
	}
	if p.AssigneeID != nil {
		preds = append(preds, task.AssigneeIDEQ(*p.AssigneeID))
	}
	if p.Unassigned {
		preds = append(preds, task.AssigneeIDIsNil())
	}
	if p.Priority != nil {
		preds = append(preds, task.PriorityEQ(*p.Priority))
	}
	if p.Type != nil {
		preds = append(preds, task.TypeEQ(*p.Type))
	}
	if p.ParentTaskID != nil {
		preds = append(preds, task.ParentTaskIDEQ(*p.ParentTaskID))
	}

	if len(preds) > 0 {
		q = q.Where(preds...)
	}

	switch p.SortField {
	case "created":
		if p.SortOrder == "desc" {
			q = q.Order(task.ByCreatedAt(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByCreatedAt())
		}
	case "updated":
		if p.SortOrder == "desc" {
			q = q.Order(task.ByUpdatedAt(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByUpdatedAt())
		}
	case "priority":
		if p.SortOrder == "desc" {
			q = q.Order(task.ByPriority(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByPriority())
		}
	case "due_date":
		if p.SortOrder == "desc" {
			q = q.Order(task.ByDueDate(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByDueDate())
		}
	default:
		q = q.Order(task.ByCreatedAt())
	}

	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting tasks: %w", err)
	}

	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	if p.Offset > 0 {
		q = q.Offset(p.Offset)
	}

	q = q.WithSourceRelationships().WithTargetRelationships()

	tasks, err := q.All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("listing tasks: %w", err)
	}

	if len(p.Labels) > 0 {
		var filtered []*ent.Task
		for _, t := range tasks {
			if hasAllLabels(t.Labels, p.Labels) {
				filtered = append(filtered, t)
			}
		}
		tasks = filtered
	}

	return tasks, total, nil
}

func hasAllLabels(taskLabels, required []string) bool {
	set := make(map[string]struct{}, len(taskLabels))
	for _, l := range taskLabels {
		set[l] = struct{}{}
	}
	for _, r := range required {
		if _, ok := set[r]; !ok {
			return false
		}
	}
	return true
}

func (s *EntStore) UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams) (*ent.Task, error) {
	for attempt := 0; ; attempt++ {
		result, err := s.doUpdateTask(ctx, id, p)
		if err == ErrConflict && p.Version == "" && attempt == 0 {
			continue
		}
		return result, err
	}
}

func (s *EntStore) doUpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams) (*ent.Task, error) {
	tx, err := s.client.Tx(ctx)
	if err != nil {
		return nil, fmt.Errorf("starting transaction: %w", err)
	}
	defer tx.Rollback()

	old, err := tx.Task.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting task for update: %w", err)
	}

	update := tx.Task.Update().Where(task.IDEQ(id))

	if p.Version != "" {
		update = update.Where(task.VersionEQ(p.Version))
		v, _ := strconv.Atoi(p.Version)
		update = update.SetVersion(strconv.Itoa(v + 1))
	} else {
		update = update.Where(task.VersionEQ(old.Version))
		v, _ := strconv.Atoi(old.Version)
		update = update.SetVersion(strconv.Itoa(v + 1))
	}

	if p.Title != nil {
		update.SetTitle(*p.Title)
	}
	if p.Description != nil {
		update.SetDescription(*p.Description)
	}
	if p.Phase != nil {
		update.SetPhase(*p.Phase)
	}
	if p.Stage != nil {
		update.SetStage(*p.Stage)
	}
	if p.NativeLabel != nil {
		update.SetNativeLabel(*p.NativeLabel)
	}
	if p.Type != nil {
		update.SetType(*p.Type)
	}
	if p.ClearPriority {
		update.ClearPriority()
	} else if p.Priority != nil {
		update.SetPriority(*p.Priority)
	}
	if p.ClearAssignee {
		update.ClearAssigneeID()
	} else if p.AssigneeID != nil {
		update.SetAssigneeID(*p.AssigneeID)
	}
	if p.ClearParent {
		update.ClearParentTaskID()
	} else if p.ParentTaskID != nil {
		update.SetParentTaskID(*p.ParentTaskID)
	}
	if p.ClearAcceptance {
		update.ClearAcceptanceCriteria()
	} else if p.AcceptanceCriteria != nil {
		update.SetAcceptanceCriteria(*p.AcceptanceCriteria)
	}
	if p.RemoteData != nil {
		update.SetRemoteData(p.RemoteData)
	}

	if p.ClearStartDate {
		update.ClearStartDate()
	} else if p.StartDate != nil {
		update.SetStartDate(*p.StartDate)
	}
	if p.ClearDueDate {
		update.ClearDueDate()
	} else if p.DueDate != nil {
		update.SetDueDate(*p.DueDate)
	}

	if len(p.AddLabels) > 0 || len(p.RemoveLabels) > 0 {
		labels := mergeLabels(old.Labels, p.AddLabels, p.RemoveLabels)
		update.SetLabels(labels)
	}

	if p.ClearRepo {
		update.ClearRepo()
	} else if p.Repo != nil {
		update.SetRepo(*p.Repo)
	}
	if p.ClearBranch {
		update.ClearBranch()
	} else if p.Branch != nil {
		update.SetBranch(*p.Branch)
	}
	if p.ClearCIStatus {
		update.ClearCiStatus()
	} else if p.CIStatus != nil {
		update.SetCiStatus(task.CiStatus(*p.CIStatus))
	}

	if len(p.AddPullRequests) > 0 {
		prs := old.PullRequests
		for _, pr := range p.AddPullRequests {
			prs = append(prs, map[string]string{
				"id":     pr.ID,
				"url":    pr.URL,
				"status": pr.Status,
			})
		}
		update.SetPullRequests(prs)
	}

	n, err := update.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("updating task: %w", err)
	}
	if n == 0 {
		exists, _ := tx.Task.Query().Where(task.IDEQ(id)).Exist(ctx)
		if !exists {
			return nil, ErrNotFound
		}
		return nil, ErrConflict
	}

	for _, targetID := range p.AddBlocks {
		_, err := tx.Relationship.Create().
			SetSourceTaskID(id).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlocks).
			Save(ctx)
		if err != nil {
			if ent.IsConstraintError(err) {
				continue
			}
			return nil, fmt.Errorf("creating blocks relationship: %w", err)
		}
	}
	for _, targetID := range p.AddBlockedBy {
		_, err := tx.Relationship.Create().
			SetSourceTaskID(id).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlockedBy).
			Save(ctx)
		if err != nil {
			if ent.IsConstraintError(err) {
				continue
			}
			return nil, fmt.Errorf("creating blocked_by relationship: %w", err)
		}
	}
	for _, targetID := range p.RemoveRelationships {
		_, err := tx.Relationship.Delete().
			Where(
				relationship.SourceTaskIDEQ(id),
				relationship.TargetTaskIDEQ(targetID),
			).
			Exec(ctx)
		if err != nil {
			return nil, fmt.Errorf("removing relationship: %w", err)
		}
	}

	updated, err := tx.Task.Get(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("reading updated task: %w", err)
	}

	changes := diffTask(old, updated)
	for _, c := range changes {
		_, err := tx.Change.Create().
			SetTaskID(id).
			SetAuthorID(uuid.Nil).
			SetFieldName(c.Field).
			SetOldValue(c.OldValue).
			SetNewValue(c.NewValue).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("recording change for %s: %w", c.Field, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing task update: %w", err)
	}

	return s.getTaskWithEdges(ctx, id)
}

func mergeLabels(current, add, remove []string) []string {
	set := make(map[string]struct{}, len(current))
	for _, l := range current {
		set[l] = struct{}{}
	}
	for _, l := range add {
		set[l] = struct{}{}
	}
	for _, l := range remove {
		delete(set, l)
	}
	result := make([]string, 0, len(set))
	for l := range set {
		result = append(result, l)
	}
	sort.Strings(result)
	return result
}

func (s *EntStore) ClaimTask(ctx context.Context, id uuid.UUID, assigneeID uuid.UUID, version string) (*ent.Task, error) {
	for attempt := 0; ; attempt++ {
		old, err := s.client.Task.Get(ctx, id)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, ErrNotFound
			}
			return nil, fmt.Errorf("getting task for claim: %w", err)
		}

		if old.Phase == task.PhaseClosed {
			return nil, ErrAlreadyClosed
		}
		if old.AssigneeID != nil {
			return nil, ErrAlreadyClaimed
		}

		v, _ := strconv.Atoi(old.Version)
		q := s.client.Task.Update().
			Where(task.IDEQ(id), task.AssigneeIDIsNil(), task.PhaseNEQ(task.PhaseClosed)).
			SetVersion(strconv.Itoa(v + 1))

		if version != "" {
			q = q.Where(task.VersionEQ(version))
		} else {
			q = q.Where(task.VersionEQ(old.Version))
		}

		n, err := q.
			SetAssigneeID(assigneeID).
			SetPhase(task.PhaseInProgress).
			SetStage(task.StageWorking).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("claiming task: %w", err)
		}
		if n == 0 {
			if version == "" && attempt == 0 {
				continue
			}
			return nil, ErrConflict
		}

		result, err := s.getTaskWithEdges(ctx, id)
		if err != nil {
			return nil, err
		}

		if err := s.recordChanges(ctx, id, assigneeID, old, result); err != nil {
			log.Printf("recording changes for task %s: %v", id, err)
		}

		return result, nil
	}
}

func (s *EntStore) CloseTask(ctx context.Context, id uuid.UUID, stage task.Stage, version string) (*ent.Task, error) {
	switch stage {
	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
	default:
		return nil, fmt.Errorf("%w: invalid close stage %q", ErrInvalidArgument, stage)
	}

	for attempt := 0; ; attempt++ {
		old, err := s.client.Task.Get(ctx, id)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, ErrNotFound
			}
			return nil, fmt.Errorf("getting task for close: %w", err)
		}

		if old.Phase == task.PhaseClosed {
			return nil, ErrAlreadyClosed
		}

		cv, _ := strconv.Atoi(old.Version)

		q := s.client.Task.Update().
			Where(task.IDEQ(id)).
			SetVersion(strconv.Itoa(cv + 1))

		if version != "" {
			q = q.Where(task.VersionEQ(version))
		} else {
			q = q.Where(task.VersionEQ(old.Version))
		}

		now := time.Now().UTC()
		n, err := q.
			SetPhase(task.PhaseClosed).
			SetStage(stage).
			SetClosedAt(now).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("closing task: %w", err)
		}
		if n == 0 {
			if version == "" && attempt == 0 {
				continue
			}
			exists, _ := s.client.Task.Query().Where(task.IDEQ(id)).Exist(ctx)
			if !exists {
				return nil, ErrNotFound
			}
			return nil, ErrConflict
		}

		result, err := s.getTaskWithEdges(ctx, id)
		if err != nil {
			return nil, err
		}

		if err := s.recordChanges(ctx, id, uuid.Nil, old, result); err != nil {
			log.Printf("recording changes for task %s: %v", id, err)
		}

		return result, nil
	}
}

func (s *EntStore) CreateCollection(ctx context.Context, p CreateCollectionParams) (*ent.Collection, error) {
	create := s.client.Collection.Create().
		SetName(p.Name).
		SetDescription(p.Description)

	if p.Platform != "" {
		create.SetPlatform(collectionPlatform(p.Platform))
	}

	c, err := create.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("creating collection: %w", err)
	}
	return c, nil
}

func (s *EntStore) GetCollection(ctx context.Context, id uuid.UUID) (*ent.Collection, error) {
	c, err := s.client.Collection.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting collection: %w", err)
	}
	return c, nil
}

func (s *EntStore) ListCollections(ctx context.Context, p ListCollectionsParams) ([]*ent.Collection, int, error) {
	q := s.client.Collection.Query()
	if p.Platform != nil {
		q = q.Where(collection.PlatformEQ(*p.Platform))
	}
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting collections: %w", err)
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	if p.Offset > 0 {
		q = q.Offset(p.Offset)
	}
	cols, err := q.All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("listing collections: %w", err)
	}
	return cols, total, nil
}

func (s *EntStore) AddComment(ctx context.Context, p AddCommentParams) (*ent.Comment, error) {
	c, err := s.client.Comment.Create().
		SetTaskID(p.TaskID).
		SetAuthorID(p.AuthorID).
		SetBody(p.Body).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("adding comment: %w", err)
	}
	return c, nil
}

func (s *EntStore) GetComment(ctx context.Context, id uuid.UUID) (*ent.Comment, error) {
	c, err := s.client.Comment.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting comment: %w", err)
	}
	return c, nil
}

func (s *EntStore) ListComments(ctx context.Context, p ListCommentsParams) ([]*ent.Comment, int, error) {
	q := s.client.Comment.Query().Where(comment.TaskIDEQ(p.TaskID))
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting comments: %w", err)
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	if p.Offset > 0 {
		q = q.Offset(p.Offset)
	}
	comments, err := q.Order(comment.ByCreatedAt()).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("listing comments: %w", err)
	}
	return comments, total, nil
}

type fieldChange struct {
	Field    string
	OldValue string
	NewValue string
}

func diffTask(old, new *ent.Task) []fieldChange {
	var changes []fieldChange
	if old.Title != new.Title {
		changes = append(changes, fieldChange{"title", old.Title, new.Title})
	}
	if old.Description != new.Description {
		changes = append(changes, fieldChange{"description", old.Description, new.Description})
	}
	if old.Phase != new.Phase {
		changes = append(changes, fieldChange{"phase", string(old.Phase), string(new.Phase)})
	}
	if old.Stage != new.Stage {
		changes = append(changes, fieldChange{"stage", string(old.Stage), string(new.Stage)})
	}
	if old.NativeLabel != new.NativeLabel {
		changes = append(changes, fieldChange{"native_label", old.NativeLabel, new.NativeLabel})
	}
	if old.Type != new.Type {
		changes = append(changes, fieldChange{"type", old.Type, new.Type})
	}

	oldPri, newPri := "", ""
	if old.Priority != nil {
		oldPri = string(*old.Priority)
	}
	if new.Priority != nil {
		newPri = string(*new.Priority)
	}
	if oldPri != newPri {
		changes = append(changes, fieldChange{"priority", oldPri, newPri})
	}

	oldAssignee, newAssignee := "", ""
	if old.AssigneeID != nil {
		oldAssignee = old.AssigneeID.String()
	}
	if new.AssigneeID != nil {
		newAssignee = new.AssigneeID.String()
	}
	if oldAssignee != newAssignee {
		changes = append(changes, fieldChange{"assignee_id", oldAssignee, newAssignee})
	}

	oldParent, newParent := "", ""
	if old.ParentTaskID != nil {
		oldParent = old.ParentTaskID.String()
	}
	if new.ParentTaskID != nil {
		newParent = new.ParentTaskID.String()
	}
	if oldParent != newParent {
		changes = append(changes, fieldChange{"parent_task_id", oldParent, newParent})
	}

	oldStart, newStart := "", ""
	if old.StartDate != nil {
		oldStart = old.StartDate.UTC().Format(time.RFC3339)
	}
	if new.StartDate != nil {
		newStart = new.StartDate.UTC().Format(time.RFC3339)
	}
	if oldStart != newStart {
		changes = append(changes, fieldChange{"start_date", oldStart, newStart})
	}

	oldDue, newDue := "", ""
	if old.DueDate != nil {
		oldDue = old.DueDate.UTC().Format(time.RFC3339)
	}
	if new.DueDate != nil {
		newDue = new.DueDate.UTC().Format(time.RFC3339)
	}
	if oldDue != newDue {
		changes = append(changes, fieldChange{"due_date", oldDue, newDue})
	}

	oldClosed, newClosed := "", ""
	if old.ClosedAt != nil {
		oldClosed = old.ClosedAt.UTC().Format(time.RFC3339)
	}
	if new.ClosedAt != nil {
		newClosed = new.ClosedAt.UTC().Format(time.RFC3339)
	}
	if oldClosed != newClosed {
		changes = append(changes, fieldChange{"closed_at", oldClosed, newClosed})
	}

	oldAC, newAC := "", ""
	if old.AcceptanceCriteria != nil {
		oldAC = *old.AcceptanceCriteria
	}
	if new.AcceptanceCriteria != nil {
		newAC = *new.AcceptanceCriteria
	}
	if oldAC != newAC {
		changes = append(changes, fieldChange{"acceptance_criteria", oldAC, newAC})
	}

	oldLabels := canonicalJSON(old.Labels)
	newLabels := canonicalJSON(new.Labels)
	if oldLabels != newLabels {
		changes = append(changes, fieldChange{"labels", oldLabels, newLabels})
	}

	oldPRs := canonicalJSON(old.PullRequests)
	newPRs := canonicalJSON(new.PullRequests)
	if oldPRs != newPRs {
		changes = append(changes, fieldChange{"pull_requests", oldPRs, newPRs})
	}

	if old.Repo != new.Repo {
		changes = append(changes, fieldChange{"repo", old.Repo, new.Repo})
	}
	if old.Branch != new.Branch {
		changes = append(changes, fieldChange{"branch", old.Branch, new.Branch})
	}

	oldCI, newCI := "", ""
	if old.CiStatus != nil {
		oldCI = string(*old.CiStatus)
	}
	if new.CiStatus != nil {
		newCI = string(*new.CiStatus)
	}
	if oldCI != newCI {
		changes = append(changes, fieldChange{"ci_status", oldCI, newCI})
	}

	return changes
}

func canonicalJSON(v any) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case []string:
		if len(val) == 0 {
			return ""
		}
		sorted := make([]string, len(val))
		copy(sorted, val)
		sort.Strings(sorted)
		b, _ := json.Marshal(sorted)
		return string(b)
	case []map[string]string:
		if len(val) == 0 {
			return ""
		}
		strs := make([]string, len(val))
		for i, m := range val {
			b, _ := json.Marshal(m)
			strs[i] = string(b)
		}
		sort.Strings(strs)
		return "[" + strings.Join(strs, ",") + "]"
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

func (s *EntStore) recordChanges(ctx context.Context, taskID, authorID uuid.UUID, old, new *ent.Task) error {
	changes := diffTask(old, new)
	for _, c := range changes {
		_, err := s.client.Change.Create().
			SetTaskID(taskID).
			SetAuthorID(authorID).
			SetFieldName(c.Field).
			SetOldValue(c.OldValue).
			SetNewValue(c.NewValue).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("recording change for %s: %w", c.Field, err)
		}
	}
	return nil
}

func (s *EntStore) ListChanges(ctx context.Context, p ListChangesParams) ([]*ent.Change, int, error) {
	q := s.client.Change.Query().Where(change.TaskIDEQ(p.TaskID))
	if p.Field != "" {
		q = q.Where(change.FieldNameEQ(p.Field))
	}
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting changes: %w", err)
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	if p.Offset > 0 {
		q = q.Offset(p.Offset)
	}
	changes, err := q.Order(change.ByCreatedAt()).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("listing changes: %w", err)
	}
	return changes, total, nil
}

// ── Graph Query Methods ──

func (s *EntStore) GetReadyTasks(ctx context.Context, p GetReadyTasksParams) ([]*ReadyTaskResult, int, error) {
	var stagePreds []predicate.Task
	stagePreds = append(stagePreds, task.StageEQ(task.StageReady))
	if p.IncludeUnblockedOpen {
		stagePreds = append(stagePreds, task.StageEQ(task.StageTriage))
		stagePreds = append(stagePreds, task.StageEQ(task.StageBacklog))
	}

	q := s.client.Task.Query().
		Where(
			task.PhaseEQ(task.PhaseOpen),
			task.Or(stagePreds...),
		)

	if p.CollectionID != nil {
		q = q.Where(task.CollectionIDEQ(*p.CollectionID))
	}
	if p.AssigneeID != nil {
		q = q.Where(task.AssigneeIDEQ(*p.AssigneeID))
	}
	if p.Unassigned {
		q = q.Where(task.AssigneeIDIsNil())
	}
	if p.MinPriority != nil {
		priorities := prioritiesAtOrAbove(*p.MinPriority)
		if len(priorities) > 0 {
			q = q.Where(task.PriorityIn(priorities...))
		}
	}

	q = q.WithSourceRelationships().WithTargetRelationships()

	tasks, err := q.All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("querying ready tasks: %w", err)
	}

	var results []*ReadyTaskResult
	for _, t := range tasks {
		blockersResolved := 0
		hasOpenBlocker := false

		for _, rel := range t.Edges.SourceRelationships {
			if rel.Type == relationship.TypeBlockedBy {
				blocker, bErr := s.client.Task.Get(ctx, rel.TargetTaskID)
				if bErr != nil {
					continue
				}
				if blocker.Phase == task.PhaseClosed {
					blockersResolved++
				} else {
					hasOpenBlocker = true
					break
				}
			}
		}
		if hasOpenBlocker {
			continue
		}

		for _, rel := range t.Edges.TargetRelationships {
			if rel.Type == relationship.TypeBlocks {
				blocker, bErr := s.client.Task.Get(ctx, rel.SourceTaskID)
				if bErr != nil {
					continue
				}
				if blocker.Phase == task.PhaseClosed {
					blockersResolved++
				} else {
					hasOpenBlocker = true
					break
				}
			}
		}
		if hasOpenBlocker {
			continue
		}

		results = append(results, &ReadyTaskResult{
			Task:             t,
			BlockersResolved: blockersResolved,
		})
	}

	total := len(results)

	if p.Offset > 0 && p.Offset < len(results) {
		results = results[p.Offset:]
	} else if p.Offset >= len(results) {
		results = nil
	}
	if p.Limit > 0 && p.Limit < len(results) {
		results = results[:p.Limit]
	}

	return results, total, nil
}

func (s *EntStore) GetBlockedTasks(ctx context.Context, p GetBlockedTasksParams) ([]*BlockedTaskResult, int, error) {
	q := s.client.Task.Query().
		Where(task.PhaseNEQ(task.PhaseClosed))

	if p.CollectionID != nil {
		q = q.Where(task.CollectionIDEQ(*p.CollectionID))
	}
	if p.AssigneeID != nil {
		q = q.Where(task.AssigneeIDEQ(*p.AssigneeID))
	}
	if p.Unassigned {
		q = q.Where(task.AssigneeIDIsNil())
	}

	q = q.WithSourceRelationships().WithTargetRelationships()

	tasks, err := q.All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("querying blocked tasks: %w", err)
	}

	var results []*BlockedTaskResult
	for _, t := range tasks {
		var blockers []BlockerInfoResult

		for _, rel := range t.Edges.SourceRelationships {
			if rel.Type == relationship.TypeBlockedBy {
				blocker, bErr := s.client.Task.Get(ctx, rel.TargetTaskID)
				if bErr != nil {
					continue
				}
				if blocker.Phase != task.PhaseClosed {
					blockers = append(blockers, BlockerInfoResult{
						TaskID: blocker.ID,
						Name:   blocker.Title,
						Phase:  blocker.Phase,
						Stage:  blocker.Stage,
					})
				}
			}
		}

		for _, rel := range t.Edges.TargetRelationships {
			if rel.Type == relationship.TypeBlocks {
				blocker, bErr := s.client.Task.Get(ctx, rel.SourceTaskID)
				if bErr != nil {
					continue
				}
				if blocker.Phase != task.PhaseClosed {
					blockers = append(blockers, BlockerInfoResult{
						TaskID: blocker.ID,
						Name:   blocker.Title,
						Phase:  blocker.Phase,
						Stage:  blocker.Stage,
					})
				}
			}
		}

		if len(blockers) > 0 {
			results = append(results, &BlockedTaskResult{
				Task:     t,
				Blockers: blockers,
			})
		}
	}

	total := len(results)

	if p.Offset > 0 && p.Offset < len(results) {
		results = results[p.Offset:]
	} else if p.Offset >= len(results) {
		results = nil
	}
	if p.Limit > 0 && p.Limit < len(results) {
		results = results[:p.Limit]
	}

	return results, total, nil
}

func prioritiesAtOrAbove(min task.Priority) []task.Priority {
	order := []task.Priority{
		task.PriorityUrgent,
		task.PriorityHigh,
		task.PriorityNormal,
		task.PriorityLow,
	}
	var result []task.Priority
	for _, p := range order {
		result = append(result, p)
		if p == min {
			break
		}
	}
	return result
}

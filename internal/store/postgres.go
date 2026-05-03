package store

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"entgo.io/ent/dialect"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/change"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/comment"
	"github.com/farmtable-io/farmtable/internal/store/ent/hook"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type PostgresStore struct {
	client *ent.Client
}

func NewPostgresStore(ctx context.Context) (*PostgresStore, error) {
	dsn := os.Getenv("FARMTABLE_DB_URL")
	if dsn == "" {
		return nil, fmt.Errorf("FARMTABLE_DB_URL environment variable is required")
	}
	return NewPostgresStoreFromDSN(ctx, dsn)
}

func NewPostgresStoreFromDSN(ctx context.Context, dsn string) (*PostgresStore, error) {
	client, err := ent.Open(dialect.Postgres, dsn)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}
	client.Task.Use(versionHook())
	if err := client.Schema.Create(ctx); err != nil {
		client.Close()
		return nil, fmt.Errorf("creating schema: %w", err)
	}
	return &PostgresStore{client: client}, nil
}

func versionHook() ent.Hook {
	return func(next ent.Mutator) ent.Mutator {
		return hook.TaskFunc(func(ctx context.Context, m *ent.TaskMutation) (ent.Value, error) {
			if m.Op() == ent.OpUpdate || m.Op() == ent.OpUpdateOne {
				oldVersion, err := m.OldVersion(ctx)
				if err == nil {
					v, _ := strconv.Atoi(oldVersion)
					m.SetVersion(strconv.Itoa(v + 1))
				}
			}
			return next.Mutate(ctx, m)
		})
	}
}

func (s *PostgresStore) Client() *ent.Client {
	return s.client
}

func (s *PostgresStore) Close() error {
	return s.client.Close()
}

func (s *PostgresStore) CreateTask(ctx context.Context, p CreateTaskParams) (*ent.Task, error) {
	create := s.client.Task.Create().
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

	t, err := create.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("creating task: %w", err)
	}
	return t, nil
}

func (s *PostgresStore) GetTask(ctx context.Context, id uuid.UUID) (*ent.Task, error) {
	t, err := s.client.Task.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting task: %w", err)
	}
	return t, nil
}

func (s *PostgresStore) ListTasks(ctx context.Context, p ListTasksParams) ([]*ent.Task, int, error) {
	q := s.client.Task.Query()

	if p.CollectionID != nil {
		q = q.Where(task.CollectionIDEQ(*p.CollectionID))
	}
	if p.Phase != nil {
		q = q.Where(task.PhaseEQ(*p.Phase))
	}
	if p.Stage != nil {
		q = q.Where(task.StageEQ(*p.Stage))
	}
	if p.AssigneeID != nil {
		q = q.Where(task.AssigneeIDEQ(*p.AssigneeID))
	}
	if p.Unassigned {
		q = q.Where(task.AssigneeIDIsNil())
	}

	total, err := q.Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting tasks: %w", err)
	}

	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	if p.Offset > 0 {
		q = q.Offset(p.Offset)
	}

	tasks, err := q.All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("listing tasks: %w", err)
	}
	return tasks, total, nil
}

func (s *PostgresStore) UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams) (*ent.Task, error) {
	if p.Version == "" {
		return nil, fmt.Errorf("%w: version is required for update", ErrInvalidArgument)
	}

	update := s.client.Task.Update().
		Where(task.IDEQ(id), task.VersionEQ(p.Version))

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

	n, err := update.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("updating task: %w", err)
	}
	if n == 0 {
		exists, _ := s.client.Task.Query().Where(task.IDEQ(id)).Exist(ctx)
		if !exists {
			return nil, ErrNotFound
		}
		return nil, ErrConflict
	}

	return s.client.Task.Get(ctx, id)
}

func (s *PostgresStore) ClaimTask(ctx context.Context, id uuid.UUID, assigneeID uuid.UUID, version string) (*ent.Task, error) {
	t, err := s.client.Task.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting task for claim: %w", err)
	}

	if t.Phase == task.PhaseClosed {
		return nil, ErrAlreadyClosed
	}
	if t.AssigneeID != nil {
		return nil, ErrAlreadyClaimed
	}

	q := s.client.Task.Update().
		Where(task.IDEQ(id), task.AssigneeIDIsNil())

	if version != "" {
		q = q.Where(task.VersionEQ(version))
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
		return nil, ErrConflict
	}

	return s.client.Task.Get(ctx, id)
}

func (s *PostgresStore) CloseTask(ctx context.Context, id uuid.UUID, stage task.Stage, version string) (*ent.Task, error) {
	switch stage {
	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
	default:
		return nil, fmt.Errorf("%w: invalid close stage %q", ErrInvalidArgument, stage)
	}

	q := s.client.Task.Update().
		Where(task.IDEQ(id))

	if version != "" {
		q = q.Where(task.VersionEQ(version))
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
		exists, _ := s.client.Task.Query().Where(task.IDEQ(id)).Exist(ctx)
		if !exists {
			return nil, ErrNotFound
		}
		return nil, ErrConflict
	}

	return s.client.Task.Get(ctx, id)
}

func (s *PostgresStore) CreateCollection(ctx context.Context, p CreateCollectionParams) (*ent.Collection, error) {
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

func (s *PostgresStore) GetCollection(ctx context.Context, id uuid.UUID) (*ent.Collection, error) {
	c, err := s.client.Collection.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting collection: %w", err)
	}
	return c, nil
}

func (s *PostgresStore) ListCollections(ctx context.Context, p ListCollectionsParams) ([]*ent.Collection, int, error) {
	q := s.client.Collection.Query()
	if p.Platform != nil {
		q = q.Where(collection.PlatformEQ(*p.Platform))
	}
	total, err := q.Count(ctx)
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

func (s *PostgresStore) AddComment(ctx context.Context, p AddCommentParams) (*ent.Comment, error) {
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

func (s *PostgresStore) GetComment(ctx context.Context, id uuid.UUID) (*ent.Comment, error) {
	c, err := s.client.Comment.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting comment: %w", err)
	}
	return c, nil
}

func (s *PostgresStore) ListComments(ctx context.Context, p ListCommentsParams) ([]*ent.Comment, int, error) {
	q := s.client.Comment.Query().Where(comment.TaskIDEQ(p.TaskID))
	total, err := q.Count(ctx)
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

func (s *PostgresStore) ListChanges(ctx context.Context, p ListChangesParams) ([]*ent.Change, int, error) {
	q := s.client.Change.Query().Where(change.TaskIDEQ(p.TaskID))
	if p.Field != "" {
		q = q.Where(change.FieldNameEQ(p.Field))
	}
	total, err := q.Count(ctx)
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

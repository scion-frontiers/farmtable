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

	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/apitoken"
	"github.com/farmtable-io/farmtable/internal/store/ent/change"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/comment"
	"github.com/farmtable-io/farmtable/internal/store/ent/predicate"
	"github.com/farmtable-io/farmtable/internal/store/ent/relationship"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/store/ent/user"
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
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		db.Close()
		return nil, fmt.Errorf("setting busy timeout: %w", err)
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
		exists, err := tx.Relationship.Query().Where(
			relationship.SourceTaskIDEQ(t.ID),
			relationship.TargetTaskIDEQ(targetID),
			relationship.TypeEQ(relationship.TypeBlocks),
		).Exist(ctx)
		if err != nil {
			return nil, fmt.Errorf("checking blocks relationship: %w", err)
		}
		if exists {
			continue
		}
		_, err = tx.Relationship.Create().
			SetSourceTaskID(t.ID).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlocks).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("creating blocks relationship: %w", err)
		}
	}
	for _, targetID := range p.BlockedByTaskIDs {
		exists, err := tx.Relationship.Query().Where(
			relationship.SourceTaskIDEQ(t.ID),
			relationship.TargetTaskIDEQ(targetID),
			relationship.TypeEQ(relationship.TypeBlockedBy),
		).Exist(ctx)
		if err != nil {
			return nil, fmt.Errorf("checking blocked_by relationship: %w", err)
		}
		if exists {
			continue
		}
		_, err = tx.Relationship.Create().
			SetSourceTaskID(t.ID).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlockedBy).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("creating blocked_by relationship: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing task creation: %w", err)
	}

	return s.getTaskWithEdges(ctx, t.ID)
}

func (s *EntStore) InsertTasksAfter(ctx context.Context, p InsertTasksAfterParams) (*InsertTasksAfterResult, error) {
	if len(p.Steps) == 0 {
		return nil, ErrInvalidArgument
	}

	tx, err := s.client.Tx(ctx)
	if err != nil {
		return nil, fmt.Errorf("starting transaction: %w", err)
	}
	defer tx.Rollback()

	anchor, err := tx.Task.Query().
		Where(task.IDEQ(p.AnchorTaskID), task.CollectionIDEQ(p.CollectionID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting anchor task: %w", err)
	}

	downstream, err := tx.Relationship.Query().
		Where(
			relationship.SourceTaskIDEQ(p.AnchorTaskID),
			relationship.TypeEQ(relationship.TypeBlocks),
		).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("loading downstream relationships: %w", err)
	}

	insertedIDs := make([]uuid.UUID, 0, len(p.Steps))
	for i, step := range p.Steps {
		create := tx.Task.Create().
			SetTitle(step.Title).
			SetDescription(step.Description).
			SetCollectionID(p.CollectionID).
			SetPhase(step.Phase).
			SetStage(step.Stage).
			SetNativeLabel(step.NativeLabel).
			SetType(step.Type).
			SetVersion("1")

		if step.Priority != nil {
			create.SetPriority(*step.Priority)
		}
		if len(step.Labels) > 0 {
			create.SetLabels(step.Labels)
		}

		inserted, err := create.Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("creating inserted task %d: %w", i+1, err)
		}
		insertedIDs = append(insertedIDs, inserted.ID)
	}

	chain := append([]uuid.UUID{p.AnchorTaskID}, insertedIDs...)
	for i := 0; i < len(chain)-1; i++ {
		if err := createBlocksRelationship(ctx, tx, chain[i], chain[i+1]); err != nil {
			return nil, err
		}
	}

	lastInsertedID := insertedIDs[len(insertedIDs)-1]
	for _, rel := range downstream {
		if err := createBlocksRelationship(ctx, tx, lastInsertedID, rel.TargetTaskID); err != nil {
			return nil, err
		}
	}

	if len(downstream) > 0 {
		downstreamIDs := make([]uuid.UUID, 0, len(downstream))
		for _, rel := range downstream {
			downstreamIDs = append(downstreamIDs, rel.TargetTaskID)
		}
		_, err = tx.Relationship.Delete().
			Where(
				relationship.SourceTaskIDEQ(p.AnchorTaskID),
				relationship.TargetTaskIDIn(downstreamIDs...),
				relationship.TypeEQ(relationship.TypeBlocks),
			).
			Exec(ctx)
		if err != nil {
			return nil, fmt.Errorf("removing anchor downstream relationships: %w", err)
		}
	}

	currentVersion, _ := strconv.Atoi(anchor.Version)
	if _, err := tx.Task.Update().
		Where(task.IDEQ(p.AnchorTaskID)).
		SetVersion(strconv.Itoa(currentVersion + 1)).
		Save(ctx); err != nil {
		return nil, fmt.Errorf("updating anchor task version: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing task insertion: %w", err)
	}

	insertedTasks := make([]*ent.Task, 0, len(insertedIDs))
	for _, id := range insertedIDs {
		inserted, err := s.getTaskWithEdges(ctx, id)
		if err != nil {
			return nil, err
		}
		insertedTasks = append(insertedTasks, inserted)
	}
	anchorResult, err := s.getTaskWithEdges(ctx, p.AnchorTaskID)
	if err != nil {
		return nil, err
	}

	return &InsertTasksAfterResult{
		InsertedTasks: insertedTasks,
		AnchorTask:    anchorResult,
	}, nil
}

func createBlocksRelationship(ctx context.Context, tx *ent.Tx, sourceID, targetID uuid.UUID) error {
	exists, err := tx.Relationship.Query().Where(
		relationship.SourceTaskIDEQ(sourceID),
		relationship.TargetTaskIDEQ(targetID),
		relationship.TypeEQ(relationship.TypeBlocks),
	).Exist(ctx)
	if err != nil {
		return fmt.Errorf("checking blocks relationship: %w", err)
	}
	if exists {
		return nil
	}
	_, err = tx.Relationship.Create().
		SetSourceTaskID(sourceID).
		SetTargetTaskID(targetID).
		SetType(relationship.TypeBlocks).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("creating blocks relationship: %w", err)
	}
	return nil
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

	desc := p.SortOrder == "desc"
	sortField := p.SortField
	if sortField == "" {
		sortField = "created"
	}

	switch sortField {
	case "created":
		if desc {
			q = q.Order(task.ByCreatedAt(entsql.OrderDesc()), task.ByID(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByCreatedAt(), task.ByID())
		}
	case "updated":
		if desc {
			q = q.Order(task.ByUpdatedAt(entsql.OrderDesc()), task.ByID(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByUpdatedAt(), task.ByID())
		}
	case "priority":
		if desc {
			q = q.Order(task.ByPriority(entsql.OrderDesc()), task.ByID(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByPriority(), task.ByID())
		}
	case "due_date":
		if desc {
			q = q.Order(task.ByDueDate(entsql.OrderDesc()), task.ByID(entsql.OrderDesc()))
		} else {
			q = q.Order(task.ByDueDate(), task.ByID())
		}
	}

	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting tasks: %w", err)
	}

	if p.LastID != "" {
		lastID, parseErr := uuid.Parse(p.LastID)
		if parseErr != nil {
			return nil, 0, fmt.Errorf("invalid cursor last_id: %w", parseErr)
		}
		var dbField string
		switch sortField {
		case "updated":
			dbField = task.FieldUpdatedAt
		case "priority":
			dbField = task.FieldPriority
		case "due_date":
			dbField = task.FieldDueDate
		default:
			dbField = task.FieldCreatedAt
		}
		q = q.Where(keysetPredTask(dbField, p.LastSortValue, lastID, desc))
	}

	if p.Limit > 0 {
		q = q.Limit(p.Limit)
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

func (s *EntStore) UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams, actorID uuid.UUID) (*ent.Task, error) {
	for attempt := 0; ; attempt++ {
		result, err := s.doUpdateTask(ctx, id, p, actorID)
		if err == ErrConflict && p.Version == "" && attempt == 0 {
			continue
		}
		return result, err
	}
}

func (s *EntStore) doUpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams, actorID uuid.UUID) (*ent.Task, error) {
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
		remoteData := make(map[string]any, len(old.RemoteData)+len(p.RemoteData))
		for key, value := range old.RemoteData {
			remoteData[key] = value
		}
		for key, value := range p.RemoteData {
			remoteData[key] = value
		}
		update.SetRemoteData(remoteData)
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
		exists, err := tx.Relationship.Query().Where(
			relationship.SourceTaskIDEQ(id),
			relationship.TargetTaskIDEQ(targetID),
			relationship.TypeEQ(relationship.TypeBlocks),
		).Exist(ctx)
		if err != nil {
			return nil, fmt.Errorf("checking blocks relationship: %w", err)
		}
		if exists {
			continue
		}
		_, err = tx.Relationship.Create().
			SetSourceTaskID(id).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlocks).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("creating blocks relationship: %w", err)
		}
	}
	for _, targetID := range p.AddBlockedBy {
		exists, err := tx.Relationship.Query().Where(
			relationship.SourceTaskIDEQ(id),
			relationship.TargetTaskIDEQ(targetID),
			relationship.TypeEQ(relationship.TypeBlockedBy),
		).Exist(ctx)
		if err != nil {
			return nil, fmt.Errorf("checking blocked_by relationship: %w", err)
		}
		if exists {
			continue
		}
		_, err = tx.Relationship.Create().
			SetSourceTaskID(id).
			SetTargetTaskID(targetID).
			SetType(relationship.TypeBlockedBy).
			Save(ctx)
		if err != nil {
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
			SetAuthorID(actorID).
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

func (s *EntStore) CloseTask(ctx context.Context, id uuid.UUID, stage task.Stage, version string, actorID uuid.UUID) (*ent.Task, error) {
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

		if err := s.recordChanges(ctx, id, actorID, old, result); err != nil {
			log.Printf("recording changes for task %s: %v", id, err)
		}

		return result, nil
	}
}

func (s *EntStore) DeleteTask(ctx context.Context, id uuid.UUID) error {
	n, err := s.client.Task.Delete().Where(task.IDEQ(id)).Exec(ctx)
	if err != nil {
		return fmt.Errorf("deleting task: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
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

func (s *EntStore) UpdateCollection(ctx context.Context, id uuid.UUID, p UpdateCollectionParams) (*ent.Collection, error) {
	update := s.client.Collection.UpdateOneID(id)
	if p.Name != nil {
		update.SetName(*p.Name)
	}
	if p.Description != nil {
		update.SetDescription(*p.Description)
	}
	c, err := update.Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("updating collection: %w", err)
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
	if p.LastID != "" {
		lastID, parseErr := uuid.Parse(p.LastID)
		if parseErr != nil {
			return nil, 0, fmt.Errorf("invalid cursor last_id: %w", parseErr)
		}
		q = q.Where(keysetPredCollection(p.LastSortValue, lastID))
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	cols, err := q.Order(collection.ByCreatedAt(), collection.ByID()).All(ctx)
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
	if p.LastID != "" {
		lastID, parseErr := uuid.Parse(p.LastID)
		if parseErr != nil {
			return nil, 0, fmt.Errorf("invalid cursor last_id: %w", parseErr)
		}
		q = q.Where(keysetPredComment(p.LastSortValue, lastID))
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	comments, err := q.Order(comment.ByCreatedAt(), comment.ByID()).All(ctx)
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

// ── User Methods ──

func (s *EntStore) CreateUser(ctx context.Context, p CreateUserParams) (*ent.User, error) {
	create := s.client.User.Create().
		SetDisplayName(p.DisplayName).
		SetType(p.Type).
		SetStatus(p.Status)

	if p.Email != nil {
		create.SetEmail(*p.Email)
	}

	u, err := create.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}
	return u, nil
}

func (s *EntStore) GetUser(ctx context.Context, id uuid.UUID) (*ent.User, error) {
	u, err := s.client.User.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting user: %w", err)
	}
	return u, nil
}

func (s *EntStore) GetUserByName(ctx context.Context, name string) (*ent.User, error) {
	u, err := s.client.User.Query().
		Where(user.DisplayNameEQ(name)).
		First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("getting user by name: %w", err)
	}
	return u, nil
}

func (s *EntStore) ListUsers(ctx context.Context, p ListUsersParams) ([]*ent.User, int, error) {
	q := s.client.User.Query()
	if p.Type != "" {
		q = q.Where(user.TypeEQ(p.Type))
	}
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting users: %w", err)
	}
	if p.LastID != "" {
		lastID, parseErr := uuid.Parse(p.LastID)
		if parseErr != nil {
			return nil, 0, fmt.Errorf("invalid cursor last_id: %w", parseErr)
		}
		q = q.Where(keysetPredUser(p.LastSortValue, lastID))
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	users, err := q.Order(user.ByCreatedAt(), user.ByID()).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("listing users: %w", err)
	}
	return users, total, nil
}

// ── API Token Methods ──

func HashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func (s *EntStore) CreateAPIToken(ctx context.Context, p CreateAPITokenParams) (*ent.ApiToken, string, error) {
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		return nil, "", fmt.Errorf("generating token: %w", err)
	}
	rawToken := "ft_" + hex.EncodeToString(rawBytes)
	tokenHash := HashToken(rawToken)

	create := s.client.ApiToken.Create().
		SetTokenHash(tokenHash).
		SetName(p.Name).
		SetUserID(p.UserID)

	if p.ExpiresAt != nil {
		create.SetExpiresAt(*p.ExpiresAt)
	}

	tok, err := create.Save(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("creating api token: %w", err)
	}
	return tok, rawToken, nil
}

func (s *EntStore) LookupToken(ctx context.Context, tokenHash string) (*ent.ApiToken, error) {
	tok, err := s.client.ApiToken.Query().
		Where(apitoken.TokenHashEQ(tokenHash)).
		WithUser().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("looking up token: %w", err)
	}
	return tok, nil
}

func (s *EntStore) ListAPITokens(ctx context.Context, p ListAPITokensParams) ([]*ent.ApiToken, int, error) {
	q := s.client.ApiToken.Query().WithUser()
	if p.UserID != nil {
		q = q.Where(apitoken.UserIDEQ(*p.UserID))
	}
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting tokens: %w", err)
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	tokens, err := q.Order(apitoken.ByCreatedAt(), apitoken.ByID()).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("listing tokens: %w", err)
	}
	return tokens, total, nil
}

func (s *EntStore) RevokeAPIToken(ctx context.Context, id uuid.UUID) error {
	err := s.client.ApiToken.DeleteOneID(id).Exec(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrNotFound
		}
		return fmt.Errorf("revoking token: %w", err)
	}
	return nil
}

func (s *EntStore) UpdateTokenLastUsed(ctx context.Context, id uuid.UUID) error {
	_, err := s.client.ApiToken.UpdateOneID(id).
		SetLastUsedAt(time.Now().UTC()).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("updating token last_used_at: %w", err)
	}
	return nil
}

func keysetPredUser(lastSortValue string, lastID uuid.UUID) predicate.User {
	return predicate.User(func(s *entsql.Selector) {
		colRef := s.C(user.FieldCreatedAt)
		idRef := s.C(user.FieldID)
		var sortVal interface{} = lastSortValue
		if t, err := time.Parse(time.RFC3339Nano, lastSortValue); err == nil {
			sortVal = t
		}
		s.Where(entsql.Or(
			entsql.GT(colRef, sortVal),
			entsql.And(
				entsql.EQ(colRef, sortVal),
				entsql.GT(idRef, lastID),
			),
		))
	})
}

func keysetPredTask(sortCol, lastSortValue string, lastID uuid.UUID, desc bool) predicate.Task {
	return predicate.Task(func(s *entsql.Selector) {
		idRef := s.C(task.FieldID)

		var sortVal interface{} = lastSortValue
		if sortCol == task.FieldCreatedAt || sortCol == task.FieldUpdatedAt || sortCol == task.FieldDueDate {
			if t, err := time.Parse(time.RFC3339Nano, lastSortValue); err == nil {
				sortVal = t
			}
		}

		colRef := s.C(sortCol)
		if desc {
			s.Where(entsql.Or(
				entsql.LT(colRef, sortVal),
				entsql.And(
					entsql.EQ(colRef, sortVal),
					entsql.LT(idRef, lastID),
				),
			))
		} else {
			s.Where(entsql.Or(
				entsql.GT(colRef, sortVal),
				entsql.And(
					entsql.EQ(colRef, sortVal),
					entsql.GT(idRef, lastID),
				),
			))
		}
	})
}

func keysetPredComment(lastSortValue string, lastID uuid.UUID) predicate.Comment {
	return predicate.Comment(func(s *entsql.Selector) {
		colRef := s.C(comment.FieldCreatedAt)
		idRef := s.C(comment.FieldID)
		var sortVal interface{} = lastSortValue
		if t, err := time.Parse(time.RFC3339Nano, lastSortValue); err == nil {
			sortVal = t
		}
		s.Where(entsql.Or(
			entsql.GT(colRef, sortVal),
			entsql.And(
				entsql.EQ(colRef, sortVal),
				entsql.GT(idRef, lastID),
			),
		))
	})
}

func keysetPredChange(lastSortValue string, lastID uuid.UUID) predicate.Change {
	return predicate.Change(func(s *entsql.Selector) {
		colRef := s.C(change.FieldCreatedAt)
		idRef := s.C(change.FieldID)
		var sortVal interface{} = lastSortValue
		if t, err := time.Parse(time.RFC3339Nano, lastSortValue); err == nil {
			sortVal = t
		}
		s.Where(entsql.Or(
			entsql.GT(colRef, sortVal),
			entsql.And(
				entsql.EQ(colRef, sortVal),
				entsql.GT(idRef, lastID),
			),
		))
	})
}

func keysetPredCollection(lastSortValue string, lastID uuid.UUID) predicate.Collection {
	return predicate.Collection(func(s *entsql.Selector) {
		colRef := s.C(collection.FieldCreatedAt)
		idRef := s.C(collection.FieldID)
		var sortVal interface{} = lastSortValue
		if t, err := time.Parse(time.RFC3339Nano, lastSortValue); err == nil {
			sortVal = t
		}
		s.Where(entsql.Or(
			entsql.GT(colRef, sortVal),
			entsql.And(
				entsql.EQ(colRef, sortVal),
				entsql.GT(idRef, lastID),
			),
		))
	})
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
	if p.LastID != "" {
		lastID, parseErr := uuid.Parse(p.LastID)
		if parseErr != nil {
			return nil, 0, fmt.Errorf("invalid cursor last_id: %w", parseErr)
		}
		q = q.Where(keysetPredChange(p.LastSortValue, lastID))
	}
	if p.Limit > 0 {
		q = q.Limit(p.Limit)
	}
	changes, err := q.Order(change.ByCreatedAt(), change.ByID()).All(ctx)
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
